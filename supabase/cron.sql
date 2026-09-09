-- Weekly digest schedule (Monday 08:00 UTC).
-- Not applied automatically: it embeds the service key, so run this by hand.
--
-- 1) Set the edge function secrets first:
--      supabase secrets set RESEND_API_KEY=re_xxx
--      supabase secrets set DIGEST_FROM_EMAIL="Pipeline <digest@yourdomain.com>"
-- 2) Paste your current service key below (Dashboard > Settings > API).
-- 3) Run this file in the Supabase SQL editor.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.unschedule('digest-weekly') where exists (select 1 from cron.job where jobname = 'digest-weekly');

select cron.schedule(
  'digest-weekly',
  '0 8 * * 1',
  $$
  select net.http_post(
    url := 'https://mcizsyakvabtvdqsmuzn.supabase.co/functions/v1/digest-weekly',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
    ),
    body := '{}'::jsonb
  );
  $$
);
