#!/usr/bin/env node
/**
 * Compare k6 --summary-export JSON against baseline.json (SLO + optional regression).
 *
 * Usage: node loadtest/compare-summary.mjs loadtest/baseline.json path/to/summary.json
 */
import { readFileSync, existsSync } from "node:fs"
import { resolve } from "node:path"

const baselinePath = resolve(process.argv[2] || "loadtest/baseline.json")
const summaryPath = resolve(process.argv[3] || "summary.json")

if (!existsSync(summaryPath)) {
	console.error("Missing summary file:", summaryPath)
	process.exit(1)
}

const baseline = JSON.parse(readFileSync(baselinePath, "utf8"))
const summary = JSON.parse(readFileSync(summaryPath, "utf8"))

const slo = Number(baseline.slo_p95_ms) || 500
const factor = Number(baseline.regression_factor) || 1.25
const metrics = baseline.metrics || {}

const tracked = [
	"http_req_duration{name:auth}",
	"http_req_duration{name:courses}",
	"http_req_duration{name:milestones}",
]

function p95(name) {
	const m = summary.metrics?.[name]
	if (!m?.values) return null
	const v = m.values["p(95)"]
	return typeof v === "number" ? v : null
}

let failed = false
const lines = []

for (const metricName of tracked) {
	const current = p95(metricName)
	if (current == null) {
		lines.push(`skip ${metricName}: no samples in summary`)
		continue
	}
	const baselineP95 = metrics[metricName]

	if (current > slo) {
		failed = true
		lines.push(`SLO ${metricName}: p95=${current.toFixed(1)}ms > ${slo}ms`)
	} else if (
		typeof baselineP95 === "number" &&
		current > baselineP95 * factor
	) {
		failed = true
		lines.push(
			`REGRESSION ${metricName}: p95=${current.toFixed(1)}ms > ${(baselineP95 * factor).toFixed(1)}ms (baseline ${baselineP95}ms × ${factor})`,
		)
	} else {
		lines.push(`ok ${metricName}: p95=${current.toFixed(1)}ms`)
	}
}

console.log(lines.join("\n"))
if (failed) {
	console.error("\ncompare-summary: failed")
	process.exit(1)
}
