import { Badge, Button } from "@stellar/design-system"
import { useCallback, useState } from "react"

import {
	type BookingStatus,
	cancelBooking,
	completeBooking,
	disputeBooking,
	useMySessions,
} from "../hooks/useMentorBooking"

const statusColors: Record<
	BookingStatus,
	"secondary" | "primary" | "success" | "error" | "warning"
> = {
	pending: "warning",
	paid: "primary",
	completed: "success",
	cancelled: "secondary",
	disputed: "error",
}

const MySessions = () => {
	const { bookings, loading, error, refetch } = useMySessions()
	const [actionLoading, setActionLoading] = useState<number | null>(null)
	const [roleFilter, setRoleFilter] = useState<"all" | "learner" | "mentor">(
		"all",
	)

	const handleAction = useCallback(
		async (action: "complete" | "cancel" | "dispute", bookingId: number) => {
			setActionLoading(bookingId)
			try {
				if (action === "complete") await completeBooking(bookingId)
				if (action === "cancel") await cancelBooking(bookingId)
				if (action === "dispute") await disputeBooking(bookingId)
				await refetch()
			} catch (err) {
				console.error(`Failed to ${action} booking:`, err)
			} finally {
				setActionLoading(null)
			}
		},
		[refetch],
	)

	return (
		<div className="min-h-screen py-20 px-6">
			<div className="max-w-4xl mx-auto">
				<header className="mb-16 text-center">
					<h1 className="text-6xl font-black mb-6 tracking-tighter text-gradient">
						My Sessions
					</h1>
					<p className="text-xl text-white/50 max-w-2xl mx-auto font-medium">
						Manage your mentor bookings — complete, cancel, or dispute sessions.
					</p>
				</header>

				{error && (
					<div className="glass-card rounded-2xl p-6 mb-8 border border-red-500/20">
						<p className="text-red-400 font-medium">{error}</p>
					</div>
				)}

				<div className="flex gap-3 mb-8 justify-center">
					{(["all", "learner", "mentor"] as const).map((role) => (
						<button
							key={role}
							className={`px-4 py-2 rounded-full text-sm font-bold transition-all capitalize ${
								roleFilter === role
									? "bg-brand-cyan text-black"
									: "glass-card text-white/60 hover:text-white"
							}`}
							onClick={() => {
								setRoleFilter(role)
								void refetch(role === "all" ? undefined : role)
							}}
						>
							{role}
						</button>
					))}
				</div>

				{loading ? (
					<div className="text-center py-20 text-white/40 font-bold uppercase tracking-widest animate-pulse">
						Loading Sessions...
					</div>
				) : bookings.length === 0 ? (
					<div className="text-center py-20 text-white/40 font-medium">
						No sessions yet. Book a mentor from the directory!
					</div>
				) : (
					<div className="space-y-4">
						{bookings.map((booking) => (
							<div key={booking.id} className="glass-card rounded-2xl p-6">
								<div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
									<div className="space-y-2">
										<div className="flex items-center gap-3">
											<span className="font-bold text-lg">
												Booking #{booking.id}
											</span>
											<Badge variant={statusColors[booking.status]} size="md">
												{booking.status}
											</Badge>
										</div>
										<div className="text-sm text-white/50 space-y-1">
											<p>
												<span className="text-white/30">Mentor:</span>{" "}
												{booking.mentor_addr.slice(0, 8)}...
												{booking.mentor_addr.slice(-8)}
											</p>
											<p>
												<span className="text-white/30">Learner:</span>{" "}
												{booking.learner_addr.slice(0, 8)}...
												{booking.learner_addr.slice(-8)}
											</p>
											<p>
												<span className="text-white/30">Amount:</span>{" "}
												<span className="text-brand-cyan font-bold">
													{booking.amount_usdc} USDC
												</span>
											</p>
											{booking.escrow_tx && (
												<p>
													<span className="text-white/30">Escrow TX:</span>{" "}
													<span className="font-mono text-xs">
														{booking.escrow_tx.slice(0, 16)}...
													</span>
												</p>
											)}
										</div>
									</div>

									{booking.status === "paid" && (
										<div className="flex flex-col gap-2">
											<Button
												variant="primary"
												size="md"
												disabled={actionLoading === booking.id}
												onClick={() =>
													void handleAction("complete", booking.id)
												}
											>
												{actionLoading === booking.id
													? "Processing..."
													: "Complete"}
											</Button>
											<Button
												variant="secondary"
												size="md"
												disabled={actionLoading === booking.id}
												onClick={() => void handleAction("dispute", booking.id)}
											>
												Dispute
											</Button>
										</div>
									)}

									{booking.status === "pending" && (
										<Button
											variant="secondary"
											size="md"
											disabled={actionLoading === booking.id}
											onClick={() => void handleAction("cancel", booking.id)}
										>
											{actionLoading === booking.id
												? "Processing..."
												: "Cancel"}
										</Button>
									)}
								</div>
							</div>
						))}
					</div>
				)}
			</div>
		</div>
	)
}

export default MySessions
