


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";






CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "extensions";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "hypopg" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "index_advisor" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."sync_request_status" AS ENUM (
    'PENDING',
    'LEASED',
    'DONE',
    'FAILED'
);


ALTER TYPE "public"."sync_request_status" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enqueue_container_sync_batch"("p_due_window" interval DEFAULT '24:00:00'::interval, "p_recent_window" interval DEFAULT '01:00:00'::interval, "p_limit_per_provider" integer DEFAULT 10) RETURNS TABLE("provider" "text", "selected_count" integer, "enqueued_new_count" integer, "deduped_open_count" integer)
    LANGUAGE "plpgsql"
    AS $$
declare
  v_now timestamptz := now();
  v_tenant_id uuid;
  v_active_winner_count integer := 0;
begin
  if p_due_window is null or p_due_window <= interval '0 seconds' then
    raise exception 'enqueue_container_sync_batch requires p_due_window > 0'
      using errcode = '22023';
  end if;

  if p_recent_window is null or p_recent_window <= interval '0 seconds' then
    raise exception 'enqueue_container_sync_batch requires p_recent_window > 0'
      using errcode = '22023';
  end if;

  if p_limit_per_provider is null or p_limit_per_provider < 1 then
    raise exception 'enqueue_container_sync_batch requires p_limit_per_provider >= 1'
      using errcode = '22023';
  end if;

  with active_agents as (
    select
      ta.tenant_id,
      count(*)::integer as active_count
    from public.tracking_agents ta
    where ta.revoked_at is null
      and ta.status in ('CONNECTED', 'DEGRADED')
    group by ta.tenant_id
  ),
  max_active as (
    select max(aa.active_count) as max_active_count
    from active_agents aa
  ),
  active_winners as (
    select aa.tenant_id
    from active_agents aa
    inner join max_active ma
      on aa.active_count = ma.max_active_count
  )
  select count(*)::integer
  into v_active_winner_count
  from active_winners;

  if v_active_winner_count = 1 then
    with active_agents as (
      select
        ta.tenant_id,
        count(*)::integer as active_count
      from public.tracking_agents ta
      where ta.revoked_at is null
        and ta.status in ('CONNECTED', 'DEGRADED')
      group by ta.tenant_id
    ),
    max_active as (
      select max(aa.active_count) as max_active_count
      from active_agents aa
    )
    select aa.tenant_id
    into v_tenant_id
    from active_agents aa
    inner join max_active ma
      on aa.active_count = ma.max_active_count
    limit 1;
  end if;

  if v_tenant_id is null then
    select sr.tenant_id
    into v_tenant_id
    from public.sync_requests sr
    order by sr.created_at desc, sr.id desc
    limit 1;
  end if;

  if v_tenant_id is null then
    raise exception 'enqueue_container_sync_batch could not resolve tenant_id'
      using errcode = '22023';
  end if;

  return query
  with candidate_containers as (
    select distinct
      case
        when lower(regexp_replace(coalesce(c.carrier_code, ''), '[^a-zA-Z0-9]+', '', 'g')) in ('maersk', 'msc', 'cmacgm', 'pil', 'one')
          then lower(regexp_replace(coalesce(c.carrier_code, ''), '[^a-zA-Z0-9]+', '', 'g'))
        else null
      end as target_provider,
      upper(btrim(c.container_number)) as container_number
    from public.containers c
    inner join public.processes p
      on p.id = c.process_id
    where p.archived_at is null
      and p.deleted_at is null
      and c.removed_at is null
      and nullif(btrim(c.container_number), '') is not null
  ),
  eligible_containers as (
    select
      cc.target_provider,
      cc.container_number
    from candidate_containers cc
    where cc.target_provider is not null
  ),
  with_last_done as (
    select
      ec.target_provider,
      ec.container_number,
      max(sr.updated_at) as last_done_at
    from eligible_containers ec
    left join public.sync_requests sr
      on sr.tenant_id = v_tenant_id
      and sr.provider = ec.target_provider
      and sr.ref_type = 'container'
      and sr.ref_value = ec.container_number
      and sr.status = 'DONE'
    group by ec.target_provider, ec.container_number
  ),
  due_candidates as (
    select
      wld.target_provider,
      wld.container_number,
      wld.last_done_at
    from with_last_done wld
    where wld.last_done_at is null
      or wld.last_done_at < (v_now - p_due_window)
  ),
  without_recent as (
    select
      dc.target_provider,
      dc.container_number,
      dc.last_done_at
    from due_candidates dc
    where not exists (
      select 1
      from public.sync_requests sr
      where sr.tenant_id = v_tenant_id
        and sr.provider = dc.target_provider
        and sr.ref_type = 'container'
        and sr.ref_value = dc.container_number
        and sr.created_at >= (v_now - p_recent_window)
    )
  ),
  ranked as (
    select
      wr.target_provider,
      wr.container_number,
      wr.last_done_at,
      row_number() over (
        partition by wr.target_provider
        order by wr.last_done_at asc nulls first, wr.container_number asc
      ) as row_num
    from without_recent wr
  ),
  selected as (
    select
      r.target_provider,
      r.container_number
    from ranked r
    where r.row_num <= p_limit_per_provider
  ),
  selected_count_by_provider as (
    select
      s.target_provider,
      count(*)::integer as selected_count
    from selected s
    group by s.target_provider
  ),
  enqueue_calls as (
    select
      s.target_provider,
      er.is_new
    from selected s
    cross join lateral public.enqueue_sync_request(
      v_tenant_id,
      s.target_provider,
      'container',
      s.container_number,
      0
    ) er
  ),
  enqueue_count_by_provider as (
    select
      ec.target_provider,
      count(*) filter (where ec.is_new)::integer as enqueued_new_count,
      count(*) filter (where not ec.is_new)::integer as deduped_open_count
    from enqueue_calls ec
    group by ec.target_provider
  ),
  provider_union as (
    select scbp.target_provider from selected_count_by_provider scbp
    union
    select ecbp.target_provider from enqueue_count_by_provider ecbp
  )
  select
    pu.target_provider as provider,
    coalesce(scbp.selected_count, 0)::integer as selected_count,
    coalesce(ecbp.enqueued_new_count, 0)::integer as enqueued_new_count,
    coalesce(ecbp.deduped_open_count, 0)::integer as deduped_open_count
  from provider_union pu
  left join selected_count_by_provider scbp
    on scbp.target_provider = pu.target_provider
  left join enqueue_count_by_provider ecbp
    on ecbp.target_provider = pu.target_provider
  order by pu.target_provider;
