create table public.pilot_invite_codes (
  id uuid primary key default gen_random_uuid(),
  code_hash text not null unique,
  label text not null check (char_length(label) between 2 and 100),
  max_uses integer not null default 1 check (max_uses between 1 and 1000),
  use_count integer not null default 0 check (use_count >= 0 and use_count <= max_uses),
  expires_at timestamptz,
  disabled_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.pilot_memberships (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  invite_id uuid references public.pilot_invite_codes(id) on delete set null,
  status text not null default 'active' check (status in ('active','paused')),
  joined_at timestamptz not null default now(),
  invited_by uuid references public.profiles(id)
);

alter table public.pilot_invite_codes enable row level security;
alter table public.pilot_memberships enable row level security;

-- Accounts that existed before the private pilot are founding members.
insert into public.pilot_memberships(profile_id)
select id from public.profiles
on conflict do nothing;

-- Initial private pilot code. Only its SHA-256 digest is stored in source control.
insert into public.pilot_invite_codes(code_hash,label,max_uses)
values ('55639759ee00111a52a295cf12824829cf555ef0fd843e84216479ba4a868865','Initial private pilot',25)
on conflict(code_hash) do nothing;

create policy "members read own pilot access"
on public.pilot_memberships for select
using (profile_id = auth.uid());

create or replace function public.get_pilot_access()
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'member', exists(select 1 from public.pilot_memberships where profile_id=auth.uid() and status='active'),
    'admin', exists(select 1 from public.moderation_roles where profile_id=auth.uid() and role='admin')
  );
$$;

create or replace function public.redeem_pilot_invite(invite_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare chosen public.pilot_invite_codes;
begin
  if auth.uid() is null then raise exception 'authentication required'; end if;
  if exists(select 1 from public.pilot_memberships where profile_id=auth.uid() and status='active') then
    return jsonb_build_object('member',true,'already_member',true);
  end if;
  select * into chosen from public.pilot_invite_codes
  where code_hash=encode(extensions.digest(upper(trim(invite_code)),'sha256'),'hex')
  for update;
  if chosen.id is null or chosen.disabled_at is not null or chosen.use_count >= chosen.max_uses
     or (chosen.expires_at is not null and chosen.expires_at <= now()) then
    raise exception 'invite code is invalid or no longer available';
  end if;
  insert into public.pilot_memberships(profile_id,invite_id,invited_by)
  values(auth.uid(),chosen.id,chosen.created_by)
  on conflict(profile_id) do update set status='active',invite_id=excluded.invite_id,invited_by=excluded.invited_by,joined_at=now();
  update public.pilot_invite_codes set use_count=use_count+1 where id=chosen.id;
  return jsonb_build_object('member',true,'already_member',false);
end;
$$;

create or replace function public.create_pilot_invite(invite_label text, invite_max_uses integer default 1, invite_expires_at timestamptz default null)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare code text; created public.pilot_invite_codes;
begin
  if not exists(select 1 from public.moderation_roles where profile_id=auth.uid() and role='admin') then
    raise exception 'admin authorization required';
  end if;
  if char_length(trim(invite_label)) < 2 or invite_max_uses not between 1 and 1000 then raise exception 'invalid invite settings'; end if;
  code := 'WT-' || upper(replace(gen_random_uuid()::text,'-',''));
  insert into public.pilot_invite_codes(code_hash,label,max_uses,expires_at,created_by)
  values(encode(extensions.digest(code,'sha256'),'hex'),trim(invite_label),invite_max_uses,invite_expires_at,auth.uid())
  returning * into created;
  return jsonb_build_object('id',created.id,'code',code,'label',created.label,'max_uses',created.max_uses,'expires_at',created.expires_at);
end;
$$;

create or replace function public.set_pilot_invite_enabled(target_invite_id uuid, enabled boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists(select 1 from public.moderation_roles where profile_id=auth.uid() and role='admin') then
    raise exception 'admin authorization required';
  end if;
  update public.pilot_invite_codes set disabled_at=case when enabled then null else now() end where id=target_invite_id;
  if not found then raise exception 'invite unavailable'; end if;
end;
$$;

create or replace function public.get_pilot_dashboard()
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not exists(select 1 from public.moderation_roles where profile_id=auth.uid() and role='admin') then
    raise exception 'admin authorization required';
  end if;
  return jsonb_build_object(
    'metrics',jsonb_build_object(
      'members',(select count(*) from public.pilot_memberships where status='active'),
      'open_work',(select count(*) from public.work_requests where stage in ('open','proposed','agreed','scheduled','active','review')),
      'stalled',(select count(*) from public.work_requests r where r.stage in ('agreed','scheduled','active','review') and (r.updated_at < now()-interval '7 days' or exists(select 1 from public.work_agreements a join public.dependency_holds h on h.agreement_id=a.id where a.request_id=r.id and h.resolved_at is null and h.review_at < now()))),
      'open_reports',(select count(*) from public.safety_reports where status in ('submitted','reviewing')),
      'email_pending',(select count(*) from public.email_outbox where status in ('pending','processing')),
      'email_failed',(select count(*) from public.email_outbox where status='failed')
    ),
    'recent_members',coalesce((select jsonb_agg(x order by x.joined_at desc) from (select m.profile_id,p.display_name,m.status,m.joined_at from public.pilot_memberships m join public.profiles p on p.id=m.profile_id order by m.joined_at desc limit 12)x),'[]'::jsonb),
    'invites',coalesce((select jsonb_agg(to_jsonb(i)-'code_hash' order by i.created_at desc) from public.pilot_invite_codes i),'[]'::jsonb)
  );
end;
$$;

revoke all on function public.get_pilot_access(), public.redeem_pilot_invite(text), public.create_pilot_invite(text,integer,timestamptz), public.set_pilot_invite_enabled(uuid,boolean), public.get_pilot_dashboard() from public;
grant execute on function public.get_pilot_access(), public.redeem_pilot_invite(text), public.create_pilot_invite(text,integer,timestamptz), public.set_pilot_invite_enabled(uuid,boolean), public.get_pilot_dashboard() to authenticated;
