import { Button, Card } from "@stellar/design-system"
import { type FormEvent, useState } from "react"
import { type MilestoneReportFormValues } from "../types/milestone"

type MilestoneReportFormProps = {
	isSubmitting: boolean
	onSubmit: (values: MilestoneReportFormValues) => Promise<void>
	initialValues?: Partial<MilestoneReportFormValues>
}

const emptyValues: MilestoneReportFormValues = {
	courseId: "",
	milestoneId: "",
	evidenceGithub: "",
	evidenceIpfsCid: "",
	evidenceDescription: "",
	acceptedTerms: false,
}

export default function MilestoneReportForm({
	isSubmitting,
	onSubmit,
	initialValues,
}: MilestoneReportFormProps) {
	const [values, setValues] = useState<MilestoneReportFormValues>({
		...emptyValues,
		...initialValues,
	})
	const [error, setError] = useState<string | null>(null)

	const updateValue = <K extends keyof MilestoneReportFormValues>(
		field: K,
		value: MilestoneReportFormValues[K],
	) => {
		setValues((current) => ({ ...current, [field]: value }))
		setError(null)
	}

	const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
		event.preventDefault()

		if (!values.courseId.trim()) {
			setError("Course ID is required.")
			return
		}

		if (
			!values.milestoneId.trim() ||
			Number.isNaN(Number(values.milestoneId))
		) {
			setError("Milestone number must be a valid number.")
			return
		}

		if (
			!values.evidenceDescription.trim() &&
			!values.evidenceGithub.trim() &&
			!values.evidenceIpfsCid.trim()
		) {
			setError("Provide milestone notes, a GitHub link, or an IPFS CID.")
			return
		}

		if (!values.acceptedTerms) {
			setError("You must certify the milestone submission before sending it.")
			return
		}

		try {
			await onSubmit(values)
			if (!initialValues) {
				setValues(emptyValues)
			}
		} catch (error) {
			setError(
				error instanceof Error
					? error.message
					: "Failed to submit milestone report.",
			)
		}
	}

	return (
		<div className="rounded-[2rem] border border-white/10 bg-white/5 p-6 shadow-xl backdrop-blur-xl">
			<Card>
				<form className="space-y-6" onSubmit={handleSubmit}>
					<div className="space-y-2">
						<p className="text-xs font-black uppercase tracking-[0.3em] text-brand-cyan/70">
							Scholar milestone reporting
						</p>
						<h2 className="text-2xl font-black tracking-tight text-white">
							Submit a milestone completion report
						</h2>
						<p className="text-sm text-white/65">
							Send the validator committee the course, milestone, and evidence
							for the work you completed.
						</p>
					</div>

					{error ? (
						<p
							className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200"
							role="alert"
						>
							{error}
						</p>
					) : null}

					<div className="grid gap-4 md:grid-cols-2">
						<label className="space-y-2 text-sm text-white/80">
							<span className="font-semibold text-white">Course ID</span>
							<input
								value={values.courseId}
								onChange={(event) =>
									updateValue("courseId", event.target.value)
								}
								placeholder="stellar-basics"
								className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-brand-cyan/50"
							/>
						</label>

						<label className="space-y-2 text-sm text-white/80">
							<span className="font-semibold text-white">Milestone number</span>
							<input
								value={values.milestoneId}
								onChange={(event) =>
									updateValue("milestoneId", event.target.value)
								}
								inputMode="numeric"
								placeholder="1"
								className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-brand-cyan/50"
							/>
						</label>
					</div>

					<label className="block space-y-2 text-sm text-white/80">
						<span className="font-semibold text-white">Milestone notes</span>
						<textarea
							value={values.evidenceDescription}
							onChange={(event) =>
								updateValue("evidenceDescription", event.target.value)
							}
							rows={5}
							placeholder="Describe what you built, tested, or shipped for this milestone."
							className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-brand-cyan/50"
						/>
					</label>

					<div className="grid gap-4 md:grid-cols-2">
						<label className="space-y-2 text-sm text-white/80">
							<span className="font-semibold text-white">
								GitHub evidence link
							</span>
							<input
								value={values.evidenceGithub}
								onChange={(event) =>
									updateValue("evidenceGithub", event.target.value)
								}
								type="url"
								placeholder="https://github.com/..."
								className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-brand-cyan/50"
							/>
						</label>

						<label className="space-y-2 text-sm text-white/80">
							<span className="font-semibold text-white">IPFS CID</span>
							<input
								value={values.evidenceIpfsCid}
								onChange={(event) =>
									updateValue("evidenceIpfsCid", event.target.value)
								}
								placeholder="bafy..."
								className="w-full rounded-2xl border border-white/10 bg-black/20 px-4 py-3 text-white outline-none transition focus:border-brand-cyan/50"
							/>
						</label>
					</div>

					<label className="flex items-start gap-3 rounded-2xl border border-white/10 bg-black/10 px-4 py-4 text-sm text-white/75">
						<input
							type="checkbox"
							checked={values.acceptedTerms}
							onChange={(event) =>
								updateValue("acceptedTerms", event.target.checked)
							}
							className="mt-1"
						/>
						<span>
							I certify that this submission accurately represents my completed
							work and supporting evidence for this milestone.
						</span>
					</label>

					<div className="flex justify-end">
						<Button
							type="submit"
							variant="primary"
							size="md"
							disabled={isSubmitting}
						>
							{isSubmitting ? "Submitting..." : "Submit report"}
						</Button>
					</div>
				</form>
			</Card>
		</div>
	)
}
