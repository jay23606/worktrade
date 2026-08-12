alter table public.work_requests add column exchange_modes public.exchange_mode[] not null default array['cash','barter','hybrid']::public.exchange_mode[];
alter table public.work_requests add column exchange_summary text;
alter table public.work_requests add column constraints text;
alter table public.work_requests add column location_visibility text not null default 'region' check(location_visibility in ('region','participants','private'));

alter table public.trade_offers add column exclusions text;
alter table public.trade_offers add column responsibilities jsonb not null default '{}'::jsonb;
alter table public.trade_offers add column proposed_milestones jsonb not null default '[]'::jsonb;
alter table public.trade_offers add column questions text;
alter table public.trade_offers add column expires_at timestamptz;

alter table public.milestones add column responsible_profile_id uuid references public.profiles(id);
alter table public.milestones add column due_at timestamptz;
alter table public.work_agreements add column completion_requested_by uuid references public.profiles(id);
alter table public.work_agreements add column completion_requested_at timestamptz;
alter table public.work_agreements add column completion_approved_by uuid references public.profiles(id);

create table public.agreement_amendments(
  id uuid primary key default gen_random_uuid(), agreement_id uuid not null references public.work_agreements(id) on delete cascade,
  proposed_by uuid not null references public.profiles(id), version integer not null, scope text not null,
  exchange_snapshot jsonb not null, reason text not null, status text not null default 'proposed' check(status in ('proposed','accepted','declined','withdrawn')),
  responded_by uuid references public.profiles(id), responded_at timestamptz, created_at timestamptz not null default now(), unique(agreement_id,version)
);
alter table public.agreement_amendments enable row level security;
grant select on public.agreement_amendments to authenticated;
create policy "agreement participants read amendments" on public.agreement_amendments for select using(exists(select 1 from public.work_agreements a where a.id=agreement_id and auth.uid() in(a.requester_id,a.provider_id)));

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('request-media','request-media',false,10485760,array['image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
create table public.request_media(id uuid primary key default gen_random_uuid(),request_id uuid not null references public.work_requests(id) on delete cascade,uploader_id uuid not null references public.profiles(id),asset_path text not null,caption text,position integer not null default 0,created_at timestamptz not null default now());
alter table public.request_media enable row level security; grant select,insert,delete on public.request_media to authenticated;
create policy "visible request media readable" on public.request_media for select using(exists(select 1 from public.work_requests r where r.id=request_id and (r.visibility='public' or r.owner_id=auth.uid())));
create policy "owner records request media" on public.request_media for insert with check(uploader_id=auth.uid() and exists(select 1 from public.work_requests r where r.id=request_id and r.owner_id=auth.uid() and r.stage in('draft','open')));
create policy "owner removes request media" on public.request_media for delete using(uploader_id=auth.uid() and exists(select 1 from public.work_requests r where r.id=request_id and r.owner_id=auth.uid() and r.stage in('draft','open')));
create policy "owner uploads request media" on storage.objects for insert to authenticated with check(bucket_id='request-media' and exists(select 1 from public.work_requests r where r.id=((storage.foldername(name))[1])::uuid and r.owner_id=auth.uid() and r.stage in('draft','open')));
create policy "visible request media objects" on storage.objects for select to authenticated using(bucket_id='request-media' and exists(select 1 from public.work_requests r where r.id=((storage.foldername(name))[1])::uuid and (r.visibility='public' or r.owner_id=auth.uid())));
create policy "owner deletes request media objects" on storage.objects for delete to authenticated using(bucket_id='request-media' and owner_id=auth.uid()::text);

create or replace function public.create_work_request(payload jsonb) returns uuid language plpgsql security definer set search_path=public as $$
declare new_id uuid;skill_value text;
begin
 if auth.uid() is null then raise exception 'authentication required'; end if;
 insert into public.work_requests(owner_id,title,description,kind,stage,location_text,urgency_text,cash_budget_cents,visibility,exchange_modes,exchange_summary,constraints,location_visibility)
 values(auth.uid(),trim(payload->>'title'),trim(payload->>'description'),(payload->>'kind')::public.work_kind,'open',nullif(trim(payload->>'location'),''),nullif(trim(payload->>'urgency'),''),nullif(payload->>'cash_budget_cents','')::bigint,coalesce(nullif(payload->>'visibility',''),'public'),
 array(select jsonb_array_elements_text(coalesce(payload->'exchange_modes','["cash","barter","hybrid"]'::jsonb))::public.exchange_mode),nullif(trim(payload->>'exchange_summary'),''),nullif(trim(payload->>'constraints'),''),coalesce(nullif(payload->>'location_visibility',''),'region')) returning id into new_id;
 for skill_value in select jsonb_array_elements_text(coalesce(payload->'skills','[]'::jsonb)) loop insert into public.work_request_skills(request_id,skill) values(new_id,trim(skill_value)) on conflict do nothing; end loop; return new_id;
end $$;

create or replace function public.submit_trade_offer(target_request_id uuid,payload jsonb) returns uuid language plpgsql security definer set search_path=public as $$
declare new_id uuid;target_owner uuid;
begin
 if auth.uid() is null then raise exception 'authentication required'; end if;
 select owner_id into target_owner from public.work_requests where id=target_request_id and stage='open' for update;
 if target_owner is null then raise exception 'request is unavailable'; end if;if target_owner=auth.uid() then raise exception 'owners cannot offer on their own request'; end if;
 insert into public.trade_offers(request_id,provider_id,mode,scope,exchange_summary,duration_text,exclusions,responsibilities,proposed_milestones,questions,expires_at)
 values(target_request_id,auth.uid(),(payload->>'mode')::public.exchange_mode,trim(payload->>'scope'),trim(payload->>'exchange_summary'),nullif(trim(payload->>'duration'),''),nullif(trim(payload->>'exclusions'),''),coalesce(payload->'responsibilities','{}'::jsonb),coalesce(payload->'milestones','[]'::jsonb),nullif(trim(payload->>'questions'),''),nullif(payload->>'expires_at','')::timestamptz) returning id into new_id;
 perform public.notify_user(target_owner,'proposal','New trade proposal','A member proposed detailed terms for your work request.',target_request_id,null);return new_id;
end $$;

create or replace function public.accept_trade_offer(target_offer_id uuid) returns uuid language plpgsql security definer set search_path=public as $$
declare chosen public.trade_offers;target public.work_requests;agreement_id uuid;milestone jsonb;position_value integer:=0;
begin
 if auth.uid() is null then raise exception 'authentication required'; end if;select * into chosen from public.trade_offers where id=target_offer_id and status='pending' and (expires_at is null or expires_at>now()) for update;if chosen.id is null then raise exception 'offer unavailable or expired'; end if;
 select * into target from public.work_requests where id=chosen.request_id for update;if target.owner_id<>auth.uid() then raise exception 'only the request owner may accept an offer';end if;if target.stage<>'open' then raise exception 'request is no longer open';end if;
 insert into public.work_agreements(request_id,accepted_offer_id,requester_id,provider_id,scope_snapshot,exchange_snapshot,status) values(target.id,chosen.id,target.owner_id,chosen.provider_id,chosen.scope,jsonb_build_object('mode',chosen.mode,'summary',chosen.exchange_summary,'responsibilities',chosen.responsibilities,'exclusions',chosen.exclusions),'proposed') returning id into agreement_id;
 insert into public.agreement_obligations(agreement_id,responsible_profile_id,description) values(agreement_id,chosen.provider_id,chosen.scope),(agreement_id,target.owner_id,chosen.exchange_summary);
 if jsonb_array_length(chosen.proposed_milestones)>0 then for milestone in select * from jsonb_array_elements(chosen.proposed_milestones) loop insert into public.milestones(agreement_id,title,position,responsible_profile_id,due_at) values(agreement_id,milestone->>'title',position_value,case when milestone->>'responsible'='requester' then target.owner_id else chosen.provider_id end,nullif(milestone->>'due_at','')::timestamptz);position_value:=position_value+1;end loop;
 else insert into public.milestones(agreement_id,title,position) values(agreement_id,'Confirm scope and exchange',0),(agreement_id,'Prepare access and inputs',1),(agreement_id,'Complete agreed work',2),(agreement_id,'Review both sides of the exchange',3);end if;
 update public.trade_offers set status=case when id=chosen.id then 'accepted' else 'declined' end where request_id=target.id and status='pending';update public.work_requests set stage='proposed',version=version+1,updated_at=now() where id=target.id;insert into public.agreement_history(agreement_id,actor_id,from_status,to_status,note,version) values(agreement_id,auth.uid(),null,'proposed','Offer selected; awaiting mutual confirmation',1);return agreement_id;
end $$;

create or replace function public.propose_agreement_amendment(target_agreement_id uuid,expected_version integer,payload jsonb) returns uuid language plpgsql security definer set search_path=public as $$
declare a public.work_agreements;new_id uuid;recipient uuid;
begin select * into a from public.work_agreements where id=target_agreement_id for update;if auth.uid() not in(a.requester_id,a.provider_id) then raise exception 'not a participant';end if;if a.version<>expected_version then raise exception 'agreement changed; refresh';end if;if a.status in('completed','cancelled') then raise exception 'closed agreement';end if;
 insert into public.agreement_amendments(agreement_id,proposed_by,version,scope,exchange_snapshot,reason) values(a.id,auth.uid(),a.version+1,coalesce(nullif(trim(payload->>'scope'),''),a.scope_snapshot),coalesce(payload->'exchange',a.exchange_snapshot),trim(payload->>'reason')) returning id into new_id;
 recipient:=case when auth.uid()=a.requester_id then a.provider_id else a.requester_id end;perform public.notify_user(recipient,'agreement','Agreement amendment proposed','Review and accept or decline the proposed changes.',a.request_id,a.id);return new_id;end $$;

create or replace function public.respond_agreement_amendment(target_amendment_id uuid,accept boolean) returns public.work_agreements language plpgsql security definer set search_path=public as $$
declare am public.agreement_amendments;a public.work_agreements;
begin select * into am from public.agreement_amendments where id=target_amendment_id and status='proposed' for update;select * into a from public.work_agreements where id=am.agreement_id for update;if auth.uid() not in(a.requester_id,a.provider_id) or auth.uid()=am.proposed_by then raise exception 'counterparty response required';end if;
 update public.agreement_amendments set status=case when accept then 'accepted' else 'declined' end,responded_by=auth.uid(),responded_at=now() where id=am.id;
 if accept then update public.work_agreements set scope_snapshot=am.scope,exchange_snapshot=am.exchange_snapshot,version=version+1,confirmed_by_requester_at=null,confirmed_by_provider_at=null,status='proposed' where id=a.id returning * into a;else select * into a from public.work_agreements where id=a.id;end if;return a;end $$;

revoke all on function public.propose_agreement_amendment(uuid,integer,jsonb),public.respond_agreement_amendment(uuid,boolean) from public;grant execute on function public.propose_agreement_amendment(uuid,integer,jsonb),public.respond_agreement_amendment(uuid,boolean) to authenticated;