end;
$$;


ALTER FUNCTION "public"."enqueue_container_sync_batch"("p_due_window" interval, "p_recent_window" interval, "p_limit_per_provider" integer) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enqueue_sync_request"("p_tenant_id" "uuid", "p_provider" "text", "p_ref_type" "text" DEFAULT 'container'::"text", "p_ref_value" "text" DEFAULT ''::"text", "p_priority" integer DEFAULT 0) RETURNS TABLE("id" "uuid", "status" "public"."sync_request_status", "is_new" boolean)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_ref_type text := coalesce(nullif(trim(p_ref_type), ''), 'container');
  v_ref_value text := upper(trim(p_ref_value));
  v_id uuid;
  v_status public.sync_request_status;
begin
  if v_ref_type <> 'container' then
    raise exception 'enqueue_sync_request only supports ref_type=container (got %)', v_ref_type
      using errcode = '22023';
  end if;

  if v_ref_value = '' then
    raise exception 'enqueue_sync_request requires a non-empty ref_value'
      using errcode = '22023';
  end if;

  begin
    insert into public.sync_requests (
      tenant_id,
      provider,
      ref_type,
      ref_value,
      status,
      priority
    )
    values (
      p_tenant_id,
      p_provider,
      v_ref_type,
      v_ref_value,
      'PENDING',
      coalesce(p_priority, 0)
    )
    returning sync_requests.id, sync_requests.status
    into v_id, v_status;

    return query
    select v_id, v_status, true;
  exception
    when unique_violation then
      select sr.id, sr.status
      into v_id, v_status
      from public.sync_requests sr
      where sr.tenant_id = p_tenant_id
        and sr.provider = p_provider
        and sr.ref_type = v_ref_type
        and sr.ref_value = v_ref_value
        and sr.status in ('PENDING', 'LEASED')
      order by
        case when sr.status = 'PENDING' then 0 else 1 end,
        sr.priority desc,
        sr.created_at asc
      limit 1;

      if v_id is null then
        raise;
      end if;

      return query
      select v_id, v_status, false;
  end;
end;
$$;


ALTER FUNCTION "public"."enqueue_sync_request"("p_tenant_id" "uuid", "p_provider" "text", "p_ref_type" "text", "p_ref_value" "text", "p_priority" integer) OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."sync_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "provider" "text" NOT NULL,
    "ref_type" "text" NOT NULL,
    "ref_value" "text" NOT NULL,
    "status" "public"."sync_request_status" DEFAULT 'PENDING'::"public"."sync_request_status" NOT NULL,
    "priority" integer DEFAULT 0 NOT NULL,
    "leased_by" "text",
    "leased_until" timestamp with time zone,
    "attempts" integer DEFAULT 0 NOT NULL,
    "last_error" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "sync_requests_provider_check" CHECK (("provider" = ANY (ARRAY['maersk'::"text", 'msc'::"text", 'cmacgm'::"text", 'pil'::"text", 'one'::"text"]))),
    CONSTRAINT "sync_requests_ref_type_check" CHECK (("ref_type" = 'container'::"text"))
);


ALTER TABLE "public"."sync_requests" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."lease_sync_requests"("p_tenant_id" "uuid", "p_agent_id" "text", "p_limit" integer DEFAULT 10, "p_lease_minutes" integer DEFAULT 5, "p_include_owned_active_leases" boolean DEFAULT false, "p_processable_providers" "text"[] DEFAULT NULL::"text"[]) RETURNS SETOF "public"."sync_requests"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
declare
  v_now timestamptz := now();
  v_limit integer := greatest(coalesce(p_limit, 10), 1);
  v_lease_minutes integer := greatest(coalesce(p_lease_minutes, 5), 1);
  v_has_provider_filter boolean := p_processable_providers is not null;
begin
  return query
  with candidate as (
    select sr.id
    from public.sync_requests sr
    where sr.tenant_id = p_tenant_id
      and (
        not v_has_provider_filter
        or sr.provider = any(p_processable_providers)
      )
      and (
        sr.status = 'PENDING'
        or (sr.status = 'LEASED' and sr.leased_until is not null and sr.leased_until < v_now)
        or (
          coalesce(p_include_owned_active_leases, false)
          and sr.status = 'LEASED'
          and sr.leased_by = p_agent_id
          and sr.leased_until is not null
          and sr.leased_until >= v_now
        )
      )
    order by sr.priority desc, sr.created_at asc
    limit v_limit
    for update skip locked
  )
  update public.sync_requests sr
  set
    status = 'LEASED',
    leased_by = p_agent_id,
    leased_until = v_now + make_interval(mins => v_lease_minutes),
    attempts = sr.attempts + 1,
    updated_at = v_now
  where sr.id in (select id from candidate)
  returning sr.*;
