create or replace function public.redeem_pilot_invite(invite_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare chosen public.pilot_invite_codes;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if exists(select 1 from public.pilot_memberships where profile_id=auth.uid() and status='active') then return jsonb_build_object('member',true,'already_member',true); end if;
  select * into chosen from public.pilot_invite_codes where code_hash=encode(extensions.digest(upper(trim(invite_code)),'sha256'),'hex') for update;
  if chosen.id is null or chosen.disabled_at is not null or chosen.use_count >= chosen.max_uses or (chosen.expires_at is not null and chosen.expires_at <= now()) then raise exception 'invite code is invalid or no longer available'; end if;
  insert into public.pilot_memberships(profile_id,invite_id,invited_by) values(auth.uid(),chosen.id,chosen.created_by)
  on conflict(profile_id) do update set status='active',invite_id=excluded.invite_id,invited_by=excluded.invited_by,joined_at=now();
  update public.pilot_invite_codes set use_count=use_count+1 where id=chosen.id;
  return jsonb_build_object('member',true,'already_member',false);
end; $$;

create or replace function public.create_pilot_invite(invite_label text, invite_max_uses integer default 1, invite_expires_at timestamptz default null)
returns jsonb language plpgsql security definer set search_path = public as $$
declare code text; created public.pilot_invite_codes;
begin
  if not exists(select 1 from public.moderation_roles where profile_id=auth.uid() and role='admin') then raise exception 'admin authorization required'; end if;
  if char_length(trim(invite_label)) < 2 or invite_max_uses not between 1 and 1000 then raise exception 'invalid invite settings'; end if;
  code := 'WT-' || upper(replace(gen_random_uuid()::text,'-',''));
  insert into public.pilot_invite_codes(code_hash,label,max_uses,expires_at,created_by)
  values(encode(extensions.digest(code,'sha256'),'hex'),trim(invite_label),invite_max_uses,invite_expires_at,auth.uid()) returning * into created;
  return jsonb_build_object('id',created.id,'code',code,'label',created.label,'max_uses',created.max_uses,'expires_at',created.expires_at);
end; $$;
