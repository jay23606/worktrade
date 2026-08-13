insert into public.skill_aliases(alias,canonical,family)values
('bath valve','plumbing','repair'),('faucet','plumbing','repair'),('toilet repair','plumbing','repair'),('drain repair','plumbing','repair'),
('bike repair','bicycle repair','repair'),('bicycle mechanic','bicycle repair','repair'),
('hvac','heating and cooling','repair'),('air conditioning','heating and cooling','repair'),
('small engine','small engine repair','repair'),('appliance repair','appliance repair','repair'),
('drywall','drywall','build'),('framing','carpentry','build'),('furniture','carpentry','build'),
('masonry','masonry','build'),('concrete','masonry','build'),('roofing','roofing','build'),
('lawn care','landscaping','outdoor'),('tree work','landscaping','outdoor'),
('bookkeeper','bookkeeping','business'),('accounting','bookkeeping','business'),
('computer repair','computer repair','digital'),('tech support','computer repair','digital'),
('copywriting','writing','creative'),('editing','writing','creative'),
('moving','moving help','service'),('hauling','hauling','service'),('delivery','transportation','service')
on conflict(alias)do update set canonical=excluded.canonical,family=excluded.family;

create or replace function public.canonical_skill(value text)returns text language sql stable security definer set search_path=public as $$
 select coalesce((select canonical from public.skill_aliases where lower(trim(value))=alias or lower(trim(value))like'%'||alias||'%' order by length(alias)desc limit 1),lower(trim(value)))
$$;
create or replace function public.skill_family(value text)returns text language sql stable security definer set search_path=public as $$
 select coalesce((select family from public.skill_aliases where lower(trim(value))=alias or lower(trim(value))like'%'||alias||'%' order by length(alias)desc limit 1),'other')
$$;
create or replace function public.availability_overlap(left_value text,right_value text)returns boolean language sql immutable as $$
 select coalesce(left_value,'')<>''and coalesce(right_value,'')<>''and(
  lower(left_value)like'%flexib%'or lower(right_value)like'%flexib%'or lower(left_value)like'%any time%'or lower(right_value)like'%any time%'or
  exists(select 1 from unnest(array['weekend','weekday','evening','morning','afternoon'])word where lower(left_value)like'%'||word||'%'and lower(right_value)like'%'||word||'%'))
$$;

create table public.match_events(
 id uuid primary key default gen_random_uuid(),viewer_id uuid not null references public.profiles(id)on delete cascade,
 target_profile_id uuid references public.profiles(id)on delete cascade,target_request_id uuid references public.work_requests(id)on delete cascade,
 event_kind text not null check(event_kind in('viewed','useful','dismissed','contacted','proposed')),
 reason text check(char_length(reason)<=120),created_at timestamptz not null default now(),
 check((target_profile_id is not null)::int+(target_request_id is not null)::int=1)
);
alter table public.match_events enable row level security;
create policy "members read own match events" on public.match_events for select using(viewer_id=auth.uid());
grant select on public.match_events to authenticated;
create or replace function public.record_match_event(profile_value uuid,request_value uuid,event_value text,reason_value text default null)returns void language plpgsql security definer set search_path=public as $$
begin
 if auth.uid()is null or event_value not in('viewed','useful','dismissed','contacted','proposed')then raise exception'invalid match event';end if;
 if(profile_value is null)::int+(request_value is null)::int<>1 then raise exception'choose one match target';end if;
 insert into public.match_events(viewer_id,target_profile_id,target_request_id,event_kind,reason)values(auth.uid(),profile_value,request_value,event_value,nullif(left(trim(reason_value),120),''));
end$$;

create or replace function public.discover_profiles(search_text text default '',exchange_filter text default null,remote_only boolean default false)
returns table(profile jsonb,capabilities jsonb,portfolio jsonb,reviews jsonb)language sql stable security definer set search_path=public as $$
with me as(select * from public.profiles where id=auth.uid()),candidates as(
 select p.*,
  array(select distinct public.canonical_skill(t.label)from public.capabilities t join public.capabilities m on m.profile_id=auth.uid()and m.direction='need'and public.canonical_skill(m.label)=public.canonical_skill(t.label)where t.profile_id=p.id and t.direction='offer')matched_offers,
  array(select distinct public.canonical_skill(t.label)from public.capabilities t join public.capabilities m on m.profile_id=auth.uid()and m.direction='offer'and public.canonical_skill(m.label)=public.canonical_skill(t.label)where t.profile_id=p.id and t.direction='need')matched_needs,
  array(select distinct public.skill_family(t.label)from public.capabilities t join public.capabilities m on m.profile_id=auth.uid()and m.direction='need'and public.skill_family(m.label)=public.skill_family(t.label)and public.skill_family(t.label)<>'other'and public.canonical_skill(m.label)<>public.canonical_skill(t.label)where t.profile_id=p.id and t.direction='offer')related_offers,
  array(select distinct public.skill_family(t.label)from public.capabilities t join public.capabilities m on m.profile_id=auth.uid()and m.direction='offer'and public.skill_family(m.label)=public.skill_family(t.label)and public.skill_family(t.label)<>'other'and public.canonical_skill(m.label)<>public.canonical_skill(t.label)where t.profile_id=p.id and t.direction='need')related_needs
 from public.profiles p where p.is_active and p.profile_visibility='public'and p.id<>coalesce(auth.uid(),'00000000-0000-0000-0000-000000000000'::uuid)and(not remote_only or p.remote_available)
 and(exchange_filter is null or exchange_filter::public.exchange_mode=any(p.preferred_exchange_modes))
 and(coalesce(search_text,'')=''or p.display_name ilike'%'||search_text||'%'or p.bio ilike'%'||search_text||'%'or exists(select 1 from public.capabilities c where c.profile_id=p.id and(c.label ilike'%'||search_text||'%'or public.canonical_skill(c.label)=public.canonical_skill(search_text)or public.skill_family(c.label)=public.skill_family(search_text))))
),ranked as(select p.*,
 (p.location_visibility='region'and p.location_text=(select location_text from me))nearby,
 exists(select 1 from me where me.preferred_exchange_modes&&p.preferred_exchange_modes)exchange_fit,
 public.availability_overlap(p.availability_text,(select availability_text from me))availability_fit,
 exists(select 1 from public.capabilities m join public.skill_aliases a on public.canonical_skill(m.label)=a.canonical where m.profile_id=auth.uid()and m.direction='need'and coalesce(p.resources_text,'')ilike'%'||a.alias||'%')resource_fit,
 coalesce((select sum(case event_kind when'useful'then 3 when'dismissed'then-12 when'contacted'then 2 when'proposed'then 4 else 0 end)from public.match_events e where e.viewer_id=auth.uid()and e.target_profile_id=p.id),0)personal_signal,
 exists(select 1 from public.work_agreements a where a.status='completed'and auth.uid()in(a.requester_id,a.provider_id)and p.id in(a.requester_id,a.provider_id))worked_together
 from candidates p)
