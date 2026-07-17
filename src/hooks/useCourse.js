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
exports.useCourse = useCourse;
var react_1 = require("react");
var util_1 = require("../contracts/util");
var useNotification_1 = require("./useNotification");
var useWallet_1 = require("./useWallet");
var mockProgressStore = {};
var mockEnrollments = new Set();
var readEnv = function (key) {
    var value = import.meta.env[key];
    return typeof value === "string" && value.length ? value : undefined;
};
var COURSE_MILESTONE_CONTRACT = readEnv("PUBLIC_COURSE_MILESTONE_CONTRACT");
var LEARN_TOKEN_CONTRACT = readEnv("PUBLIC_LEARN_TOKEN_CONTRACT");
var toArray = function (value) {
    return Array.isArray(value) ? value : [];
};
var toNumberArray = function (value) {
    return toArray(value)
        .map(function (v) { return Number(v); })
        .filter(function (v) { return Number.isFinite(v); });
};
var asMethod = function (obj, name) {
    if (!obj || typeof obj !== "object")
        return null;
    var fn = obj[name];
    return typeof fn === "function"
        ? fn
        : null;
};
var resolveResultValue = function (result) {
    if (result && typeof result === "object") {
        var maybe = result;
        if ("result" in maybe && maybe.result && typeof maybe.result === "object") {
            return maybe.result;
        }
    }
    return result;
};
var sendTxIfNeeded = function (maybeTx, signTransaction) { return __awaiter(void 0, void 0, void 0, function () {
    var txObj;
    return __generator(this, function (_a) {
        txObj = maybeTx;
        if (txObj &&
            typeof txObj === "object" &&
            typeof txObj.signAndSend === "function") {
            return [2 /*return*/, txObj.signAndSend({
                    signTransaction: signTransaction,
                })];
        }
        return [2 /*return*/, maybeTx];
    });
}); };
var loadCourseClient = function () { return __awaiter(void 0, void 0, void 0, function () {
    var path, mod, _a;
    var _b;
    return __generator(this, function (_c) {
        switch (_c.label) {
            case 0:
                _c.trys.push([0, 2, , 3]);
                path = "../contracts/course_milestone";
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
}); };
var callFirst = function (client, methodNames, args) { return __awaiter(void 0, void 0, void 0, function () {
    var _i, methodNames_1, name_1, fn, _a;
    return __generator(this, function (_b) {
        switch (_b.label) {
            case 0:
                _i = 0, methodNames_1 = methodNames;
                _b.label = 1;
            case 1:
                if (!(_i < methodNames_1.length)) return [3 /*break*/, 6];
                name_1 = methodNames_1[_i];
                fn = asMethod(client, name_1);
                if (!fn)
                    return [3 /*break*/, 5];
                _b.label = 2;
            case 2:
                _b.trys.push([2, 4, , 5]);
                return [4 /*yield*/, Promise.resolve(fn.apply(void 0, args))];
            case 3: return [2 /*return*/, _b.sent()];
            case 4:
                _a = _b.sent();
                return [3 /*break*/, 5];
            case 5:
                _i++;
                return [3 /*break*/, 1];
            case 6: throw new Error("No compatible method found: ".concat(methodNames.join(", ")));
        }
    });
}); };
var waitForMintEvent = function (walletAddress_1) {
    var args_1 = [];
    for (var _i = 1; _i < arguments.length; _i++) {
        args_1[_i - 1] = arguments[_i];
    }
    return __awaiter(void 0, __spreadArray([walletAddress_1], args_1, true), void 0, function (walletAddress, timeoutMs) {
        var deadline, lastEarned, response, payload, events, _a, events_1, evt, raw, num, _b;
        var _c, _d, _e;
        if (timeoutMs === void 0) { timeoutMs = 15000; }
        return __generator(this, function (_f) {
            switch (_f.label) {
                case 0:
                    if (!LEARN_TOKEN_CONTRACT)
                        return [2 /*return*/, null];
                    deadline = Date.now() + timeoutMs;
                    lastEarned = null;
                    _f.label = 1;
                case 1:
                    if (!(Date.now() < deadline)) return [3 /*break*/, 9];
                    _f.label = 2;
                case 2:
                    _f.trys.push([2, 6, , 7]);
                    return [4 /*yield*/, fetch(util_1.rpcUrl, {
                            method: "POST",
                            headers: { "content-type": "application/json" },
                            body: JSON.stringify({
                                jsonrpc: "2.0",
                                id: "wait-lrn-mint",
                                method: "getEvents",
                                params: {
                                    filters: [
                                        { type: "contract", contractIds: [LEARN_TOKEN_CONTRACT] },
                                    ],
                                    pagination: { limit: 20 },
                                },
                            }),
                        })];
                case 3:
                    response = _f.sent();
                    if (!response.ok) return [3 /*break*/, 5];
                    return [4 /*yield*/, response.json()];
                case 4:
                    payload = (_f.sent());
                    events = (_d = (_c = payload.result) === null || _c === void 0 ? void 0 : _c.events) !== null && _d !== void 0 ? _d : [];
                    for (_a = 0, events_1 = events; _a < events_1.length; _a++) {
                        evt = events_1[_a];
                        raw = JSON.stringify(evt).toLowerCase();
                        if (!raw.includes(walletAddress.toLowerCase()) ||
                            !raw.includes("mint")) {
                            continue;
                        }
                        num = (_e = raw
                            .match(/-?\d+(\.\d+)?/g)) === null || _e === void 0 ? void 0 : _e.map(Number).find(function (n) { return n > 0; });
                        lastEarned = num !== null && num !== void 0 ? num : null;
                        return [2 /*return*/, lastEarned];
                    }
                    _f.label = 5;
                case 5: return [3 /*break*/, 7];
                case 6:
                    _b = _f.sent();
                    return [3 /*break*/, 7];
                case 7: return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 1000); })];
                case 8:
                    _f.sent();
                    return [3 /*break*/, 1];
                case 9: return [2 /*return*/, lastEarned];
            }
        });
    });
};
function useCourse() {
    var _this = this;
    var _a = (0, useWallet_1.useWallet)(), address = _a.address, signTransaction = _a.signTransaction;
    var addNotification = (0, useNotification_1.useNotification)().addNotification;
    var _b = (0, react_1.useState)([]), enrolledCourses = _b[0], setEnrolledCourses = _b[1];
    var _c = (0, react_1.useState)({}), progressMap = _c[0], setProgressMap = _c[1];
    var _d = (0, react_1.useState)(false), isCompletingMilestone = _d[0], setIsCompletingMilestone = _d[1];
    var refreshCourses = (0, react_1.useCallback)(function () { return __awaiter(_this, void 0, void 0, function () {
        var client, mockCourses, raw, value, ids, courses, entries, _a;
        var _this = this;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (!address) {
                        setEnrolledCourses([]);
                        setProgressMap({});
                        return [2 /*return*/];
                    }
                    return [4 /*yield*/, loadCourseClient()];
                case 1:
                    client = _b.sent();
                    if (!client || !COURSE_MILESTONE_CONTRACT) {
                        mockCourses = Array.from(mockEnrollments).map(function (id) { return ({ id: id }); });
                        setEnrolledCourses(mockCourses);
                        setProgressMap(function (prev) {
                            var _a;
                            var next = __assign({}, prev);
                            for (var _i = 0, mockEnrollments_1 = mockEnrollments; _i < mockEnrollments_1.length; _i++) {
                                var id = mockEnrollments_1[_i];
                                next[id] = {
                                    courseId: id,
                                    completedMilestoneIds: (_a = mockProgressStore[id]) !== null && _a !== void 0 ? _a : [],
                                };
                            }
                            return next;
                        });
                        return [2 /*return*/];
                    }
                    _b.label = 2;
                case 2:
                    _b.trys.push([2, 5, , 6]);
                    return [4 /*yield*/, callFirst(client, [
                            "get_enrolled_courses",
                            "getEnrolledCourses",
                            "courses_for",
                            "coursesFor",
                        ], [{ learner: address, user: address, wallet: address }])];
                case 3:
                    raw = _b.sent();
                    value = resolveResultValue(raw);
                    ids = toArray(value).map(function (v) { return String(v); });
                    courses = ids.map(function (id) { return ({ id: id }); });
                    setEnrolledCourses(courses);
                    return [4 /*yield*/, Promise.all(ids.map(function (id) { return __awaiter(_this, void 0, void 0, function () {
                            var _a;
                            var _this = this;
                            return __generator(this, function (_b) {
                                switch (_b.label) {
                                    case 0:
                                        _a = {
                                            id: id
                                        };
                                        return [4 /*yield*/, (function () { return __awaiter(_this, void 0, void 0, function () {
                                                var rawProgress, _a;
                                                return __generator(this, function (_b) {
                                                    switch (_b.label) {
                                                        case 0:
                                                            _b.trys.push([0, 2, , 3]);
                                                            return [4 /*yield*/, callFirst(client, [
                                                                    "get_course_progress",
                                                                    "getCourseProgress",
                                                                    "course_progress_for",
                                                                    "courseProgressFor",
                                                                ], [{ learner: address, course_id: id, courseId: id }])];
                                                        case 1:
                                                            rawProgress = _b.sent();
                                                            return [2 /*return*/, toNumberArray(resolveResultValue(rawProgress))];
                                                        case 2:
                                                            _a = _b.sent();
                                                            return [2 /*return*/, []];
                                                        case 3: return [2 /*return*/];
                                                    }
                                                });
                                            }); })()];
                                    case 1: return [2 /*return*/, (_a.progress = _b.sent(),
                                            _a)];
                                }
                            });
                        }); }))];
                case 4:
                    entries = _b.sent();
                    setProgressMap(Object.fromEntries(entries.map(function (_a) {
                        var id = _a.id, progress = _a.progress;
                        return [
                            id,
                            { courseId: id, completedMilestoneIds: progress },
                        ];
                    })));
                    return [3 /*break*/, 6];
                case 5:
                    _a = _b.sent();
                    addNotification("Unable to load enrolled courses from CourseMilestone", "warning");
                    return [3 /*break*/, 6];
                case 6: return [2 /*return*/];
            }
        });
    }); }, [address, addNotification]);
    (0, react_1.useEffect)(function () {
        void refreshCourses();
    }, [refreshCourses]);
    var getCourseProgress = (0, react_1.useCallback)(function (courseId) {
        var _a;
        return (_a = progressMap[courseId]) !== null && _a !== void 0 ? _a : { courseId: courseId, completedMilestoneIds: [] };
    }, [progressMap]);
    var enroll = (0, react_1.useCallback)(function (courseId) { return __awaiter(_this, void 0, void 0, function () {
        var client, rawTx, _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (!address) {
                        addNotification("Connect wallet before enrolling", "warning");
                        return [2 /*return*/];
                    }
                    return [4 /*yield*/, loadCourseClient()];
                case 1:
                    client = _b.sent();
                    if (!client || !COURSE_MILESTONE_CONTRACT) {
                        mockEnrollments.add(courseId);
                        setEnrolledCourses(function (prev) {
                            return prev.find(function (c) { return c.id === courseId; })
                                ? prev
                                : __spreadArray(__spreadArray([], prev, true), [{ id: courseId }], false);
                        });
                        addNotification("Enrolled (local fallback mode)", "success");
                        return [2 /*return*/];
                    }
                    _b.label = 2;
                case 2:
                    _b.trys.push([2, 6, , 7]);
                    return [4 /*yield*/, callFirst(client, ["enroll", "enroll_course", "enrollCourse"], [
                            { course_id: courseId, courseId: courseId, learner: address },
                            { publicKey: address },
                        ])];
                case 3:
                    rawTx = _b.sent();
                    return [4 /*yield*/, sendTxIfNeeded(rawTx, signTransaction)];
                case 4:
                    _b.sent();
                    addNotification("Enrollment successful", "success");
                    return [4 /*yield*/, refreshCourses()];
                case 5:
                    _b.sent();
                    return [3 /*break*/, 7];
                case 6:
                    _a = _b.sent();
                    addNotification("Enrollment failed", "error");
                    return [3 /*break*/, 7];
                case 7: return [2 /*return*/];
            }
        });
    }); }, [address, addNotification, refreshCourses, signTransaction]);
    var completeMilestone = (0, react_1.useCallback)(function (courseId, milestoneId) { return __awaiter(_this, void 0, void 0, function () {
        var already, client, updatedProgress_1, rawTx, earned, _a;
        var _b;
        return __generator(this, function (_c) {
            switch (_c.label) {
                case 0:
                    if (!address) {
                        addNotification("Connect wallet before completing milestones", "warning");
                        return [2 /*return*/];
                    }
                    already = getCourseProgress(courseId).completedMilestoneIds.includes(milestoneId);
                    if (already) {
                        addNotification("Milestone already completed", "secondary");
                        return [2 /*return*/];
                    }
                    setIsCompletingMilestone(true);
                    _c.label = 1;
                case 1:
                    _c.trys.push([1, 7, 8, 9]);
                    return [4 /*yield*/, loadCourseClient()];
                case 2:
                    client = _c.sent();
                    if (!client || !COURSE_MILESTONE_CONTRACT) {
                        mockEnrollments.add(courseId);
                        updatedProgress_1 = __spreadArray(__spreadArray([], ((_b = mockProgressStore[courseId]) !== null && _b !== void 0 ? _b : []), true), [
                            milestoneId,
                        ], false);
                        mockProgressStore[courseId] = updatedProgress_1;
                        setProgressMap(function (prev) {
                            var _a;
                            return (__assign(__assign({}, prev), (_a = {}, _a[courseId] = {
                                courseId: courseId,
                                completedMilestoneIds: updatedProgress_1,
                            }, _a)));
                        });
                        addNotification("Milestone completed (local fallback mode)", "success");
                        return [2 /*return*/];
                    }
                    return [4 /*yield*/, callFirst(client, [
                            "complete_milestone",
                            "completeMilestone",
                            "complete_course_milestone",
                            "completeCourseMilestone",
                        ], [
                            {
                                course_id: courseId,
                                courseId: courseId,
                                milestone_id: BigInt(milestoneId),
                                milestoneId: BigInt(milestoneId),
                                learner: address,
                            },
                            { publicKey: address },
                        ])];
                case 3:
                    rawTx = _c.sent();
                    return [4 /*yield*/, sendTxIfNeeded(rawTx, signTransaction)];
                case 4:
                    _c.sent();
                    return [4 /*yield*/, waitForMintEvent(address)];
                case 5:
                    earned = _c.sent();
                    addNotification(earned != null
                        ? "Milestone complete. Earned ".concat(earned, " LRN")
                        : "Milestone complete. LRN mint event confirmed", "success");
                    return [4 /*yield*/, refreshCourses()];
                case 6:
                    _c.sent();
                    return [3 /*break*/, 9];
                case 7:
                    _a = _c.sent();
                    addNotification("Failed to complete milestone", "error");
                    return [3 /*break*/, 9];
                case 8:
                    setIsCompletingMilestone(false);
                    return [7 /*endfinally*/];
                case 9: return [2 /*return*/];
            }
        });
    }); }, [
        address,
        addNotification,
        getCourseProgress,
        refreshCourses,
        signTransaction,
    ]);
    return (0, react_1.useMemo)(function () { return ({
        enrolledCourses: enrolledCourses,
        getCourseProgress: getCourseProgress,
        enroll: enroll,
        completeMilestone: completeMilestone,
        isCompletingMilestone: isCompletingMilestone,
    }); }, [
        enrolledCourses,
        getCourseProgress,
        enroll,
        completeMilestone,
        isCompletingMilestone,
    ]);
}
