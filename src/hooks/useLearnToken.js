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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.useLearnToken = useLearnToken;
var react_1 = require("react");
var react_query_1 = require("@tanstack/react-query");
var useContractIds_1 = require("./useContractIds");
var useNotification_1 = require("./useNotification");
var useSubscription_1 = require("./useSubscription");
var useWallet_1 = require("./useWallet");
/**
 * Dynamically loads the generated LearnToken contract client (or its shim).
 * Returns null if the module cannot be found at all.
 */
var loadLearnTokenClient = function () { return __awaiter(void 0, void 0, void 0, function () {
    var mod, _a;
    var _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _c.trys.push([0, 2, , 3]);
                return [4 /*yield*/, Promise.resolve().then(function () { return require("../contracts/learn_token"); })];
            case 1:
                mod = (_c.sent());
                return [2 /*return*/, (_b = mod.default) !== null && _b !== void 0 ? _b : mod];
            case 2:
                _a = _c.sent();
                return [2 /*return*/, null];
            case 3: return [2 /*return*/];
        }
    });
}); };
var toMethod = function (client, name) {
    var fn = client[name];
    return typeof fn === "function"
        ? fn
        : null;
};
/**
 * Unwraps the `.result` property that the Soroban SDK adds to simulation
 * responses. Falls back to the raw value when `.result` is absent.
 */
var unwrapResult = function (raw) {
    if (raw !== null && typeof raw === "object") {
        var obj = raw;
        if ("result" in obj)
            return obj.result;
    }
    return raw;
};
var toBigInt = function (value) {
    if (typeof value === "bigint")
        return value;
    if (typeof value === "number" && Number.isFinite(value))
        return BigInt(Math.trunc(value));
    if (typeof value === "string") {
        try {
            return BigInt(value);
        }
        catch (_a) {
            /* fall through */
        }
    }
    return 0n;
};
// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------
// Prefix used to invalidate all balance entries at once (e.g. after any mint).
var BALANCE_QUERY_KEY_PREFIX = ["learnToken", "balance"];
var BALANCE_STALE_TIME = 5 * 60 * 1000; // 5 minutes
// The LearnToken contract emits a MilestoneCompleted event. Soroban encodes
// the first topic as a Symbol from the #[contractevent] struct name. The SDK
// uses symbol_short! which is capped at 9 chars, so the actual on-chain topic
// is "mint" — the short prefix the contract function is known by.
// Adjust here if introspecting the deployed contract shows a different value.
var MINT_EVENT_TOPIC = "mint";
/**
 * Encapsulates all LearnToken contract interactions.
 *
 * @param address - Override the address whose balance is read. Defaults to
 *                  the connected wallet address.
 */
