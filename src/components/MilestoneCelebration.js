"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var canvas_confetti_1 = require("canvas-confetti");
var framer_motion_1 = require("framer-motion");
var react_1 = require("react");
var MilestoneCelebration = function (_a) {
    var isOpen = _a.isOpen, onClose = _a.onClose, rewardAmount = _a.rewardAmount, newBalance = _a.newBalance, lessonName = _a.lessonName, isFinalMilestone = _a.isFinalMilestone;
    var _b = (0, react_1.useState)(newBalance - rewardAmount), count = _b[0], setCount = _b[1];
    (0, react_1.useEffect)(function () {
        if (isOpen) {
            // 1. Fire Confetti
            void (0, canvas_confetti_1.default)({
                particleCount: 150,
                spread: 70,
                origin: { y: 0.6 },
                disableForReducedMotion: true, // Accessibility requirement
            });
            // 2. Animate Balance Count-up
            var timer_1 = setTimeout(function () {
                setCount(newBalance);
            }, 500);
            return function () { return clearTimeout(timer_1); };
        }
    }, [isOpen, newBalance]);
    var twitterShareUrl = "https://twitter.com/intent/tweet?text=".concat(encodeURIComponent("Just earned ".concat(rewardAmount, " LRN completing ").concat(lessonName, " on @LearnVaultDAO! \uD83C\uDF93")));
    return (<framer_motion_1.AnimatePresence>
			{isOpen && (<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
					<framer_motion_1.motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.8, opacity: 0 }} className="bg-white p-8 rounded-2xl shadow-2xl text-center max-w-md w-full relative">
						<h2 className="text-3xl font-bold text-slate-900 mb-2">
							{isFinalMilestone
                ? "🏆 Track Complete!"
                : "🎉 Milestone Complete!"}
						</h2>
						<p className="text-slate-600 mb-6">
							You earned{" "}
							<span className="font-bold text-green-600">
								+{rewardAmount} LRN
							</span>
						</p>

						<div className="bg-slate-50 rounded-lg p-4 mb-6">
							<p className="text-xs uppercase tracking-widest text-slate-400 mb-1">
								Total Reputation
							</p>
							<p className="text-4xl font-mono font-bold text-slate-800">
								{count} LRN
							</p>
						</div>

						<div className="flex flex-col gap-3">
							<a href={twitterShareUrl} target="_blank" rel="noreferrer" className="bg-[#1DA1F2] text-white py-3 rounded-xl font-semibold hover:bg-[#1a8cd8] transition">
								Share on Twitter
							</a>
							<button onClick={onClose} className="text-slate-500 hover:text-slate-800 transition py-2">
								Continue Learning
							</button>
						</div>
					</framer_motion_1.motion.div>
				</div>)}
		</framer_motion_1.AnimatePresence>);
};
exports.default = MilestoneCelebration;
