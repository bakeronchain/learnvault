"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getIpfsUrl = getIpfsUrl;
exports.isCid = isCid;
exports.normaliseCid = normaliseCid;
var DEFAULT_GATEWAY = "https://gateway.pinata.cloud/ipfs";
/**
 * Build a public HTTP URL for an IPFS CID.
 *
 * Uses the optional VITE_IPFS_GATEWAY_URL env var so teams with a dedicated
 * Pinata gateway can swap it in without changing component code.
 */
function getIpfsUrl(cid) {
    var _a, _b;
    var base = (_b = (_a = import.meta.env.VITE_IPFS_GATEWAY_URL) === null || _a === void 0 ? void 0 : _a.replace(/\/$/, "")) !== null && _b !== void 0 ? _b : DEFAULT_GATEWAY;
    return "".concat(base, "/").concat(cid);
}
/**
 * Returns true if the string looks like a bare CIDv0 (Qm…) or CIDv1 (bafy…).
 * Useful for conditional rendering of IPFS previews.
 */
function isCid(value) {
    return /^(Qm[1-9A-HJ-NP-Za-km-z]{44}|bafy[a-z2-7]{52,})/.test(value);
}
/**
 * Strips an ipfs:// prefix and returns the bare CID, or passes the value
 * through unchanged if it is already a bare CID or a gateway URL.
 */
function normaliseCid(value) {
    if (value.startsWith("ipfs://"))
        return value.slice("ipfs://".length);
    return value;
}
