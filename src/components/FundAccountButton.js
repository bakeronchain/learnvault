"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var design_system_1 = require("@stellar/design-system");
var react_1 = require("react");
var react_i18next_1 = require("react-i18next");
var useNotification_ts_1 = require("../hooks/useNotification.ts");
var useWallet_ts_1 = require("../hooks/useWallet.ts");
var friendbot_1 = require("../util/friendbot");
var FundAccountButton = function () {
    var addNotification = (0, useNotification_ts_1.useNotification)().addNotification;
    var t = (0, react_i18next_1.useTranslation)().t;
    var _a = (0, react_1.useTransition)(), isPending = _a[0], startTransition = _a[1];
    var _b = (0, react_1.useState)(false), isTooltipVisible = _b[0], setIsTooltipVisible = _b[1];
    var address = (0, useWallet_ts_1.useWallet)().address;
    if (!address)
        return null;
    var handleFundAccount = function () {
        startTransition(function () { return __awaiter(void 0, void 0, void 0, function () {
            var response, body, _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 5, , 6]);
                        return [4 /*yield*/, fetch((0, friendbot_1.getFriendbotUrl)(address))];
                    case 1:
                        response = _b.sent();
                        if (!response.ok) return [3 /*break*/, 2];
                        addNotification(t("connect.funded"), "success");
                        return [3 /*break*/, 4];
                    case 2: return [4 /*yield*/, response.json()];
                    case 3:
                        body = _b.sent();
                        if (body !== null &&
                            typeof body === "object" &&
                            "detail" in body &&
                            typeof body.detail === "string") {
                            addNotification(t("connect.fundErrorDetail", { detail: body.detail }), "error");
                        }
                        else {
                            addNotification(t("connect.fundErrorUnknown"), "error");
                        }
                        _b.label = 4;
                    case 4: return [3 /*break*/, 6];
                    case 5:
                        _a = _b.sent();
                        addNotification(t("connect.fundErrorRetry"), "error");
                        return [3 /*break*/, 6];
                    case 6: return [2 /*return*/];
                }
            });
        }); });
    };
    return (<div onMouseEnter={function () { return setIsTooltipVisible(true); }} onMouseLeave={function () { return setIsTooltipVisible(false); }}>
			<design_system_1.Tooltip isVisible={isTooltipVisible} isContrast title={t("connect.fund")} placement="bottom" triggerEl={<design_system_1.Button disabled={isPending} onClick={handleFundAccount} variant="primary" size="md">
						{t("connect.fund")}
					</design_system_1.Button>}>
				<div style={{ width: "13em" }}>{t("connect.alreadyFunded")}</div>
			</design_system_1.Tooltip>
		</div>);
};
exports.default = FundAccountButton;
