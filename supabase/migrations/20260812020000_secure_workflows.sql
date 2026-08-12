alter table public.work_requests add column search_document tsvector generated always as (
  to_tsvector('english', coalesce(title, '') || ' ' || coalesce(description, '') || ' ' || coalesce(location_text, ''))
) stored;
create index work_requests_search_idx on public.work_requests using gin(search_document);
create index work_requests_discovery_idx on public.work_requests(stage, visibility, created_at desc);

alter table public.work_agreements add column status public.work_stage not null default 'proposed';
alter table public.work_agreements add column version integer not null default 1 check (version > 0);
alter table public.work_agreements add column confirmed_by_requester_at timestamptz;
alter table public.work_agreements add column confirmed_by_provider_at timestamptz;

create table public.agreement_obligations (
  id uuid primary key default gen_random_uuid(),
  agreement_id uuid not null references public.work_agreements(id) on delete cascade,
  responsible_profile_id uuid not null references public.profiles(id),
  description text not null,
  status text not null default 'pending' check (status in ('pending','submitted','fulfilled','waived','disputed')),
  submitted_at timestamptz,
  approved_by uuid references public.profiles(id),
  approved_at timestamptz,
  check (approved_by is null or approved_by <> responsible_profile_id)
);

create table public.agreement_history (
  id bigint generated always as identity primary key,
  agreement_id uuid not null references public.work_agreements(id) on delete cascade,
  actor_id uuid not null references public.profiles(id),
  from_status public.work_stage,
  to_status public.work_stage not null,
  note text,
  version integer not null,
  created_at timestamptz not null default now()
);

alter table public.agreement_obligations enable row level security;
alter table public.agreement_history enable row level security;
create policy "participants read obligations" on public.agreement_obligations for select using (exists (select 1 from public.work_agreements a where a.id = agreement_id and (a.requester_id = auth.uid() or a.provider_id = auth.uid())));
create policy "participants read agreement history" on public.agreement_history for select using (exists (select 1 from public.work_agreements a where a.id = agreement_id and (a.requester_id = auth.uid() or a.provider_id = auth.uid())));

create or replace function public.create_work_request(payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
  skill_value text;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  insert into public.work_requests(owner_id, title, description, kind, stage, location_text, urgency_text, cash_budget_cents, visibility)
  values (
    auth.uid(), trim(payload->>'title'), trim(payload->>'description'),
    (payload->>'kind')::public.work_kind, 'open', nullif(trim(payload->>'location'), ''),
    nullif(trim(payload->>'urgency'), ''), nullif(payload->>'cash_budget_cents', '')::bigint,
    coalesce(nullif(payload->>'visibility', ''), 'public')
  ) returning id into new_id;
  for skill_value in select jsonb_array_elements_text(coalesce(payload->'skills', '[]'::jsonb)) loop
    insert into public.work_request_skills(request_id, skill) values (new_id, trim(skill_value)) on conflict do nothing;
  end loop;
  return new_id;
end;
$$;

create or replace function public.submit_trade_offer(target_request_id uuid, payload jsonb)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
  target_owner uuid;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select owner_id into target_owner from public.work_requests where id = target_request_id and stage = 'open' for update;
  if target_owner is null then raise exception 'request is unavailable'; end if;
  if target_owner = auth.uid() then raise exception 'owners cannot offer on their own request'; end if;
  insert into public.trade_offers(request_id, provider_id, mode, scope, exchange_summary, duration_text)
  values (target_request_id, auth.uid(), (payload->>'mode')::public.exchange_mode, trim(payload->>'scope'), trim(payload->>'exchange_summary'), nullif(trim(payload->>'duration'), ''))
  returning id into new_id;
  return new_id;
end;
$$;

revoke all on function public.create_work_request(jsonb) from public;
revoke all on function public.submit_trade_offer(uuid, jsonb) from public;
grant execute on function public.create_work_request(jsonb) to authenticated;
grant execute on function public.submit_trade_offer(uuid, jsonb) to authenticated;

-- All agreement mutations use row locks and optimistic versions. The browser
-- and Edge Function may request an action but cannot bypass participant checks.
create or replace function public.perform_agreement_action(
  target_agreement_id uuid,
  expected_version integer,
  requested_action text,
  payload jsonb default '{}'::jsonb
)
returns public.work_agreements
language plpgsql
security definer
set search_path = public
as $$
declare
  current_row public.work_agreements;
  actor uuid := auth.uid();
  next_status public.work_stage;
  previous_status public.work_stage;
begin
  if actor is null then raise exception 'authentication required'; end if;
  select * into current_row from public.work_agreements where id = target_agreement_id for update;
  if current_row.id is null then raise exception 'agreement not found'; end if;
  if actor not in (current_row.requester_id, current_row.provider_id) then raise exception 'not an agreement participant'; end if;
  if current_row.version <> expected_version then raise exception 'agreement changed; refresh before acting'; end if;
  previous_status := current_row.status;

  if requested_action = 'confirm' then
    if current_row.status <> 'proposed' then raise exception 'only proposed terms can be confirmed'; end if;
    update public.work_agreements set
      confirmed_by_requester_at = case when actor = requester_id then now() else confirmed_by_requester_at end,
      confirmed_by_provider_at = case when actor = provider_id then now() else confirmed_by_provider_at end,
      version = version + 1
    where id = current_row.id returning * into current_row;
    if current_row.confirmed_by_requester_at is not null and current_row.confirmed_by_provider_at is not null then
      update public.work_agreements set status = 'agreed', version = version + 1 where id = current_row.id returning * into current_row;
    end if;
  elsif requested_action = 'transition' then
    next_status := (payload->>'status')::public.work_stage;
    if not ((current_row.status = 'agreed' and next_status in ('scheduled','active')) or
      (current_row.status = 'scheduled' and next_status = 'active') or
      (current_row.status = 'active' and next_status = 'review') or
      (current_row.status = 'review' and next_status in ('active','completed')) or
      (current_row.status = 'disputed' and next_status in ('active','cancelled','completed'))) then
      raise exception 'invalid agreement transition';
    end if;
    update public.work_agreements set status = next_status, version = version + 1,
      completed_at = case when next_status = 'completed' then now() else completed_at end
    where id = current_row.id returning * into current_row;
  elsif requested_action in ('dispute','cancel') then
    if current_row.status in ('completed','cancelled') then raise exception 'agreement is already closed'; end if;
    next_status := case when requested_action = 'dispute' then 'disputed' else 'cancelled' end;
    update public.work_agreements set status = next_status, version = version + 1 where id = current_row.id returning * into current_row;
  else
    raise exception 'unsupported agreement action';
  end if;

  insert into public.agreement_history(agreement_id, actor_id, from_status, to_status, note, version)
  values (current_row.id, actor, previous_status, current_row.status, nullif(payload->>'note',''), current_row.version);
  return current_row;
end;
$$;

revoke all on function public.perform_agreement_action(uuid, integer, text, jsonb) from public;
grant execute on function public.perform_agreement_action(uuid, integer, text, jsonb) to authenticated;
