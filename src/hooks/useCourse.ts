import { useCallback, useEffect, useMemo, useState } from "react"
import { useToast } from "../components/Toast/ToastProvider"
import { rpcUrl } from "../contracts/util"
import { ErrorCode, createAppError } from "../types/errors"
import { parseError, isUserRejection } from "../utils/errors"
import { useNotification } from "./useNotification"
import { useWallet } from "./useWallet"

export interface Course {
	id: string
	title?: string
	totalMilestones?: number
}

export interface MilestoneProgress {
	courseId: string
	completedMilestoneIds: number[]
	totalMilestones?: number
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
	} catch (err) {
		console.warn(
			createAppError(
				ErrorCode.CONTRACT_NOT_DEPLOYED,
				"CourseMilestone contract not available",
				{ contractName: "course_milestone" },
				err,
			),
		)
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
		} catch (err) {
			console.debug(`Method ${name} failed, trying next method:`, err)
			continue
		}
	}
	throw createAppError(
		ErrorCode.CONTRACT_NOT_DEPLOYED,
		"No compatible method found",
		{ methodName: methodNames.join(", ") },
	)
}

/**
 * Fetch the total milestone count for a course from the contract.
 * Falls back to undefined if the contract / method is unavailable.
 */
const fetchTotalMilestones = async (
	client: AnyRecord,
	courseId: string,
	address: string,
): Promise<number | undefined> => {
	try {
		const raw = await callFirst(
			client,
			[
				"get_course_milestone_count",
				"getCourseMilestoneCount",
				"milestone_count",
				"milestoneCount",
				"total_milestones",
				"totalMilestones",
			],
			[{ course_id: courseId, courseId, learner: address }],
		)
		const value = resolveResultValue(raw)
		const num = Number(value)
		return Number.isFinite(num) && num > 0 ? num : undefined
	} catch {
		return undefined
	}
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
		} catch (err) {
			console.debug("Polling for mint event failed, continuing:", err)
		}
		await new Promise((resolve) => setTimeout(resolve, 1000))
	}
	return lastEarned
}

