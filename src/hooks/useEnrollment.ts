import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback, useMemo, useRef, useState } from "react"
import { apiFetchJson } from "../lib/api"
import {
	queryIsEnrolled,
	submitEnrollTransaction,
} from "../lib/courseMilestoneContract"
import { isUserRejection } from "../utils/errors"
import { useContractIds } from "./useContractIds"
import { useWallet } from "./useWallet"

const ENROLLMENTS_QUERY_KEY = ["enrollments"] as const
const ONCHAIN_ENROLLMENT_KEY = "on-chain-existing"

type EnrollmentRecord = {
	course_id: string
	enrollment_id?: number
	tx_hash?: string
}

type EnrollmentsResponse = {
	data?: EnrollmentRecord[]
}

type CourseDetailResponse = {
	slug?: string
	lessons?: Array<{ id: number | string; order?: number; order_index?: number }>
}

async function fetchPersistedEnrollments(
	learnerAddress: string,
): Promise<EnrollmentRecord[]> {
	const response = await fetch(
		`/api/enrollments?learner_address=${encodeURIComponent(learnerAddress)}`,
		{ headers: { "Content-Type": "application/json" } },
	)
	if (!response.ok) {
		throw new Error("Failed to load enrollments")
	}
	const payload = (await response.json()) as EnrollmentsResponse
	return payload.data ?? []
}

async function fetchFirstLessonPath(
	courseSlug: string,
): Promise<string | null> {
	const response = await fetch(
		`/api/courses/${encodeURIComponent(courseSlug)}`,
		{
			headers: { "Content-Type": "application/json" },
		},
	)
	if (!response.ok) return null

	const payload = (await response.json()) as CourseDetailResponse
	const slug = payload.slug ?? courseSlug
	const lessons = [...(payload.lessons ?? [])].sort((left, right) => {
		const leftOrder =
			typeof left.order === "number"
				? left.order
				: Number(left.order_index ?? 0)
		const rightOrder =
			typeof right.order === "number"
				? right.order
				: Number(right.order_index ?? 0)
		return leftOrder - rightOrder
	})

	const firstLesson = lessons[0]
	if (!firstLesson) return null

	return `/courses/${slug}/lessons/${firstLesson.id}`
}

async function persistEnrollment(options: {
	learnerAddress: string
	courseId: string
	txHash: string
}): Promise<void> {
	await apiFetchJson<{ enrollment_id: number; enrolled_at: string }>(
		"/api/enrollments",
		{
			method: "POST",
			auth: true,
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				learner_address: options.learnerAddress,
				course_id: options.courseId,
				tx_hash: options.txHash,
			}),
		},
	)
}

function isEnrollmentCancellation(error: unknown): boolean {
	if (isUserRejection(error)) return true
	if (!(error instanceof Error)) return false
	const message = error.message.toLowerCase()
	return (
		message.includes("reject") ||
		message.includes("cancel") ||
		message.includes("denied")
	)
}

export interface UseEnrollmentResult {
	isEnrolled: boolean
	isChecking: boolean
	isEnrolling: boolean
	needsPersistence: boolean
	error: string | null
	firstLessonPath: string | null
	enroll: () => Promise<string | null>
	retryPersistence: () => Promise<string | null>
}

