"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var vitest_1 = require("vitest");
var ProposalCountdown_1 = require("./ProposalCountdown");
(0, vitest_1.describe)("getProposalCountdownState", function () {
    (0, vitest_1.it)("returns Voting closed in red when deadline is now", function () {
        (0, vitest_1.expect)((0, ProposalCountdown_1.getProposalCountdownState)(100, 100)).toEqual({
            label: "Voting closed",
            tone: "red",
        });
    });
    (0, vitest_1.it)("returns Voting closed in red when deadline is past", function () {
        (0, vitest_1.expect)((0, ProposalCountdown_1.getProposalCountdownState)(100, 101)).toEqual({
            label: "Voting closed",
            tone: "red",
        });
    });
    (0, vitest_1.it)("shows green with days and hours when at least 24 hours remain", function () {
        var twoDaysThreeHoursInLedgers = ((2 * 24 + 3) * 60 * 60) / 6;
        (0, vitest_1.expect)((0, ProposalCountdown_1.getProposalCountdownState)(twoDaysThreeHoursInLedgers, 0)).toEqual({
            label: "2 days 3 hours remaining",
            tone: "green",
        });
    });
    (0, vitest_1.it)("shows orange with hours and minutes when under 24 hours remain", function () {
        var threeHoursThirtyMinutesInLedgers = ((3 * 60 + 30) * 60) / 6;
        (0, vitest_1.expect)((0, ProposalCountdown_1.getProposalCountdownState)(threeHoursThirtyMinutesInLedgers, 0)).toEqual({
            label: "3 hours 30 min remaining",
            tone: "orange",
        });
    });
});
