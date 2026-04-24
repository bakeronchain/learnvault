/**
 * Staging / API load tests (k6).
 *
 * Env:
 *   BASE_URL          — API origin (default http://localhost:4000)
 *   K6_COURSE_ID      — course_id for milestone submits (any string; default k6-loadtest-course)
 *
 * Auth scenario hits GET /api/auth/challenge at a low rate (10 req/min per IP on the server).
 * Courses: GET /api/courses (public list).
 * Milestones: POST /api/milestones/submit with unique scholar + milestone per iteration.
 */
import { check, sleep } from "k6"
import http from "k6/http"

const base = (__ENV.BASE_URL || "http://localhost:4000").replace(/\/$/, "")
const courseId = __ENV.K6_COURSE_ID || "k6-loadtest-course"
const quick = __ENV.K6_QUICK === "true"

/** Valid Stellar account IDs for /api/auth/challenge (StrKey check on server). */
const stellarAddresses = [
	"GCIVENRADXZZ6CFHOD3QXJFG65KGP3W2WNSQ2RCBIMXBAMN6MYDS2NPY",
	"GDAEXMF47WKIAR3QLGLC6CMIHWWNBHOMV366LIVGMG4GXRRNTIMHTSWI",
	"GA2FSEUSRSP6NEZPX4TN67QQNMYH4BWXLIV3PIOV4DBESW6QC23O4CLB",
	"GAYCJCYRP4SUERWHRMRLS3EY72MVBD2UVOJT6WAZPFWZK6UKSHEJJBQP",
	"GBTA2SVSHTP5OWTX3W2TTUU3QO24GZY5R3C6KFNUKTQAGNOIIWBS2WXA",
	"GDAAPMOA5QOJGJO66OTP4FRH6LPEC4AHL243NJ5GGVC4KPTEYLG4GECM",
	"GDCZPI3UGUJX2A7IFGTZST45KSHEDUGSA2AC2FCGIFY4HMPGTCGFYUMI",
	"GAOISSJGCMQV6WRNWADHCPY4WHQG6ECR4I5A73SGOLAYTZ5FDO2PCWKW",
	"GBCEOKCLHRC4L2TIIFGFW6BSKVXMGCJRNIWDSVQVMYXH5BJV2BWOS2CL",
	"GD5KOZB3NM4VI43AGUZLBTMUWLG4VARPMD4WYE4F25CUQPX73HLN4ZOG",
	"GC44VFAZTXTE3YUSYMDMUUAPJA6JPHOPJ4CHKGJCZUKI4UBZZ5KRRZTU",
	"GC7L6VIUEMN7MRAWMYKA3YPWD7LOTL7S4I4CLZUIEEFSOE56BZG2V2TC",
	"GC3SXQIXHHY4EV5LYY7ELMP4TSVPY5HXEOIJV3WJ44GRZU3ZSTGRA4CS",
	"GCZA3HICUOSKFISQEEPIJ2VKNC3G6PDQYQWVEXSDW2ZHLMPFQADFZ7RX",
	"GDL4D73FUUNCUUTJLXGXNINYVCJQYKK2RDYA6X67MO2YB67FDLCFUDWX",
	"GBXYCC76GK2C7FLKZLYIWKYOQ647HR3H7II5LWRU4TFILSKPCWR5FUXH",
	"GCRXBDYEBLBQ7XXAU2YBOKA3KA6M46OTBEPROKJH3DADXK5KINL6H5OB",
	"GCCGGSKEJGMOOMNATIWHLNKI35QOHO5IUH3QUISWJUMAM26TDRQ7GFBC",
	"GAP3RJC7CYQI2TYNYSBR7W2BMOGXYWCAZL6DLVO24GIYZYO5R7KZN7CV",
	"GAGONWQO3NBF5HSZPWMROUMXKD5LUSHLLISFIOQHJ6D5APR4MR3HSOJ7",
	"GDW7PZZ32HN4F5X3H3JYX54LH4C7BN7ZGZWNO622CJ3QTO2RFZQNQWAC",
	"GABYU5PBAUTYUJ7QAHOYRZQZ2NCJLOD3FH52E2JBQWMHUUSHSMLHW625",
	"GCFTGCUL5KQF37MTEW25JAWVCW2JEXN7S4P44BRHJ32WN7BWQIQTAOIZ",
	"GBERHAVBG6R2OAQRTWXDEPLZTB3ZSHXZP2Z5EIFXYV36IFT27CTYRKYO",
]

