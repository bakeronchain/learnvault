import { Button, Card, Text } from "@stellar/design-system"

import { MilestoneTracker } from "../components/MilestoneTracker"
import { useCourse } from "../hooks/useCourse"

export default function Learn() {
	const { enroll } = useCourse()

	const courseId = "stellar-basics"
	const milestones = [
		{ id: 1, label: "Complete Lesson 1", lrnReward: 10 },
		{ id: 2, label: "Pass Quiz 1", lrnReward: 20 },
		{ id: 3, label: "Build your first contract", lrnReward: 50 },
	]

	return (
		<div>
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
					Lessons
				</Text>
				<MilestoneTracker courseId={courseId} milestones={milestones} />
			</Card>
		</div>
	)
}
