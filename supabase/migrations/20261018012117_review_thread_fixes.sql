-- Keep account access and deletion behavior aligned with the account status.
create or replace function cpa.is_active_user() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from cpa.users
    where id = (select auth.uid()) and status = 'active'
  );
$$;
revoke execute on function cpa.is_active_user() from public, anon;
grant execute on function cpa.is_active_user() to authenticated;

do $$
declare t text;
begin
  foreach t in array array['user_interest_coins', 'user_interest_sectors', 'watchlist_items',
    'recent_coins', 'recent_searches', 'sentiment_votes', 'transactions', 'fund_follows',
    'project_follows', 'saved_filters', 'price_alerts', 'reminders', 'notifications',
    'payment_methods', 'affiliates']
  loop
    execute format('drop policy if exists "Users read their own %s" on cpa.%I', t, t);
    execute format('drop policy if exists "Users add their own %s" on cpa.%I', t, t);
    execute format('drop policy if exists "Users change their own %s" on cpa.%I', t, t);
    execute format('drop policy if exists "Users delete their own %s" on cpa.%I', t, t);
    execute format('create policy "Users read their own %s" on cpa.%I for select to authenticated using (cpa.is_active_user() and (select auth.uid()) = user_id)', t, t);
    execute format('create policy "Users add their own %s" on cpa.%I for insert to authenticated with check (cpa.is_active_user() and (select auth.uid()) = user_id)', t, t);
    execute format('create policy "Users change their own %s" on cpa.%I for update to authenticated using (cpa.is_active_user() and (select auth.uid()) = user_id) with check (cpa.is_active_user() and (select auth.uid()) = user_id)', t, t);
    execute format('create policy "Users delete their own %s" on cpa.%I for delete to authenticated using (cpa.is_active_user() and (select auth.uid()) = user_id)', t, t);
  end loop;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['user_settings', 'user_state']
  loop
    execute format('drop policy if exists "Users read their own %s" on cpa.%I', t, t);
    execute format('drop policy if exists "Users change their own %s" on cpa.%I', t, t);
    execute format('create policy "Users read their own %s" on cpa.%I for select to authenticated using (cpa.is_active_user() and (select auth.uid()) = user_id)', t, t);
    execute format('create policy "Users change their own %s" on cpa.%I for update to authenticated using (cpa.is_active_user() and (select auth.uid()) = user_id) with check (cpa.is_active_user() and (select auth.uid()) = user_id)', t, t);
  end loop;
end;
$$;

do $$
declare t text;
begin
  foreach t in array array['subscriptions', 'promo_redemptions', 'billing_history']
  loop
    execute format('drop policy if exists "Users read their own %s" on cpa.%I', t, t);
    execute format('create policy "Users read their own %s" on cpa.%I for select to authenticated using (cpa.is_active_user() and (select auth.uid()) = user_id)', t, t);
  end loop;
end;
$$;

-- Deleted users can still read their profile status for the removal flow, but cannot edit it.
drop policy if exists "Users change their own profile" on cpa.users;
create policy "Users change their own profile" on cpa.users for update to authenticated
  using (cpa.is_active_user() and (select auth.uid()) = id)
  with check (cpa.is_active_user() and (select auth.uid()) = id);

drop policy if exists "Users send tickets" on cpa.support_tickets;
drop policy if exists "Users read their own tickets" on cpa.support_tickets;
create policy "Users send tickets" on cpa.support_tickets for insert to authenticated
  with check (cpa.is_active_user() and (user_id is null or (select auth.uid()) = user_id));
create policy "Users read their own tickets" on cpa.support_tickets for select to authenticated
  using (cpa.is_active_user() and (select auth.uid()) = user_id);

drop policy if exists "Users send feedback" on cpa.feedback;
drop policy if exists "Users read their own feedback" on cpa.feedback;
create policy "Users send feedback" on cpa.feedback for insert to authenticated
  with check (cpa.is_active_user() and (user_id is null or (select auth.uid()) = user_id));
create policy "Users read their own feedback" on cpa.feedback for select to authenticated
  using (cpa.is_active_user() and (select auth.uid()) = user_id);

create or replace function cpa.limit_saved_filters() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not exists (
    select 1 from cpa.saved_filters where user_id = new.user_id and id = new.id
  ) and (select count(*) from cpa.saved_filters where user_id = new.user_id) >= 10 then
    raise exception 'You can save up to 10 filters. Delete one to save another.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create or replace function cpa.next_ticket_id(kind text) returns text
language plpgsql set search_path = '' as $$
declare
  sequence_value text;
begin
  if kind = 'issue' then
    sequence_value := nextval('cpa.issue_report_seq')::text;
    return 'BUG-' || lpad(sequence_value, greatest(4, length(sequence_value)), '0');
  end if;
  return 'CPA-' || nextval('cpa.support_ticket_seq')::text;
end;
$$;

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
  delete from cpa.support_tickets where user_id = uid;
  delete from cpa.feedback where user_id = uid;
  insert into cpa.support_log (ticket_id) values (ticket);
  delete from auth.users where id = uid;
  return ticket;
end;
$$;
revoke execute on function cpa.erase_my_data() from public, anon;
grant execute on function cpa.erase_my_data() to authenticated;
