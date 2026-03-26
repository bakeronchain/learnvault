import React, { useEffect, useId, useState } from "react"

export interface AddressDisplayProps {
	address?: string | null
	className?: string
	addressClassName?: string
	buttonClassName?: string
	prefixLength?: number
	suffixLength?: number
	showCopyButton?: boolean
}

export function truncateAddress(
	address: string,
	prefixLength = 1,
	suffixLength = 4,
): string {
	if (!address) return ""
	if (address.includes("...")) return address

	const visibleLength = prefixLength + suffixLength
	if (address.length <= visibleLength) return address

	return `${address.slice(0, prefixLength)}...${address.slice(-suffixLength)}`
}

async function copyText(value: string) {
	if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
		await navigator.clipboard.writeText(value)
		return
	}

	if (typeof document === "undefined") {
		throw new Error("Clipboard is not available")
	}

	const textarea = document.createElement("textarea")
	textarea.value = value
	textarea.setAttribute("readonly", "")
	textarea.style.position = "absolute"
	textarea.style.left = "-9999px"
	document.body.appendChild(textarea)
	textarea.select()

	const copied = document.execCommand("copy")
	document.body.removeChild(textarea)

	if (!copied) {
		throw new Error("Copy command failed")
	}
}

const AddressDisplay: React.FC<AddressDisplayProps> = ({
	address,
	className = "",
	addressClassName = "",
	buttonClassName = "",
	prefixLength = 1,
	suffixLength = 4,
	showCopyButton = true,
}) => {
	const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle")
	const tooltipId = useId()

	useEffect(() => {
		if (copyState === "idle") return

		const timeout = window.setTimeout(() => setCopyState("idle"), 1500)
		return () => window.clearTimeout(timeout)
	}, [copyState])

	if (!address) return null

	const truncatedAddress = truncateAddress(address, prefixLength, suffixLength)

	const handleCopy = async (event: React.MouseEvent<HTMLButtonElement>) => {
		event.stopPropagation()

		try {
			await copyText(address)
			setCopyState("copied")
		} catch (error) {
			console.error("Failed to copy address:", error)
			setCopyState("error")
		}
	}

	return (
		<span
			className={`inline-flex min-w-0 items-center gap-2 ${className}`.trim()}
		>
			<span
				className={`min-w-0 truncate font-mono ${addressClassName}`.trim()}
				title={address}
			>
				{truncatedAddress}
			</span>
			{showCopyButton ? (
				<span className="relative inline-flex shrink-0 items-center">
					<button
						type="button"
						onClick={handleCopy}
						aria-label={`Copy wallet address ${address}`}
						aria-describedby={copyState !== "idle" ? tooltipId : undefined}
						className={`inline-flex h-7 w-7 items-center justify-center rounded-full border border-white/10 bg-white/5 text-white/45 transition-colors hover:border-brand-cyan/30 hover:text-brand-cyan focus:outline-none focus:ring-2 focus:ring-brand-cyan/40 ${buttonClassName}`.trim()}
						title="Copy full address"
					>
						<svg
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="2"
							strokeLinecap="round"
							strokeLinejoin="round"
							className="h-3.5 w-3.5"
							aria-hidden="true"
						>
							<rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
							<path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
						</svg>
					</button>
					{copyState !== "idle" ? (
						<span
							id={tooltipId}
							role="status"
							className={`pointer-events-none absolute right-0 top-full mt-2 rounded-lg border bg-black/90 px-2 py-1 text-[10px] font-black uppercase tracking-widest shadow-lg ${
								copyState === "copied"
									? "border-brand-cyan/30 text-brand-cyan shadow-brand-cyan/10"
									: "border-red-400/40 text-red-300 shadow-red-500/10"
							}`.trim()}
						>
							{copyState === "copied" ? "Copied!" : "Copy failed"}
						</span>
					) : null}
				</span>
			) : null}
		</span>
	)
}

export default AddressDisplay
