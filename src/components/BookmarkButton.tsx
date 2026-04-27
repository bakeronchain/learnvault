import { Heart } from "lucide-react"
import React from "react"

import { useBookmarks } from "../hooks/useBookmarks"

interface BookmarkButtonProps {
	courseId: string
	className?: string
}

/**
 * Heart-icon toggle button. Renders nothing when no wallet is connected
 * (bookmarks require auth). Filled heart = bookmarked, outline = not.
 */
const BookmarkButton: React.FC<BookmarkButtonProps> = ({
	courseId,
	className = "",
}) => {
	const { address, isBookmarked, toggleBookmark, isToggling } = useBookmarks()

	if (!address) return null

	const active = isBookmarked(courseId)

	// Each BookmarkButton calls `useBookmarks()` for itself, so each rendered
	// button instance gets its own `useMutation` state. That means
	// `isToggling` only reflects this specific button instance's in-flight
	// toggle and only disables THIS heart, preventing double-click races on
	// the same course without freezing other hearts.
	// The shared part is the React Query cache for bookmark data, which is
	// what makes optimistic updates appear across every visible button
	// immediately.
	return (
		<button
			type="button"
			onClick={(e) => {
				// Don't let the click bubble to a parent card link
				e.preventDefault()
				e.stopPropagation()
				toggleBookmark(courseId)
			}}
			disabled={isToggling}
			aria-label={active ? "Remove bookmark" : "Bookmark this course"}
			aria-pressed={active}
			className={`inline-flex items-center justify-center rounded-full p-2 backdrop-blur-md border transition-all active:scale-90 disabled:opacity-70 disabled:cursor-wait ${
				active
					? "bg-brand-cyan/20 border-brand-cyan/40 text-brand-cyan"
					: "bg-black/30 border-white/10 text-white/60 hover:text-white hover:border-white/30"
			} ${className}`}
		>
			<Heart
				className="w-4 h-4"
				fill={active ? "currentColor" : "none"}
				strokeWidth={2}
			/>
		</button>
	)
}

export default BookmarkButton
