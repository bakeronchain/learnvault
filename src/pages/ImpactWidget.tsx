import { useImpactWidgetData } from "../hooks/useImpactMetrics"

function formatValue(value: string | number): string {
	const parsed = Number(value)
	if (!Number.isFinite(parsed)) return "0"
	return parsed.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

export default function ImpactWidget() {
	const { data, isLoading, error } = useImpactWidgetData()

	if (isLoading) {
		return (
			<div className="h-full w-full rounded-2xl border border-white/15 bg-[#060910] p-5 text-white">
				<p className="text-sm text-white/70">Loading widget...</p>
			</div>
		)
	}

	if (error || !data) {
		return (
			<div className="h-full w-full rounded-2xl border border-red-400/30 bg-[#11070b] p-5 text-white">
				<p className="text-sm text-red-200">Widget unavailable</p>
			</div>
		)
	}

	return (
		<div className="h-full w-full rounded-2xl border border-white/15 bg-[#05080f] p-5 text-white">
			<p className="text-[10px] font-black uppercase tracking-[0.22em] text-brand-cyan/80">
				LearnVault Impact
			</p>
			<div className="mt-4 grid grid-cols-3 gap-2">
				<MiniMetric label="Scholars" value={data.total_scholars_funded.toString()} />
				<MiniMetric label="USDC" value={formatValue(data.total_usdc_disbursed)} />
				<MiniMetric label="LRN" value={formatValue(data.total_lrn_minted)} />
			</div>
			<p className="mt-4 text-[10px] text-white/50">Updated {new Date(data.generated_at).toLocaleDateString()}</p>
		</div>
	)
}

function MiniMetric({ label, value }: { label: string; value: string }) {
	return (
		<div className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
			<p className="text-[9px] font-black uppercase tracking-[0.18em] text-white/50">{label}</p>
			<p className="mt-1 text-sm font-black text-brand-cyan">{value}</p>
		</div>
	)
}
