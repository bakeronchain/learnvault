"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.shortenContractId = shortenContractId;
/**
 * Shortens a contract ID string by keeping the first `prefixLength` characters,
 * an ellipsis, then the last `suffixLength` characters.
 * If the ID is shorter than or equal to `prefixLength + suffixLength`, returns it unchanged.
 */
function shortenContractId(id, prefixLength, suffixLength) {
    if (prefixLength === void 0) { prefixLength = 5; }
    if (suffixLength === void 0) { suffixLength = 4; }
    if (id.length <= prefixLength + suffixLength) {
        return id;
    }
    var start = id.slice(0, prefixLength);
    var end = id.slice(-suffixLength);
    return "".concat(start, "\u2026").concat(end);
}
