insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('work-evidence', 'work-evidence', false, 10485760, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "participants upload work evidence" on storage.objects for insert to authenticated with check (
  bucket_id = 'work-evidence' and exists (
    select 1 from public.work_agreements a
    where a.id = ((storage.foldername(name))[1])::uuid and auth.uid() in (a.requester_id, a.provider_id)
  )
);
create policy "participants read work evidence" on storage.objects for select to authenticated using (
  bucket_id = 'work-evidence' and exists (
    select 1 from public.work_agreements a
    where a.id = ((storage.foldername(name))[1])::uuid and auth.uid() in (a.requester_id, a.provider_id)
  )
);
create policy "uploader removes work evidence" on storage.objects for delete to authenticated using (
  bucket_id = 'work-evidence' and owner_id = auth.uid()::text
);

grant insert on public.work_evidence to authenticated;

drop function public.get_my_agreements();
create function public.get_my_agreements()
returns table (
  agreement jsonb, request jsonb, offer jsonb, milestones jsonb, holds jsonb,
  obligations jsonb, evidence jsonb, reviews jsonb
)
language sql stable security definer set search_path = public
as $$
  select to_jsonb(a), to_jsonb(r), to_jsonb(o),
    coalesce((select jsonb_agg(to_jsonb(m) order by m.position) from public.milestones m where m.agreement_id = a.id), '[]'::jsonb),
    coalesce((select jsonb_agg(to_jsonb(h) order by h.created_at desc) from public.dependency_holds h where h.agreement_id = a.id), '[]'::jsonb),
    coalesce((select jsonb_agg(to_jsonb(ob) order by ob.id) from public.agreement_obligations ob where ob.agreement_id = a.id), '[]'::jsonb),
    coalesce((select jsonb_agg(to_jsonb(e) order by e.created_at desc) from public.work_evidence e where e.agreement_id = a.id), '[]'::jsonb),
    coalesce((select jsonb_agg(to_jsonb(rv) order by rv.created_at desc) from public.work_reviews rv where rv.agreement_id = a.id), '[]'::jsonb)
  from public.work_agreements a join public.work_requests r on r.id = a.request_id join public.trade_offers o on o.id = a.accepted_offer_id
  where auth.uid() in (a.requester_id, a.provider_id)
  order by a.accepted_at desc;
$$;
revoke all on function public.get_my_agreements() from public;
grant execute on function public.get_my_agreements() to authenticated;
