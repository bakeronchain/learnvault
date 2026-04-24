/**
 * LRNBalanceWidget.tsx
 * LearnVault — LRN Token Balance Widget
 *
 * Usage:
 *   <LRNBalanceWidget address={walletAddress} size="sm" | "md" | "lg" />
 *
 * Sizes:
 *   sm  — Compact nav bar pill:  🏆 142 LRN
 *   md  — Dashboard card with change indicator (+20 LRN)
 *   lg  — Full profile card with percentile rank & rank label
 */

"use client"

import React, { useEffect, useRef, useState, useCallback } from "react"
import { useLearnToken } from "../hooks/useLearnToken"
import { formatLRN } from "../util/tokenFormat"

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

export type WidgetSize = "sm" | "md" | "lg"

export interface LRNBalanceWidgetProps {
	/** Wallet address to look up */
	address: string
	/** Visual size variant */
	size?: WidgetSize
	/** Optional extra className on the root element */
	className?: string
}

interface LearnTokenData {
	balance: number
	previousBalance: number
	percentile: number // 0–100; lower = higher rank (top X%)
	rankLabel: string
}

// ─────────────────────────────────────────────────────────────────────────────
// Helper for percentile calculation (mock for now - can be replaced with real data)
// ─────────────────────────────────────────────────────────────────────────────

function getRankLabel(percentile: number): string {
	if (percentile <= 1) return " Legend"
	if (percentile <= 5) return "⚡ Elite"
	if (percentile <= 10) return " Top Scholar"
	if (percentile <= 25) return " Rising Star"
	if (percentile <= 50) return " Committed"
	return " Getting Started"
}

