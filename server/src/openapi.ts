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
					url: "http://localhost:4000",
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
				{ name: "Comments", description: "Proposal comment endpoints" },
				{
					name: "Treasury",
					description: "Treasury statistics and activity endpoints",
				},
				{ name: "Upload", description: "IPFS file upload endpoints" },
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
					HealthResponse: {
						type: "object",
						properties: {
							status: { type: "string", example: "ok" },
							timestamp: { type: "string", format: "date-time" },
						},
						required: ["status", "timestamp"],
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
								enum: ["pending", "approved", "rejected"],
							},
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
						},
						required: ["id", "courseId", "title", "content", "order"],
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
				},
				responses: {
					BadRequestError: {
						description: "Bad request",
						content: {
							"application/json": {
								schema: {
									$ref: "#/components/schemas/ErrorResponse",
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