export function useCourse() {
	const { address, signTransaction, updateBalances } = useWallet()
	const { addNotification } = useNotification()
	const { showWarning, showError, showInfo } = useToast()

	const [enrolledCourses, setEnrolledCourses] = useState<Course[]>([])
	const [progressMap, setProgressMap] = useState<
		Record<string, MilestoneProgress>
	>({})
	const [submissionStatusMap, setSubmissionStatusMap] = useState<
		Record<string, "pending" | "verified" | "rejected" | "none">
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

			// Fetch progress + total milestone count for each course in parallel
			const entries = await Promise.all(
				ids.map(async (id) => {
					const [completedMilestoneIds, totalMilestones] = await Promise.all([
						(async (): Promise<number[]> => {
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
						fetchTotalMilestones(client, id, address),
					])

					return { id, completedMilestoneIds, totalMilestones }
				}),
			)

			const courses: Course[] = entries.map(({ id, totalMilestones }) => ({
				id,
				totalMilestones,
			}))
			setEnrolledCourses(courses)

			setProgressMap(
				Object.fromEntries(
					entries.map(({ id, completedMilestoneIds, totalMilestones }) => [
						id,
						{ courseId: id, completedMilestoneIds, totalMilestones },
					]),
				),
			)
		} catch (err) {
			const appError = parseError(err)
			if (appError.code === ErrorCode.CONTRACT_NOT_DEPLOYED) {
				showWarning("CourseMilestone contract not available on this network")
			} else {
				showError("Unable to load enrolled courses. Please try again.")
			}
		}
	}, [address, showWarning, showError])

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
			} catch (err) {
				if (isUserRejection(err)) {
					showInfo("Enrollment cancelled")
				} else {
					showError("Enrollment failed. Please try again.")
				}
			}
		},
		[
			address,
			addNotification,
			refreshCourses,
			signTransaction,
			showError,
			showInfo,
		],
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
							...prev[courseId],
							courseId,
							completedMilestoneIds: updatedProgress,
						},
					}))
					addNotification(
						"Milestone completed (local fallback mode)",
						"success",
					)
					await updateBalances()
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

				setProgressMap((prev) => {
					const existing = prev[courseId] ?? {
						courseId,
						completedMilestoneIds: [],
					}
					if (existing.completedMilestoneIds.includes(milestoneId)) {
						return prev
					}
					return {
						...prev,
						[courseId]: {
							...existing,
							completedMilestoneIds: [
								...existing.completedMilestoneIds,
								milestoneId,
							],
						},
					}
				})

				const earned = await waitForMintEvent(address)
				addNotification(
					earned != null
						? `Milestone complete. Earned ${earned} LRN`
						: "Milestone complete. LRN mint event confirmed",
					"success",
				)
				await updateBalances()
				await refreshCourses()
			} catch (err) {
				if (isUserRejection(err)) {
					showInfo("Milestone completion cancelled")
				} else {
					showError("Failed to complete milestone. Please try again.")
				}
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
			updateBalances,
			showError,
			showInfo,
		],
	)

	const submitMilestone = useCallback(
		async (
			courseId: string,
			milestoneId: number,
			evidence: { github?: string; description?: string },
		) => {
			if (!address) {
				addNotification(
					"Connect wallet before submitting milestones",
					"warning",
				)
				return
			}

			const key = `${courseId}-${milestoneId}`
			if (submissionStatusMap[key] === "pending") {
				addNotification(
					"Milestone already submitted and pending review",
					"secondary",
				)
				return
			}

			setIsCompletingMilestone(true)
			try {
				// 1. Prepare API call
				const apiPromise = fetch("/api/milestones", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify({
						courseId,
						milestoneId: String(milestoneId),
						evidenceGithub: evidence.github || "",
						evidenceDescription: evidence.description || "",
						evidenceIpfsCid: "",
						acceptedTerms: true,
					}),
				})

				// 2. Prepare Contract call
				const client = await loadCourseClient()
				let contractPromise: Promise<unknown> = Promise.resolve()

				if (client && COURSE_MILESTONE_CONTRACT) {
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
					contractPromise = sendTxIfNeeded(
						rawTx,
						signTransaction as (...args: unknown[]) => unknown,
					)
				} else {
					// Fallback for mock/local
					mockEnrollments.add(courseId)
					const updatedProgress = [
						...(mockProgressStore[courseId] ?? []),
						milestoneId,
					]
					mockProgressStore[courseId] = updatedProgress
					setProgressMap((prev) => ({
						...prev,
						[courseId]: {
							...prev[courseId],
							courseId,
							completedMilestoneIds: updatedProgress,
						},
					}))
				}

				// 3. Run in parallel as requested
				await Promise.all([apiPromise, contractPromise])

				setSubmissionStatusMap((prev) => ({
					...prev,
					[key]: "pending",
				}))

				addNotification(
					"Milestone submitted — awaiting admin review",
					"success",
				)
				await updateBalances()
				await refreshCourses()
			} catch (err) {
				if (isUserRejection(err)) {
					showInfo("Submission cancelled")
				} else {
					showError(
						err instanceof Error
							? err.message
							: "Failed to submit milestone. Please try again.",
					)
				}
			} finally {
				setIsCompletingMilestone(false)
			}
		},
		[
			address,
			addNotification,
			submissionStatusMap,
			signTransaction,
			updateBalances,
			refreshCourses,
			showError,
			showInfo,
		],
	)

	return useMemo(
		() => ({
			enrolledCourses,
			getCourseProgress,
			enroll,
			completeMilestone,
			submitMilestone,
			submissionStatusMap,
			isCompletingMilestone,
		}),
		[
			enrolledCourses,
			getCourseProgress,
			enroll,
			completeMilestone,
			submitMilestone,
			submissionStatusMap,
			isCompletingMilestone,
		],
	)
}
