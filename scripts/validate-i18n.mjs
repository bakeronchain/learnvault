import fs from "fs"
import path from "path"

// Get all locale files
const localesDir = "./src/locales"
const files = fs
	.readdirSync(localesDir)
	.filter((file) => file.endsWith(".json"))

const locales = {}

// Read all locale files
for (const file of files) {
	const filePath = path.join(localesDir, file)
	const locale = file.replace(".json", "")
	locales[locale] = JSON.parse(fs.readFileSync(filePath, "utf8"))
}

// Get all keys from en.json (reference)
function getAllKeys(obj, prefix = "") {
	const keys = []
	for (const [key, value] of Object.entries(obj)) {
		const fullKey = prefix ? `${prefix}.${key}` : key
		if (value === null || value === undefined) {
			keys.push(fullKey)
		} else if (typeof value === "string") {
			keys.push(fullKey)
		} else if (typeof value === "object" && !Array.isArray(value)) {
			keys.push(...getAllKeys(value, fullKey))
		}
	}
	return keys
}

const enKeys = new Set(getAllKeys(locales.en))
const supportedLocales = ["es", "fr", "sw"]
let hasErrors = false

// Check each supported locale
for (const locale of supportedLocales) {
	if (!locales[locale]) {
		console.error(`❌ Missing locale file: ${locale}.json`)
		hasErrors = true
		continue
	}

	const localeKeys = new Set(getAllKeys(locales[locale]))

	// Check for missing keys in locale
	const missingKeys = [...enKeys].filter((key) => !localeKeys.has(key))
	if (missingKeys.length > 0) {
		console.error(
			`❌ ${locale}.json is missing ${missingKeys.length} key(s):`,
		)
		missingKeys.forEach((key) => console.error(`   - ${key}`))
		hasErrors = true
	}

	// Check for extra keys in locale (not in en.json)
	const extraKeys = [...localeKeys].filter((key) => !enKeys.has(key))
	if (extraKeys.length > 0) {
		console.warn(
			`⚠️  ${locale}.json has ${extraKeys.length} extra key(s):`,
		)
		extraKeys.forEach((key) => console.warn(`   - ${key}`))
	}

	if (missingKeys.length === 0 && extraKeys.length === 0) {
		console.log(`✅ ${locale}.json - all keys match en.json`)
	}
}

// Check for unexpected locale files (like ps.json)
const validLocales = new Set(["en", ...supportedLocales])
const unexpectedLocales = Object.keys(locales).filter(
	(locale) => !validLocales.has(locale),
)
if (unexpectedLocales.length > 0) {
	console.error(
		`❌ Unexpected locale file(s) found (not in supported locales):`,
	)
	unexpectedLocales.forEach((locale) =>
		console.error(
			`   - ${locale}.json (remove or add to supportedLngs in src/i18n.ts)`,
		),
	)
	hasErrors = true
}

if (hasErrors) {
	console.error("\n❌ i18n validation failed")
	process.exit(1)
} else {
	console.log("\n✅ All i18n locales have complete key parity")
	process.exit(0)
}
