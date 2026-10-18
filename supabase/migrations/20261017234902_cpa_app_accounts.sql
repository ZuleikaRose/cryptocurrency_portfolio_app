-- App accounts on Supabase (phase 2): simulated billing, account deletion and data removal.

-- Billing in CPA is simulated (test cards only). Its state is the user's to write; the real
-- cpa.subscriptions / billing_history stay server-only for a future payment provider.
alter table cpa.user_state add column simulated_billing jsonb not null default '{}'::jsonb;
comment on column cpa.user_state.simulated_billing is
  'Simulated plan, payment methods and billing history (16-account-settings.md). Not an entitlement.';

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