function useLearnToken(address) {
    var _this = this;
    var _a = (0, useWallet_1.useWallet)(), walletAddress = _a.address, signTransaction = _a.signTransaction;
    var _b = (0, useContractIds_1.useContractIds)(), contractId = _b.learnToken, isDeployed = _b.isDeployed;
    var addNotification = (0, useNotification_1.useNotification)().addNotification;
    var queryClient = (0, react_query_1.useQueryClient)();
    var targetAddress = address !== null && address !== void 0 ? address : walletAddress;
    var contractReady = isDeployed(contractId);
    // ---------------------------------------------------------------------------
    // Balance query
    // ---------------------------------------------------------------------------
    var balanceQueryKey = __spreadArray(__spreadArray([], BALANCE_QUERY_KEY_PREFIX, true), [targetAddress], false);
    var _c = (0, react_query_1.useQuery)({
        queryKey: balanceQueryKey,
        queryFn: function () { return __awaiter(_this, void 0, void 0, function () {
            var client, fn, raw, resolved;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, loadLearnTokenClient()];
                    case 1:
                        client = _a.sent();
                        if (!client || !contractReady)
                            return [2 /*return*/, 0n];
                        fn = toMethod(client, "balance");
                        if (!fn)
                            return [2 /*return*/, 0n];
                        return [4 /*yield*/, fn({ account: targetAddress, id: targetAddress })
                            // The shim's errResult signals that the generated client is not yet
                            // available; degrade gracefully to zero rather than surfacing an error.
                        ];
                    case 2:
                        raw = _a.sent();
                        resolved = unwrapResult(raw);
                        if (resolved !== null &&
                            typeof resolved === "object" &&
                            typeof resolved.isErr === "function" &&
                            resolved.isErr()) {
                            return [2 /*return*/, 0n];
                        }
                        return [2 /*return*/, toBigInt(resolved)];
                }
            });
        }); },
        // Only fetch when there is an address to look up.
        enabled: targetAddress !== undefined,
        staleTime: BALANCE_STALE_TIME,
    }), balance = _c.data, isLoading = _c.isLoading;
    // ---------------------------------------------------------------------------
    // Real-time refresh via mint events
    // ---------------------------------------------------------------------------
    var onMintEvent = (0, react_1.useCallback)(function (_event) {
        // Invalidate all balance entries so the leaderboard, profile, etc.
        // all pick up the new balance without waiting for the stale timer.
        void queryClient.invalidateQueries({ queryKey: BALANCE_QUERY_KEY_PREFIX });
    }, [queryClient]);
    // contractId falls back to "" (no-op) when the contract is not yet deployed.
    (0, useSubscription_1.useSubscription)(contractId !== null && contractId !== void 0 ? contractId : "", MINT_EVENT_TOPIC, onMintEvent);
    // ---------------------------------------------------------------------------
    // Mint mutation (admin only)
    // ---------------------------------------------------------------------------
    var _d = (0, react_query_1.useMutation)({
        mutationFn: function (_a) { return __awaiter(_this, [_a], void 0, function (_b) {
            var client, fn, rawTx;
            var to = _b.to, amount = _b.amount, courseId = _b.courseId;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0: return [4 /*yield*/, loadLearnTokenClient()];
                    case 1:
                        client = _c.sent();
                        if (!client || !contractReady) {
                            throw new Error("LearnToken contract is not deployed");
                        }
                        fn = toMethod(client, "mint");
                        if (!fn)
                            throw new Error("mint method not found on LearnToken client");
                        return [4 /*yield*/, fn({ to: to, amount: amount, course_id: courseId }, { publicKey: walletAddress !== null && walletAddress !== void 0 ? walletAddress : "" })];
                    case 2:
                        rawTx = _c.sent();
                        if (!(rawTx !== null &&
                            typeof rawTx === "object" &&
                            typeof rawTx.signAndSend === "function")) return [3 /*break*/, 4];
                        return [4 /*yield*/, rawTx.signAndSend({ signTransaction: signTransaction })];
                    case 3:
                        _c.sent();
                        _c.label = 4;
                    case 4: return [2 /*return*/];
                }
            });
        }); },
        onSuccess: function () {
            // Eagerly invalidate so callers see the updated balance immediately.
            void queryClient.invalidateQueries({ queryKey: BALANCE_QUERY_KEY_PREFIX });
            addNotification("LearnTokens minted successfully", "success");
        },
        onError: function (error) {
            var message = error instanceof Error ? error.message : "Mint failed";
            addNotification(message, "error");
        },
    }), mutateAsync = _d.mutateAsync, isMinting = _d.isPending;
    var mint = (0, react_1.useCallback)(function (to, amount, courseId) { return __awaiter(_this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0: return [4 /*yield*/, mutateAsync({ to: to, amount: amount, courseId: courseId })];
                case 1:
                    _a.sent();
                    return [2 /*return*/];
            }
        });
    }); }, [mutateAsync]);
    // ---------------------------------------------------------------------------
    // Return value
    // ---------------------------------------------------------------------------
    return {
        // Explicitly return undefined (not 0n) when there is no wallet, so callers
        // can distinguish "not connected" from "connected but zero balance".
        balance: targetAddress === undefined ? undefined : balance,
        isLoading: isLoading,
        mint: mint,
        isMinting: isMinting,
    };
}
