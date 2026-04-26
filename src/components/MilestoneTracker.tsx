import { Icon, Button, Card, Badge } from "@stellar/design-system"
import React, { useState, useEffect } from "react"

interface Milestone {
	id: number
	label: string
	lrnReward: number
	status: "completed" | "in-progress" | "locked"
	txHash?: string
}

interface MilestoneTrackerProps {
	courseId: string
	milestones: Milestone[]
}

export const MilestoneTracker: React.FC<MilestoneTrackerProps> = ({
	milestones,
}) => {
	return (
		<div className="space-y-6 max-w-lg mx-auto p-4">
			{milestones.map((milestone, index) => (
				<div
					key={milestone.id}
					className="relative flex items-start gap-4 group"
				>
					{/* Progress Line */}
					{index !== milestones.length - 1 && (
						<div
							className={`absolute left-4 top-8 w-0.5 h-full ${
								milestone.status === "completed"
									? "bg-green-500"
									: "bg-gray-700"
							}`}
						/>
					)}

					{/* Status Icon */}
					<div className="relative z-10 flex-shrink-0">
						<div
							className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${
								milestone.status === "completed"
									? "bg-green-500 border-green-500 text-white"
									: milestone.status === "in-progress"
										? "bg-blue-900/30 border-blue-500 text-blue-400"
										: "bg-gray-800 border-gray-600 text-gray-500"
							}`}
						>
							{milestone.status === "completed" ? (
								<Icon.Check size="sm" />
							) : milestone.status === "in-progress" ? (
								<div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
							) : (
								<Icon.Lock01 size="sm" />
							)}
						</div>
					</div>

					{/* Content Card */}
					<div
						className={`flex-grow p-4 transition-all border-l-4 ${
							milestone.status === "completed"
								? "border-l-green-500 bg-green-950/10"
								: milestone.status === "in-progress"
									? "border-l-blue-500 bg-blue-950/10"
									: "border-l-transparent opacity-60"
						}`}
					>
						<Card>
							<div className="flex items-center justify-between mb-2">
								<h3
									className={`font-semibold ${milestone.status === "locked" ? "text-gray-500" : "text-white"}`}
								>
									{milestone.label}
								</h3>
								<Badge
									variant={
										milestone.status === "completed" ? "success" : "secondary"
									}
								>
									{`+${milestone.lrnReward} LRN`}
								</Badge>
							</div>

							{milestone.status === "completed" && milestone.txHash && (
								<div className="flex items-center gap-2 text-xs text-green-500/80 mt-2">
									<Icon.Activity size="xs" />
									<a
										href={`https://stellar.expert/explorer/testnet/tx/${milestone.txHash}`}
										target="_blank"
										rel="noopener noreferrer"
										className="hover:underline"
									>
										View on Explorer: {milestone.txHash.slice(0, 8)}...
									</a>
								</div>
							)}

							{milestone.status === "in-progress" && (
								<div className="mt-3">
									<Button size="sm" variant="secondary" className="w-full">
										Complete Task
									</Button>
								</div>
							)}
						</Card>
					</div>
				</div>
			))}
		</div>
	)
}
