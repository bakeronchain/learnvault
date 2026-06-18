/* global __ENV */
import { check, group, sleep } from "k6"
import http from "k6/http"
import { Counter, Rate, Trend } from "k6/metrics"

/**
 * Pool stress test — verifies the shared pg pool handles 50 concurrent users
 * without connection exhaustion (waitingClients stays bounded).
 *
 * Run against a server with DATABASE_URL configured:
 *   BASE_URL=http://localhost:4000 k6 run loadtests/k6/pool-concurrency.js
 */
const errorRate = new Rate("errors")
const healthDur = new Trend("duration_health", true)
const coursesDur = new Trend("duration_courses", true)
const poolWaiting = new Trend("pool_waiting_clients", true)
const poolExhaustionEvents = new Counter("pool_exhaustion_events")

const base = __ENV.BASE_URL || "http://localhost:4000"
const maxWaitingClients = Number(__ENV.K6_MAX_POOL_WAITING || "5")

export const options = {
	vus: 50,
	duration: "2m",
	thresholds: {
		http_req_failed: ["rate<0.02"],
		errors: ["rate<0.02"],
		pool_exhaustion_events: ["count==0"],
		pool_waiting_clients: [`max<${maxWaitingClients + 1}`],
	},
}

function get(path) {
	return http.get(`${base}${path}`, {
		headers: { Accept: "application/json" },
	})
}

function readWaitingClients(body) {
	try {
		const parsed = JSON.parse(body)
		const waiting =
			parsed?.dbPool?.waitingClients ??
			parsed?.database?.pool?.waitingCount ??
			null
		return typeof waiting === "number" ? waiting : null
	} catch {
		return null
	}
}

export default function () {
	group("health pool stats", function () {
		const res = get("/api/health")
		healthDur.add(res.timings.duration)

		const waiting = readWaitingClients(res.body)
		if (waiting !== null) {
			poolWaiting.add(waiting)
			if (waiting > maxWaitingClients) {
				poolExhaustionEvents.add(1)
			}
		}

		const ok = check(res, {
			"health 200": (r) => r.status === 200,
			"pool waiting bounded": () =>
				waiting === null || waiting <= maxWaitingClients,
		})
		if (!ok) errorRate.add(1)
		else errorRate.add(0)
	})
	sleep(0.1)

	group("courses list (db read)", function () {
		const res = get("/api/courses?limit=5&page=1")
		coursesDur.add(res.timings.duration)
		const ok = check(res, {
			"courses 2xx": (r) => r.status >= 200 && r.status < 300,
		})
		if (!ok) errorRate.add(1)
		else errorRate.add(0)
	})
	sleep(0.1)
}
