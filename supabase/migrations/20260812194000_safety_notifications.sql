alter table public.notifications
drop constraint if exists notifications_kind_check;

alter table public.notifications
add constraint notifications_kind_check
check (kind in (
  'proposal', 'message', 'agreement', 'milestone', 'hold',
  'obligation', 'review', 'system', 'network', 'safety'
));
