-- Portuguese (Brazil) joins English and Spanish (prompt.md clarification 34). lib/i18n.js.
alter table cpa.user_settings drop constraint user_settings_language_check;
alter table cpa.user_settings add constraint user_settings_language_check check (language in ('en', 'es', 'pt'));
comment on column cpa.user_settings.language is 'Interface language: en, es or pt (lib/i18n.js). Number and date formats follow it.';
