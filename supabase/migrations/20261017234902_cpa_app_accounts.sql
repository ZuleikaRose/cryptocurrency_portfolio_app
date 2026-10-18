-- App accounts on Supabase (phase 2): simulated billing, account deletion and data removal.

-- Billing in CPA is simulated (test cards only). Its state is the user's to write; the real
-- cpa.subscriptions / billing_history stay server-only for a future payment provider.
alter table cpa.user_state add column simulated_billing jsonb not null default '{}'::jsonb;
comment on column cpa.user_state.simulated_billing is
  'Simulated plan, payment methods and billing history (16-account-settings.md). Not an entitlement.';

-- Deleted accounts can still read their profile status and call erase_my_data(), but cannot
-- access or change account data through the Data API.
do $$
declare t text;
begin
  foreach t in array array['user_interest_coins', 'user_interest_sectors', 'watchlist_items',
    'recent_coins', 'recent_searches', 'sentiment_votes', 'transactions', 'fund_follows',
    'project_follows', 'saved_filters', 'price_alerts', 'reminders', 'notifications',
    'payment_methods', 'affiliates']
  loop
    execute format('alter policy %I on cpa.%I using ((select auth.uid()) = user_id and exists (select 1 from cpa.users u where u.id = (select auth.uid()) and u.status = %L))',
      format('Users read their own %s', t), t, 'active');
    execute format('alter policy %I on cpa.%I with check ((select auth.uid()) = user_id and exists (select 1 from cpa.users u where u.id = (select auth.uid()) and u.status = %L))',
      format('Users add their own %s', t), t, 'active');
    execute format('alter policy %I on cpa.%I using ((select auth.uid()) = user_id and exists (select 1 from cpa.users u where u.id = (select auth.uid()) and u.status = %L)) with check ((select auth.uid()) = user_id and exists (select 1 from cpa.users u where u.id = (select auth.uid()) and u.status = %L))',
      format('Users change their own %s', t), t, 'active', 'active');
    execute format('alter policy %I on cpa.%I using ((select auth.uid()) = user_id and exists (select 1 from cpa.users u where u.id = (select auth.uid()) and u.status = %L))',
      format('Users delete their own %s', t), t, 'active');
  end loop;

  foreach t in array array['user_settings', 'user_state']
  loop
    execute format('alter policy %I on cpa.%I using ((select auth.uid()) = user_id and exists (select 1 from cpa.users u where u.id = (select auth.uid()) and u.status = %L))',
      format('Users read their own %s', t), t, 'active');
    execute format('alter policy %I on cpa.%I using ((select auth.uid()) = user_id and exists (select 1 from cpa.users u where u.id = (select auth.uid()) and u.status = %L)) with check ((select auth.uid()) = user_id and exists (select 1 from cpa.users u where u.id = (select auth.uid()) and u.status = %L))',
      format('Users change their own %s', t), t, 'active', 'active');
  end loop;

  foreach t in array array['subscriptions', 'promo_redemptions', 'billing_history']
  loop
    execute format('alter policy %I on cpa.%I using ((select auth.uid()) = user_id and exists (select 1 from cpa.users u where u.id = (select auth.uid()) and u.status = %L))',
      format('Users read their own %s', t), t, 'active');
  end loop;
end;
$$;

alter policy "Users change their own profile" on cpa.users
  using ((select auth.uid()) = id and status = 'active')
  with check ((select auth.uid()) = id and status = 'active');
alter policy "Users read their own tickets" on cpa.support_tickets
  using ((select auth.uid()) = user_id and exists (
    select 1 from cpa.users u where u.id = (select auth.uid()) and u.status = 'active'));
alter policy "Users send tickets" on cpa.support_tickets
  with check ((select auth.uid()) is not null and exists (
    select 1 from cpa.users u where u.id = (select auth.uid()) and u.status = 'active')
    and (user_id is null or (select auth.uid()) = user_id));
alter policy "Users read their own feedback" on cpa.feedback
  using ((select auth.uid()) = user_id and exists (
    select 1 from cpa.users u where u.id = (select auth.uid()) and u.status = 'active'));
alter policy "Users send feedback" on cpa.feedback
  with check ((select auth.uid()) is not null and exists (
    select 1 from cpa.users u where u.id = (select auth.uid()) and u.status = 'active')
    and (user_id is null or (select auth.uid()) = user_id));

-- Delete account (US-9.6): removes access only; data stays until the user asks to remove it.
-- users.status isn't writable through the API, so this runs as its owner for the caller only.
create or replace function cpa.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  update cpa.users set status = 'deleted', deleted_at = now()
  where id = auth.uid() and status = 'active';
end;
$$;
revoke execute on function cpa.delete_my_account() from public, anon;
grant execute on function cpa.delete_my_account() to authenticated;

-- Data removal (US-P17.2): only for the caller's own, already deleted account. Erases the auth
-- user, which cascades to every cpa row; tickets lose their link and email. The support log
-- keeps the ticket id, topic, date and status only. Returns the ticket id.
create or replace function cpa.erase_my_data() returns text
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  ticket text;
begin
  if uid is null then
    raise exception 'Sign in first.' using errcode = '42501';
  end if;
  if not exists (select 1 from cpa.users where id = uid and status = 'deleted') then
    raise exception 'Delete the account before removing its data.' using errcode = 'P0001';
  end if;
  ticket := cpa.next_ticket_id('ticket');
  update cpa.support_tickets set email = null where user_id = uid;
  insert into cpa.support_log (ticket_id) values (ticket);
  delete from auth.users where id = uid;
  return ticket;
end;
$$;
revoke execute on function cpa.erase_my_data() from public, anon;
grant execute on function cpa.erase_my_data() to authenticated;
