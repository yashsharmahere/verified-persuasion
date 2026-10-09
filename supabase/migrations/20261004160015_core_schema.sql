-- Verified Persuasion: core schema
-- Belief-agnostic. The belief, its reasons and its source whitelist are DATA, not code.

create table participants (
  id uuid primary key default gen_random_uuid(),
  label text not null,                  -- pseudonym, never a real name
  consented_at timestamptz,
  disclosed_ai boolean not null default false,
  notes text,
  created_at timestamptz not null default now()
);

create table beliefs (
  id uuid primary key default gen_random_uuid(),
  participant_id uuid not null references participants(id) on delete cascade,
  statement text not null,              -- the exact sentence measured, verbatim at every timepoint
  domain text not null,                 -- 'nutrition-ageing', 'personal-finance', ...
  source_whitelist text[] not null,     -- allowed domains for retrieval
  created_at timestamptz not null default now()
);

-- Why they hold it. Coded from the intake transcript. Drives retrieval.
create table reasons (
  id uuid primary key default gen_random_uuid(),
  belief_id uuid not null references beliefs(id) on delete cascade,
  code text not null,                   -- 'personal-track-record', 'family-precedent', 'source-distrust', ...
  verbatim text not null,               -- their actual words, not a paraphrase
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

-- Passages pulled from whitelisted sources. The ONLY thing a claim may rest on.
create table passages (
  id uuid primary key default gen_random_uuid(),
  belief_id uuid not null references beliefs(id) on delete cascade,
  source_name text not null,
  source_url text not null,
  source_domain text not null,
  quote text not null,                  -- verbatim text from the source
  retrieved_at timestamptz not null default now(),
  human_verified boolean not null default false,  -- true only when a person opened it and confirmed
  applies_to text                       -- population the evidence was measured on
);

-- Conditions: 'reversal' | 'brochure' | 'treatment'
create table runs (
  id uuid primary key default gen_random_uuid(),
  belief_id uuid not null references beliefs(id) on delete cascade,
  condition text not null check (condition in ('reversal','brochure','treatment')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  notes text
);

create table turns (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references runs(id) on delete cascade,
  idx int not null,
  speaker text not null check (speaker in ('system','participant')),
  drafted_text text,                    -- what the model first wrote
  sent_text text,                       -- what survived the gate and was actually shown
  redraft_count int not null default 0,
  created_at timestamptz not null default now()
);

-- One row per atomic claim. This table produces every number in the results.
create table assertions (
  id uuid primary key default gen_random_uuid(),
  turn_id uuid not null references turns(id) on delete cascade,
  claim_text text not null,
  kind text not null check (kind in ('assertion','question','reflection','connective')),
  supported boolean,                    -- entailed by a retrieved passage?
  passage_id uuid references passages(id),
  relevant_to_reason boolean,           -- answers the participant's stated reason?
  relevance_judge text,                 -- 'model' | 'human'
  blocked boolean not null default false,
  block_reason text,
  created_at timestamptz not null default now()
);

-- Belief scores. 'target' is the belief under test; 'control_*' are decoys.
create table measures (
  id uuid primary key default gen_random_uuid(),
  belief_id uuid not null references beliefs(id) on delete cascade,
  timepoint text not null check (timepoint in ('baseline','post_brochure','post_treatment','delayed')),
  item text not null default 'target',
  score int not null check (score between 0 and 100),
  open_response text,                   -- "what, if anything, changed your thinking"
  collected_by text,                    -- who collected it; matters for the delayed measure
  collected_at timestamptz not null default now()
);

create index on reasons(belief_id);
create index on passages(belief_id);
create index on turns(run_id);
create index on assertions(turn_id);
create index on measures(belief_id, timepoint);