// Simple percentile calculation based on balance - this is a placeholder
// In a real implementation, you'd fetch leaderboard data from the backend
function calculatePercentile(balance: bigint): number {
	// Mock calculation: higher balance = better percentile (lower number)
	// This is just for demonstration - replace with real leaderboard logic
	const balanceNum = Number(balance)
	if (balanceNum >= 10000000000) return 1 // Top 1%
	if (balanceNum >= 5000000000) return 5 // Top 5%
	if (balanceNum >= 2000000000) return 10 // Top 10%
	if (balanceNum >= 1000000000) return 25 // Top 25%
	if (balanceNum >= 500000000) return 50 // Top 50%
	return 75 // Default
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook to handle previous balance tracking
// ─────────────────────────────────────────────────────────────────────────────

function useLearnTokenWithHistory(address: string): {
	data: LearnTokenData | null
	isLoading: boolean
	error: string | null
} {
	const { balance, isLoading } = useLearnToken(address)
	const [data, setData] = useState<LearnTokenData | null>(null)
	const [error, setError] = useState<string | null>(null)

	// Store previous balance in localStorage for persistence across sessions
	useEffect(() => {
		if (balance !== undefined) {
			try {
				const storageKey = `lrn-previous-balance-${address}`
				const storedPrevious = localStorage.getItem(storageKey)
				const previousBalance = storedPrevious
					? BigInt(storedPrevious)
					: balance

				// Only update previous balance if current balance is different
				if (balance !== previousBalance) {
					localStorage.setItem(storageKey, balance.toString())
				}

				const percentile = calculatePercentile(balance)

				setData({
					balance: Number(balance),
					previousBalance: Number(previousBalance),
					percentile,
					rankLabel: getRankLabel(percentile),
				})
				setError(null)
			} catch (e) {
				setError("Failed to process balance data.")
			}
		} else if (!isLoading) {
			setError("No balance data available.")
		}
	}, [balance, address, isLoading])

	return { data, isLoading, error }
}

// ─────────────────────────────────────────────────────────────────────────────
// Count-up animation hook
// ─────────────────────────────────────────────────────────────────────────────

function useCountUp(target: number, duration = 900): number {
	const [current, setCurrent] = useState(0)
	const rafRef = useRef<number | null>(null)
	const startRef = useRef<number | null>(null)
	const fromRef = useRef(0)

	useEffect(() => {
		if (target === 0) return
		fromRef.current = current
		startRef.current = null

		const step = (timestamp: number) => {
			if (!startRef.current) startRef.current = timestamp
			const elapsed = timestamp - startRef.current
			const progress = Math.min(elapsed / duration, 1)
			// Ease-out cubic
			const eased = 1 - Math.pow(1 - progress, 3)
			setCurrent(
				Math.round(fromRef.current + (target - fromRef.current) * eased),
			)
			if (progress < 1) {
				rafRef.current = requestAnimationFrame(step)
			}
		}

		rafRef.current = requestAnimationFrame(step)
		return () => {
			if (rafRef.current) cancelAnimationFrame(rafRef.current)
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [target])

	return current
}

// ─────────────────────────────────────────────────────────────────────────────
// Tooltip
// ─────────────────────────────────────────────────────────────────────────────

function Tooltip({ children }: { children: React.ReactNode }) {
	return (
		<span className="lrn-tooltip-wrap">
			{children}
			<style>{tooltipStyles}</style>
		</span>
	)
}

// ─────────────────────────────────────────────────────────────────────────────
// Skeleton
// ─────────────────────────────────────────────────────────────────────────────

function Skeleton({ size }: { size: WidgetSize }) {
	return (
		<>
			<style>{skeletonStyles}</style>
			{size === "sm" && (
				<span
					className="lrn-skeleton lrn-skeleton-sm"
					aria-label="Loading LRN balance"
				/>
			)}
			{size === "md" && (
				<div className="lrn-skeleton-card" aria-label="Loading LRN balance">
					<span className="lrn-skeleton lrn-skeleton-title" />
					<span className="lrn-skeleton lrn-skeleton-sub" />
				</div>
			)}
			{size === "lg" && (
				<div
					className="lrn-skeleton-card lrn-skeleton-card-lg"
					aria-label="Loading LRN balance"
				>
					<span className="lrn-skeleton lrn-skeleton-title lrn-skeleton-lg-title" />
					<span className="lrn-skeleton lrn-skeleton-sub" />
					<span className="lrn-skeleton lrn-skeleton-bar" />
				</div>
			)}
		</>
	)
}

// ─────────────────────────────────────────────────────────────────────────────
// Size variants
// ─────────────────────────────────────────────────────────────────────────────

/** sm — inline nav pill */
function SmWidget({
	data,
	animatedBalance,
}: {
	data: LearnTokenData
	animatedBalance: number
}) {
	return (
		<Tooltip>
			<span
				className="lrn-sm-pill"
				role="status"
				aria-label={`${formatLRN(BigInt(animatedBalance))} LRN tokens`}
			>
				<span className="lrn-trophy" aria-hidden="true">
					🏆
				</span>
				<span className="lrn-sm-balance">
					{formatLRN(BigInt(animatedBalance))}
				</span>
				<span className="lrn-sm-label">LRN</span>
				<span className="lrn-tooltip">
					LearnTokens (LRN) are your on-chain proof of learning. Earn them by
					completing course milestones. They unlock scholarships, governance
					rights, and your reputation score.
				</span>
			</span>
			<style>{smStyles}</style>
		</Tooltip>
	)
}

/** md — dashboard card */
function MdWidget({
	data,
	animatedBalance,
}: {
	data: LearnTokenData
	animatedBalance: number
}) {
	const delta = data.balance - data.previousBalance
	const gained = delta > 0

	return (
		<div className="lrn-md-card" role="region" aria-label="LRN Token Balance">
			<div className="lrn-md-header">
				<span className="lrn-md-icon" aria-hidden="true">
					🏆
				</span>
				<span className="lrn-md-title">LearnTokens</span>
				<Tooltip>
					<span
						className="lrn-info-btn"
						tabIndex={0}
						aria-label="What are LearnTokens?"
					>
						?
						<span className="lrn-tooltip lrn-tooltip-left">
							LearnTokens (LRN) are soulbound reputation tokens earned by
							completing course milestones. They unlock scholarships, governance
							voting, and your on-chain profile rank.
						</span>
					</span>
				</Tooltip>
			</div>
			<div className="lrn-md-balance" aria-live="polite">
				{formatLRN(BigInt(animatedBalance))}
				<span className="lrn-md-unit">LRN</span>
			</div>
			{gained && (
				<div
					className="lrn-md-change"
					aria-label={`Gained ${formatLRN(BigInt(delta))} LRN`}
				>
					<span className="lrn-change-arrow">↑</span>+{formatLRN(BigInt(delta))}{" "}
					LRN
				</div>
			)}
			<style>{mdStyles}</style>
		</div>
	)
}

/** lg — profile card */
function LgWidget({
	data,
	animatedBalance,
}: {
	data: LearnTokenData
	animatedBalance: number
}) {
	const delta = data.balance - data.previousBalance
	const gained = delta > 0
	// Arc bar fill: percentile is "top X%" so lower = better.
	// Show progress as (100 - percentile) / 100
	const fillPct = Math.max(0, Math.min(100, 100 - data.percentile))

	return (
		<div className="lrn-lg-card" role="region" aria-label="LRN Token Profile">
			{/* Header */}
			<div className="lrn-lg-header">
				<span className="lrn-lg-icon" aria-hidden="true">
					🏆
				</span>
				<div>
					<p className="lrn-lg-title">LearnToken Balance</p>
					<p className="lrn-lg-sub">Soulbound Reputation Score</p>
				</div>
				<Tooltip>
					<span
						className="lrn-info-btn lrn-info-btn-sm"
						tabIndex={0}
						aria-label="What are LearnTokens?"
					>
						?
						<span className="lrn-tooltip lrn-tooltip-left">
							LearnTokens (LRN) are non-transferable proof of learning, minted
							on-chain when you complete verified course milestones. Your
							balance determines scholarship eligibility and governance power
							within the LearnVault DAO.
						</span>
					</span>
				</Tooltip>
			</div>

			{/* Big balance */}
			<div className="lrn-lg-balance" aria-live="polite">
				<span className="lrn-lg-number">
					{formatLRN(BigInt(animatedBalance))}
				</span>
				<span className="lrn-lg-unit">LRN</span>
			</div>

			{gained && (
				<div
					className="lrn-lg-change"
					aria-label={`Gained ${formatLRN(BigInt(delta))} LRN`}
				>
					<span className="lrn-change-arrow">↑</span>+{formatLRN(BigInt(delta))}{" "}
					LRN this session
				</div>
			)}

			{/* Percentile bar */}
			<div className="lrn-lg-rank-wrap">
				<div className="lrn-lg-rank-label-row">
					<span className="lrn-lg-rank-badge">{data.rankLabel}</span>
					<span className="lrn-lg-percentile">Top {data.percentile}%</span>
				</div>
				<div
					className="lrn-lg-bar-track"
					role="progressbar"
					aria-valuenow={fillPct}
					aria-valuemin={0}
					aria-valuemax={100}
					aria-label={`Rank percentile: top ${data.percentile}%`}
				>
					<div className="lrn-lg-bar-fill" style={{ width: `${fillPct}%` }} />
				</div>
				<div className="lrn-lg-bar-hints">
					<span>All Learners</span>
					<span>Top 1%</span>
				</div>
			</div>

			<style>{lgStyles}</style>
		</div>
	)
}

// ─────────────────────────────────────────────────────────────────────────────
// Main export
// ─────────────────────────────────────────────────────────────────────────────

export function LRNBalanceWidget({
	address,
	size = "md",
	className = "",
}: LRNBalanceWidgetProps) {
	const { data, isLoading, error } = useLearnTokenWithHistory(address)
	const animatedBalance = useCountUp(data?.balance ?? 0)

	if (isLoading) return <Skeleton size={size} />

	if (error || !data) {
		return (
			<span className="lrn-error" role="alert">
				⚠ {error ?? "Unable to load balance."}
				<style>{errorStyles}</style>
			</span>
		)
	}

	return (
		<div className={`lrn-widget lrn-widget--${size} ${className}`.trim()}>
			{size === "sm" && (
				<SmWidget data={data} animatedBalance={animatedBalance} />
			)}
			{size === "md" && (
				<MdWidget data={data} animatedBalance={animatedBalance} />
			)}
			{size === "lg" && (
				<LgWidget data={data} animatedBalance={animatedBalance} />
			)}
			<style>{baseStyles}</style>
		</div>
	)
}

export default LRNBalanceWidget

// ─────────────────────────────────────────────────────────────────────────────
// Styles (scoped via class names — no external CSS file dependency)
// ─────────────────────────────────────────────────────────────────────────────

const baseStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=Space+Mono:wght@400;700&display=swap');

  .lrn-widget {
    font-family: 'Syne', sans-serif;
    box-sizing: border-box;
  }
  .lrn-widget *, .lrn-widget *::before, .lrn-widget *::after {
    box-sizing: inherit;
  }
  .lrn-change-arrow {
    display: inline-block;
    animation: lrn-bounce 0.6s ease infinite alternate;
  }
  @keyframes lrn-bounce {
    from { transform: translateY(0); }
    to   { transform: translateY(-3px); }
  }
`

const tooltipStyles = `
  .lrn-tooltip-wrap {
    position: relative;
    display: inline-flex;
    align-items: center;
  }
  .lrn-tooltip {
    display: none;
    position: absolute;
    bottom: calc(100% + 8px);
    left: 50%;
    transform: translateX(-50%);
    background: #0f1117;
    color: #e2d5ff;
    font-family: 'Syne', sans-serif;
    font-size: 12px;
    line-height: 1.5;
    padding: 10px 14px;
    border-radius: 10px;
    width: 220px;
    z-index: 9999;
    pointer-events: none;
    border: 1px solid #2e2a4a;
    box-shadow: 0 8px 24px rgba(0,0,0,0.5);
    white-space: normal;
  }
  .lrn-tooltip-left {
    left: auto;
    right: 0;
    transform: none;
  }
  .lrn-tooltip-wrap:hover .lrn-tooltip,
  .lrn-tooltip-wrap:focus-within .lrn-tooltip {
    display: block;
  }
`

const smStyles = `
  .lrn-sm-pill {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    background: linear-gradient(135deg, #1a1530 0%, #231d45 100%);
    border: 1px solid #3b3060;
    border-radius: 999px;
    padding: 5px 12px 5px 8px;
    cursor: default;
    position: relative;
    transition: border-color 0.2s, box-shadow 0.2s;
  }
  .lrn-sm-pill:hover {
    border-color: #7c5cfc;
    box-shadow: 0 0 0 3px rgba(124,92,252,0.15);
  }
  .lrn-trophy {
    font-size: 14px;
    line-height: 1;
  }
  .lrn-sm-balance {
    font-family: 'Space Mono', monospace;
    font-weight: 700;
    font-size: 13px;
    color: #d4bbff;
    letter-spacing: -0.3px;
  }
  .lrn-sm-label {
    font-family: 'Syne', sans-serif;
    font-size: 10px;
    font-weight: 700;
    color: #7c5cfc;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
`

const mdStyles = `
  .lrn-md-card {
    background: linear-gradient(145deg, #12101e 0%, #1a1530 60%, #1e1840 100%);
    border: 1px solid #2e2a4a;
    border-radius: 16px;
    padding: 20px 24px;
    min-width: 200px;
    position: relative;
    overflow: hidden;
    transition: box-shadow 0.3s;
  }
  .lrn-md-card::before {
    content: '';
    position: absolute;
    top: -30px; right: -30px;
    width: 100px; height: 100px;
    background: radial-gradient(circle, rgba(124,92,252,0.18) 0%, transparent 70%);
    pointer-events: none;
  }
  .lrn-md-card:hover {
    box-shadow: 0 0 0 1px #7c5cfc, 0 8px 32px rgba(124,92,252,0.15);
  }
  .lrn-md-header {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 12px;
  }
  .lrn-md-icon {
    font-size: 18px;
  }
  .lrn-md-title {
    font-family: 'Syne', sans-serif;
    font-size: 12px;
    font-weight: 700;
    color: #8878b0;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    flex: 1;
  }
  .lrn-info-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 18px; height: 18px;
    border-radius: 50%;
    background: #2e2a4a;
    color: #7c5cfc;
    font-size: 11px;
    font-weight: 700;
    cursor: default;
    font-family: 'Syne', sans-serif;
    position: relative;
    transition: background 0.2s;
  }
  .lrn-info-btn:hover { background: #3d3560; }
  .lrn-info-btn-sm { width: 16px; height: 16px; font-size: 10px; }
  .lrn-md-balance {
    font-family: 'Space Mono', monospace;
    font-size: 36px;
    font-weight: 700;
    color: #e8d8ff;
    letter-spacing: -1px;
    line-height: 1;
    display: flex;
    align-items: baseline;
    gap: 6px;
  }
  .lrn-md-unit {
    font-family: 'Syne', sans-serif;
    font-size: 14px;
    font-weight: 700;
    color: #7c5cfc;
    letter-spacing: 0.06em;
  }
  .lrn-md-change {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    margin-top: 10px;
    background: rgba(80, 230, 140, 0.1);
    color: #50e68c;
    font-family: 'Space Mono', monospace;
    font-size: 12px;
    font-weight: 700;
    padding: 3px 10px;
    border-radius: 999px;
    border: 1px solid rgba(80,230,140,0.2);
  }
`

const lgStyles = `
  .lrn-lg-card {
    background: linear-gradient(160deg, #0e0c1a 0%, #141027 50%, #1a1535 100%);
    border: 1px solid #2e2a4a;
    border-radius: 20px;
    padding: 24px;
    width: 100%;
    max-width: 380px;
    position: relative;
    overflow: hidden;
    transition: box-shadow 0.3s;
  }
  .lrn-lg-card::after {
    content: '';
    position: absolute;
    bottom: -60px; right: -60px;
    width: 180px; height: 180px;
    background: radial-gradient(circle, rgba(124,92,252,0.12) 0%, transparent 70%);
    pointer-events: none;
  }
  .lrn-lg-card:hover {
    box-shadow: 0 0 0 1px #7c5cfc, 0 12px 40px rgba(124,92,252,0.18);
  }
  .lrn-lg-header {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    margin-bottom: 20px;
  }
  .lrn-lg-icon {
    font-size: 28px;
    line-height: 1;
    margin-top: 2px;
  }
  .lrn-lg-title {
    font-family: 'Syne', sans-serif;
    font-size: 13px;
    font-weight: 700;
    color: #e8d8ff;
    letter-spacing: 0.04em;
    margin: 0 0 2px;
  }
  .lrn-lg-sub {
    font-family: 'Syne', sans-serif;
    font-size: 11px;
    color: #6b5f94;
    margin: 0;
    letter-spacing: 0.05em;
  }
  .lrn-lg-balance {
    display: flex;
    align-items: baseline;
    gap: 8px;
    margin-bottom: 8px;
  }
  .lrn-lg-number {
    font-family: 'Space Mono', monospace;
    font-size: 52px;
    font-weight: 700;
    color: #e8d8ff;
    letter-spacing: -2px;
    line-height: 1;
    background: linear-gradient(135deg, #e8d8ff 30%, #a87fff 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    background-clip: text;
  }
  .lrn-lg-unit {
    font-family: 'Syne', sans-serif;
    font-size: 18px;
    font-weight: 800;
    color: #7c5cfc;
    letter-spacing: 0.06em;
    -webkit-text-fill-color: #7c5cfc;
  }
  .lrn-lg-change {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: rgba(80,230,140,0.1);
    color: #50e68c;
    font-family: 'Space Mono', monospace;
    font-size: 12px;
    font-weight: 700;
    padding: 4px 12px;
    border-radius: 999px;
    border: 1px solid rgba(80,230,140,0.2);
    margin-bottom: 22px;
  }
  .lrn-lg-rank-wrap {
    margin-top: 4px;
  }
  .lrn-lg-rank-label-row {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 8px;
  }
  .lrn-lg-rank-badge {
    font-family: 'Syne', sans-serif;
    font-size: 13px;
    font-weight: 700;
    color: #d4bbff;
    background: rgba(124,92,252,0.12);
    border: 1px solid rgba(124,92,252,0.3);
    padding: 3px 10px;
    border-radius: 999px;
  }
  .lrn-lg-percentile {
    font-family: 'Space Mono', monospace;
    font-size: 12px;
    font-weight: 700;
    color: #7c5cfc;
    letter-spacing: 0.02em;
  }
  .lrn-lg-bar-track {
    background: #1e1840;
    border-radius: 999px;
    height: 8px;
    width: 100%;
    overflow: hidden;
    border: 1px solid #2e2a4a;
  }
  .lrn-lg-bar-fill {
    height: 100%;
    background: linear-gradient(90deg, #5b3fc4 0%, #a87fff 100%);
    border-radius: 999px;
    transition: width 1.2s cubic-bezier(0.23, 1, 0.32, 1);
    position: relative;
  }
  .lrn-lg-bar-fill::after {
    content: '';
    position: absolute;
    right: 0; top: 0; bottom: 0;
    width: 8px;
    background: #d4bbff;
    border-radius: 999px;
    box-shadow: 0 0 6px #a87fff;
  }
  .lrn-lg-bar-hints {
    display: flex;
    justify-content: space-between;
    margin-top: 5px;
    font-family: 'Syne', sans-serif;
    font-size: 10px;
    color: #4a4070;
    letter-spacing: 0.04em;
  }
`

const skeletonStyles = `
  @keyframes lrn-shimmer {
    0%   { background-position: -400px 0; }
    100% { background-position: 400px 0; }
  }
  .lrn-skeleton {
    display: block;
    background: linear-gradient(90deg, #1a1530 25%, #2e2a4a 50%, #1a1530 75%);
    background-size: 800px 100%;
    animation: lrn-shimmer 1.4s infinite linear;
    border-radius: 8px;
  }
  .lrn-skeleton-sm {
    width: 90px;
    height: 28px;
    border-radius: 999px;
  }
  .lrn-skeleton-card {
    background: transparent;
    border: 1px solid #2e2a4a;
    border-radius: 16px;
    padding: 20px 24px;
    min-width: 200px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .lrn-skeleton-card-lg {
    border-radius: 20px;
    padding: 28px;
    min-width: 280px;
    max-width: 380px;
  }
  .lrn-skeleton-title {
    width: 60%;
    height: 36px;
    border-radius: 8px;
  }
  .lrn-skeleton-lg-title {
    height: 52px;
  }
  .lrn-skeleton-sub {
    width: 40%;
    height: 14px;
  }
  .lrn-skeleton-bar {
    width: 100%;
    height: 8px;
    margin-top: 8px;
    border-radius: 999px;
  }
`

const errorStyles = `
  .lrn-error {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-family: 'Syne', sans-serif;
    font-size: 13px;
    color: #ff7070;
    background: rgba(255,100,100,0.08);
    border: 1px solid rgba(255,100,100,0.2);
    border-radius: 8px;
    padding: 8px 14px;
  }
`
