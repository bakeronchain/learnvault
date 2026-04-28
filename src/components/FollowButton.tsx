import { useMutation, useQueryClient } from "@tanstack/react-query"
import { UserPlus, UserMinus, UserCheck } from "lucide-react"
import React, { useState } from "react"
import { useWallet } from "../hooks/useWallet"

interface FollowButtonProps {
	targetAddress: string
	isFollowingInitial?: boolean
	onStatusChange?: (isFollowing: boolean) => void
	className?: string
}

export const FollowButton: React.FC<FollowButtonProps> = ({
	targetAddress,
	isFollowingInitial = false,
	onStatusChange,
	className = "",
}) => {
	const { address: currentUserAddress } = useWallet()
	const queryClient = useQueryClient()
	const [isHovered, setIsHovered] = useState(false)

	const isOwnProfile =
		currentUserAddress?.toLowerCase() === targetAddress.toLowerCase()

	const mutation = useMutation<
		{ data?: { isFollowing?: boolean } },
		Error,
		boolean
	>({
		mutationFn: async (shouldFollow: boolean) => {
			const method = shouldFollow ? "POST" : "DELETE"
			const response = await fetch(`/api/scholars/${targetAddress}/follow`, {
				method,
				headers: {
					Authorization: `Bearer ${localStorage.getItem("authToken") || ""}`,
				},
			})

			if (!response.ok) {
				const error = (await response.json().catch(() => ({}))) as {
					error?: string
				}
				throw new Error(
					error.error || `Failed to ${shouldFollow ? "follow" : "unfollow"}`,
				)
			}

			return (await response.json()) as { data?: { isFollowing?: boolean } }
		},
		onSuccess: (data) => {
			const isFollowing = Boolean(data.data?.isFollowing)
			// Invalidate queries to refresh counts
			void queryClient.invalidateQueries({
				queryKey: ["scholarProfile", targetAddress],
			})
			if (currentUserAddress) {
				void queryClient.invalidateQueries({
					queryKey: ["scholarProfile", currentUserAddress],
				})
			}
			onStatusChange?.(isFollowing)
		},
	})

	if (!currentUserAddress || isOwnProfile) return null

	const isFollowing = mutation.isIdle
		? isFollowingInitial
		: !!mutation.variables

	const handleClick = (e: React.MouseEvent) => {
		e.preventDefault()
		e.stopPropagation()
		mutation.mutate(!isFollowing)
	}

	return (
		<button
			onClick={handleClick}
			onMouseEnter={() => setIsHovered(true)}
			onMouseLeave={() => setIsHovered(false)}
			disabled={mutation.isPending}
			className={`group relative flex items-center gap-2 px-6 py-2.5 rounded-full font-black uppercase tracking-widest text-[10px] transition-all duration-300 shadow-lg ${
				isFollowing
					? "bg-white/5 border border-white/20 text-white/70 hover:bg-red-500/10 hover:border-red-500/50 hover:text-red-500"
					: "bg-brand-cyan text-black hover:scale-105 hover:shadow-brand-cyan/20"
			} ${mutation.isPending ? "opacity-50 cursor-wait" : ""} ${className}`}
		>
			{isFollowing ? (
				<>
					{isHovered ? (
						<>
							<UserMinus className="w-3.5 h-3.5" />
							<span>Unfollow</span>
						</>
					) : (
						<>
							<UserCheck className="w-3.5 h-3.5" />
							<span>Following</span>
						</>
					)}
				</>
			) : (
				<>
					<UserPlus className="w-3.5 h-3.5" />
					<span>Follow</span>
				</>
			)}
		</button>
	)
}
