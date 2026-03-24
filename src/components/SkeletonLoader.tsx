/**
 * components/SkeletonLoader.tsx
 *
 * Issue #44 — Add skeleton loading screens and empty state components
 * bakeronchain/learnvault
 *
 * Reusable skeleton and empty state primitives for all data-dependent pages.
 * Uses CSS pulse/shimmer animation. No external libraries.
 * Follows Stellar Design System token conventions.
 */

import React from "react"

// ─── Skeleton Base ────────────────────────────────────────────────────────────

const skeletonBase =
	"bg-white/5 rounded-2xl animate-pulse relative overflow-hidden"

const shimmer =
	"absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/5 to-transparent animate-[shimmer_2s_infinite]"

const Shimmer = () => <span className={shimmer} />

// ─── Course Card Skeleton ─────────────────────────────────────────────────────
// Used in: Course Catalog loading state

export const CourseCardSkeleton: React.FC = () => (
	<div className={`${skeletonBase} p-8 rounded-[2.5rem] border border-white/5`}>
		<Shimmer />
		<div className="w-16 h-16 bg-white/5 rounded-2xl mb-6 animate-pulse" />
		<div className="h-5 bg-white/5 rounded-full w-3/4 mb-3 animate-pulse" />
		<div className="h-4 bg-white/5 rounded-full w-full mb-2 animate-pulse" />
		<div className="h-4 bg-white/5 rounded-full w-5/6 mb-6 animate-pulse" />
		<div className="h-10 bg-white/5 rounded-2xl w-1/2 animate-pulse" />
	</div>
)

// ─── Dashboard Stats Skeleton ─────────────────────────────────────────────────
// Used in: Learner Dashboard loading state

export const DashboardStatsSkeleton: React.FC = () => (
	<div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
		{[1, 2, 3].map((i) => (
			<div
				key={i}
				className={`${skeletonBase} p-8 rounded-[2rem] border border-white/5`}
			>
				<Shimmer />
				<div className="h-4 bg-white/5 rounded-full w-1/2 mb-4 animate-pulse" />
				<div className="h-8 bg-white/5 rounded-full w-2/3 animate-pulse" />
			</div>
		))}
	</div>
)

// ─── Proposal List Skeleton ───────────────────────────────────────────────────
// Used in: DAO Voting loading state

export const ProposalListSkeleton: React.FC = () => (
	<div className="flex flex-col gap-4">
		{[1, 2, 3].map((i) => (
			<div
				key={i}
				className={`${skeletonBase} p-8 rounded-[2rem] border border-white/5 flex items-center gap-6`}
			>
				<Shimmer />
				<div className="w-12 h-12 bg-white/5 rounded-full animate-pulse flex-shrink-0" />
				<div className="flex-1">
					<div className="h-4 bg-white/5 rounded-full w-3/4 mb-3 animate-pulse" />
					<div className="h-3 bg-white/5 rounded-full w-1/2 animate-pulse" />
				</div>
				<div className="w-20 h-8 bg-white/5 rounded-2xl animate-pulse" />
			</div>
		))}
	</div>
)

// ─── Leaderboard Row Skeleton ─────────────────────────────────────────────────
// Used in: Leaderboard loading state

export const LeaderboardRowSkeleton: React.FC = () => (
	<div className="flex flex-col gap-3">
		{[1, 2, 3, 4, 5].map((i) => (
			<div
				key={i}
				className={`${skeletonBase} p-6 rounded-[1.5rem] border border-white/5 flex items-center gap-6`}
			>
				<Shimmer />
				<div className="w-8 h-4 bg-white/5 rounded-full animate-pulse" />
				<div className="w-10 h-10 bg-white/5 rounded-full animate-pulse" />
				<div className="flex-1 h-4 bg-white/5 rounded-full animate-pulse" />
				<div className="w-16 h-4 bg-white/5 rounded-full animate-pulse" />
			</div>
		))}
	</div>
)

// ─── Profile Skeleton ─────────────────────────────────────────────────────────
// Used in: Profile page loading state

