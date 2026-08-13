create table public.member_availability(
 profile_id uuid primary key references public.profiles(id) on delete cascade,
 timezone text not null default 'America/New_York',weekly_windows jsonb not null default '[]'::jsonb,
 lead_time_hours integer not null default 24 check(lead_time_hours between 0 and 8760),updated_at timestamptz not null default now()
);
create table public.schedule_proposals(
 id uuid primary key default gen_random_uuid(),agreement_id uuid not null references public.work_agreements(id) on delete cascade,
 proposed_by uuid not null references public.profiles(id),start_at timestamptz not null,end_at timestamptz not null,timezone text not null,
 weather_sensitive boolean not null default false,location_detail text not null default '',arrival_notes text not null default '',
 status text not null default 'pending' check(status in('pending','accepted','declined','countered','cancelled')),
 counter_to uuid references public.schedule_proposals(id),responded_by uuid references public.profiles(id),responded_at timestamptz,
 created_at timestamptz not null default now(),check(end_at>start_at)
);
create unique index one_pending_schedule_proposal on public.schedule_proposals(agreement_id) where status='pending';
alter table public.member_availability enable row level security;alter table public.schedule_proposals enable row level security;
create policy "members manage own availability" on public.member_availability for all using(profile_id=auth.uid())with check(profile_id=auth.uid());
create policy "participants read schedule proposals" on public.schedule_proposals for select using(exists(select 1 from public.work_agreements a where a.id=agreement_id and auth.uid() in(a.requester_id,a.provider_id)));

create or replace function public.save_my_availability(payload jsonb)returns public.member_availability language plpgsql security definer set search_path=public as $$declare result public.member_availability;begin
 insert into public.member_availability(profile_id,timezone,weekly_windows,lead_time_hours,updated_at)values(auth.uid(),coalesce(nullif(payload->>'timezone',''),'America/New_York'),coalesce(payload->'weekly_windows','[]'::jsonb),coalesce((payload->>'lead_time_hours')::integer,24),now())
 on conflict(profile_id)do update set timezone=excluded.timezone,weekly_windows=excluded.weekly_windows,lead_time_hours=excluded.lead_time_hours,updated_at=now() returning * into result;return result;end$$;
create or replace function public.get_agreement_schedule(target_agreement_id uuid)returns jsonb language plpgsql stable security definer set search_path=public as $$declare a public.work_agreements;begin
 select * into a from public.work_agreements where id=target_agreement_id;if auth.uid() not in(a.requester_id,a.provider_id)then raise exception 'agreement participant required';end if;
 return jsonb_build_object('proposals',coalesce((select jsonb_agg(to_jsonb(s)||jsonb_build_object('proposer_name',p.display_name)order by s.created_at desc)from public.schedule_proposals s join public.profiles p on p.id=s.proposed_by where s.agreement_id=a.id),'[]'::jsonb),'my_availability',(select to_jsonb(v)from public.member_availability v where v.profile_id=auth.uid()),'other_availability',(select jsonb_build_object('timezone',v.timezone,'weekly_windows',v.weekly_windows,'lead_time_hours',v.lead_time_hours)from public.member_availability v where v.profile_id=case when auth.uid()=a.requester_id then a.provider_id else a.requester_id end));end$$;
create or replace function public.propose_schedule_window(target_agreement_id uuid,payload jsonb)returns uuid language plpgsql security definer set search_path=public as $$declare a public.work_agreements;result uuid;counter uuid;other_id uuid;begin
 select * into a from public.work_agreements where id=target_agreement_id for update;if auth.uid() not in(a.requester_id,a.provider_id)or a.status not in('agreed','scheduled')then raise exception 'confirmed agreement participant required';end if;
 if (payload->>'start_at')::timestamptz<now()then raise exception 'schedule must be in the future';end if;counter:=nullif(payload->>'counter_to','')::uuid;
 update public.schedule_proposals set status=case when id=counter then 'countered'else'cancelled'end,responded_by=auth.uid(),responded_at=now()where agreement_id=a.id and status='pending';
 insert into public.schedule_proposals(agreement_id,proposed_by,start_at,end_at,timezone,weather_sensitive,location_detail,arrival_notes,counter_to)values(a.id,auth.uid(),(payload->>'start_at')::timestamptz,(payload->>'end_at')::timestamptz,coalesce(payload->>'timezone','America/New_York'),coalesce((payload->>'weather_sensitive')::boolean,false),coalesce(payload->>'location_detail',''),coalesce(payload->>'arrival_notes',''),counter)returning id into result;
 other_id:=case when auth.uid()=a.requester_id then a.provider_id else a.requester_id end;perform public.notify_user(other_id,'agreement','New schedule proposal','Review the proposed private work window and accept, decline, or counter.');return result;end$$;
create or replace function public.respond_schedule_window(target_proposal_id uuid,response text)returns void language plpgsql security definer set search_path=public as $$declare s public.schedule_proposals;a public.work_agreements;begin
 select * into s from public.schedule_proposals where id=target_proposal_id for update;select * into a from public.work_agreements where id=s.agreement_id for update;
 if auth.uid() not in(a.requester_id,a.provider_id)or auth.uid()=s.proposed_by or s.status<>'pending'then raise exception 'schedule response unavailable';end if;if response not in('accepted','declined')then raise exception 'invalid schedule response';end if;
 update public.schedule_proposals set status=response,responded_by=auth.uid(),responded_at=now()where id=s.id;
 if response='accepted'then update public.work_agreements set proposed_start_at=s.start_at,timezone=s.timezone,status='scheduled',version=version+1 where id=a.id;update public.work_requests set stage='scheduled',updated_at=now()where id=a.request_id;perform public.notify_user(s.proposed_by,'agreement','Schedule accepted','The work window is confirmed. Calendar export and private arrival details are ready.');else perform public.notify_user(s.proposed_by,'agreement','Schedule declined','The proposed work window was declined. Propose another time.');end if;end$$;
revoke all on function public.save_my_availability(jsonb),public.get_agreement_schedule(uuid),public.propose_schedule_window(uuid,jsonb),public.respond_schedule_window(uuid,text)from public;
grant execute on function public.save_my_availability(jsonb),public.get_agreement_schedule(uuid),public.propose_schedule_window(uuid,jsonb),public.respond_schedule_window(uuid,text)to authenticated;
