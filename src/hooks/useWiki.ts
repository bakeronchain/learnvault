import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { API_URL } from "../lib/api"
import { getAuthToken } from "../util/auth"

export interface WikiPage {
	id: number
	slug: string
	title: string
	content: string
	category: string
	isPublished: boolean
	createdAt: string
	updatedAt: string
}

export function useWikiPages(category?: string) {
	return useQuery<WikiPage[]>({
		queryKey: ["wiki-pages", category],
		queryFn: async () => {
			const url = new URL(`${API_URL}/api/wiki`)
			if (category) url.searchParams.set("category", category)
			const response = await fetch(url.toString())
			if (!response.ok) throw new Error("Failed to fetch wiki pages")
			return response.json()
		},
		staleTime: 5 * 60 * 1000, // 5 minutes
	})
}

export function useWikiPage(slug: string | undefined) {
	return useQuery<WikiPage>({
		queryKey: ["wiki-page", slug],
		queryFn: async () => {
			if (!slug) throw new Error("Slug is required")
			const response = await fetch(`${API_URL}/api/wiki/${slug}`)
			if (!response.ok) throw new Error("Failed to fetch wiki page")
			return response.json()
		},
		enabled: !!slug,
		staleTime: 5 * 60 * 1000,
	})
}

export function useCreateWikiPage() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: async (page: Partial<WikiPage>) => {
			const response = await fetch(`${API_URL}/api/wiki`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${getAuthToken()}`,
				},
				body: JSON.stringify(page),
			})
			if (!response.ok) throw new Error("Failed to create wiki page")
			return response.json()
		},
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: ["wiki-pages"] })
		},
	})
}

export function useUpdateWikiPage() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: async ({ id, ...page }: Partial<WikiPage> & { id: number }) => {
			const response = await fetch(`${API_URL}/api/wiki/${id}`, {
				method: "PUT",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${getAuthToken()}`,
				},
				body: JSON.stringify(page),
			})
			if (!response.ok) throw new Error("Failed to update wiki page")
			return response.json()
		},
		onSuccess: (_, { slug }) => {
			void queryClient.invalidateQueries({ queryKey: ["wiki-pages"] })
			if (slug)
				void queryClient.invalidateQueries({ queryKey: ["wiki-page", slug] })
		},
	})
}

export function useDeleteWikiPage() {
	const queryClient = useQueryClient()
	return useMutation({
		mutationFn: async (id: number) => {
			const response = await fetch(`${API_URL}/api/wiki/${id}`, {
				method: "DELETE",
				headers: {
					Authorization: `Bearer ${getAuthToken()}`,
				},
			})
			if (!response.ok) throw new Error("Failed to delete wiki page")
		},
		onSuccess: () => {
			void queryClient.invalidateQueries({ queryKey: ["wiki-pages"] })
		},
	})
}