export function useEnrollment(courseSlug: string): UseEnrollmentResult {
	const { address, signTransaction } = useWallet()
	const { courseMilestone, isDeployed } = useContractIds()
	const queryClient = useQueryClient()
	const enrollInFlightRef = useRef(false)
	const lastTxHashRef = useRef<string | null>(null)
	const [error, setError] = useState<string | null>(null)
	const [needsPersistence, setNeedsPersistence] = useState(false)

	const contractReady = isDeployed(courseMilestone)

	const enrollmentsQuery = useQuery({
		queryKey: [...ENROLLMENTS_QUERY_KEY, address],
		queryFn: () => fetchPersistedEnrollments(address!),
		enabled: Boolean(address),
		staleTime: 30_000,
	})

	const onChainQuery = useQuery({
		queryKey: ["enrollment-onchain", courseSlug, address, courseMilestone],
		queryFn: () => queryIsEnrolled(courseMilestone!, address!, courseSlug),
		enabled: Boolean(address && courseSlug && contractReady),
		staleTime: 30_000,
	})

	const firstLessonQuery = useQuery({
		queryKey: ["course-first-lesson", courseSlug],
		queryFn: () => fetchFirstLessonPath(courseSlug),
		enabled: Boolean(courseSlug),
		staleTime: 60_000,
	})

	const isEnrolledInDb = useMemo(
		() =>
			(enrollmentsQuery.data ?? []).some(
				(entry) => entry.course_id === courseSlug,
			),
		[enrollmentsQuery.data, courseSlug],
	)

	const isEnrolledOnChain = onChainQuery.data === true
	const isEnrolled = isEnrolledInDb
	const isChecking =
		Boolean(address) &&
		(enrollmentsQuery.isLoading ||
			(contractReady && onChainQuery.isLoading) ||
			firstLessonQuery.isLoading)

	const invalidateEnrollmentState = useCallback(
		async (options?: { skipEnrollments?: boolean }) => {
			const tasks = [
				queryClient.invalidateQueries({
					queryKey: [
						"enrollment-onchain",
						courseSlug,
						address,
						courseMilestone,
					],
				}),
			]
			if (!options?.skipEnrollments) {
				tasks.unshift(
					queryClient.invalidateQueries({ queryKey: ENROLLMENTS_QUERY_KEY }),
				)
			}
			await Promise.all(tasks)
		},
		[address, courseMilestone, courseSlug, queryClient],
	)

	const resolveLessonPath = useCallback(async (): Promise<string> => {
		return (
			firstLessonQuery.data ??
			(await fetchFirstLessonPath(courseSlug)) ??
			`/courses/${courseSlug}/lessons/1`
		)
	}, [courseSlug, firstLessonQuery.data])

	const completeEnrollment = useCallback(
		async (txHash: string): Promise<string | null> => {
			if (!address) return null

			await persistEnrollment({
				learnerAddress: address,
				courseId: courseSlug,
				txHash,
			})
			lastTxHashRef.current = null
			setNeedsPersistence(false)
			setError(null)
			queryClient.setQueryData(
				[...ENROLLMENTS_QUERY_KEY, address],
				(previous: EnrollmentRecord[] | undefined) => {
					const withoutCurrent = (previous ?? []).filter(
						(entry) => entry.course_id !== courseSlug,
					)
					return [...withoutCurrent, { course_id: courseSlug, tx_hash: txHash }]
				},
			)
			await invalidateEnrollmentState({ skipEnrollments: true })

			return resolveLessonPath()
		},
		[
			address,
			courseSlug,
			invalidateEnrollmentState,
			queryClient,
			resolveLessonPath,
		],
	)

	const enrollMutation = useMutation({
		mutationFn: async (): Promise<string | null> => {
			if (!address) {
				setError("Connect your wallet before enrolling")
				return null
			}
			if (enrollInFlightRef.current) {
				return null
			}
			if (isEnrolledInDb) {
				return resolveLessonPath()
			}

			enrollInFlightRef.current = true
			setError(null)

			try {
				let txHash = lastTxHashRef.current
				let alreadyOnChain = isEnrolledOnChain

				if (!alreadyOnChain && contractReady && courseMilestone) {
					alreadyOnChain = await queryIsEnrolled(
						courseMilestone,
						address,
						courseSlug,
					).catch(() => false)
				}

				if (!alreadyOnChain) {
					if (!contractReady || !courseMilestone) {
						throw new Error(
							"Course enrollment contract is not available on this network",
						)
					}

					txHash = await submitEnrollTransaction({
						contractId: courseMilestone,
						learnerAddress: address,
						courseId: courseSlug,
						signTransaction,
					})
					lastTxHashRef.current = txHash
					await queryClient.invalidateQueries({
						queryKey: [
							"enrollment-onchain",
							courseSlug,
							address,
							courseMilestone,
						],
					})
				} else {
					txHash = txHash ?? ONCHAIN_ENROLLMENT_KEY
					lastTxHashRef.current = txHash
				}

				return await completeEnrollment(txHash)
			} catch (err) {
				if (isEnrollmentCancellation(err)) {
					setNeedsPersistence(false)
					setError("Enrollment cancelled")
					return null
				}

				const hasOnChainProgress =
					Boolean(lastTxHashRef.current) ||
					isEnrolledOnChain ||
					onChainQuery.data === true

				if (hasOnChainProgress) {
					setNeedsPersistence(true)
					setError(
						err instanceof Error
							? err.message
							: "Enrollment saved on-chain but failed to sync with the server",
					)
				} else {
					setNeedsPersistence(false)
					setError(
						err instanceof Error
							? err.message
							: "Enrollment failed. Please try again.",
					)
				}
				return null
			} finally {
				enrollInFlightRef.current = false
			}
		},
	})

	const retryPersistence = useCallback(async (): Promise<string | null> => {
		if (!address) {
			setError("Connect your wallet before enrolling")
			return null
		}

		const txHash =
			lastTxHashRef.current ??
			(isEnrolledOnChain || onChainQuery.data ? ONCHAIN_ENROLLMENT_KEY : null)

		if (!txHash) {
			setError("No on-chain enrollment found to sync")
			return null
		}

		try {
			setError(null)
			return await completeEnrollment(txHash)
		} catch (err) {
			setNeedsPersistence(true)
			setError(
				err instanceof Error
					? err.message
					: "Failed to sync enrollment with the server",
			)
			return null
		}
	}, [address, completeEnrollment, isEnrolledOnChain, onChainQuery.data])

	return {
		isEnrolled,
		isChecking,
		isEnrolling: enrollMutation.isPending,
		needsPersistence,
		error,
		firstLessonPath: firstLessonQuery.data ?? null,
		enroll: enrollMutation.mutateAsync,
		retryPersistence,
	}
}
