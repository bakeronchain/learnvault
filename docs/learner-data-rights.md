<!-- Generated: 2026-08-25 17:03:10 UTC -->

# Learner data export and account deletion

LearnVault identifies an account by its Stellar address. The migrations do not
define a central `users` table or foreign keys to one, so export and erasure
must inspect every migration-defined address column explicitly. The executable
source of truth is `server/src/services/data-rights-policy.ts`; this document
explains the policy that maintainers must review when migrations add tables.

## Self-service flow

- `POST /api/me/export` creates an asynchronous export job.
- `GET /api/me/export/:id` returns only the authenticated owner's job status and
  a 15-minute signed download URL when ready.
- The worker creates a gzip-compressed tar containing `README.txt` and one JSON
  file per relation. Missing tables or address columns produce an empty file,
  which supports installations that began from either historical profile schema.
- `DELETE /api/me` requires the exact phrase `DELETE MY ACCOUNT` and a newly
  signed SEP-10 challenge from the same wallet.
- Erasure is scheduled 30 days later. `POST /api/me/deletion/cancel` cancels it;
  successful wallet login also cancels a pending request.
- A completed deletion writes a hashed subject identifier to the admin-visible
  `account_deletion_audit_log`. The raw wallet address is not retained there.

Email notification is sent when an existing contact email can be resolved from
the scholarship reminder data. The current schema has no canonical account
email, so the worker does not fabricate one and export completion remains
visible in account settings.

## Per-table policy

**Erase** removes off-chain personal data, authentication material, contact
details, preferences, and private learner activity:

- `milestone_reports`, `ipfs_uploads`, `course_assets`, `proposal_documents`,
  `comment_votes`, `enrollments`, `escrow_timeouts`, `flagged_content`,
  `user_profiles`, `bookmarks`, `follows`, `linked_wallets`,
  `sponsor_organizations`, `scholar_regions`, `sponsor_license_grants`,
  `notifications`, `notification_push_subscriptions`,
  `notification_preferences`, `notification_delivery_log`, `mentor_profiles`,
  `mentorship_requests`, `identity_verifications`, `mentor_bookings`,
  `mentor_availability`, `mentors`, `learner_streaks`, `streak_activity`,
  `referrals`, `passkey_credentials`, `anchor_withdrawals`, `translator_grants`,
  and `pending_dispute_evidence`.

**Anonymise** preserves content or public/aggregate records that other users,
auditors, or ledger reconciliation depend on, while replacing every matching
address with a one-way deletion pseudonym:

- `milestone_audit_log`, `comments`, `proposals`, `scholar_balances`,
  `scholar_nfts`, `votes`, `delegation_events`, `flag_audit_log`,
  `forum_threads`, `forum_replies`, `scholarship_contributions`,
  `course_reviews`, `milestone_peer_reviews`, `proposal_amendments`,
  `provider_completions`, `lrn_burns`, `certificates`, `qf_contributions`,
  `bounties`, `bounty_submissions`, `escrows`, `sponsored_accounts`,
  `sponsor_spend_log`, `course_translations`, `lesson_translations`,
  `treasury_deposits`, `disputes`, `dispute_jurors`, and `dispute_votes`.

Forum threads and replies therefore remain readable for conversational context,
but no longer identify the learner. Public on-chain LRN transfers, minted
ScholarNFTs, treasury transactions, governance activity, and their indexed facts
cannot be removed from Stellar; the UI discloses this before confirmation.

## Migration inventory notes

The inventory was derived from every forward migration through migration 032.
Those migrations do **not** define standalone lesson-progress or quiz-submission
tables. LearnVault currently records enrollment in `enrollments` and submitted
milestone work in `milestone_reports`; the export includes both. When a future
migration adds a user-keyed table or address column, it must add a policy entry
and extend the all-relations deletion test before release.
