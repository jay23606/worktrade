alter table public.profiles add column is_active boolean not null default true;
alter table public.profiles add column deactivated_at timestamptz;

create table public.request_history (
  id bigint generated always as identity primary key,
  request_id uuid not null references public.work_requests(id) on delete cascade,
  actor_id uuid not null references public.profiles(id),
  action text not null check (action in ('created','edited','closed','archived','cancelled')),
  snapshot jsonb not null,
  created_at timestamptz not null default now()
);

create table public.notification_preferences (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  in_app boolean not null default true,
  email_proposals boolean not null default true,
  email_messages boolean not null default true,
  email_agreements boolean not null default true,
  email_reminders boolean not null default false,
  updated_at timestamptz not null default now()
);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  kind text not null check (kind in ('proposal','message','agreement','milestone','hold','obligation','review','system')),
  title text not null,
  body text not null,
  request_id uuid references public.work_requests(id) on delete cascade,
  agreement_id uuid references public.work_agreements(id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_inbox_idx on public.notifications(profile_id, read_at, created_at desc);

alter table public.request_history enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.notifications enable row level security;
grant select on public.request_history to authenticated;
grant select, insert, update on public.notification_preferences to authenticated;
grant select, update on public.notifications to authenticated;
create policy "request history participants read" on public.request_history for select using (
  exists (select 1 from public.work_requests r left join public.work_agreements a on a.request_id = r.id where r.id = request_id and auth.uid() in (r.owner_id, a.requester_id, a.provider_id))
);
create policy "own notification preferences" on public.notification_preferences for all using (profile_id = auth.uid()) with check (profile_id = auth.uid());
create policy "own notifications readable" on public.notifications for select using (profile_id = auth.uid());
create policy "own notifications updateable" on public.notifications for update using (profile_id = auth.uid()) with check (profile_id = auth.uid());

create or replace function public.notify_user(target uuid, notification_kind text, notification_title text, notification_body text, target_request uuid default null, target_agreement uuid default null)
returns void language plpgsql security definer set search_path = public
as $$
begin
  if target is null then return; end if;
  insert into public.notifications(profile_id, kind, title, body, request_id, agreement_id)
  values (target, notification_kind, notification_title, notification_body, target_request, target_agreement);
end;
$$;
revoke all on function public.notify_user(uuid,text,text,text,uuid,uuid) from public, anon, authenticated;

create or replace function public.update_work_request(target_request_id uuid, expected_version integer, payload jsonb)
returns public.work_requests language plpgsql security definer set search_path = public
as $$
declare current_row public.work_requests; result public.work_requests; skill_value text;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select * into current_row from public.work_requests where id = target_request_id for update;
  if current_row.id is null or current_row.owner_id <> auth.uid() then raise exception 'request not found'; end if;
  if current_row.version <> expected_version then raise exception 'request changed; refresh before editing'; end if;
  if current_row.stage not in ('draft','open') then raise exception 'requests with a selected proposal cannot be edited'; end if;
  insert into public.request_history(request_id, actor_id, action, snapshot) values (current_row.id, auth.uid(), 'edited', to_jsonb(current_row));
  update public.work_requests set
    title = trim(payload->>'title'), description = trim(payload->>'description'), kind = (payload->>'kind')::public.work_kind,
    location_text = nullif(trim(payload->>'location'),''), urgency_text = nullif(trim(payload->>'urgency'),''),
    cash_budget_cents = nullif(payload->>'cash_budget_cents','')::bigint, version = version + 1, updated_at = now()
  where id = current_row.id returning * into result;
  if jsonb_typeof(payload->'skills') = 'array' then
    delete from public.work_request_skills where request_id = current_row.id;
    for skill_value in select jsonb_array_elements_text(payload->'skills') loop
      insert into public.work_request_skills(request_id,skill) values(current_row.id,trim(skill_value)) on conflict do nothing;
    end loop;
  end if;
  return result;
end;
$$;

create or replace function public.close_work_request(target_request_id uuid, expected_version integer, requested_action text)
returns public.work_requests language plpgsql security definer set search_path = public
as $$
declare current_row public.work_requests; result public.work_requests; next_stage public.work_stage;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select * into current_row from public.work_requests where id = target_request_id for update;
  if current_row.id is null or current_row.owner_id <> auth.uid() then raise exception 'request not found'; end if;
  if current_row.version <> expected_version then raise exception 'request changed; refresh before acting'; end if;
  if exists(select 1 from public.work_agreements where request_id = current_row.id and status not in ('cancelled','completed')) then raise exception 'active agreements must be resolved first'; end if;
  if requested_action = 'close' then next_stage := 'completed';
  elsif requested_action = 'cancel' then next_stage := 'cancelled';
  elsif requested_action = 'archive' then next_stage := current_row.stage;
  else raise exception 'unsupported request action'; end if;
  insert into public.request_history(request_id,actor_id,action,snapshot) values(current_row.id,auth.uid(),case when requested_action='close' then 'closed' else requested_action end,to_jsonb(current_row));
  update public.work_requests set stage=next_stage, visibility=case when requested_action='archive' then 'private' else visibility end, version=version+1, updated_at=now()
  where id=current_row.id returning * into result;
  update public.trade_offers set status='expired' where request_id=current_row.id and status='pending';
  return result;
end;
$$;

create or replace function public.get_my_notifications()
returns table(notification jsonb)
language sql stable security definer set search_path=public
as $$ select to_jsonb(n) from public.notifications n where n.profile_id=auth.uid() order by n.created_at desc limit 100 $$;

create or replace function public.mark_notifications_read(notification_ids uuid[] default null)
returns integer language plpgsql security definer set search_path=public
as $$ declare affected integer; begin
  update public.notifications set read_at=now() where profile_id=auth.uid() and read_at is null and (notification_ids is null or id=any(notification_ids));
  get diagnostics affected = row_count; return affected;
end $$;

create or replace function public.export_my_data()
returns jsonb language sql stable security definer set search_path=public
as $$
select jsonb_build_object(
  'exported_at', now(), 'profile', (select to_jsonb(p) from public.profiles p where p.id=auth.uid()),
  'capabilities', coalesce((select jsonb_agg(to_jsonb(c)) from public.capabilities c where c.profile_id=auth.uid()),'[]'::jsonb),
  'requests', coalesce((select jsonb_agg(to_jsonb(r)) from public.work_requests r where r.owner_id=auth.uid()),'[]'::jsonb),
  'offers', coalesce((select jsonb_agg(to_jsonb(o)) from public.trade_offers o where o.provider_id=auth.uid()),'[]'::jsonb),
  'agreements', coalesce((select jsonb_agg(to_jsonb(a)) from public.work_agreements a where auth.uid() in (a.requester_id,a.provider_id)),'[]'::jsonb),
  'messages', coalesce((select jsonb_agg(to_jsonb(m)) from public.project_messages m where m.author_id=auth.uid()),'[]'::jsonb),
  'evidence', coalesce((select jsonb_agg(to_jsonb(e)) from public.work_evidence e where e.contributor_id=auth.uid()),'[]'::jsonb),
  'reviews_given', coalesce((select jsonb_agg(to_jsonb(rv)) from public.work_reviews rv where rv.reviewer_id=auth.uid()),'[]'::jsonb)
) $$;

create or replace function public.deactivate_my_account()
returns void language plpgsql security definer set search_path=public
as $$
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if exists(select 1 from public.work_agreements where auth.uid() in (requester_id,provider_id) and status not in ('completed','cancelled')) then raise exception 'resolve active agreements before deactivating'; end if;
  update public.work_requests set visibility='private', stage=case when stage='open' then 'cancelled' else stage end, version=version+1 where owner_id=auth.uid() and stage in ('draft','open');
  update public.trade_offers set status='withdrawn' where provider_id=auth.uid() and status='pending';
  delete from public.capabilities where profile_id=auth.uid();
  update public.profiles set display_name='Former WorkTrade member', location_text=null, bio=null, is_active=false, deactivated_at=now() where id=auth.uid();
end $$;

revoke all on function public.update_work_request(uuid,integer,jsonb), public.close_work_request(uuid,integer,text), public.get_my_notifications(), public.mark_notifications_read(uuid[]), public.export_my_data(), public.deactivate_my_account() from public;
grant execute on function public.update_work_request(uuid,integer,jsonb), public.close_work_request(uuid,integer,text), public.get_my_notifications(), public.mark_notifications_read(uuid[]), public.export_my_data(), public.deactivate_my_account() to authenticated;

create or replace function public.submit_trade_offer(target_request_id uuid, payload jsonb)
returns uuid language plpgsql security definer set search_path=public
as $$
declare new_id uuid; target_owner uuid;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select owner_id into target_owner from public.work_requests where id=target_request_id and stage='open' for update;
  if target_owner is null then raise exception 'request is unavailable'; end if;
  if target_owner=auth.uid() then raise exception 'owners cannot offer on their own request'; end if;
  insert into public.trade_offers(request_id,provider_id,mode,scope,exchange_summary,duration_text)
  values(target_request_id,auth.uid(),(payload->>'mode')::public.exchange_mode,trim(payload->>'scope'),trim(payload->>'exchange_summary'),nullif(trim(payload->>'duration'),'')) returning id into new_id;
  perform public.notify_user(target_owner,'proposal','New trade proposal','A member proposed terms for your work request.',target_request_id,null);
  return new_id;
end $$;

create or replace function public.notify_project_message()
returns trigger language plpgsql security definer set search_path=public
as $$
declare recipient uuid; agreement_id uuid;
begin
  select a.id, case when new.author_id=a.requester_id then a.provider_id else a.requester_id end into agreement_id,recipient
  from public.work_agreements a where a.request_id=new.request_id and new.author_id in (a.requester_id,a.provider_id);
  perform public.notify_user(recipient,'message','New project message','A participant sent a message about your work agreement.',new.request_id,agreement_id);
  return new;
end $$;
create trigger project_message_notification after insert on public.project_messages for each row execute function public.notify_project_message();
