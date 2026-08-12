alter table public.request_media add column label text not null default 'current' check(label in('before','current','reference','after'));
alter table public.request_media add column visibility text not null default 'public' check(visibility in('public','participants','private'));
alter table public.work_agreements add column proposed_start_at timestamptz;
alter table public.work_agreements add column working_windows text;
alter table public.work_agreements add column timezone text not null default 'America/New_York';

create table public.proposal_questions(id uuid primary key default gen_random_uuid(),offer_id uuid not null references public.trade_offers(id) on delete cascade,author_id uuid not null references public.profiles(id),body text not null check(char_length(body) between 1 and 1500),created_at timestamptz not null default now());
alter table public.proposal_questions enable row level security;grant select,insert on public.proposal_questions to authenticated;
create policy "proposal participants read questions" on public.proposal_questions for select using(exists(select 1 from public.trade_offers o join public.work_requests r on r.id=o.request_id where o.id=offer_id and auth.uid() in(o.provider_id,r.owner_id)));
create policy "proposal participants ask questions" on public.proposal_questions for insert with check(author_id=auth.uid() and exists(select 1 from public.trade_offers o join public.work_requests r on r.id=o.request_id where o.id=offer_id and o.status='pending' and auth.uid() in(o.provider_id,r.owner_id)));

create or replace function public.manage_request_media(target_media_id uuid,action text,payload jsonb default '{}'::jsonb) returns void language plpgsql security definer set search_path=public as $$
declare m public.request_media;
begin select * into m from public.request_media where id=target_media_id for update;if m.uploader_id<>auth.uid() then raise exception 'media not found';end if;
 if action='edit' then update public.request_media set caption=nullif(trim(payload->>'caption'),''),label=coalesce(nullif(payload->>'label',''),'current'),visibility=coalesce(nullif(payload->>'visibility',''),'public') where id=m.id;
 elsif action='move' then update public.request_media set position=(payload->>'position')::integer where id=m.id;
 elsif action='delete' then delete from storage.objects where bucket_id='request-media' and name=m.asset_path;delete from public.request_media where id=m.id;
 else raise exception 'unsupported media action';end if;end $$;
grant execute on function public.manage_request_media(uuid,text,jsonb) to authenticated;

create or replace function public.set_agreement_schedule(target_agreement_id uuid,expected_version integer,payload jsonb) returns public.work_agreements language plpgsql security definer set search_path=public as $$
declare a public.work_agreements;
begin select * into a from public.work_agreements where id=target_agreement_id for update;if auth.uid() not in(a.requester_id,a.provider_id) then raise exception 'not a participant';end if;if a.version<>expected_version then raise exception 'agreement changed; refresh';end if;if a.status not in('proposed','agreed','scheduled') then raise exception 'active schedule changes require an amendment';end if;
 update public.work_agreements set proposed_start_at=nullif(payload->>'start_at','')::timestamptz,working_windows=nullif(trim(payload->>'working_windows'),''),timezone=coalesce(nullif(payload->>'timezone',''),'America/New_York'),version=version+1 where id=a.id returning * into a;return a;end $$;
grant execute on function public.set_agreement_schedule(uuid,integer,jsonb) to authenticated;
