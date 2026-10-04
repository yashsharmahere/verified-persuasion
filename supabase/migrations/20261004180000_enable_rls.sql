-- Lock the tables to the server. The app only ever uses the service-role key,
-- which bypasses RLS, so enabling it with no policies blocks the public
-- (anon/authenticated) keys without changing anything the app does.
alter table public.participants enable row level security;
alter table public.beliefs      enable row level security;
alter table public.reasons      enable row level security;
alter table public.passages     enable row level security;
alter table public.runs         enable row level security;
alter table public.turns        enable row level security;
alter table public.assertions   enable row level security;
alter table public.measures     enable row level security;

-- The metric views ran with their owner's rights, which bypass RLS: with the
-- tables locked they would still have exposed scores through the views. Make
-- them run with the caller's rights instead.
alter view public.run_claim_metrics set (security_invoker = true);
alter view public.belief_deltas     set (security_invoker = true);
alter view public.control_drift     set (security_invoker = true);
