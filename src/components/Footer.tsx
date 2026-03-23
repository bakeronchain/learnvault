import { Text } from "@stellar/design-system"

export default function Footer() {
	return (
		<footer
			style={{
				borderTop: "1px solid var(--sds-clr-gray-06)",
				padding: "1rem 3rem",
				textAlign: "center",
			}}
		>
			<div style={{ display: "flex", justifyContent: "center", gap: "2rem" }}>
				<a
					href="https://github.com/bakeronchain/learnvault"
					target="_blank"
					rel="noopener noreferrer"
				>
					<Text as="span" size="sm">
						GitHub
					</Text>
				</a>
				<a href="#" target="_blank" rel="noopener noreferrer">
					<Text as="span" size="sm">
						Discord
					</Text>
				</a>
				<a href="#" target="_blank" rel="noopener noreferrer">
					<Text as="span" size="sm">
						Twitter
					</Text>
				</a>
				<a href="#" target="_blank" rel="noopener noreferrer">
					<Text as="span" size="sm">
						Docs
					</Text>
				</a>
			</div>
		</footer>
	)
}
