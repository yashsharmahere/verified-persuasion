-- What automatic sourcing found and why each quote was kept or rejected, so a
-- "not enough sources" can be diagnosed from the data, not the server logs.
alter table beliefs add column if not exists sourcing_log jsonb;
