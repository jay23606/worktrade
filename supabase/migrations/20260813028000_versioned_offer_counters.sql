alter table public.trade_offers
  add column if not exists version integer not null default 1,
  add column if not exists last_proposed_by uuid references public.profiles(id);

update public.trade_offers set last_proposed_by=provider_id where last_proposed_by is null;

create table if not exists public.trade_offer_versions(
  id uuid primary key default gen_random_uuid(),
  offer_id uuid not null references public.trade_offers(id) on delete cascade,
  version integer not null,
  proposed_by uuid not null references public.profiles(id),
  mode public.exchange_mode not null,
  scope text not null,
  exchange_summary text not null,
  duration_text text,
  exclusions text,
  responsibilities jsonb not null default '{}'::jsonb,
  proposed_milestones jsonb not null default '[]'::jsonb,
  questions text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  unique(offer_id,version)
);

alter table public.trade_offer_versions enable row level security;
create policy "proposal participants read version history" on public.trade_offer_versions for select using(
  exists(select 1 from public.trade_offers o join public.work_requests r on r.id=o.request_id where o.id=offer_id and auth.uid() in(o.provider_id,r.owner_id))
);

create or replace function public.counter_trade_offer(target_offer_id uuid,payload jsonb) returns public.trade_offers language plpgsql security definer set search_path=public as $$
declare o public.trade_offers; r public.work_requests; recipient uuid;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select * into o from public.trade_offers where id=target_offer_id and status='pending' for update;
  if o.id is null then raise exception 'pending proposal not found'; end if;
  select * into r from public.work_requests where id=o.request_id and stage='open';
  if r.id is null or auth.uid() not in(o.provider_id,r.owner_id) then raise exception 'proposal participant required'; end if;
  if auth.uid()=o.last_proposed_by then raise exception 'the other participant must respond to the current version'; end if;
  insert into public.trade_offer_versions(offer_id,version,proposed_by,mode,scope,exchange_summary,duration_text,exclusions,responsibilities,proposed_milestones,questions,expires_at)
  values(o.id,o.version,o.last_proposed_by,o.mode,o.scope,o.exchange_summary,o.duration_text,o.exclusions,o.responsibilities,o.proposed_milestones,o.questions,o.expires_at);
  update public.trade_offers set
    version=o.version+1,last_proposed_by=auth.uid(),mode=(payload->>'mode')::public.exchange_mode,
    scope=trim(payload->>'scope'),exchange_summary=trim(payload->>'exchange_summary'),duration_text=nullif(trim(payload->>'duration'),''),
    exclusions=nullif(trim(payload->>'exclusions'),''),responsibilities=coalesce(payload->'responsibilities',o.responsibilities),
    proposed_milestones=coalesce(payload->'milestones',o.proposed_milestones),questions=nullif(trim(payload->>'questions'),''),
    expires_at=nullif(payload->>'expires_at','')::timestamptz,created_at=now()
  where id=o.id returning * into o;
  recipient:=case when auth.uid()=r.owner_id then o.provider_id else r.owner_id end;
  perform public.notify_user(recipient,'proposal','Counterproposal received','Review the changed terms and accept, counter, or decline.',r.id,null);
  return o;
end $$;

create or replace function public.decline_trade_offer(target_offer_id uuid) returns void language plpgsql security definer set search_path=public as $$
declare o public.trade_offers; r public.work_requests;
begin
  select * into o from public.trade_offers where id=target_offer_id and status='pending' for update;
  select * into r from public.work_requests where id=o.request_id;
  if o.id is null or auth.uid() not in(o.provider_id,r.owner_id) or auth.uid()=o.last_proposed_by then raise exception 'counterparty response required'; end if;
  update public.trade_offers set status='declined' where id=o.id;
end $$;

create or replace function public.accept_trade_offer(target_offer_id uuid) returns uuid language plpgsql security definer set search_path=public as $$
declare chosen public.trade_offers;target public.work_requests;agreement_id uuid;milestone jsonb;position_value integer:=0;
begin
 if auth.uid() is null then raise exception 'authentication required'; end if;select * into chosen from public.trade_offers where id=target_offer_id and status='pending' and (expires_at is null or expires_at>now()) for update;if chosen.id is null then raise exception 'offer unavailable or expired'; end if;
 select * into target from public.work_requests where id=chosen.request_id for update;if auth.uid() not in(target.owner_id,chosen.provider_id) or auth.uid()=chosen.last_proposed_by then raise exception 'counterparty acceptance required';end if;if target.stage<>'open' then raise exception 'request is no longer open';end if;
 insert into public.work_agreements(request_id,accepted_offer_id,requester_id,provider_id,scope_snapshot,exchange_snapshot,status) values(target.id,chosen.id,target.owner_id,chosen.provider_id,chosen.scope,jsonb_build_object('mode',chosen.mode,'summary',chosen.exchange_summary,'responsibilities',chosen.responsibilities,'exclusions',chosen.exclusions,'proposal_version',chosen.version),'proposed') returning id into agreement_id;
 insert into public.agreement_obligations(agreement_id,responsible_profile_id,description) values(agreement_id,chosen.provider_id,chosen.scope),(agreement_id,target.owner_id,chosen.exchange_summary);
 if jsonb_array_length(chosen.proposed_milestones)>0 then for milestone in select * from jsonb_array_elements(chosen.proposed_milestones) loop insert into public.milestones(agreement_id,title,position,responsible_profile_id,due_at) values(agreement_id,milestone->>'title',position_value,case when milestone->>'responsible'='requester' then target.owner_id else chosen.provider_id end,nullif(milestone->>'due_at','')::timestamptz);position_value:=position_value+1;end loop;
 else insert into public.milestones(agreement_id,title,position) values(agreement_id,'Confirm scope and exchange',0),(agreement_id,'Prepare access and inputs',1),(agreement_id,'Complete agreed work',2),(agreement_id,'Review both sides of the exchange',3);end if;
 update public.trade_offers set status=case when id=chosen.id then 'accepted' else 'declined' end where request_id=target.id and status='pending';update public.work_requests set stage='proposed',version=version+1,updated_at=now() where id=target.id;insert into public.agreement_history(agreement_id,actor_id,from_status,to_status,note,version) values(agreement_id,auth.uid(),null,'proposed','Proposal version '||chosen.version||' accepted; awaiting mutual confirmation',1);return agreement_id;
end $$;

revoke all on function public.counter_trade_offer(uuid,jsonb),public.decline_trade_offer(uuid) from public;
grant execute on function public.counter_trade_offer(uuid,jsonb),public.decline_trade_offer(uuid) to authenticated;
grant select on public.trade_offer_versions to authenticated;
