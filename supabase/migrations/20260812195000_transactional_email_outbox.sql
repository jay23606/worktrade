alter table public.notification_preferences
  add column if not exists email_enabled boolean not null default true,
  add column if not exists email_network boolean not null default true,
  add column if not exists email_safety boolean not null default true;

create table public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  notification_id uuid not null unique references public.notifications(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  template_key text not null check (template_key in ('proposal','message','agreement','network','safety','reminder','system')),
  subject text not null,
  action_path text not null default '/',
  status text not null default 'pending' check (status in ('pending','processing','sent','failed','suppressed')),
  attempts integer not null default 0 check (attempts >= 0),
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  sent_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index email_outbox_delivery_idx
on public.email_outbox(status, available_at, created_at);

create table public.email_delivery_attempts (
  id bigint generated always as identity primary key,
  outbox_id uuid not null references public.email_outbox(id) on delete cascade,
  attempt_number integer not null,
  delivery_mode text not null check (delivery_mode in ('sink','resend')),
  outcome text not null check (outcome in ('sent','failed')),
  provider_message_id text,
  error_code text,
  created_at timestamptz not null default now(),
  unique(outbox_id, attempt_number)
);

alter table public.email_outbox enable row level security;
alter table public.email_delivery_attempts enable row level security;

create or replace function public.queue_notification_email()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  preferences public.notification_preferences;
  allowed boolean := false;
  template_value text;
  subject_value text;
  path_value text := '/';
begin
  select * into preferences
  from public.notification_preferences
  where profile_id = new.profile_id;
  if preferences.profile_id is null then
    preferences.email_enabled := true;
    preferences.email_proposals := true;
    preferences.email_messages := true;
    preferences.email_agreements := true;
    preferences.email_reminders := false;
    preferences.email_network := true;
    preferences.email_safety := true;
  end if;
  if not preferences.email_enabled then return new; end if;
  case new.kind
    when 'proposal' then
      allowed := preferences.email_proposals;
      template_value := 'proposal';
      subject_value := 'New WorkTrade proposal activity';
    when 'message' then
      allowed := preferences.email_messages;
      template_value := 'message';
      subject_value := 'You have new WorkTrade activity';
    when 'agreement' then
      allowed := preferences.email_agreements;
      template_value := 'agreement';
      subject_value := 'Your WorkTrade agreement was updated';
    when 'milestone', 'hold', 'obligation', 'review' then
      allowed := preferences.email_reminders;
      template_value := 'reminder';
      subject_value := 'A WorkTrade item needs your attention';
    when 'network' then
      allowed := preferences.email_network;
      template_value := 'network';
      subject_value := 'New WorkTrade network activity';
    when 'safety' then
      allowed := preferences.email_safety;
      template_value := 'safety';
      subject_value := 'An important WorkTrade safety update';
    else
      allowed := preferences.email_enabled;
      template_value := 'system';
      subject_value := 'WorkTrade account update';
  end case;
  if not allowed then return new; end if;
  if new.agreement_id is not null then
    path_value := '/#agreement=' || new.agreement_id;
  elsif new.request_id is not null then
    path_value := '/#request=' || new.request_id;
  end if;
  insert into public.email_outbox(
    notification_id, profile_id, template_key, subject, action_path
  ) values (
    new.id, new.profile_id, template_value, subject_value, path_value
  ) on conflict(notification_id) do nothing;
  return new;
end;
$$;

create trigger notification_email_outbox
after insert on public.notifications
for each row execute function public.queue_notification_email();

create or replace function public.claim_email_deliveries(batch_size integer default 25)
returns setof public.email_outbox
language plpgsql
security definer
set search_path = public
as $$
begin
  return query
  with claimed as (
    select id
    from public.email_outbox
    where (
      status in ('pending','failed')
      or (status = 'processing' and locked_at < now() - interval '10 minutes')
    )
      and available_at <= now()
      and attempts < 5
    order by created_at
    for update skip locked
    limit greatest(1, least(batch_size, 100))
  )
  update public.email_outbox outbox
  set status = 'processing',
      attempts = attempts + 1,
      locked_at = now(),
      updated_at = now()
  from claimed
  where outbox.id = claimed.id
  returning outbox.*;
end;
$$;

create or replace function public.finish_email_delivery(
  target_outbox_id uuid,
  delivery_mode_value text,
  delivered boolean,
  provider_message_id_value text default null,
  error_code_value text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare current_attempt integer;
begin
  if delivery_mode_value not in ('sink','resend') then raise exception 'invalid delivery mode'; end if;
  select attempts into current_attempt
  from public.email_outbox
  where id = target_outbox_id and status = 'processing'
  for update;
  if current_attempt is null then raise exception 'claimed email unavailable'; end if;
  insert into public.email_delivery_attempts(
    outbox_id, attempt_number, delivery_mode, outcome,
    provider_message_id, error_code
  ) values (
    target_outbox_id, current_attempt, delivery_mode_value,
    case when delivered then 'sent' else 'failed' end,
    provider_message_id_value, left(error_code_value, 200)
  );
  update public.email_outbox
  set status = case when delivered then 'sent' else 'failed' end,
      sent_at = case when delivered then now() else null end,
      available_at = case when delivered then available_at else now() + make_interval(mins => least(60, power(2, current_attempt)::integer)) end,
      locked_at = null,
      last_error = case when delivered then null else left(error_code_value, 500) end,
      updated_at = now()
  where id = target_outbox_id;
end;
$$;

revoke all on function public.claim_email_deliveries(integer), public.finish_email_delivery(uuid,text,boolean,text,text) from public, anon, authenticated;
grant execute on function public.claim_email_deliveries(integer), public.finish_email_delivery(uuid,text,boolean,text,text) to service_role;
