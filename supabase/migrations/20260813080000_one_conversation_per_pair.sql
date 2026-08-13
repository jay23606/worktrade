do $$
declare pair record;keeper uuid;duplicate record;keeper_status text;
begin
 for pair in
  select least(sender_id::text,recipient_id::text) a,greatest(sender_id::text,recipient_id::text) b
  from public.collaboration_invitations where status in('pending','accepted','converted')
  group by 1,2 having count(*)>1
 loop
  select id,status into keeper,keeper_status from public.collaboration_invitations
  where least(sender_id::text,recipient_id::text)=pair.a and greatest(sender_id::text,recipient_id::text)=pair.b and status in('pending','accepted','converted')
  order by case status when'converted'then 0 when'accepted'then 1 else 2 end,created_at,id limit 1 for update;

  for duplicate in select * from public.collaboration_invitations where id<>keeper and least(sender_id::text,recipient_id::text)=pair.a and greatest(sender_id::text,recipient_id::text)=pair.b and status in('pending','accepted','converted') order by created_at
  loop
   if nullif(trim(duplicate.note),'') is not null then
    insert into public.introduction_messages(invitation_id,author_id,body,created_at)
    values(keeper,duplicate.sender_id,duplicate.note,duplicate.created_at);
   end if;
   update public.introduction_messages set invitation_id=keeper where invitation_id=duplicate.id;
   update public.message_attachments set invitation_id=keeper where invitation_id=duplicate.id;
   insert into public.conversation_member_state(invitation_id,profile_id,last_read_at,archived_at,muted)
    select keeper,profile_id,last_read_at,archived_at,muted from public.conversation_member_state where invitation_id=duplicate.id
    on conflict(invitation_id,profile_id)do update set
     last_read_at=greatest(conversation_member_state.last_read_at,excluded.last_read_at),
     archived_at=case when conversation_member_state.archived_at is null or excluded.archived_at is null then null else greatest(conversation_member_state.archived_at,excluded.archived_at)end,
     muted=conversation_member_state.muted and excluded.muted;
   delete from public.conversation_member_state where invitation_id=duplicate.id;
   if not exists(select 1 from public.introduction_workspaces where invitation_id=keeper)then
    update public.introduction_workspaces set invitation_id=keeper where invitation_id=duplicate.id;
   else
    delete from public.introduction_workspaces where invitation_id=duplicate.id;
   end if;
   if duplicate.status='converted'then keeper_status='converted';elsif duplicate.status='accepted'and keeper_status='pending'then keeper_status='accepted';end if;
   update public.collaboration_invitations set request_id=coalesce(request_id,duplicate.request_id),converted_request_id=coalesce(converted_request_id,duplicate.converted_request_id)where id=keeper;
   delete from public.collaboration_invitations where id=duplicate.id;
  end loop;
  update public.collaboration_invitations set status=keeper_status,responded_at=case when keeper_status<>'pending'then coalesce(responded_at,now())else responded_at end where id=keeper;
 end loop;
end$$;

alter table public.collaboration_invitations add column conversation_pair text generated always as
(least(sender_id::text,recipient_id::text)||':'||greatest(sender_id::text,recipient_id::text))stored;
create unique index one_live_conversation_per_pair on public.collaboration_invitations(conversation_pair)
where status in('pending','accepted','converted');
