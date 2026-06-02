# LearnVault Courses API

OpenAPI-style documentation for course and lesson endpoints served by the
backend.

## Authentication

Admin-only endpoints accept either:

- `Authorization: Bearer <jwt>` (must resolve to admin role/allowlist)
- `x-api-key: <ADMIN_API_KEY>`

### Security Responses

- `401` `{ "error": "Unauthorized" }`
- `403` `{ "error": "Forbidden" }`

---

## GET `/api/courses`

List published courses with optional filtering and pagination.

### Query Parameters

- `track` (string, optional) - case-insensitive exact match
- `difficulty` (string, optional) - one of: `beginner`, `intermediate`,
  `advanced`
- `page` (number, optional, default `1`)
- `limit` (number, optional, default `12`, max `50`)

### Responses

- `200`

```json
{
	"data": [
		{
			"id": 1,
			"slug": "stellar-basics",
			"title": "Stellar Basics",
			"description": "Intro to Stellar",
			"coverImage": "https://cdn.example.com/cover.png",
			"track": "web3",
			"difficulty": "beginner",
			"published": true,
			"createdAt": "2026-01-10T12:00:00.000Z",
			"updatedAt": "2026-01-12T15:00:00.000Z"
		}
	],
	"page": 1,
	"limit": 12,
	"total": 1,
	"totalPages": 1
}
```

- `500` `{ "error": "Internal server error" }`

### Example

Request:

```http
GET /api/courses?track=web3&difficulty=beginner&page=1&limit=12
```

---

## GET `/api/courses/{slug}`

Fetch one published course including its lessons ordered ascending by lesson
order.

### Path Parameters

- `slug` (string, required)

### Responses

- `200`

```json
{
	"id": 1,
	"slug": "stellar-basics",
	"title": "Stellar Basics",
	"description": "Intro to Stellar",
	"coverImage": null,
	"track": "web3",
	"difficulty": "beginner",
	"published": true,
	"createdAt": "2026-01-10T12:00:00.000Z",
	"updatedAt": "2026-01-12T15:00:00.000Z",
	"lessons": [
		{
			"id": 10,
			"courseId": 1,
			"title": "Wallet Setup",
			"content": "Lesson markdown...",
			"order": 1,
			"quiz": [],
			"createdAt": "2026-01-10T12:30:00.000Z",
			"updatedAt": "2026-01-10T12:30:00.000Z"
		}
	]
}
```

- `404` `{ "error": "Course not found" }`
- `500` `{ "error": "Internal server error" }`

### Example

Request:

```http
GET /api/courses/stellar-basics
```

---

## GET `/api/courses/{slug}/lessons/{id}`

Fetch one lesson by ID and ensure it belongs to the course identified by `slug`.

### Path Parameters

- `slug` (string, required)
- `id` (number, required)

### Responses

- `200`

```json
{
	"id": 10,
	"courseId": 1,
	"title": "Wallet Setup",
	"content": "Lesson markdown...",
	"order": 1,
	"quiz": [
		{
			"question": "What is Stellar?",
			"options": ["A network", "A wallet"],
			"correctIndex": 0
		}
	],
	"createdAt": "2026-01-10T12:30:00.000Z",
	"updatedAt": "2026-01-10T12:30:00.000Z"
}
```

- `404` `{ "error": "Lesson not found" }`
- `500` `{ "error": "Internal server error" }`

### Example

Request:

```http
GET /api/courses/stellar-basics/lessons/10
```

---

## POST `/api/courses` (admin only)

Create a new course. Courses are created unpublished by default.

### Headers

- `Authorization: Bearer <jwt>` or `x-api-key: <ADMIN_API_KEY>`
- `Content-Type: application/json`

### Request Body

```json
{
	"title": "Soroban Fundamentals",
	"slug": "soroban-fundamentals",
	"description": "Learn Soroban smart contract basics",
	"coverImage": "https://cdn.example.com/soroban.png",
	"track": "web3",
	"difficulty": "intermediate"
}
```

### Validation Rules

- Required: `title`, `slug`, `track`, `difficulty`
- `difficulty` must be: `beginner` | `intermediate` | `advanced`

### Responses

- `201` (created course object)
- `400` `{ "error": "title is required", "field": "title" }`
- `401` `{ "error": "Unauthorized" }`
- `403` `{ "error": "Forbidden" }`
- `409` `{ "error": "Slug already exists" }`
- `500` `{ "error": "Internal server error" }`

### Example

Request:

```http
POST /api/courses
Authorization: Bearer <admin-jwt>
Content-Type: application/json
```

Response:

```json
{
	"id": 11,
	"slug": "soroban-fundamentals",
	"title": "Soroban Fundamentals",
	"description": "Learn Soroban smart contract basics",
	"coverImage": "https://cdn.example.com/soroban.png",
	"track": "web3",
	"difficulty": "intermediate",
	"published": false,
	"createdAt": "2026-03-26T12:00:00.000Z",
	"updatedAt": "2026-03-26T12:00:00.000Z"
}
```

---

## PUT `/api/courses/{id}` (admin only)

Partially update a course by ID.

### Headers

- `Authorization: Bearer <jwt>` or `x-api-key: <ADMIN_API_KEY>`
- `Content-Type: application/json`

### Path Parameters

- `id` (number, required)

### Request Body

Any subset of:

```json
{
	"title": "Updated title",
	"slug": "updated-slug",
	"description": "Updated description",
	"coverImage": "https://cdn.example.com/new-cover.png",
	"track": "frontend",
	"difficulty": "advanced",
	"published": true
}
```

### Responses

- `200` (updated course object)
- `400` `{ "error": "No valid fields provided" }`
- `401` `{ "error": "Unauthorized" }`
- `403` `{ "error": "Forbidden" }`
- `404` `{ "error": "Course not found" }`
- `409` `{ "error": "Slug already exists" }`
- `500` `{ "error": "Internal server error" }`

### Example

Request:

```http
PUT /api/courses/11
x-api-key: replace_with_secure_admin_api_key
Content-Type: application/json
```

Response:

```json
{
	"id": 11,
	"slug": "updated-slug",
	"title": "Updated title",
	"description": "Updated description",
	"coverImage": "https://cdn.example.com/new-cover.png",
	"track": "frontend",
	"difficulty": "advanced",
	"published": true,
	"createdAt": "2026-03-26T12:00:00.000Z",
	"updatedAt": "2026-03-26T12:20:00.000Z"
}
```
