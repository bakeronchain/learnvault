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
var react_1 = require("react");
var react_i18next_1 = require("react-i18next");
var CommentCard_1 = require("./CommentCard");
var CommentSection = function (_a) {
    var proposalId = _a.proposalId, proposalAuthor = _a.proposalAuthor;
    var t = (0, react_i18next_1.useTranslation)().t;
    var _b = (0, react_1.useState)([]), comments = _b[0], setComments = _b[1];
    var _c = (0, react_1.useState)(""), newComment = _c[0], setNewComment = _c[1];
    var _d = (0, react_1.useState)("new"), sortBy = _d[0], setSortBy = _d[1];
    var _e = (0, react_1.useState)(true), loading = _e[0], setLoading = _e[1];
    var fetchComments = function () { return __awaiter(void 0, void 0, void 0, function () {
        var res, data, err_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    setLoading(true);
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 4, 5, 6]);
                    return [4 /*yield*/, fetch("".concat(import.meta.env.VITE_SERVER_URL, "/api/proposals/").concat(proposalId, "/comments"))];
                case 2:
                    res = _a.sent();
                    return [4 /*yield*/, res.json()];
                case 3:
                    data = _a.sent();
                    setComments(data);
                    return [3 /*break*/, 6];
                case 4:
                    err_1 = _a.sent();
                    console.error("Failed to fetch comments", err_1);
                    return [3 /*break*/, 6];
                case 5:
                    setLoading(false);
                    return [7 /*endfinally*/];
                case 6: return [2 /*return*/];
            }
        });
    }); };
    (0, react_1.useEffect)(function () {
        void fetchComments();
    }, [proposalId]);
    var handlePostComment = function () {
        var args_1 = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args_1[_i] = arguments[_i];
        }
        return __awaiter(void 0, __spreadArray([], args_1, true), void 0, function (parentId) {
            var token, res, err, err_2;
            if (parentId === void 0) { parentId = null; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!newComment.trim())
                            return [2 /*return*/];
                        token = localStorage.getItem("auth_token") || "mock-token";
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 6, , 7]);
                        return [4 /*yield*/, fetch("".concat(import.meta.env.VITE_SERVER_URL, "/api/comments"), {
                                method: "POST",
                                headers: {
                                    "Content-Type": "application/json",
                                    Authorization: "Bearer ".concat(token),
                                },
                                body: JSON.stringify({
                                    proposalId: proposalId,
                                    content: newComment,
                                    parentId: parentId,
                                }),
                            })];
                    case 2:
                        res = _a.sent();
                        if (!res.ok) return [3 /*break*/, 3];
                        setNewComment("");
                        void fetchComments();
                        return [3 /*break*/, 5];
                    case 3: return [4 /*yield*/, res.json()];
                    case 4:
                        err = _a.sent();
                        alert(err.error || "Failed to post comment");
                        _a.label = 5;
                    case 5: return [3 /*break*/, 7];
                    case 6:
                        err_2 = _a.sent();
                        console.error("Error posting comment", err_2);
                        return [3 /*break*/, 7];
                    case 7: return [2 /*return*/];
                }
            });
        });
    };
    var sortedComments = __spreadArray([], comments, true).sort(function (a, b) {
        if (a.is_pinned && !b.is_pinned)
            return -1;
        if (!a.is_pinned && b.is_pinned)
            return 1;
        if (sortBy === "top")
            return b.upvotes - b.downvotes - (a.upvotes - a.downvotes);
        if (sortBy === "oldest")
            return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    var rootComments = sortedComments.filter(function (c) { return !c.parent_id; });
    var getReplies = function (parentId) {
        return sortedComments.filter(function (c) { return c.parent_id === parentId; });
    };
    return (<div className="mt-16 border-t border-white/5 pt-16">
			<div className="flex items-center justify-between mb-8">
				<h3 className="text-2xl font-black tracking-tight">
					{t("comments.title", "Discussion")}
				</h3>
				<div className="flex gap-4">
					{["top", "new", "oldest"].map(function (sort) { return (<button key={sort} onClick={function () { return setSortBy(sort); }} className={"text-xs font-black uppercase tracking-widest px-4 py-2 rounded-full transition-all ".concat(sortBy === sort
                ? "bg-brand-cyan text-black"
                : "bg-white/5 text-white/40 hover:bg-white/10")}>
							{sort}
						</button>); })}
				</div>
			</div>

			<div className="mb-12">
				<textarea value={newComment} onChange={function (e) { return setNewComment(e.target.value); }} placeholder={t("comments.placeholder", "Share your thoughts... (Markdown supported)")} className="w-full h-32 bg-[#0a0c10] border border-white/10 rounded-[2rem] p-6 text-white placeholder-white/20 focus:outline-none focus:border-brand-cyan/50 transition-colors"/>
				<div className="flex justify-end mt-4">
					<button onClick={function () { return handlePostComment(); }} disabled={!newComment.trim()} className="px-8 py-3 bg-brand-cyan text-black font-black uppercase tracking-widest rounded-full hover:scale-105 transition-all disabled:opacity-50 disabled:scale-100">
						Post Comment
					</button>
				</div>
			</div>

			{loading ? (<div className="text-center py-20 text-white/20 uppercase font-black tracking-widest animate-pulse">
					Loading Discussion...
				</div>) : (<div className="space-y-8">
					{rootComments.map(function (comment) { return (<div key={comment.id}>
							<CommentCard_1.default comment={comment} isAuthor={comment.author_address === proposalAuthor} canPin={proposalAuthor === "CURRENT_USER_ADDRESS"} // Logic for pinning
             onUpdate={fetchComments}/>
							<div className="ml-12 mt-6 space-y-6 border-l border-white/5 pl-8">
								{getReplies(comment.id).map(function (reply) { return (<CommentCard_1.default key={reply.id} comment={reply} isReply onUpdate={fetchComments}/>); })}
							</div>
						</div>); })}
				</div>)}
		</div>);
};
exports.default = CommentSection;
