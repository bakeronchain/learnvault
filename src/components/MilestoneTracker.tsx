import React, { useState } from "react"
import { useCourse } from "../hooks/useCourse"
import styles from "./MilestoneTracker.module.css"

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

	const [isCompleting, setIsCompleting] = useState(false)

	const handleComplete = async () => {
		if (status !== "in_progress") return

		setIsCompleting(true)
		try {
			// Optimistically UI changes within useCourse
			// wait for completion
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
					<div className={styles.badge}>+{milestone.lrnReward} LRN</div>
				</div>

				{status === "locked" && (
					<p style={{ fontSize: "0.9rem", color: "#9ca3af", margin: 0 }}>
						Complete previous milestones to unlock.
					</p>
				)}

				{status === "in_progress" && (
					<div>
						<p style={{ fontSize: "0.9rem", color: "#d1d5db", margin: 0 }}>
							Currently working on this milestone.
						</p>
						<button
							className={styles.actionBtn}
							onClick={handleComplete}
							disabled={isCompleting || isCompletingMilestone}
						>
							{isCompleting || isCompletingMilestone
								? "Submitting TX..."
								: "Mark as Complete"}
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
							Completed successfully!
						</p>
						{txHash && (
							<a
								href={`https://stellar.expert/explorer/testnet/tx/${txHash}`}
								target="_blank"
								rel="noopener noreferrer"
								className={styles.txLink}
							>
								TX: {txHash} ↗
							</a>
						)}
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
