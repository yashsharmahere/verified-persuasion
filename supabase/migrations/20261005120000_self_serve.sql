-- Self-serve journey: a participant logs in with their email, states their own
-- belief, and the system finds sources for it.

-- Who the participant is, from Supabase Auth.
alter table public.participants
  add column if not exists user_id uuid unique references auth.users (id) on delete set null,
  add column if not exists email text;

-- Where a belief is in preparation, and what the participant first typed.
alter table public.beliefs
  add column if not exists status text not null default 'ready'
    check (status in ('draft', 'sourcing', 'ready', 'no_sources')),
  add column if not exists raw_text text;

-- How a quote was verified. 'human': a person checked it against the source.
-- 'exact_match': the server downloaded the source and found the quote in it,
-- word for word. Either may be used; nothing unverified ever is.
alter table public.passages
  add column if not exists verification text not null default 'human'
    check (verification in ('human', 'exact_match'));
