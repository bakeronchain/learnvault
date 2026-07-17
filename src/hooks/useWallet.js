"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useWallet = void 0;
var react_1 = require("react");
var WalletProvider_1 = require("../providers/WalletProvider");
var useWallet = function () {
    var ctx = (0, react_1.use)(WalletProvider_1.WalletContext);
    if (!ctx) {
        throw new Error("useWallet must be used within a WalletProvider");
    }
    return ctx;
};
exports.useWallet = useWallet;
