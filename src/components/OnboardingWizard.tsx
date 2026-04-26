import { Button } from "@stellar/design-system"
import { AnimatePresence, motion } from "framer-motion"
import { useEffect, useMemo, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { stellarNetwork } from "../contracts/util"
import { courses, type Course } from "../data/courses"
import { useCourse } from "../hooks/useCourse"
import { useNotification } from "../hooks/useNotification"
import { useWallet } from "../hooks/useWallet"
import { getFriendbotUrl } from "../util/friendbot"
import storage from "../util/storage"
import { connectWallet } from "../util/wallet"

const ONBOARDING_COMPLETE_KEY = "learnvault:onboarding-complete"
const ONBOARDING_TRACK_KEY = "learnvault:onboarding-track"

const beginnerTracks = courses.filter((course) => course.level === "Beginner")

const steps = [
	"Welcome",
	"Install wallet",
	"Connect wallet",
	"Get testnet funds",
	"Choose track",
	"Enroll",
	"Start learning",
] as const

const cardMotion = {
	initial: { opacity: 0, scale: 0.97, y: 15, filter: "blur(8px)" },
	animate: { opacity: 1, scale: 1, y: 0, filter: "blur(0px)" },
	exit: { opacity: 0, scale: 1.03, y: -15, filter: "blur(8px)" },
	transition: { duration: 0.4 },
}

// stepVariants removed since it's no longer used for the dot UI

const parseBalance = (balance: string | undefined) => {
	if (!balance) return 0
	return Number(balance.replace(/,/g, ""))
}

const isFreighterInstalled = () => {
	if (typeof window === "undefined") return false
	const candidate = window as Window & {
		freighter?: unknown
		freighterApi?: unknown
		stellar?: { isConnected?: unknown }
	}
	return Boolean(
		candidate.freighter ||
		candidate.freighterApi ||
		(candidate.stellar && "isConnected" in candidate.stellar),
	)
}

interface OnboardingWizardProps {
	onSkippedForReturningUser?: () => void
}

export default function OnboardingWizard({
	onSkippedForReturningUser,
}: OnboardingWizardProps) {
	const navigate = useNavigate()
	const { addNotification } = useNotification()
	const { enroll, enrolledCourses } = useCourse()
	const { address, balances, updateBalances, isPending } = useWallet()
	const headingRef = useRef<HTMLHeadingElement | null>(null)
	const [stepIndex, setStepIndex] = useState(0)
	const [walletBypass, setWalletBypass] = useState(false)
	const [selectedTrackId, setSelectedTrackId] = useState<string | null>(
		storage.getItem(ONBOARDING_TRACK_KEY, "safe"),
	)
	const [isFunding, setIsFunding] = useState(false)
	const [fundingAttempted, setFundingAttempted] = useState(false)
	const [isEnrolling, setIsEnrolling] = useState(false)
	const [isHidden, setIsHidden] = useState(false)

	const selectedTrack = useMemo(
		() =>
			beginnerTracks.find((course) => course.id === selectedTrackId) ??
			beginnerTracks[0],
		[selectedTrackId],
	)
	const currentStep = steps[stepIndex]
	const xlmBalance = parseBalance(balances.xlm?.balance)
	const hasFunds = xlmBalance > 0
	const isReturningUser = Boolean(
		storage.getItem("walletId", "safe") ||
		storage.getItem("walletAddress", "safe"),
	)
	const hasCompletedOnboarding = Boolean(
		storage.getItem(ONBOARDING_COMPLETE_KEY, "safe"),
	)
	const isTrackEnrolled = selectedTrack
		? enrolledCourses.some((course) => course.id === selectedTrack.id)
		: false

	useEffect(() => {
		if (hasCompletedOnboarding || isReturningUser) {
			setIsHidden(true)
			onSkippedForReturningUser?.()
		}
	}, [hasCompletedOnboarding, isReturningUser, onSkippedForReturningUser])

	useEffect(() => {
		headingRef.current?.focus()
	}, [stepIndex])

	useEffect(() => {
		if (currentStep === "Connect wallet" && address) {
			setStepIndex((prev) => Math.max(prev, 3))
		}
	}, [address, currentStep])

	useEffect(() => {
		if (
			currentStep === "Get testnet funds" &&
			address &&
			hasFunds &&
			!isFunding
		) {
			setStepIndex((prev) => Math.max(prev, 4))
		}
	}, [address, currentStep, hasFunds, isFunding])

	useEffect(() => {
		if (currentStep === "Enroll" && isTrackEnrolled) {
			setStepIndex((prev) => Math.max(prev, 6))
		}
	}, [currentStep, isTrackEnrolled])

	useEffect(() => {
		if (
			currentStep !== "Get testnet funds" ||
			!address ||
			hasFunds ||
			isFunding ||
			fundingAttempted ||
			stellarNetwork === "PUBLIC"
		) {
			return
		}

		let cancelled = false

		const fundAccount = async () => {
			setIsFunding(true)
			setFundingAttempted(true)
			try {
				const response = await fetch(getFriendbotUrl(address))
				if (!response.ok) {
					throw new Error("Friendbot funding failed")
				}
				await updateBalances()
				if (!cancelled) {
					addNotification("Testnet funds received", "success")
				}
			} catch {
				if (!cancelled) {
					addNotification(
						"Could not auto-fund this wallet. Please retry or use Friendbot manually.",
						"warning",
					)
				}
			} finally {
				if (!cancelled) {
					setIsFunding(false)
				}
			}
		}

		void fundAccount()

		return () => {
			cancelled = true
		}
	}, [
		address,
		addNotification,
		currentStep,
		fundingAttempted,
		hasFunds,
		isFunding,
		updateBalances,
	])

	const completeOnboarding = () => {
		storage.setItem(ONBOARDING_COMPLETE_KEY, true)
		if (selectedTrack) {
			storage.setItem(ONBOARDING_TRACK_KEY, selectedTrack.id)
		}
	}

	const goNext = () => {
		setStepIndex((prev) => Math.min(prev + 1, steps.length - 1))
	}

	const goBack = () => {
		setStepIndex((prev) => Math.max(prev - 1, 0))
	}

	const handleWalletBypass = () => {
		setWalletBypass(true)
		setStepIndex(2)
	}

	const handleTrackSelection = (course: Course) => {
		setSelectedTrackId(course.id)
		storage.setItem(ONBOARDING_TRACK_KEY, course.id)
	}

	const handleRetryFunding = async () => {
		if (!address) return
		setFundingAttempted(false)
		await updateBalances()
	}

	const handleEnroll = async () => {
		if (!selectedTrack) {
			addNotification("Choose a track before enrolling", "warning")
			return
		}

		setIsEnrolling(true)
		try {
			await enroll(selectedTrack.id)
		} finally {
			setIsEnrolling(false)
		}
	}

	const handleStartLearning = () => {
		if (!selectedTrack) return
		completeOnboarding()
		void navigate(`/learn?course=${selectedTrack.id}`)
	}

	if (isHidden) {
		return null
	}

	return (
		<section
			aria-label="New learner onboarding"
			className="relative w-full max-w-6xl mx-auto mb-20"
		>
			<div className="absolute inset-x-10 top-6 h-48 bg-linear-to-r from-brand-cyan/18 via-emerald-400/12 to-brand-blue/18 blur-3xl -z-10" />
			<div className="glass-card border border-white/10 rounded-[2rem] md:rounded-[2.75rem] overflow-hidden shadow-[0_24px_120px_rgba(0,0,0,0.35)]">
				<div className="px-6 md:px-10 pt-6 md:pt-8 flex flex-col gap-5">
					<div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
						<div>
							<p className="text-xs uppercase tracking-[0.35em] text-brand-cyan/80 mb-2">
								New Learner Flow
							</p>
							<h2 className="text-3xl md:text-5xl font-black tracking-tight">
								Go from first visit to first course in minutes.
							</h2>
						</div>
						<button
							type="button"
							onClick={() => setIsHidden(true)}
							className="self-start px-4 py-2 rounded-full border border-white/10 text-sm text-white/60 hover:text-white hover:border-white/20 focus:outline-none focus:ring-2 focus:ring-brand-cyan/60"
						>
							Skip for now
						</button>
					</div>

					<div
						className="relative flex items-center justify-between mt-10 md:mt-12 px-2 md:px-6 mb-8"
						role="progressbar"
						aria-label="Onboarding progress"
						aria-valuenow={stepIndex + 1}
						aria-valuemin={1}
						aria-valuemax={steps.length}
					>
						{/* Background Line */}
						<div className="absolute left-[calc(1rem)] right-[calc(1rem)] md:left-[calc(2.5rem)] md:right-[calc(2.5rem)] top-4 h-1 bg-white/10 rounded-full" />

						{/* Active Line Fill */}
						<div
							className="absolute left-[calc(1rem)] md:left-[calc(2.5rem)] top-4 h-1 bg-brand-cyan rounded-full transition-all duration-700 ease-[cubic-bezier(0.22,1,0.36,1)]"
							style={{
								width: `calc(${(stepIndex / (steps.length - 1)) * 100}% - ${(stepIndex / (steps.length - 1)) * 2}rem)`,
							}}
						/>

						{steps.map((step, index) => {
							const state =
								index < stepIndex
									? "completed"
									: index === stepIndex
										? "active"
										: "inactive"
							return (
								<div
									key={step}
									className="relative flex flex-col items-center group z-10"
									aria-current={state === "active" ? "step" : undefined}
								>
									<div
										className={`flex h-8 w-8 md:h-10 md:w-10 items-center justify-center rounded-full border-2 transition-all duration-500 ${
											state === "completed"
												? "border-emerald-400 bg-emerald-500/20 text-emerald-200"
												: state === "active"
													? "border-brand-cyan bg-brand-cyan/20 text-brand-cyan shadow-[0_0_20px_rgba(0,255,255,0.4)]"
													: "border-white/20 bg-black text-white/40"
										}`}
									>
										{state === "completed" ? (
											<svg
												className="w-4 h-4 md:w-5 md:h-5"
												fill="none"
												viewBox="0 0 24 24"
												stroke="currentColor"
												strokeWidth={3}
											>
												<path
													strokeLinecap="round"
													strokeLinejoin="round"
													d="M5 13l4 4L19 7"
												/>
											</svg>
										) : (
											<span className="text-xs md:text-sm font-bold">
												{index + 1}
											</span>
										)}
									</div>
									<div className="absolute top-12 whitespace-nowrap text-center opacity-0 transition-opacity duration-300 group-hover:opacity-100 xl:opacity-100 pointer-events-none">
										<p
											className={`text-[10px] md:text-xs font-semibold uppercase tracking-wider ${
												state === "completed"
													? "text-emerald-300/80"
													: state === "active"
														? "text-brand-cyan"
														: "text-white/40"
											}`}
										>
											{step}
										</p>
									</div>
								</div>
							)
						})}
					</div>
				</div>

				<div className="px-6 pb-6 md:px-10 md:pb-10 pt-6 md:pt-8">
					<AnimatePresence mode="wait">
						<motion.article
							key={currentStep}
							{...cardMotion}
							className="grid gap-8 lg:grid-cols-[1.1fr_0.9fr]"
						>
							<div className="rounded-[1.75rem] border border-white/10 bg-linear-to-br from-white/8 to-white/[0.02] p-6 md:p-8">
								<p className="text-sm uppercase tracking-[0.3em] text-white/45">
									Step {stepIndex + 1} of {steps.length}
								</p>
								{currentStep === "Welcome" ? (
									<>
										<h3
											ref={headingRef}
											tabIndex={-1}
											className="mt-4 text-4xl md:text-6xl font-black tracking-tight focus:outline-none"
										>
											Learn Stellar, ship on-chain, earn as you grow.
										</h3>
										<p className="mt-5 max-w-2xl text-lg text-white/65 leading-relaxed">
											LearnVault helps new builders get a wallet ready, funded,
											enrolled, and into their first practical lesson without
											dropping them into blockchain setup confusion.
										</p>
										<div className="mt-8 flex flex-wrap gap-4">
											<Button size="lg" variant="primary" onClick={goNext}>
												Get Started
											</Button>
											<Button
												size="lg"
												variant="tertiary"
												onClick={() => setIsHidden(true)}
											>
												Explore app first
											</Button>
										</div>
									</>
								) : null}

								{currentStep === "Install wallet" ? (
									<>
										<h3
											ref={headingRef}
											tabIndex={-1}
											className="mt-4 text-3xl md:text-4xl font-black focus:outline-none"
										>
											Install Freighter to unlock the guided flow.
										</h3>
										<p className="mt-4 text-white/65 leading-relaxed">
											We check for Freighter first because it gives new learners
											the smoothest setup path for Stellar testnet and Soroban
											interactions.
										</p>
										<div className="mt-6 rounded-[1.5rem] border border-white/10 bg-black/20 p-5">
											<p className="text-sm uppercase tracking-[0.25em] text-white/40">
												Wallet status
											</p>
											<p className="mt-2 text-lg font-semibold">
												{isFreighterInstalled()
													? "Freighter detected in this browser."
													: "Freighter not detected yet."}
											</p>
										</div>
										<div className="mt-8 flex flex-wrap gap-4">
											<a
												href="https://www.freighter.app/"
												target="_blank"
												rel="noreferrer"
												className="inline-flex"
											>
												<Button size="lg" variant="secondary">
													Install Freighter
												</Button>
											</a>
											<Button
												size="lg"
												variant="primary"
												onClick={goNext}
												disabled={!isFreighterInstalled()}
											>
												Continue
											</Button>
											<Button
												size="lg"
												variant="tertiary"
												onClick={handleWalletBypass}
											>
												I already have a wallet
											</Button>
										</div>
									</>
								) : null}

								{currentStep === "Connect wallet" ? (
									<>
										<h3
											ref={headingRef}
											tabIndex={-1}
											className="mt-4 text-3xl md:text-4xl font-black focus:outline-none"
										>
											Connect your wallet to continue.
										</h3>
										<p className="mt-4 text-white/65 leading-relaxed">
											Once connected, we can verify your account, check for
											testnet balance, and prepare your first enrollment.
										</p>
										<div className="mt-6 rounded-[1.5rem] border border-white/10 bg-black/20 p-5">
											<p className="text-sm uppercase tracking-[0.25em] text-white/40">
												Connection
											</p>
											<p className="mt-2 text-lg font-semibold">
												{address
													? `Connected: ${address}`
													: "No wallet connected yet."}
											</p>
											{walletBypass ? (
												<p className="mt-2 text-sm text-white/50">
													Bypass enabled, so any supported Stellar wallet is
													fine.
												</p>
											) : null}
										</div>
										<div className="mt-8 flex flex-wrap gap-4">
											<Button
												size="lg"
												variant="primary"
												onClick={() => void connectWallet()}
												disabled={Boolean(address) || isPending}
											>
												{address ? "Wallet connected" : "Connect wallet"}
											</Button>
											<Button size="lg" variant="tertiary" onClick={goBack}>
												Back
											</Button>
										</div>
									</>
								) : null}

								{currentStep === "Get testnet funds" ? (
									<>
										<h3
											ref={headingRef}
											tabIndex={-1}
											className="mt-4 text-3xl md:text-4xl font-black focus:outline-none"
										>
											Fund your wallet for testnet actions.
										</h3>
										<p className="mt-4 text-white/65 leading-relaxed">
											This step runs automatically when your XLM balance is
											zero, so new learners don&apos;t need to hunt for faucets.
										</p>
										<div className="mt-6 grid gap-4 md:grid-cols-2">
											<div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-5">
												<p className="text-sm uppercase tracking-[0.25em] text-white/40">
													Network
												</p>
												<p className="mt-2 text-lg font-semibold">
													{stellarNetwork}
												</p>
											</div>
											<div className="rounded-[1.5rem] border border-white/10 bg-black/20 p-5">
												<p className="text-sm uppercase tracking-[0.25em] text-white/40">
													XLM balance
												</p>
												<p className="mt-2 text-lg font-semibold">
													{balances.xlm?.balance ?? "0"}
												</p>
											</div>
										</div>
										<div className="mt-8 flex flex-wrap gap-4">
											<Button
												size="lg"
												variant="primary"
												onClick={() => void handleRetryFunding()}
												disabled={
													stellarNetwork === "PUBLIC" || hasFunds || isFunding
												}
											>
												{isFunding
													? "Requesting funds..."
													: hasFunds
														? "Wallet funded"
														: "Retry funding"}
											</Button>
											<Button
												size="lg"
												variant="tertiary"
												onClick={goNext}
												disabled={!hasFunds}
											>
												Continue
											</Button>
										</div>
										{stellarNetwork === "PUBLIC" && !hasFunds ? (
											<p className="mt-4 text-sm text-amber-200">
												Public network wallets are not auto-funded. Add XLM in
												your wallet, then continue.
											</p>
										) : null}
									</>
								) : null}

								{currentStep === "Choose track" ? (
									<>
										<h3
											ref={headingRef}
											tabIndex={-1}
											className="mt-4 text-3xl md:text-4xl font-black focus:outline-none"
										>
											Pick the beginner path that matches your goal.
										</h3>
										<p className="mt-4 text-white/65 leading-relaxed">
											Every track starts practical and low-friction, so your
											first lesson feels like momentum instead of theory
											overload.
										</p>
										<fieldset className="mt-8">
											<legend className="sr-only">
												Choose your learning track
											</legend>
											<div className="grid gap-4 md:grid-cols-2">
												{beginnerTracks.map((course) => {
													const checked = course.id === selectedTrack?.id
													return (
														<label
															key={course.id}
															className={`cursor-pointer rounded-[1.5rem] border p-5 transition-all focus-within:ring-2 focus-within:ring-brand-cyan/60 ${
																checked
																	? "border-brand-cyan/40 bg-brand-cyan/10"
																	: "border-white/10 bg-white/[0.03] hover:bg-white/[0.05]"
															}`}
														>
															<input
																type="radio"
																name="onboarding-track"
																value={course.id}
																checked={checked}
																onChange={() => handleTrackSelection(course)}
																className="sr-only"
															/>
															<div
																className={`h-24 rounded-[1.25rem] bg-linear-to-br ${course.accentClassName}`}
															/>
															<div className="mt-4 flex items-center justify-between gap-3">
																<div>
																	<p className="text-xs uppercase tracking-[0.25em] text-white/45">
																		{course.track}
																	</p>
																	<h4 className="mt-2 text-xl font-bold">
																		{course.title}
																	</h4>
																</div>
																{checked ? (
																	<span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-brand-cyan/20 text-brand-cyan font-bold">
																		OK
																	</span>
																) : null}
															</div>
															<p className="mt-3 text-sm text-white/60">
																{course.description}
															</p>
														</label>
													)
												})}
											</div>
										</fieldset>
										<div className="mt-8 flex flex-wrap gap-4">
											<Button size="lg" variant="primary" onClick={goNext}>
												Continue with {selectedTrack?.track ?? "selected track"}
											</Button>
											<Button size="lg" variant="tertiary" onClick={goBack}>
												Back
											</Button>
										</div>
									</>
								) : null}

								{currentStep === "Enroll" ? (
									<>
										<h3
											ref={headingRef}
											tabIndex={-1}
											className="mt-4 text-3xl md:text-4xl font-black focus:outline-none"
										>
											One click and you&apos;re enrolled.
										</h3>
										<p className="mt-4 text-white/65 leading-relaxed">
											We use the existing contract flow here, so this step maps
											to the real enrollment path the product already supports.
										</p>
										<div className="mt-6 rounded-[1.5rem] border border-white/10 bg-black/20 p-5">
											<p className="text-sm uppercase tracking-[0.25em] text-white/40">
												Selected course
											</p>
											<h4 className="mt-2 text-2xl font-bold">
												{selectedTrack?.title}
											</h4>
											<p className="mt-3 text-white/60">
												{selectedTrack?.description}
											</p>
										</div>
										<div className="mt-8 flex flex-wrap gap-4">
											<Button
												size="lg"
												variant="primary"
												onClick={() => void handleEnroll()}
												disabled={isEnrolling || isTrackEnrolled}
											>
												{isEnrolling
													? "Submitting enrollment..."
													: isTrackEnrolled
														? "Enrolled"
														: "Enroll now"}
											</Button>
											<Button size="lg" variant="tertiary" onClick={goBack}>
												Back
											</Button>
										</div>
									</>
								) : null}

								{currentStep === "Start learning" ? (
									<>
										<h3
											ref={headingRef}
											tabIndex={-1}
											className="mt-4 text-3xl md:text-4xl font-black focus:outline-none"
										>
											Your first lesson is ready.
										</h3>
										<p className="mt-4 text-white/65 leading-relaxed">
											We&apos;ll hand you off to the learn experience with your
											track preselected so you can start immediately.
										</p>
										<div className="mt-6 rounded-[1.5rem] border border-white/10 bg-black/20 p-5">
											<p className="text-sm uppercase tracking-[0.25em] text-white/40">
												First lesson
											</p>
											<h4 className="mt-2 text-2xl font-bold">
												{selectedTrack?.firstLesson}
											</h4>
										</div>
										<div className="mt-8 flex flex-wrap gap-4">
											<Button
												size="lg"
												variant="primary"
												onClick={handleStartLearning}
											>
												Start learning
											</Button>
											<Button size="lg" variant="tertiary" onClick={goBack}>
												Back
											</Button>
										</div>
									</>
								) : null}
							</div>

							<aside className="rounded-[1.75rem] border border-white/10 bg-black/20 p-6 md:p-8">
								<p className="text-sm uppercase tracking-[0.25em] text-white/40">
									Why this flow works
								</p>
								<ul className="mt-5 space-y-4 text-white/70">
									<li className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
										<p className="font-semibold text-white">Validation first</p>
										<p className="mt-2 text-sm leading-relaxed text-white/55">
											Each step is either completed automatically or gated until
											the required action is done.
										</p>
									</li>
									<li className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
										<p className="font-semibold text-white">
											Low setup friction
										</p>
										<p className="mt-2 text-sm leading-relaxed text-white/55">
											New users get funding help and returning users skip the
											wizard when prior wallet connection is already stored.
										</p>
									</li>
									<li className="rounded-2xl border border-white/8 bg-white/[0.03] p-4">
										<p className="font-semibold text-white">
											Professional handoff
										</p>
										<p className="mt-2 text-sm leading-relaxed text-white/55">
											Track selection, enrollment, and lesson launch all reuse
											the existing app stack instead of inventing parallel
											logic.
										</p>
									</li>
								</ul>
								<div className="mt-6 rounded-[1.5rem] border border-dashed border-white/10 p-4 text-sm text-white/50">
									{selectedTrack ? (
										<>
											<p className="uppercase tracking-[0.25em] text-white/35">
												Current track
											</p>
											<p className="mt-2 text-lg font-semibold text-white">
												{selectedTrack.title}
											</p>
											<p className="mt-2 leading-relaxed">
												{selectedTrack.duration} - {selectedTrack.level}
											</p>
										</>
									) : (
										"Choose a track to personalize the next steps."
									)}
								</div>
							</aside>
						</motion.article>
					</AnimatePresence>
				</div>
			</div>
		</section>
	)
}
