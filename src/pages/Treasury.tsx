import { Layout, Button, Icon } from "@stellar/design-system"
import React, { useState, useEffect } from "react"

export default function Treasury() {
	const [stats, setStats] = useState({
		totalTreasury: "125,000",
		totalDisbursed: "45,000",
		scholarsFunded: 120,
		donorsCount: 85,
	})

	const [donations, setDonations] = useState([
		{ id: 1, donor: "0xABC...123", amount: "500 USDC", time: "2 mins ago" },
		{ id: 2, donor: "0xDEF...456", amount: "1,200 USDC", time: "15 mins ago" },
		{ id: 3, donor: "0xGHI...789", amount: "250 USDC", time: "1 hour ago" },
	])

	return (
		<div style={{ padding: "20px" }}>
			<h1 style={{ fontSize: "2rem", marginBottom: "20px" }}>
				Community Treasury Dashboard
			</h1>

			{/* Summary Stats */}
			<div
				style={{
					display: "grid",
					gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
					gap: "20px",
					marginBottom: "40px",
				}}
			>
				<StatCard
					title="Total in Treasury"
					value={`${stats.totalTreasury} USDC`}
					icon={<Icon.Coins01 />}
				/>
				<StatCard
					title="Total Disbursed"
					value={`${stats.totalDisbursed} USDC`}
					icon={<Icon.ArrowUpRight />}
				/>
				<StatCard
					title="Scholars Funded"
					value={stats.scholarsFunded}
					icon={<Icon.Users01 />}
				/>
				<StatCard
					title="Donors"
					value={stats.donorsCount}
					icon={<Icon.Heart />}
				/>
			</div>

			<div
				style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "40px" }}
			>
				{/* Recent Donations */}
				<div>
					<h2 style={{ fontSize: "1.5rem", marginBottom: "15px" }}>
						Recent Donations
					</h2>
					<div
						style={{
							background: "rgba(255,255,255,0.05)",
							padding: "15px",
							borderRadius: "10px",
						}}
					>
						{donations.map((d) => (
							<div
								key={d.id}
								style={{
									display: "flex",
									justifyContent: "space-between",
									padding: "10px 0",
									borderBottom: "1px solid rgba(255,255,255,0.1)",
								}}
							>
								<span>{d.donor}</span>
								<span style={{ fontWeight: "bold", color: "#4ADE80" }}>
									{d.amount}
								</span>
								<span style={{ fontSize: "0.8rem", color: "#94A3B8" }}>
									{d.time}
								</span>
							</div>
						))}
					</div>
				</div>

				{/* Treasury Health Chart Placeholder */}
				<div>
					<h2 style={{ fontSize: "1.5rem", marginBottom: "15px" }}>
						Treasury Health
					</h2>
					<div
						style={{
							height: "200px",
							background: "rgba(255,255,255,0.05)",
							borderRadius: "10px",
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
						}}
					>
						<span style={{ color: "#94A3B8" }}>
							[ Treasury Health Chart (Inflows vs Outflows) ]
						</span>
					</div>
				</div>
			</div>

			<div style={{ marginTop: "40px", textAlign: "center" }}>
				<Button variant="primary" size="lg">
					<Icon.PlusCircle /> Donate to Treasury
				</Button>
			</div>
		</div>
	)
}

function StatCard({
	title,
	value,
	icon,
}: {
	title: string
	value: string | number
	icon: React.ReactNode
}) {
	return (
		<div
			style={{
				background: "rgba(255,255,255,0.05)",
				padding: "20px",
				borderRadius: "12px",
				border: "1px solid rgba(255,255,255,0.1)",
			}}
		>
			<div
				style={{
					display: "flex",
					alignItems: "center",
					gap: "10px",
					color: "#94A3B8",
					marginBottom: "10px",
				}}
			>
				{icon}
				<span style={{ fontSize: "0.9rem", fontWeight: "500" }}>{title}</span>
			</div>
			<div style={{ fontSize: "1.5rem", fontWeight: "bold" }}>{value}</div>
		</div>
	)
}
