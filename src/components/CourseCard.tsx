import React from "react"
import { useTranslation } from "react-i18next"
import { Button, Card } from "@stellar/design-system"
import styles from "./CourseCard.module.css"
import type { } from "react"

interface CourseCardProps {
	id: string
	title: string
	description: string
	difficulty: "beginner" | "intermediate" | "advanced"
	estimatedHours: number
	lrnReward: number
	lessonCount: number
	coverImage?: string
	isEnrolled?: boolean
	onEnroll?: () => void
}

const CourseCard: React.FC<CourseCardProps> = ({
	title,
	description,
	difficulty,
	estimatedHours,
	lrnReward,
	lessonCount,
	coverImage,
	isEnrolled = false,
	onEnroll,
}) => {
  const { t } = useTranslation()
	const difficultyConfig: Record<
		CourseCardProps["difficulty"],
		{ label: string; className: string }
	> = {
		beginner: {
			label: t('difficulty.beginner'),
			className: styles.badgeBeginner ?? "",
		},
		intermediate: {
			label: t('difficulty.intermediate'),
			className: styles.badgeIntermediate ?? "",
		},
		advanced: {
			label: t('difficulty.advanced'),
			className: styles.badgeAdvanced ?? "",
		},
	}

	const difficultyData = difficultyConfig[difficulty]

	return (
		<div className={styles.cardWrapper}>
			<Card>
				{coverImage ? (
					<img src={coverImage} alt={title} className={styles.coverImage} />
				) : (
					<div className={styles.coverPlaceholder}>
						{title.charAt(0).toUpperCase()}
					</div>
				)}

				<div className={styles.cardBody}>
					<span className={`${styles.badge} ${difficultyData.className}`}>
						{difficultyData.label}
					</span>

					<h3 className={styles.title}>{title}</h3>

					<p className={styles.description}>{description}</p>

					<div className={styles.footer}>
						<span className={styles.metrics}>
							{t('courseCard.lessons', {lessonCount, estimatedHours})}
						</span>

						<span className={styles.rewardBadge}>+{lrnReward} LRN</span>
					</div>

					<div className={styles.buttonContainer}>
						<Button
							variant={isEnrolled ? "secondary" : "primary"}
							onClick={onEnroll}
							size="md"
						>
							{isEnrolled ? t('courseCard.continue') : t('courseCard.enroll')}
						</Button>
					</div>
				</div>
			</Card>
		</div>
	)
}

export default CourseCard
