// i18next-scanner.config.js
// Detects missing translation keys in CI — Wave 4 i18n audit
// https://github.com/i18next/i18next-scanner

module.exports = {
  input: [
    "src/**/*.{ts,tsx}",
    "!src/**/*.test.{ts,tsx}",
    "!src/**/*.spec.{ts,tsx}",
    "!src/locales/**",
    "!node_modules/**",
  ],

  output: "./",

  options: {
    debug: false,
    removeUnusedKeys: false,
    sort: true,
    attr: {
      list: ["data-i18n"],
      extensions: [".html"],
    },
    func: {
      list: ["t", "i18n.t"],
      extensions: [".ts", ".tsx"],
    },
    trans: {
      component: "Trans",
      i18nKey: "i18nKey",
      extensions: [".tsx"],
      fallbackKey: false,
    },
    lngs: ["en", "fr", "sw"],
    ns: ["translation"],
    defaultLng: "en",
    defaultNs: "translation",
    defaultValue: "__MISSING__",
    resource: {
      loadPath: "src/locales/{{lng}}.json",
      savePath: "src/locales/{{lng}}.json",
      jsonIndent: 2,
      lineEnding: "\n",
    },
    nsSeparator: false,
    keySeparator: ".",
    pluralSeparator: "_",
    contextSeparator: "_",
    interpolation: {
      prefix: "{{",
      suffix: "}}",
    },
  },
};