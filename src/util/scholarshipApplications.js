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
exports.atomicUnitsToDisplayAmount = exports.amountToAtomicUnits = exports.storeScholarshipProposal = exports.readStoredScholarshipProposals = exports.createStoredScholarshipProposal = exports.explorerTransactionUrl = exports.buildDaoProposalPath = exports.shortenAddress = exports.formatUsdcAmount = exports.formatLrnBalance = exports.parseDisplayBalance = exports.flattenZodErrors = exports.emptyScholarshipApplication = exports.scholarshipApplicationSchema = exports.reviewSchema = exports.fundingRequestSchema = exports.programDetailsSchema = exports.milestoneSchema = exports.ESTIMATED_NETWORK_FEE_XLM = exports.SCHOLARSHIP_MIN_LRN = exports.LEARN_TOKEN_CONTRACT = exports.SCHOLARSHIP_TREASURY_CONTRACT = void 0;
var zod_1 = require("zod");
var util_1 = require("../contracts/util");
var STORAGE_KEY = "learnvault:scholarship-proposals:v1";
var TOKEN_DECIMALS = 7n;
var DECIMAL_FACTOR = Math.pow(10n, TOKEN_DECIMALS);
var DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
var readEnv = function (key) {
    var value = import.meta.env[key];
    return typeof value === "string" && value.trim().length > 0
        ? value.trim()
        : undefined;
};
var readNumberEnv = function (key, fallback) {
    var raw = readEnv(key);
    if (!raw)
        return fallback;
    var parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : fallback;
};
exports.SCHOLARSHIP_TREASURY_CONTRACT = readEnv("PUBLIC_SCHOLARSHIP_TREASURY_CONTRACT");
exports.LEARN_TOKEN_CONTRACT = readEnv("PUBLIC_LEARN_TOKEN_CONTRACT");
exports.SCHOLARSHIP_MIN_LRN = readNumberEnv("PUBLIC_SCHOLARSHIP_MIN_LRN", 100);
exports.ESTIMATED_NETWORK_FEE_XLM = 0.02;
var dateSchema = zod_1.z
    .string()
    .trim()
    .regex(DATE_PATTERN, "Use the YYYY-MM-DD format")
    .refine(function (value) { return !Number.isNaN(Date.parse("".concat(value, "T00:00:00Z"))); }, "Enter a valid date");
