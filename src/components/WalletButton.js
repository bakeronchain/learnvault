"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WalletButton = void 0;
var design_system_1 = require("@stellar/design-system");
var react_1 = require("react");
var react_i18next_1 = require("react-i18next");
var useWallet_1 = require("../hooks/useWallet");
var wallet_1 = require("../util/wallet");
var WalletButton = function () {
    var _a, _b;
    var _c = (0, react_1.useState)(false), showDisconnectModal = _c[0], setShowDisconnectModal = _c[1];
    var _d = (0, useWallet_1.useWallet)(), address = _d.address, isPending = _d.isPending, balances = _d.balances;
    var t = (0, react_i18next_1.useTranslation)().t;
    var buttonLabel = isPending ? t("wallet.loading") : t("wallet.connect");
    if (!address) {
        return (<design_system_1.Button variant="secondary" size="md" onClick={function () { return void (0, wallet_1.connectWallet)(); }}>
				<design_system_1.Icon.Wallet02 />
				{buttonLabel}
			</design_system_1.Button>);
    }
    return (<div style={{
            display: "flex",
            flexDirection: "row",
            alignItems: "center",
            gap: "5px",
            opacity: isPending ? 0.6 : 1,
        }}>
			<design_system_1.Text as="div" size="sm">
				{t("wallet.balance", { amount: (_b = (_a = balances === null || balances === void 0 ? void 0 : balances.lrn) === null || _a === void 0 ? void 0 : _a.balance) !== null && _b !== void 0 ? _b : "-" })}
			</design_system_1.Text>

			<div id="modalContainer">
				<design_system_1.Modal visible={showDisconnectModal} onClose={function () { return setShowDisconnectModal(false); }} parentId="modalContainer">
					<design_system_1.Modal.Heading>
						{t("wallet.connectedAs")}{" "}
						<code style={{ lineBreak: "anywhere" }}>{address}</code>
						{t("wallet.disconnectPrompt")}
					</design_system_1.Modal.Heading>
					<design_system_1.Modal.Footer itemAlignment="stack">
						<design_system_1.Button size="md" variant="primary" onClick={function () {
            void (0, wallet_1.disconnectWallet)().then(function () {
                return setShowDisconnectModal(false);
            });
        }}>
							{t("wallet.disconnect")}
						</design_system_1.Button>
						<design_system_1.Button size="md" variant="tertiary" onClick={function () {
            setShowDisconnectModal(false);
        }}>
							{t("wallet.cancel")}
						</design_system_1.Button>
					</design_system_1.Modal.Footer>
				</design_system_1.Modal>
			</div>

			<design_system_1.Profile publicAddress={address} size="md" isShort onClick={function () { return setShowDisconnectModal(true); }}/>
		</div>);
};
exports.WalletButton = WalletButton;
