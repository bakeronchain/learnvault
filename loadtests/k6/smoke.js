/* global __ENV */
import { check, group, sleep } from "k6"
import http from "k6/http"
import { Rate, Trend } from "k6/metrics"

// Baseline: p95 < 500ms for these routes under light load (tune in CI)
const errorRate = new Rate("errors")
const healthDur = new Trend("duration_health", true)
const coursesDur = new Trend("duration_courses", true)
const authDur = new Trend("duration_auth_proxy", true)

const base = __ENV.BASE_URL || "http://localhost:4000"
const jwt = __ENV.K6_JWT || ""

export const options = {
	vus: 5,
	duration: "1m",
	thresholds: {
		http_req_duration: ["p(95)<500"],
		errors: ["rate<0.05"],
	},
}

function req(method, path, body = null, withAuth = false) {
	const params = { headers: { "Content-Type": "application/json" } }
	if (withAuth && jwt) {
		params.headers.Authorization = `Bearer ${jwt}`
	}
	if (method === "GET") {
		return http.get(`${base}${path}`, params)
	}
	return http.post(`${base}${path}`, body ? JSON.stringify(body) : "{}", params)
}

export default function () {
	group("health", function () {
		const res = req("GET", "/api/health")
		healthDur.add(res.timings.duration)
		const ok = check(res, { "health 200": (r) => r.status === 200 })
		if (!ok) errorRate.add(1)
		else errorRate.add(0)
	})
	sleep(0.3)

	group("courses list", function () {
		const res = req("GET", "/api/courses?limit=5&page=1")
		coursesDur.add(res.timings.duration)
		const ok = check(res, {
			"courses 2xx": (r) => r.status >= 200 && r.status < 300,
		})
		if (!ok) errorRate.add(1)
		else errorRate.add(0)
	})
	sleep(0.3)

	// "Auth" path: validate JWT is accepted (GET /api/me) — set K6_JWT from a test user
	if (jwt) {
		group("me (auth check)", function () {
			const res = req("GET", "/api/me", null, true)
			authDur.add(res.timings.duration)
			const ok = check(res, { "me 200 with jwt": (r) => r.status === 200 })
			if (!ok) errorRate.add(1)
			else errorRate.add(0)
		})
		sleep(0.3)
	}
}
