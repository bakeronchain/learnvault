import { z } from "zod"
import { labPrefix, stellarNetwork } from "../contracts/util"

const STORAGE_KEY = "learnvault:scholarship-proposals:v1"
const TOKEN_DECIMALS = 7n
const DECIMAL_FACTOR = 10n ** TOKEN_DECIMALS
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/

const readEnv = (key: string): string | undefined => {
	const value = (import.meta.env as Record<string, unknown>)[key]
	return typeof value === "string" && value.trim().length > 0
		? value.trim()
		: undefined
}

const readNumberEnv = (key: string, fallback: number): number => {
	const raw = readEnv(key)
	if (!raw) return fallback
	const parsed = Number(raw)
	return Number.isFinite(parsed) ? parsed : fallback
}

export const SCHOLARSHIP_TREASURY_CONTRACT = readEnv(
	"PUBLIC_SCHOLARSHIP_TREASURY_CONTRACT",
)
export const LEARN_TOKEN_CONTRACT = readEnv("PUBLIC_LEARN_TOKEN_CONTRACT")
export const SCHOLARSHIP_MIN_LRN = readNumberEnv(
	"PUBLIC_SCHOLARSHIP_MIN_LRN",
	100,
)
export const ESTIMATED_NETWORK_FEE_XLM = 0.02

export interface ScholarshipMilestoneFormValue {
	description: string
	dueDate: string
}

export interface ScholarshipApplicationFormValues {
	programName: string
	programUrl: string
	programDescription: string
	startDate: string
	amountUsdc: string
	milestones: ScholarshipMilestoneFormValue[]
	walletConfirmed: boolean
}

export interface StoredScholarshipProposal extends ScholarshipApplicationFormValues {
	id: string
	proposalId: string
	applicant: string
	submittedAt: string
	status: "pending"
	source: "on-chain" | "local-fallback"
	txHash?: string
	daoPath: string
}

const dateSchema = z
	.string()
	.trim()
	.regex(DATE_PATTERN, "Use the YYYY-MM-DD format")
	.refine(
		(value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)),
		"Enter a valid date",
	)

export const milestoneSchema = z.object({
	description: z
		.string()
		.trim()
		.min(12, "Describe what this milestone covers")
		.max(140, "Keep each milestone under 140 characters"),
	dueDate: dateSchema,
})

export const programDetailsSchema = z.object({
	programName: z
		.string()
		.trim()
		.min(3, "Enter the program or bootcamp name")
		.max(80, "Keep the name under 80 characters"),
	programUrl: z.string().trim().url("Enter a valid URL, including https://"),
	programDescription: z
		.string()
		.trim()
		.min(40, "Add more detail about your learning goal")
		.max(600, "Keep the description under 600 characters"),
	startDate: dateSchema,
})

export const fundingRequestSchema = z.object({
	amountUsdc: z
		.string()
		.trim()
		.min(1, "Enter the USDC amount requested")
		.refine(
			(value) => /^\d+(\.\d{1,7})?$/.test(value),
			"Use up to 7 decimal places",
		)
		.refine((value) => Number(value) > 0, "Request an amount above 0 USDC"),
	milestones: z
		.array(milestoneSchema)
		.length(3, "Provide exactly 3 milestone checkpoints"),
})

export const reviewSchema = z.object({
	walletConfirmed: z
		.boolean()
		.refine((value) => value, "Confirm the connected wallet before submitting"),
})

export const scholarshipApplicationSchema = z
	.object({
		...programDetailsSchema.shape,
		...fundingRequestSchema.shape,
		...reviewSchema.shape,
	})
	.superRefine((values, ctx) => {
		const startDateValue = Date.parse(`${values.startDate}T00:00:00Z`)
		let previousDate = startDateValue

		values.milestones.forEach((milestone, index) => {
			const dueDateValue = Date.parse(`${milestone.dueDate}T00:00:00Z`)
			if (dueDateValue < startDateValue) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["milestones", index, "dueDate"],
					message: "Milestones should not start before the program start date",
				})
			}
			if (dueDateValue < previousDate) {
				ctx.addIssue({
					code: z.ZodIssueCode.custom,
					path: ["milestones", index, "dueDate"],
					message: "Milestone dates should move forward chronologically",
				})
			}
			previousDate = dueDateValue
		})
	})

