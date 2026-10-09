-- UCR and RCR per run. Only 'assertion' rows count: questions and
-- reflections are not claims, and counting them would flatter the score.
create view run_claim_metrics as
select
  r.id as run_id,
  r.belief_id,
  r.condition,
  count(*) filter (where a.kind = 'assertion')                             as total_claims,
  count(*) filter (where a.kind = 'assertion' and a.supported is not true) as unsupported_claims,
  count(*) filter (where a.kind = 'assertion' and a.relevant_to_reason)    as relevant_claims,
  count(*) filter (where a.blocked)                                        as blocked_claims,
  round(
    count(*) filter (where a.kind = 'assertion' and a.supported is not true)::numeric
    / nullif(count(*) filter (where a.kind = 'assertion'), 0), 4
  ) as ucr,
  round(
    count(*) filter (where a.kind = 'assertion' and a.relevant_to_reason)::numeric
    / nullif(count(*) filter (where a.kind = 'assertion'), 0), 4
  ) as rcr
from runs r
left join turns t on t.run_id = r.id
left join assertions a on a.turn_id = t.id
group by r.id, r.belief_id, r.condition;

-- Belief movement at each timepoint, against baseline, for the target item only.
create view belief_deltas as
with base as (
  select belief_id, score
  from measures
  where timepoint = 'baseline' and item = 'target'
)
select
  m.belief_id,
  m.timepoint,
  base.score as baseline_score,
  m.score    as score,
  m.score - base.score as delta,
  m.collected_by,
  m.collected_at
from measures m
join base on base.belief_id = m.belief_id
where m.item = 'target' and m.timepoint <> 'baseline';

-- Control items drifting as much as the target = answer-style drift, not belief change.
create view control_drift as
select
  belief_id,
  item,
  max(score) filter (where timepoint = 'baseline') as baseline_score,
  max(score) filter (where timepoint = 'delayed')  as delayed_score,
  max(score) filter (where timepoint = 'delayed')
    - max(score) filter (where timepoint = 'baseline') as delta
from measures
where item <> 'target'
group by belief_id, item;