exports.milestoneSchema = zod_1.z.object({
    description: zod_1.z
        .string()
        .trim()
        .min(12, "Describe what this milestone covers")
        .max(140, "Keep each milestone under 140 characters"),
    dueDate: dateSchema,
});
exports.programDetailsSchema = zod_1.z.object({
    programName: zod_1.z
        .string()
        .trim()
        .min(3, "Enter the program or bootcamp name")
        .max(80, "Keep the name under 80 characters"),
    programUrl: zod_1.z.string().trim().url("Enter a valid URL, including https://"),
    programDescription: zod_1.z
        .string()
        .trim()
        .min(40, "Add more detail about your learning goal")
        .max(600, "Keep the description under 600 characters"),
    startDate: dateSchema,
});
exports.fundingRequestSchema = zod_1.z.object({
    amountUsdc: zod_1.z
        .string()
        .trim()
        .min(1, "Enter the USDC amount requested")
        .refine(function (value) { return /^\d+(\.\d{1,7})?$/.test(value); }, "Use up to 7 decimal places")
        .refine(function (value) { return Number(value) > 0; }, "Request an amount above 0 USDC"),
    milestones: zod_1.z
        .array(exports.milestoneSchema)
        .length(3, "Provide exactly 3 milestone checkpoints"),
});
exports.reviewSchema = zod_1.z.object({
    walletConfirmed: zod_1.z
        .boolean()
        .refine(function (value) { return value; }, "Confirm the connected wallet before submitting"),
});
exports.scholarshipApplicationSchema = zod_1.z
    .object(__assign(__assign(__assign({}, exports.programDetailsSchema.shape), exports.fundingRequestSchema.shape), exports.reviewSchema.shape))
    .superRefine(function (values, ctx) {
    var startDateValue = Date.parse("".concat(values.startDate, "T00:00:00Z"));
    var previousDate = startDateValue;
    values.milestones.forEach(function (milestone, index) {
        var dueDateValue = Date.parse("".concat(milestone.dueDate, "T00:00:00Z"));
        if (dueDateValue < startDateValue) {
            ctx.addIssue({
                code: zod_1.z.ZodIssueCode.custom,
                path: ["milestones", index, "dueDate"],
                message: "Milestones should not start before the program start date",
            });
        }
        if (dueDateValue < previousDate) {
            ctx.addIssue({
                code: zod_1.z.ZodIssueCode.custom,
                path: ["milestones", index, "dueDate"],
                message: "Milestone dates should move forward chronologically",
            });
        }
        previousDate = dueDateValue;
    });
});
var emptyScholarshipApplication = function () { return ({
    programName: "",
    programUrl: "",
    programDescription: "",
    startDate: "",
    amountUsdc: "",
    milestones: [
        { description: "", dueDate: "" },
        { description: "", dueDate: "" },
        { description: "", dueDate: "" },
    ],
    walletConfirmed: false,
}); };
exports.emptyScholarshipApplication = emptyScholarshipApplication;
var flattenZodErrors = function (error) {
    var next = {};
    for (var _i = 0, _a = error.issues; _i < _a.length; _i++) {
        var issue = _a[_i];
        var path = issue.path.length > 0 ? issue.path.join(".") : "form";
        if (!next[path]) {
            next[path] = issue.message;
        }
    }
    return next;
};
exports.flattenZodErrors = flattenZodErrors;
var parseDisplayBalance = function (value) {
    if (!value)
        return 0;
    return Number(value.replace(/,/g, "")) || 0;
};
exports.parseDisplayBalance = parseDisplayBalance;
var formatLrnBalance = function (value) {
    return new Intl.NumberFormat(undefined, {
        maximumFractionDigits: 2,
    }).format(value);
};
exports.formatLrnBalance = formatLrnBalance;
var formatUsdcAmount = function (value) {
    var numeric = typeof value === "number" ? value : Number(value);
    return new Intl.NumberFormat(undefined, {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 2,
    }).format(Number.isFinite(numeric) ? numeric : 0);
};
exports.formatUsdcAmount = formatUsdcAmount;
var shortenAddress = function (value) {
    if (value.length <= 12)
        return value;
    return "".concat(value.slice(0, 6), "...").concat(value.slice(-4));
};
exports.shortenAddress = shortenAddress;
var buildDaoProposalPath = function (proposalId) {
    return "/dao#proposal-".concat(proposalId);
};
exports.buildDaoProposalPath = buildDaoProposalPath;
var explorerTransactionUrl = function (txHash) {
    switch (util_1.stellarNetwork) {
        case "PUBLIC":
            return "https://stellar.expert/explorer/public/tx/".concat(txHash);
        case "TESTNET":
            return "https://stellar.expert/explorer/testnet/tx/".concat(txHash);
        case "FUTURENET":
            return "https://stellar.expert/explorer/futurenet/tx/".concat(txHash);
        default:
            return (0, util_1.labPrefix)();
    }
};
exports.explorerTransactionUrl = explorerTransactionUrl;
var createStoredScholarshipProposal = function (values, options) { return (__assign(__assign({}, values), { id: typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : "".concat(Date.now()), proposalId: options.proposalId, applicant: options.applicant, submittedAt: new Date().toISOString(), status: "pending", source: options.source, txHash: options.txHash, daoPath: (0, exports.buildDaoProposalPath)(options.proposalId) })); };
exports.createStoredScholarshipProposal = createStoredScholarshipProposal;
var readStoredScholarshipProposals = function () {
    if (typeof window === "undefined")
        return [];
    var raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw)
        return [];
    try {
        var parsed = JSON.parse(raw);
        return Array.isArray(parsed)
            ? __spreadArray([], parsed, true).sort(function (a, b) { return b.submittedAt.localeCompare(a.submittedAt); })
            : [];
    }
    catch (_a) {
        return [];
    }
};
exports.readStoredScholarshipProposals = readStoredScholarshipProposals;
var storeScholarshipProposal = function (proposal) {
    var existing = (0, exports.readStoredScholarshipProposals)().filter(function (item) { return item.id !== proposal.id; });
    var next = __spreadArray([proposal], existing, true).sort(function (a, b) {
        return b.submittedAt.localeCompare(a.submittedAt);
    });
    if (typeof window !== "undefined") {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next.slice(0, 30)));
    }
    return next;
};
exports.storeScholarshipProposal = storeScholarshipProposal;
var amountToAtomicUnits = function (value) {
    var _a = value.trim().split("."), wholePart = _a[0], _b = _a[1], fractionalPart = _b === void 0 ? "" : _b;
    var whole = BigInt(wholePart || "0");
    var fraction = BigInt("".concat(fractionalPart.padEnd(Number(TOKEN_DECIMALS), "0").slice(0, Number(TOKEN_DECIMALS)) || "0"));
    return whole * DECIMAL_FACTOR + fraction;
};
exports.amountToAtomicUnits = amountToAtomicUnits;
var atomicUnitsToDisplayAmount = function (value) {
    var units = typeof value === "bigint"
        ? value
        : typeof value === "number"
            ? BigInt(Math.trunc(value))
            : BigInt(value);
    return Number(units) / Number(DECIMAL_FACTOR);
};
exports.atomicUnitsToDisplayAmount = atomicUnitsToDisplayAmount;
