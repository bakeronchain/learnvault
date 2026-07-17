"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ThemeToggle = void 0;
var design_system_1 = require("@stellar/design-system");
var react_1 = require("react");
var theme_1 = require("../util/theme");
var ThemeToggle = function () {
    var _a = (0, react_1.useState)(function () {
        return (0, theme_1.getStoredTheme)();
    }), storedTheme = _a[0], setStoredTheme = _a[1];
    var _b = (0, react_1.useState)(function () { return (0, theme_1.getSystemTheme)(); }), systemTheme = _b[0], setSystemTheme = _b[1];
    var activeTheme = storedTheme !== null && storedTheme !== void 0 ? storedTheme : systemTheme;
    var nextTheme = activeTheme === "dark" ? "light" : "dark";
    (0, react_1.useEffect)(function () {
        (0, theme_1.applyTheme)(activeTheme);
    }, [activeTheme]);
    (0, react_1.useEffect)(function () {
        if (typeof window === "undefined" ||
            typeof window.matchMedia !== "function") {
            return;
        }
        var mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
        var updateSystemTheme = function (matchesDark) {
            if (storedTheme === null) {
                setSystemTheme(matchesDark ? "dark" : "light");
            }
        };
        updateSystemTheme(mediaQuery.matches);
        var handleChange = function (event) {
            updateSystemTheme(event.matches);
        };
        mediaQuery.addEventListener("change", handleChange);
        return function () {
            mediaQuery.removeEventListener("change", handleChange);
        };
    }, [storedTheme]);
    var toggleTheme = function () {
        setStoredTheme(nextTheme);
        (0, theme_1.persistTheme)(nextTheme);
    };
    return (<design_system_1.Button variant="tertiary" size="md" onClick={toggleTheme} aria-label={"Switch to ".concat(nextTheme, " theme")} title={"Switch to ".concat(nextTheme, " theme")}>
			{activeTheme === "dark" ? <design_system_1.Icon.Sun /> : <design_system_1.Icon.Moon01 />}
		</design_system_1.Button>);
};
exports.ThemeToggle = ThemeToggle;
