"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProposalCountdownState = getProposalCountdownState;
exports.default = ProposalCountdown;
var LEDGER_SECONDS = 6;
var DAY_SECONDS = 24 * 60 * 60;
var HOUR_SECONDS = 60 * 60;
var MINUTE_SECONDS = 60;
function getProposalCountdownState(deadlineLedger, currentLedger) {
    var ledgersRemaining = deadlineLedger - currentLedger;
    var secondsRemaining = ledgersRemaining * LEDGER_SECONDS;
    if (secondsRemaining <= 0) {
        return { label: "Voting closed", tone: "red" };
    }
    if (secondsRemaining < DAY_SECONDS) {
        var hours_1 = Math.floor(secondsRemaining / HOUR_SECONDS);
        var minutes = Math.floor((secondsRemaining % HOUR_SECONDS) / MINUTE_SECONDS);
        return { label: "".concat(hours_1, " hours ").concat(minutes, " min remaining"), tone: "orange" };
    }
    var days = Math.floor(secondsRemaining / DAY_SECONDS);
    var hours = Math.floor((secondsRemaining % DAY_SECONDS) / HOUR_SECONDS);
    return { label: "".concat(days, " days ").concat(hours, " hours remaining"), tone: "green" };
}
var toneClassMap = {
    green: "text-green-400",
    orange: "text-orange-400",
    red: "text-red-400",
};
function ProposalCountdown(_a) {
    var deadlineLedger = _a.deadlineLedger, currentLedger = _a.currentLedger;
    var state = getProposalCountdownState(deadlineLedger, currentLedger);
    return <span className={toneClassMap[state.tone]}>{state.label}</span>;
}
