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
exports.MilestoneTracker = MilestoneTracker;
var react_1 = require("react");
var react_i18next_1 = require("react-i18next");
var useCourse_1 = require("../hooks/useCourse");
var MilestoneTracker_module_css_1 = require("./MilestoneTracker.module.css");
function MilestoneStep(_a) {
    var _this = this;
    var courseId = _a.courseId, milestone = _a.milestone;
    var _b = (0, useCourse_1.useCourse)(), getCourseProgress = _b.getCourseProgress, completeMilestone = _b.completeMilestone, isCompletingMilestone = _b.isCompletingMilestone;
    var progress = getCourseProgress(courseId);
    var isCompleted = progress.completedMilestoneIds.includes(milestone.id);
    var hasPrevious = milestone.id <= 1 ||
        progress.completedMilestoneIds.includes(milestone.id - 1);
    var status = isCompleted
        ? "completed"
        : hasPrevious
            ? "in_progress"
            : "locked";
    var txHash = undefined;
    var _c = (0, react_i18next_1.useTranslation)(), t = _c.t, i18n = _c.i18n;
    var _d = (0, react_1.useState)(false), isCompleting = _d[0], setIsCompleting = _d[1];
    var handleComplete = function () { return __awaiter(_this, void 0, void 0, function () {
        var err_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    if (status !== "in_progress")
                        return [2 /*return*/];
                    setIsCompleting(true);
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, 4, 5]);
                    // Optimistically UI changes within useCourse
                    // wait for completion
                    return [4 /*yield*/, completeMilestone(courseId, milestone.id)];
                case 2:
                    // Optimistically UI changes within useCourse
                    // wait for completion
                    _a.sent();
                    return [3 /*break*/, 5];
                case 3:
                    err_1 = _a.sent();
                    console.error("Failed to complete milestone:", err_1);
                    return [3 /*break*/, 5];
                case 4:
                    setIsCompleting(false);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    var getIcon = function () {
        switch (status) {
            case "completed":
                return <span className={MilestoneTracker_module_css_1.default.animCheck}>✅</span>;
            case "in_progress":
                return <span>⏳</span>;
            case "locked":
                return <span>🔒</span>;
            default:
                return <span>🔒</span>;
        }
    };
    return (<div className={"".concat(MilestoneTracker_module_css_1.default.step, " ").concat(MilestoneTracker_module_css_1.default[status])}>
			<div className={MilestoneTracker_module_css_1.default.iconContainer}>{getIcon()}</div>
			<div className={MilestoneTracker_module_css_1.default.content}>
				<div className={MilestoneTracker_module_css_1.default.header}>
					<h3 className={MilestoneTracker_module_css_1.default.title}>{milestone.label}</h3>
					<div className={MilestoneTracker_module_css_1.default.badge}>
						{t("home.milestones.lrnReward", {
            amount: new Intl.NumberFormat(i18n.language).format(milestone.lrnReward),
        })}
					</div>
				</div>

				{status === "locked" && (<p style={{ fontSize: "0.9rem", color: "#9ca3af", margin: 0 }}>
						{t("home.milestones.locked")}
					</p>)}

				{status === "in_progress" && (<div>
						<p style={{ fontSize: "0.9rem", color: "#d1d5db", margin: 0 }}>
							{t("home.milestones.inProgress")}
						</p>
						<button className={MilestoneTracker_module_css_1.default.actionBtn} onClick={handleComplete} disabled={isCompleting || isCompletingMilestone}>
							{isCompleting || isCompletingMilestone
                ? t("home.milestones.submittingText")
                : t("home.milestones.markComplete")}
						</button>
					</div>)}

				{status === "completed" && (<div>
						<p style={{
                fontSize: "0.9rem",
                color: "#10b981",
                margin: 0,
                fontWeight: 600,
            }}>
							{t("home.milestones.completedText")}
						</p>
						{txHash && (<a href={"https://stellar.expert/explorer/testnet/tx/".concat(txHash)} target="_blank" rel="noopener noreferrer" className={MilestoneTracker_module_css_1.default.txLink}>
								{t("home.milestones.tx")}: {txHash} ↗
							</a>)}
					</div>)}
			</div>
		</div>);
}
function MilestoneTracker(_a) {
    var courseId = _a.courseId, milestones = _a.milestones;
    return (<div className={MilestoneTracker_module_css_1.default.container}>
			{milestones.map(function (milestone) { return (<MilestoneStep key={milestone.id} courseId={courseId} milestone={milestone}/>); })}
		</div>);
}
