import { useEffect, useMemo, useState } from "react"
import { useCourses } from "../hooks/useCourses"
import {
	useCreateTrackSponsorship,
	useSponsorDashboard,
	useSponsorOrganizationProfile,
	useSponsorQuarterlyReports,
	useUpsertSponsorOrganizationProfile,
} from "../hooks/useSponsors"
import { useWallet } from "../hooks/useWallet"

function formatUsdc(value: string): string {
	const parsed = Number(value)
	if (!Number.isFinite(parsed)) return "0"
	return parsed.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

function formatPercent(value: number): string {
	return `${Math.round(value * 100)}%`
}

const currentYear = new Date().getFullYear()

export default function SponsorPortal() {
	const { address } = useWallet()
	const { courses } = useCourses()
	const { data: profile } = useSponsorOrganizationProfile(address)
	const upsertProfile = useUpsertSponsorOrganizationProfile()
	const sponsorTrack = useCreateTrackSponsorship()
	const { data: dashboard } = useSponsorDashboard(address)
	const [reportYear, setReportYear] = useState<number>(currentYear)
	const [reportQuarter, setReportQuarter] = useState<number>(0)
	const { data: quarterlyReports = [] } = useSponsorQuarterlyReports(
		address,
		reportYear,
		reportQuarter || undefined,
	)

	const [orgName, setOrgName] = useState("")
	const [logoUrl, setLogoUrl] = useState("")
	const [website, setWebsite] = useState("")
	const [mission, setMission] = useState("")
	const [track, setTrack] = useState("")
	const [donationUsdc, setDonationUsdc] = useState("1000")
	const [txHash, setTxHash] = useState("")

	const trackOptions = useMemo(() => {
		const seen = new Set<string>()
		return courses
			.map((course) => course.track)
			.filter((value) => {
				const key = value.toLowerCase()
				if (seen.has(key)) return false
				seen.add(key)
				return true
			})
			.sort((a, b) => a.localeCompare(b))
	}, [courses])

	useEffect(() => {
		if (!profile) return
		setOrgName(profile.name ?? "")
		setLogoUrl(profile.logo_url ?? "")
		setWebsite(profile.website ?? "")
		setMission(profile.mission ?? "")
	}, [profile])

	const handleSaveProfile = async () => {
		if (!address || !orgName.trim()) return
		await upsertProfile.mutateAsync({
			walletAddress: address,
			name: orgName,
			logo_url: logoUrl,
			website,
			mission,
		})
	}

	const handleSponsorTrack = async () => {
		if (!address || !track) return
		await sponsorTrack.mutateAsync({
			wallet_address: address,
			track,
			donation_usdc: Number(donationUsdc),
			tx_hash: txHash,
		})
		setTxHash("")
	}

	const reportJson = useMemo(
		() => JSON.stringify(quarterlyReports, null, 2),
		[quarterlyReports],
	)

	if (!address) {
		return (
			<div className="mx-auto max-w-5xl px-6 py-16 text-white">
				<h1 className="text-5xl font-black tracking-tight text-gradient">
					Organization Sponsor Portal
				</h1>
				<p className="mt-4 text-white/60">
					Connect your wallet to create an organization profile and sponsor scholarship tracks.
				</p>
			</div>
		)
	}

	return (
		<div className="mx-auto max-w-6xl px-6 py-12 text-white">
			<header className="mb-10">
				<h1 className="text-5xl font-black tracking-tight text-gradient">
					Organization Sponsor Portal
				</h1>
				<p className="mt-4 max-w-3xl text-white/60">
					Create your organization profile, sponsor targeted course tracks, monitor scholar progress, and generate quarterly impact reports.
				</p>
			</header>

			<div className="grid gap-8 lg:grid-cols-2">
				<section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
					<h2 className="text-2xl font-black">Organization Profile</h2>
					<div className="mt-5 space-y-4">
						<input
							value={orgName}
							onChange={(event) => setOrgName(event.target.value)}
							placeholder="Organization name"
							className="w-full rounded-2xl border border-white/15 bg-black/20 px-4 py-3"
						/>
						<input
							value={logoUrl}
							onChange={(event) => setLogoUrl(event.target.value)}
							placeholder="Logo URL"
							className="w-full rounded-2xl border border-white/15 bg-black/20 px-4 py-3"
						/>
						<input
							value={website}
							onChange={(event) => setWebsite(event.target.value)}
							placeholder="Website"
							className="w-full rounded-2xl border border-white/15 bg-black/20 px-4 py-3"
						/>
						<textarea
							value={mission}
							onChange={(event) => setMission(event.target.value)}
							placeholder="Mission"
							rows={4}
							className="w-full rounded-2xl border border-white/15 bg-black/20 px-4 py-3"
						/>
						<button
							type="button"
							onClick={() => void handleSaveProfile()}
							className="rounded-2xl bg-brand-cyan px-5 py-3 text-sm font-black uppercase tracking-widest text-black"
						>
							{upsertProfile.isPending ? "Saving..." : "Save Profile"}
						</button>
					</div>
				</section>

				<section className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
					<h2 className="text-2xl font-black">Sponsor a Course Track</h2>
					<div className="mt-5 space-y-4">
						<select
							value={track}
							onChange={(event) => setTrack(event.target.value)}
							className="w-full rounded-2xl border border-white/15 bg-black/20 px-4 py-3"
						>
							<option value="">Select track</option>
							{trackOptions.map((option) => (
								<option key={option} value={option}>
									{option}
								</option>
							))}
						</select>
						<input
							value={donationUsdc}
							onChange={(event) => setDonationUsdc(event.target.value)}
							placeholder="Donation amount (USDC)"
							type="number"
							min="0"
							step="0.01"
							className="w-full rounded-2xl border border-white/15 bg-black/20 px-4 py-3"
						/>
						<input
							value={txHash}
							onChange={(event) => setTxHash(event.target.value)}
							placeholder="Tx hash (optional)"
							className="w-full rounded-2xl border border-white/15 bg-black/20 px-4 py-3"
						/>
						<button
							type="button"
							onClick={() => void handleSponsorTrack()}
							className="rounded-2xl bg-brand-blue px-5 py-3 text-sm font-black uppercase tracking-widest"
						>
							{sponsorTrack.isPending ? "Submitting..." : "Submit Sponsorship"}
						</button>
					</div>
				</section>
			</div>

			<section className="mt-8 rounded-3xl border border-white/10 bg-white/[0.03] p-6">
				<h2 className="text-2xl font-black">Org Dashboard: Scholar Progress</h2>
				<p className="mt-2 text-white/60">
					Tracks: {dashboard?.tracks.join(", ") || "No sponsored tracks yet"}
				</p>
				<div className="mt-4 overflow-x-auto">
					<table className="min-w-full text-left text-sm">
						<thead className="text-white/60">
							<tr>
								<th className="px-3 py-2">Scholar</th>
								<th className="px-3 py-2">Completed</th>
								<th className="px-3 py-2">Total</th>
								<th className="px-3 py-2">Rate</th>
							</tr>
						</thead>
						<tbody>
							{(dashboard?.scholars ?? []).map((scholar) => (
								<tr key={scholar.learner_address} className="border-t border-white/10">
									<td className="px-3 py-2 font-mono text-xs">{scholar.learner_address}</td>
									<td className="px-3 py-2">{scholar.completed_milestones}</td>
									<td className="px-3 py-2">{scholar.total_milestones}</td>
									<td className="px-3 py-2">{formatPercent(scholar.completion_rate)}</td>
								</tr>
							))}
							{(dashboard?.scholars ?? []).length === 0 && (
								<tr>
									<td className="px-3 py-4 text-white/50" colSpan={4}>
										No scholar activity yet for this organization.
									</td>
								</tr>
							)}
						</tbody>
					</table>
				</div>
			</section>

			<section className="mt-8 rounded-3xl border border-white/10 bg-white/[0.03] p-6">
				<div className="flex flex-wrap items-end gap-4">
					<div>
						<label className="mb-1 block text-xs font-black uppercase tracking-widest text-white/50">
							Year
						</label>
						<input
							type="number"
							value={reportYear}
							onChange={(event) =>
								setReportYear(Number.parseInt(event.target.value || String(currentYear), 10))
							}
							className="rounded-xl border border-white/15 bg-black/20 px-3 py-2"
						/>
					</div>
					<div>
						<label className="mb-1 block text-xs font-black uppercase tracking-widest text-white/50">
							Quarter
						</label>
						<select
							value={reportQuarter}
							onChange={(event) => setReportQuarter(Number(event.target.value))}
							className="rounded-xl border border-white/15 bg-black/20 px-3 py-2"
						>
							<option value={0}>All</option>
							<option value={1}>Q1</option>
							<option value={2}>Q2</option>
							<option value={3}>Q3</option>
							<option value={4}>Q4</option>
						</select>
					</div>
				</div>

				<h2 className="mt-5 text-2xl font-black">Quarterly Impact Report</h2>
				<div className="mt-4 overflow-x-auto">
					<table className="min-w-full text-left text-sm">
						<thead className="text-white/60">
							<tr>
								<th className="px-3 py-2">Period</th>
								<th className="px-3 py-2">Donated (USDC)</th>
								<th className="px-3 py-2">Tracks</th>
								<th className="px-3 py-2">Scholars Impacted</th>
								<th className="px-3 py-2">Milestones Completed</th>
							</tr>
						</thead>
						<tbody>
							{quarterlyReports.map((report) => (
								<tr
									key={`${report.year}-${report.quarter}`}
									className="border-t border-white/10"
								>
									<td className="px-3 py-2">{`${report.year} Q${report.quarter}`}</td>
									<td className="px-3 py-2">{formatUsdc(report.total_donated_usdc)}</td>
									<td className="px-3 py-2">{report.sponsored_tracks_count}</td>
									<td className="px-3 py-2">{report.scholars_impacted}</td>
									<td className="px-3 py-2">{report.milestones_completed}</td>
								</tr>
							))}
							{quarterlyReports.length === 0 && (
								<tr>
									<td className="px-3 py-4 text-white/50" colSpan={5}>
										No report rows for the selected period.
									</td>
								</tr>
							)}
						</tbody>
					</table>
				</div>

				<details className="mt-4 rounded-2xl border border-white/10 bg-black/20 p-4">
					<summary className="cursor-pointer text-sm font-black uppercase tracking-widest text-white/70">
						Export JSON report payload
					</summary>
					<pre className="mt-3 max-h-64 overflow-auto text-xs text-white/70">{reportJson}</pre>
				</details>
			</section>
		</div>
	)
}
