import fs from "fs/promises"
import path from "path"

const LOCALES_DIR = path.join(process.cwd(), "src", "locales")
const DEFAULT_LOCALE = "en.json"

function flatten(object, prefix = "") {
  const result = {}
  for (const [key, value] of Object.entries(object)) {
    const nextKey = prefix ? `${prefix}.${key}` : key
    if (value && typeof value === "object" && !Array.isArray(value)) {
      Object.assign(result, flatten(value, nextKey))
    } else {
      result[nextKey] = value
    }
  }
  return result
}

function unflatten(flat) {
  const result = {}
  for (const [flatKey, value] of Object.entries(flat)) {
    const parts = flatKey.split(".")
    let current = result
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      if (i === parts.length - 1) {
        current[part] = value
      } else {
        if (!current[part] || typeof current[part] !== "object") {
          current[part] = {}
        }
        current = current[part]
      }
    }
  }
  return result
}

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, "utf8")
  return JSON.parse(raw)
}

async function writeJson(filePath, value) {
  await fs.writeFile(filePath, JSON.stringify(value, null, 2) + "\n", "utf8")
}

async function getLocaleFiles() {
  const entries = await fs.readdir(LOCALES_DIR)
  return entries.filter((entry) => entry.endsWith(".json"))
}

async function audit() {
  const files = await getLocaleFiles()
  const en = await readJson(path.join(LOCALES_DIR, DEFAULT_LOCALE))
  const enFlat = flatten(en)

  console.log(`Default locale ${DEFAULT_LOCALE} contains ${Object.keys(enFlat).length} keys.`)

  for (const file of files) {
    const localePath = path.join(LOCALES_DIR, file)
    const locale = await readJson(localePath)
    const localeFlat = flatten(locale)
    const missingKeys = Object.keys(enFlat).filter((key) => !(key in localeFlat))
    console.log(`${file}: ${Object.keys(localeFlat).length} keys; ${missingKeys.length} missing`)
    if (missingKeys.length > 0) {
      console.log(`  missing: ${missingKeys.slice(0, 25).join(", ")}`)
    }
  }
}

async function check() {
  const files = await getLocaleFiles()
  const en = await readJson(path.join(LOCALES_DIR, DEFAULT_LOCALE))
  const enFlat = flatten(en)
  let failed = false

  for (const file of files) {
    if (file === DEFAULT_LOCALE) continue
    const localePath = path.join(LOCALES_DIR, file)
    const locale = await readJson(localePath)
    const localeFlat = flatten(locale)
    const missingKeys = Object.keys(enFlat).filter((key) => !(key in localeFlat))
    if (missingKeys.length > 0) {
      failed = true
      console.error(`Locale ${file} is missing ${missingKeys.length} keys.`)
      console.error(`  first missing: ${missingKeys.slice(0, 25).join(", ")}`)
    }
  }

  if (failed) {
    process.exitCode = 2
  } else {
    console.log("All locale files contain the same translation keys as en.json.")
  }
}

async function sync() {
  const files = await getLocaleFiles()
  const en = await readJson(path.join(LOCALES_DIR, DEFAULT_LOCALE))
  const enFlat = flatten(en)

  for (const file of files) {
    if (file === DEFAULT_LOCALE) continue
    const localePath = path.join(LOCALES_DIR, file)
    const locale = await readJson(localePath)
    const localeFlat = flatten(locale)
    const missingKeys = Object.keys(enFlat).filter((key) => !(key in localeFlat))

    if (missingKeys.length === 0) {
      console.log(`${file} already has all keys.`)
      continue
    }

    for (const missingKey of missingKeys) {
      const value = enFlat[missingKey]
      localeFlat[missingKey] = typeof value === "string" ? `TODO: ${value}` : value
    }

    await writeJson(localePath, unflatten(localeFlat))
    console.log(`Synced ${missingKeys.length} missing keys into ${file}.`)
  }
}

async function main() {
  const command = process.argv[2] || "audit"
  if (!["audit", "check", "sync"].includes(command)) {
    console.error("Usage: node scripts/i18n-tools.mjs <audit|check|sync>")
    process.exit(1)
  }

  await {
    audit,
    check,
    sync,
  }[command]()
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
