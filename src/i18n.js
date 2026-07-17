"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var i18next_1 = require("i18next");
var i18next_browser_languagedetector_1 = require("i18next-browser-languagedetector");
var react_i18next_1 = require("react-i18next");
var en_json_1 = require("./locales/en.json");
var fr_json_1 = require("./locales/fr.json");
var sw_json_1 = require("./locales/sw.json");
var resources = {
    en: { translation: en_json_1.default },
    fr: { translation: fr_json_1.default },
    sw: { translation: sw_json_1.default },
};
void i18next_1.default
    // detect user language
    // learn more: https://github.com/i18next/i18next-browser-languageDetector
    .use(i18next_browser_languagedetector_1.default)
    // pass the i18n instance to react-i18next.
    .use(react_i18next_1.initReactI18next)
    // init i18next
    // for all options read: https://www.i18next.com/overview/configuration-options
    .init({
    resources: resources,
    fallbackLng: "en",
    interpolation: {
        escapeValue: false, // not needed for react as it escapes by default
    },
});
exports.default = i18next_1.default;
