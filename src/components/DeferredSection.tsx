import { type ReactNode, useEffect, useRef, useState } from "react"

interface DeferredSectionProps {
	children: ReactNode
	fallback: ReactNode
	rootMargin?: string
	className?: string
}

/**
 * Defers expensive sections until they are about to enter the viewport.
 * This keeps the initial route focused on above-the-fold content first.
 */
const DeferredSection = ({
	children,
	fallback,
	rootMargin = "240px",
	className = "",
}: DeferredSectionProps) => {
	const [isVisible, setIsVisible] = useState(false)
	const containerRef = useRef<HTMLDivElement | null>(null)

	useEffect(() => {
		if (isVisible || !containerRef.current) return

		const observer = new IntersectionObserver(
			(entries) => {
				if (!entries[0]?.isIntersecting) return
				setIsVisible(true)
				observer.disconnect()
			},
			{ rootMargin },
		)

		observer.observe(containerRef.current)

		return () => observer.disconnect()
	}, [isVisible, rootMargin])

	return (
		<div ref={containerRef} className={className}>
			{isVisible ? children : fallback}
		</div>
	)
}

export default DeferredSection
