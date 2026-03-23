import { useCallback, useEffect, useMemo, useState } from "react"
import { rpcUrl } from "../contracts/util"
import { useNotification } from "./useNotification"
import { useWallet } from "./useWallet"

export interface Course {
	id: string
	title?: string
}

export interface MilestoneProgress {
	courseId: string
	completedMilestoneIds: number[]
}

type AnyRecord = Record<string, unknown>

const mockProgressStore: Record<string, number[]> = {}
const mockEnrollments = new Set<string>()

const readEnv = (key: string): string | undefined => {
	const value = (import.meta.env as Record<string, unknown>)[key]
	return typeof value === "string" && value.length ? value : undefined
}

const COURSE_MILESTONE_CONTRACT = readEnv("PUBLIC_COURSE_MILESTONE_CONTRACT")
const LEARN_TOKEN_CONTRACT = readEnv("PUBLIC_LEARN_TOKEN_CONTRACT")

const toArray = (value: unknown): unknown[] =>
	Array.isArray(value) ? value : []

const toNumberArray = (value: unknown): number[] =>
	toArray(value)
		.map((v) => Number(v))
		.filter((v) => Number.isFinite(v))

const asMethod = (
	obj: unknown,
	name: string,
): ((...args: unknown[]) => unknown) | null => {
	if (!obj || typeof obj !== "object") return null
	const fn = (obj as AnyRecord)[name]
	return typeof fn === "function"
		? (fn as (...args: unknown[]) => unknown)
		: null
}

const resolveResultValue = (result: unknown): unknown => {
	if (result && typeof result === "object") {
		const maybe = result as AnyRecord
		if ("result" in maybe && maybe.result && typeof maybe.result === "object") {
			return maybe.result
		}
	}
	return result
}

const sendTxIfNeeded = async (
	maybeTx: unknown,
	signTransaction: ((...args: unknown[]) => unknown) | undefined,
): Promise<unknown> => {
	const txObj = maybeTx as AnyRecord
	if (
		txObj &&
		typeof txObj === "object" &&
		typeof txObj.signAndSend === "function"
	) {
		return (txObj.signAndSend as (...args: unknown[]) => Promise<unknown>)({
			signTransaction,
		})
	}
	return maybeTx
}

const loadCourseClient = async (): Promise<AnyRecord | null> => {
	try {
		const path = "../contracts/course_milestone"
		const mod = (await import(/* @vite-ignore */ path)) as AnyRecord
		return (mod.default as AnyRecord) ?? mod
	} catch {
		return null
	}
}

const callFirst = async (
	client: AnyRecord,
	methodNames: string[],
	args: unknown[],
): Promise<unknown> => {
	for (const name of methodNames) {
		const fn = asMethod(client, name)
		if (!fn) continue
		try {
			return await Promise.resolve(fn(...args))
		} catch {
			continue
		}
	}
	throw new Error(`No compatible method found: ${methodNames.join(", ")}`)
}

const waitForMintEvent = async (
	walletAddress: string,
	timeoutMs = 15000,
): Promise<number | null> => {
	if (!LEARN_TOKEN_CONTRACT) return null
	const deadline = Date.now() + timeoutMs
	let lastEarned: number | null = null

	while (Date.now() < deadline) {
		try {
			const response = await fetch(rpcUrl, {
				method: "POST",
				headers: { "content-type": "application/json" },
				body: JSON.stringify({
					jsonrpc: "2.0",
					id: "wait-lrn-mint",
					method: "getEvents",
					params: {
						filters: [
							{ type: "contract", contractIds: [LEARN_TOKEN_CONTRACT] },
						],
						pagination: { limit: 20 },
					},
				}),
			})
			if (response.ok) {
				const payload = (await response.json()) as {
					result?: { events?: Array<Record<string, unknown>> }
				}
				const events = payload.result?.events ?? []
				for (const evt of events) {
					const raw = JSON.stringify(evt).toLowerCase()
					if (
						!raw.includes(walletAddress.toLowerCase()) ||
						!raw.includes("mint")
					) {
						continue
					}
					const num = raw
						.match(/-?\d+(\.\d+)?/g)
						?.map(Number)
						.find((n) => n > 0)
					lastEarned = num ?? null
					return lastEarned
				}
			}
		} catch {
			// ignore polling errors; continue until timeout
		}
		await new Promise((resolve) => setTimeout(resolve, 1000))
	}
	return lastEarned
}

