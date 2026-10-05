-- Open access: anyone can take part without logging in. A participant is
-- found by a random key their browser keeps; only its SHA-256 is stored, so
-- the table never holds anything that would let someone resume another
-- person's journey.
alter table participants add column if not exists key_hash text unique;
create index if not exists beliefs_created_at_idx on beliefs (created_at);
create index if not exists participants_created_at_idx on participants (created_at);
