create table public.work_reviews (
  id uuid primary key default gen_random_uuid(),
  agreement_id uuid not null references public.work_agreements(id) on delete cascade,
  reviewer_id uuid not null references public.profiles(id),
  subject_id uuid not null references public.profiles(id),
  reliability smallint not null check (reliability between 1 and 5),
  communication smallint not null check (communication between 1 and 5),
  work_quality smallint check (work_quality between 1 and 5),
  exchange_fairness smallint not null check (exchange_fairness between 1 and 5),
  body text check (body is null or char_length(body) <= 2000),
  created_at timestamptz not null default now(),
  unique(agreement_id, reviewer_id),
  check (reviewer_id <> subject_id)
);
alter table public.work_reviews enable row level security;
grant select, insert on public.work_reviews to authenticated;
create policy "completed reviews readable" on public.work_reviews for select using (
  exists (select 1 from public.work_agreements a where a.id = agreement_id and a.status = 'completed')
);
create policy "participants review counterpart" on public.work_reviews for insert with check (
  reviewer_id = auth.uid() and exists (
    select 1 from public.work_agreements a where a.id = agreement_id and a.status = 'completed'
      and reviewer_id in (a.requester_id, a.provider_id)
      and subject_id in (a.requester_id, a.provider_id)
      and reviewer_id <> subject_id
  )
);

create policy "agreement milestones readable" on public.milestones for select using (
  exists (select 1 from public.work_agreements a where a.id = agreement_id and (a.requester_id = auth.uid() or a.provider_id = auth.uid()))
);
create policy "agreement holds readable" on public.dependency_holds for select using (
  exists (select 1 from public.work_agreements a where a.id = agreement_id and (a.requester_id = auth.uid() or a.provider_id = auth.uid()))
);
create policy "participant evidence insertable" on public.work_evidence for insert with check (
  contributor_id = auth.uid() and exists (select 1 from public.work_agreements a where a.id = agreement_id and auth.uid() in (a.requester_id, a.provider_id))
);

create or replace function public.set_my_profile(payload jsonb)
returns public.profiles
language plpgsql security definer set search_path = public
as $$
declare result public.profiles;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  update public.profiles set
    display_name = trim(payload->>'display_name'),
    location_text = nullif(trim(payload->>'location_text'), ''),
    bio = nullif(trim(payload->>'bio'), '')
  where id = auth.uid() returning * into result;
  if result.id is null then raise exception 'profile not found'; end if;
  if jsonb_typeof(payload->'needs') = 'array' then
    delete from public.capabilities where profile_id = auth.uid() and direction = 'need';
    insert into public.capabilities(profile_id, direction, label)
      select auth.uid(), 'need', trim(value) from jsonb_array_elements_text(payload->'needs') where char_length(trim(value)) between 2 and 100;
  end if;
  if jsonb_typeof(payload->'offers') = 'array' then
    delete from public.capabilities where profile_id = auth.uid() and direction = 'offer';
    insert into public.capabilities(profile_id, direction, label)
      select auth.uid(), 'offer', trim(value) from jsonb_array_elements_text(payload->'offers') where char_length(trim(value)) between 2 and 100;
  end if;
  return result;
end;
$$;

create or replace function public.accept_trade_offer(target_offer_id uuid)
returns uuid
language plpgsql security definer set search_path = public
as $$
declare chosen public.trade_offers; target public.work_requests; agreement_id uuid;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select * into chosen from public.trade_offers where id = target_offer_id and status = 'pending' for update;
  if chosen.id is null then raise exception 'offer unavailable'; end if;
  select * into target from public.work_requests where id = chosen.request_id for update;
  if target.owner_id <> auth.uid() then raise exception 'only the request owner may accept an offer'; end if;
  if target.stage <> 'open' then raise exception 'request is no longer open'; end if;
  insert into public.work_agreements(request_id, accepted_offer_id, requester_id, provider_id, scope_snapshot, exchange_snapshot, status)
  values (target.id, chosen.id, target.owner_id, chosen.provider_id, chosen.scope,
    jsonb_build_object('mode', chosen.mode, 'summary', chosen.exchange_summary), 'proposed') returning id into agreement_id;
  insert into public.agreement_obligations(agreement_id, responsible_profile_id, description)
  values (agreement_id, chosen.provider_id, chosen.scope), (agreement_id, target.owner_id, chosen.exchange_summary);
  insert into public.milestones(agreement_id, title, position) values
    (agreement_id, 'Confirm scope and exchange', 0), (agreement_id, 'Prepare access and inputs', 1),
    (agreement_id, 'Complete agreed work', 2), (agreement_id, 'Review both sides of the exchange', 3);
  update public.trade_offers set status = case when id = chosen.id then 'accepted' else 'declined' end where request_id = target.id and status = 'pending';
  update public.work_requests set stage = 'proposed', version = version + 1, updated_at = now() where id = target.id;
  insert into public.agreement_history(agreement_id, actor_id, from_status, to_status, note, version)
    values (agreement_id, auth.uid(), null, 'proposed', 'Offer selected; awaiting mutual confirmation', 1);
  return agreement_id;
end;
$$;

create or replace function public.get_my_agreements()
returns table (
  agreement jsonb, request jsonb, offer jsonb, milestones jsonb, holds jsonb, obligations jsonb
)
language sql stable security definer set search_path = public
as $$
  select to_jsonb(a), to_jsonb(r), to_jsonb(o),
    coalesce((select jsonb_agg(to_jsonb(m) order by m.position) from public.milestones m where m.agreement_id = a.id), '[]'::jsonb),
    coalesce((select jsonb_agg(to_jsonb(h) order by h.created_at desc) from public.dependency_holds h where h.agreement_id = a.id), '[]'::jsonb),
    coalesce((select jsonb_agg(to_jsonb(ob) order by ob.id) from public.agreement_obligations ob where ob.agreement_id = a.id), '[]'::jsonb)
  from public.work_agreements a join public.work_requests r on r.id = a.request_id join public.trade_offers o on o.id = a.accepted_offer_id
  where auth.uid() in (a.requester_id, a.provider_id)
  order by a.accepted_at desc;
