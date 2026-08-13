create table public.conversation_member_state(
  invitation_id uuid not null references public.collaboration_invitations(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  last_read_at timestamptz,
  archived_at timestamptz,
  muted boolean not null default false,
  primary key(invitation_id,profile_id)
);
alter table public.conversation_member_state enable row level security;
create policy "members manage own conversation state" on public.conversation_member_state for all using(profile_id=auth.uid()) with check(profile_id=auth.uid());

create or replace function public.manage_conversation(target_invitation_id uuid,requested_action text) returns void language plpgsql security definer set search_path=public as $$
begin
  if not exists(select 1 from public.collaboration_invitations where id=target_invitation_id and auth.uid() in(sender_id,recipient_id)) then raise exception 'conversation participant required';end if;
  insert into public.conversation_member_state(invitation_id,profile_id) values(target_invitation_id,auth.uid()) on conflict do nothing;
  if requested_action='read' then update public.conversation_member_state set last_read_at=now() where invitation_id=target_invitation_id and profile_id=auth.uid();
  elsif requested_action='archive' then update public.conversation_member_state set archived_at=now() where invitation_id=target_invitation_id and profile_id=auth.uid();
  elsif requested_action='restore' then update public.conversation_member_state set archived_at=null where invitation_id=target_invitation_id and profile_id=auth.uid();
  elsif requested_action='mute' then update public.conversation_member_state set muted=true where invitation_id=target_invitation_id and profile_id=auth.uid();
  elsif requested_action='unmute' then update public.conversation_member_state set muted=false where invitation_id=target_invitation_id and profile_id=auth.uid();
  else raise exception 'unsupported conversation action';end if;
end$$;

create or replace function public.get_network_inbox() returns jsonb language sql stable security definer set search_path=public as $$select jsonb_build_object(
 'invitations',coalesce((select jsonb_agg((to_jsonb(i)||jsonb_build_object('sender_name',s.display_name,'recipient_name',r.display_name,'workspace',to_jsonb(w),'member_state',to_jsonb(ms),'unread_count',(select count(*) from public.introduction_messages m where m.invitation_id=i.id and m.author_id<>auth.uid() and m.created_at>coalesce(ms.last_read_at,'epoch'::timestamptz)))) order by coalesce((select max(m.created_at) from public.introduction_messages m where m.invitation_id=i.id),i.created_at) desc) from public.collaboration_invitations i join public.profiles s on s.id=i.sender_id join public.profiles r on r.id=i.recipient_id left join public.introduction_workspaces w on w.invitation_id=i.id left join public.conversation_member_state ms on ms.invitation_id=i.id and ms.profile_id=auth.uid() where auth.uid() in(i.sender_id,i.recipient_id)),'[]'::jsonb),
 'messages',coalesce((select jsonb_agg((to_jsonb(m)||jsonb_build_object('author_name',p.display_name)) order by m.created_at) from public.introduction_messages m join public.profiles p on p.id=m.author_id join public.collaboration_invitations i on i.id=m.invitation_id where i.status in('accepted','converted') and auth.uid() in(i.sender_id,i.recipient_id)),'[]'::jsonb),
 'saved_profiles',coalesce((select jsonb_agg(profile_id) from public.saved_profiles where owner_id=auth.uid()),'[]'::jsonb),
 'saved_searches',coalesce((select jsonb_agg(to_jsonb(x) order by created_at desc) from public.saved_searches x where owner_id=auth.uid()),'[]'::jsonb)
)$$;

revoke all on function public.manage_conversation(uuid,text) from public,anon;
grant execute on function public.manage_conversation(uuid,text) to authenticated;
