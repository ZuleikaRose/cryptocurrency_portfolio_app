-- Guests (anon) can send support tickets, issue reports and feedback without an account
-- (17-customer-support.md, 19-report-issue.md, 20-feedback.md). Bound what they can write.

-- 1. Length and shape limits that match the forms; a guest can't store unbounded text.
alter table cpa.support_tickets
  add constraint support_tickets_id_format check (id ~ '^(CPA-[0-9]+|BUG-[0-9]{4,})$'),
  add constraint support_tickets_subject_length check (char_length(subject) between 1 and 140),
  add constraint support_tickets_message_length check (message is null or char_length(message) <= 2000),
  add constraint support_tickets_email_length check (email is null or char_length(email::text) <= 254),
  add constraint support_tickets_page_length check (page is null or char_length(page) <= 200),
  add constraint support_tickets_steps_length check (steps is null or char_length(steps) <= 2000),
  add constraint support_tickets_expected_length check (expected is null or char_length(expected) <= 1000),
  add constraint support_tickets_actual_length check (actual is null or char_length(actual) <= 1000),
  add constraint support_tickets_assistive_length check (assistive_tech is null or char_length(assistive_tech) <= 200),
  add constraint support_tickets_technical_length check (technical is null or char_length(technical) <= 1000),
  -- A PNG or JPEG data URL under 2 MB (base64 is 4/3 the size, plus the prefix).
  add constraint support_tickets_screenshot_format check (
    screenshot_url is null
    or (screenshot_url ~ '^data:image/(png|jpeg);base64,[A-Za-z0-9+/=]+$' and char_length(screenshot_url) <= 2796300)
  );

-- 2. Callers choose only the fields the forms send; status and created_at keep their defaults.
revoke insert on cpa.support_tickets from anon, authenticated;
grant insert (id, user_id, kind, topic, subject, message, email, page, steps, expected, actual,
  assistive_tech, severity, technical, screenshot_url) on cpa.support_tickets to anon, authenticated;
revoke insert on cpa.feedback from anon, authenticated;
grant insert (user_id, rating, area, body, may_contact) on cpa.feedback to anon, authenticated;

-- 3. A ticket ID must already have been issued by next_ticket_id(), so nobody can claim a
--    future number and make a later sender's insert fail.
create or replace function cpa.check_ticket_id() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  issued bigint;
begin
  if new.id like 'BUG-%' then
    select last_value into issued from cpa.issue_report_seq;
  else
    select last_value into issued from cpa.support_ticket_seq;
  end if;
  if substring(new.id from 5)::bigint > issued then
    raise exception 'Unknown ticket ID.' using errcode = 'check_violation';
  end if;
  return new;
end;
$$;
revoke execute on function cpa.check_ticket_id() from public, anon, authenticated;
create trigger support_tickets_issued_id before insert on cpa.support_tickets
  for each row execute function cpa.check_ticket_id();