$$;

create or replace function public.perform_agreement_action(
  target_agreement_id uuid, expected_version integer, requested_action text, payload jsonb default '{}'::jsonb
)
returns public.work_agreements
language plpgsql security definer set search_path = public
as $$
declare
  current_row public.work_agreements; actor uuid := auth.uid(); next_status public.work_stage;
  previous_status public.work_stage; target_obligation public.agreement_obligations; target_milestone public.milestones;
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
      version = version + 1 where id = current_row.id returning * into current_row;
    if current_row.confirmed_by_requester_at is not null and current_row.confirmed_by_provider_at is not null then
      update public.work_agreements set status = 'agreed', version = version + 1 where id = current_row.id returning * into current_row;
      update public.work_requests set stage = 'agreed', version = version + 1, updated_at = now() where id = current_row.request_id;
    end if;
  elsif requested_action = 'transition' then
    next_status := (payload->>'status')::public.work_stage;
    if not ((current_row.status = 'agreed' and next_status in ('scheduled','active')) or
      (current_row.status = 'scheduled' and next_status = 'active') or
      (current_row.status = 'active' and next_status = 'review') or
      (current_row.status = 'review' and next_status in ('active','completed')) or
      (current_row.status = 'disputed' and next_status in ('active','cancelled','completed'))) then raise exception 'invalid agreement transition'; end if;
    if next_status = 'completed' and exists (select 1 from public.agreement_obligations where agreement_id = current_row.id and status <> 'fulfilled') then raise exception 'all exchange obligations must be approved before completion'; end if;
    update public.work_agreements set status = next_status, version = version + 1, completed_at = case when next_status = 'completed' then now() else completed_at end where id = current_row.id returning * into current_row;
    update public.work_requests set stage = next_status, version = version + 1, updated_at = now() where id = current_row.request_id;
  elsif requested_action = 'milestone' then
    select * into target_milestone from public.milestones where id = (payload->>'milestone_id')::uuid and agreement_id = current_row.id for update;
    if target_milestone.id is null then raise exception 'milestone not found'; end if;
    update public.milestones set completed_at = case when completed_at is null then now() else null end where id = target_milestone.id;
    update public.work_agreements set version = version + 1 where id = current_row.id returning * into current_row;
  elsif requested_action = 'hold' then
    if exists (select 1 from public.dependency_holds where agreement_id = current_row.id and resolved_at is null) then raise exception 'resolve the active hold first'; end if;
    insert into public.dependency_holds(agreement_id, kind, detail, action_owner_text, review_at)
    values (current_row.id, (payload->>'kind')::public.hold_kind, trim(payload->>'detail'), nullif(trim(payload->>'owner'),''), nullif(payload->>'review_at','')::timestamptz);
    update public.work_agreements set version = version + 1 where id = current_row.id returning * into current_row;
  elsif requested_action = 'resolve_hold' then
    update public.dependency_holds set resolved_at = now() where id = (payload->>'hold_id')::uuid and agreement_id = current_row.id and resolved_at is null;
    if not found then raise exception 'active hold not found'; end if;
    update public.work_agreements set version = version + 1 where id = current_row.id returning * into current_row;
  elsif requested_action = 'fulfill' then
    select * into target_obligation from public.agreement_obligations where id = (payload->>'obligation_id')::uuid and agreement_id = current_row.id for update;
    if target_obligation.responsible_profile_id <> actor then raise exception 'only the responsible party may submit fulfillment'; end if;
    update public.agreement_obligations set status = 'submitted', submitted_at = now() where id = target_obligation.id;
    update public.work_agreements set version = version + 1 where id = current_row.id returning * into current_row;
  elsif requested_action = 'approve' then
    select * into target_obligation from public.agreement_obligations where id = (payload->>'obligation_id')::uuid and agreement_id = current_row.id for update;
    if target_obligation.responsible_profile_id = actor or target_obligation.status <> 'submitted' then raise exception 'another party must submit before approval'; end if;
    update public.agreement_obligations set status = 'fulfilled', approved_by = actor, approved_at = now() where id = target_obligation.id;
    update public.work_agreements set version = version + 1 where id = current_row.id returning * into current_row;
  elsif requested_action in ('dispute','cancel') then
    if current_row.status in ('completed','cancelled') then raise exception 'agreement is already closed'; end if;
    next_status := case when requested_action = 'dispute' then 'disputed' else 'cancelled' end;
    update public.work_agreements set status = next_status, version = version + 1 where id = current_row.id returning * into current_row;
    update public.work_requests set stage = next_status, version = version + 1, updated_at = now() where id = current_row.request_id;
  else raise exception 'unsupported agreement action'; end if;

  insert into public.agreement_history(agreement_id, actor_id, from_status, to_status, note, version)
  values (current_row.id, actor, previous_status, current_row.status, nullif(payload->>'note',''), current_row.version);
  return current_row;
end;
$$;

revoke all on function public.set_my_profile(jsonb) from public;
revoke all on function public.accept_trade_offer(uuid) from public;
revoke all on function public.get_my_agreements() from public;
revoke all on function public.perform_agreement_action(uuid, integer, text, jsonb) from public;
grant execute on function public.set_my_profile(jsonb), public.accept_trade_offer(uuid), public.get_my_agreements(), public.perform_agreement_action(uuid, integer, text, jsonb) to authenticated;
