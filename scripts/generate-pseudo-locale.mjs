#!/usr/bin/env node
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "fs"
import { dirname, join } from "path"
import { fileURLToPath } from "url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, "..")
const EN_PATH = join(ROOT, "src/locales/en.json")
const OUT_PATH = join(ROOT, "src/locales/pseudo.json")

function pseudoify(value) {
  if (typeof value !== "string") return value
  const tokens = []
  const withPlaceholders = value.replace(/\{\{[^}]+\}\}/g, (match) => {
    tokens.push(match)
    return `__TOKEN_${tokens.length - 1}__`
  })
  const pseudo = `[[${withPlaceholders}]]`
  return pseudo.replace(/__TOKEN_(\d+)__/g, (_, index) => tokens[Number(index)])
}

function transformNode(node) {
  if (typeof node === "string") return pseudoify(node)
  if (Array.isArray(node)) return node.map(transformNode)
  if (node !== null && typeof node === "object") {
    return Object.fromEntries(
      Object.entries(node).map(([key, value]) => [key, transformNode(value)])
    )
  }
  return node
}

if (!existsSync(EN_PATH)) {
  console.error(`❌ Could not find en.json at: ${EN_PATH}`)
  process.exit(1)
}

const en = JSON.parse(readFileSync(EN_PATH, "utf8"))
const pseudo = transformNode(en)

mkdirSync(dirname(OUT_PATH), { recursive: true })
writeFileSync(OUT_PATH, JSON.stringify(pseudo, null, 2) + "\n", "utf8")

console.log(`✅ Pseudo-locale generated → ${OUT_PATH}`)
console.log("   Open your app at: http://localhost:5173/?lng=pseudo")
console.log("   Any plain English text not wrapped in [[ ]] is hardcoded.")