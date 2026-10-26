-- Interface language (Spanish translation, Oct 26, 2026): English or Spanish. lib/i18n.js.
alter table cpa.user_settings add column language text not null default 'en' check (language in ('en', 'es'));
comment on column cpa.user_settings.language is 'Interface language: en or es (lib/i18n.js). Number and date formats follow it.';
