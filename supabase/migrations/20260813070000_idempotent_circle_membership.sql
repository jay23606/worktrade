create or replace function public.manage_circle_membership(target_circle_id uuid,target_profile_id uuid,member_action text,new_role text default null)
returns void language plpgsql security definer set search_path=public as $$
declare mine public.circle_members;target public.circle_members;c public.circles;
begin
 select * into mine from public.circle_members where circle_id=target_circle_id and profile_id=auth.uid();
 select * into target from public.circle_members where circle_id=target_circle_id and profile_id=target_profile_id for update;
 select * into c from public.circles where id=target_circle_id;
 if mine.profile_id is null or target.profile_id is null or c.id is null then raise exception 'membership unavailable';end if;

 if member_action='accept' and target_profile_id=auth.uid() and target.status in('invited','active') then
  update public.circle_members set status='active',joined_at=coalesce(joined_at,now()) where circle_id=target_circle_id and profile_id=auth.uid() and status='invited';
 elsif member_action='decline' and target_profile_id=auth.uid() and target.status in('invited','removed') then
  update public.circle_members set status='removed' where circle_id=target_circle_id and profile_id=auth.uid() and status='invited';
 elsif member_action='leave' and target_profile_id=auth.uid() and mine.role<>'owner' and target.status in('active','removed') then
  update public.circle_members set status='removed' where circle_id=target_circle_id and profile_id=auth.uid() and status='active';
 elsif mine.status='active' and mine.role in('owner','moderator') and member_action='approve' and target.status in('requested','active') then
  update public.circle_members set status='active',joined_at=coalesce(joined_at,now()) where circle_id=target_circle_id and profile_id=target_profile_id and status='requested';
 elsif mine.status='active' and mine.role in('owner','moderator') and member_action in('decline','remove') and target.role<>'owner' and target.status in('requested','invited','active','removed') then
  update public.circle_members set status='removed' where circle_id=target_circle_id and profile_id=target_profile_id and status<>'removed';
 elsif mine.status='active' and mine.role='owner' and member_action='role' and new_role in('member','moderator') and target.role<>'owner' and target.status='active' then
  update public.circle_members set role=new_role where circle_id=target_circle_id and profile_id=target_profile_id;
 else raise exception 'membership action unavailable';end if;

 perform public.notify_user(target_profile_id,'network','Circle membership updated','Your membership in '||c.name||' is now '||(select status from public.circle_members where circle_id=target_circle_id and profile_id=target_profile_id)||'.');
end$$;
revoke all on function public.manage_circle_membership(uuid,uuid,text,text) from public,anon;
grant execute on function public.manage_circle_membership(uuid,uuid,text,text) to authenticated;
