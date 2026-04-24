# Database Index Strategy

This document tracks query-path decisions for API performance and the indexes that back them.

## Primary Query Paths

1. `courses` catalog and lesson loading
- Query path: course list joins `enrollments`, course detail joins `lessons/milestones/quizzes`.
- Supporting indexes:
  - `idx_lessons_course_id`
  - `idx_milestones_course_id`
  - `idx_milestones_lesson_id`
  - `idx_quiz_questions_quiz_id`
  - `idx_enrollments_course_id`

2. Scholar milestone reports and moderation
- Query path: filter by `scholar_address`, `course_id`, `status`, sorted by `submitted_at`.
- Supporting indexes:
  - `idx_milestone_reports_scholar_status_submitted`
  - `idx_milestone_reports_course_status_submitted`
  - `idx_milestone_reports_status_submitted`
  - `idx_milestone_audit_report_decided_at`

3. Governance proposals and voting
- Query path: proposal list by status/date, per-proposal vote lookup, proposal status checks.
- Supporting indexes:
  - `idx_proposals_status_created_at`
  - `idx_proposals_created_at`
  - `idx_proposals_cancelled_status_deadline`
  - `idx_votes_proposal_id`
  - `idx_votes_voter_address`

4. Treasury/activity/event surfaces
- Query path: recent events by contract/event type/date.
- Supporting indexes:
  - `idx_events_contract_event_ledger`
  - `idx_events_contract_type`
  - `idx_events_contract_created_at`
  - `idx_events_created_at`

5. Enrollments, comments, and leaderboard
- Query path: learner enrollments by recency, comments feed per proposal, leaderboard rank paging.
- Supporting indexes:
  - `idx_enrollments_learner_address`
  - `idx_enrollments_learner_enrolled_at`
  - `idx_comments_proposal_created_at`
  - `idx_scholar_balances_lrn_desc`

## N+1 Query Mitigations

1. Scholar milestones now fetch latest audit decisions in one batched query using `DISTINCT ON (report_id)`.
2. Governance proposals now join viewer vote (`votes`) directly instead of per-row scalar subqueries.

## Query Analysis Workflow

1. Generate explain report:
```bash
cd server
npm run db:query:analyze
```
2. Read generated report:
- `docs/database/query-analysis.md`

## pg_stat_statements Monitoring

1. Enable extension at database level (DBA task):
```sql
CREATE EXTENSION IF NOT EXISTS pg_stat_statements;
```
2. Inspect runtime snapshot in API:
- `GET /api/health/db/performance`
3. Server startup logs top statements when available.