export const emptyScholarshipApplication =
	(): ScholarshipApplicationFormValues => ({
		programName: "",
		programUrl: "",
		programDescription: "",
		startDate: "",
		amountUsdc: "",
		milestones: [
			{ description: "", dueDate: "" },
			{ description: "", dueDate: "" },
			{ description: "", dueDate: "" },
		],
		walletConfirmed: false,
	})

export const flattenZodErrors = (error: z.ZodError): Record<string, string> => {
	const next: Record<string, string> = {}
	for (const issue of error.issues) {
		const path = issue.path.length > 0 ? issue.path.join(".") : "form"
		if (!next[path]) {
			next[path] = issue.message
		}
	}
	return next
}

export const parseDisplayBalance = (value: string | undefined): number => {
	if (!value) return 0
	return Number(value.replace(/,/g, "")) || 0
}

export const formatLrnBalance = (value: number): string =>
	new Intl.NumberFormat(undefined, {
		maximumFractionDigits: 2,
	}).format(value)

export const formatUsdcAmount = (value: string | number): string => {
	const numeric = typeof value === "number" ? value : Number(value)
	return new Intl.NumberFormat(undefined, {
		style: "currency",
		currency: "USD",
		maximumFractionDigits: 2,
	}).format(Number.isFinite(numeric) ? numeric : 0)
}

export const shortenAddress = (value: string): string => {
	if (value.length <= 12) return value
	return `${value.slice(0, 6)}...${value.slice(-4)}`
}

export const buildDaoProposalPath = (proposalId: string): string =>
	`/dao#proposal-${proposalId}`

export const explorerTransactionUrl = (txHash: string): string => {
	switch (stellarNetwork) {
		case "PUBLIC":
			return `https://stellar.expert/explorer/public/tx/${txHash}`
		case "TESTNET":
			return `https://stellar.expert/explorer/testnet/tx/${txHash}`
		case "FUTURENET":
			return `https://stellar.expert/explorer/futurenet/tx/${txHash}`
		default:
			return labPrefix()
	}
}

export const createStoredScholarshipProposal = (
	values: ScholarshipApplicationFormValues,
	options: {
		applicant: string
		proposalId: string
		source: "on-chain" | "local-fallback"
		txHash?: string
	},
): StoredScholarshipProposal => ({
	...values,
	id:
		typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
			? crypto.randomUUID()
			: `${Date.now()}`,
	proposalId: options.proposalId,
	applicant: options.applicant,
	submittedAt: new Date().toISOString(),
	status: "pending",
	source: options.source,
	txHash: options.txHash,
	daoPath: buildDaoProposalPath(options.proposalId),
})

export const readStoredScholarshipProposals =
	(): StoredScholarshipProposal[] => {
		if (typeof window === "undefined") return []
		const raw = window.localStorage.getItem(STORAGE_KEY)
		if (!raw) return []
		try {
			const parsed = JSON.parse(raw) as StoredScholarshipProposal[]
			return Array.isArray(parsed)
				? [...parsed].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt))
				: []
		} catch {
			return []
		}
	}

export const storeScholarshipProposal = (
	proposal: StoredScholarshipProposal,
): StoredScholarshipProposal[] => {
	const existing = readStoredScholarshipProposals().filter(
		(item) => item.id !== proposal.id,
	)
	const next = [proposal, ...existing].sort((a, b) =>
		b.submittedAt.localeCompare(a.submittedAt),
	)
	if (typeof window !== "undefined") {
		window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next.slice(0, 30)))
	}
	return next
}

export const amountToAtomicUnits = (value: string): bigint => {
	const [wholePart, fractionalPart = ""] = value.trim().split(".")
	const whole = BigInt(wholePart || "0")
	const fraction = BigInt(
		`${fractionalPart.padEnd(Number(TOKEN_DECIMALS), "0").slice(0, Number(TOKEN_DECIMALS)) || "0"}`,
	)
	return whole * DECIMAL_FACTOR + fraction
}

export const atomicUnitsToDisplayAmount = (
	value: bigint | number | string,
): number => {
	const units =
		typeof value === "bigint"
			? value
			: typeof value === "number"
				? BigInt(Math.trunc(value))
				: BigInt(value)
	return Number(units) / Number(DECIMAL_FACTOR)
}