end;
$$;


ALTER FUNCTION "public"."lease_sync_requests"("p_tenant_id" "uuid", "p_agent_id" "text", "p_limit" integer, "p_lease_minutes" integer, "p_include_owned_active_leases" boolean, "p_processable_providers" "text"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prune_agent_log_events"() RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
declare
  deleted_count integer;
begin
  delete from public.agent_log_events
  where created_at < now() - interval '7 days';

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;


ALTER FUNCTION "public"."prune_agent_log_events"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prune_sync_requests"() RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
declare
  deleted_count integer;
begin
  delete from public.sync_requests
  where status in ('DONE', 'FAILED')
    and created_at < now() - interval '14 days';

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;


ALTER FUNCTION "public"."prune_sync_requests"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."prune_tracking_agent_activity_events"() RETURNS integer
    LANGUAGE "plpgsql"
    AS $$
declare
  deleted_count integer;
begin
  delete from public.tracking_agent_activity_events
  where created_at < now() - interval '30 days';

  get diagnostics deleted_count = row_count;
  return deleted_count;
end;
$$;


ALTER FUNCTION "public"."prune_tracking_agent_activity_events"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_sync_requests_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_sync_requests_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."set_updated_at_column"() OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."agent_enrollment_audit_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "event_type" "text" NOT NULL,
    "status_code" integer NOT NULL,
    "tenant_id" "uuid",
    "machine_fingerprint" "text",
    "hostname" "text",
    "ip_address" "text",
    "reason" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "agent_enrollment_audit_events_event_type_check" CHECK (("event_type" = ANY (ARRAY['ENROLL_ATTEMPT'::"text", 'ENROLL_SUCCESS'::"text", 'ENROLL_FAILURE'::"text", 'ENROLL_RATE_LIMITED'::"text"])))
);


ALTER TABLE "public"."agent_enrollment_audit_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."agent_install_tokens" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "token_hash" "text" NOT NULL,
    "description" "text",
    "revoked_at" timestamp with time zone,
    "expires_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "agent_install_tokens_hash_check" CHECK (("token_hash" ~ '^[0-9a-f]{64}$'::"text"))
);


ALTER TABLE "public"."agent_install_tokens" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."agent_log_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "agent_id" "uuid" NOT NULL,
    "sequence" bigint NOT NULL,
    "channel" "text" NOT NULL,
    "message" "text" NOT NULL,
    "occurred_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "truncated" boolean DEFAULT false NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "agent_log_events_channel_check" CHECK (("channel" = ANY (ARRAY['stdout'::"text", 'stderr'::"text"]))),
    CONSTRAINT "agent_log_events_sequence_non_negative_check" CHECK (("sequence" >= 0))
);


ALTER TABLE "public"."agent_log_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."container_observations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "fingerprint" "text" NOT NULL,
    "container_id" "uuid" NOT NULL,
    "container_number" "text" NOT NULL,
    "type" "text" NOT NULL,
    "event_time" timestamp with time zone,
    "location_code" "text",
    "location_display" "text",
    "vessel_name" "text",
    "voyage" "text",
    "is_empty" boolean,
    "confidence" "text" NOT NULL,
    "provider" "text" NOT NULL,
    "created_from_snapshot_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "retroactive" boolean DEFAULT false NOT NULL,
    "event_time_type" "text" NOT NULL,
    "carrier_label" "text",
    "temporal_kind" "text",
    "event_time_instant" timestamp with time zone,
    "event_date" "date",
    "event_time_local" "text",
    "event_time_zone" "text",
    "event_time_source" "text",
    "raw_event_time" "text"
);


ALTER TABLE "public"."container_observations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."container_snapshots" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "container_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "provider" "text" NOT NULL,
    "fetched_at" timestamp with time zone NOT NULL,
    "payload" json NOT NULL,
    "parse_error" "text"
);


ALTER TABLE "public"."container_snapshots" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."containers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "process_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "container_number" "text" NOT NULL,
    "carrier_code" "text" NOT NULL,
    "container_type" "text",
    "container_size" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "removed_at" timestamp with time zone
);


ALTER TABLE "public"."containers" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."processes" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "reference" "text",
    "origin" "jsonb",
    "destination" "jsonb",
    "carrier" "text",
    "bill_of_lading" "text",
    "booking_reference" "text",
    "source" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "client_id" "uuid",
    "importer_name" "text",
    "exporter_name" "text",
    "reference_importer" "text",
    "booking_number" "text",
    "archived_at" timestamp with time zone,
    "deleted_at" timestamp with time zone,
    "product" "text",
    "redestination_number" "text"
);


