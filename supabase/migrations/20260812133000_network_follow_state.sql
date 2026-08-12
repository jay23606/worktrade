create or replace function public.discover_profiles(search_text text default '',exchange_filter text default null,remote_only boolean default false)
returns table(profile jsonb,capabilities jsonb,portfolio jsonb,reviews jsonb) language sql stable security definer set search_path=public as $$
 select (to_jsonb(p)-'deactivated_at')||jsonb_build_object('following',exists(select 1 from public.follows f where f.follower_id=auth.uid() and f.followed_profile_id=p.id)),
 coalesce((select jsonb_agg(to_jsonb(c)) from public.capabilities c where c.profile_id=p.id),'[]'::jsonb),
 coalesce((select jsonb_agg(to_jsonb(pe) order by pe.published_at desc) from public.portfolio_entries pe where pe.profile_id=p.id and pe.visibility='public'),'[]'::jsonb),
 coalesce((select jsonb_agg(to_jsonb(rv) order by rv.created_at desc) from public.work_reviews rv where rv.subject_id=p.id),'[]'::jsonb)
 from public.profiles p where p.is_active and p.profile_visibility='public'
 and (not remote_only or p.remote_available)
 and (exchange_filter is null or exchange_filter::public.exchange_mode=any(p.preferred_exchange_modes))
 and (coalesce(search_text,'')='' or p.display_name ilike '%'||search_text||'%' or p.bio ilike '%'||search_text||'%' or exists(select 1 from public.capabilities c where c.profile_id=p.id and c.label ilike '%'||search_text||'%'))
 order by p.created_at desc limit 50 $$;
grant execute on function public.discover_profiles(text,text,boolean) to anon,authenticated;
