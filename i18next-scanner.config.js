module.exports = {
	input: ["src/**/*.{ts,tsx}"],
	output: "./src/locales/$LOCALE.json",
	options: {
		debug: false,
		func: {
			list: ["t", "i18n.t"],
			extensions: [".ts", ".tsx"],
		},
		lngs: ["en", "fr", "sw", "ps"],
		ns: ["translation"],
		defaultLng: "en",
		defaultNs: "translation",
		resource: {
			loadPath: "src/locales/{{lng}}.json",
			savePath: "src/locales/{{lng}}.json",
		},
		keySeparator: false,
		namespaceSeparator: false,
		pluralSeparator: "",
		contextSeparator: "",
	},
}
