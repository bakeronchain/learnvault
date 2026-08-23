module.exports = {
	input: ["src/**/*.{ts,tsx}"],
	// output is a directory, not a template — actual per-locale filenames
	// come from options.resource.loadPath/savePath below (which do support
	// {{lng}} interpolation). A literal "$LOCALE" here previously created a
	// bogus src/locales/$LOCALE.json/ directory instead of writing to the
	// real locale files.
	output: "./",
	options: {
		debug: false,
		func: {
			list: ["t", "i18n.t"],
			extensions: [".ts", ".tsx"],
		},
		lngs: ["en", "es", "fr", "sw"],
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
