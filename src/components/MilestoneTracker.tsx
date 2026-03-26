import React, { useState } from "react"
import { useTranslation } from "react-i18next"
import { useCourse } from "../hooks/useCourse"
import styles from "./MilestoneTracker.module.css"
import TxHashLink from "./TxHashLink"

export interface Milestone {
	id: number
	label: string
	lrnReward: number
}

interface MilestoneTrackerProps {
	courseId: string
	milestones: Milestone[]
}

function MilestoneStep({
	courseId,
	milestone,
}: {
	courseId: string
	milestone: Milestone
}) {
	const { getCourseProgress, completeMilestone, isCompletingMilestone } =
		useCourse()
	const progress = getCourseProgress(courseId)
	const isCompleted = progress.completedMilestoneIds.includes(milestone.id)
	const hasPrevious =
		milestone.id <= 1 ||
		progress.completedMilestoneIds.includes(milestone.id - 1)
	const status = isCompleted
		? "completed"
		: hasPrevious
			? "in_progress"
			: "locked"
	const txHash: string | undefined = undefined
	const { t, i18n } = useTranslation()

	const [isCompleting, setIsCompleting] = useState(false)

	const handleComplete = async () => {
		if (status !== "in_progress") return

		setIsCompleting(true)
		try {
			await completeMilestone(courseId, milestone.id)
		} catch (err) {
			console.error("Failed to complete milestone:", err)
		} finally {
			setIsCompleting(false)
		}
	}

	const getIcon = () => {
		switch (status) {
			case "completed":
				return <span className={styles.animCheck}>✅</span>
			case "in_progress":
				return <span>⏳</span>
			case "locked":
				return <span>🔒</span>
			default:
				return <span>🔒</span>
		}
	}

	return (
		<div className={`${styles.step} ${styles[status]}`}>
			<div className={styles.iconContainer}>{getIcon()}</div>
			<div className={styles.content}>
				<div className={styles.header}>
					<h3 className={styles.title}>{milestone.label}</h3>
					<div className={styles.badge}>
						{t("home.milestones.lrnReward", {
							amount: new Intl.NumberFormat(i18n.language).format(
								milestone.lrnReward,
							),
						})}
					</div>
				</div>

				{status === "locked" && (
					<p style={{ fontSize: "0.9rem", color: "#9ca3af", margin: 0 }}>
						{t("home.milestones.locked")}
					</p>
				)}

				{status === "in_progress" && (
					<div>
						<p style={{ fontSize: "0.9rem", color: "#d1d5db", margin: 0 }}>
							{t("home.milestones.inProgress")}
						</p>
						<button
							className={styles.actionBtn}
							onClick={handleComplete}
							disabled={isCompleting || isCompletingMilestone}
						>
							{isCompleting || isCompletingMilestone
								? t("home.milestones.submittingText")
								: t("home.milestones.markComplete")}
						</button>
					</div>
				)}

				{status === "completed" && (
					<div>
						<p
							style={{
								fontSize: "0.9rem",
								color: "#10b981",
								margin: 0,
								fontWeight: 600,
							}}
						>
							{t("home.milestones.completedText")}
						</p>
						{txHash && <TxHashLink hash={txHash} className={styles.txLink} />}
					</div>
				)}
			</div>
		</div>
	)
}

export function MilestoneTracker({
	courseId,
	milestones,
}: MilestoneTrackerProps) {
	return (
		<div className={styles.container}>
			{milestones.map((milestone) => (
				<MilestoneStep
					key={milestone.id}
					courseId={courseId}
					milestone={milestone}
				/>
			))}
		</div>
	)
}
