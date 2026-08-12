drop policy if exists "public profiles readable" on public.profiles;
create policy "visible profiles readable" on public.profiles for select using(profile_visibility='public' or id=auth.uid());

create or replace function public.publish_completion(target_agreement_id uuid,summary_text text,exchange_items jsonb,portfolio_title text default null,portfolio_visibility text default 'private') returns uuid language plpgsql security definer set search_path=public as $$
declare a public.work_agreements;entry_id uuid;
begin select * into a from public.work_agreements where id=target_agreement_id;if a.status<>'completed' or auth.uid() not in(a.requester_id,a.provider_id) then raise exception 'completed participant agreement required';end if;
 insert into public.completion_summaries(agreement_id,summary,exchange_breakdown,submitted_by) values(a.id,trim(summary_text),coalesce(exchange_items,'[]'::jsonb),auth.uid()) on conflict(agreement_id) do update set summary=excluded.summary,exchange_breakdown=excluded.exchange_breakdown,submitted_by=excluded.submitted_by returning id into entry_id;
 if nullif(trim(portfolio_title),'') is not null then insert into public.portfolio_entries(agreement_id,profile_id,title,summary,visibility) values(a.id,auth.uid(),trim(portfolio_title),trim(summary_text),portfolio_visibility) on conflict(agreement_id,profile_id) do update set title=excluded.title,summary=excluded.summary,visibility=excluded.visibility,published_at=now() returning id into entry_id;end if;return entry_id;end $$;
grant execute on function public.publish_completion(uuid,text,jsonb,text,text) to authenticated;

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

create or replace function public.get_network_activity() returns table(activity jsonb) language sql stable security definer set search_path=public as $$ select activity from (
 select jsonb_build_object('kind','portfolio','at',pe.published_at,'profile_id',pe.profile_id,'name',p.display_name,'title',pe.title,'summary',pe.summary,'entry_id',pe.id) activity
 from public.portfolio_entries pe join public.profiles p on p.id=pe.profile_id where pe.visibility='public' and p.is_active
 union all select jsonb_build_object('kind','request','at',r.created_at,'profile_id',r.owner_id,'name',p.display_name,'title',r.title,'summary',r.description,'request_id',r.id)
 from public.work_requests r join public.profiles p on p.id=r.owner_id where r.stage='open' and r.visibility='public' and p.is_active
 ) network_items order by (activity->>'at')::timestamptz desc limit 50 $$;
grant execute on function public.get_network_activity() to anon,authenticated;

create or replace function public.set_follow(target_profile_id uuid,should_follow boolean) returns void language plpgsql security definer set search_path=public as $$ begin if target_profile_id=auth.uid() then raise exception 'cannot follow yourself';end if;if should_follow then insert into public.follows(follower_id,followed_profile_id) values(auth.uid(),target_profile_id) on conflict do nothing;else delete from public.follows where follower_id=auth.uid() and followed_profile_id=target_profile_id;end if;end $$;
grant execute on function public.set_follow(uuid,boolean) to authenticated;
