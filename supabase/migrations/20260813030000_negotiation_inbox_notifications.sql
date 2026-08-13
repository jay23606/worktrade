alter table public.notifications add column if not exists offer_id uuid references public.trade_offers(id) on delete cascade;
create unique index if not exists one_offer_expiration_warning on public.notifications(profile_id,offer_id,title) where offer_id is not null and title='Proposal expires soon';

create or replace function public.counter_trade_offer(target_offer_id uuid,payload jsonb) returns public.trade_offers language plpgsql security definer set search_path=public as $$
declare o public.trade_offers; r public.work_requests; recipient uuid; changes text[]:=array[]::text[];
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  select * into o from public.trade_offers where id=target_offer_id and status='pending' for update;
  if o.id is null then raise exception 'pending proposal not found'; end if;
  select * into r from public.work_requests where id=o.request_id and stage='open';
  if r.id is null or auth.uid() not in(o.provider_id,r.owner_id) then raise exception 'proposal participant required'; end if;
  if auth.uid()=o.last_proposed_by then raise exception 'the other participant must respond to the current version'; end if;
  if o.mode::text is distinct from payload->>'mode' then changes:=array_append(changes,'exchange type');end if;
  if o.scope is distinct from trim(payload->>'scope') then changes:=array_append(changes,'scope');end if;
  if o.exchange_summary is distinct from trim(payload->>'exchange_summary') then changes:=array_append(changes,'exchange');end if;
  if coalesce(o.duration_text,'') is distinct from coalesce(trim(payload->>'duration'),'') then changes:=array_append(changes,'duration');end if;
  if coalesce(o.exclusions,'') is distinct from coalesce(trim(payload->>'exclusions'),'') then changes:=array_append(changes,'exclusions');end if;
  insert into public.trade_offer_versions(offer_id,version,proposed_by,mode,scope,exchange_summary,duration_text,exclusions,responsibilities,proposed_milestones,questions,expires_at)
  values(o.id,o.version,o.last_proposed_by,o.mode,o.scope,o.exchange_summary,o.duration_text,o.exclusions,o.responsibilities,o.proposed_milestones,o.questions,o.expires_at);
  update public.trade_offers set version=o.version+1,last_proposed_by=auth.uid(),mode=(payload->>'mode')::public.exchange_mode,scope=trim(payload->>'scope'),exchange_summary=trim(payload->>'exchange_summary'),duration_text=nullif(trim(payload->>'duration'),''),exclusions=nullif(trim(payload->>'exclusions'),''),responsibilities=coalesce(payload->'responsibilities',o.responsibilities),proposed_milestones=coalesce(payload->'milestones',o.proposed_milestones),questions=nullif(trim(payload->>'questions'),''),expires_at=nullif(payload->>'expires_at','')::timestamptz,created_at=now() where id=o.id returning * into o;
  recipient:=case when auth.uid()=r.owner_id then o.provider_id else r.owner_id end;
  insert into public.notifications(profile_id,kind,title,body,request_id,offer_id) values(recipient,'proposal','Counterproposal received','Version '||o.version||' changed: '||coalesce(nullif(array_to_string(changes,', '),''),'terms updated')||'. Accept, counter, or decline.',r.id,o.id);
  return o;
end $$;

create or replace function public.queue_offer_expiration_warnings() returns integer language plpgsql security definer set search_path=public as $$
declare o record; recipient uuid; inserted integer:=0;
begin
  for o in select t.*,r.owner_id,r.title from public.trade_offers t join public.work_requests r on r.id=t.request_id where t.status='pending' and t.expires_at between now() and now()+interval '24 hours' loop
    recipient:=case when o.last_proposed_by=o.owner_id then o.provider_id else o.owner_id end;
    insert into public.notifications(profile_id,kind,title,body,request_id,offer_id) values(recipient,'proposal','Proposal expires soon',o.title||' expires within 24 hours. Review the latest version before it closes.',o.request_id,o.id) on conflict do nothing;
    if found then inserted:=inserted+1;end if;
  end loop;
  return inserted;
end $$;

revoke all on function public.queue_offer_expiration_warnings() from public,anon,authenticated;
grant execute on function public.queue_offer_expiration_warnings() to service_role;
