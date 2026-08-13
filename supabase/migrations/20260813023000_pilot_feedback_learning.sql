create table public.pilot_feedback (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  category text not null check(category in ('confusing','broken','missing','unsafe','suggestion')),
  severity text not null default 'normal' check(severity in ('low','normal','high','blocking')),
  body text not null check(char_length(body) between 10 and 4000),
  view_name text not null default '',
  workflow_stage text not null default '',
  context jsonb not null default '{}'::jsonb,
  status text not null default 'new' check(status in ('new','reviewing','planned','resolved','closed')),
  assigned_to uuid references public.profiles(id),
  internal_note text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.pilot_feedback_replies (
  id uuid primary key default gen_random_uuid(),
  feedback_id uuid not null references public.pilot_feedback(id) on delete cascade,
  author_id uuid not null references public.profiles(id),
  body text not null check(char_length(body) between 2 and 2000),
  staff_reply boolean not null,
  created_at timestamptz not null default now()
);
alter table public.pilot_feedback enable row level security;
alter table public.pilot_feedback_replies enable row level security;
create policy "members read own feedback" on public.pilot_feedback for select using(reporter_id=auth.uid());
create policy "members read replies to own feedback" on public.pilot_feedback_replies for select using(exists(select 1 from public.pilot_feedback f where f.id=feedback_id and f.reporter_id=auth.uid()));

create or replace function public.submit_pilot_feedback(feedback_category text, feedback_body text, feedback_view text default '', feedback_stage text default '', feedback_context jsonb default '{}'::jsonb)
returns uuid language plpgsql security definer set search_path=public as $$
declare result uuid; inferred_severity text;
begin
  if not public.account_can_interact() then raise exception 'active pilot membership required'; end if;
  if feedback_category not in ('confusing','broken','missing','unsafe','suggestion') then raise exception 'invalid feedback category'; end if;
  inferred_severity := case when feedback_category='unsafe' then 'high' when feedback_category='broken' then 'normal' else 'low' end;
  insert into public.pilot_feedback(reporter_id,category,severity,body,view_name,workflow_stage,context)
  values(auth.uid(),feedback_category,inferred_severity,trim(feedback_body),left(coalesce(feedback_view,''),80),left(coalesce(feedback_stage,''),120),coalesce(feedback_context,'{}'::jsonb)) returning id into result;
  return result;
end $$;

create or replace function public.get_my_pilot_feedback()
returns jsonb language sql stable security definer set search_path=public as $$
  select coalesce(jsonb_agg(to_jsonb(f)||jsonb_build_object('replies',coalesce((select jsonb_agg(to_jsonb(r)||jsonb_build_object('author_name',p.display_name) order by r.created_at) from public.pilot_feedback_replies r join public.profiles p on p.id=r.author_id where r.feedback_id=f.id),'[]'::jsonb)) order by f.created_at desc),'[]'::jsonb)
  from public.pilot_feedback f where f.reporter_id=auth.uid();
$$;

create or replace function public.manage_pilot_feedback(target_feedback_id uuid, next_status text, next_severity text, assignee_id uuid default null, note text default '', public_reply text default '')
returns void language plpgsql security definer set search_path=public as $$
begin
  if not exists(select 1 from public.moderation_roles where profile_id=auth.uid() and role='admin') then raise exception 'admin authorization required'; end if;
  if next_status not in ('new','reviewing','planned','resolved','closed') or next_severity not in ('low','normal','high','blocking') then raise exception 'invalid triage state'; end if;
  if assignee_id is not null and not public.is_platform_staff(assignee_id) then raise exception 'assignee must be staff'; end if;
  update public.pilot_feedback set status=next_status,severity=next_severity,assigned_to=assignee_id,internal_note=coalesce(note,''),updated_at=now() where id=target_feedback_id;
  if not found then raise exception 'feedback unavailable'; end if;
  if length(trim(public_reply))>0 then insert into public.pilot_feedback_replies(feedback_id,author_id,body,staff_reply) values(target_feedback_id,auth.uid(),trim(public_reply),true); end if;
end $$;

create or replace function public.reply_to_pilot_feedback(target_feedback_id uuid, reply_body text)
returns void language plpgsql security definer set search_path=public as $$
begin
  if not exists(select 1 from public.pilot_feedback where id=target_feedback_id and reporter_id=auth.uid()) then raise exception 'feedback unavailable'; end if;
  insert into public.pilot_feedback_replies(feedback_id,author_id,body,staff_reply) values(target_feedback_id,auth.uid(),trim(reply_body),false);
  update public.pilot_feedback set status=case when status in ('resolved','closed') then 'reviewing' else status end,updated_at=now() where id=target_feedback_id;
end $$;

create or replace function public.get_pilot_dashboard()
returns jsonb language plpgsql stable security definer set search_path=public as $$
begin
  if not exists(select 1 from public.moderation_roles where profile_id=auth.uid() and role='admin') then raise exception 'admin authorization required'; end if;
  return jsonb_build_object(
    'metrics',jsonb_build_object('members',(select count(*) from public.pilot_memberships where status='active'),'open_work',(select count(*) from public.work_requests where stage in ('open','proposed','agreed','scheduled','active','review')),'stalled',(select count(*) from public.work_requests where stage in ('agreed','scheduled','active','review') and updated_at<now()-interval '7 days'),'open_reports',(select count(*) from public.safety_reports where status in ('submitted','reviewing')),'email_pending',(select count(*) from public.email_outbox where status in ('pending','processing')),'email_failed',(select count(*) from public.email_outbox where status='failed'),'open_feedback',(select count(*) from public.pilot_feedback where status in ('new','reviewing','planned'))),
    'funnel',jsonb_build_object('joined',(select count(*) from public.pilot_memberships where status='active'),'profile_ready',(select count(distinct m.profile_id) from public.pilot_memberships m join public.capabilities c on c.profile_id=m.profile_id where m.status='active'),'requested',(select count(distinct owner_id) from public.work_requests),'proposed',(select count(distinct provider_id) from public.trade_offers),'agreed',(select count(distinct party) from (select requester_id party from public.work_agreements union select provider_id from public.work_agreements)x),'completed',(select count(distinct party) from (select requester_id party from public.work_agreements where completed_at is not null union select provider_id from public.work_agreements where completed_at is not null)x)),
    'feedback',coalesce((select jsonb_agg(to_jsonb(f)||jsonb_build_object('reporter_name',p.display_name,'assignee_name',a.display_name,'replies',coalesce((select jsonb_agg(to_jsonb(r)||jsonb_build_object('author_name',rp.display_name) order by r.created_at) from public.pilot_feedback_replies r join public.profiles rp on rp.id=r.author_id where r.feedback_id=f.id),'[]'::jsonb)) order by f.created_at desc) from public.pilot_feedback f join public.profiles p on p.id=f.reporter_id left join public.profiles a on a.id=f.assigned_to),'[]'::jsonb),
    'staff',coalesce((select jsonb_agg(jsonb_build_object('id',p.id,'name',p.display_name,'role',r.role)) from public.moderation_roles r join public.profiles p on p.id=r.profile_id),'[]'::jsonb),
    'recent_members',coalesce((select jsonb_agg(x order by x.joined_at desc) from (select m.profile_id,p.display_name,m.status,m.joined_at from public.pilot_memberships m join public.profiles p on p.id=m.profile_id order by m.joined_at desc limit 12)x),'[]'::jsonb),
    'invites',coalesce((select jsonb_agg(to_jsonb(i)-'code_hash' order by i.created_at desc) from public.pilot_invite_codes i),'[]'::jsonb)
  );
end $$;
revoke all on function public.submit_pilot_feedback(text,text,text,text,jsonb),public.get_my_pilot_feedback(),public.manage_pilot_feedback(uuid,text,text,uuid,text,text),public.reply_to_pilot_feedback(uuid,text) from public;
grant execute on function public.submit_pilot_feedback(text,text,text,text,jsonb),public.get_my_pilot_feedback(),public.manage_pilot_feedback(uuid,text,text,uuid,text,text),public.reply_to_pilot_feedback(uuid,text) to authenticated;
