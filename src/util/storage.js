"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var TypedStorage = /** @class */ (function () {
    function TypedStorage() {
        this.storage = localStorage;
    }
    Object.defineProperty(TypedStorage.prototype, "length", {
        get: function () {
            return this.storage.length;
        },
        enumerable: false,
        configurable: true
    });
    TypedStorage.prototype.key = function (index) {
        return this.storage.key(index);
    };
    TypedStorage.prototype.getItem = function (key, retrievalMode) {
        if (retrievalMode === void 0) { retrievalMode = "fail"; }
        var item = this.storage.getItem(String(key));
        if (item == null) {
            return null;
        }
        try {
            var parsed = JSON.parse(item);
            if (key === "learnvault:theme") {
                if (parsed === "light" || parsed === "dark") {
                    return parsed;
                }
                if (retrievalMode === "safe") {
                    return null;
                }
                throw new Error("Invalid theme value for \"".concat(String(key), "\""));
            }
            return parsed;
        }
        catch (error) {
            switch (retrievalMode) {
                case "safe":
                    return null;
                case "raw":
                    return item;
                default:
                    throw new Error("Failed to parse localStorage key \"".concat(String(key), "\""), {
                        cause: error,
                    });
            }
        }
    };
    TypedStorage.prototype.setItem = function (key, value) {
        try {
            this.storage.setItem(String(key), JSON.stringify(value));
        }
        catch (error) {
            console.error("Failed to set localStorage key \"".concat(String(key), "\":"), error);
        }
    };
    TypedStorage.prototype.removeItem = function (key) {
        this.storage.removeItem(String(key));
    };
    TypedStorage.prototype.clear = function () {
        this.storage.clear();
    };
    return TypedStorage;
}());
var storage = new TypedStorage();
exports.default = storage;
