import React, { useMemo, useState } from "react"
import Pagination from "./Pagination"
import {
	useCourseRatingSummary,
	useCourseReviews,
	useUpsertCourseReview,
} from "../hooks/useCourseReviews"

const Stars = ({ value }: { value: number }) => {
	return (
		<div
			className="flex items-center gap-1"
			aria-label={`${value} star rating`}
		>
			{Array.from({ length: 5 }).map((_, idx) => (
				<span
					key={idx}
					className={idx < value ? "text-yellow-300" : "text-white/20"}
				>
					★
				</span>
			))}
		</div>
	)
}

import ErrorBoundary from "./ErrorBoundary"

export const CourseReviewsPanelContent: React.FC<{
	courseId: string
	canReview: boolean
}> = ({ courseId, canReview }) => {
	const [page, setPage] = useState(1)
	const [rating, setRating] = useState(0)
	const [text, setText] = useState("")
	const [isEditing, setIsEditing] = useState(false)
	const { data: summary } = useCourseRatingSummary(courseId)
	const reviewsQuery = useCourseReviews(courseId, page)
	const upsert = useUpsertCourseReview(courseId)

	const totalPages = useMemo(() => {
		const total = reviewsQuery.data?.total ?? 0
		const pageSize = reviewsQuery.data?.pageSize ?? 5
		return Math.max(1, Math.ceil(total / Math.max(1, pageSize)))
	}, [reviewsQuery.data?.pageSize, reviewsQuery.data?.total])

	const ownReview = reviewsQuery.data?.reviews.find((r) => r.isOwn)

	const onSubmit = async () => {
		if (rating < 1 || rating > 5) return
		if (text.length > 500) return
		await upsert.mutateAsync({ rating, text })
		setIsEditing(false)
	}

	return (
		<section className="mt-10 glass-card p-6 rounded-[1.75rem] border border-white/10">
			<div className="flex flex-wrap items-center justify-between gap-4 mb-6">
				<h3 className="text-2xl font-black">Course reviews</h3>
				<div className="text-sm text-white/60 flex items-center gap-2">
					<Stars value={Math.round(summary?.average ?? 0)} />
					<span>
						{(summary?.average ?? 0).toFixed(1)} ({summary?.count ?? 0})
					</span>
				</div>
			</div>

			{canReview && (
				<div className="mb-8 p-4 rounded-xl border border-white/10 bg-white/5">
					<p className="text-xs uppercase tracking-widest text-white/50 mb-3 font-black">
						Leave a review
					</p>
					<div className="flex items-center gap-2 mb-3">
						{Array.from({ length: 5 }).map((_, idx) => {
							const v = idx + 1
							return (
								<button
									key={v}
									type="button"
									onClick={() => setRating(v)}
									className={v <= rating ? "text-yellow-300" : "text-white/30"}
									aria-label={`Rate ${v} stars`}
								>
									★
								</button>
							)
						})}
					</div>
					<textarea
						maxLength={500}
						value={text}
						onChange={(e) => setText(e.target.value)}
						placeholder="Optional comment (max 500 chars)"
						className="w-full min-h-24 rounded-lg bg-black/20 border border-white/10 p-3 text-sm"
					/>
					<div className="mt-2 text-xs text-white/40">{text.length}/500</div>
					<div className="mt-3 flex items-center gap-2">
						<button
							type="button"
							onClick={() => void onSubmit()}
							disabled={upsert.isPending || rating < 1 || text.length > 500}
							className="px-4 py-2 rounded-full border border-brand-cyan/40 text-brand-cyan disabled:opacity-40"
						>
							{upsert.isPending
								? "Saving..."
								: ownReview && !isEditing
									? "Update review"
									: "Submit review"}
						</button>
						{ownReview && !isEditing && (
							<button
								type="button"
								onClick={() => {
									setRating(ownReview.rating)
									setText(ownReview.text)
									setIsEditing(true)
								}}
								className="px-4 py-2 rounded-full border border-white/20 text-white/80"
							>
								Edit my review
							</button>
						)}
					</div>
				</div>
			)}

			{reviewsQuery.data?.unavailable ? (
				<p className="text-sm text-white/50">
					Reviews are not available yet for this course.
				</p>
			) : (
				<>
					<div className="space-y-4">
						{(reviewsQuery.data?.reviews ?? []).map((review) => (
							<article
								key={review.id}
								className="rounded-xl border border-white/10 bg-white/5 p-4"
							>
								<div className="flex items-center justify-between gap-3 mb-2">
									<div
										className="text-xs text-white/60"
										title={review.walletAddress}
									>
										{review.walletAddress.slice(0, 6)}...
										{review.walletAddress.slice(-4)}
										{review.isOwn ? " (You)" : ""}
									</div>
									<Stars value={review.rating} />
								</div>
								<p className="text-sm text-white/75 whitespace-pre-wrap">
									{review.text || "No comment."}
								</p>
							</article>
						))}
					</div>
					{(reviewsQuery.data?.reviews?.length ?? 0) > 0 && (
						<div className="mt-6">
							<Pagination
								page={page}
								totalPages={totalPages}
								onPageChange={setPage}
							/>
						</div>
					)}
				</>
			)}
		</section>
	)
}

export const CourseReviewsPanel: React.FC<{
	courseId: string
	canReview: boolean
}> = (props) => (
	<ErrorBoundary>
		<CourseReviewsPanelContent {...props} />
	</ErrorBoundary>
)

export default CourseReviewsPanel
