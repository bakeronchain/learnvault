import fs from "fs"
import path from "path"

const enPath = path.resolve("src/locales/en.json")
const psPath = path.resolve("src/locales/ps.json")
const enJson = JSON.parse(fs.readFileSync(enPath, "utf8"))

const transformString = (value) => {
	if (typeof value !== "string") return value
	const preserved = value.replace(/{{\s*([^}]+)\s*}}/g, "{{$1}}")
	return `[[${preserved}]]`
}

const transformValue = (value) => {
	if (typeof value === "string") return transformString(value)
	if (Array.isArray(value)) return value.map(transformValue)
	if (value && typeof value === "object") {
		return Object.fromEntries(
			Object.entries(value).map(([key, item]) => [key, transformValue(item)]),
		)
	}
	return value
}

const pseudo = transformValue(enJson)
fs.writeFileSync(psPath, JSON.stringify(pseudo, null, "\t"), "utf8")
console.log(`Pseudo-locale generated at ${psPath}`)
