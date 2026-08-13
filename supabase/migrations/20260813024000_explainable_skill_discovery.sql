create table public.skill_aliases(
  alias text primary key,
  canonical text not null,
  family text not null
);
insert into public.skill_aliases(alias,canonical,family) values
('carpenter','carpentry','build'),('woodworking','carpentry','build'),('cabinetry','carpentry','build'),
('electrician','electrical','repair'),('wiring','electrical','repair'),
('plumber','plumbing','repair'),('pipe fitting','plumbing','repair'),
('mechanic','auto repair','repair'),('automotive','auto repair','repair'),('car repair','auto repair','repair'),
('web design','web design','digital'),('website design','web design','digital'),('ui design','web design','digital'),
('graphic design','graphic design','creative'),('branding','graphic design','creative'),
('photo','photography','creative'),('photographer','photography','creative'),
('landscaper','landscaping','outdoor'),('yard work','landscaping','outdoor'),('gardening','landscaping','outdoor'),
('painting','painting','finish'),('painter','painting','finish'),
('welding','welding','fabrication'),('welder','welding','fabrication'),
('sewing','sewing','textile'),('tailoring','sewing','textile'),
('cleaner','cleaning','service'),('house cleaning','cleaning','service'),
('tutor','tutoring','education'),('teaching','tutoring','education')
on conflict(alias) do update set canonical=excluded.canonical,family=excluded.family;

create or replace function public.canonical_skill(value text)
returns text language sql immutable set search_path=public as $$
  select coalesce((select canonical from public.skill_aliases where alias=lower(trim(value))),lower(trim(value)));
$$;

create or replace function public.discover_profiles(search_text text default '',exchange_filter text default null,remote_only boolean default false)
returns table(profile jsonb,capabilities jsonb,portfolio jsonb,reviews jsonb) language sql stable security definer set search_path=public as $$
with me as(select * from public.profiles where id=auth.uid()), candidates as(
 select p.*,
  array(select distinct public.canonical_skill(t.label) from public.capabilities t join public.capabilities m on m.profile_id=auth.uid() and m.direction='need' and public.canonical_skill(m.label)=public.canonical_skill(t.label) where t.profile_id=p.id and t.direction='offer') matched_offers,
  array(select distinct public.canonical_skill(t.label) from public.capabilities t join public.capabilities m on m.profile_id=auth.uid() and m.direction='offer' and public.canonical_skill(m.label)=public.canonical_skill(t.label) where t.profile_id=p.id and t.direction='need') matched_needs
 from public.profiles p where p.is_active and p.profile_visibility='public' and(not remote_only or p.remote_available)
 and(exchange_filter is null or exchange_filter::public.exchange_mode=any(p.preferred_exchange_modes))
 and(coalesce(search_text,'')='' or p.display_name ilike'%'||search_text||'%' or p.bio ilike'%'||search_text||'%' or exists(select 1 from public.capabilities c where c.profile_id=p.id and(c.label ilike'%'||search_text||'%' or public.canonical_skill(c.label)=public.canonical_skill(search_text))))
)
select (to_jsonb(p)-'deactivated_at'-'location_text'-'matched_offers'-'matched_needs')||jsonb_build_object(
 'location_text',case when p.location_visibility='region' or p.id=auth.uid() then p.location_text else null end,
 'location_band',case when p.location_visibility<>'region' then 'Location private' when p.location_text is not null and p.location_text=(select location_text from me)then 'Same general area' else 'Different or unknown area' end,
 'following',exists(select 1 from public.follows f where f.follower_id=auth.uid()and f.followed_profile_id=p.id),
 'completed_count',(select count(*)from public.work_agreements a where a.status='completed'and p.id in(a.requester_id,a.provider_id)),
 'review_count',(select count(*)from public.work_reviews rv where rv.subject_id=p.id),
 'matched_offers',to_jsonb(p.matched_offers),'matched_needs',to_jsonb(p.matched_needs),
 'match_reasons',to_jsonb(array_remove(array[case when cardinality(p.matched_offers)>0 then 'Offers what you need' end,case when cardinality(p.matched_needs)>0 then 'Needs what you offer' end,case when p.location_visibility='region'and p.location_text=(select location_text from me)then 'Same general area' end,case when p.remote_available then 'Remote available' end,case when exists(select 1 from me where me.preferred_exchange_modes&&p.preferred_exchange_modes)then 'Compatible exchange modes' end,case when exists(select 1 from public.portfolio_entries pe where pe.profile_id=p.id and pe.visibility='public')then 'Has proven work' end],null)),
 'match_score',12*cardinality(p.matched_offers)+10*cardinality(p.matched_needs)+case when p.location_visibility='region'and p.location_text=(select location_text from me)then 4 else 0 end+case when p.remote_available then 2 else 0 end+case when p.availability_text is not null then 1 else 0 end+least(5,(select count(*)from public.portfolio_entries pe where pe.profile_id=p.id and pe.visibility='public'))+case when exists(select 1 from me where me.preferred_exchange_modes&&p.preferred_exchange_modes)then 3 else 0 end
) profile,
coalesce((select jsonb_agg(to_jsonb(c)||jsonb_build_object('canonical',public.canonical_skill(c.label)))from public.capabilities c where c.profile_id=p.id),'[]'::jsonb),
coalesce((select jsonb_agg(to_jsonb(pe)order by pe.published_at desc)from public.portfolio_entries pe where pe.profile_id=p.id and pe.visibility='public'),'[]'::jsonb),
coalesce((select jsonb_agg(to_jsonb(rv)order by rv.created_at desc)from public.work_reviews rv where rv.subject_id=p.id),'[]'::jsonb)
from candidates p order by 12*cardinality(p.matched_offers)+10*cardinality(p.matched_needs) desc,p.created_at desc limit 50;
$$;
revoke all on table public.skill_aliases from anon,authenticated;
grant execute on function public.canonical_skill(text),public.discover_profiles(text,text,boolean) to anon,authenticated;
