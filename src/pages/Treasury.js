"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var react_1 = require("react");
var recharts_1 = require("recharts");
var Treasury = function () {
    // Mock data for the treasury health chart
    var data = [
        { name: "Mon", inflows: 4000, outflows: 2400 },
        { name: "Tue", inflows: 3000, outflows: 1398 },
        { name: "Wed", inflows: 2000, outflows: 9800 },
        { name: "Thu", inflows: 2780, outflows: 3908 },
        { name: "Fri", inflows: 1890, outflows: 4800 },
        { name: "Sat", inflows: 2390, outflows: 3800 },
        { name: "Sun", inflows: 3490, outflows: 4300 },
    ];
    var stats = {
        totalTreasury: "125,400 USDC",
        totalDisbursed: "45,200 USDC",
        scholarsFunded: "128",
        donorsCount: "842",
    };
    return (<div className="p-12 max-w-7xl mx-auto min-h-screen text-white animate-in fade-in duration-1000">
			<header className="text-center mb-20 relative">
				<div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 bg-brand-cyan/20 blur-[100px] rounded-full -z-10"/>
				<h1 className="text-7xl font-black mb-4 tracking-tighter text-gradient">
					Treasury Dashboard
				</h1>
				<p className="text-white/40 text-lg max-w-2xl mx-auto font-medium">
					Real-time transparency into the LearnVault decentralized scholarship
					fund.
				</p>
			</header>

			<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 mb-20">
				<StatCard label="Total in Treasury" value={stats.totalTreasury} icon="💰" color="text-brand-cyan"/>
				<StatCard label="Total Disbursed" value={stats.totalDisbursed} icon="💸" color="text-brand-purple"/>
				<StatCard label="Scholars Funded" value={stats.scholarsFunded} icon="🎓" color="text-brand-emerald"/>
				<StatCard label="Global Donors" value={stats.donorsCount} icon="🌍" color="text-brand-blue"/>
			</div>

			<div className="mb-20">
				<div className="glass-card p-10 rounded-[3rem] relative overflow-hidden">
					<div className="flex justify-between items-end mb-12">
						<div>
							<h3 className="text-3xl font-black mb-2">Treasury Health</h3>
							<p className="text-white/40 text-sm">
								Comparison of community inflows vs scholarship outflows.
							</p>
						</div>
						<div className="flex gap-6">
							<LegendItem color="#00d2ff" label="Inflows"/>
							<LegendItem color="#8e2de2" label="Outflows"/>
						</div>
					</div>
					<div className="w-full h-[400px]">
						<recharts_1.ResponsiveContainer>
							<recharts_1.AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 10 }}>
								<defs>
									<linearGradient id="colorIn" x1="0" y1="0" x2="0" y2="1">
										<stop offset="5%" stopColor="#00d2ff" stopOpacity={0.3}/>
										<stop offset="95%" stopColor="#00d2ff" stopOpacity={0}/>
									</linearGradient>
									<linearGradient id="colorOut" x1="0" y1="0" x2="0" y2="1">
										<stop offset="5%" stopColor="#8e2de2" stopOpacity={0.3}/>
										<stop offset="95%" stopColor="#8e2de2" stopOpacity={0}/>
									</linearGradient>
								</defs>
								<recharts_1.CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false}/>
								<recharts_1.XAxis dataKey="name" stroke="rgba(255,255,255,0.2)" fontSize={12} tickLine={false} axisLine={false}/>
								<recharts_1.YAxis stroke="rgba(255,255,255,0.2)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={function (val) { return "$".concat(val / 1000, "k"); }}/>
								<recharts_1.Tooltip contentStyle={{
            backgroundColor: "rgba(5, 7, 10, 0.9)",
            borderRadius: "16px",
            border: "1px solid rgba(255,255,255,0.1)",
            backdropFilter: "blur(10px)",
            boxShadow: "0 10px 30px rgba(0,0,0,0.5)",
        }} itemStyle={{
            color: "#fff",
            fontSize: "12px",
            fontWeight: "bold",
        }}/>
								<recharts_1.Area type="monotone" dataKey="inflows" stroke="#00d2ff" strokeWidth={3} fillOpacity={1} fill="url(#colorIn)"/>
								<recharts_1.Area type="monotone" dataKey="outflows" stroke="#8e2de2" strokeWidth={3} fillOpacity={1} fill="url(#colorOut)"/>
							</recharts_1.AreaChart>
						</recharts_1.ResponsiveContainer>
					</div>
				</div>
			</div>

			<div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
				<ActivityFeed title="Recent Community Deposits" items={[
            {
                user: "G...A1B2",
                amount: "+500 USDC",
                time: "2h ago",
                type: "deposit",
            },
            {
                user: "G...C3D4",
                amount: "+1,200 USDC",
                time: "5h ago",
                type: "deposit",
            },
        ]}/>
				<ActivityFeed title="Latest Disbursements" items={[
            {
                user: "Scholar...FFF",
                amount: "-150 USDC",
                time: "1h ago",
                type: "disburse",
            },
            {
                user: "Scholar...GGG",
                amount: "-150 USDC",
                time: "3h ago",
                type: "disburse",
            },
        ]}/>
			</div>

			<div className="mt-20 text-center">
				<button className="iridescent-border px-12 py-5 rounded-2xl font-black text-lg uppercase tracking-widest hover:scale-105 active:scale-95 transition-all group overflow-hidden shadow-2xl shadow-brand-cyan/20">
					<span className="relative z-10">Donate to Treasury</span>
				</button>
			</div>
		</div>);
};
var StatCard = function (_a) {
    var label = _a.label, value = _a.value, icon = _a.icon, color = _a.color;
    return (<div className="glass-card p-8 rounded-[2rem] hover:border-white/20 transition-all hover:-translate-y-2 group">
		<div className="text-3xl mb-4 group-hover:scale-125 transition-transform duration-500">
			{icon}
		</div>
		<p className="text-[10px] uppercase font-black text-white/30 tracking-[2px] mb-1">
			{label}
		</p>
		<p className={"text-2xl font-black ".concat(color, " tracking-tight")}>{value}</p>
	</div>);
};
var LegendItem = function (_a) {
    var color = _a.color, label = _a.label;
    return (<div className="flex items-center gap-2">
		<div className="w-3 h-3 rounded-full shadow-[0_0_10px_rgba(0,0,0,0.5)]" style={{ backgroundColor: color }}/>
		<span className="text-xs font-bold text-white/60">{label}</span>
	</div>);
};
var ActivityFeed = function (_a) {
    var title = _a.title, items = _a.items;
    return (<div className="glass p-8 rounded-[2.5rem] border border-white/5">
		<h3 className="text-xl font-black mb-8 border-l-4 border-brand-cyan pl-4">
			{title}
		</h3>
		<div className="flex flex-col gap-4">
			{items.map(function (item, i) { return (<div key={i} className="flex items-center justify-between p-5 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/[0.08] transition-colors group">
					<div className="flex items-center gap-4">
						<div className={"w-2 h-2 rounded-full ".concat(item.type === "deposit" ? "bg-brand-emerald animate-pulse" : "bg-brand-purple")}/>
						<div>
							<p className="font-bold text-sm">{item.user}</p>
							<p className="text-[10px] text-white/30 uppercase font-black tracking-widest">
								{item.time}
							</p>
						</div>
					</div>
					<p className={"font-black ".concat(item.type === "deposit" ? "text-brand-emerald" : "text-white/80")}>
						{item.amount}
					</p>
				</div>); })}
		</div>
	</div>);
};
exports.default = Treasury;
