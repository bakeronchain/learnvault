# CourseMilestone Contract

## Purpose and Role

`course_milestone` tracks learner enrollment, milestone submissions, review
state, oracle verification evidence, and course completion. It is the contract
that gates when `learn_token` may mint LRN for completed work.

## Key Functions

| Function | Parameters | Access | Description |
| --- | --- | --- | --- |
| `initialize` | `admin`, `learn_token` | `admin` auth | Sets the contract admin and linked LRN token contract. |
| `add_course` | `admin`, `course_id`, `milestone_count` | stored admin | Registers an active course with a fixed milestone count. |
| `set_milestone_reward` | `course_id`, `milestone_id`, `lrn` | stored admin | Stores the LRN reward for a milestone. |
| `remove_course` | `admin`, `course_id` | stored admin | Marks an existing course inactive. |
| `set_oracle_config` | `admin`, `oracle`, `manual_fallback_enabled` | stored admin | Configures the off-chain verifier and fallback behavior. |
| `enroll` | `learner`, `course_id` | `learner` auth | Enrolls a learner into an active course once. |
| `submit_milestone` | `learner`, `course_id`, `milestone_id`, `evidence_uri` | `learner` auth | Records a milestone submission and sets state to pending. |
| `verify_milestone` | `admin`, `learner`, `course_id`, `milestone_id`, `tokens_amount` | stored admin | Approves a pending submission and mints LRN. |
| `oracle_verify_milestone` | `oracle`, `learner`, `course_id`, `milestone_id`, `tokens_amount`, `evidence_hash` | configured oracle | Approves a pending submission using oracle evidence. |
| `batch_verify_milestones` | `admin`, `submissions` | stored admin | Verifies multiple pending submissions atomically. |
| `reject_milestone` | `admin`, `learner`, `course_id`, `milestone_id` | stored admin | Rejects a pending submission and clears the stored submission. |
| `complete_milestone` | `learner`, `course_id`, `milestone_id` | stored admin | Marks completion and mints the configured reward when present. |
| `pause` / `unpause` | `admin` | stored admin | Stops or resumes mutating workflows. |
| `get_course`, `list_courses`, `is_enrolled`, `get_milestone_state`, `get_milestone_submission`, `get_enrolled_courses`, `get_oracle_config`, `get_oracle_evidence`, `is_completed`, `is_paused`, `get_version` | query args only | public read | Read-only inspection helpers. |
| `upgrade` | `new_wasm_hash` | stored admin | Upgrades the contract WASM through the shared helper. |

## Authorization Model

- `initialize` requires the supplied `admin` address to authorize once.
- Stored admin controls course configuration, milestone rewards, pause state,
  oracle configuration, admin verification flows, and upgrades.
- Learners can only enroll themselves and submit their own milestone evidence.
- The configured oracle can verify milestones only through
  `oracle_verify_milestone`.
- Reads are public.

## State Variables

| Storage Key | Meaning |
| --- | --- |
| `ADMIN` | Contract administrator address. |
| `LRN_TKN` | Linked `learn_token` contract address used for minting rewards. |
| `PAUSED` | Global kill switch for mutating operations. |
| `Course(course_id)` | Per-course config: `milestone_count` and `active` flag. |
| `CourseIds` | List of known course IDs for enumeration. |
| `MilestoneLrn(course_id, milestone_id)` | Reward amount for a milestone. |
| `Enrollment(learner, course_id)` | Whether a learner is enrolled in a course. |
| `EnrolledCourses(learner)` | List of course IDs a learner joined. |
| `MilestoneState(learner, course_id, milestone_id)` | Current status: `NotStarted`, `Pending`, `Approved`, or `Rejected`. |
| `MilestoneSubmission(learner, course_id, milestone_id)` | Submission payload with evidence URI and timestamp. |
| `Completed(learner, course_id, milestone_id)` | Completion marker for a milestone. |
| `CompletedCount(learner, course_id)` | Number of completed milestones in a course. |
| `OracleConfig` | Oracle address and whether manual fallback is allowed. |
| `OracleEvidence(learner, course_id, milestone_id)` | Stored oracle evidence hash and verification timestamp. |

## Events Emitted

- `enrolled` publishes `EnrolledEventData { learner, course_id }`.
- `submitted` publishes `SubmittedEventData { learner, course_id, evidence_uri }`.
- `ms_done` publishes `MilestoneCompleted { learner, course_id, milestone_id, lrn_reward }`.
- `course_done` publishes `CourseCompleted { learner, course_id }`.
- `course_add` publishes `CourseAdded { course_id, total_milestones, tokens_per_milestone }`.
- `orcl_ok` publishes `OracleVerificationRecorded { learner, course_id, milestone_id, evidence_hash }`.
- `contract_upgraded` is emitted by the shared upgrade helper.

## Deploy with Stellar CLI

From the repository root:

```bash
stellar contract build --package course_milestone
stellar contract deploy \
  --wasm target/wasm32v1-none/release/course_milestone.wasm \
  --source <IDENTITY> \
  --network <NETWORK>
```

Initialize after deploy by invoking `initialize(admin, learn_token)`.

## Run Tests

From the repository root:

```bash
cargo test -p course_milestone
```
