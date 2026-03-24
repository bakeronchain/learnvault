import path from "node:path";

import swaggerJSDoc from "swagger-jsdoc";

export const buildOpenApiSpec = () => {
  const sourceGlob = path.resolve(__dirname, "./routes/*.ts");
  const transpiledGlob = path.resolve(__dirname, "./routes/*.js");
  const rootSourceGlob = path.resolve(__dirname, "../src/routes/*.ts");

  return swaggerJSDoc({
    definition: {
      openapi: "3.0.3",
      info: {
        title: "LearnVault API",
        version: "1.0.0",
        description: "Backend API for LearnVault frontend and integrations."
      },
      servers: [
        {
          url: "http://localhost:4000",
          description: "Local development server"
        }
      ],
      tags: [
        { name: "Health", description: "Server status endpoints" },
        { name: "Courses", description: "Course catalog endpoints" },
        { name: "Validator", description: "Milestone validation endpoints" },
        { name: "Events", description: "Event stream endpoints" }
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: "http",
            scheme: "bearer",
            bearerFormat: "JWT"
          }
        },
        schemas: {
          ErrorResponse: {
            type: "object",
            properties: {
              error: {
                type: "string"
              }
            },
            required: ["error"]
          },
          HealthResponse: {
            type: "object",
            properties: {
              status: { type: "string", example: "ok" },
              timestamp: { type: "string", format: "date-time" }
            },
            required: ["status", "timestamp"]
          },
          Course: {
            type: "object",
            properties: {
              id: { type: "string" },
              title: { type: "string" },
              level: { type: "string" },
              published: { type: "boolean" }
            },
            required: ["id", "title", "level", "published"]
          },
          Event: {
            type: "object",
            properties: {
              id: { type: "string" },
              type: { type: "string" },
              entityId: { type: "string" },
              timestamp: { type: "string", format: "date-time" }
            },
            required: ["id", "type", "entityId", "timestamp"]
          },
          ValidatorRequest: {
            type: "object",
            properties: {
              courseId: { type: "string" },
              learnerAddress: { type: "string" },
              milestoneId: { type: "integer", minimum: 0 }
            },
            required: ["courseId", "learnerAddress", "milestoneId"]
          },
          ValidatorResult: {
            allOf: [
              { $ref: "#/components/schemas/ValidatorRequest" },
              {
                type: "object",
                properties: {
                  approved: { type: "boolean" },
                  validator: { type: "string" }
                },
                required: ["approved", "validator"]
              }
            ]
          }
        },
        responses: {
          BadRequestError: {
            description: "Bad request",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse"
                }
              }
            }
          },
          UnauthorizedError: {
            description: "Unauthorized",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse"
                }
              }
            }
          },
          NotFoundError: {
            description: "Resource not found",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse"
                }
              }
            }
          },
          InternalServerError: {
            description: "Internal server error",
            content: {
              "application/json": {
                schema: {
                  $ref: "#/components/schemas/ErrorResponse"
                }
              }
            }
          }
        }
      }
    },
    apis: [sourceGlob, transpiledGlob, rootSourceGlob]
  });
};
