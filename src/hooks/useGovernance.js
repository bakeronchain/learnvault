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
exports.useGovernance = useGovernance;
var react_query_1 = require("@tanstack/react-query");
var react_1 = require("react");
var useWallet_1 = require("./useWallet");
var readEnv = function (key) {
    var value = import.meta.env[key];
    return typeof value === "string" && value.length ? value : undefined;
};
var SCHOLARSHIP_TREASURY_CONTRACT = readEnv("PUBLIC_SCHOLARSHIP_TREASURY_CONTRACT");
var GOVERNANCE_TOKEN_CONTRACT = readEnv("PUBLIC_GOVERNANCE_TOKEN_CONTRACT");
/**
 * Hook to manage governance interactions: reading proposals, voting power, and casting votes.
 */
function useGovernance() {
    var _this = this;
    var _a = (0, useWallet_1.useWallet)(), address = _a.address, signTransaction = _a.signTransaction;
    var queryClient = (0, react_query_1.useQueryClient)();
    // Helper to load contract clients
    var loadClient = (0, react_1.useCallback)(function (path) { return __awaiter(_this, void 0, void 0, function () {
        var mod, _a;
        var _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    _c.trys.push([0, 2, , 3]);
                    return [4 /*yield*/, Promise.resolve("".concat(/* @vite-ignore */ path)).then(function (s) { return require(s); })];
                case 1:
                    mod = (_c.sent());
                    return [2 /*return*/, (_b = mod.default) !== null && _b !== void 0 ? _b : mod];
                case 2:
                    _a = _c.sent();
                    return [2 /*return*/, null];
                case 3: return [2 /*return*/];
            }
        });
    }); }, []);
    // Fetch voting power (GOV token balance)
    var _b = (0, react_query_1.useQuery)({
        queryKey: ["governance", "votingPower", address],
        queryFn: function () { return __awaiter(_this, void 0, void 0, function () {
            var client, balanceFn, res;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!address || !GOVERNANCE_TOKEN_CONTRACT)
                            return [2 /*return*/, 0n];
                        return [4 /*yield*/, loadClient("../contracts/governance_token")];
                    case 1:
                        client = _a.sent();
                        if (!client)
                            return [2 /*return*/, 0n
                                // Standard Soroban token 'balance' call
                            ];
                        balanceFn = client.balance || client.get_balance;
                        if (typeof balanceFn !== "function")
                            return [2 /*return*/, 0n];
                        return [4 /*yield*/, balanceFn({ id: address, user: address })];
                    case 2:
                        res = _a.sent();
                        return [2 /*return*/, typeof res === "bigint" ? res : BigInt(res)];
                }
            });
        }); },
        enabled: !!address,
    }).data, votingPower = _b === void 0 ? 0n : _b;
    // Fetch all proposals
    var _c = (0, react_query_1.useQuery)({
        queryKey: ["governance", "proposals"],
        queryFn: function () { return __awaiter(_this, void 0, void 0, function () {
            var client, getProposalsFn, raw;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!SCHOLARSHIP_TREASURY_CONTRACT)
                            return [2 /*return*/, []];
                        return [4 /*yield*/, loadClient("../contracts/scholarship_treasury")];
                    case 1:
                        client = _a.sent();
                        if (!client)
                            return [2 /*return*/, []];
                        getProposalsFn = client.get_proposals || client.getProposals;
                        if (typeof getProposalsFn !== "function")
                            return [2 /*return*/, []];
                        return [4 /*yield*/, getProposalsFn()
                            // Transform contract response to Proposal interface
                        ];
                    case 2:
                        raw = _a.sent();
                        // Transform contract response to Proposal interface
                        return [2 /*return*/, (Array.isArray(raw) ? raw : []).map(function (p) {
                                var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m;
                                return ({
                                    id: Number((_a = p.id) !== null && _a !== void 0 ? _a : 0),
                                    title: String((_b = p.title) !== null && _b !== void 0 ? _b : ""),
                                    description: String((_c = p.description) !== null && _c !== void 0 ? _c : ""),
                                    author: String((_e = (_d = p.author) !== null && _d !== void 0 ? _d : p.author_address) !== null && _e !== void 0 ? _e : ""),
                                    status: ((_f = p.status) !== null && _f !== void 0 ? _f : "Active"),
                                    votesFor: BigInt((_h = (_g = p.votes_for) !== null && _g !== void 0 ? _g : p.votesFor) !== null && _h !== void 0 ? _h : 0),
                                    votesAgainst: BigInt((_k = (_j = p.votes_against) !== null && _j !== void 0 ? _j : p.votesAgainst) !== null && _k !== void 0 ? _k : 0),
                                    endDate: Number((_m = (_l = p.end_date) !== null && _l !== void 0 ? _l : p.endDate) !== null && _m !== void 0 ? _m : 0),
                                });
                            })];
                }
            });
        }); },
    }).data, proposals = _c === void 0 ? [] : _c;
    // Check if voter has already voted on a specific proposal
    var hasVoted = (0, react_1.useCallback)(function (proposalId) {
        // This could also be a query, but for the requested API we can check cache or fetch.
        // Let's assume we fetch this info or it's part of the proposal list.
        // Implementing as a query-backed check.
        return !!queryClient.getQueryData([
            "governance",
            "voted",
            proposalId,
            address,
        ]);
    }, [address, queryClient]);
    // Fetch individual 'voted' status for each proposal
    (0, react_query_1.useQuery)({
        queryKey: ["governance", "voted", address],
        queryFn: function () { return __awaiter(_this, void 0, void 0, function () {
            var client, hasVotedFn, results;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!address || !SCHOLARSHIP_TREASURY_CONTRACT || proposals.length === 0)
                            return [2 /*return*/, {}];
                        return [4 /*yield*/, loadClient("../contracts/scholarship_treasury")];
                    case 1:
                        client = _a.sent();
                        if (!client)
                            return [2 /*return*/, {}];
                        hasVotedFn = client.has_voted || client.hasVoted;
                        if (typeof hasVotedFn !== "function")
                            return [2 /*return*/, {}];
                        results = {};
                        return [4 /*yield*/, Promise.all(proposals.map(function (p) { return __awaiter(_this, void 0, void 0, function () {
                                var voted, _a;
                                return __generator(this, function (_b) {
                                    switch (_b.label) {
                                        case 0:
                                            _b.trys.push([0, 2, , 3]);
                                            return [4 /*yield*/, hasVotedFn({
                                                    voter: address,
                                                    proposal_id: p.id,
                                                    proposalId: p.id,
                                                })];
                                        case 1:
                                            voted = _b.sent();
                                            results[p.id] = !!voted;
                                            // Also update the individual cache
                                            queryClient.setQueryData(["governance", "voted", p.id, address], !!voted);
                                            return [3 /*break*/, 3];
                                        case 2:
                                            _a = _b.sent();
                                            results[p.id] = false;
                                            return [3 /*break*/, 3];
                                        case 3: return [2 /*return*/];
                                    }
                                });
                            }); }))];
                    case 2:
                        _a.sent();
                        return [2 /*return*/, results];
                }
            });
        }); },
        enabled: !!address && proposals.length > 0,
    });
    // Mutation for casting a vote
    var _d = (0, react_query_1.useMutation)({
        mutationFn: function (_a) { return __awaiter(_this, [_a], void 0, function (_b) {
            var client, voteFn, tx;
            var proposalId = _b.proposalId, support = _b.support;
            return __generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        if (!address)
                            throw new Error("Wallet not connected");
                        if (!SCHOLARSHIP_TREASURY_CONTRACT)
                            throw new Error("Contract not configured");
                        return [4 /*yield*/, loadClient("../contracts/scholarship_treasury")];
                    case 1:
                        client = _c.sent();
                        if (!client)
                            throw new Error("Contract client not found");
                        voteFn = client.vote || client.cast_vote;
                        if (typeof voteFn !== "function")
                            throw new Error("Vote method not found");
                        return [4 /*yield*/, voteFn({
                                proposal_id: proposalId,
                                proposalId: proposalId,
                                voter: address,
                                support: support,
                            }, { publicKey: address })
                            // signAndSend is expected on the tx object from generated clients
                        ];
                    case 2:
                        tx = _c.sent();
                        if (!(tx && typeof tx.signAndSend === "function")) return [3 /*break*/, 4];
                        return [4 /*yield*/, tx.signAndSend({ signTransaction: signTransaction })];
                    case 3:
                        _c.sent();
                        _c.label = 4;
                    case 4: return [2 /*return*/];
                }
            });
        }); },
        onSuccess: function (_, _a) {
            var proposalId = _a.proposalId;
            // Invalidate queries to refresh UI
            void queryClient.invalidateQueries({
                queryKey: ["governance", "proposals"],
            });
            void queryClient.invalidateQueries({ queryKey: ["governance", "voted"] });
            // Optimistically update the specific voted status
            queryClient.setQueryData(["governance", "voted", proposalId, address], true);
        },
    }), vote = _d.mutateAsync, isVoting = _d.isPending;
    return {
        votingPower: votingPower,
        proposals: proposals,
        vote: function (proposalId, support) {
            return vote({ proposalId: proposalId, support: support });
        },
        isVoting: isVoting,
        hasVoted: hasVoted,
    };
}
