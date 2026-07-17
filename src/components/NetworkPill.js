"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var design_system_1 = require("@stellar/design-system");
var react_1 = require("react");
var react_i18next_1 = require("react-i18next");
var util_1 = require("../contracts/util");
var useWallet_1 = require("../hooks/useWallet");
// Format network name with first letter capitalized
var formatNetworkName = function (name, t) {
    // TODO: This is a workaround until @creit-tech/stellar-wallets-kit uses the new name for a local network.
    return name === "STANDALONE"
        ? t("connect.local")
        : name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
};
var bgColor = "#F0F2F5";
var textColor = "#4A5362";
var NetworkPill = function () {
    var _a = (0, useWallet_1.useWallet)(), network = _a.network, address = _a.address;
    var t = (0, react_i18next_1.useTranslation)().t;
    var appNetwork = formatNetworkName(util_1.stellarNetwork, t);
    // Check if there's a network mismatch
    var walletNetwork = formatNetworkName(network !== null && network !== void 0 ? network : "", t);
    var isNetworkMismatch = walletNetwork !== appNetwork;
    var title = "";
    var color = "#2ED06E";
    if (!address) {
        title = t("connect.networkConnect");
        color = "#C1C7D0";
    }
    else if (isNetworkMismatch) {
        title = t("connect.networkMismatch", {
            wallet: walletNetwork,
            app: appNetwork,
        });
        color = "#FF3B30";
    }
    return (<div style={{
            backgroundColor: bgColor,
            color: textColor,
            padding: "4px 10px",
            borderRadius: "16px",
            fontSize: "12px",
            fontWeight: "bold",
            display: "flex",
            alignItems: "center",
            gap: "4px",
            cursor: isNetworkMismatch ? "help" : "default",
        }} title={title}>
			<design_system_1.Icon.Circle color={color}/>
			{appNetwork}
		</div>);
};
exports.default = NetworkPill;
