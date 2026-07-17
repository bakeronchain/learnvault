"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getFriendbotUrl = getFriendbotUrl;
var util_1 = require("../contracts/util");
// Utility to get the correct Friendbot URL based on environment
function getFriendbotUrl(address) {
    switch (util_1.stellarNetwork) {
        case "LOCAL":
            // Use proxy in development for local
            return "/friendbot?addr=".concat(address);
        case "FUTURENET":
            return "https://friendbot-futurenet.stellar.org/?addr=".concat(address);
        case "TESTNET":
            return "https://friendbot.stellar.org/?addr=".concat(address);
        default:
            throw new Error("Unknown or unsupported PUBLIC_STELLAR_NETWORK for friendbot: ".concat(util_1.stellarNetwork));
    }
}
