create or replace function public.handle_completion(target_agreement_id uuid,expected_version integer,action text)
returns public.work_agreements language plpgsql security definer set search_path=public as $$
declare a public.work_agreements;recipient uuid;
begin
 select * into a from public.work_agreements where id=target_agreement_id for update;
 if auth.uid() not in(a.requester_id,a.provider_id) then raise exception 'not a participant';end if;if a.version<>expected_version then raise exception 'agreement changed; refresh';end if;
 recipient:=case when auth.uid()=a.requester_id then a.provider_id else a.requester_id end;
 if action='request' then
  if a.status<>'active' then raise exception 'only active work can be submitted for review';end if;
  update public.work_agreements set status='review',completion_requested_by=auth.uid(),completion_requested_at=now(),completion_approved_by=null,version=version+1 where id=a.id returning * into a;
  update public.work_requests set stage='review',version=version+1,updated_at=now() where id=a.request_id;
  perform public.notify_user(recipient,'agreement','Completion approval requested','Your counterparty submitted the work and exchange for final approval.',a.request_id,a.id);
 elsif action='approve' then
  if a.status<>'review' or a.completion_requested_by=auth.uid() then raise exception 'counterparty approval required';end if;
  if exists(select 1 from public.agreement_obligations where agreement_id=a.id and status<>'fulfilled') then raise exception 'all obligations must be fulfilled first';end if;
  update public.work_agreements set status='completed',completion_approved_by=auth.uid(),completed_at=now(),version=version+1 where id=a.id returning * into a;
  update public.work_requests set stage='completed',version=version+1,updated_at=now() where id=a.request_id;
  perform public.notify_user(recipient,'agreement','Agreement completed','Your counterparty approved completion.',a.request_id,a.id);
 elsif action='return' then
  if a.status<>'review' or a.completion_requested_by=auth.uid() then raise exception 'counterparty response required';end if;
  update public.work_agreements set status='active',completion_requested_by=null,completion_requested_at=null,version=version+1 where id=a.id returning * into a;
  update public.work_requests set stage='active',version=version+1,updated_at=now() where id=a.request_id;
  perform public.notify_user(recipient,'agreement','More work requested','Your counterparty returned the agreement to active work.',a.request_id,a.id);
 else raise exception 'unsupported completion action';end if;
 insert into public.agreement_history(agreement_id,actor_id,from_status,to_status,note,version) values(a.id,auth.uid(),case when action='request' then 'active'::public.work_stage else 'review'::public.work_stage end,a.status,'Mutual completion action: '||action,a.version);return a;
end $$;
revoke all on function public.handle_completion(uuid,integer,text) from public;grant execute on function public.handle_completion(uuid,integer,text) to authenticated;

create or replace function public.add_project_update(target_request_id uuid,body_text text,update_visibility text default 'participants') returns uuid language plpgsql security definer set search_path=public as $$
declare new_id uuid;
begin
 if not exists(select 1 from public.work_requests r left join public.work_agreements a on a.request_id=r.id where r.id=target_request_id and auth.uid() in(r.owner_id,a.requester_id,a.provider_id)) then raise exception 'not a participant';end if;
 insert into public.project_updates(request_id,author_id,body,visibility) values(target_request_id,auth.uid(),trim(body_text),update_visibility) returning id into new_id;return new_id;
end $$;
grant execute on function public.add_project_update(uuid,text,text) to authenticated;
