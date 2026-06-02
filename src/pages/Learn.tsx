import { Button, Card, Text } from "@stellar/design-system"
import { Link } from "react-router-dom"
import { MilestoneTracker } from "../components/MilestoneTracker"
import { useCourse } from "../hooks/useCourse"

const courseId = "stellar-basics"

const milestones = [
	{ id: 1, label: "Complete Lesson 1", lrnReward: 10 },
	{ id: 2, label: "Pass Quiz 1", lrnReward: 20 },
	{ id: 3, label: "Build your first contract", lrnReward: 50 },
]

export default function Learn() {
	const { enroll, enrolledCourses, getCourseProgress, isCompletingMilestone } =
		useCourse()

	const isEnrolled = enrolledCourses.some((course) => course.id === courseId)
	const progress = getCourseProgress(courseId)
	const completedCount = progress.completedMilestoneIds.length
	const completionPercentage = Math.round(
		(completedCount / milestones.length) * 100,
	)

	return (
		<div className="space-y-6">
			<Text as="h1" size="lg">
				Learn
			</Text>

			<Card>
				<Text as="h2" size="md">
					Catalog
				</Text>
				<Text as="p" size="sm">
					Browse catalog → enroll → complete lesson → verify LRN increases.
				</Text>

				<div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
					<Text as="div" size="sm">
						<strong>Stellar Basics</strong> ({courseId})
					</Text>

					<Button
						size="sm"
						variant="primary"
						data-testid="enroll-course"
						onClick={() => void enroll(courseId)}
					>
						Enroll
					</Button>
				</div>
			</Card>

			<Card>
				<Text as="h2" size="md">
					My Learning
				</Text>

				{isCompletingMilestone ? (
					<Text as="p" size="sm">
						Loading course progress...
					</Text>
				) : enrolledCourses.length === 0 ? (
					<Text as="p" size="sm">
						You are not enrolled in any courses yet.
					</Text>
				) : (
					<div>
						<Text as="h3" size="sm">
							Stellar Basics
						</Text>
						<Text as="p" size="sm">
							{completionPercentage}% complete
						</Text>
						<Link to={`/courses/${courseId}/lessons/1`}>Continue</Link>
					</div>
				)}
			</Card>

			<Card>
				<Text as="h2" size="md">
					Lessons
				</Text>
				{isEnrolled ? (
					<MilestoneTracker courseId={courseId} milestones={milestones} />
				) : (
					<Text as="p" size="sm">
						Enroll in Stellar Basics to start tracking your progress.
					</Text>
				)}
			</Card>
		</div>
	)
}
