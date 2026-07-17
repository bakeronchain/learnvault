"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = Dao;
var design_system_1 = require("@stellar/design-system");
var react_1 = require("react");
var react_router_dom_1 = require("react-router-dom");
var useWallet_1 = require("../hooks/useWallet");
var scholarshipApplications_1 = require("../util/scholarshipApplications");
var Dao_module_css_1 = require("./Dao.module.css");
function Dao() {
    var address = (0, useWallet_1.useWallet)().address;
    var location = (0, react_router_dom_1.useLocation)();
    var _a = (0, react_1.useState)([]), proposals = _a[0], setProposals = _a[1];
    (0, react_1.useEffect)(function () {
        var sync = function () { return setProposals((0, scholarshipApplications_1.readStoredScholarshipProposals)()); };
        sync();
        window.addEventListener("storage", sync);
        return function () { return window.removeEventListener("storage", sync); };
    }, []);
    var scopedProposals = (0, react_1.useMemo)(function () {
        return address
            ? proposals.filter(function (proposal) { return proposal.applicant === address; })
            : proposals;
    }, [address, proposals]);
    var highlightedProposalId = location.hash.replace("#proposal-", "");
    return (<div className={Dao_module_css_1.default.Dao}>
			<section className={Dao_module_css_1.default.Hero}>
				<div>
					<p className={Dao_module_css_1.default.Eyebrow}>Scholarship DAO</p>
					<h1>Funding proposals and community review</h1>
					<p className={Dao_module_css_1.default.HeroText}>
						Eligible learners can submit milestone-based scholarship requests to
						the DAO treasury. Review the latest applications here, then follow
						each proposal through governance and disbursement.
					</p>
				</div>
				<div className={Dao_module_css_1.default.ActionCluster}>
					<react_router_dom_1.Link to="/scholarships/apply">
						<design_system_1.Button variant="primary" size="md">
							Apply for scholarship
						</design_system_1.Button>
					</react_router_dom_1.Link>
					<span>
						Showing {scopedProposals.length} proposal
						{scopedProposals.length === 1 ? "" : "s"}
						{address ? " for your wallet" : " across local submissions"}
					</span>
				</div>
			</section>

			{scopedProposals.length === 0 ? (<design_system_1.Card>
					<div className={Dao_module_css_1.default.EmptyState}>
						<h2>No scholarship proposals yet</h2>
						<p>
							Start the multi-step wizard to create a proposal with an
							eligibility check, funding milestones, review step, and
							confirmation view.
						</p>
						<react_router_dom_1.Link to="/scholarships/apply">
							<design_system_1.Button variant="primary" size="md">
								Open application wizard
							</design_system_1.Button>
						</react_router_dom_1.Link>
					</div>
				</design_system_1.Card>) : (<div className={Dao_module_css_1.default.ProposalList}>
					{scopedProposals.map(function (proposal) {
                var isHighlighted = proposal.proposalId === highlightedProposalId;
                return (<design_system_1.Card key={proposal.id}>
								<article id={"proposal-".concat(proposal.proposalId)} className={Dao_module_css_1.default.ProposalCard} data-highlighted={isHighlighted}>
									<div className={Dao_module_css_1.default.ProposalHeader}>
										<div>
											<p className={Dao_module_css_1.default.ProposalMeta}>
												Proposal #{proposal.proposalId}
											</p>
											<h2>{proposal.programName}</h2>
										</div>
										<div className={Dao_module_css_1.default.BadgeRow}>
											<span className={Dao_module_css_1.default.StatusBadge}>
												{proposal.status}
											</span>
											<span className={Dao_module_css_1.default.SourceBadge}>
												{proposal.source}
											</span>
										</div>
									</div>

									<div className={Dao_module_css_1.default.DetailGrid}>
										<div>
											<span>Applicant</span>
											<strong>{(0, scholarshipApplications_1.shortenAddress)(proposal.applicant)}</strong>
										</div>
										<div>
											<span>Requested</span>
											<strong>{(0, scholarshipApplications_1.formatUsdcAmount)(proposal.amountUsdc)}</strong>
										</div>
										<div>
											<span>Program start</span>
											<strong>{proposal.startDate}</strong>
										</div>
										<div>
											<span>Submitted</span>
											<strong>
												{new Date(proposal.submittedAt).toLocaleString()}
											</strong>
										</div>
									</div>

									<p className={Dao_module_css_1.default.Description}>
										{proposal.programDescription}
									</p>

									<div className={Dao_module_css_1.default.Milestones}>
										{proposal.milestones.map(function (milestone, index) { return (<div key={"".concat(proposal.id, "-milestone-").concat(index)} className={Dao_module_css_1.default.MilestoneItem}>
												<strong>Milestone {index + 1}</strong>
												<p>{milestone.description}</p>
												<span>{milestone.dueDate}</span>
											</div>); })}
									</div>

									<div className={Dao_module_css_1.default.ProposalFooter}>
										<react_router_dom_1.Link to={proposal.programUrl} target="_blank">
											<design_system_1.Button variant="tertiary" size="md">
												View program
											</design_system_1.Button>
										</react_router_dom_1.Link>
										{proposal.txHash && <code>{proposal.txHash}</code>}
									</div>
								</article>
							</design_system_1.Card>);
            })}
				</div>)}
		</div>);
}
exports.default = Dao;
