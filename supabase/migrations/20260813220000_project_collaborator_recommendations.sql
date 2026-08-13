create or replace function public.recommend_profiles_for_request(target_request_id uuid)
returns setof jsonb language sql stable security definer set search_path=public as $$
with req as(
 select r.* from public.work_requests r where r.id=target_request_id and r.owner_id=auth.uid() and r.stage='open'
),skills as(
 select public.canonical_skill(s.skill) canonical,public.skill_family(s.skill) family from public.work_request_skills s join req on req.id=s.request_id
),candidates as(
 select p.*,
  array(select distinct public.canonical_skill(c.label) from public.capabilities c join skills s on s.canonical=public.canonical_skill(c.label) where c.profile_id=p.id and c.direction='offer') exact_skills,
  array(select distinct public.skill_family(c.label) from public.capabilities c join skills s on s.family=public.skill_family(c.label) and s.canonical<>public.canonical_skill(c.label) where c.profile_id=p.id and c.direction='offer' and s.family<>'other') related_skills,
  exists(select 1 from req where req.location_visibility='region' and p.location_visibility='region' and lower(coalesce(req.location_text,''))=lower(coalesce(p.location_text,'')) and req.location_text is not null) nearby,
  exists(select 1 from req where req.exchange_modes&&p.preferred_exchange_modes) exchange_fit,
  exists(select 1 from public.portfolio_entries pe where pe.profile_id=p.id and pe.visibility='public') proven,
  coalesce((select sum(case e.event_kind when'useful'then 3 when'dismissed'then-15 when'contacted'then 2 when'proposed'then 4 else 0 end) from public.match_events e where e.viewer_id=auth.uid() and e.target_profile_id=p.id and(e.target_request_id is null or e.target_request_id=target_request_id)),0) signal
 from public.profiles p,req where p.id<>auth.uid() and p.is_active and p.profile_visibility='public'
),ranked as(
 select c.*,greatest(0,least(100,22*cardinality(exact_skills)+7*cardinality(related_skills)+case when nearby then 10 else 0 end+case when remote_available then 5 else 0 end+case when exchange_fit then 8 else 0 end+case when availability_text is not null then 5 else 0 end+case when resources_text is not null then 3 else 0 end+case when proven then 7 else 0 end+signal)) score
 from candidates c
)
select to_jsonb(r)-'exact_skills'-'related_skills'-'nearby'-'exchange_fit'-'proven'-'signal'-'location_text'||jsonb_build_object(
 'location_text',case when r.location_visibility='region'then r.location_text else null end,
 'score',r.score,'matched_skills',to_jsonb(r.exact_skills),'related_skills',to_jsonb(r.related_skills),
 'reasons',to_jsonb(array_remove(array[case when cardinality(r.exact_skills)>0 then'Matches required skills'end,case when cardinality(r.related_skills)>0 then'Has related practical skills'end,case when r.nearby then'Same general area'end,case when r.remote_available then'Open to remote work'end,case when r.exchange_fit then'Accepts this exchange type'end,case when r.availability_text is not null then'Availability provided'end,case when r.resources_text is not null then'Has tools, materials, or access'end,case when r.proven then'Has portfolio evidence'end],null)))
from ranked r
where r.score>0 and not exists(select 1 from public.match_events e where e.viewer_id=auth.uid()and e.target_request_id=target_request_id and e.target_profile_id=r.id and e.event_kind='dismissed')
order by r.score desc,r.created_at desc limit 8$$;

create or replace function public.notify_project_matches(target_request_id uuid)returns integer language plpgsql security definer set search_path=public as $$
declare item jsonb;sent integer:=0;title_value text;
begin
 select title into title_value from public.work_requests where id=target_request_id and owner_id=auth.uid()and stage='open';
 if title_value is null then raise exception'open request owner required';end if;
 for item in select public.recommend_profiles_for_request(target_request_id) loop
  exit when sent>=5;
  if (item->>'score')::integer>=30 then
   perform public.notify_user((item->>'id')::uuid,'network','Work that may fit your skills',title_value,target_request_id,null);
   sent:=sent+1;
  end if;
 end loop;
 return sent;
end$$;

revoke all on function public.recommend_profiles_for_request(uuid),public.notify_project_matches(uuid)from public,anon;
grant execute on function public.recommend_profiles_for_request(uuid),public.notify_project_matches(uuid)to authenticated;
