-- Additions for the participant-facing web app. Additive only: no existing
-- column, row or view changes meaning.

-- A run is reached through an unguessable link, not a login. The token is the
-- only thing a participant's browser ever holds.
alter table public.runs add column if not exists access_token text unique;

-- The exact wording of every item on the 0–100 scale, in the order shown.
-- [{"item": "target", "text": "..."}, {"item": "C1", "text": "..."}]
-- Stored once so the same words are asked at every timepoint.
alter table public.beliefs add column if not exists instrument jsonb not null default '[]'::jsonb;

-- Which gate attempt a claim came from, and whether it reached the participant.
-- Claims blocked in a rejected draft are logged too: they are the evidence the
-- gate did something.
alter table public.assertions add column if not exists attempt integer not null default 0;
alter table public.assertions add column if not exists sent boolean not null default false;

-- run_claim_metrics counts every drafted claim, so its UCR is the PRE-gate rate:
-- how often the drafter produced something unsupported. This view counts only
-- what reached the participant, so its UCR is the POST-gate rate, which should
-- be 0. Report both: the gap between them is what the gate is for.
create or replace view public.sent_claim_metrics with (security_invoker = true) as
select
  r.id as run_id,
  r.belief_id,
  r.condition,
  count(*) filter (where a.kind = 'assertion' and a.sent) as total_claims,
  count(*) filter (where a.kind = 'assertion' and a.sent and a.supported is not true) as unsupported_claims,
  count(*) filter (where a.kind = 'assertion' and a.sent and a.relevant_to_reason) as relevant_claims,
  round(
    (count(*) filter (where a.kind = 'assertion' and a.sent and a.supported is not true))::numeric
    / nullif(count(*) filter (where a.kind = 'assertion' and a.sent), 0)::numeric, 4) as ucr,
  round(
    (count(*) filter (where a.kind = 'assertion' and a.sent and a.relevant_to_reason))::numeric
    / nullif(count(*) filter (where a.kind = 'assertion' and a.sent), 0)::numeric, 4) as rcr
from public.runs r
left join public.turns t on t.run_id = r.id
left join public.assertions a on a.turn_id = t.id
group by r.id, r.belief_id, r.condition;
