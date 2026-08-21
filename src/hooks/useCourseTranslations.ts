import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { apiFetchJson } from "../lib/api"

export type TranslationStatus = "draft" | "in_review" | "published"

export interface GlossaryTerm {
	id: number
	term: string
	note: string | null
}

export interface CourseTranslationRecord {
	id: number
	courseId: number
	languageCode: string
	title: string
	description: string
	status: TranslationStatus
	translatorAddress: string
	reviewedByAddress: string | null
	sourceVersion: number
	isStale: boolean
	publishedAt: string | null
	updatedAt: string
}

export interface LessonTranslationRecord {
	id: number
	courseId: number
	orderIndex: number
	languageCode: string
	title: string
	content: string
	status: TranslationStatus
	translatorAddress: string
	reviewedByAddress: string | null
	sourceVersion: number
	isStale: boolean
	publishedAt: string | null
	updatedAt: string
}

export interface CourseTranslationEditorState {
	source: { title: string; description: string; contentVersion: number }
	translation: CourseTranslationRecord | null
	glossary: GlossaryTerm[]
}

export interface LessonTranslationEditorState {
	source: { title: string; content: string; sourceVersion: number }
	translation: LessonTranslationRecord | null
	glossary: GlossaryTerm[]
}

export interface TranslatorQueue {
	untranslated: Array<{
		courseSlug: string
		courseTitle: string
		orderIndex: number
		lessonTitle: string
	}>
	inReview: Array<{
		kind: "course" | "lesson"
		courseSlug: string
		orderIndex: number | null
		title: string
		submittedAt: string
	}>
	stale: Array<{
		kind: "course" | "lesson"
		courseSlug: string
		orderIndex: number | null
		title: string
		staleSinceVersion: number
	}>
}

export function useGlossary(idOrSlug: string | undefined) {
	return useQuery({
		queryKey: ["glossary", idOrSlug],
		enabled: Boolean(idOrSlug),
		queryFn: () =>
			apiFetchJson<{ data: GlossaryTerm[] }>(
				`/api/courses/${idOrSlug}/glossary`,
			),
		select: (response) => response.data,
	})
}

export function useCourseTranslationEditor(
	idOrSlug: string | undefined,
	languageCode: string | undefined,
) {
	return useQuery({
		queryKey: ["courseTranslationEditor", idOrSlug, languageCode],
		enabled: Boolean(idOrSlug) && Boolean(languageCode),
		queryFn: () =>
			apiFetchJson<CourseTranslationEditorState>(
				`/api/courses/${idOrSlug}/translations/${languageCode}`,
				{ auth: true },
			),
	})
}

export function useSaveCourseTranslationDraft(
	idOrSlug: string | undefined,
	languageCode: string | undefined,
) {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: (input: { title: string; description: string }) =>
			apiFetchJson<CourseTranslationRecord>(
				`/api/courses/${idOrSlug}/translations/${languageCode}`,
				{
					method: "PUT",
					auth: true,
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(input),
				},
			),
		onSuccess: () => {
			void queryClient.invalidateQueries({
				queryKey: ["courseTranslationEditor", idOrSlug, languageCode],
			})
		},
	})
}

export function useSubmitCourseTranslationForReview(
	idOrSlug: string | undefined,
	languageCode: string | undefined,
) {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: () =>
			apiFetchJson<CourseTranslationRecord>(
				`/api/courses/${idOrSlug}/translations/${languageCode}/submit`,
				{ method: "POST", auth: true },
			),
		onSuccess: () => {
			void queryClient.invalidateQueries({
				queryKey: ["courseTranslationEditor", idOrSlug, languageCode],
			})
		},
	})
}

export function usePublishCourseTranslation(
	idOrSlug: string | undefined,
	languageCode: string | undefined,
) {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: () =>
			apiFetchJson<CourseTranslationRecord>(
				`/api/courses/${idOrSlug}/translations/${languageCode}/publish`,
				{ method: "POST", auth: true },
			),
		onSuccess: () => {
			void queryClient.invalidateQueries({
				queryKey: ["courseTranslationEditor", idOrSlug, languageCode],
			})
		},
	})
}

export function useLessonTranslationEditor(
	idOrSlug: string | undefined,
	orderIndex: number | undefined,
	languageCode: string | undefined,
) {
	return useQuery({
		queryKey: ["lessonTranslationEditor", idOrSlug, orderIndex, languageCode],
		enabled: Boolean(idOrSlug) && Boolean(orderIndex) && Boolean(languageCode),
		queryFn: () =>
			apiFetchJson<LessonTranslationEditorState>(
				`/api/courses/${idOrSlug}/lessons/${orderIndex}/translations/${languageCode}`,
				{ auth: true },
			),
	})
}

export function useSaveLessonTranslationDraft(
	idOrSlug: string | undefined,
	orderIndex: number | undefined,
	languageCode: string | undefined,
) {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: (input: { title: string; content: string }) =>
			apiFetchJson<LessonTranslationRecord>(
				`/api/courses/${idOrSlug}/lessons/${orderIndex}/translations/${languageCode}`,
				{
					method: "PUT",
					auth: true,
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(input),
				},
			),
		onSuccess: () => {
			void queryClient.invalidateQueries({
				queryKey: [
					"lessonTranslationEditor",
					idOrSlug,
					orderIndex,
					languageCode,
				],
			})
		},
	})
}

export function useSubmitLessonTranslationForReview(
	idOrSlug: string | undefined,
	orderIndex: number | undefined,
	languageCode: string | undefined,
) {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: () =>
			apiFetchJson<LessonTranslationRecord>(
				`/api/courses/${idOrSlug}/lessons/${orderIndex}/translations/${languageCode}/submit`,
				{ method: "POST", auth: true },
			),
		onSuccess: () => {
			void queryClient.invalidateQueries({
				queryKey: [
					"lessonTranslationEditor",
					idOrSlug,
					orderIndex,
					languageCode,
				],
			})
		},
	})
}

export function usePublishLessonTranslation(
	idOrSlug: string | undefined,
	orderIndex: number | undefined,
	languageCode: string | undefined,
) {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: () =>
			apiFetchJson<LessonTranslationRecord>(
				`/api/courses/${idOrSlug}/lessons/${orderIndex}/translations/${languageCode}/publish`,
				{ method: "POST", auth: true },
			),
		onSuccess: () => {
			void queryClient.invalidateQueries({
				queryKey: [
					"lessonTranslationEditor",
					idOrSlug,
					orderIndex,
					languageCode,
				],
			})
		},
	})
}

export function useTranslatorQueue(language: string | undefined) {
	return useQuery({
		queryKey: ["translatorQueue", language],
		enabled: Boolean(language),
		queryFn: () =>
			apiFetchJson<TranslatorQueue>(
				`/api/translations/queue?language=${language}`,
				{ auth: true },
			),
	})
}
