/// <reference path="./types.d.ts" />
import path from "node:path"

import swaggerJSDoc from "swagger-jsdoc"

export const buildOpenApiSpec = () => {
	const sourceGlob = path.resolve(__dirname, "./routes/*.ts")
	const transpiledGlob = path.resolve(__dirname, "./routes/*.js")
	const rootSourceGlob = path.resolve(__dirname, "../src/routes/*.ts")

	return swaggerJSDoc({
		definition: {
			openapi: "3.0.3",
			info: {
				title: "LearnVault API",
				version: "1.0.0",
				description: "Backend API for LearnVault frontend and integrations.",
			},
			servers: [
				{
					url: "http://localhost:4000/api/v1",
					description: "Local development server",
				},
			],
			tags: [
				{ name: "Health", description: "Server status endpoints" },
				{ name: "Auth", description: "Wallet authentication endpoints" },
				{ name: "Courses", description: "Course catalog endpoints" },
				{ name: "Enrollments", description: "Course enrollment endpoints" },
				{ name: "Governance", description: "Governance proposal endpoints" },
				{
					name: "Scholarships",
					description: "Scholarship application endpoints",
				},
				{ name: "Scholars", description: "Scholar leaderboard endpoints" },
				{ name: "Validator", description: "Milestone validation endpoints" },
				{ name: "Admin", description: "Admin milestone management endpoints" },
				{ name: "Credentials", description: "Scholar credential endpoints" },
				{ name: "Events", description: "Event stream endpoints" },
				{ name: "Leaderboard", description: "Learner ranking endpoints" },
				{
					name: "Streaks",
					description: "Learning streak and daily goal endpoints",
				},
				{ name: "Comments", description: "Proposal comment endpoints" },
				{
					name: "Treasury",
					description: "Treasury statistics and activity endpoints",
				},
				{ name: "Upload", description: "IPFS file upload endpoints" },
				{
					name: "Translations",
					description:
						"Course/lesson content translation, translator workspace, and glossary endpoints",
				},
			],
			components: {
				securitySchemes: {
					bearerAuth: {
						type: "http",
						scheme: "bearer",
						bearerFormat: "JWT",
					},
				},
				schemas: {
					ErrorResponse: {
						type: "object",
						properties: {
							error: {
								type: "string",
							},
						},
						required: ["error"],
					},
					ZodIssue: {
						type: "object",
						required: ["code", "path", "message"],
						properties: {
							code: { type: "string", example: "invalid_type" },
							path: {
								type: "array",
								items: { oneOf: [{ type: "string" }, { type: "integer" }] },
								example: ["walletAddress"],
							},
							message: { type: "string", example: "Required" },
						},
					},
					ValidationErrorResponse: {
						type: "object",
						required: ["errors"],
						properties: {
							errors: {
								type: "array",
								items: { $ref: "#/components/schemas/ZodIssue" },
							},
						},
					},
					HealthResponse: {
						type: "object",
						properties: {
							status: {
								type: "string",
								enum: ["healthy", "degraded", "unhealthy"],
								example: "healthy",
							},
							db: {
								type: "string",
								enum: ["connected", "disconnected"],
							},
							uptime: { type: "number", format: "float" },
							timestamp: { type: "string", format: "date-time" },
							version: { type: "string" },
							commitHash: { type: "string" },
							dbPool: {
								type: "object",
								properties: {
									totalConnections: { type: "integer", nullable: true },
									idleConnections: { type: "integer", nullable: true },
									waitingClients: { type: "integer", nullable: true },
								},
								required: [
									"totalConnections",
									"idleConnections",
									"waitingClients",
								],
							},
							checks: {
								type: "object",
								properties: {
									database: {
										type: "object",
										properties: {
											status: { type: "string" },
											responseTimeMs: { type: "integer", nullable: true },
											error: { type: "string" },
										},
										required: ["status", "responseTimeMs"],
									},
									redis: {
										type: "object",
										properties: {
											status: { type: "string" },
											responseTimeMs: { type: "integer", nullable: true },
											error: { type: "string" },
											details: { type: "string" },
										},
										required: ["status", "responseTimeMs"],
									},
									stellarHorizon: {
										type: "object",
										properties: {
											status: { type: "string" },
											responseTimeMs: { type: "integer", nullable: true },
											url: { type: "string" },
											error: { type: "string" },
										},
										required: ["status", "responseTimeMs", "url"],
									},
								},
								required: ["database", "redis", "stellarHorizon"],
							},
						},
						required: [
							"status",
							"db",
							"uptime",
							"timestamp",
							"version",
							"commitHash",
							"dbPool",
							"checks",
						],
					},
					Course: {
						type: "object",
						properties: {
							id: { type: "string" },
							title: { type: "string" },
							level: { type: "string" },
							published: { type: "boolean" },
						},
						required: ["id", "title", "level", "published"],
					},
					Event: {
						type: "object",
						properties: {
							id: { type: "string" },
							type: { type: "string" },
							entityId: { type: "string" },
							timestamp: { type: "string", format: "date-time" },
						},
						required: ["id", "type", "entityId", "timestamp"],
					},
					ValidatorRequest: {
						type: "object",
						properties: {
							courseId: { type: "string" },
							learnerAddress: { type: "string" },
							milestoneId: { type: "integer", minimum: 0 },
						},
						required: ["courseId", "learnerAddress", "milestoneId"],
					},
					ValidatorResult: {
						allOf: [
							{ $ref: "#/components/schemas/ValidatorRequest" },
							{
								type: "object",
								properties: {
									approved: { type: "boolean" },
									validator: { type: "string" },
								},
								required: ["approved", "validator"],
							},
						],
					},
					Proposal: {
						type: "object",
						properties: {
							id: { type: "integer" },
							author_address: { type: "string", example: "GABCD123456789..." },
							title: { type: "string" },
							description: { type: "string" },
							amount: { type: "number" },
							votes_for: { type: "integer" },
							votes_against: { type: "integer" },
							status: {
								type: "string",
								enum: ["pending", "approved", "queued", "rejected"],
							},
							cancelled: { type: "boolean" },
							deadline: { type: "string", format: "date-time" },
						},
						required: ["id", "author_address", "title", "status"],
					},
					ScholarRanking: {
						type: "object",
						properties: {
							rank: { type: "integer" },
							address: { type: "string" },
							lrn_balance: { type: "number" },
							courses_completed: { type: "integer" },
						},
						required: ["rank", "address", "lrn_balance", "courses_completed"],
					},
					ScholarshipApplication: {
						type: "object",
						properties: {
							applicant_address: {
								type: "string",
								minLength: 50,
								maxLength: 56,
							},
							full_name: { type: "string", minLength: 2 },
							course_id: { type: "string", minLength: 2 },
							motivation: { type: "string", minLength: 10 },
							evidence_url: { type: "string", format: "uri" },
							amount: {
								type: "number",
								description: "Requested USDC amount (default: 1000)",
							},
						},
						required: [
							"applicant_address",
							"full_name",
							"course_id",
							"motivation",
							"evidence_url",
						],
					},
					CourseDetail: {
						type: "object",
						properties: {
							id: { type: "integer" },
							slug: { type: "string" },
							title: { type: "string" },
							description: { type: "string" },
							coverImage: { type: "string", nullable: true },
							track: { type: "string" },
							difficulty: {
								type: "string",
								enum: ["beginner", "intermediate", "advanced"],
							},
							published: { type: "boolean" },
							createdAt: { type: "string", format: "date-time" },
							updatedAt: { type: "string", format: "date-time" },
							studentsCount: { type: "integer" },
							prerequisites: { type: "array", items: { type: "integer" } },
							avgRating: { type: "number", nullable: true },
							reviewCount: { type: "integer" },
							languageServed: {
								type: "string",
								enum: ["en", "es", "fr", "sw"],
								description: "The content language actually returned.",
							},
							isTranslation: {
								type: "boolean",
								description:
									"True when languageServed is a published translation, not English.",
							},
							isFallback: {
								type: "boolean",
								description:
									"True when a non-English language was requested but no published translation exists, so English was served instead.",
							},
							isStale: {
								type: "boolean",
								description:
									"True when the served translation was made from an older revision of the English source. Still served — never silently hidden.",
							},
							translatorAddress: {
								type: "string",
								nullable: true,
								description:
									"Wallet address credited for the served translation, or null for English/no translation.",
							},
							availableLanguages: {
								type: "array",
								items: { type: "string", enum: ["es", "fr", "sw"] },
								description:
									"Languages with at least one published translation for this course (course- or lesson-level), regardless of staleness.",
							},
							translationCoverage: {
								type: "object",
								properties: {
									totalLessons: { type: "integer" },
									translatedLessons: { type: "integer" },
								},
								description:
									"How many of the course's lessons have a published translation in the requested language — lets a learner see partial coverage before committing.",
							},
						},
						required: [
							"id",
							"slug",
							"title",
							"track",
							"difficulty",
							"published",
						],
					},
					Lesson: {
						type: "object",
						properties: {
							id: { type: "integer" },
							courseId: { type: "integer" },
							title: { type: "string" },
							content: { type: "string" },
							order: { type: "integer" },
							estimatedMinutes: { type: "integer" },
							isMilestone: { type: "boolean" },
							version: { type: "integer" },
							isLatest: { type: "boolean" },
							changeSummary: { type: "string", nullable: true },
							quiz: {
								type: "array",
								items: {
									type: "object",
									properties: {
										question: { type: "string" },
										options: { type: "array", items: { type: "string" } },
										correctIndex: { type: "integer" },
									},
								},
							},
							createdAt: { type: "string", format: "date-time" },
							updatedAt: { type: "string", format: "date-time" },
							languageServed: {
								type: "string",
								enum: ["en", "es", "fr", "sw"],
							},
							isTranslation: { type: "boolean" },
							isFallback: { type: "boolean" },
							isStale: { type: "boolean" },
							translatorAddress: { type: "string", nullable: true },
						},
						required: ["id", "courseId", "title", "content", "order"],
					},
					CourseTranslation: {
						type: "object",
						properties: {
							id: { type: "integer" },
							courseId: { type: "integer" },
							languageCode: { type: "string", enum: ["es", "fr", "sw"] },
							title: { type: "string" },
							description: { type: "string" },
							status: {
								type: "string",
								enum: ["draft", "in_review", "published"],
							},
							translatorAddress: { type: "string" },
							reviewedByAddress: { type: "string", nullable: true },
							sourceVersion: { type: "integer" },
							isStale: { type: "boolean" },
							publishedAt: {
								type: "string",
								format: "date-time",
								nullable: true,
							},
							updatedAt: { type: "string", format: "date-time" },
						},
					},
					LessonTranslation: {
						type: "object",
						properties: {
							id: { type: "integer" },
							courseId: { type: "integer" },
							orderIndex: { type: "integer" },
							languageCode: { type: "string", enum: ["es", "fr", "sw"] },
							title: { type: "string" },
							content: { type: "string" },
							status: {
								type: "string",
								enum: ["draft", "in_review", "published"],
							},
							translatorAddress: { type: "string" },
							reviewedByAddress: { type: "string", nullable: true },
							sourceVersion: { type: "integer" },
							isStale: { type: "boolean" },
							publishedAt: {
								type: "string",
								format: "date-time",
								nullable: true,
							},
							updatedAt: { type: "string", format: "date-time" },
						},
					},
					GlossaryTerm: {
						type: "object",
						properties: {
							id: { type: "integer" },
							term: { type: "string" },
							note: { type: "string", nullable: true },
						},
						required: ["id", "term"],
					},
					TranslatorGrant: {
						type: "object",
						properties: {
							id: { type: "integer" },
							wallet_address: { type: "string" },
							language_code: { type: "string", enum: ["es", "fr", "sw"] },
							granted_by: { type: "string" },
							granted_at: { type: "string", format: "date-time" },
							revoked_at: {
								type: "string",
								format: "date-time",
								nullable: true,
							},
						},
					},
					TranslatorQueue: {
						type: "object",
						properties: {
							untranslated: {
								type: "array",
								items: {
									type: "object",
									properties: {
										courseSlug: { type: "string" },
										courseTitle: { type: "string" },
										orderIndex: { type: "integer" },
										lessonTitle: { type: "string" },
									},
								},
							},
							inReview: {
								type: "array",
								items: {
									type: "object",
									properties: {
										kind: { type: "string", enum: ["course", "lesson"] },
										courseSlug: { type: "string" },
										orderIndex: { type: "integer", nullable: true },
										title: { type: "string" },
										submittedAt: { type: "string", format: "date-time" },
									},
								},
							},
							stale: {
								type: "array",
								items: {
									type: "object",
									properties: {
										kind: { type: "string", enum: ["course", "lesson"] },
										courseSlug: { type: "string" },
										orderIndex: { type: "integer", nullable: true },
										title: { type: "string" },
										staleSinceVersion: { type: "integer" },
									},
								},
							},
						},
					},
					GovernanceProposalInput: {
						type: "object",
						properties: {
							author_address: {
								type: "string",
								minLength: 50,
								maxLength: 56,
								example: "GABCD123456789...",
							},
							title: { type: "string", minLength: 5, maxLength: 200 },
							description: { type: "string", minLength: 10 },
							requested_amount: {
								type: "string",
								pattern: "^\\d+(\\.\\d+)?$",
								description:
									"Numeric string representing requested USDC amount",
							},
							evidence_url: { type: "string", format: "uri" },
						},
						required: [
							"author_address",
							"title",
							"description",
							"requested_amount",
							"evidence_url",
						],
					},
					GovernanceProposalCreated: {
						type: "object",
						properties: {
							proposal_id: { type: "integer" },
							tx_hash: { type: "string" },
						},
						required: ["proposal_id", "tx_hash"],
					},
					VotingPower: {
						type: "object",
						properties: {
							address: {
								type: "string",
								example: "GABCD123456789...",
							},
							gov_balance: {
								type: "string",
								description: "Raw governance token balance",
							},
							formatted: {
								type: "string",
								description: "Human-readable balance",
								example: "100.50",
							},
							can_vote: { type: "boolean" },
						},
						required: ["address", "gov_balance", "formatted", "can_vote"],
					},
					ScholarProfile: {
						type: "object",
						properties: {
							address: { type: "string" },
							lrn_balance: {
								type: "string",
								description: "Raw LRN token balance",
							},
							enrolled_courses: {
								type: "array",
								items: { type: "string" },
							},
							completed_milestones: { type: "integer" },
							pending_milestones: { type: "integer" },
							credentials: {
								type: "array",
								items: {
									$ref: "#/components/schemas/Credential",
								},
							},
							joined_at: { type: "string", format: "date-time" },
						},
						required: [
							"address",
							"lrn_balance",
							"enrolled_courses",
							"completed_milestones",
							"pending_milestones",
							"credentials",
							"joined_at",
						],
					},
					ScholarMilestone: {
						type: "object",
						properties: {
							id: { type: "string" },
							course_id: { type: "string" },
							milestone_id: { type: "integer" },
							status: {
								type: "string",
								enum: ["pending", "verified", "rejected"],
							},
							evidence_url: { type: "string", nullable: true },
							submitted_at: {
								type: "string",
								format: "date-time",
								nullable: true,
							},
							verified_at: {
								type: "string",
								format: "date-time",
								nullable: true,
							},
							tx_hash: { type: "string", nullable: true },
						},
						required: ["id", "course_id", "milestone_id", "status"],
					},
					Credential: {
						type: "object",
						properties: {
							token_id: { type: "integer" },
							course_id: { type: "string" },
							course_title: { type: "string" },
							issued_at: { type: "string", format: "date-time" },
							metadata_uri: { type: "string" },
							revoked: { type: "boolean" },
						},
						required: [
							"token_id",
							"course_id",
							"course_title",
							"issued_at",
							"metadata_uri",
							"revoked",
						],
					},
					CourseReview: {
						type: "object",
						properties: {
							id: { type: "integer" },
							course_id: { type: "string" },
							learner_address: { type: "string" },
							rating: { type: "integer", minimum: 1, maximum: 5 },
							reviewText: { type: "string", nullable: true },
							created_at: { type: "string", format: "date-time" },
						},
						required: [
							"id",
							"course_id",
							"learner_address",
							"rating",
							"created_at",
						],
					},
					CourseImportRow: {
						type: "object",
						properties: {
							title: { type: "string" },
							slug: { type: "string" },
							track: { type: "string" },
							difficulty: { type: "string" },
							description: { type: "string", nullable: true },
							coverImage: { type: "string", nullable: true },
							published: { type: "boolean" },
						},
						required: ["title", "slug", "track", "difficulty"],
					},
					UserProfile: {
						type: "object",
						properties: {
							address: { type: "string" },
							display_name: { type: "string", nullable: true },
							bio: { type: "string", nullable: true },
							avatar_url: { type: "string", nullable: true },
							twitter: { type: "string", nullable: true },
							github: { type: "string", nullable: true },
							website: { type: "string", nullable: true },
							created_at: { type: "string", format: "date-time" },
							updated_at: { type: "string", format: "date-time" },
						},
						required: ["address"],
					},
					ProfileStats: {
						type: "object",
						properties: {
							lrn_balance: { type: "string" },
							enrolled_courses: { type: "array", items: { type: "string" } },
							completed_milestones: { type: "integer" },
							pending_milestones: { type: "integer" },
						},
					},
				},
				responses: {
					BadRequestError: {
						description: "Bad request — validation failed",
						content: {
							"application/json": {
								schema: {
									$ref: "#/components/schemas/ValidationErrorResponse",
								},
							},
						},
					},
					UnauthorizedError: {
						description: "Unauthorized",
						content: {
							"application/json": {
								schema: {
									$ref: "#/components/schemas/ErrorResponse",
								},
							},
						},
					},
					NotFoundError: {
						description: "Resource not found",
						content: {
							"application/json": {
								schema: {
									$ref: "#/components/schemas/ErrorResponse",
								},
							},
						},
					},
					ForbiddenError: {
						description: "Forbidden",
						content: {
							"application/json": {
								schema: {
									$ref: "#/components/schemas/ErrorResponse",
								},
							},
						},
					},
					InternalServerError: {
						description: "Internal server error",
						content: {
							"application/json": {
								schema: {
									$ref: "#/components/schemas/ErrorResponse",
								},
							},
						},
					},
				},
			},
		},
		apis: [sourceGlob, transpiledGlob, rootSourceGlob],
	})
}
