alter table public.safety_reports
  add column if not exists target_type text,
  add column if not exists target_id uuid,
  add column if not exists category text,
  add column if not exists severity text not null default 'normal',
  add column if not exists reporter_status text not null default 'submitted',
  add column if not exists reporter_update text not null default '',
  add column if not exists assigned_to uuid references public.profiles(id),
  add column if not exists updated_at timestamptz not null default now();

alter table public.safety_reports
  add constraint safety_report_target_type_check
  check (target_type is null or target_type in ('profile','request','message','circle','chain')),
  add constraint safety_report_category_check
  check (category is null or category in ('fraud','harassment','unsafe_work','prohibited_service','spam','privacy','other')),
  add constraint safety_report_severity_check
  check (severity in ('normal','high','urgent')),
  add constraint safety_report_reporter_status_check
  check (reporter_status in ('submitted','under_review','action_taken','closed'));

update public.safety_reports
set target_type = case when request_id is not null then 'request' else 'profile' end,
    target_id = coalesce(request_id, reported_profile_id),
    category = case
      when lower(reason) like '%fraud%' then 'fraud'
      when lower(reason) like '%harass%' then 'harassment'
      when lower(reason) like '%unsafe%' then 'unsafe_work'
      when lower(reason) like '%prohibit%' then 'prohibited_service'
      when lower(reason) like '%spam%' then 'spam'
      else 'other'
    end
where target_type is null;

alter table public.safety_reports
  alter column target_type set not null,
  alter column target_id set not null,
  alter column category set not null;

create table public.moderation_roles (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  role text not null check (role in ('reviewer','moderator','admin')),
  granted_by uuid references public.profiles(id),
  granted_at timestamptz not null default now()
);

create table public.account_restrictions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  report_id uuid references public.safety_reports(id) on delete set null,
  level text not null check (level in ('restricted','suspended','banned')),
  reason text not null,
  starts_at timestamptz not null default now(),
  expires_at timestamptz,
  lifted_at timestamptz,
  lifted_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  check (expires_at is null or expires_at > starts_at)
);
create unique index one_active_account_restriction
on public.account_restrictions(profile_id)
where lifted_at is null;

