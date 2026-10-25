-- lookup.py (the command-line rank and price lookup) calls the cryptorank-lookup Edge Function,
-- which uses the CRYPTORANK_API_KEY function secret, so the key never has to be on a laptop.
-- The function is public, so this table caps its CryptoRank use at a daily credit budget that
-- leaves room for the price sync (about 305 credits a day of the free plan's 400). Server-only,
-- like market_sync: RLS on, no policies, no grants to anon or authenticated.
create table cpa.cryptorank_lookup_usage (
  day          date primary key default current_date,
  credits_used integer not null default 0 check (credits_used >= 0)
);
alter table cpa.cryptorank_lookup_usage enable row level security;
revoke all on cpa.cryptorank_lookup_usage from public, anon, authenticated;
grant select, insert, update, delete on cpa.cryptorank_lookup_usage to service_role;

comment on table cpa.cryptorank_lookup_usage is
  'CryptoRank credits spent by the cryptorank-lookup Edge Function (lookup.py) per UTC day. Server-only.';

-- Spends one credit from today's budget; false when the budget is used up. Called by the Edge
-- Function (service role) before each CryptoRank request.
create or replace function cpa.spend_lookup_credit(daily_limit integer) returns boolean
language plpgsql security invoker set search_path = '' as $$
declare
  spent boolean;
begin
  if daily_limit is null or daily_limit < 1 then
    return false;
  end if;
  delete from cpa.cryptorank_lookup_usage where day < current_date - 30;
  insert into cpa.cryptorank_lookup_usage as u (day, credits_used)
  values (current_date, 1)
  on conflict (day) do update set credits_used = u.credits_used + 1
  where u.credits_used < daily_limit
  returning true into spent;
  return coalesce(spent, false);
end;
$$;
revoke execute on function cpa.spend_lookup_credit(integer) from public, anon, authenticated;
grant execute on function cpa.spend_lookup_credit(integer) to service_role;
