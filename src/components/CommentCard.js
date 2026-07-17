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
var date_fns_1 = require("date-fns");
var react_1 = require("react");
var react_markdown_1 = require("react-markdown");
var shortenAddress = function (address) {
    if (!address)
        return "";
    return "".concat(address.slice(0, 6), "...").concat(address.slice(-4));
};
var CommentCard = function (_a) {
    var comment = _a.comment, isAuthor = _a.isAuthor, isReply = _a.isReply, canPin = _a.canPin, onUpdate = _a.onUpdate;
    var _b = (0, react_1.useState)(false), isReplying = _b[0], setIsReplying = _b[1];
    var _c = (0, react_1.useState)(""), replyText = _c[0], setReplyText = _c[1];
    var handleVote = function (type) { return __awaiter(void 0, void 0, void 0, function () {
        var token, res, err_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    token = localStorage.getItem("auth_token") || "mock-token";
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, fetch("".concat(import.meta.env.VITE_SERVER_URL, "/api/comments/").concat(comment.id, "/vote"), {
                            method: "PUT",
                            headers: {
                                "Content-Type": "application/json",
                                Authorization: "Bearer ".concat(token),
                            },
                            body: JSON.stringify({ type: type }),
                        })];
                case 2:
                    res = _a.sent();
                    if (res.ok)
                        onUpdate === null || onUpdate === void 0 ? void 0 : onUpdate();
                    return [3 /*break*/, 4];
                case 3:
                    err_1 = _a.sent();
                    console.error("Vote failed", err_1);
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    }); };
    var handlePin = function () { return __awaiter(void 0, void 0, void 0, function () {
        var token, res, err_2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    token = localStorage.getItem("auth_token") || "mock-token";
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, fetch("".concat(import.meta.env.VITE_SERVER_URL, "/api/comments/").concat(comment.id, "/pin"), {
                            method: "PUT",
                            headers: {
                                Authorization: "Bearer ".concat(token),
                            },
                        })];
                case 2:
                    res = _a.sent();
                    if (res.ok)
                        onUpdate === null || onUpdate === void 0 ? void 0 : onUpdate();
                    return [3 /*break*/, 4];
                case 3:
                    err_2 = _a.sent();
                    console.error("Pin failed", err_2);
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    }); };
    var handlePostReply = function () { return __awaiter(void 0, void 0, void 0, function () {
        var token, res, err_3;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (!replyText.trim())
                        return [2 /*return*/];
                    token = localStorage.getItem("auth_token") || "mock-token";
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, fetch("".concat(import.meta.env.VITE_SERVER_URL, "/api/comments"), {
                            method: "POST",
                            headers: {
                                "Content-Type": "application/json",
                                Authorization: "Bearer ".concat(token),
                            },
                            body: JSON.stringify({
                                proposalId: comment.proposal_id,
                                content: replyText,
                                parentId: comment.id,
                            }),
                        })];
                case 2:
                    res = _a.sent();
                    if (res.ok) {
                        setReplyText("");
                        setIsReplying(false);
                        onUpdate === null || onUpdate === void 0 ? void 0 : onUpdate();
                    }
                    return [3 /*break*/, 4];
                case 3:
                    err_3 = _a.sent();
                    console.error("Reply failed", err_3);
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    }); };
    return (<div className={"glass-card p-6 rounded-3xl border border-white/5 relative ".concat(comment.is_pinned ? "border-brand-cyan/30 bg-brand-cyan/5" : "")}>
			{comment.is_pinned && (<div className="absolute -top-3 left-6 px-3 py-1 bg-brand-cyan text-black text-[10px] font-black uppercase tracking-widest rounded-full flex items-center gap-1 shadow-xl">
					Pinned by Author
				</div>)}

			<header className="flex justify-between items-start mb-6">
				<div className="flex items-center gap-4">
					<div className="w-10 h-10 bg-white/5 rounded-full flex items-center justify-center text-xs font-black text-white/40 border border-white/10 group-hover:border-brand-cyan/30 transition-colors">
						{comment.author_address.slice(0, 2)}
					</div>
					<div>
						<div className="flex items-center gap-2">
							<span className="text-sm font-black text-white group-hover:text-brand-cyan transition-colors">
								{shortenAddress(comment.author_address)}
							</span>
							{isAuthor && (<span className="px-2 py-0.5 bg-brand-purple/20 text-brand-purple text-[8px] font-black uppercase tracking-widest rounded-sm border border-brand-purple/20">
									Author
								</span>)}
						</div>
						<p className="text-[10px] text-white/20 uppercase font-bold tracking-widest mt-1">
							{(0, date_fns_1.formatDistanceToNow)(new Date(comment.created_at))} ago
						</p>
					</div>
				</div>

				<div className="flex gap-2">
					{canPin && !comment.is_pinned && (<button onClick={function () { return void handlePin(); }} className="text-[10px] font-black uppercase text-white/30 hover:text-brand-cyan transition-colors">
							Pin
						</button>)}
					{!isReply && (<button onClick={function () { return setIsReplying(!isReplying); }} className="text-[10px] font-black uppercase text-white/30 hover:text-brand-cyan transition-colors">
							Reply
						</button>)}
				</div>
			</header>

			<div className="prose prose-invert prose-sm max-w-none text-white/60 leading-relaxed font-medium mb-8">
				<react_markdown_1.default>{comment.content}</react_markdown_1.default>
			</div>

			<footer className="flex items-center gap-6">
				<div className="flex items-center bg-white/5 rounded-full p-1 border border-white/5">
					<button onClick={function () { return void handleVote("upvote"); }} className="w-8 h-8 flex items-center justify-center transition-all hover:scale-110 active:scale-95" title="Upvote">
						👍
					</button>
					<span className="text-xs font-black text-white px-2 leading-none">
						{comment.upvotes - comment.downvotes}
					</span>
					<button onClick={function () { return void handleVote("downvote"); }} className="w-8 h-8 flex items-center justify-center transition-all hover:scale-110 active:scale-95" title="Downvote">
						👎
					</button>
				</div>
			</footer>

			{isReplying && (<div className="mt-8 pt-8 border-t border-white/5 animate-in slide-in-from-top-4 duration-500">
					<textarea value={replyText} onChange={function (e) { return setReplyText(e.target.value); }} placeholder="Write your reply..." className="w-full h-24 bg-black/40 border border-white/10 rounded-2xl p-4 text-xs text-white focus:outline-none focus:border-brand-cyan/40"/>
					<div className="flex justify-end gap-3 mt-4">
						<button onClick={function () { return setIsReplying(false); }} className="px-5 py-2 text-[10px] font-black uppercase text-white/30 border border-white/10 rounded-full hover:bg-white/5 transition-colors">
							Cancel
						</button>
						<button onClick={function () { return void handlePostReply(); }} disabled={!replyText.trim()} className="px-5 py-2 bg-brand-cyan text-black text-[10px] font-black uppercase tracking-widest rounded-full hover:scale-105 transition-all disabled:opacity-50">
							Submit Reply
						</button>
					</div>
				</div>)}
		</div>);
};
exports.default = CommentCard;