export const options = quick
	? {
			scenarios: {
				auth_challenge: {
					executor: "constant-arrival-rate",
					rate: 1,
					timeUnit: "15s",
					duration: "30s",
					preAllocatedVUs: 1,
					maxVUs: 2,
					exec: "authChallenge",
				},
				courses_list: {
					executor: "constant-vus",
					vus: 2,
					duration: "25s",
					exec: "coursesList",
				},
				milestone_submit: {
					executor: "constant-vus",
					vus: 1,
					duration: "20s",
					exec: "milestoneSubmit",
					startTime: "5s",
				},
			},
			thresholds: {
				"http_req_duration{name:auth}": ["p(95)<500"],
				"http_req_duration{name:courses}": ["p(95)<500"],
				"http_req_duration{name:milestones}": ["p(95)<500"],
				http_req_failed: ["rate<0.5"],
			},
			summaryTrendStats: ["avg", "min", "med", "max", "p(90)", "p(95)"],
		}
	: {
			scenarios: {
				auth_challenge: {
					executor: "constant-arrival-rate",
					// Stay under server nonce/challenge limiter (10 req/min per IP for these routes).
					rate: 1,
					timeUnit: "10s",
					duration: "2m",
					preAllocatedVUs: 2,
					maxVUs: 6,
					exec: "authChallenge",
					startTime: "0s",
				},
				courses_list: {
					executor: "ramping-vus",
					startVUs: 1,
					stages: [
						{ duration: "30s", target: 10 },
						{ duration: "2m", target: 25 },
						{ duration: "30s", target: 0 },
					],
					exec: "coursesList",
					startTime: "0s",
				},
				milestone_submit: {
					executor: "ramping-vus",
					startVUs: 0,
					stages: [
						{ duration: "45s", target: 8 },
						{ duration: "2m", target: 12 },
						{ duration: "30s", target: 0 },
					],
					exec: "milestoneSubmit",
					startTime: "15s",
				},
			},
			thresholds: {
				"http_req_duration{name:auth}": ["p(95)<500"],
				"http_req_duration{name:courses}": ["p(95)<500"],
				"http_req_duration{name:milestones}": ["p(95)<500"],
				http_req_failed: ["rate<0.05"],
			},
			summaryTrendStats: ["avg", "min", "med", "max", "p(90)", "p(95)"],
		}

export function authChallenge() {
	const addr =
		stellarAddresses[Math.floor(Math.random() * stellarAddresses.length)]
	const res = http.get(
		`${base}/api/auth/challenge?address=${encodeURIComponent(addr)}`,
		{ tags: { name: "auth" } },
	)
	check(res, {
		"auth challenge 200": (r) => r.status === 200,
	})
	sleep(0.3)
}

export function coursesList() {
	const res = http.get(`${base}/api/courses?page=1&limit=12`, {
		tags: { name: "courses" },
	})
	check(res, {
		"courses 200": (r) => r.status === 200,
	})
	sleep(0.05)
}

export function milestoneSubmit() {
	const scholar = `K6${__VU}I${__ITER}S${String(Date.now()).slice(-6)}`
	const body = JSON.stringify({
		scholarAddress: scholar.slice(0, 56),
		courseId,
		milestoneId: (__VU * 1_000_000 + __ITER) % 2_000_000_000,
		evidenceGithub: "https://github.com/example/project/commit/abcdef1",
	})
	const res = http.post(`${base}/api/milestones/submit`, body, {
		headers: { "Content-Type": "application/json" },
		tags: { name: "milestones" },
	})
	check(res, {
		"milestone accepted": (r) =>
			r.status === 201 || r.status === 409 || r.status === 429,
	})
	sleep(0.2)
}
