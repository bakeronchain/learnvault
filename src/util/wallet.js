"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.wallet = exports.fetchBalances = exports.disconnectWallet = exports.connectWallet = void 0;
var stellar_wallets_kit_1 = require("@creit.tech/stellar-wallets-kit");
var stellar_sdk_1 = require("@stellar/stellar-sdk");
var util_1 = require("../contracts/util");
var storage_1 = require("./storage");
var kit = new stellar_wallets_kit_1.StellarWalletsKit({
    network: util_1.networkPassphrase,
    modules: (0, stellar_wallets_kit_1.sep43Modules)(),
});
var connectWallet = function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, kit.openModal({
                    modalTitle: "Connect to your wallet",
                    onWalletSelected: function (option) {
                        var selectedId = option.id;
                        kit.setWallet(selectedId);
                        // Now open selected wallet's login flow by calling `getAddress` --
                        // Yes, it's strange that a getter has a side effect of opening a modal
                        void kit.getAddress().then(function (address) {
                            // Once `getAddress` returns successfully, we know they actually
                            // connected the selected wallet, and we set our localStorage
                            if (address.address) {
                                storage_1.default.setItem("walletId", selectedId);
                                storage_1.default.setItem("walletAddress", address.address);
                            }
                            else {
                                storage_1.default.setItem("walletId", "");
                                storage_1.default.setItem("walletAddress", "");
                            }
                        });
                        if (selectedId == "freighter" || selectedId == "hot-wallet") {
                            void kit.getNetwork().then(function (network) {
                                if (network.network && network.networkPassphrase) {
                                    storage_1.default.setItem("walletNetwork", network.network);
                                    storage_1.default.setItem("networkPassphrase", network.networkPassphrase);
                                }
                                else {
                                    storage_1.default.setItem("walletNetwork", "");
                                    storage_1.default.setItem("networkPassphrase", "");
                                }
                            });
                        }
                    },
                })];
            case 1:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); };
exports.connectWallet = connectWallet;
var disconnectWallet = function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, kit.disconnect()];
            case 1:
                _a.sent();
                storage_1.default.removeItem("walletId");
                return [2 /*return*/];
        }
    });
}); };
exports.disconnectWallet = disconnectWallet;
function getHorizonHost(mode) {
    switch (mode) {
        case "LOCAL":
            return "http://localhost:8000";
        case "FUTURENET":
            return "https://horizon-futurenet.stellar.org";
        case "TESTNET":
            return "https://horizon-testnet.stellar.org";
        case "PUBLIC":
            return "https://horizon.stellar.org";
        default:
            throw new Error("Unknown Stellar network: ".concat(mode));
    }
}
var horizon = new stellar_sdk_1.Horizon.Server(getHorizonHost(util_1.stellarNetwork), {
    allowHttp: util_1.stellarNetwork === "LOCAL",
});
var formatter = new Intl.NumberFormat();
var fetchBalances = function (address) { return __awaiter(void 0, void 0, void 0, function () {
    var balances, mapped, err_1;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                _a.trys.push([0, 2, , 3]);
                return [4 /*yield*/, horizon.accounts().accountId(address).call()];
            case 1:
                balances = (_a.sent()).balances;
                mapped = balances.reduce(function (acc, b) {
                    b.balance = formatter.format(Number(b.balance));
                    var key = b.asset_type === "native"
                        ? "xlm"
                        : b.asset_type === "liquidity_pool_shares"
                            ? b.liquidity_pool_id
                            : "".concat(b.asset_code, ":").concat(b.asset_issuer);
                    acc[key] = b;
                    return acc;
                }, {});
                return [2 /*return*/, mapped];
            case 2:
                err_1 = _a.sent();
                // `not found` is sort of expected, indicating an unfunded wallet, which
                // the consumer of `balances` can understand via the lack of `xlm` key.
                // If the error does NOT match 'not found', log the error.
                // We should also possibly not return `{}` in this case?
                if (!(err_1 instanceof Error && err_1.message.match(/not found/i))) {
                    console.error(err_1);
                }
                return [2 /*return*/, {}];
            case 3: return [2 /*return*/];
        }
    });
}); };
exports.fetchBalances = fetchBalances;
exports.wallet = kit;
