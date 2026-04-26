import React, { useMemo } from "react"

interface IdenticonAvatarProps {
	address: string
	size?: number
	className?: string
	alt?: string
}

/**
 * Generates a deterministic identicon SVG based on the wallet address.
 * Uses a simple block pattern algorithm that produces consistent avatars for the same address.
 */
export const IdenticonAvatar: React.FC<IdenticonAvatarProps> = ({
	address,
	size = 128,
	className = "",
	alt = "User avatar",
}) => {
	const identiconData = useMemo(() => {
		// Generate a seed from the address
		const seed = address
			.split("")
			.reduce((acc, char) => acc + char.charCodeAt(0), 0)

		// Generate colors based on the seed
		const hue1 = seed % 360
		const hue2 = (seed * 7) % 360
		const color1 = `hsl(${hue1}, 70%, 50%)`
		const color2 = `hsl(${hue2}, 70%, 40%)`
		const bgColor = `hsl(${(hue1 + 180) % 360}, 20%, 15%)`

		// Generate a 5x5 grid pattern
		const gridSize = 5
		const cells: boolean[] = []
		for (let i = 0; i < gridSize * Math.ceil(gridSize / 2); i++) {
			cells.push(((seed >> i) & 1) === 1)
		}

		return { color1, color2, bgColor, cells, gridSize }
	}, [address])

	const { color1, color2, bgColor, cells, gridSize } = identiconData
	const cellSize = size / gridSize

	// Mirror the pattern for symmetry
	const renderCells = () => {
		const elements: React.ReactElement[] = []

		for (let row = 0; row < gridSize; row++) {
			for (let col = 0; col < gridSize; col++) {
				// Mirror the column for symmetry
				const mirrorCol =
					col < Math.ceil(gridSize / 2) ? col : gridSize - 1 - col
				const cellIndex = row * Math.ceil(gridSize / 2) + mirrorCol
				const isActive = cells[cellIndex] ?? false

				if (isActive) {
					const color = (row + col) % 2 === 0 ? color1 : color2
					elements.push(
						<rect
							key={`${row}-${col}`}
							x={col * cellSize}
							y={row * cellSize}
							width={cellSize}
							height={cellSize}
							fill={color}
						/>,
					)
				}
			}
		}

		return elements
	}

	return (
		<svg
			width={size}
			height={size}
			viewBox={`0 0 ${size} ${size}`}
			className={`rounded-full ${className}`}
			role="img"
			aria-label={alt}
		>
			<rect width={size} height={size} fill={bgColor} />
			{renderCells()}
		</svg>
	)
}

export default IdenticonAvatar
