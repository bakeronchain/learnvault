import RecommendationsCarousel from "../components/RecommendationsCarousel"
import StreakWidget from "../components/StreakWidget"

export default function Dashboard() {
	return (
		<div style={{ padding: "2rem" }}>
			<div style={{ textAlign: "center" }}>
				<h1>Dashboard</h1>
				<p
					style={{
						color: "var(--color-text-secondary)",
						maxWidth: 480,
						margin: "1rem auto",
					}}
				>
					Your personalised learning dashboard is coming soon. It will show your
					enrolled courses, LRN balance, milestone progress, and on-chain
					activity.
				</p>
			</div>
			<div style={{ maxWidth: 1200, margin: "2rem auto 0" }}>
				<StreakWidget />
			</div>
			<div style={{ maxWidth: 1200, margin: "2rem auto 0" }}>
				<RecommendationsCarousel />
			</div>
		</div>
	)
}
