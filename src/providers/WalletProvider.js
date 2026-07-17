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
exports.WalletProvider = exports.WalletContext = void 0;
var react_1 = require("react");
var storage_1 = require("../util/storage");
var wallet_1 = require("../util/wallet");
var signTransaction = wallet_1.wallet.signTransaction.bind(wallet_1.wallet);
/**
 * A good-enough implementation of deepEqual.
 *
 * Used in this file to compare MappedBalances.
 *
 * Should maybe add & use a new dependency instead, if needed elsewhere.
 */
function deepEqual(a, b) {
    if (a === b) {
        return true;
    }
    var bothAreObjects = a && b && typeof a === "object" && typeof b === "object";
    return Boolean(bothAreObjects &&
        Object.keys(a).length === Object.keys(b).length &&
        Object.entries(a).every(function (_a) {
            var k = _a[0], v = _a[1];
            return deepEqual(v, b[k]);
        }));
}
var POLL_INTERVAL = 1000;
exports.WalletContext = (0, react_1.createContext)({
    isPending: true,
    balances: {},
    updateBalances: function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
        return [2 /*return*/];
    }); }); },
    signTransaction: signTransaction,
});
var WalletProvider = function (_a) {
    var children = _a.children;
    var _b = (0, react_1.useState)({}), balances = _b[0], setBalances = _b[1];
    var _c = (0, react_1.useState)(), address = _c[0], setAddress = _c[1];
    var _d = (0, react_1.useState)(), network = _d[0], setNetwork = _d[1];
    var _e = (0, react_1.useState)(), networkPassphrase = _e[0], setNetworkPassphrase = _e[1];
    var _f = (0, react_1.useTransition)(), isPending = _f[0], startTransition = _f[1];
    var popupLock = (0, react_1.useRef)(false);
    var nullify = function () {
        setAddress(undefined);
        setNetwork(undefined);
        setNetworkPassphrase(undefined);
        setBalances({});
        storage_1.default.setItem("walletId", "");
        storage_1.default.setItem("walletAddress", "");
        storage_1.default.setItem("walletNetwork", "");
        storage_1.default.setItem("networkPassphrase", "");
    };
    var updateBalances = (0, react_1.useCallback)(function () { return __awaiter(void 0, void 0, void 0, function () {
        var newBalances;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!address) {
                        setBalances({});
                        return [2 /*return*/];
                    }
                    return [4 /*yield*/, (0, wallet_1.fetchBalances)(address)];
                case 1:
                    newBalances = _a.sent();
                    setBalances(function (prev) {
                        if (deepEqual(newBalances, prev))
                            return prev;
                        return newBalances;
                    });
                    return [2 /*return*/];
            }
        });
    }); }, [address]);
    (0, react_1.useEffect)(function () {
        void updateBalances();
    }, [updateBalances]);
    var updateCurrentWalletState = function () { return __awaiter(void 0, void 0, void 0, function () {
        var walletId, walletNetwork, walletAddr, passphrase, _a, a, n, e_1;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    walletId = storage_1.default.getItem("walletId");
                    walletNetwork = storage_1.default.getItem("walletNetwork");
                    walletAddr = storage_1.default.getItem("walletAddress");
                    passphrase = storage_1.default.getItem("networkPassphrase");
                    if (!address &&
                        walletAddr !== null &&
                        walletNetwork !== null &&
                        passphrase !== null) {
                        setAddress(walletAddr);
                        setNetwork(walletNetwork);
                        setNetworkPassphrase(passphrase);
                    }
                    if (!!walletId) return [3 /*break*/, 1];
                    nullify();
                    return [3 /*break*/, 6];
                case 1:
                    if (popupLock.current)
                        return [2 /*return*/];
                    _b.label = 2;
                case 2:
                    _b.trys.push([2, 4, 5, 6]);
                    popupLock.current = true;
                    wallet_1.wallet.setWallet(walletId);
                    if (walletId !== "freighter" && walletAddr !== null)
                        return [2 /*return*/];
                    return [4 /*yield*/, Promise.all([
                            wallet_1.wallet.getAddress(),
                            wallet_1.wallet.getNetwork(),
                        ])];
                case 3:
                    _a = _b.sent(), a = _a[0], n = _a[1];
                    if (!a.address)
                        storage_1.default.setItem("walletId", "");
                    if (a.address !== address ||
                        n.network !== network ||
                        n.networkPassphrase !== networkPassphrase) {
                        storage_1.default.setItem("walletAddress", a.address);
                        setAddress(a.address);
                        setNetwork(n.network);
                        setNetworkPassphrase(n.networkPassphrase);
                    }
                    return [3 /*break*/, 6];
                case 4:
                    e_1 = _b.sent();
                    // If `getNetwork` or `getAddress` throw errors... sign the user out???
                    nullify();
                    // then log the error (instead of throwing) so we have visibility
                    // into the error while working on LearnVault but we do not
                    // crash the app process
                    console.error(e_1);
                    return [3 /*break*/, 6];
                case 5:
                    popupLock.current = false;
                    return [7 /*endfinally*/];
                case 6: return [2 /*return*/];
            }
        });
    }); };
    (0, react_1.useEffect)(function () {
        var timer;
        var isMounted = true;
        // Create recursive polling function to check wallet state continuously
        var pollWalletState = function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!isMounted)
                            return [2 /*return*/];
                        return [4 /*yield*/, updateCurrentWalletState()];
                    case 1:
                        _a.sent();
                        if (isMounted) {
                            timer = setTimeout(function () { return void pollWalletState(); }, POLL_INTERVAL);
                        }
                        return [2 /*return*/];
                }
            });
        }); };
        // Get the wallet address when the component is mounted for the first time
        startTransition(function () { return __awaiter(void 0, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, updateCurrentWalletState()
                        // Start polling after initial state is loaded
                    ];
                    case 1:
                        _a.sent();
                        // Start polling after initial state is loaded
                        if (isMounted) {
                            timer = setTimeout(function () { return void pollWalletState(); }, POLL_INTERVAL);
                        }
                        return [2 /*return*/];
                }
            });
        }); });
        // Clear the timeout and stop polling when the component unmounts
        return function () {
            isMounted = false;
            if (timer)
                clearTimeout(timer);
        };
    }, []); // eslint-disable-line react-hooks/exhaustive-deps -- it SHOULD only run once per component mount
    var contextValue = (0, react_1.useMemo)(function () { return ({
        address: address,
        network: network,
        networkPassphrase: networkPassphrase,
        balances: balances,
        updateBalances: updateBalances,
        isPending: isPending,
        signTransaction: signTransaction,
    }); }, [address, network, networkPassphrase, balances, updateBalances, isPending]);
    return <exports.WalletContext value={contextValue}>{children}</exports.WalletContext>;
};
exports.WalletProvider = WalletProvider;
