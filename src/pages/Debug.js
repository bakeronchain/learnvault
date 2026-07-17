"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var contract_explorer_1 = require("@theahaco/contract-explorer");
var react_i18next_1 = require("react-i18next");
var util_1 = require("../contracts/util");
var useWallet_1 = require("../hooks/useWallet");
// Import contract clients and load them for the Contract Explorer
var contractModules = import.meta.glob("../contracts/*.ts");
var contracts = await (0, contract_explorer_1.loadContracts)(contractModules);
var Debugger = function () {
    var _a = (0, useWallet_1.useWallet)(), address = _a.address, signTransaction = _a.signTransaction;
    var t = (0, react_i18next_1.useTranslation)().t;
    return (<div className="p-12 max-w-7xl mx-auto text-white animate-in fade-in slide-in-from-bottom-8 duration-1000">
			<header className="mb-12">
				<h1 className="text-5xl font-black mb-4 tracking-tighter text-gradient">
					{t("nav.debug")}
				</h1>
				<p className="text-white/40 text-lg font-medium">
					{t("pages.debug.desc", "Low-level interaction with indexed Soroban smart contracts.")}
				</p>
			</header>

			<div className="glass-card p-10 rounded-[3rem] border border-white/5 relative overflow-hidden backdrop-blur-3xl shadow-2xl">
				<div className="absolute top-0 right-0 p-8 opacity-5">
					<div className="text-8xl font-black tracking-tighter">DEBUG</div>
				</div>
				<contract_explorer_1.ContractExplorer contracts={contracts} network={util_1.network} address={address} signTransaction={signTransaction}/>
			</div>
		</div>);
};
exports.default = Debugger;
