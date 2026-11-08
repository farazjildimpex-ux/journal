-- Contacts: company logo (small image, saved from the Contacts page). Safe to run again.
alter table contact_book add column if not exists logo text;
