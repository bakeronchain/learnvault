import { Button, Card } from "@stellar/design-system"
import { useEffect, useRef, useState } from "react"
import { Link } from "react-router-dom"
import { useScholarshipApplication } from "../hooks/useScholarshipApplication"
import { useWallet } from "../hooks/useWallet"
import {
	ESTIMATED_NETWORK_FEE_XLM,
	emptyScholarshipApplication,
	explorerTransactionUrl,
	flattenZodErrors,
	formatLrnBalance,
	formatUsdcAmount,
	programDetailsSchema,
	reviewSchema,
	scholarshipApplicationSchema,
	shortenAddress,
	type ScholarshipApplicationFormValues,
	type StoredScholarshipProposal,
} from "../util/scholarshipApplications"
import AddressDisplay from "../components/AddressDisplay"
import styles from "./ScholarshipApply.module.css"

const steps = [
	"Eligibility Check",
	"Program Details",
	"Funding Request",
	"Review & Submit",
	"Confirmation",
] as const

const programFieldScopes = [
	"programName",
	"programUrl",
	"programDescription",
	"startDate",
]
const fundingFieldScopes = ["amountUsdc", "milestones"]
const reviewFieldScopes = ["walletConfirmed"]

const matchesScope = (path: string, scope: string): boolean =>
	path === scope || path.startsWith(`${scope}.`)

const filterErrorsByScopes = (
	errors: Record<string, string>,
	scopes: readonly string[],
): Record<string, string> =>
	Object.fromEntries(
		Object.entries(errors).filter(([path]) =>
			scopes.some((scope) => matchesScope(path, scope)),
		),
	)

const joinIds = (...ids: Array<string | false | null | undefined>) => {
	const filtered = ids.filter(Boolean)
	return filtered.length > 0 ? filtered.join(" ") : undefined
}

