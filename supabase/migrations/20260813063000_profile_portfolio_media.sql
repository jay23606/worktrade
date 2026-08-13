alter table public.profiles add column avatar_path text;
alter table public.portfolio_entries add column asset_path text;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values('profile-media','profile-media',false,5242880,array['image/jpeg','image/png','image/webp'])
on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;

create policy "members upload own profile media" on storage.objects for insert to authenticated
with check(bucket_id='profile-media' and (storage.foldername(name))[1]=auth.uid()::text);
create policy "owners manage profile media" on storage.objects for delete to authenticated
using(bucket_id='profile-media' and owner_id=auth.uid()::text);
create policy "visible profile media readable" on storage.objects for select
using(bucket_id='profile-media' and exists(
 select 1 from public.profiles p where p.id=((storage.foldername(name))[1])::uuid and
 (p.id=auth.uid() or p.profile_visibility='public') and
 (p.avatar_path=name or exists(select 1 from public.portfolio_entries pe where pe.profile_id=p.id and pe.asset_path=name and (pe.visibility='public' or pe.profile_id=auth.uid())))
));

create or replace function public.set_profile_avatar(asset_path_value text) returns text language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null then raise exception 'authentication required';end if;
 if asset_path_value is not null and asset_path_value not like auth.uid()::text||'/avatar/%' then raise exception 'invalid avatar path';end if;
 update public.profiles set avatar_path=asset_path_value where id=auth.uid();
 return asset_path_value;
end$$;

create or replace function public.set_portfolio_image(entry_id uuid,asset_path_value text) returns text language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null then raise exception 'authentication required';end if;
 if asset_path_value is not null and asset_path_value not like auth.uid()::text||'/portfolio/'||entry_id::text||'/%' then raise exception 'invalid portfolio path';end if;
 update public.portfolio_entries set asset_path=asset_path_value where id=entry_id and profile_id=auth.uid();
 if not found then raise exception 'portfolio entry not found';end if;
 return asset_path_value;
end$$;
revoke all on function public.set_profile_avatar(text),public.set_portfolio_image(uuid,text) from public;
grant execute on function public.set_profile_avatar(text),public.set_portfolio_image(uuid,text) to authenticated;