ALTER TABLE "public"."processes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tracking_agent_activity_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "agent_id" "uuid" NOT NULL,
    "event_type" "text" NOT NULL,
    "message" "text" NOT NULL,
    "severity" "text" DEFAULT 'info'::"text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "occurred_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "tracking_agent_activity_events_event_type_check" CHECK (("event_type" = ANY (ARRAY['ENROLLED'::"text", 'HEARTBEAT'::"text", 'LEASED_TARGET'::"text", 'SNAPSHOT_INGESTED'::"text", 'REQUEST_FAILED'::"text", 'REALTIME_SUBSCRIBED'::"text", 'REALTIME_CHANNEL_ERROR'::"text", 'LEASE_CONFLICT'::"text", 'UPDATE_CHECKED'::"text", 'UPDATE_AVAILABLE'::"text", 'UPDATE_DOWNLOAD_STARTED'::"text", 'UPDATE_DOWNLOAD_COMPLETED'::"text", 'UPDATE_READY'::"text", 'UPDATE_APPLY_STARTED'::"text", 'UPDATE_APPLY_FAILED'::"text", 'RESTART_FOR_UPDATE'::"text", 'ROLLBACK_EXECUTED'::"text"]))),
    CONSTRAINT "tracking_agent_activity_events_severity_check" CHECK (("severity" = ANY (ARRAY['info'::"text", 'warning'::"text", 'danger'::"text", 'success'::"text"])))
);


ALTER TABLE "public"."tracking_agent_activity_events" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tracking_agents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "machine_fingerprint" "text" NOT NULL,
    "hostname" "text" NOT NULL,
    "os" "text" NOT NULL,
    "agent_version" "text" NOT NULL,
    "agent_token" "text" NOT NULL,
    "interval_sec" integer DEFAULT 60 NOT NULL,
    "max_concurrent" integer DEFAULT 10 NOT NULL,
    "supabase_url" "text",
    "supabase_anon_key" "text",
    "maersk_enabled" boolean DEFAULT false NOT NULL,
    "maersk_headless" boolean DEFAULT true NOT NULL,
    "maersk_timeout_ms" integer DEFAULT 120000 NOT NULL,
    "maersk_user_data_dir" "text",
    "last_enrolled_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "revoked_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "enrolled_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "last_seen_at" timestamp with time zone,
    "status" "text" DEFAULT 'UNKNOWN'::"text" NOT NULL,
    "realtime_state" "text" DEFAULT 'UNKNOWN'::"text" NOT NULL,
    "processing_state" "text" DEFAULT 'unknown'::"text" NOT NULL,
    "lease_health" "text" DEFAULT 'unknown'::"text" NOT NULL,
    "active_jobs" integer DEFAULT 0 NOT NULL,
    "capabilities" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "token_id_masked" "text",
    "last_error" "text",
    "queue_lag_seconds" integer,
    "current_version" "text" DEFAULT 'unknown'::"text" NOT NULL,
    "desired_version" "text",
    "update_channel" "text" DEFAULT 'stable'::"text" NOT NULL,
    "updater_state" "text" DEFAULT 'idle'::"text" NOT NULL,
    "updater_last_checked_at" timestamp with time zone,
    "updater_last_error" "text",
    "update_ready_version" "text",
    "restart_requested_at" timestamp with time zone,
    "boot_status" "text" DEFAULT 'unknown'::"text" NOT NULL,
    "enrollment_method" "text",
    "logs_supported" boolean DEFAULT false NOT NULL,
    "last_log_at" timestamp with time zone,
    CONSTRAINT "tracking_agents_active_jobs_check" CHECK (("active_jobs" >= 0)),
    CONSTRAINT "tracking_agents_boot_status_check" CHECK (("boot_status" = ANY (ARRAY['starting'::"text", 'healthy'::"text", 'degraded'::"text", 'unknown'::"text"]))),
    CONSTRAINT "tracking_agents_capabilities_array_check" CHECK (("jsonb_typeof"("capabilities") = 'array'::"text")),
    CONSTRAINT "tracking_agents_current_version_non_empty_check" CHECK (("btrim"("current_version") <> ''::"text")),
    CONSTRAINT "tracking_agents_interval_check" CHECK (("interval_sec" > 0)),
    CONSTRAINT "tracking_agents_lease_health_check" CHECK (("lease_health" = ANY (ARRAY['healthy'::"text", 'stale'::"text", 'conflict'::"text", 'unknown'::"text"]))),
    CONSTRAINT "tracking_agents_max_concurrent_check" CHECK ((("max_concurrent" >= 1) AND ("max_concurrent" <= 100))),
    CONSTRAINT "tracking_agents_processing_state_check" CHECK (("processing_state" = ANY (ARRAY['idle'::"text", 'leasing'::"text", 'processing'::"text", 'backing_off'::"text", 'unknown'::"text"]))),
    CONSTRAINT "tracking_agents_queue_lag_seconds_check" CHECK ((("queue_lag_seconds" IS NULL) OR ("queue_lag_seconds" >= 0))),
    CONSTRAINT "tracking_agents_realtime_state_check" CHECK (("realtime_state" = ANY (ARRAY['SUBSCRIBED'::"text", 'CHANNEL_ERROR'::"text", 'CONNECTING'::"text", 'DISCONNECTED'::"text", 'UNKNOWN'::"text"]))),
    CONSTRAINT "tracking_agents_status_check" CHECK (("status" = ANY (ARRAY['CONNECTED'::"text", 'DEGRADED'::"text", 'DISCONNECTED'::"text", 'UNKNOWN'::"text"]))),
    CONSTRAINT "tracking_agents_timeout_check" CHECK (("maersk_timeout_ms" > 0)),
    CONSTRAINT "tracking_agents_update_channel_non_empty_check" CHECK (("btrim"("update_channel") <> ''::"text")),
    CONSTRAINT "tracking_agents_updater_state_check" CHECK (("updater_state" = ANY (ARRAY['idle'::"text", 'checking'::"text", 'downloading'::"text", 'ready'::"text", 'draining'::"text", 'applying'::"text", 'rollback'::"text", 'blocked'::"text", 'error'::"text", 'unknown'::"text"])))
);