export default function ScholarshipApply() {
	const { address } = useWallet()
	const {
		eligible,
		eligibilityBalance,
		eligibilitySource,
		isCheckingEligibility,
		isSubmitting,
		latestSubmittedProposal,
		lrnGap,
		minLrnRequired,
		submitApplication,
	} = useScholarshipApplication()

	const [stepIndex, setStepIndex] = useState(0)
	const [formValues, setFormValues] =
		useState<ScholarshipApplicationFormValues>(emptyScholarshipApplication)
	const [errors, setErrors] = useState<Record<string, string>>({})
	const [submitError, setSubmitError] = useState<string | null>(null)
	const [submittedProposal, setSubmittedProposal] =
		useState<StoredScholarshipProposal | null>(null)
	const stepHeadingRef = useRef<HTMLHeadingElement>(null)

	useEffect(() => {
		stepHeadingRef.current?.focus()
	}, [stepIndex])

	const clearErrorsForScopes = (scopes: readonly string[]) => {
		setErrors((current) =>
			Object.fromEntries(
				Object.entries(current).filter(
					([path]) => !scopes.some((scope) => matchesScope(path, scope)),
				),
			),
		)
	}

	const replaceErrorsForScopes = (
		scopes: readonly string[],
		nextScopedErrors: Record<string, string>,
	) => {
		setErrors((current) => ({
			...Object.fromEntries(
				Object.entries(current).filter(
					([path]) => !scopes.some((scope) => matchesScope(path, scope)),
				),
			),
			...nextScopedErrors,
		}))
		return Object.keys(nextScopedErrors).length === 0
	}

	const updateField = <K extends keyof ScholarshipApplicationFormValues>(
		field: K,
		value: ScholarshipApplicationFormValues[K],
	) => {
		setFormValues((current) => ({ ...current, [field]: value }))
		clearErrorsForScopes([field])
		setSubmitError(null)
	}

	const updateMilestone = (
		index: number,
		field: "description" | "dueDate",
		value: string,
	) => {
		setFormValues((current) => ({
			...current,
			milestones: current.milestones.map((milestone, milestoneIndex) =>
				milestoneIndex === index ? { ...milestone, [field]: value } : milestone,
			),
		}))
		clearErrorsForScopes([`milestones.${index}.${field}`, "milestones"])
		setSubmitError(null)
	}

	const validateEligibilityStep = () => {
		if (!address) {
			return replaceErrorsForScopes(["eligibility"], {
				eligibility: "Connect your wallet to check LRN eligibility.",
			})
		}
		if (isCheckingEligibility) {
			return replaceErrorsForScopes(["eligibility"], {
				eligibility: "Wait for the LRN balance check to finish.",
			})
		}
		if (!eligible) {
			return replaceErrorsForScopes(["eligibility"], {
				eligibility: `You need ${formatLrnBalance(lrnGap)} more LRN to continue.`,
			})
		}
		return replaceErrorsForScopes(["eligibility"], {})
	}

	const validateProgramDetailsStep = () => {
		const result = programDetailsSchema.safeParse({
			programName: formValues.programName,
			programUrl: formValues.programUrl,
			programDescription: formValues.programDescription,
			startDate: formValues.startDate,
		})
		const nextErrors = result.success
			? {}
			: filterErrorsByScopes(flattenZodErrors(result.error), programFieldScopes)
		return replaceErrorsForScopes(programFieldScopes, nextErrors)
	}

	const validateFundingStep = () => {
		const result = scholarshipApplicationSchema.safeParse({
			...formValues,
			walletConfirmed: true,
		})
		const nextErrors = result.success
			? {}
			: filterErrorsByScopes(flattenZodErrors(result.error), fundingFieldScopes)
		return replaceErrorsForScopes(fundingFieldScopes, nextErrors)
	}

	const validateReviewStep = () => {
		const result = reviewSchema.safeParse({
			walletConfirmed: formValues.walletConfirmed,
		})
		const nextErrors = result.success
			? {}
			: filterErrorsByScopes(flattenZodErrors(result.error), reviewFieldScopes)
		return replaceErrorsForScopes(reviewFieldScopes, nextErrors)
	}

	const goToNextStep = () => {
		const isValid =
			stepIndex === 0
				? validateEligibilityStep()
				: stepIndex === 1
					? validateProgramDetailsStep()
					: stepIndex === 2
						? validateFundingStep()
						: true
		if (isValid) {
			setStepIndex((current) => Math.min(current + 1, steps.length - 1))
		}
	}

	const handleSubmit = async () => {
		const validation = scholarshipApplicationSchema.safeParse(formValues)
		if (!validation.success) {
			const nextErrors = flattenZodErrors(validation.error)
			setErrors(nextErrors)
			if (
				Object.keys(nextErrors).some((path) =>
					programFieldScopes.some((scope) => matchesScope(path, scope)),
				)
			) {
				setStepIndex(1)
			} else if (
				Object.keys(nextErrors).some((path) =>
					fundingFieldScopes.some((scope) => matchesScope(path, scope)),
				)
			) {
				setStepIndex(2)
			} else {
				setStepIndex(3)
			}
			return
		}

		if (!validateReviewStep()) {
			return
		}

		setSubmitError(null)
		try {
			const proposal = await submitApplication(validation.data)
			setSubmittedProposal(proposal)
			setErrors({})
			setStepIndex(4)
		} catch (error) {
			setSubmitError(
				error instanceof Error
					? error.message
					: "Failed to submit the scholarship proposal.",
			)
		}
	}

	const resetApplication = () => {
		setFormValues(emptyScholarshipApplication())
		setErrors({})
		setSubmitError(null)
		setSubmittedProposal(null)
		setStepIndex(0)
	}

	const confirmationProposal = submittedProposal ?? latestSubmittedProposal
	const transactionUrl = confirmationProposal?.txHash
		? explorerTransactionUrl(confirmationProposal.txHash)
		: undefined

	const eligibilityErrorId = "scholarship-eligibility-error"
	const eligibilityStatusId = "scholarship-eligibility-status"
	const submitErrorId = "scholarship-submit-error"

	return (
		<div className={styles.Page}>
			<section className={styles.Hero}>
				<div>
					<p className={styles.Eyebrow}>Route: /scholarships/apply</p>
					<h1>Scholarship application wizard</h1>
					<p className={styles.HeroText}>
						Submit a polished proposal to the DAO treasury with eligibility
						checks, milestone planning, and wallet-backed submission.
					</p>
				</div>
				<div className={styles.HeroMeta}>
					<span>Minimum required: {formatLrnBalance(minLrnRequired)} LRN</span>
					<span>
						Estimated network fee: {ESTIMATED_NETWORK_FEE_XLM.toFixed(2)} XLM
					</span>
					<span className="flex items-center gap-1">
						Wallet: {address ? <AddressDisplay address={address} showCopyButton={false} showExplorerLink={false} /> : "Connect to begin"}
					</span>
				</div>
			</section>

			<div className={styles.Layout}>
				<Card>
					<ol className={styles.StepRail}>
						{steps.map((label, index) => {
							const state =
								index === stepIndex
									? "active"
									: index < stepIndex
										? "done"
										: "upcoming"
							return (
								<li
									key={label}
									className={styles.StepRow}
									data-state={state}
									aria-current={index === stepIndex ? "step" : undefined}
								>
									<div className={styles.StepIndex}>{index + 1}</div>
									<div>
										<p className={styles.StepLabel}>{label}</p>
										<p className={styles.StepCaption}>
											{index === 0
												? "Check balance and threshold"
												: index === 1
													? "Describe the program"
													: index === 2
														? "Break funding into 3 milestones"
														: index === 3
															? "Review, confirm, and sign"
															: "Track hash and DAO link"}
										</p>
									</div>
								</li>
							)
						})}
					</ol>
				</Card>

				<div className={styles.MainColumn}>
					<Card>
						{stepIndex === 0 && (
							<div className={styles.StepPanel}>
								<h2 ref={stepHeadingRef} tabIndex={-1}>
									Eligibility check
								</h2>
								<p className={styles.StepDescription}>
									Your LRN balance is checked as soon as a wallet is connected.
									If a generated LearnToken client is available, the form reads
									the contract balance first and falls back to the wallet asset
									view otherwise.
								</p>
								<div className={styles.StatGrid}>
									<div className={styles.StatCard}>
										<span className={styles.StatLabel}>Connected wallet</span>
										<strong>
											{address ? <AddressDisplay address={address} /> : "Not connected"}
										</strong>
									</div>
									<div className={styles.StatCard}>
										<span className={styles.StatLabel}>
											Current LRN balance
										</span>
										<strong>
											{isCheckingEligibility
												? "Checking..."
												: `${formatLrnBalance(eligibilityBalance)} LRN`}
										</strong>
									</div>
									<div className={styles.StatCard}>
										<span className={styles.StatLabel}>Threshold</span>
										<strong>{formatLrnBalance(minLrnRequired)} LRN</strong>
									</div>
									<div className={styles.StatCard}>
										<span className={styles.StatLabel}>Eligibility status</span>
										<strong
											id={eligibilityStatusId}
											className={
												eligible ? styles.SuccessText : styles.WarningText
											}
											aria-live="polite"
										>
											{eligible
												? "Eligible to continue"
												: "Below the required threshold"}
										</strong>
									</div>
								</div>
								<p className={styles.HelperText}>
									Balance source:{" "}
									{eligibilitySource === "contract"
										? "LearnToken contract"
										: eligibilitySource === "wallet"
											? "wallet asset fallback"
											: "no wallet connected"}
								</p>
								{errors.eligibility && (
									<p
										id={eligibilityErrorId}
										className={styles.ErrorText}
										role="alert"
									>
										{errors.eligibility}
									</p>
								)}
							</div>
						)}

						{stepIndex === 1 && (
							<div className={styles.StepPanel}>
								<h2 ref={stepHeadingRef} tabIndex={-1}>
									Program details
								</h2>
								<p className={styles.StepDescription}>
									Share where you want to study, what you plan to learn, and
									when the program begins.
								</p>
								<div className={styles.FormGrid}>
									<label
										className={styles.Field}
										htmlFor="scholarship-program-name"
									>
										<span>Program or bootcamp name</span>
										<input
											id="scholarship-program-name"
											value={formValues.programName}
											onChange={(event) =>
												updateField("programName", event.target.value)
											}
											placeholder="Soroban builder bootcamp"
											aria-invalid={Boolean(errors.programName)}
											aria-describedby={joinIds(
												errors.programName && "scholarship-program-name-error",
											)}
										/>
										{errors.programName && (
											<span
												id="scholarship-program-name-error"
												className={styles.ErrorText}
												role="alert"
											>
												{errors.programName}
											</span>
										)}
									</label>
									<label
										className={styles.Field}
										htmlFor="scholarship-program-url"
									>
										<span>Program URL</span>
										<input
											id="scholarship-program-url"
											type="url"
											value={formValues.programUrl}
											onChange={(event) =>
												updateField("programUrl", event.target.value)
											}
											placeholder="https://example.com/program"
											autoComplete="url"
											aria-invalid={Boolean(errors.programUrl)}
											aria-describedby={joinIds(
												errors.programUrl && "scholarship-program-url-error",
											)}
										/>
										{errors.programUrl && (
											<span
												id="scholarship-program-url-error"
												className={styles.ErrorText}
												role="alert"
											>
												{errors.programUrl}
											</span>
										)}
									</label>
									<label
										className={`${styles.Field} ${styles.FullWidth}`}
										htmlFor="scholarship-program-description"
									>
										<span>Why this program matters</span>
										<textarea
											id="scholarship-program-description"
											rows={5}
											value={formValues.programDescription}
											onChange={(event) =>
												updateField("programDescription", event.target.value)
											}
											placeholder="Describe the skills you plan to build and how the scholarship changes your trajectory."
											aria-invalid={Boolean(errors.programDescription)}
											aria-describedby={joinIds(
												errors.programDescription &&
													"scholarship-program-description-error",
											)}
										/>
										{errors.programDescription && (
											<span
												id="scholarship-program-description-error"
												className={styles.ErrorText}
												role="alert"
											>
												{errors.programDescription}
											</span>
										)}
									</label>
									<label
										className={styles.Field}
										htmlFor="scholarship-start-date"
									>
										<span>Program start date</span>
										<input
											id="scholarship-start-date"
											type="date"
											value={formValues.startDate}
											onChange={(event) =>
												updateField("startDate", event.target.value)
											}
											aria-invalid={Boolean(errors.startDate)}
											aria-describedby={joinIds(
												errors.startDate && "scholarship-start-date-error",
											)}
										/>
										{errors.startDate && (
											<span
												id="scholarship-start-date-error"
												className={styles.ErrorText}
												role="alert"
											>
												{errors.startDate}
											</span>
										)}
									</label>
								</div>
							</div>
						)}

						{stepIndex === 2 && (
							<div className={styles.StepPanel}>
								<h2 ref={stepHeadingRef} tabIndex={-1}>
									Funding request
								</h2>
								<p className={styles.StepDescription}>
									Break the request into three concrete milestones the DAO can
									review and track over time.
								</p>
								<label
									className={styles.Field}
									htmlFor="scholarship-amount-usdc"
								>
									<span>Requested amount (USDC)</span>
									<input
										id="scholarship-amount-usdc"
										type="number"
										min="0"
										step="0.0000001"
										value={formValues.amountUsdc}
										onChange={(event) =>
											updateField("amountUsdc", event.target.value)
										}
										placeholder="1500"
										aria-invalid={Boolean(errors.amountUsdc)}
										aria-describedby={joinIds(
											errors.amountUsdc && "scholarship-amount-usdc-error",
										)}
									/>
									{errors.amountUsdc && (
										<span
											id="scholarship-amount-usdc-error"
											className={styles.ErrorText}
											role="alert"
										>
											{errors.amountUsdc}
										</span>
									)}
								</label>

								<div className={styles.MilestoneStack}>
									{formValues.milestones.map((milestone, index) => {
										const descriptionError =
											errors[`milestones.${index}.description`]
										const dueDateError = errors[`milestones.${index}.dueDate`]
										return (
											<fieldset
												key={`milestone-${index}`}
												className={styles.MilestoneCard}
											>
												<legend>Milestone {index + 1}</legend>
												<label
													className={styles.Field}
													htmlFor={`milestone-${index}-description`}
												>
													<span>Description</span>
													<textarea
														id={`milestone-${index}-description`}
														rows={3}
														value={milestone.description}
														onChange={(event) =>
															updateMilestone(
																index,
																"description",
																event.target.value,
															)
														}
														placeholder="What will be delivered at this checkpoint?"
														aria-invalid={Boolean(descriptionError)}
														aria-describedby={joinIds(
															descriptionError &&
																`milestone-${index}-description-error`,
														)}
													/>
													{descriptionError && (
														<span
															id={`milestone-${index}-description-error`}
															className={styles.ErrorText}
															role="alert"
														>
															{descriptionError}
														</span>
													)}
												</label>
												<label
													className={styles.Field}
													htmlFor={`milestone-${index}-due-date`}
												>
													<span>Target date</span>
													<input
														id={`milestone-${index}-due-date`}
														type="date"
														value={milestone.dueDate}
														onChange={(event) =>
															updateMilestone(
																index,
																"dueDate",
																event.target.value,
															)
														}
														aria-invalid={Boolean(dueDateError)}
														aria-describedby={joinIds(
															dueDateError &&
																`milestone-${index}-due-date-error`,
														)}
													/>
													{dueDateError && (
														<span
															id={`milestone-${index}-due-date-error`}
															className={styles.ErrorText}
															role="alert"
														>
															{dueDateError}
														</span>
													)}
												</label>
											</fieldset>
										)
									})}
								</div>
							</div>
						)}

						{stepIndex === 3 && (
							<div className={styles.StepPanel}>
								<h2 ref={stepHeadingRef} tabIndex={-1}>
									Review & submit
								</h2>
								<p className={styles.StepDescription}>
									Review the proposal summary, confirm the connected wallet, and
									sign the transaction when prompted.
								</p>
								<div className={styles.ReviewGrid}>
									<div className={styles.ReviewBlock}>
										<span>Program</span>
										<strong>
											{formValues.programName || "Not provided yet"}
										</strong>
										<p>
											{formValues.programUrl || "No program URL added yet."}
										</p>
									</div>
									<div className={styles.ReviewBlock}>
										<span>Funding request</span>
										<strong>
											{formatUsdcAmount(formValues.amountUsdc || 0)}
										</strong>
										<p>
											Estimated network fee:{" "}
											{ESTIMATED_NETWORK_FEE_XLM.toFixed(2)} XLM
										</p>
									</div>
									<div className={`${styles.ReviewBlock} ${styles.FullWidth}`}>
										<span>Learning goal</span>
										<p>
											{formValues.programDescription ||
												"No description added yet."}
										</p>
									</div>
									<div className={`${styles.ReviewBlock} ${styles.FullWidth}`}>
										<span>Milestones</span>
										<div className={styles.ReviewMilestones}>
											{formValues.milestones.map((milestone, index) => (
												<div
													key={`review-${index}`}
													className={styles.ReviewMilestone}
												>
													<strong>Milestone {index + 1}</strong>
													<p>
														{milestone.description || "Description pending"}
													</p>
													<span>{milestone.dueDate || "Date pending"}</span>
												</div>
											))}
										</div>
									</div>
								</div>

								<label
									className={styles.CheckboxRow}
									htmlFor="wallet-confirmed"
								>
									<input
										id="wallet-confirmed"
										type="checkbox"
										checked={formValues.walletConfirmed}
										onChange={(event) =>
											updateField("walletConfirmed", event.target.checked)
										}
										aria-invalid={Boolean(errors.walletConfirmed)}
										aria-describedby={joinIds(
											errors.walletConfirmed && "wallet-confirmed-error",
											submitError && submitErrorId,
										)}
									/>
									<span className={styles.CheckboxText}>
										I confirm that{" "}
										{address ? <AddressDisplay address={address} showCopyButton={false} showExplorerLink={false} /> : "the connected wallet"}
										should receive scholarship disbursements.
									</span>
								</label>
								{errors.walletConfirmed && (
									<p
										id="wallet-confirmed-error"
										className={styles.ErrorText}
										role="alert"
									>
										{errors.walletConfirmed}
									</p>
								)}
								{submitError && (
									<p
										id={submitErrorId}
										className={styles.ErrorText}
										role="alert"
									>
										{submitError}
									</p>
								)}
							</div>
						)}

						{stepIndex === 4 && confirmationProposal && (
							<div className={styles.StepPanel}>
								<h2 ref={stepHeadingRef} tabIndex={-1}>
									Confirmation
								</h2>
								<p className={styles.StepDescription}>
									Your proposal has been recorded and linked back into the DAO
									view.
								</p>
								<div className={styles.StatGrid}>
									<div className={styles.StatCard}>
										<span className={styles.StatLabel}>Proposal ID</span>
										<strong>{confirmationProposal.proposalId}</strong>
									</div>
									<div className={styles.StatCard}>
										<span className={styles.StatLabel}>Submission source</span>
										<strong>{confirmationProposal.source}</strong>
									</div>
									<div className={`${styles.StatCard} ${styles.FullWidth}`}>
										<span className={styles.StatLabel}>Transaction hash</span>
										<strong>
											{confirmationProposal.txHash ??
												"No hash returned in fallback mode"}
										</strong>
									</div>
								</div>
								<div className={styles.ActionRow}>
									<Link to={confirmationProposal.daoPath}>
										<Button variant="primary" size="md">
											View on DAO page
										</Button>
									</Link>
									{transactionUrl && (
										<a href={transactionUrl} target="_blank" rel="noreferrer">
											<Button variant="tertiary" size="md">
												Open transaction
											</Button>
										</a>
									)}
									<Button
										variant="secondary"
										size="md"
										onClick={resetApplication}
									>
										Start another proposal
									</Button>
								</div>
							</div>
						)}

						{stepIndex < 4 && (
							<div className={styles.ActionRow}>
								<Button
									variant="tertiary"
									size="md"
									onClick={() =>
										setStepIndex((current) => Math.max(current - 1, 0))
									}
									disabled={stepIndex === 0 || isSubmitting}
								>
									Back
								</Button>
								{stepIndex < 3 ? (
									<Button
										variant="primary"
										size="md"
										onClick={goToNextStep}
										disabled={isSubmitting}
									>
										Continue
									</Button>
								) : (
									<Button
										variant="primary"
										size="md"
										onClick={handleSubmit}
										disabled={isSubmitting}
									>
										{isSubmitting ? "Submitting..." : "Sign & submit"}
									</Button>
								)}
							</div>
						)}
					</Card>
				</div>
			</div>
		</div>
	)
}
