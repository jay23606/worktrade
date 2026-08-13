create or replace function public.get_conversation_profile(target_profile_id uuid)returns jsonb language sql stable security definer set search_path=public as $$
select (to_jsonb(p)-'location_text'-'deactivated_at')||jsonb_build_object(
 'location_text',case when p.location_visibility='region'then p.location_text else null end,
 'location_band',case when p.location_visibility='region'then coalesce(p.location_text,'Area not listed')else'Location private'end,
 'capabilities',coalesce((select jsonb_agg(to_jsonb(c)||jsonb_build_object('canonical',public.canonical_skill(c.label),'family',public.skill_family(c.label))order by c.direction,c.label)from public.capabilities c where c.profile_id=p.id),'[]'::jsonb),
 'portfolio',coalesce((select jsonb_agg(to_jsonb(pe)order by pe.published_at desc)from public.portfolio_entries pe where pe.profile_id=p.id and pe.visibility='public'),'[]'::jsonb),
 'reviews',coalesce((select jsonb_agg(to_jsonb(r)order by r.created_at desc)from public.work_reviews r where r.subject_id=p.id),'[]'::jsonb),
 'completed_count',(select count(*)from public.work_agreements a where a.status='completed'and p.id in(a.requester_id,a.provider_id)),
 'review_count',(select count(*)from public.work_reviews r where r.subject_id=p.id)
)
from public.profiles p
where p.id=target_profile_id and p.is_active and(
 p.profile_visibility='public'or exists(select 1 from public.collaboration_invitations i where auth.uid()in(i.sender_id,i.recipient_id)and target_profile_id in(i.sender_id,i.recipient_id)and i.status in('pending','accepted','converted'))
)$$;
revoke all on function public.get_conversation_profile(uuid)from public,anon;
grant execute on function public.get_conversation_profile(uuid)to authenticated;