ALTER TABLE "public"."tracking_agents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tracking_alerts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "container_id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "category" "text" NOT NULL,
    "type" "text" NOT NULL,
    "severity" "text" NOT NULL,
    "detected_at" timestamp with time zone NOT NULL,
    "triggered_at" timestamp with time zone NOT NULL,
    "source_observation_fingerprints" "jsonb" NOT NULL,
    "retroactive" boolean NOT NULL,
    "provider" "text",
    "acked_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "alert_fingerprint" "text",
    "acked_by" "text",
    "acked_source" "text",
    "message_key" "text" NOT NULL,
    "message_params" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "lifecycle_state" "text" DEFAULT 'ACTIVE'::"text" NOT NULL,
    "resolved_at" timestamp with time zone,
    "resolved_reason" "text",
    CONSTRAINT "tracking_alerts_acked_source_check" CHECK ((("acked_source" IS NULL) OR ("acked_source" = ANY (ARRAY['dashboard'::"text", 'process_view'::"text", 'api'::"text"])))),
    CONSTRAINT "tracking_alerts_lifecycle_state_check" CHECK (("lifecycle_state" = ANY (ARRAY['ACTIVE'::"text", 'ACKED'::"text", 'AUTO_RESOLVED'::"text"]))),
    CONSTRAINT "tracking_alerts_lifecycle_state_requires_timestamps_check" CHECK (((("lifecycle_state" <> 'ACKED'::"text") OR ("acked_at" IS NOT NULL)) AND (("lifecycle_state" <> 'AUTO_RESOLVED'::"text") OR ("resolved_at" IS NOT NULL)))),
    CONSTRAINT "tracking_alerts_message_key_check" CHECK (("message_key" = ANY (ARRAY['alerts.transshipmentDetected'::"text", 'alerts.customsHoldDetected'::"text", 'alerts.noMovementDetected'::"text", 'alerts.etaMissing'::"text", 'alerts.etaPassed'::"text", 'alerts.portChange'::"text", 'alerts.dataInconsistent'::"text"]))),
    CONSTRAINT "tracking_alerts_resolved_reason_check" CHECK ((("resolved_reason" IS NULL) OR ("resolved_reason" = ANY (ARRAY['condition_cleared'::"text", 'terminal_state'::"text"]))))
);


ALTER TABLE "public"."tracking_alerts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tracking_validation_issue_transitions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "process_id" "uuid" NOT NULL,
    "container_id" "uuid" NOT NULL,
    "issue_code" "text" NOT NULL,
    "detector_id" "text" NOT NULL,
    "detector_version" "text" NOT NULL,
    "affected_scope" "text" NOT NULL,
    "severity" "text" NOT NULL,
    "transition_type" "text" NOT NULL,
    "lifecycle_key" "text" NOT NULL,
    "state_fingerprint" "text" NOT NULL,
    "evidence_summary" "text" NOT NULL,
    "provider" "text" NOT NULL,
    "snapshot_id" "uuid" NOT NULL,
    "occurred_at" timestamp with time zone NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "tracking_validation_issue_transitions_affected_scope_check" CHECK (("affected_scope" = ANY (ARRAY['CONTAINER'::"text", 'OPERATIONAL'::"text", 'PROCESS'::"text", 'SERIES'::"text", 'STATUS'::"text", 'TIMELINE'::"text"]))),
    CONSTRAINT "tracking_validation_issue_transitions_severity_check" CHECK (("severity" = ANY (ARRAY['ADVISORY'::"text", 'CRITICAL'::"text"]))),
    CONSTRAINT "tracking_validation_issue_transitions_transition_type_check" CHECK (("transition_type" = ANY (ARRAY['activated'::"text", 'changed'::"text", 'resolved'::"text"])))
);


ALTER TABLE "public"."tracking_validation_issue_transitions" OWNER TO "postgres";


ALTER TABLE ONLY "public"."agent_enrollment_audit_events"
    ADD CONSTRAINT "agent_enrollment_audit_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agent_install_tokens"
    ADD CONSTRAINT "agent_install_tokens_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."agent_install_tokens"
    ADD CONSTRAINT "agent_install_tokens_token_hash_key" UNIQUE ("token_hash");



ALTER TABLE ONLY "public"."agent_log_events"
    ADD CONSTRAINT "agent_log_events_pkey" PRIMARY KEY ("id");



ALTER TABLE "public"."container_observations"
    ADD CONSTRAINT "container_observations_event_time_source_check" CHECK ((("event_time_source" = ANY (ARRAY['carrier_explicit_timezone'::"text", 'carrier_local_port_time'::"text", 'carrier_date_only'::"text", 'derived_fallback'::"text", 'unknown'::"text"])) OR ("event_time_source" IS NULL))) NOT VALID;



ALTER TABLE ONLY "public"."container_observations"
    ADD CONSTRAINT "container_observations_pkey" PRIMARY KEY ("id");



ALTER TABLE "public"."container_observations"
    ADD CONSTRAINT "container_observations_temporal_kind_check" CHECK ((("temporal_kind" = ANY (ARRAY['instant'::"text", 'date'::"text", 'local_datetime'::"text"])) OR ("temporal_kind" IS NULL))) NOT VALID;



