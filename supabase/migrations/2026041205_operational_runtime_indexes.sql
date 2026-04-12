create index if not exists sync_requests_created_at_idx
  on public.sync_requests using btree (created_at);

create index if not exists tracking_agent_activity_events_occurred_at_idx
  on public.tracking_agent_activity_events using btree (occurred_at);