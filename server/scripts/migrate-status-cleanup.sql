-- Migration: Clean up unused member statuses
-- Description: Remove legacy statuses (pending_signer, email_verified, pending_application)
--              and update database CHECK constraint
-- Date: 2026-02-03

-- Step 1: Update members stuck in unused statuses to pending_id_verification
UPDATE members
SET status = 'pending_id_verification'
WHERE status IN ('pending_application', 'email_verified', 'pending_signer');

-- Step 2: Drop old CHECK constraint
ALTER TABLE members DROP CONSTRAINT IF EXISTS members_status_check;

-- Step 3: Add new CHECK constraint with only valid statuses
ALTER TABLE members ADD CONSTRAINT members_status_check
  CHECK (status IN (
    'pending_id_verification',
    'pending_application_review',
    'approved_application',
    'denied_application',
    'active_member'
  ));

-- Verify migration
SELECT status, COUNT(*) as count
FROM members
GROUP BY status
ORDER BY status;
