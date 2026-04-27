import React, { useCallback, useState } from "react"
import { useTranslation } from "react-i18next"
import IdenticonAvatar from "./IdenticonAvatar"
import { IpfsUpload, type IpfsUploadResult } from "./IpfsUpload"

export interface SocialLinks {
	twitter?: string
	github?: string
	linkedin?: string
	website?: string
	discord?: string
}

export interface ProfileFormData {
	displayName: string
	bio: string
	avatarUrl: string | null
	avatarCid: string | null
	socialLinks: SocialLinks
}

interface ProfileEditFormProps {
	initialData?: Partial<ProfileFormData>
	walletAddress: string
	authToken: string
	onSave: (data: ProfileFormData) => Promise<void>
	onCancel: () => void
	isLoading?: boolean
}

const MAX_BIO_LENGTH = 1000
const MAX_DISPLAY_NAME_LENGTH = 100

export const ProfileEditForm: React.FC<ProfileEditFormProps> = ({
	initialData,
	walletAddress,
	authToken,
	onSave,
	onCancel,
	isLoading = false,
}) => {
	const { t } = useTranslation()
	const [formData, setFormData] = useState<ProfileFormData>({
		displayName: initialData?.displayName ?? "",
		bio: initialData?.bio ?? "",
		avatarUrl: initialData?.avatarUrl ?? null,
		avatarCid: initialData?.avatarCid ?? null,
		socialLinks: initialData?.socialLinks ?? {},
	})
	const [error, setError] = useState<string | null>(null)

	const handleInputChange = useCallback(
		(field: keyof ProfileFormData, value: string | null) => {
			setFormData((prev) => ({ ...prev, [field]: value }))
		},
		[],
	)

	const handleSocialLinkChange = useCallback(
		(platform: keyof SocialLinks, value: string) => {
			setFormData((prev) => ({
				...prev,
				socialLinks: { ...prev.socialLinks, [platform]: value },
			}))
		},
		[],
	)

	const handleAvatarUpload = useCallback((result: IpfsUploadResult) => {
		setFormData((prev) => ({
			...prev,
			avatarUrl: result.gatewayUrl,
			avatarCid: result.cid,
		}))
	}, [])

	const handleRemoveAvatar = useCallback(() => {
		setFormData((prev) => ({
			...prev,
			avatarUrl: null,
			avatarCid: null,
		}))
	}, [])

	const handleSubmit = useCallback(
		async (e: React.FormEvent) => {
			e.preventDefault()
			setError(null)

			// Validation
			if (formData.displayName.length > MAX_DISPLAY_NAME_LENGTH) {
				setError(
					`Display name must be ${MAX_DISPLAY_NAME_LENGTH} characters or less`,
				)
				return
			}

			if (formData.bio.length > MAX_BIO_LENGTH) {
				setError(`Bio must be ${MAX_BIO_LENGTH} characters or less`)
				return
			}

			try {
				await onSave(formData)
			} catch (err) {
				setError(err instanceof Error ? err.message : "Failed to save profile")
			}
		},
		[formData, onSave],
	)

	const getInitials = (name: string) => {
		if (!name) return walletAddress.slice(0, 2).toUpperCase()
		return name
			.split(" ")
			.map((n) => n[0])
			.join("")
			.slice(0, 2)
			.toUpperCase()
	}

	return (
		<form onSubmit={handleSubmit} className="space-y-6">
			{error && (
				<div
					className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400"
					role="alert"
				>
					{error}
				</div>
			)}

			{/* Avatar Section */}
			<div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
				<div className="relative">
					{formData.avatarUrl ? (
						<img
							src={formData.avatarUrl}
							alt="Profile avatar"
							className="h-24 w-24 rounded-full border-2 border-brand-cyan/30 object-cover"
						/>
					) : (
						<div className="flex h-24 w-24 items-center justify-center rounded-full border-2 border-brand-cyan/30 bg-[#05070a]">
							<span className="text-2xl font-black text-gradient">
								{getInitials(formData.displayName)}
							</span>
						</div>
					)}
				</div>
				<div className="flex flex-col gap-2">
					<div className="flex flex-wrap gap-2">
						<IpfsUpload
							token={authToken}
							onSuccess={handleAvatarUpload}
							accept=".png,.jpg,.jpeg,.gif,.webp"
							label="Upload Avatar"
							showPreview={false}
						/>
						{formData.avatarUrl && (
							<button
								type="button"
								onClick={handleRemoveAvatar}
								className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/70 hover:bg-white/10"
							>
								Remove Avatar
							</button>
						)}
					</div>
					<p className="text-xs text-white/50">
						Or keep empty to use your wallet&apos;s identicon
					</p>
				</div>
			</div>

			{/* Display Name */}
			<div>
				<label
					htmlFor="displayName"
					className="mb-2 block text-sm font-medium text-white/80"
				>
					Display Name
				</label>
				<input
					type="text"
					id="displayName"
					value={formData.displayName}
					onChange={(e) => handleInputChange("displayName", e.target.value)}
					maxLength={MAX_DISPLAY_NAME_LENGTH}
					placeholder="Enter your display name"
					className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white placeholder-white/30 focus:border-brand-cyan focus:outline-none"
				/>
				<p className="mt-1 text-xs text-white/50">
					{formData.displayName.length}/{MAX_DISPLAY_NAME_LENGTH} characters
				</p>
			</div>

			{/* Bio */}
			<div>
				<label
					htmlFor="bio"
					className="mb-2 block text-sm font-medium text-white/80"
				>
					Bio
				</label>
				<textarea
					id="bio"
					value={formData.bio}
					onChange={(e) => handleInputChange("bio", e.target.value)}
					maxLength={MAX_BIO_LENGTH}
					rows={4}
					placeholder="Tell us about yourself..."
					className="w-full resize-none rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-white placeholder-white/30 focus:border-brand-cyan focus:outline-none"
				/>
				<p className="mt-1 text-xs text-white/50">
					{formData.bio.length}/{MAX_BIO_LENGTH} characters
				</p>
			</div>

			{/* Social Links */}
			<div className="space-y-4">
				<h3 className="text-sm font-medium text-white/80">Social Links</h3>

				<div className="grid gap-4 sm:grid-cols-2">
					<div>
						<label
							htmlFor="twitter"
							className="mb-1 block text-xs text-white/60"
						>
							Twitter / X
						</label>
						<input
							type="text"
							id="twitter"
							value={formData.socialLinks.twitter ?? ""}
							onChange={(e) =>
								handleSocialLinkChange("twitter", e.target.value)
							}
							placeholder="@username or URL"
							className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder-white/30 focus:border-brand-cyan focus:outline-none"
						/>
					</div>

					<div>
						<label
							htmlFor="github"
							className="mb-1 block text-xs text-white/60"
						>
							GitHub
						</label>
						<input
							type="text"
							id="github"
							value={formData.socialLinks.github ?? ""}
							onChange={(e) => handleSocialLinkChange("github", e.target.value)}
							placeholder="username or URL"
							className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder-white/30 focus:border-brand-cyan focus:outline-none"
						/>
					</div>

					<div>
						<label
							htmlFor="linkedin"
							className="mb-1 block text-xs text-white/60"
						>
							LinkedIn
						</label>
						<input
							type="text"
							id="linkedin"
							value={formData.socialLinks.linkedin ?? ""}
							onChange={(e) =>
								handleSocialLinkChange("linkedin", e.target.value)
							}
							placeholder="username or URL"
							className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder-white/30 focus:border-brand-cyan focus:outline-none"
						/>
					</div>

					<div>
						<label
							htmlFor="website"
							className="mb-1 block text-xs text-white/60"
						>
							Website
						</label>
						<input
							type="text"
							id="website"
							value={formData.socialLinks.website ?? ""}
							onChange={(e) =>
								handleSocialLinkChange("website", e.target.value)
							}
							placeholder="https://your-website.com"
							className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white placeholder-white/30 focus:border-brand-cyan focus:outline-none"
						/>
					</div>
				</div>
			</div>

			{/* Actions */}
			<div className="flex flex-wrap gap-3 pt-4">
				<button
					type="submit"
					disabled={isLoading}
					className="rounded-lg bg-brand-cyan px-6 py-2 font-medium text-black transition-colors hover:bg-brand-cyan/90 disabled:opacity-50"
				>
					{isLoading ? "Saving..." : "Save Profile"}
				</button>
				<button
					type="button"
					onClick={onCancel}
					disabled={isLoading}
					className="rounded-lg border border-white/10 bg-white/5 px-6 py-2 font-medium text-white transition-colors hover:bg-white/10 disabled:opacity-50"
				>
					Cancel
				</button>
			</div>
		</form>
	)
}

export default ProfileEditForm
