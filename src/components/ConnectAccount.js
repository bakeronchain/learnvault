"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var react_1 = require("react");
var util_1 = require("../contracts/util");
var FundAccountButton_1 = require("./FundAccountButton");
var NetworkPill_1 = require("./NetworkPill");
var ThemeToggle_1 = require("./ThemeToggle");
var WalletButton_1 = require("./WalletButton");
var ConnectAccount = function () {
    return (<div style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            gap: "10px",
            verticalAlign: "middle",
        }}>
			<ThemeToggle_1.ThemeToggle />
			<NetworkPill_1.default />
			{util_1.stellarNetwork !== "PUBLIC" && <FundAccountButton_1.default />}
			<WalletButton_1.WalletButton />
		</div>);
};
exports.default = ConnectAccount;
