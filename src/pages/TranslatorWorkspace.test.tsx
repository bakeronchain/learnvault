import { fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { type CourseDetail } from "../types/courses"

vi.mock("../hooks/useCourses", () => ({
	useCourseDetail: vi.fn(),
}))

const saveDraftMutateAsync = vi.fn().mockResolvedValue({})
const submitMutateAsync = vi.fn().mockResolvedValue({})
const publishMutateAsync = vi.fn().mockResolvedValue({})

vi.mock("../hooks/useCourseTranslations", () => ({
	useGlossary: () => ({ data: [{ id: 1, term: "Stellar", note: null }] }),
	useCourseTranslationEditor: () => ({
		data: {
			source: { title: "Intro", description: "Desc", contentVersion: 1 },
			translation: null,
			glossary: [],
		},
		isLoading: false,
	}),
	useSaveCourseTranslationDraft: () => ({
		mutateAsync: vi.fn(),
		isPending: false,
	}),
	useSubmitCourseTranslationForReview: () => ({
		mutateAsync: vi.fn(),
		isPending: false,
	}),
	usePublishCourseTranslation: () => ({
		mutateAsync: vi.fn(),
		isPending: false,
	}),
	useLessonTranslationEditor: () => ({
		data: {
			source: {
				title: "Intro to Stellar",
				content: MARKDOWN_FIXTURE,
				sourceVersion: 1,
			},
			translation: null,
			glossary: [],
		},
		isLoading: false,
	}),
	useSaveLessonTranslationDraft: () => ({
		mutateAsync: saveDraftMutateAsync,
		isPending: false,
	}),
	useSubmitLessonTranslationForReview: () => ({
		mutateAsync: submitMutateAsync,
		isPending: false,
	}),
	usePublishLessonTranslation: () => ({
		mutateAsync: publishMutateAsync,
		isPending: false,
	}),
}))

const MARKDOWN_FIXTURE = [
	"# Heading",
	"",
	"Some prose with a [link](https://stellar.org) in it.",
	"",
	"```js",
	"const escrow = 1;",
	"```",
].join("\n")

const { useCourseDetail } = await import("../hooks/useCourses")
const TranslatorWorkspace = (await import("./TranslatorWorkspace")).default

const makeCourse = (): CourseDetail => ({
	id: "1",
	slug: "intro-to-stellar",
	title: "Introduction to Stellar",
	description: "Learn the basics",
	coverImage: null,
	track: "Stellar",
	trackKey: "stellar",
	difficulty: "beginner",
	level: "Beginner",
	published: true,
	createdAt: "2024-01-01",
	updatedAt: "2024-01-01",
	accentClassName: "",
	lessons: [
		{
			id: 1,
			courseId: "intro-to-stellar",
			title: "What is Stellar?",
			content: "content",
			order: 1,
			estimatedMinutes: 15,
			isMilestone: false,
		},
	],
})

const renderWorkspace = () =>
	render(
		<MemoryRouter initialEntries={["/translate/intro-to-stellar?lang=sw"]}>
			<Routes>
				<Route path="/translate/:courseId" element={<TranslatorWorkspace />} />
			</Routes>
		</MemoryRouter>,
	)

beforeEach(() => {
	vi.mocked(useCourseDetail).mockReturnValue({
		course: makeCourse(),
		isLoading: false,
		error: null,
		refetch: vi.fn(),
	})
	saveDraftMutateAsync.mockClear()
})

describe("TranslatorWorkspace", () => {
	it("renders the course title and lesson list", () => {
		renderWorkspace()
		expect(screen.getByText("Introduction to Stellar")).toBeInTheDocument()
		expect(screen.getByText(/What is Stellar\?/)).toBeInTheDocument()
	})

	it("round-trips markdown (headings, links, code fences) through save byte-for-byte", async () => {
		const user = userEvent.setup()
		renderWorkspace()

		await user.click(screen.getByText(/What is Stellar\?/))

		const textarea = await screen.findByPlaceholderText(
			/translated markdown content/i,
		)
		fireEvent.change(textarea, { target: { value: MARKDOWN_FIXTURE } })
		expect(textarea).toHaveValue(MARKDOWN_FIXTURE)

		const saveButton = screen.getByRole("button", { name: /save draft/i })
		await user.click(saveButton)

		expect(saveDraftMutateAsync).toHaveBeenCalledWith(
			expect.objectContaining({ content: MARKDOWN_FIXTURE }),
		)
	})
})
