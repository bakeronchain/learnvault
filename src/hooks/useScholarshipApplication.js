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
exports.useScholarshipApplication = void 0;
var react_1 = require("react");
var scholarshipApplications_1 = require("../util/scholarshipApplications");
var useNotification_1 = require("./useNotification");
var useWallet_1 = require("./useWallet");
var generatedContractModules = import.meta.glob("../contracts/*.ts");
var getModuleLoader = function (suffix) {
    var _a;
    return (_a = Object.entries(generatedContractModules).find(function (_a) {
        var path = _a[0];
        return path.endsWith(suffix);
    })) === null || _a === void 0 ? void 0 : _a[1];
};
var learnTokenLoader = getModuleLoader("/learn_token.ts");
var scholarshipTreasuryLoader = getModuleLoader("/scholarship_treasury.ts");
var asMethod = function (value, name) {
    if (!value || typeof value !== "object")
        return null;
    var maybeMethod = value[name];
    return typeof maybeMethod === "function"
        ? maybeMethod
        : null;
};
var loadGeneratedClient = function (loader) { return __awaiter(void 0, void 0, void 0, function () {
    var mod;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                if (!loader)
                    return [2 /*return*/, null];
                return [4 /*yield*/, loader()];
            case 1:
                mod = _a.sent();
                if (!mod || typeof mod !== "object")
                    return [2 /*return*/, null];
                if ("default" in mod && mod.default && typeof mod.default === "object") {
                    return [2 /*return*/, mod.default];
                }
                return [2 /*return*/, mod];
        }
    });
}); };
var callFirst = function (client, methodNames, argumentVariants) { return __awaiter(void 0, void 0, void 0, function () {
    var _i, methodNames_1, methodName, method, _a, argumentVariants_1, args, _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _i = 0, methodNames_1 = methodNames;
                _c.label = 1;
            case 1:
                if (!(_i < methodNames_1.length)) return [3 /*break*/, 8];
                methodName = methodNames_1[_i];
                method = asMethod(client, methodName);
                if (!method)
                    return [3 /*break*/, 7];
                _a = 0, argumentVariants_1 = argumentVariants;
                _c.label = 2;
            case 2:
                if (!(_a < argumentVariants_1.length)) return [3 /*break*/, 7];
                args = argumentVariants_1[_a];
                _c.label = 3;
            case 3:
                _c.trys.push([3, 5, , 6]);
                return [4 /*yield*/, Promise.resolve(method.apply(void 0, args))];
            case 4: return [2 /*return*/, _c.sent()];
            case 5:
                _b = _c.sent();
                return [3 /*break*/, 6];
            case 6:
                _a++;
                return [3 /*break*/, 2];
            case 7:
                _i++;
                return [3 /*break*/, 1];
            case 8: throw new Error("No compatible method found: ".concat(methodNames.join(", ")));
        }
    });
}); };
var sendTxIfNeeded = function (maybeTx, signTransaction) { return __awaiter(void 0, void 0, void 0, function () {
    var tx;
    return __generator(this, function (_a) {
        if (!maybeTx || typeof maybeTx !== "object")
            return [2 /*return*/, maybeTx];
        tx = maybeTx;
        if (typeof tx.signAndSend === "function") {
            return [2 /*return*/, tx.signAndSend({
                    signTransaction: signTransaction,
                })];
        }
        return [2 /*return*/, maybeTx];
    });
}); };
var formatUnknownError = function (value) {
    if (value instanceof Error)
        return value.message;
    if (typeof value === "string")
        return value;
    try {
        return JSON.stringify(value);
    }
    catch (_a) {
        return "Transaction failed";
    }
};
var unwrapSendResult = function (value) {
    if (!value || typeof value !== "object")
        return value;
    var maybe = value;
    var nestedResult = maybe.result;
    if (nestedResult && typeof nestedResult === "object") {
        var typedResult = nestedResult;
        if (typeof typedResult.isErr === "function" && typedResult.isErr()) {
            var errorValue = typeof typedResult.unwrapErr === "function"
                ? typedResult.unwrapErr()
                : "Transaction failed";
            throw new Error(formatUnknownError(errorValue));
        }
        if (typeof typedResult.unwrap === "function") {
            return typedResult.unwrap();
        }
    }
    if (typeof maybe.unwrap === "function") {
        return maybe.unwrap();
    }
    return value;
};
var extractNumberLike = function (value, depth) {
    if (depth === void 0) { depth = 0; }
    if (depth > 5 || value == null)
        return null;
    if (typeof value === "bigint" || typeof value === "number")
        return value;
    if (typeof value === "string") {
        var trimmed = value.trim();
        return /^-?\d+$/.test(trimmed) ? trimmed : null;
    }
    if (Array.isArray(value)) {
        for (var _i = 0, value_1 = value; _i < value_1.length; _i++) {
            var item = value_1[_i];
            var found = extractNumberLike(item, depth + 1);
            if (found != null)
                return found;
        }
        return null;
    }
    if (typeof value === "object") {
        for (var _a = 0, _b = ["value", "amount", "balance", "result", "id"]; _a < _b.length; _a++) {
            var key = _b[_a];
            if (key in value) {
                var found = extractNumberLike(value[key], depth + 1);
                if (found != null)
                    return found;
            }
        }
        for (var _c = 0, _d = Object.values(value); _c < _d.length; _c++) {
            var nested = _d[_c];
            var found = extractNumberLike(nested, depth + 1);
            if (found != null)
                return found;
        }
    }
    return null;
};
var extractProposalId = function (value, depth) {
    if (depth === void 0) { depth = 0; }
    if (depth > 5 || value == null)
        return null;
    if (typeof value === "number" && Number.isInteger(value))
        return value;
    if (typeof value === "bigint" &&
        value <= BigInt(Number.MAX_SAFE_INTEGER) &&
        value >= BigInt(Number.MIN_SAFE_INTEGER)) {
        return Number(value);
    }
    if (typeof value === "string" && /^\d+$/.test(value.trim())) {
        return Number(value);
    }
    if (Array.isArray(value)) {
        for (var _i = 0, value_2 = value; _i < value_2.length; _i++) {
            var item = value_2[_i];
            var found = extractProposalId(item, depth + 1);
            if (found != null)
                return found;
        }
        return null;
    }
    if (typeof value === "object") {
        for (var _a = 0, _b = ["proposalId", "proposal_id", "id", "value"]; _a < _b.length; _a++) {
            var key = _b[_a];
            if (key in value) {
                var found = extractProposalId(value[key], depth + 1);
                if (found != null)
                    return found;
            }
        }
        for (var _c = 0, _d = Object.values(value); _c < _d.length; _c++) {
            var nested = _d[_c];
            var found = extractProposalId(nested, depth + 1);
            if (found != null)
                return found;
        }
    }
    return null;
};
var HEX_HASH_PATTERN = /\b[a-f0-9]{64}\b/i;
var extractTransactionHash = function (value, seen) {
    var _a;
    if (seen === void 0) { seen = new Set(); }
    if (value == null)
        return undefined;
    if (typeof value === "string") {
        return HEX_HASH_PATTERN.test(value)
            ? (_a = value.match(HEX_HASH_PATTERN)) === null || _a === void 0 ? void 0 : _a[0]
            : undefined;
    }
    if (typeof value !== "object")
        return undefined;
    if (seen.has(value))
        return undefined;
    seen.add(value);
    if (Array.isArray(value)) {
        for (var _i = 0, value_3 = value; _i < value_3.length; _i++) {
            var item = value_3[_i];
            var found = extractTransactionHash(item, seen);
            if (found)
                return found;
        }
        return undefined;
    }
    for (var _b = 0, _c = Object.values(value); _b < _c.length; _b++) {
        var nested = _c[_b];
        var found = extractTransactionHash(nested, seen);
        if (found)
            return found;
    }
    return undefined;
};
var fallbackProposalId = function () { return "".concat(Date.now()); };
var useScholarshipApplication = function () {
    var _a = (0, useWallet_1.useWallet)(), address = _a.address, balances = _a.balances, signTransaction = _a.signTransaction;
    var addNotification = (0, useNotification_1.useNotification)().addNotification;
    var _b = (0, react_1.useState)(false), isCheckingEligibility = _b[0], setIsCheckingEligibility = _b[1];
    var _c = (0, react_1.useState)(0), eligibilityBalance = _c[0], setEligibilityBalance = _c[1];
    var _d = (0, react_1.useState)("disconnected"), eligibilitySource = _d[0], setEligibilitySource = _d[1];
    var _e = (0, react_1.useState)(false), isSubmitting = _e[0], setIsSubmitting = _e[1];
    var _f = (0, react_1.useState)(null), latestSubmittedProposal = _f[0], setLatestSubmittedProposal = _f[1];
    var walletLrnBalance = (0, react_1.useMemo)(function () {
        var line = Object.values(balances).find(function (balance) {
            return "asset_code" in balance &&
                typeof balance.asset_code === "string" &&
                balance.asset_code.toUpperCase() === "LRN";
        });
        return (0, scholarshipApplications_1.parseDisplayBalance)(line === null || line === void 0 ? void 0 : line.balance);
    }, [balances]);
    var refreshEligibility = (0, react_1.useCallback)(function () { return __awaiter(void 0, void 0, void 0, function () {
        var client, rawBalance, resolved, numericValue, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (!address) {
                        setEligibilityBalance(0);
                        setEligibilitySource("disconnected");
                        return [2 /*return*/];
                    }
                    setIsCheckingEligibility(true);
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 5, 6, 7]);
                    return [4 /*yield*/, loadGeneratedClient(learnTokenLoader)];
                case 2:
                    client = _b.sent();
                    if (!(client && scholarshipApplications_1.LEARN_TOKEN_CONTRACT)) return [3 /*break*/, 4];
                    return [4 /*yield*/, callFirst(client, ["balance", "balance_of", "balanceOf", "get_balance", "getBalance"], [
                            [{ account: address }],
                            [{ owner: address }],
                            [{ user: address }],
                            [{ account: address }, { publicKey: address }],
                            [address],
                        ])];
                case 3:
                    rawBalance = _b.sent();
                    resolved = unwrapSendResult(rawBalance);
                    numericValue = extractNumberLike(resolved);
                    if (numericValue != null) {
                        setEligibilityBalance((0, scholarshipApplications_1.atomicUnitsToDisplayAmount)(numericValue));
                        setEligibilitySource("contract");
                        return [2 /*return*/];
                    }
                    _b.label = 4;
                case 4: return [3 /*break*/, 7];
                case 5:
                    _a = _b.sent();
                    return [3 /*break*/, 7];
                case 6:
                    setIsCheckingEligibility(false);
                    return [7 /*endfinally*/];
                case 7:
                    setEligibilityBalance(walletLrnBalance);
                    setEligibilitySource("wallet");
                    return [2 /*return*/];
            }
        });
    }); }, [address, walletLrnBalance]);
    (0, react_1.useEffect)(function () {
        void refreshEligibility();
    }, [refreshEligibility]);
    (0, react_1.useEffect)(function () {
        var _a;
        if (!address) {
            setLatestSubmittedProposal(null);
            return;
        }
        setLatestSubmittedProposal((_a = (0, scholarshipApplications_1.readStoredScholarshipProposals)().find(function (proposal) { return proposal.applicant === address; })) !== null && _a !== void 0 ? _a : null);
    }, [address]);
    var eligible = eligibilityBalance >= scholarshipApplications_1.SCHOLARSHIP_MIN_LRN;
    var lrnGap = Math.max(0, scholarshipApplications_1.SCHOLARSHIP_MIN_LRN - eligibilityBalance);
    var submitApplication = (0, react_1.useCallback)(function (values) { return __awaiter(void 0, void 0, void 0, function () {
        var parsed, source, proposalId, txHash, treasuryClient, payload, rawTx, sent, resolved, proposal, error_1, message;
        var _a, _b, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    if (!address) {
                        throw new Error("Connect your wallet before submitting a scholarship proposal");
                    }
                    parsed = scholarshipApplications_1.scholarshipApplicationSchema.parse(values);
                    if (eligibilityBalance < scholarshipApplications_1.SCHOLARSHIP_MIN_LRN) {
                        throw new Error("You need at least ".concat(scholarshipApplications_1.SCHOLARSHIP_MIN_LRN, " LRN before you can apply"));
                    }
                    setIsSubmitting(true);
                    _d.label = 1;
                case 1:
                    _d.trys.push([1, 6, 7, 8]);
                    source = "local-fallback";
                    proposalId = fallbackProposalId();
                    txHash = void 0;
                    return [4 /*yield*/, loadGeneratedClient(scholarshipTreasuryLoader)];
                case 2:
                    treasuryClient = _d.sent();
                    if (!(treasuryClient && scholarshipApplications_1.SCHOLARSHIP_TREASURY_CONTRACT)) return [3 /*break*/, 5];
                    payload = {
                        applicant: address,
                        amount: (0, scholarshipApplications_1.amountToAtomicUnits)(parsed.amountUsdc),
                        program_name: parsed.programName,
                        program_url: parsed.programUrl,
                        program_description: parsed.programDescription,
                        start_date: parsed.startDate,
                        milestone_titles: parsed.milestones.map(function (milestone) { return milestone.description; }),
                        milestone_dates: parsed.milestones.map(function (milestone) { return milestone.dueDate; }),
                    };
                    return [4 /*yield*/, callFirst(treasuryClient, [
                            "submit_proposal",
                            "submitProposal",
                            "create_proposal",
                            "createProposal",
                        ], [[payload, { publicKey: address }], [payload]])];
                case 3:
                    rawTx = _d.sent();
                    return [4 /*yield*/, sendTxIfNeeded(rawTx, signTransaction)];
                case 4:
                    sent = _d.sent();
                    resolved = unwrapSendResult(sent);
                    proposalId = String((_b = (_a = extractProposalId(resolved)) !== null && _a !== void 0 ? _a : extractProposalId(sent)) !== null && _b !== void 0 ? _b : fallbackProposalId());
                    txHash =
                        (_c = extractTransactionHash(sent)) !== null && _c !== void 0 ? _c : extractTransactionHash(resolved);
                    source = txHash || proposalId ? "on-chain" : "local-fallback";
                    _d.label = 5;
                case 5:
                    proposal = (0, scholarshipApplications_1.createStoredScholarshipProposal)(parsed, {
                        applicant: address,
                        proposalId: proposalId,
                        source: source,
                        txHash: txHash,
                    });
                    (0, scholarshipApplications_1.storeScholarshipProposal)(proposal);
                    setLatestSubmittedProposal(proposal);
                    addNotification(source === "on-chain"
                        ? "Scholarship proposal submitted successfully"
                        : "Scholarship proposal saved in local fallback mode", source === "on-chain" ? "success" : "warning");
                    return [2 /*return*/, proposal];
                case 6:
                    error_1 = _d.sent();
                    message = formatUnknownError(error_1);
                    addNotification(message, "error");
                    throw error_1;
                case 7:
                    setIsSubmitting(false);
                    return [7 /*endfinally*/];
                case 8: return [2 /*return*/];
            }
        });
    }); }, [address, addNotification, eligibilityBalance, signTransaction]);
    return {
        eligible: eligible,
        eligibilityBalance: eligibilityBalance,
        eligibilitySource: eligibilitySource,
        isCheckingEligibility: isCheckingEligibility,
        isSubmitting: isSubmitting,
        latestSubmittedProposal: latestSubmittedProposal,
        lrnGap: lrnGap,
        minLrnRequired: scholarshipApplications_1.SCHOLARSHIP_MIN_LRN,
        refreshEligibility: refreshEligibility,
        submitApplication: submitApplication,
    };
};
exports.useScholarshipApplication = useScholarshipApplication;