export function useCourse() {
	const { address, signTransaction } = useWallet()
	const { addNotification } = useNotification()

	const [enrolledCourses, setEnrolledCourses] = useState<Course[]>([])
	const [progressMap, setProgressMap] = useState<
		Record<string, MilestoneProgress>
	>({})
	const [isCompletingMilestone, setIsCompletingMilestone] = useState(false)

	const refreshCourses = useCallback(async () => {
		if (!address) {
			setEnrolledCourses([])
			setProgressMap({})
			return
		}

		const client = await loadCourseClient()
		if (!client || !COURSE_MILESTONE_CONTRACT) {
			const mockCourses = Array.from(mockEnrollments).map((id) => ({ id }))
			setEnrolledCourses(mockCourses)
			setProgressMap((prev) => {
				const next = { ...prev }
				for (const id of mockEnrollments) {
					next[id] = {
						courseId: id,
						completedMilestoneIds: mockProgressStore[id] ?? [],
					}
				}
				return next
			})
			return
		}

		try {
			const raw = await callFirst(
				client,
				[
					"get_enrolled_courses",
					"getEnrolledCourses",
					"courses_for",
					"coursesFor",
				],
				[{ learner: address, user: address, wallet: address }],
			)
			const value = resolveResultValue(raw)
			const ids = toArray(value).map((v) => String(v))
			const courses = ids.map((id) => ({ id }))
			setEnrolledCourses(courses)

			const entries = await Promise.all(
				ids.map(async (id) => ({
					id,
					progress: await (async () => {
						try {
							const rawProgress = await callFirst(
								client,
								[
									"get_course_progress",
									"getCourseProgress",
									"course_progress_for",
									"courseProgressFor",
								],
								[{ learner: address, course_id: id, courseId: id }],
							)
							return toNumberArray(resolveResultValue(rawProgress))
						} catch {
							return []
						}
					})(),
				})),
			)
			setProgressMap(
				Object.fromEntries(
					entries.map(({ id, progress }) => [
						id,
						{ courseId: id, completedMilestoneIds: progress },
					]),
				),
			)
		} catch {
			addNotification(
				"Unable to load enrolled courses from CourseMilestone",
				"warning",
			)
		}
	}, [address, addNotification])

	useEffect(() => {
		void refreshCourses()
	}, [refreshCourses])

	const getCourseProgress = useCallback(
		(courseId: string): MilestoneProgress => {
			return progressMap[courseId] ?? { courseId, completedMilestoneIds: [] }
		},
		[progressMap],
	)

	const enroll = useCallback(
		async (courseId: string) => {
			if (!address) {
				addNotification("Connect wallet before enrolling", "warning")
				return
			}

			const client = await loadCourseClient()
			if (!client || !COURSE_MILESTONE_CONTRACT) {
				mockEnrollments.add(courseId)
				setEnrolledCourses((prev) =>
					prev.find((c) => c.id === courseId)
						? prev
						: [...prev, { id: courseId }],
				)
				addNotification("Enrolled (local fallback mode)", "success")
				return
			}

			try {
				const rawTx = await callFirst(
					client,
					["enroll", "enroll_course", "enrollCourse"],
					[
						{ course_id: courseId, courseId, learner: address },
						{ publicKey: address },
					],
				)
				await sendTxIfNeeded(
					rawTx,
					signTransaction as (...args: unknown[]) => unknown,
				)
				addNotification("Enrollment successful", "success")
				await refreshCourses()
			} catch {
				addNotification("Enrollment failed", "error")
			}
		},
		[address, addNotification, refreshCourses, signTransaction],
	)

	const completeMilestone = useCallback(
		async (courseId: string, milestoneId: number) => {
			if (!address) {
				addNotification(
					"Connect wallet before completing milestones",
					"warning",
				)
				return
			}

			const already =
				getCourseProgress(courseId).completedMilestoneIds.includes(milestoneId)
			if (already) {
				addNotification("Milestone already completed", "secondary")
				return
			}

			setIsCompletingMilestone(true)
			try {
				const client = await loadCourseClient()
				if (!client || !COURSE_MILESTONE_CONTRACT) {
					mockEnrollments.add(courseId)
					const updatedProgress = [
						...(mockProgressStore[courseId] ?? []),
						milestoneId,
					]
					mockProgressStore[courseId] = updatedProgress
					setProgressMap((prev) => ({
						...prev,
						[courseId]: {
							courseId,
							completedMilestoneIds: updatedProgress,
						},
					}))
					addNotification(
						"Milestone completed (local fallback mode)",
						"success",
					)
					return
				}

				const rawTx = await callFirst(
					client,
					[
						"complete_milestone",
						"completeMilestone",
						"complete_course_milestone",
						"completeCourseMilestone",
					],
					[
						{
							course_id: courseId,
							courseId,
							milestone_id: BigInt(milestoneId),
							milestoneId: BigInt(milestoneId),
							learner: address,
						},
						{ publicKey: address },
					],
				)
				await sendTxIfNeeded(
					rawTx,
					signTransaction as (...args: unknown[]) => unknown,
				)

				const earned = await waitForMintEvent(address)
				addNotification(
					earned != null
						? `Milestone complete. Earned ${earned} LRN`
						: "Milestone complete. LRN mint event confirmed",
					"success",
				)
				await refreshCourses()
			} catch {
				addNotification("Failed to complete milestone", "error")
			} finally {
				setIsCompletingMilestone(false)
			}
		},
		[
			address,
			addNotification,
			getCourseProgress,
			refreshCourses,
			signTransaction,
		],
	)

	return useMemo(
		() => ({
			enrolledCourses,
			getCourseProgress,
			enroll,
			completeMilestone,
			isCompletingMilestone,
		}),
		[
			enrolledCourses,
			getCourseProgress,
			enroll,
			completeMilestone,
			isCompletingMilestone,
		],
	)
}
