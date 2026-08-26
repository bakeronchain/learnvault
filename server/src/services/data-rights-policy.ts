import { SECONDARY_DATA_RELATIONS } from "./data-rights-policy-secondary"
import { type DataRelation } from "./data-rights-policy.types"

/**
 * Learner identifiers enumerated from server/src/db/migrations.
 * There is no users table: wallet addresses are the account identifier.
 */
export const DATA_RELATIONS: readonly DataRelation[] = [
	{
		table: "milestone_reports",
		identifiers: ["scholar_address"],
		deletion: "erase",
		description: "Milestone submissions",
	},
	{
		table: "milestone_audit_log",
		identifiers: ["validator_address"],
		deletion: "anonymise",
		description: "Milestone validation audit records",
	},
	{
		table: "ipfs_uploads",
		identifiers: ["uploader_address"],
		deletion: "erase",
		description: "Uploaded content metadata",
	},
	{
		table: "course_assets",
		identifiers: ["uploaded_by"],
		deletion: "erase",
		description: "Course assets uploaded by the learner",
	},
	{
		table: "proposal_documents",
		identifiers: ["uploader_address"],
		deletion: "erase",
		description: "Proposal documents uploaded by the learner",
	},
	{
		table: "comments",
		identifiers: ["author_address"],
		deletion: "anonymise",
		description: "Governance comments",
	},
	{
		table: "comment_votes",
		identifiers: ["voter_address"],
		deletion: "erase",
		description: "Comment votes",
	},
	{
		table: "proposals",
		identifiers: ["author_address"],
		deletion: "anonymise",
		description: "Governance proposals",
	},
	{
		table: "scholar_balances",
		identifiers: ["address"],
		deletion: "anonymise",
		description: "Aggregate LRN balance",
	},
	{
		table: "scholar_nfts",
		identifiers: ["scholar_address"],
		deletion: "anonymise",
		description: "Public on-chain credential mirror",
	},
	{
		table: "votes",
		identifiers: ["voter_address"],
		deletion: "anonymise",
		description: "Governance votes",
	},
	{
		table: "enrollments",
		identifiers: ["learner_address"],
		deletion: "erase",
		description: "Course enrollments",
	},
	{
		table: "delegation_events",
		identifiers: ["delegator", "delegatee"],
		deletion: "anonymise",
		description: "Public governance delegations",
	},
	{
		table: "escrow_timeouts",
		identifiers: ["scholar_address"],
		deletion: "erase",
		description: "Scholarship escrow reminders and contact details",
	},
	{
		table: "flagged_content",
		identifiers: ["reporter_address"],
		deletion: "erase",
		description: "Content reports",
	},
	{
		table: "flag_audit_log",
		identifiers: ["actor_address"],
		deletion: "anonymise",
		description: "Moderation audit records",
	},
	{
		table: "user_profiles",
		identifiers: ["address", "stellar_address"],
		deletion: "erase",
		description: "Profile and contact details",
	},
	{
		table: "bookmarks",
		identifiers: ["address"],
		deletion: "erase",
		description: "Course bookmarks",
	},
	{
		table: "forum_threads",
		identifiers: ["author_address"],
		deletion: "anonymise",
		description: "Forum threads authored by the learner",
	},
	{
		table: "forum_replies",
		identifiers: ["author_address"],
		deletion: "anonymise",
		description: "Forum replies authored by the learner",
	},
	{
		table: "scholarship_contributions",
		identifiers: ["donor_address"],
		deletion: "anonymise",
		description: "Public scholarship contributions",
	},
	{
		table: "follows",
		identifiers: ["follower_address", "following_address"],
		deletion: "erase",
		description: "Social follow relationships",
	},
	{
		table: "linked_wallets",
		identifiers: ["stellar_address"],
		deletion: "erase",
		description: "Linked wallet addresses",
	},
	{
		table: "course_reviews",
		identifiers: ["learner_address"],
		deletion: "anonymise",
		description: "Course reviews",
	},
	{
		table: "milestone_peer_reviews",
		identifiers: ["reviewer_address"],
		deletion: "anonymise",
		description: "Milestone peer reviews",
	},
	{
		table: "sponsor_organizations",
		identifiers: ["wallet_address"],
		deletion: "erase",
		description: "Sponsor profile details",
	},
	{
		table: "scholar_regions",
		identifiers: ["learner_address"],
		deletion: "erase",
		description: "Learner region",
	},
	{
		table: "sponsor_license_grants",
		identifiers: ["recipient_wallet_address"],
		deletion: "erase",
		description: "Sponsored access grants",
	},
	{
		table: "notifications",
		identifiers: ["recipient_address"],
		deletion: "erase",
		description: "Notifications",
	},
	{
		table: "notification_push_subscriptions",
		identifiers: ["recipient_address"],
		deletion: "erase",
		description: "Push notification subscriptions",
	},
	{
		table: "notification_preferences",
		identifiers: ["recipient_address"],
		deletion: "erase",
		description: "Notification preferences",
	},
	{
		table: "notification_delivery_log",
		identifiers: ["recipient_address"],
		deletion: "erase",
		description: "Notification delivery history",
	},
	{
		table: "proposal_amendments",
		identifiers: ["author_address"],
		deletion: "anonymise",
		description: "Governance proposal amendments",
	},
	{
		table: "mentor_profiles",
		identifiers: ["address"],
		deletion: "erase",
		description: "Mentor profile",
	},
	{
		table: "mentorship_requests",
		identifiers: ["scholar_address", "mentor_address"],
		deletion: "erase",
		description: "Mentorship requests",
	},
	...SECONDARY_DATA_RELATIONS,
] as const

export type { DataRelation, DeletionPolicy } from "./data-rights-policy.types"
