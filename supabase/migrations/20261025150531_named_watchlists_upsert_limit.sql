-- Upserts of an existing list (rename, reorder) also fire the insert trigger: only count new lists.
create or replace function cpa.limit_watchlists() returns trigger
language plpgsql set search_path = '' as $$
begin
  if not exists (
    select 1 from cpa.watchlists where id = new.id and user_id = new.user_id
  ) and (select count(*) from cpa.watchlists where user_id = new.user_id) >= 9 then
    raise exception 'You can have up to 10 watchlists. Delete one to add another.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
