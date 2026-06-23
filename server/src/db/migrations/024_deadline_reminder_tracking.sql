-- ============================================================
-- Migration 024: Voting deadline reminder tracking
-- ============================================================

-- Tracks which reminder thresholds have been sent for each proposal.
-- Level 0 = no reminder sent
-- Level 1 = 24h reminder sent
-- Level 2 = 1h reminder sent
ALTER TABLE proposals
    ADD COLUMN IF NOT EXISTS deadline_reminder_level INTEGER NOT NULL DEFAULT 0;

-- Add the new notification type preference columns
ALTER TABLE notification_preferences
    ADD COLUMN IF NOT EXISTS voting_deadline_reminder BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE notification_preferences
    ADD COLUMN IF NOT EXISTS email_voting_deadline_reminder BOOLEAN NOT NULL DEFAULT FALSE;
