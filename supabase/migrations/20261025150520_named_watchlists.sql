-- Named watchlists (US-6.2, 10-watchlist.md). "Main" stays in cpa.watchlist_items; these are the
-- extra lists. Max 10 lists in all, so 9 named ones; names are 1-30 characters.

create table cpa.watchlists (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references cpa.users (id) on delete cascade,
  name       text not null check (char_length(name) between 1 and 30),
  position   integer not null,
  created_at timestamptz not null default now(),
  unique (user_id, id)
);
create index watchlists_order_idx on cpa.watchlists (user_id, position);

create table cpa.watchlist_list_coins (
  user_id      uuid not null,
  watchlist_id uuid not null,
  coin_id      text not null references cpa.coins (id) on delete cascade,
  position     integer not null,
  added_at     timestamptz not null default now(),
  primary key (user_id, watchlist_id, coin_id),
  foreign key (user_id, watchlist_id) references cpa.watchlists (user_id, id) on delete cascade
);
create index watchlist_list_coins_coin_idx on cpa.watchlist_list_coins (coin_id);

create or replace function cpa.limit_watchlists() returns trigger
language plpgsql set search_path = '' as $$
begin
  if (select count(*) from cpa.watchlists where user_id = new.user_id) >= 9 then
    raise exception 'You can have up to 10 watchlists. Delete one to add another.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
create trigger watchlists_limit before insert on cpa.watchlists for each row execute function cpa.limit_watchlists();

-- The list the Watchlist tab opens on: 'main' or a watchlists.id (journey rule 2).
alter table cpa.user_settings add column watchlist_list text not null default 'main';

do $$
declare t text;
begin
  foreach t in array array['watchlists', 'watchlist_list_coins']
  loop
    execute format('alter table cpa.%I enable row level security', t);
    execute format('grant select, insert, update, delete on cpa.%I to authenticated', t);
    execute format('create policy "Users read their own %s" on cpa.%I for select to authenticated using ((select auth.uid()) = user_id and exists (select 1 from cpa.users where id = (select auth.uid()) and status = ''active''))', t, t);
    execute format('create policy "Users add their own %s" on cpa.%I for insert to authenticated with check ((select auth.uid()) = user_id and exists (select 1 from cpa.users where id = (select auth.uid()) and status = ''active''))', t, t);
    execute format('create policy "Users change their own %s" on cpa.%I for update to authenticated using ((select auth.uid()) = user_id and exists (select 1 from cpa.users where id = (select auth.uid()) and status = ''active'')) with check ((select auth.uid()) = user_id and exists (select 1 from cpa.users where id = (select auth.uid()) and status = ''active''))', t, t);
    execute format('create policy "Users delete their own %s" on cpa.%I for delete to authenticated using ((select auth.uid()) = user_id and exists (select 1 from cpa.users where id = (select auth.uid()) and status = ''active''))', t, t);
  end loop;
end;
$$;
