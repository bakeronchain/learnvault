"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = NavBar;
var react_1 = require("react");
var react_i18next_1 = require("react-i18next");
var react_router_dom_1 = require("react-router-dom");
var WalletButton_1 = require("./WalletButton");
function NavBar() {
    var _a = (0, react_1.useState)(false), menuOpen = _a[0], setMenuOpen = _a[1];
    var t = (0, react_i18next_1.useTranslation)().t;
    var navLinks = [
        { to: "/courses", label: t("nav.learn") },
        { to: "/dao", label: t("nav.dao") },
        { to: "/treasury", label: t("nav.treasury") },
        { to: "/leaderboard", label: t("nav.leaderboard") },
    ];
    return (<header className="fixed top-0 left-0 w-full z-50 px-6 py-4">
			<div className="max-w-7xl mx-auto glass rounded-2xl border border-white/5 py-3 px-8 flex items-center justify-between shadow-2xl backdrop-blur-xl">
				<react_router_dom_1.NavLink to="/" className="flex items-center gap-3 group">
					<div className="w-8 h-8 bg-linear-to-br from-brand-cyan to-brand-blue rounded-lg flex items-center justify-center font-black text-[10px] shadow-lg shadow-brand-cyan/20 group-hover:scale-110 transition-transform">
						LV
					</div>
					<span className="text-xl font-black tracking-tighter text-gradient">
						LEARNVAULT
					</span>
				</react_router_dom_1.NavLink>

				<nav className={"".concat(menuOpen ? "flex" : "hidden", " md:flex absolute md:relative top-full left-0 w-full md:w-auto mt-4 md:mt-0 flex-col md:flex-row glass md:bg-transparent rounded-2xl p-6 md:p-0 gap-2 md:gap-8 border border-white/5 md:border-none shadow-2xl md:shadow-none animate-in fade-in slide-in-from-top-4 md:animate-none")}>
					{navLinks.map(function (_a) {
            var to = _a.to, label = _a.label;
            return (<react_router_dom_1.NavLink key={to} to={to} onClick={function () { return setMenuOpen(false); }} className={function (_a) {
                    var isActive = _a.isActive;
                    return "\n                                px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all\n                                ".concat(isActive
                        ? "text-brand-cyan bg-brand-cyan/5 shadow-[0_0_20px_rgba(0,210,255,0.1)]"
                        : "text-white/40 hover:text-white hover:bg-white/5", "\n                            ");
                }}>
							{label}
						</react_router_dom_1.NavLink>);
        })}
				</nav>

				<div className="flex items-center gap-4">
					<div className="hidden sm:block scale-90">
						<WalletButton_1.WalletButton />
					</div>
					<button onClick={function () { return setMenuOpen(!menuOpen); }} className="md:hidden w-10 h-10 glass flex items-center justify-center rounded-xl text-white/60 hover:text-white transition-colors border border-white/10">
						<div className="w-5 flex flex-col gap-1">
							<span className={"h-0.5 bg-current rounded-full transition-all ".concat(menuOpen ? "rotate-45 translate-y-1.5" : "")}/>
							<span className={"h-0.5 bg-current rounded-full transition-all ".concat(menuOpen ? "opacity-0" : "")}/>
							<span className={"h-0.5 bg-current rounded-full transition-all ".concat(menuOpen ? "-rotate-45 -translate-y-1.5" : "")}/>
						</div>
					</button>
				</div>
			</div>
		</header>);
}