ALTER TABLE "public"."container_observations"
    ADD CONSTRAINT "container_observations_temporal_value_shape_check" CHECK (((("temporal_kind" IS NULL) AND ("event_time_instant" IS NULL) AND ("event_date" IS NULL) AND ("event_time_local" IS NULL) AND ("event_time_zone" IS NULL)) OR (("temporal_kind" = 'instant'::"text") AND ("event_time_instant" IS NOT NULL) AND ("event_date" IS NULL) AND ("event_time_local" IS NULL) AND ("event_time_zone" IS NULL)) OR (("temporal_kind" = 'date'::"text") AND ("event_time_instant" IS NULL) AND ("event_date" IS NOT NULL) AND ("event_time_local" IS NULL)) OR (("temporal_kind" = 'local_datetime'::"text") AND ("event_time_instant" IS NULL) AND ("event_date" IS NULL) AND ("event_time_local" IS NOT NULL) AND ("event_time_zone" IS NOT NULL)))) NOT VALID;



ALTER TABLE ONLY "public"."container_snapshots"
    ADD CONSTRAINT "container_snapshots_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."containers"
    ADD CONSTRAINT "containers_container_number_key" UNIQUE ("container_number");



ALTER TABLE ONLY "public"."containers"
    ADD CONSTRAINT "containers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."processes"
    ADD CONSTRAINT "processes_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."sync_requests"
    ADD CONSTRAINT "sync_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tracking_agent_activity_events"
    ADD CONSTRAINT "tracking_agent_activity_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tracking_agents"
    ADD CONSTRAINT "tracking_agents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tracking_agents"
    ADD CONSTRAINT "tracking_agents_tenant_machine_unique" UNIQUE ("tenant_id", "machine_fingerprint");



ALTER TABLE ONLY "public"."tracking_alerts"
    ADD CONSTRAINT "tracking_alerts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tracking_validation_issue_transitions"
    ADD CONSTRAINT "tracking_validation_issue_transitions_pkey" PRIMARY KEY ("id");



CREATE INDEX "container_observations_container_id_event_date_idx" ON "public"."container_observations" USING "btree" ("container_id", "event_date", "created_at");



CREATE INDEX "container_observations_container_id_event_time_instant_idx" ON "public"."container_observations" USING "btree" ("container_id", "event_time_instant", "created_at");



CREATE INDEX "container_observations_container_id_idx" ON "public"."container_observations" USING "btree" ("container_id");



CREATE INDEX "container_observations_event_time_idx" ON "public"."container_observations" USING "btree" ("event_time");



CREATE INDEX "idx_agent_enrollment_audit_events_created" ON "public"."agent_enrollment_audit_events" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_agent_enrollment_audit_events_tenant_created" ON "public"."agent_enrollment_audit_events" USING "btree" ("tenant_id", "created_at" DESC);



CREATE INDEX "idx_agent_install_tokens_tenant_active" ON "public"."agent_install_tokens" USING "btree" ("tenant_id") WHERE ("revoked_at" IS NULL);



CREATE INDEX "idx_agent_log_events_created_at" ON "public"."agent_log_events" USING "btree" ("created_at");



CREATE INDEX "idx_agent_log_events_tenant_agent_channel_sequence_desc" ON "public"."agent_log_events" USING "btree" ("tenant_id", "agent_id", "channel", "sequence" DESC);



CREATE INDEX "idx_agent_log_events_tenant_agent_sequence_desc" ON "public"."agent_log_events" USING "btree" ("tenant_id", "agent_id", "sequence" DESC);



CREATE UNIQUE INDEX "idx_agent_log_events_tenant_agent_sequence_unique" ON "public"."agent_log_events" USING "btree" ("tenant_id", "agent_id", "sequence");



CREATE INDEX "idx_containers_process_number" ON "public"."containers" USING "btree" ("process_id", "container_number");



CREATE INDEX "idx_sync_requests_done_target_updated_at" ON "public"."sync_requests" USING "btree" ("tenant_id", "provider", "ref_type", "ref_value", "updated_at" DESC) WHERE (("status" = 'DONE'::"public"."sync_request_status") AND ("ref_type" = 'container'::"text"));



CREATE INDEX "idx_sync_requests_target_created_at" ON "public"."sync_requests" USING "btree" ("tenant_id", "provider", "ref_type", "ref_value", "created_at" DESC) WHERE ("ref_type" = 'container'::"text");



CREATE INDEX "idx_sync_requests_tenant_leased_by_updated" ON "public"."sync_requests" USING "btree" ("tenant_id", "leased_by", "updated_at" DESC);



CREATE INDEX "idx_sync_requests_tenant_ref_updated_at" ON "public"."sync_requests" USING "btree" ("tenant_id", "ref_type", "ref_value", "updated_at" DESC);



CREATE INDEX "idx_sync_requests_tenant_status_lease" ON "public"."sync_requests" USING "btree" ("tenant_id", "status", "leased_until");



CREATE INDEX "idx_sync_requests_tenant_status_priority_created" ON "public"."sync_requests" USING "btree" ("tenant_id", "status", "priority" DESC, "created_at");



CREATE INDEX "idx_sync_requests_terminal_created_at" ON "public"."sync_requests" USING "btree" ("created_at") WHERE ("status" = ANY (ARRAY['DONE'::"public"."sync_request_status", 'FAILED'::"public"."sync_request_status"]));



CREATE INDEX "idx_tracking_agent_activity_events_agent_occurred" ON "public"."tracking_agent_activity_events" USING "btree" ("agent_id", "occurred_at" DESC);



CREATE INDEX "idx_tracking_agent_activity_events_created_at" ON "public"."tracking_agent_activity_events" USING "btree" ("created_at");



CREATE INDEX "idx_tracking_agent_activity_events_tenant_agent_occurred" ON "public"."tracking_agent_activity_events" USING "btree" ("tenant_id", "agent_id", "occurred_at" DESC);



