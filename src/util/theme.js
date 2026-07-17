"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.persistTheme = exports.applyTheme = exports.resolveTheme = exports.getStoredTheme = exports.getSystemTheme = void 0;
var storage_1 = require("./storage");
var themeClasses = {
    light: "sds-theme-light",
    dark: "sds-theme-dark",
};
var getSystemTheme = function () {
    if (typeof window !== "undefined" &&
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches) {
        return "dark";
    }
    return "light";
};
exports.getSystemTheme = getSystemTheme;
var getStoredTheme = function () {
    return storage_1.default.getItem("learnvault:theme", "safe");
};
exports.getStoredTheme = getStoredTheme;
var resolveTheme = function () { var _a; return (_a = (0, exports.getStoredTheme)()) !== null && _a !== void 0 ? _a : (0, exports.getSystemTheme)(); };
exports.resolveTheme = resolveTheme;
var applyTheme = function (theme) {
    if (typeof document === "undefined") {
        return;
    }
    var themeClass = themeClasses[theme];
    var targets = [document.documentElement, document.body].filter(function (target) { return target instanceof HTMLElement; });
    targets.forEach(function (target) {
        target.classList.remove(themeClasses.light, themeClasses.dark);
        target.classList.add(themeClass);
        target.setAttribute("data-theme", theme);
        target.setAttribute("data-sds-theme", themeClass);
    });
    document.documentElement.style.colorScheme = theme;
};
exports.applyTheme = applyTheme;
var persistTheme = function (theme) {
    storage_1.default.setItem("learnvault:theme", theme);
    (0, exports.applyTheme)(theme);
};
exports.persistTheme = persistTheme;
