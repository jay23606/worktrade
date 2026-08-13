alter table public.profiles
add column location_visibility text not null default 'region'
check(location_visibility in('region','members','private'));

alter table public.saved_searches
add column discovery_mode text not null default 'either' check(discovery_mode in('nearby','remote','either')),
add column radius_km integer check(radius_km between 1 and 1000),
add column availability_filter text,
add column sort_order text not null default 'fit' check(sort_order in('fit','distance','availability','newest')),
add column alerts_enabled boolean not null default true;

create or replace function public.save_network_search_v2(search_name text,search_query text,exchange_value text,discovery_value text,radius_value integer,availability_value text,sort_value text,alerts_value boolean)
returns uuid language plpgsql security definer set search_path=public as $$declare new_id uuid;begin
 insert into public.saved_searches(owner_id,name,query,exchange_filter,remote_only,discovery_mode,radius_km,availability_filter,sort_order,alerts_enabled)
 values(auth.uid(),trim(search_name),coalesce(search_query,''),nullif(exchange_value,''),discovery_value='remote',coalesce(nullif(discovery_value,''),'either'),radius_value,nullif(availability_value,''),coalesce(nullif(sort_value,''),'fit'),alerts_value)
 returning id into new_id;return new_id;end$$;
revoke all on function public.save_network_search_v2(text,text,text,text,integer,text,text,boolean) from public;
grant execute on function public.save_network_search_v2(text,text,text,text,integer,text,text,boolean) to authenticated;

create or replace function public.set_my_profile(payload jsonb) returns public.profiles language plpgsql security definer set search_path=public as $$ declare result public.profiles;item text;begin if auth.uid() is null then raise exception 'authentication required';end if;update public.profiles set display_name=trim(payload->>'display_name'),location_text=nullif(trim(payload->>'location_text'),''),bio=nullif(trim(payload->>'bio'),''),work_radius_km=nullif(payload->>'work_radius_km','')::integer,remote_available=coalesce((payload->>'remote_available')::boolean,remote_available),preferred_exchange_modes=coalesce(array(select jsonb_array_elements_text(payload->'preferred_exchange_modes')::public.exchange_mode),preferred_exchange_modes),availability_text=nullif(trim(payload->>'availability_text'),''),resources_text=nullif(trim(payload->>'resources_text'),''),profile_visibility=coalesce(nullif(payload->>'profile_visibility',''),profile_visibility),location_visibility=coalesce(nullif(payload->>'location_visibility',''),location_visibility) where id=auth.uid() returning * into result;
 delete from public.capabilities where profile_id=auth.uid();for item in select jsonb_array_elements_text(coalesce(payload->'needs','[]'::jsonb))loop insert into public.capabilities(profile_id,direction,label)values(auth.uid(),'need',trim(item));end loop;for item in select jsonb_array_elements_text(coalesce(payload->'offers','[]'::jsonb))loop insert into public.capabilities(profile_id,direction,label)values(auth.uid(),'offer',trim(item));end loop;return result;end$$;

create or replace function public.discover_profiles(search_text text default '',exchange_filter text default null,remote_only boolean default false)
returns table(profile jsonb,capabilities jsonb,portfolio jsonb,reviews jsonb) language sql stable security definer set search_path=public as $$
 select (to_jsonb(p)-'deactivated_at'-'location_text')||jsonb_build_object(
  'location_text',case when p.location_visibility='region' or p.id=auth.uid() then p.location_text else null end,
  'location_band',case when p.location_visibility<>'region' then 'Location private' when p.location_text is not null and p.location_text=(select location_text from public.profiles where id=auth.uid()) then 'Same general area' else 'Different or unknown area' end,
  'following',exists(select 1 from public.follows f where f.follower_id=auth.uid() and f.followed_profile_id=p.id),
  'completed_count',(select count(*) from public.work_agreements a where a.status='completed' and p.id in(a.requester_id,a.provider_id)),
  'review_count',(select count(*) from public.work_reviews rv where rv.subject_id=p.id),
  'match_score',(10*(select count(*) from public.capabilities theirs join public.capabilities mine on mine.profile_id=auth.uid() and mine.direction='need' where theirs.profile_id=p.id and theirs.direction='offer' and lower(theirs.label)=lower(mine.label))+8*(select count(*) from public.capabilities theirs join public.capabilities mine on mine.profile_id=auth.uid() and mine.direction='offer' where theirs.profile_id=p.id and theirs.direction='need' and lower(theirs.label)=lower(mine.label))+case when p.location_visibility='region' and p.location_text is not null and p.location_text=(select location_text from public.profiles where id=auth.uid())then 4 else 0 end+case when p.remote_available then 2 else 0 end+case when p.availability_text is not null and p.availability_text<>'' then 1 else 0 end+least(5,(select count(*) from public.portfolio_entries pe where pe.profile_id=p.id and pe.visibility='public'))+case when exists(select 1 from public.profiles me where me.id=auth.uid() and me.preferred_exchange_modes&&p.preferred_exchange_modes)then 3 else 0 end)
 ) profile,
 coalesce((select jsonb_agg(to_jsonb(c))from public.capabilities c where c.profile_id=p.id),'[]'::jsonb),coalesce((select jsonb_agg(to_jsonb(pe)order by pe.published_at desc)from public.portfolio_entries pe where pe.profile_id=p.id and pe.visibility='public'),'[]'::jsonb),coalesce((select jsonb_agg(to_jsonb(rv)order by rv.created_at desc)from public.work_reviews rv where rv.subject_id=p.id),'[]'::jsonb)
 from public.profiles p where p.is_active and p.profile_visibility='public' and(not remote_only or p.remote_available)and(exchange_filter is null or exchange_filter::public.exchange_mode=any(p.preferred_exchange_modes))and(coalesce(search_text,'')=''or p.display_name ilike'%'||search_text||'%'or p.bio ilike'%'||search_text||'%'or exists(select 1 from public.capabilities c where c.profile_id=p.id and c.label ilike'%'||search_text||'%'))
 order by ((10*(select count(*) from public.capabilities theirs join public.capabilities mine on mine.profile_id=auth.uid() and mine.direction='need' where theirs.profile_id=p.id and theirs.direction='offer' and lower(theirs.label)=lower(mine.label)))+(8*(select count(*) from public.capabilities theirs join public.capabilities mine on mine.profile_id=auth.uid() and mine.direction='offer' where theirs.profile_id=p.id and theirs.direction='need' and lower(theirs.label)=lower(mine.label)))) desc,p.created_at desc limit 50$$;
grant execute on function public.discover_profiles(text,text,boolean) to anon,authenticated;