CREATE INDEX "idx_tracking_agent_activity_events_tenant_occurred" ON "public"."tracking_agent_activity_events" USING "btree" ("tenant_id", "occurred_at" DESC);



CREATE INDEX "idx_tracking_agents_agent_token_active" ON "public"."tracking_agents" USING "btree" ("agent_token") WHERE ("revoked_at" IS NULL);



CREATE INDEX "idx_tracking_agents_capabilities_gin" ON "public"."tracking_agents" USING "gin" ("capabilities" "jsonb_path_ops");



CREATE INDEX "idx_tracking_agents_tenant_desired_updated" ON "public"."tracking_agents" USING "btree" ("tenant_id", "desired_version", "updated_at" DESC);



CREATE INDEX "idx_tracking_agents_tenant_last_seen" ON "public"."tracking_agents" USING "btree" ("tenant_id", "last_seen_at" DESC);



CREATE INDEX "idx_tracking_agents_tenant_restart_requested" ON "public"."tracking_agents" USING "btree" ("tenant_id", "restart_requested_at" DESC);



CREATE INDEX "idx_tracking_agents_tenant_status_last_seen" ON "public"."tracking_agents" USING "btree" ("tenant_id", "status", "last_seen_at" DESC);



CREATE INDEX "idx_tracking_agents_tenant_updated" ON "public"."tracking_agents" USING "btree" ("tenant_id", "updated_at" DESC);



CREATE INDEX "sync_requests_created_at_idx" ON "public"."sync_requests" USING "btree" ("created_at");



CREATE INDEX "tracking_agent_activity_events_occurred_at_idx" ON "public"."tracking_agent_activity_events" USING "btree" ("occurred_at");



CREATE INDEX "tracking_alerts_active_idx" ON "public"."tracking_alerts" USING "btree" ("container_id") WHERE ("lifecycle_state" = 'ACTIVE'::"text");



CREATE INDEX "tracking_validation_issue_transitions_container_idx" ON "public"."tracking_validation_issue_transitions" USING "btree" ("container_id", "occurred_at" DESC);



CREATE UNIQUE INDEX "tracking_validation_issue_transitions_dedup_idx" ON "public"."tracking_validation_issue_transitions" USING "btree" ("container_id", "lifecycle_key", "transition_type", "state_fingerprint", "snapshot_id");



CREATE INDEX "tracking_validation_issue_transitions_lifecycle_idx" ON "public"."tracking_validation_issue_transitions" USING "btree" ("container_id", "lifecycle_key", "occurred_at" DESC);



CREATE INDEX "tracking_validation_issue_transitions_process_idx" ON "public"."tracking_validation_issue_transitions" USING "btree" ("process_id", "occurred_at" DESC);



CREATE UNIQUE INDEX "uq_sync_requests_open_target" ON "public"."sync_requests" USING "btree" ("tenant_id", "provider", "ref_type", "ref_value") WHERE ("status" = ANY (ARRAY['PENDING'::"public"."sync_request_status", 'LEASED'::"public"."sync_request_status"]));



CREATE UNIQUE INDEX "uq_tracking_agents_agent_token" ON "public"."tracking_agents" USING "btree" ("agent_token");



CREATE OR REPLACE TRIGGER "trg_agent_install_tokens_updated_at" BEFORE UPDATE ON "public"."agent_install_tokens" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at_column"();



CREATE OR REPLACE TRIGGER "trg_sync_requests_set_updated_at" BEFORE UPDATE ON "public"."sync_requests" FOR EACH ROW EXECUTE FUNCTION "public"."set_sync_requests_updated_at"();



CREATE OR REPLACE TRIGGER "trg_tracking_agents_updated_at" BEFORE UPDATE ON "public"."tracking_agents" FOR EACH ROW EXECUTE FUNCTION "public"."set_updated_at_column"();



ALTER TABLE ONLY "public"."agent_log_events"
    ADD CONSTRAINT "agent_log_events_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."tracking_agents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."container_observations"
    ADD CONSTRAINT "container_observations_container_id_fkey" FOREIGN KEY ("container_id") REFERENCES "public"."containers"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."container_observations"
    ADD CONSTRAINT "container_observations_created_from_snapshot_id_fkey" FOREIGN KEY ("created_from_snapshot_id") REFERENCES "public"."container_snapshots"("id") ON UPDATE CASCADE ON DELETE SET NULL;



ALTER TABLE ONLY "public"."container_snapshots"
    ADD CONSTRAINT "container_snapshots_container_id_fkey" FOREIGN KEY ("container_id") REFERENCES "public"."containers"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."containers"
    ADD CONSTRAINT "containers_process_id_fkey" FOREIGN KEY ("process_id") REFERENCES "public"."processes"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tracking_agent_activity_events"
    ADD CONSTRAINT "tracking_agent_activity_events_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "public"."tracking_agents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tracking_alerts"
    ADD CONSTRAINT "tracking_alerts_container_id_fkey" FOREIGN KEY ("container_id") REFERENCES "public"."containers"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tracking_validation_issue_transitions"
    ADD CONSTRAINT "tracking_validation_issue_transitions_container_id_fkey" FOREIGN KEY ("container_id") REFERENCES "public"."containers"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tracking_validation_issue_transitions"
    ADD CONSTRAINT "tracking_validation_issue_transitions_process_id_fkey" FOREIGN KEY ("process_id") REFERENCES "public"."processes"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tracking_validation_issue_transitions"
    ADD CONSTRAINT "tracking_validation_issue_transitions_snapshot_id_fkey" FOREIGN KEY ("snapshot_id") REFERENCES "public"."container_snapshots"("id") ON DELETE CASCADE;





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";






ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."sync_requests";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."tracking_agent_activity_events";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."tracking_agents";