create table public.moderation_actions (
  id bigint generated always as identity primary key,
  report_id uuid not null references public.safety_reports(id) on delete restrict,
  actor_id uuid not null references public.profiles(id),
  action text not null check (action in ('opened','assigned','note','dismissed','warned','restricted','suspended','banned','restriction_lifted','resolved','reopened')),
  internal_note text not null default '',
  reporter_update text not null default '',
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.moderation_appeals (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  restriction_id uuid not null references public.account_restrictions(id) on delete cascade,
  statement text not null check (char_length(statement) between 20 and 4000),
  status text not null default 'submitted' check (status in ('submitted','reviewing','upheld','granted')),
  resolution text not null default '',
  reviewed_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  unique(profile_id, restriction_id)
);

alter table public.moderation_roles enable row level security;
alter table public.account_restrictions enable row level security;
alter table public.moderation_actions enable row level security;
alter table public.moderation_appeals enable row level security;

grant select on public.account_restrictions, public.moderation_appeals to authenticated;

create or replace function public.is_platform_staff(target_profile_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.moderation_roles
    where profile_id = target_profile_id
  );
$$;

create policy "subjects read own restrictions"
on public.account_restrictions for select
using (profile_id = auth.uid() or public.is_platform_staff());
create policy "subjects read own appeals"
on public.moderation_appeals for select
using (profile_id = auth.uid() or public.is_platform_staff());
create policy "staff read roles"
on public.moderation_roles for select
using (public.is_platform_staff());
create policy "staff read moderation actions"
on public.moderation_actions for select
using (public.is_platform_staff());
drop policy if exists "read own reports" on public.safety_reports;
create policy "reporters or staff read reports"
on public.safety_reports for select
using (reporter_id = auth.uid() or public.is_platform_staff());

create or replace function public.reject_moderation_action_changes()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  raise exception 'moderation audit entries are immutable';
end;
$$;
create trigger moderation_actions_immutable
before update or delete on public.moderation_actions
for each row execute function public.reject_moderation_action_changes();

create or replace function public.account_can_interact(target_profile_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select target_profile_id is not null and not exists (
    select 1 from public.account_restrictions
    where profile_id = target_profile_id
      and lifted_at is null
      and (expires_at is null or expires_at > now())
  );
$$;

create or replace function public.enforce_account_interaction_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.account_can_interact(auth.uid()) then
    raise exception 'account interaction restricted';
  end if;
  return null;
end;
$$;

create trigger restrict_work_requests before insert or update or delete on public.work_requests for each statement execute function public.enforce_account_interaction_status();
create trigger restrict_trade_offers before insert or update or delete on public.trade_offers for each statement execute function public.enforce_account_interaction_status();
create trigger restrict_project_messages before insert or update or delete on public.project_messages for each statement execute function public.enforce_account_interaction_status();
create trigger restrict_project_updates before insert or update or delete on public.project_updates for each statement execute function public.enforce_account_interaction_status();
create trigger restrict_collaboration_invitations before insert or update or delete on public.collaboration_invitations for each statement execute function public.enforce_account_interaction_status();
create trigger restrict_introduction_messages before insert or update or delete on public.introduction_messages for each statement execute function public.enforce_account_interaction_status();
create trigger restrict_circles before insert or update or delete on public.circles for each statement execute function public.enforce_account_interaction_status();
create trigger restrict_circle_members before insert or update or delete on public.circle_members for each statement execute function public.enforce_account_interaction_status();
create trigger restrict_circle_resources before insert or update or delete on public.circle_resources for each statement execute function public.enforce_account_interaction_status();
create trigger restrict_trade_chains before insert or update or delete on public.trade_chains for each statement execute function public.enforce_account_interaction_status();
create trigger restrict_trade_chain_links before insert or update or delete on public.trade_chain_links for each statement execute function public.enforce_account_interaction_status();
create trigger restrict_work_reviews before insert or update or delete on public.work_reviews for each statement execute function public.enforce_account_interaction_status();

create or replace function public.submit_safety_report(
  report_target_type text,
  report_target_id uuid,
  report_category text,
  report_detail text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  result_id uuid;
  target_profile uuid;
  legacy_request_id uuid;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if report_target_type not in ('profile','request','message','circle','chain') then raise exception 'invalid report target'; end if;
  if report_category not in ('fraud','harassment','unsafe_work','prohibited_service','spam','privacy','other') then raise exception 'invalid report category'; end if;
  if char_length(trim(report_detail)) < 10 then raise exception 'report details are too short'; end if;
  case report_target_type
    when 'profile' then select id into target_profile from public.profiles where id = report_target_id;
    when 'request' then select owner_id, id into target_profile, legacy_request_id from public.work_requests where id = report_target_id;
    when 'message' then select author_id into target_profile from public.project_messages where id = report_target_id;
    when 'circle' then select owner_id into target_profile from public.circles where id = report_target_id;
    when 'chain' then select proposed_by into target_profile from public.trade_chains where id = report_target_id;
  end case;
  if target_profile is null then raise exception 'report target unavailable'; end if;
  if target_profile = auth.uid() then raise exception 'cannot report yourself'; end if;
  insert into public.safety_reports (
    reporter_id, reported_profile_id, request_id, reason, detail,
    target_type, target_id, category
  ) values (
    auth.uid(), target_profile, legacy_request_id, report_category, trim(report_detail),
    report_target_type, report_target_id, report_category
  ) returning id into result_id;
  return result_id;
end;
$$;

create or replace function public.get_my_safety_reports()
returns setof public.safety_reports
language sql
stable
security invoker
set search_path = public
as $$
  select * from public.safety_reports
  where reporter_id = auth.uid()
  order by created_at desc;
$$;

create or replace function public.get_moderation_queue()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_platform_staff() then raise exception 'staff authorization required'; end if;
  return jsonb_build_object(
    'role', (select role from public.moderation_roles where profile_id = auth.uid()),
    'reports', coalesce((
      select jsonb_agg(to_jsonb(r) || jsonb_build_object(
        'reporter_name', reporter.display_name,
        'target_name', target.display_name,
        'actions', coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at) from public.moderation_actions a where a.report_id = r.id), '[]'::jsonb)
      ) order by r.created_at desc)
      from public.safety_reports r
      join public.profiles reporter on reporter.id = r.reporter_id
      left join public.profiles target on target.id = r.reported_profile_id
      where r.status in ('submitted','reviewing')
    ), '[]'::jsonb),
    'appeals', coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at) from public.moderation_appeals a where a.status in ('submitted','reviewing')), '[]'::jsonb)
  );
end;
$$;

