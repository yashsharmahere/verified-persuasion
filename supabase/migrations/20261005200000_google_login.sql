-- Back to logins (Google, open to anyone), so the private-link key is unused.
alter table participants drop column if exists key_hash;