ALTER PUBLICATION "supabase_realtime" ADD TABLE ONLY "public"."tracking_alerts";









GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";


















































































































































































































GRANT ALL ON FUNCTION "public"."enqueue_container_sync_batch"("p_due_window" interval, "p_recent_window" interval, "p_limit_per_provider" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."enqueue_container_sync_batch"("p_due_window" interval, "p_recent_window" interval, "p_limit_per_provider" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."enqueue_container_sync_batch"("p_due_window" interval, "p_recent_window" interval, "p_limit_per_provider" integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."enqueue_sync_request"("p_tenant_id" "uuid", "p_provider" "text", "p_ref_type" "text", "p_ref_value" "text", "p_priority" integer) TO "anon";
GRANT ALL ON FUNCTION "public"."enqueue_sync_request"("p_tenant_id" "uuid", "p_provider" "text", "p_ref_type" "text", "p_ref_value" "text", "p_priority" integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."enqueue_sync_request"("p_tenant_id" "uuid", "p_provider" "text", "p_ref_type" "text", "p_ref_value" "text", "p_priority" integer) TO "service_role";



GRANT ALL ON TABLE "public"."sync_requests" TO "anon";
GRANT ALL ON TABLE "public"."sync_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."sync_requests" TO "service_role";



GRANT ALL ON FUNCTION "public"."lease_sync_requests"("p_tenant_id" "uuid", "p_agent_id" "text", "p_limit" integer, "p_lease_minutes" integer, "p_include_owned_active_leases" boolean, "p_processable_providers" "text"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."lease_sync_requests"("p_tenant_id" "uuid", "p_agent_id" "text", "p_limit" integer, "p_lease_minutes" integer, "p_include_owned_active_leases" boolean, "p_processable_providers" "text"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."lease_sync_requests"("p_tenant_id" "uuid", "p_agent_id" "text", "p_limit" integer, "p_lease_minutes" integer, "p_include_owned_active_leases" boolean, "p_processable_providers" "text"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."prune_agent_log_events"() TO "anon";
GRANT ALL ON FUNCTION "public"."prune_agent_log_events"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prune_agent_log_events"() TO "service_role";



GRANT ALL ON FUNCTION "public"."prune_sync_requests"() TO "anon";
GRANT ALL ON FUNCTION "public"."prune_sync_requests"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prune_sync_requests"() TO "service_role";



GRANT ALL ON FUNCTION "public"."prune_tracking_agent_activity_events"() TO "anon";
GRANT ALL ON FUNCTION "public"."prune_tracking_agent_activity_events"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."prune_tracking_agent_activity_events"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_sync_requests_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_sync_requests_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_sync_requests_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at_column"() TO "service_role";






























GRANT ALL ON TABLE "public"."agent_enrollment_audit_events" TO "anon";
GRANT ALL ON TABLE "public"."agent_enrollment_audit_events" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_enrollment_audit_events" TO "service_role";



GRANT ALL ON TABLE "public"."agent_install_tokens" TO "anon";
GRANT ALL ON TABLE "public"."agent_install_tokens" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_install_tokens" TO "service_role";



GRANT ALL ON TABLE "public"."agent_log_events" TO "anon";
GRANT ALL ON TABLE "public"."agent_log_events" TO "authenticated";
GRANT ALL ON TABLE "public"."agent_log_events" TO "service_role";



GRANT ALL ON TABLE "public"."container_observations" TO "anon";
GRANT ALL ON TABLE "public"."container_observations" TO "authenticated";
GRANT ALL ON TABLE "public"."container_observations" TO "service_role";



GRANT ALL ON TABLE "public"."container_snapshots" TO "anon";
GRANT ALL ON TABLE "public"."container_snapshots" TO "authenticated";
GRANT ALL ON TABLE "public"."container_snapshots" TO "service_role";



GRANT ALL ON TABLE "public"."containers" TO "anon";
GRANT ALL ON TABLE "public"."containers" TO "authenticated";
GRANT ALL ON TABLE "public"."containers" TO "service_role";



GRANT ALL ON TABLE "public"."processes" TO "anon";
GRANT ALL ON TABLE "public"."processes" TO "authenticated";
GRANT ALL ON TABLE "public"."processes" TO "service_role";



GRANT ALL ON TABLE "public"."tracking_agent_activity_events" TO "anon";
GRANT ALL ON TABLE "public"."tracking_agent_activity_events" TO "authenticated";
GRANT ALL ON TABLE "public"."tracking_agent_activity_events" TO "service_role";



GRANT ALL ON TABLE "public"."tracking_agents" TO "anon";
GRANT ALL ON TABLE "public"."tracking_agents" TO "authenticated";
GRANT ALL ON TABLE "public"."tracking_agents" TO "service_role";



GRANT ALL ON TABLE "public"."tracking_alerts" TO "anon";
GRANT ALL ON TABLE "public"."tracking_alerts" TO "authenticated";
GRANT ALL ON TABLE "public"."tracking_alerts" TO "service_role";



GRANT ALL ON TABLE "public"."tracking_validation_issue_transitions" TO "anon";
GRANT ALL ON TABLE "public"."tracking_validation_issue_transitions" TO "authenticated";
GRANT ALL ON TABLE "public"."tracking_validation_issue_transitions" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































