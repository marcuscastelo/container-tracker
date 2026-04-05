select cron.schedule('prune-tracking-agent-activity-events', '15 3 * * *', 'select public.prune_tracking_agent_activity_events();');
select cron.schedule('prune-sync-requests', '30 3 * * *', 'select public.prune_sync_requests();');
select cron.schedule('provider-paced-container-sync', '*/5 * * * *', 'select public.enqueue_container_sync_batch();');
select cron.schedule('prune-agent-log-events', '45 3 * * *', 'select public.prune_agent_log_events();');
