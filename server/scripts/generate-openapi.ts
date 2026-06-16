import fs from "node:fs"
import path from "node:path"
import YAML from "yaml"

import { buildOpenApiSpec } from "../src/openapi"

const spec = buildOpenApiSpec()
const yaml = YAML.stringify(spec)

const outputPath = path.resolve(__dirname, "../../docs/openapi.yaml")
fs.mkdirSync(path.dirname(outputPath), { recursive: true })
fs.writeFileSync(outputPath, yaml, "utf8")

// eslint-disable-next-line no-console
console.log(`OpenAPI spec written to ${outputPath}`)

