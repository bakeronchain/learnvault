"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.LanguageSelector = void 0;
var react_1 = require("react");
var react_i18next_1 = require("react-i18next");
var LanguageSelector = function () {
    var i18n = (0, react_i18next_1.useTranslation)().i18n;
    var handleLanguageChange = function (e) {
        void i18n.changeLanguage(e.target.value);
    };
    return (<select value={i18n.language || "en"} onChange={handleLanguageChange} style={{
            padding: "6px 10px",
            borderRadius: "8px",
            background: "transparent",
            color: "var(--sds-clr-gray-12, #111827)",
            border: "1px solid var(--sds-clr-gray-06, #d1d5db)",
            cursor: "pointer",
            fontSize: "0.9rem",
            outline: "none",
        }}>
			<option value="en" style={{ color: "#000" }}>
				🇺🇸 English
			</option>
			<option value="fr" style={{ color: "#000" }}>
				🇫🇷 Français
			</option>
			<option value="sw" style={{ color: "#000" }}>
				🇰🇪 Kiswahili
			</option>
		</select>);
};
exports.LanguageSelector = LanguageSelector;
