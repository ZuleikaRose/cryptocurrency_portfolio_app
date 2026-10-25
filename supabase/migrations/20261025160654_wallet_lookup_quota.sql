-- Read-only wallet import (US-6.4, 11-portfolio.md): the wallet-lookup Edge Function reads a
-- public Bitcoin or Ethereum address's balances from block explorers. This table rate-limits it
-- per signed-in user and per caller IP, so the function can't be used to spend the explorers'
-- free quotas. Server-only, like market_sync: RLS on, no policies, no grants to anon or
-- authenticated. IPs are stored only as a SHA-256 hash, and rows expire with their window.
create table cpa.wallet_lookup_quota (
  bucket       text primary key check (bucket ~ '^(user:[0-9a-f-]{36}|ip:[0-9a-f]{64})$'),
  window_start timestamptz not null default now(),
  used         integer not null default 0 check (used >= 0)
);
alter table cpa.wallet_lookup_quota enable row level security;
revoke all on cpa.wallet_lookup_quota from public, anon, authenticated;
grant select, insert, update, delete on cpa.wallet_lookup_quota to service_role;
-- No index beyond the primary key: rows live at most an hour, so the expiry delete scans a
-- handful of rows.

comment on table cpa.wallet_lookup_quota is
  'Rate limit for the wallet-lookup Edge Function (US-6.4): lookups per user or hashed IP per hour. Server-only.';
comment on column cpa.wallet_lookup_quota.bucket is 'user:<auth uid> or ip:<sha-256 of the caller IP>.';

-- Counts one lookup against each bucket and returns false when any is over its limit for the
-- current hour. Called only by the Edge Function (service role).
create or replace function cpa.claim_wallet_lookup(buckets text[], limits integer[]) returns boolean
language plpgsql security invoker set search_path = '' as $$
declare
  i integer;
  count_now integer;
  allowed boolean := true;
begin
  if array_length(buckets, 1) is null or array_length(buckets, 1) <> array_length(limits, 1) then
    raise exception 'buckets and limits must be the same length';
  end if;
  delete from cpa.wallet_lookup_quota where window_start < now() - interval '1 hour';
  for i in 1 .. array_length(buckets, 1) loop
    insert into cpa.wallet_lookup_quota as q (bucket, window_start, used)
    values (buckets[i], now(), 1)
    on conflict (bucket) do update set used = q.used + 1
    returning q.used into count_now;
    if count_now > limits[i] then
      allowed := false;
    end if;
  end loop;
  return allowed;
end;
$$;
revoke execute on function cpa.claim_wallet_lookup(text[], integer[]) from public, anon, authenticated;
grant execute on function cpa.claim_wallet_lookup(text[], integer[]) to service_role;
