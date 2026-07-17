"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useContractIds = useContractIds;
var normalizeContractId = function (value) {
    var trimmed = value === null || value === void 0 ? void 0 : value.trim();
    return trimmed || undefined;
};
function useContractIds() {
    var learnToken = normalizeContractId(import.meta.env.VITE_LEARN_TOKEN_CONTRACT_ID);
    var governanceToken = normalizeContractId(import.meta.env.VITE_GOVERNANCE_TOKEN_CONTRACT_ID);
    var scholarNft = normalizeContractId(import.meta.env.VITE_SCHOLAR_NFT_CONTRACT_ID);
    var courseMilestone = normalizeContractId(import.meta.env.VITE_COURSE_MILESTONE_CONTRACT_ID);
    var scholarshipTreasury = normalizeContractId(import.meta.env.VITE_SCHOLARSHIP_TREASURY_CONTRACT_ID);
    var milestoneEscrow = normalizeContractId(import.meta.env.VITE_MILESTONE_ESCROW_CONTRACT_ID);
    var usdc = normalizeContractId(import.meta.env.VITE_USDC_CONTRACT_ID);
    return {
        learnToken: learnToken,
        governanceToken: governanceToken,
        scholarNft: scholarNft,
        courseMilestone: courseMilestone,
        scholarshipTreasury: scholarshipTreasury,
        milestoneEscrow: milestoneEscrow,
        usdc: usdc,
        isDeployed: function (id) { return Boolean(id); },
    };
}
