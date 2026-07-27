import { Badge, Button, Icon } from "@stellar/design-system"
import { useEffect, useState } from "react"

import {
	type EscrowInstructions,
	type Mentor,
	type MentorBooking,
	confirmBookingPayment,
	createBooking,
	useMentorAvailability,
} from "../../hooks/useMentorBooking"
import { useWallet } from "../../hooks/useWallet"

interface BookingModalProps {
	mentor: Mentor
	onClose: () => void
}

type Step = "select-slot" | "escrow-instructions" | "confirm-payment" | "done"

export function BookingModal({ mentor, onClose }: BookingModalProps) {
	const { address } = useWallet()
	const { slots, loading: slotsLoading } = useMentorAvailability(mentor.address)
	const [selectedSlotId, setSelectedSlotId] = useState<number | null>(null)
	const [step, setStep] = useState<Step>("select-slot")
	const [booking, setBooking] = useState<MentorBooking | null>(null)
	const [escrowInstructions, setEscrowInstructions] =
		useState<EscrowInstructions | null>(null)
	const [escrowTx, setEscrowTx] = useState("")
	const [error, setError] = useState<string | null>(null)
	const [submitting, setSubmitting] = useState(false)

	useEffect(() => {
		const handleEsc = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose()
		}
		window.addEventListener("keydown", handleEsc)
		return () => window.removeEventListener("keydown", handleEsc)
	}, [onClose])

	const handleCreateBooking = async () => {
		if (!selectedSlotId) return
		setSubmitting(true)
		setError(null)
		try {
			const result = await createBooking(selectedSlotId, mentor.hourly_rate)
			setBooking(result.booking)
			setEscrowInstructions(result.escrow_instructions)
			setStep("escrow-instructions")
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to create booking")
		} finally {
			setSubmitting(false)
		}
	}

	const handleConfirmPayment = async () => {
		if (!booking || !escrowTx.trim()) return
		setSubmitting(true)
		setError(null)
		try {
			const updated = await confirmBookingPayment(booking.id, escrowTx.trim())
			setBooking(updated)
			setStep("done")
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to confirm payment")
		} finally {
			setSubmitting(false)
		}
	}

	return (
		<div
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
			onClick={onClose}
		>
			<div
				className="glass-card rounded-[2rem] p-8 max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto"
				onClick={(e) => e.stopPropagation()}
			>
				<div className="flex justify-between items-start mb-6">
					<div>
						<h2 className="text-2xl font-black mb-1">Book a Session</h2>
						<p className="text-white/50 text-sm">
							with {mentor.address.slice(0, 4)}...
							{mentor.address.slice(-4)} — ${mentor.hourly_rate}/hr
						</p>
					</div>
					<button
						onClick={onClose}
						className="text-white/40 hover:text-white transition-colors"
					>
						<Icon.XClose size="md" />
					</button>
				</div>

				{error && (
					<div className="rounded-xl bg-red-500/10 border border-red-500/20 p-4 mb-6">
						<p className="text-red-400 text-sm font-medium">{error}</p>
					</div>
				)}

				{!address && (
					<div className="rounded-xl bg-yellow-500/10 border border-yellow-500/20 p-4 mb-6">
						<p className="text-yellow-400 text-sm font-medium">
							Please connect your wallet to book a session.
						</p>
					</div>
				)}

				{step === "select-slot" && (
					<div>
						<h3 className="text-lg font-bold mb-4">Select a time slot</h3>
						{slotsLoading ? (
							<p className="text-white/40 animate-pulse">Loading slots...</p>
						) : slots.length === 0 ? (
							<p className="text-white/40">
								No available slots. The mentor hasn't added availability yet.
							</p>
						) : (
							<div className="space-y-3 mb-6">
								{slots.map((slot) => (
									<button
										key={slot.id}
										className={`w-full text-left p-4 rounded-xl border transition-all ${
											selectedSlotId === slot.id
												? "border-brand-cyan bg-brand-cyan/10"
												: "border-white/10 hover:border-white/20"
										}`}
										onClick={() => setSelectedSlotId(slot.id)}
									>
										<div className="flex justify-between items-center">
											<div>
												<p className="font-bold text-sm">
													{new Date(slot.start_ts).toLocaleDateString(
														undefined,
														{
															weekday: "short",
															month: "short",
															day: "numeric",
														},
													)}
												</p>
												<p className="text-white/50 text-sm">
													{new Date(slot.start_ts).toLocaleTimeString(
														undefined,
														{
															hour: "2-digit",
															minute: "2-digit",
														},
													)}{" "}
													—{" "}
													{new Date(slot.end_ts).toLocaleTimeString(undefined, {
														hour: "2-digit",
														minute: "2-digit",
													})}
												</p>
											</div>
											{selectedSlotId === slot.id && (
												<Icon.Check size="sm" className="text-brand-cyan" />
											)}
										</div>
									</button>
								))}
							</div>
						)}
						<Button
							variant="primary"
							size="md"
							disabled={!selectedSlotId || !address || submitting}
							onClick={() => void handleCreateBooking()}
						>
							{submitting ? "Creating..." : "Continue"}
						</Button>
					</div>
				)}

				{step === "escrow-instructions" && escrowInstructions && (
					<div>
						<h3 className="text-lg font-bold mb-4">Escrow Deposit</h3>
						<div className="glass-card rounded-xl p-4 mb-6 space-y-3">
							<div className="flex justify-between">
								<span className="text-white/50 text-sm">Recipient</span>
								<span className="font-mono text-sm">
									{escrowInstructions.recipient.slice(0, 8)}...
									{escrowInstructions.recipient.slice(-8)}
								</span>
							</div>
							<div className="flex justify-between">
								<span className="text-white/50 text-sm">Amount</span>
								<span className="font-bold text-brand-cyan">
									{escrowInstructions.amount_usdc} USDC
								</span>
							</div>
							<div className="flex justify-between">
								<span className="text-white/50 text-sm">Memo</span>
								<span className="font-mono text-sm">
									{escrowInstructions.memo}
								</span>
							</div>
							<p className="text-white/40 text-xs pt-2 border-t border-white/5">
								{escrowInstructions.note}
							</p>
						</div>
						<div className="mb-6">
							<label className="block text-sm font-bold mb-2">
								Escrow Transaction Hash
							</label>
							<input
								type="text"
								value={escrowTx}
								onChange={(e) => setEscrowTx(e.target.value)}
								placeholder="Enter the Stellar tx hash after depositing USDC"
								className="w-full p-3 rounded-xl bg-white/5 border border-white/10 text-sm font-mono focus:border-brand-cyan focus:outline-none"
							/>
						</div>
						<Button
							variant="primary"
							size="md"
							disabled={!escrowTx.trim() || submitting}
							onClick={() => void handleConfirmPayment()}
						>
							{submitting ? "Confirming..." : "Confirm Payment"}
						</Button>
					</div>
				)}

				{step === "done" && booking && (
					<div className="text-center py-8">
						<div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-brand-cyan/20 mb-4">
							<Icon.Check size="lg" className="text-brand-cyan" />
						</div>
						<h3 className="text-xl font-black mb-2">Booking Confirmed!</h3>
						<p className="text-white/50 text-sm mb-6">
							Your session is booked and payment is held in escrow. The mentor
							will receive funds after the session is completed.
						</p>
						<Badge variant="secondary" size="md">
							{`Booking #${booking.id} — ${booking.status}`}
						</Badge>
						<div className="mt-6">
							<Button variant="secondary" size="md" onClick={onClose}>
								Close
							</Button>
						</div>
					</div>
				)}
			</div>
		</div>
	)
}