select(to_jsonb(p)-'deactivated_at'-'location_text'-'matched_offers'-'matched_needs'-'related_offers'-'related_needs'-'nearby'-'exchange_fit'-'availability_fit'-'resource_fit'-'personal_signal'-'worked_together')||jsonb_build_object(
 'location_text',case when p.location_visibility='region'then p.location_text else null end,'location_band',case when p.location_visibility<>'region'then'Location private'when p.nearby then'Same general area'else'Different or unknown area'end,
 'following',exists(select 1 from public.follows f where f.follower_id=auth.uid()and f.followed_profile_id=p.id),'completed_count',(select count(*)from public.work_agreements a where a.status='completed'and p.id in(a.requester_id,a.provider_id)),'review_count',(select count(*)from public.work_reviews r where r.subject_id=p.id),
 'matched_offers',to_jsonb(p.matched_offers),'matched_needs',to_jsonb(p.matched_needs),'related_offers',to_jsonb(p.related_offers),'related_needs',to_jsonb(p.related_needs),
 'match_reasons',to_jsonb(array_remove(array[case when cardinality(p.matched_offers)>0 then'Offers what you need' end,case when cardinality(p.matched_needs)>0 then'Needs what you offer'end,case when cardinality(p.related_offers)+cardinality(p.related_needs)>0 then'Related practical skills'end,case when p.nearby then'Same general area'end,case when p.remote_available and(select remote_available from me)then'Both open to remote work'end,case when p.availability_fit then'Availability overlaps'end,case when p.exchange_fit then'Compatible exchange modes'end,case when p.resource_fit then'Has useful tools or access'end,case when exists(select 1 from public.portfolio_entries pe where pe.profile_id=p.id and pe.visibility='public')then'Has proven work'end,case when p.worked_together then'Worked together successfully'end],null)),
 'match_score',greatest(0,least(100,18*cardinality(p.matched_offers)+15*cardinality(p.matched_needs)+6*cardinality(p.related_offers)+5*cardinality(p.related_needs)+case when p.nearby then 8 else 0 end+case when p.remote_available and(select remote_available from me)then 6 else 0 end+case when p.availability_fit then 7 else 0 end+case when p.exchange_fit then 6 else 0 end+case when p.resource_fit then 5 else 0 end+least(6,(select count(*)from public.portfolio_entries pe where pe.profile_id=p.id and pe.visibility='public'))+case when p.worked_together then 6 else 0 end+p.personal_signal))
)profile,coalesce((select jsonb_agg(to_jsonb(c)||jsonb_build_object('canonical',public.canonical_skill(c.label),'family',public.skill_family(c.label)))from public.capabilities c where c.profile_id=p.id),'[]'::jsonb),coalesce((select jsonb_agg(to_jsonb(pe)order by pe.published_at desc)from public.portfolio_entries pe where pe.profile_id=p.id and pe.visibility='public'),'[]'::jsonb),coalesce((select jsonb_agg(to_jsonb(rv)order by rv.created_at desc)from public.work_reviews rv where rv.subject_id=p.id),'[]'::jsonb)
from ranked p order by greatest(0,18*cardinality(p.matched_offers)+15*cardinality(p.matched_needs)+6*cardinality(p.related_offers)+5*cardinality(p.related_needs)+p.personal_signal)desc,p.created_at desc limit 50$$;
revoke all on table public.match_events from anon;
revoke all on function public.record_match_event(uuid,uuid,text,text)from public,anon;
grant execute on function public.canonical_skill(text),public.skill_family(text),public.availability_overlap(text,text),public.discover_profiles(text,text,boolean)to anon,authenticated;
grant execute on function public.record_match_event(uuid,uuid,text,text)to authenticated;
