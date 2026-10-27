-- Coin detail's Markets table remembers its sort (prompt.md clarification 37, journey rule 2).
alter table cpa.user_settings
  add column coin_markets_sort text not null default 'volume' check (coin_markets_sort in ('exchange', 'price', 'volume', 'share')),
  add column coin_markets_dir text not null default 'desc' check (coin_markets_dir in ('asc', 'desc'));
comment on column cpa.user_settings.coin_markets_sort is 'Coin detail Markets table sort column (03-coin-detail.md).';
comment on column cpa.user_settings.coin_markets_dir is 'Coin detail Markets table sort direction: asc or desc.';
