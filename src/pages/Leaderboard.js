"use strict";
/**
 * pages/Leaderboard.tsx
 *
 * Issue #44 — Add skeleton loading screens and empty state components
 * bakeronchain/learnvault
 *
 * Added: LeaderboardRowSkeleton for loading state
 */
Object.defineProperty(exports, "__esModule", { value: true });
var react_1 = require("react");
var react_i18next_1 = require("react-i18next");
var SkeletonLoader_1 = require("../components/SkeletonLoader");
var Leaderboard = function () {
    var t = (0, react_i18next_1.useTranslation)().t;
    var _a = (0, react_1.useState)(true), isLoading = _a[0], setIsLoading = _a[1];
    // Issue #44 — Simulate async data fetch for skeleton demo
    (0, react_1.useEffect)(function () {
        var timer = setTimeout(function () { return setIsLoading(false); }, 2000);
        return function () { return clearTimeout(timer); };
    }, []);
    return (<div className="p-12 max-w-5xl mx-auto text-white animate-in fade-in slide-in-from-bottom-8 duration-1000">
			<header className="mb-16 text-center">
				<h1 className="text-6xl font-black mb-4 tracking-tighter text-gradient">
					{t("pages.leaderboard.title")}
				</h1>
				<p className="text-white/40 text-lg font-medium">
					{t("pages.leaderboard.desc")}
				</p>
			</header>

			{isLoading ? (
        // Issue #44 — Leaderboard row skeleton
        <SkeletonLoader_1.LeaderboardRowSkeleton />) : (<div className="glass-card p-20 rounded-[4rem] text-center border border-white/5">
					<div className="text-6xl mb-8">🏆</div>
					<h2 className="text-3xl font-black mb-4">Rankings Initializing</h2>
					<p className="text-white/40 max-w-md mx-auto mb-10 leading-relaxed font-medium">
						The global scholar rankings are currently being synchronized with
						on-chain reputation data. Check back soon to see your standing.
					</p>
					<div className="grid grid-cols-3 gap-4 max-w-xs mx-auto">
						<div className="h-2 bg-white/5 rounded-full overflow-hidden">
							<div className="h-full bg-brand-cyan animate-pulse" style={{ width: "40%" }}/>
						</div>
						<div className="h-2 bg-white/5 rounded-full overflow-hidden">
							<div className="h-full bg-brand-blue animate-pulse delay-75" style={{ width: "70%" }}/>
						</div>
						<div className="h-2 bg-white/5 rounded-full overflow-hidden">
							<div className="h-full bg-brand-purple animate-pulse delay-150" style={{ width: "25%" }}/>
						</div>
					</div>
				</div>)}
		</div>);
};
exports.default = Leaderboard;