create or replace function public.moderate_report(
  target_report_id uuid,
  moderation_action text,
  internal_note_value text,
  reporter_update_value text default '',
  restriction_expires_at timestamptz default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  report public.safety_reports;
  staff_role text;
  restriction_level text;
begin
  select role into staff_role from public.moderation_roles where profile_id = auth.uid();
  if staff_role is null then raise exception 'staff authorization required'; end if;
  if moderation_action in ('banned','restriction_lifted') and staff_role <> 'admin' then raise exception 'admin authorization required'; end if;
  select * into report from public.safety_reports where id = target_report_id for update;
  if report.id is null then raise exception 'report unavailable'; end if;
  if char_length(trim(internal_note_value)) < 5 then raise exception 'internal rationale required'; end if;
  if moderation_action in ('restricted','suspended','banned') then
    restriction_level := rtrim(moderation_action, 'ed');
    if moderation_action = 'restricted' then restriction_level := 'restricted'; end if;
    if moderation_action = 'suspended' then restriction_level := 'suspended'; end if;
    if moderation_action = 'banned' then restriction_level := 'banned'; end if;
    insert into public.account_restrictions(profile_id, report_id, level, reason, expires_at)
    values(report.reported_profile_id, report.id, restriction_level, trim(internal_note_value), restriction_expires_at)
    on conflict(profile_id) where lifted_at is null do update
      set report_id = excluded.report_id, level = excluded.level, reason = excluded.reason, expires_at = excluded.expires_at;
    update public.safety_reports set status='resolved', reporter_status='action_taken', reporter_update=coalesce(nullif(trim(reporter_update_value),''),'WorkTrade took action after reviewing your report.'), resolved_at=now(), updated_at=now() where id=report.id;
  elsif moderation_action = 'warned' then
    perform public.notify_user(report.reported_profile_id, 'safety', 'Safety warning', reporter_update_value);
    update public.safety_reports set status='resolved', reporter_status='action_taken', reporter_update=coalesce(nullif(trim(reporter_update_value),''),'WorkTrade reviewed the report and contacted the account.'), resolved_at=now(), updated_at=now() where id=report.id;
  elsif moderation_action = 'dismissed' then
    update public.safety_reports set status='dismissed', reporter_status='closed', reporter_update=coalesce(nullif(trim(reporter_update_value),''),'The report was reviewed and closed.'), resolved_at=now(), updated_at=now() where id=report.id;
  elsif moderation_action in ('note','assigned','reopened','resolved') then
    update public.safety_reports set status=case when moderation_action='resolved' then 'resolved' else 'reviewing' end, reporter_status=case when moderation_action='resolved' then 'closed' else 'under_review' end, reporter_update=coalesce(nullif(trim(reporter_update_value),''),reporter_update), assigned_to=case when moderation_action='assigned' then auth.uid() else assigned_to end, resolved_at=case when moderation_action='resolved' then now() else null end, updated_at=now() where id=report.id;
  else
    raise exception 'unsupported moderation action';
  end if;
  insert into public.moderation_actions(report_id,actor_id,action,internal_note,reporter_update,snapshot)
  values(report.id,auth.uid(),moderation_action,trim(internal_note_value),coalesce(reporter_update_value,''),jsonb_build_object('target_profile_id',report.reported_profile_id,'expires_at',restriction_expires_at));
end;
$$;

create or replace function public.submit_moderation_appeal(target_restriction_id uuid, appeal_statement text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare result_id uuid;
begin
  insert into public.moderation_appeals(profile_id, restriction_id, statement)
  select auth.uid(), id, trim(appeal_statement)
  from public.account_restrictions
  where id = target_restriction_id and profile_id = auth.uid() and lifted_at is null
  returning id into result_id;
  if result_id is null then raise exception 'active restriction unavailable'; end if;
  return result_id;
end;
$$;

revoke all on function public.is_platform_staff(uuid), public.account_can_interact(uuid), public.submit_safety_report(text,uuid,text,text), public.get_my_safety_reports(), public.get_moderation_queue(), public.moderate_report(uuid,text,text,text,timestamptz), public.submit_moderation_appeal(uuid,text) from public;
grant execute on function public.submit_safety_report(text,uuid,text,text), public.get_my_safety_reports(), public.get_moderation_queue(), public.moderate_report(uuid,text,text,text,timestamptz), public.submit_moderation_appeal(uuid,text) to authenticated;
