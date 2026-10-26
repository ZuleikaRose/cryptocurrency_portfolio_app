-- Portfolio remembers its chart range, holdings sort and tax-lot method (prompt.md clarification 35, journey rule 2).
alter table cpa.user_settings
  add column portfolio_range text not null default '1M' check (portfolio_range in ('24h', '7D', '1M', '3M', '1Y', 'ALL')),
  add column portfolio_sort text not null default 'value' check (portfolio_sort in ('value', 'pnl', 'pnlPct', 'name')),
  add column portfolio_tax_method text not null default 'fifo' check (portfolio_tax_method in ('fifo', 'average'));
comment on column cpa.user_settings.portfolio_range is 'Portfolio value chart range (11-portfolio.md).';
comment on column cpa.user_settings.portfolio_sort is 'Portfolio holdings sort: value, pnl, pnlPct or name.';
comment on column cpa.user_settings.portfolio_tax_method is 'Tax-lot report cost basis method: fifo or average (lib/taxlots.js).';
