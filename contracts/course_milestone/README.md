# CourseMilestone Contract

Tracks course enrollment, milestone submissions, verification, rejection, and
course completion events. Verified milestones can mint LRN through the configured
LearnToken contract.

## Authority and Trust Assumptions

- `initialize(admin, learn_token_contract)` requires `admin` authorization and
  can run once.
- Stored `ADMIN` controls course registration, milestone reward configuration,
  verification/rejection, pause state, and upgrades.
- The configured LearnToken contract is trusted to enforce mint authority and
  token accounting.

## Functions

| Function | Access | Notes |
| --- | --- | --- |
| `initialize(admin, learn_token_contract)` | Admin auth | Stores admin and LearnToken address. |
| `add_course(admin, course_id, milestone_count)` | Stored admin | Adds active course with non-zero milestone count. |
| `remove_course(admin, course_id)` | Stored admin | Marks course inactive without deleting history. |
| `set_milestone_reward(course_id, milestone_id, lrn)` | Stored admin | Sets non-negative reward for a valid active milestone. |
| `pause(admin)`, `unpause(admin)` | Stored admin | Toggles mutating learner/admin workflows. |
| `enroll(learner, course_id)` | `learner` auth | Requires active course and prevents duplicate enrollment. |
| `submit_milestone(learner, course_id, milestone_id, evidence_uri)` | `learner` auth | Requires enrollment, valid milestone ID, and no prior submission. |
| `verify_milestone(admin, learner, course_id, milestone_id, tokens_amount)` | Stored admin | Requires pending submission, valid milestone ID, and positive reward. |
| `batch_verify_milestones(admin, submissions)` | Stored admin | Atomically verifies multiple valid pending submissions. |
| `reject_milestone(admin, learner, course_id, milestone_id)` | Stored admin | Rejects a pending submission and removes evidence. |
| `complete_milestone(learner, course_id, milestone_id)` | Stored admin | Marks a valid enrolled milestone complete without minting. |
| `upgrade(new_wasm_hash)` | Stored admin | Replaces current WASM through shared upgrade helper. |
| `get_course`, `list_courses`, `is_enrolled` | Public read | Course and enrollment views. |
| `get_milestone_state`, `get_milestone_submission`, `is_completed` | Public read | Milestone state views. |
| `get_enrolled_courses`, `get_version`, `is_paused` | Public read | Learner course list, version, and pause state. |

## Audit Focus

- Admin-only verification and rejection cannot be bypassed.
- Milestone IDs are bounded by registered course configuration.
- Duplicate completion and duplicate submissions are rejected.
- Cross-contract mint call cannot leave stale local state exploitable.
