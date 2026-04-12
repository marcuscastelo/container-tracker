create extension if not exists "hypopg" with schema "extensions";

create extension if not exists "index_advisor" with schema "extensions";

alter table "public"."tracking_agents" drop constraint "tracking_agents_enrollment_method_check";

alter table "public"."tracking_alerts" drop constraint "tracking_alerts_message_key_check";

alter table "public"."tracking_agents" alter column "enrollment_method" drop default;

alter table "public"."tracking_agents" alter column "enrollment_method" drop not null;

alter table "public"."tracking_alerts" alter column "retroactive" drop default;

CREATE UNIQUE INDEX containers_container_number_key ON public.containers USING btree (container_number);

alter table "public"."containers" add constraint "containers_container_number_key" UNIQUE using index "containers_container_number_key";

alter table "public"."tracking_alerts" add constraint "tracking_alerts_message_key_check" CHECK ((message_key = ANY (ARRAY['alerts.transshipmentDetected'::text, 'alerts.customsHoldDetected'::text, 'alerts.noMovementDetected'::text, 'alerts.etaMissing'::text, 'alerts.etaPassed'::text, 'alerts.portChange'::text, 'alerts.dataInconsistent'::text]))) not valid;

alter table "public"."tracking_alerts" validate constraint "tracking_alerts_message_key_check";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.enqueue_sync_request(p_tenant_id uuid, p_provider text, p_ref_type text DEFAULT 'container'::text, p_ref_value text DEFAULT ''::text, p_priority integer DEFAULT 0)
 RETURNS TABLE(id uuid, status public.sync_request_status, is_new boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
$function$
;

CREATE OR REPLACE FUNCTION public.set_updated_at_column()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;

CREATE TRIGGER enforce_bucket_name_length_trigger BEFORE INSERT OR UPDATE OF name ON storage.buckets FOR EACH ROW EXECUTE FUNCTION storage.enforce_bucket_name_length();

CREATE TRIGGER protect_buckets_delete BEFORE DELETE ON storage.buckets FOR EACH STATEMENT EXECUTE FUNCTION storage.protect_delete();

CREATE TRIGGER protect_objects_delete BEFORE DELETE ON storage.objects FOR EACH STATEMENT EXECUTE FUNCTION storage.protect_delete();

CREATE TRIGGER update_objects_updated_at BEFORE UPDATE ON storage.objects FOR EACH ROW EXECUTE FUNCTION storage.update_updated_at_column();


