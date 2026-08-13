insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values(
 'message-attachments','message-attachments',false,10485760,
 array['image/jpeg','image/png','image/webp','application/pdf','text/plain','application/msword','application/vnd.openxmlformats-officedocument.wordprocessingml.document']
) on conflict(id) do nothing;

create table public.message_attachments(
 id uuid primary key default gen_random_uuid(),
 message_id uuid not null references public.introduction_messages(id) on delete cascade,
 invitation_id uuid not null references public.collaboration_invitations(id) on delete cascade,
 uploader_id uuid not null references public.profiles(id),
 asset_path text not null unique,
 file_name text not null check(char_length(file_name) between 1 and 180),
 mime_type text not null,
 byte_size bigint not null check(byte_size between 1 and 10485760),
 created_at timestamptz not null default now()
);
alter table public.message_attachments enable row level security;
create policy "conversation participants read attachments" on public.message_attachments for select using(exists(select 1 from public.collaboration_invitations i where i.id=invitation_id and auth.uid() in(i.sender_id,i.recipient_id)));
grant select on public.message_attachments to authenticated;

create policy "participants upload message objects" on storage.objects for insert to authenticated with check(bucket_id='message-attachments' and exists(select 1 from public.collaboration_invitations i where i.id=((storage.foldername(name))[1])::uuid and i.status in('accepted','converted') and auth.uid() in(i.sender_id,i.recipient_id)));
create policy "participants read message objects" on storage.objects for select to authenticated using(bucket_id='message-attachments' and exists(select 1 from public.collaboration_invitations i where i.id=((storage.foldername(name))[1])::uuid and auth.uid() in(i.sender_id,i.recipient_id)));
create policy "uploaders delete message objects" on storage.objects for delete to authenticated using(bucket_id='message-attachments' and owner_id=auth.uid()::text);

create or replace function public.send_message_with_attachment(target_invitation_id uuid,message_body text,attachment_path text,attachment_name text,attachment_type text,attachment_size bigint) returns uuid language plpgsql security definer set search_path=public as $$
declare new_id uuid;other_id uuid;
begin
 select case when sender_id=auth.uid() then recipient_id else sender_id end into other_id from public.collaboration_invitations where id=target_invitation_id and status in('accepted','converted') and auth.uid() in(sender_id,recipient_id);
 if other_id is null then raise exception 'accepted conversation required';end if;
 if attachment_size not between 1 and 10485760 or attachment_path not like target_invitation_id::text||'/'||auth.uid()::text||'/%' then raise exception 'invalid attachment';end if;
 insert into public.introduction_messages(invitation_id,author_id,body) values(target_invitation_id,auth.uid(),coalesce(nullif(trim(message_body),''),'Shared an attachment')) returning id into new_id;
 insert into public.message_attachments(message_id,invitation_id,uploader_id,asset_path,file_name,mime_type,byte_size) values(new_id,target_invitation_id,auth.uid(),attachment_path,left(attachment_name,180),attachment_type,attachment_size);
 perform public.notify_user(other_id,'network','New introduction message',(select display_name from public.profiles where id=auth.uid())||' sent a private message.');
 return new_id;
end$$;

create or replace function public.get_network_inbox() returns jsonb language sql stable security definer set search_path=public as $$select jsonb_build_object(
 'invitations',coalesce((select jsonb_agg((to_jsonb(i)||jsonb_build_object('sender_name',s.display_name,'recipient_name',r.display_name,'workspace',to_jsonb(w),'member_state',to_jsonb(ms),'other_read_at',oms.last_read_at,'unread_count',(select count(*) from public.introduction_messages m where m.invitation_id=i.id and m.author_id<>auth.uid() and m.created_at>coalesce(ms.last_read_at,'epoch'::timestamptz)))) order by coalesce((select max(m.created_at) from public.introduction_messages m where m.invitation_id=i.id),i.created_at) desc) from public.collaboration_invitations i join public.profiles s on s.id=i.sender_id join public.profiles r on r.id=i.recipient_id left join public.introduction_workspaces w on w.invitation_id=i.id left join public.conversation_member_state ms on ms.invitation_id=i.id and ms.profile_id=auth.uid() left join public.conversation_member_state oms on oms.invitation_id=i.id and oms.profile_id<>auth.uid() where auth.uid() in(i.sender_id,i.recipient_id)),'[]'::jsonb),
 'messages',coalesce((select jsonb_agg((to_jsonb(m)||jsonb_build_object('author_name',p.display_name)) order by m.created_at) from public.introduction_messages m join public.profiles p on p.id=m.author_id join public.collaboration_invitations i on i.id=m.invitation_id where i.status in('accepted','converted') and auth.uid() in(i.sender_id,i.recipient_id)),'[]'::jsonb),
 'attachments',coalesce((select jsonb_agg(to_jsonb(a) order by a.created_at) from public.message_attachments a join public.collaboration_invitations i on i.id=a.invitation_id where auth.uid() in(i.sender_id,i.recipient_id)),'[]'::jsonb),
 'saved_profiles',coalesce((select jsonb_agg(profile_id) from public.saved_profiles where owner_id=auth.uid()),'[]'::jsonb),
 'saved_searches',coalesce((select jsonb_agg(to_jsonb(x) order by created_at desc) from public.saved_searches x where owner_id=auth.uid()),'[]'::jsonb)
)$$;

do $$begin if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='introduction_messages') then alter publication supabase_realtime add table public.introduction_messages;end if;end$$;
revoke all on function public.send_message_with_attachment(uuid,text,text,text,text,bigint) from public,anon;
grant execute on function public.send_message_with_attachment(uuid,text,text,text,text,bigint) to authenticated;
