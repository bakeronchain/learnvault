"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
exports.loadProfileOnChainData = exports.updateProfileIdentity = exports.getProfileIdentity = void 0;
var stellar_sdk_1 = require("@stellar/stellar-sdk");
var util_1 = require("../contracts/util");
var IDENTITY_KEY_PREFIX = "profileIdentity:";
var horizon = new stellar_sdk_1.Horizon.Server(util_1.horizonUrl, {
    allowHttp: util_1.stellarNetwork === "LOCAL",
});
var readEnv = function (key) {
    var value = import.meta.env[key];
    return typeof value === "string" && value.length > 0 ? value : undefined;
};
var contractIds = {
    learnToken: readEnv("PUBLIC_LEARN_TOKEN_CONTRACT"),
    courseMilestone: readEnv("PUBLIC_COURSE_MILESTONE_CONTRACT"),
    scholarNft: readEnv("PUBLIC_SCHOLAR_NFT_CONTRACT"),
    scholarshipGov: readEnv("PUBLIC_SCHOLARSHIP_GOVERNANCE_CONTRACT"),
};
var keyForIdentity = function (walletAddress) {
    return "".concat(IDENTITY_KEY_PREFIX).concat(walletAddress);
};
var getProfileIdentity = function (walletAddress) {
    var _a, _b;
    var key = keyForIdentity(walletAddress);
    var raw = localStorage.getItem(key);
    if (!raw) {
        return {
            bio: "",
            joinDateIso: new Date().toISOString(),
        };
    }
    try {
        var parsed = JSON.parse(raw);
        return {
            bio: (_a = parsed.bio) !== null && _a !== void 0 ? _a : "",
            avatarUrl: parsed.avatarUrl,
            joinDateIso: (_b = parsed.joinDateIso) !== null && _b !== void 0 ? _b : new Date().toISOString(),
        };
    }
    catch (_c) {
        return {
            bio: "",
            joinDateIso: new Date().toISOString(),
        };
    }
};
exports.getProfileIdentity = getProfileIdentity;
var updateProfileIdentity = function (walletAddress, patch) {
    var current = (0, exports.getProfileIdentity)(walletAddress);
    var next = __assign(__assign({}, current), patch);
    localStorage.setItem(keyForIdentity(walletAddress), JSON.stringify(next));
    return next;
};
exports.updateProfileIdentity = updateProfileIdentity;
var parseFormattedNumber = function (value) {
    if (!value)
        return 0;
    return Number(value.replace(/,/g, "")) || 0;
};
var simplePercentile = function (walletAddress, lrnBalance) {
    var hash = walletAddress
        .split("")
        .reduce(function (acc, ch) { return acc + ch.charCodeAt(0); }, 0);
    var score = Math.min(99, Math.max(1, Math.floor((hash + lrnBalance) % 100)));
    return score;
};
var fetchContractEvents = function (ids) { return __awaiter(void 0, void 0, void 0, function () {
    var response, payload;
    var _a, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                if (!ids.length)
                    return [2 /*return*/, []];
                return [4 /*yield*/, fetch(util_1.rpcUrl, {
                        method: "POST",
                        headers: { "content-type": "application/json" },
                        body: JSON.stringify({
                            jsonrpc: "2.0",
                            id: "profile-events",
                            method: "getEvents",
                            params: {
                                filters: [{ type: "contract", contractIds: ids }],
                                pagination: { limit: 100 },
                            },
                        }),
                    })];
            case 1:
                response = _c.sent();
                if (!response.ok)
                    return [2 /*return*/, []];
                return [4 /*yield*/, response.json()];
            case 2:
                payload = (_c.sent());
                return [2 /*return*/, (_b = (_a = payload.result) === null || _a === void 0 ? void 0 : _a.events) !== null && _b !== void 0 ? _b : []];
        }
    });
}); };
var stringifyEvent = function (event) {
    var _a;
    return JSON.stringify({
        topic: (_a = event.topics) !== null && _a !== void 0 ? _a : event.topic,
        value: event.value,
    });
};
var eventTimestamp = function (event) { var _a; return (_a = event.ledgerCloseTime) !== null && _a !== void 0 ? _a : new Date().toISOString(); };
var loadProfileOnChainData = function (walletAddress) { return __awaiter(void 0, void 0, void 0, function () {
    var account, lrnLine, lrnBalance, percentile, events, relevant, skillTracks, credentials, scholarships, activity;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, horizon.accounts().accountId(walletAddress).call()];
            case 1:
                account = _a.sent();
                lrnLine = account.balances.find(function (b) { var _a; return "asset_code" in b && ((_a = b.asset_code) === null || _a === void 0 ? void 0 : _a.toUpperCase()) === "LRN"; });
                lrnBalance = parseFormattedNumber(lrnLine === null || lrnLine === void 0 ? void 0 : lrnLine.balance);
                percentile = simplePercentile(walletAddress, lrnBalance);
                return [4 /*yield*/, fetchContractEvents([
                        contractIds.learnToken,
                        contractIds.courseMilestone,
                        contractIds.scholarNft,
                        contractIds.scholarshipGov,
                    ].filter(function (v) { return Boolean(v); })).catch(function () { return []; })];
            case 2:
                events = _a.sent();
                relevant = events.filter(function (e) {
                    return stringifyEvent(e).toLowerCase().includes(walletAddress.toLowerCase());
                });
                skillTracks = relevant
                    .filter(function (e) { return stringifyEvent(e).toLowerCase().includes("complete"); })
                    .slice(0, 6)
                    .map(function (e, idx) {
                    var _a;
                    return ({
                        id: (_a = e.id) !== null && _a !== void 0 ? _a : "skill-".concat(idx),
                        title: "Track completion #".concat(idx + 1),
                        completedAt: eventTimestamp(e),
                    });
                });
                credentials = relevant
                    .filter(function (e) { return stringifyEvent(e).toLowerCase().includes("mint"); })
                    .slice(0, 8)
                    .map(function (e, idx) {
                    var _a;
                    return ({
                        id: (_a = e.id) !== null && _a !== void 0 ? _a : "nft-".concat(idx),
                        title: "ScholarNFT #".concat(idx + 1),
                        earnedAt: eventTimestamp(e),
                    });
                });
                scholarships = relevant
                    .filter(function (e) {
                    var text = stringifyEvent(e).toLowerCase();
                    return (text.includes("proposal") ||
                        text.includes("scholarship") ||
                        text.includes("escrow"));
                })
                    .slice(0, 6)
                    .map(function (e, idx) {
                    var _a;
                    return ({
                        id: (_a = e.id) !== null && _a !== void 0 ? _a : "proposal-".concat(idx),
                        title: "Proposal #".concat(idx + 1),
                        status: "active",
                        updatedAt: eventTimestamp(e),
                    });
                });
                activity = relevant.slice(0, 10).map(function (e, idx) {
                    var _a;
                    return ({
                        id: (_a = e.id) !== null && _a !== void 0 ? _a : "activity-".concat(idx),
                        description: stringifyEvent(e),
                        timestamp: eventTimestamp(e),
                    });
                });
                return [2 /*return*/, {
                        reputationScore: Math.floor(lrnBalance),
                        lrnBalance: lrnBalance,
                        percentile: percentile,
                        skillTracks: skillTracks,
                        credentials: credentials,
                        scholarships: scholarships,
                        activity: activity,
                    }];
        }
    });
}); };
exports.loadProfileOnChainData = loadProfileOnChainData;