export const ProfileSkeleton: React.FC = () => (
	<div className="flex flex-col">
		{/* Header */}
		<div
			className={`${skeletonBase} p-12 rounded-[3.5rem] border border-white/5 flex items-center gap-12 mb-12`}
		>
			<Shimmer />
			<div className="w-32 h-32 bg-white/5 rounded-full animate-pulse flex-shrink-0" />
			<div className="flex-1">
				<div className="h-6 bg-white/5 rounded-full w-1/3 mb-4 animate-pulse" />
				<div className="h-4 bg-white/5 rounded-full w-1/4 mb-6 animate-pulse" />
				<div className="flex gap-3">
					<div className="h-8 w-24 bg-white/5 rounded-full animate-pulse" />
					<div className="h-8 w-32 bg-white/5 rounded-full animate-pulse" />
				</div>
			</div>
		</div>
		{/* NFT Grid */}
		<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
			{[1, 2, 3, 4].map((i) => (
				<div
					key={i}
					className={`${skeletonBase} rounded-[2.5rem] border border-white/5 overflow-hidden`}
				>
					<Shimmer />
					<div className="aspect-square bg-white/5 animate-pulse" />
					<div className="p-6">
						<div className="h-4 bg-white/5 rounded-full w-3/4 mb-3 animate-pulse" />
						<div className="h-3 bg-white/5 rounded-full w-1/2 animate-pulse" />
					</div>
				</div>
			))}
		</div>
	</div>
)

// ─── Empty States ─────────────────────────────────────────────────────────────

interface EmptyStateProps {
	icon: string
	title: string
	description: string
	ctaLabel?: string
	ctaHref?: string
}

export const EmptyState: React.FC<EmptyStateProps> = ({
	icon,
	title,
	description,
	ctaLabel,
	ctaHref,
}) => (
	<div className="glass-card p-20 rounded-[4rem] text-center border border-white/5 flex flex-col items-center">
		<div className="text-6xl mb-8">{icon}</div>
		<h2 className="text-2xl font-black mb-3 tracking-tight">{title}</h2>
		<p className="text-white/40 max-w-md mx-auto mb-10 leading-relaxed font-medium">
			{description}
		</p>
		{ctaLabel && ctaHref && (
			<a
				href={ctaHref}
				className="iridescent-border px-10 py-4 rounded-2xl font-black text-sm uppercase tracking-widest hover:scale-105 active:scale-95 transition-all"
			>
				{ctaLabel}
			</a>
		)}
	</div>
)

// ─── Pre-configured Empty States ─────────────────────────────────────────────

// Issue #44 — No courses enrolled yet
export const NoCoursesEmptyState: React.FC = () => (
	<EmptyState
		icon="🎓"
		title="No courses enrolled yet"
		description="Start your learning journey on the Stellar blockchain. Earn LRN tokens and ScholarNFTs as you progress."
		ctaLabel="Start your first course"
		ctaHref="/learn"
	/>
)

// Issue #44 — No proposals active
export const NoProposalsEmptyState: React.FC = () => (
	<EmptyState
		icon="🏛️"
		title="No active proposals"
		description="The governance board is quiet. Be the first to shape the future of LearnVault."
		ctaLabel="Be the first to submit a proposal"
		ctaHref="/dao"
	/>
)

// Issue #44 — No governance tokens
export const NoTokensEmptyState: React.FC = () => (
	<EmptyState
		icon="🪙"
		title="No governance tokens"
		description="You need LRN tokens to participate in DAO voting. Donate to the treasury to receive voting power."
		ctaLabel="Donate to get voting power"
		ctaHref="/treasury"
	/>
)

// Issue #44 — No credentials earned
export const NoCredentialsEmptyState: React.FC = () => (
	<EmptyState
		icon="🏆"
		title="No credentials earned yet"
		description="Complete a learning track to earn your first ScholarNFT — a permanent, verifiable proof of your expertise on Stellar."
		ctaLabel="Complete a track to earn your first ScholarNFT"
		ctaHref="/learn"
	/>
)
