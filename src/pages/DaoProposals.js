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
var react_1 = require("react");
var MOCK_PROPOSALS = [
    {
        id: "1",
        title: "Frontend Scholarship",
        description: "A scholarship proposal for learners focused on frontend development, React fundamentals, and project-based open-source contribution.",
        author: "GA7B...4Y2K",
        status: "Active",
        votesFor: 320,
        votesAgainst: 80,
        endDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 2).toISOString(),
        usdcRequested: 500,
        lrnScore: 82,
        milestones: [
            {
                title: "Milestone 1",
                description: "Complete HTML, CSS, JavaScript, and responsive design basics.",
            },
            {
                title: "Milestone 2",
                description: "Build React projects and submit at least one open-source pull request.",
            },
        ],
        quorumRequired: 500,
        userVote: null,
    },
    {
        id: "2",
        title: "Blockchain Scholarship",
        description: "A scholarship proposal for blockchain learners covering wallet basics, smart contracts, and Stellar ecosystem development.",
        author: "GBSU...9R3T",
        status: "Passed",
        votesFor: 700,
        votesAgainst: 100,
        endDate: new Date(Date.now() - 1000 * 60 * 60 * 5).toISOString(),
        usdcRequested: 900,
        lrnScore: 91,
        milestones: [
            {
                title: "Milestone 1",
                description: "Learn wallets, transactions, and blockchain foundations.",
            },
            {
                title: "Milestone 2",
                description: "Build and test smart-contract-based mini projects.",
            },
        ],
        quorumRequired: 500,
        userVote: "YES",
    },
    {
        id: "3",
        title: "AI Scholarship",
        description: "A scholarship proposal focused on AI fundamentals, model usage, and beginner machine learning workflows.",
        author: "GC8X...7P1L",
        status: "Rejected",
        votesFor: 140,
        votesAgainst: 260,
        endDate: new Date(Date.now() - 1000 * 60 * 60 * 10).toISOString(),
        usdcRequested: 650,
        lrnScore: 76,
        milestones: [
            {
                title: "Milestone 1",
                description: "Complete Python and data fundamentals.",
            },
            {
                title: "Milestone 2",
                description: "Build a simple ML project and publish documentation.",
            },
        ],
        quorumRequired: 500,
        userVote: "NO",
    },
];
var governanceTokens = 128.45;
var isTokenHolder = true;
var shortenAddress = function (address) {
    if (address.includes("..."))
        return address;
    if (address.length <= 10)
        return address;
    return "".concat(address.slice(0, 6), "...").concat(address.slice(-4));
};
var getTimeRemaining = function (endDate) {
    var diff = new Date(endDate).getTime() - Date.now();
    if (diff <= 0)
        return "Ended";
    var days = Math.floor(diff / (1000 * 60 * 60 * 24));
    var hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
    var minutes = Math.floor((diff / (1000 * 60)) % 60);
    return "".concat(days, "d ").concat(hours, "h ").concat(minutes, "m");
};
var DaoProposals = function () {
    var _a = (0, react_1.useState)("Active"), filter = _a[0], setFilter = _a[1];
    var _b = (0, react_1.useState)(null), selectedProposal = _b[0], setSelectedProposal = _b[1];
    var _c = (0, react_1.useState)(false), isSubmittingVote = _c[0], setIsSubmittingVote = _c[1];
    var _d = (0, react_1.useState)(""), txMessage = _d[0], setTxMessage = _d[1];
    var filteredProposals = (0, react_1.useMemo)(function () {
        if (filter === "All")
            return MOCK_PROPOSALS;
        return MOCK_PROPOSALS.filter(function (proposal) { return proposal.status === filter; });
    }, [filter]);
    (0, react_1.useEffect)(function () {
        if (filteredProposals.length === 0) {
            setSelectedProposal(null);
            return;
        }
        var stillVisible = filteredProposals.find(function (proposal) { return proposal.id === (selectedProposal === null || selectedProposal === void 0 ? void 0 : selectedProposal.id); });
        if (!stillVisible) {
            setSelectedProposal(filteredProposals[0]);
        }
    }, [filteredProposals, selectedProposal]);
    var totalVotes = selectedProposal
        ? selectedProposal.votesFor + selectedProposal.votesAgainst
        : 0;
    var yesPercent = selectedProposal && totalVotes > 0
        ? (selectedProposal.votesFor / totalVotes) * 100
        : 0;
    var noPercent = selectedProposal && totalVotes > 0
        ? (selectedProposal.votesAgainst / totalVotes) * 100
        : 0;
    var quorumReached = selectedProposal
        ? totalVotes >= selectedProposal.quorumRequired
        : false;
    var voteDisabled = !selectedProposal ||
        !isTokenHolder ||
        selectedProposal.userVote !== null ||
        selectedProposal.status !== "Active";
    var getVoteDisabledMessage = function () {
        if (!selectedProposal)
            return "";
        if (!isTokenHolder)
            return "You must be a token holder to vote.";
        if (selectedProposal.userVote)
            return "You have already voted on this proposal.";
        if (selectedProposal.status !== "Active")
            return "Voting is closed for this proposal.";
        return "";
    };
    var handleVote = function (vote) { return __awaiter(void 0, void 0, void 0, function () {
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    if (!selectedProposal || voteDisabled)
                        return [2 /*return*/];
                    setIsSubmittingVote(true);
                    setTxMessage("Transaction submitted...");
                    _b.label = 1;
                case 1:
                    _b.trys.push([1, 3, 4, 5]);
                    return [4 /*yield*/, new Promise(function (resolve) { return setTimeout(resolve, 1500); })];
                case 2:
                    _b.sent();
                    setTxMessage("Transaction confirmed. Vote ".concat(vote, " recorded successfully."));
                    return [3 /*break*/, 5];
                case 3:
                    _a = _b.sent();
                    setTxMessage("Transaction failed. Please try again.");
                    return [3 /*break*/, 5];
                case 4:
                    setIsSubmittingVote(false);
                    return [7 /*endfinally*/];
                case 5: return [2 /*return*/];
            }
        });
    }); };
    return (<div className="p-12 max-w-5xl mx-auto text-white animate-in fade-in slide-in-from-bottom-8 duration-1000">
			<header className="mb-16 text-center">
				<h1 className="text-6xl font-black mb-4 tracking-tighter text-gradient">
					DAO Proposals
				</h1>
				<p className="text-white/40 text-lg font-medium max-w-2xl mx-auto">
					Governance token holders can review scholarship proposals and cast
					votes.
				</p>
			</header>

			<div className="flex flex-wrap gap-3 mb-8 justify-center">
				{["Active", "Passed", "Rejected", "All"].map(function (item) { return (<button key={item} onClick={function () {
                setFilter(item);
                setTxMessage("");
            }} className={"px-5 py-2.5 rounded-full border text-xs font-black uppercase tracking-widest transition-all ".concat(filter === item
                ? "bg-brand-cyan/10 border-brand-cyan/40 text-brand-cyan"
                : "bg-white/5 border-white/10 text-white/60 hover:border-brand-cyan/30 hover:text-brand-cyan")}>
							{item}
						</button>); })}
			</div>

			{selectedProposal && (<div className="glass-card p-10 rounded-[2.5rem] border border-white/5 mb-10">
					<div className="flex justify-between items-start gap-6 mb-6">
						<div>
							<h2 className="text-4xl font-black tracking-tight mb-3">
								{selectedProposal.title}
							</h2>
							<div className="flex flex-wrap items-center gap-3 text-xs font-black uppercase tracking-widest">
								<span className="text-brand-cyan">
									Applicant {shortenAddress(selectedProposal.author)}
								</span>
								<span className="w-1.5 h-1.5 bg-white/10 rounded-full"/>
								<span className="text-white/40">
									Time Remaining {getTimeRemaining(selectedProposal.endDate)}
								</span>
							</div>
						</div>

						<div className="px-5 py-2 bg-brand-cyan/10 border border-brand-cyan/30 rounded-full">
							<span className="text-brand-cyan text-xs font-black uppercase tracking-widest">
								{selectedProposal.status}
							</span>
						</div>
					</div>

					<div className="grid gap-8 md:grid-cols-2">
						<div>
							<div className="grid grid-cols-2 gap-4 mb-8">
								<div className="rounded-[1.75rem] border border-white/5 bg-white/5 p-5">
									<p className="text-[10px] text-white/30 uppercase font-black tracking-widest mb-2">
										USDC Requested
									</p>
									<h3 className="text-2xl font-black">
										{selectedProposal.usdcRequested}
									</h3>
								</div>

								<div className="rounded-[1.75rem] border border-white/5 bg-white/5 p-5">
									<p className="text-[10px] text-white/30 uppercase font-black tracking-widest mb-2">
										LRN Score
									</p>
									<h3 className="text-2xl font-black">
										{selectedProposal.lrnScore}
									</h3>
								</div>
							</div>

							<h3 className="text-xl font-black mb-3 tracking-tight">
								Program Description
							</h3>
							<p className="text-white/60 leading-relaxed mb-8">
								{selectedProposal.description}
							</p>

							<h3 className="text-xl font-black mb-3 tracking-tight">
								Milestone Breakdown
							</h3>
							<div className="space-y-4">
								{selectedProposal.milestones.map(function (milestone, index) { return (<div key={index} className="rounded-[1.5rem] border border-white/5 bg-white/5 p-5">
										<p className="font-black mb-1">{milestone.title}</p>
										<p className="text-sm text-white/60 leading-relaxed">
											{milestone.description}
										</p>
									</div>); })}
							</div>
						</div>

						<div>
							<h3 className="text-xl font-black mb-4 tracking-tight">
								Voting Overview
							</h3>

							<div className="mb-5">
								<div className="flex justify-between text-xs font-black uppercase tracking-widest mb-2">
									<span>YES {yesPercent.toFixed(1)}%</span>
									<span>NO {noPercent.toFixed(1)}%</span>
								</div>

								<div className="w-full h-3 rounded-full bg-white/5 overflow-hidden flex">
									<div className="h-full bg-brand-cyan" style={{ width: "".concat(yesPercent, "%") }}/>
									<div className="h-full bg-brand-purple" style={{ width: "".concat(noPercent, "%") }}/>
								</div>
							</div>

							<div className="space-y-3 text-sm text-white/60 mb-6">
								<p>
									Current quorum: {totalVotes} /{" "}
									{selectedProposal.quorumRequired}
								</p>
								<p>
									Quorum status: {quorumReached ? "Reached" : "Not reached"}
								</p>
								<p>
									Your current vote:{" "}
									{selectedProposal.userVote
                ? selectedProposal.userVote
                : "Not voted"}
								</p>
								<p>
									Your vote = {governanceTokens.toFixed(2)} governance tokens
								</p>
								<p>
									Countdown timer: {getTimeRemaining(selectedProposal.endDate)}
								</p>
							</div>

							<div className="flex flex-wrap gap-3">
								<button onClick={function () { return handleVote("YES"); }} disabled={voteDisabled || isSubmittingVote} className="px-6 py-3 bg-brand-cyan/10 border border-brand-cyan/30 text-brand-cyan font-black uppercase tracking-widest rounded-full disabled:opacity-50 disabled:cursor-not-allowed">
									{isSubmittingVote ? "Submitting..." : "Vote YES"}
								</button>

								<button onClick={function () { return handleVote("NO"); }} disabled={voteDisabled || isSubmittingVote} className="px-6 py-3 bg-brand-purple/10 border border-brand-purple/30 text-brand-purple font-black uppercase tracking-widest rounded-full disabled:opacity-50 disabled:cursor-not-allowed">
									{isSubmittingVote ? "Submitting..." : "Vote NO"}
								</button>
							</div>

							{txMessage && (<p className="mt-4 text-sm text-white/70">{txMessage}</p>)}

							{getVoteDisabledMessage() && (<p className="mt-4 text-sm text-white/50">
									{getVoteDisabledMessage()}
								</p>)}
						</div>
					</div>
				</div>)}

			{filteredProposals.length > 0 ? (<div className="grid gap-6">
					{filteredProposals.map(function (proposal) { return (<button key={proposal.id} onClick={function () {
                    setSelectedProposal(proposal);
                    setTxMessage("");
                }} className={"glass-card p-8 rounded-[2.5rem] border text-left transition-all duration-300 ".concat((selectedProposal === null || selectedProposal === void 0 ? void 0 : selectedProposal.id) === proposal.id
                    ? "border-brand-cyan/40"
                    : "border-white/5 hover:border-brand-cyan/30 hover:-translate-y-1")}>
							<div className="flex justify-between items-start gap-6 mb-5">
								<div>
									<h2 className="text-2xl font-black tracking-tight mb-2">
										{proposal.title}
									</h2>
									<p className="text-sm text-white/40">
										Applicant: {shortenAddress(proposal.author)}
									</p>
								</div>

								<span className="px-4 py-1.5 bg-white/5 text-[10px] font-black uppercase tracking-widest rounded-full border border-white/10">
									{proposal.status}
								</span>
							</div>

							<div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
								<div>
									<p className="text-[10px] text-white/30 uppercase font-black tracking-widest mb-1">
										USDC Requested
									</p>
									<p className="font-bold">{proposal.usdcRequested}</p>
								</div>

								<div>
									<p className="text-[10px] text-white/30 uppercase font-black tracking-widest mb-1">
										LRN Score
									</p>
									<p className="font-bold">{proposal.lrnScore}</p>
								</div>

								<div>
									<p className="text-[10px] text-white/30 uppercase font-black tracking-widest mb-1">
										Time Remaining
									</p>
									<p className="font-bold">
										{getTimeRemaining(proposal.endDate)}
									</p>
								</div>

								<div>
									<p className="text-[10px] text-white/30 uppercase font-black tracking-widest mb-1">
										Total Votes
									</p>
									<p className="font-bold">
										{proposal.votesFor + proposal.votesAgainst}
									</p>
								</div>
							</div>

							<div className="flex items-center gap-4">
								<div className="flex-1 h-2 bg-white/5 rounded-full overflow-hidden">
									<div className="h-full bg-brand-cyan" style={{
                    width: "".concat((proposal.votesFor /
                        (proposal.votesFor + proposal.votesAgainst)) *
                        100, "%"),
                }}/>
								</div>
								<div className="text-[10px] font-black uppercase tracking-widest text-white/40">
									{Math.round((proposal.votesFor /
                    (proposal.votesFor + proposal.votesAgainst)) *
                    100)}
									% YES
								</div>
							</div>
						</button>); })}
				</div>) : (<div className="glass-card p-12 rounded-[2.5rem] border border-white/5 text-center">
					<h3 className="text-2xl font-black mb-3">
						{filter === "Active"
                ? "No active proposals at the moment."
                : "No proposals found for this filter."}
					</h3>
					<p className="text-white/40">
						Check back later for new governance proposals.
					</p>
				</div>)}
		</div>);
};
exports.default = DaoProposals;
