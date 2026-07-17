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
exports.useSubscription = useSubscription;
var stellar_sdk_1 = require("@stellar/stellar-sdk");
var rpc_1 = require("@stellar/stellar-sdk/rpc");
var React = require("react");
var util_1 = require("../contracts/util");
/**
 * Paging tokens for each contract/topic pair. These can be mutated directly,
 * rather than being stored as state within the React hook.
 */
var paging = {};
// NOTE: Server is configured using envvars which shouldn't change during runtime
var server = new rpc_1.Server(util_1.rpcUrl, { allowHttp: util_1.stellarNetwork === "LOCAL" });
/**
 * Subscribe to events for a given topic from a given contract, using a library
 * generated with `soroban contract bindings typescript`.
 *
 * Someday such generated libraries will include functions for subscribing to
 * the events the contract emits, but for now you can copy this hook into your
 * React project if you need to subscribe to events, or adapt this logic for
 * non-React use.
 */
function useSubscription(contractId, topic, onEvent, pollInterval) {
    if (pollInterval === void 0) { pollInterval = 5000; }
    var id = "".concat(contractId, ":").concat(topic);
    React.useEffect(function () {
        var _a;
        var currentPaging = (_a = paging[id]) !== null && _a !== void 0 ? _a : (paging[id] = {});
        var timeoutId = null;
        var stop = false;
        function pollEvents() {
            return __awaiter(this, void 0, void 0, function () {
                var latestLedgerState, lastLedger, response, error_1;
                return __generator(this, function (_a) {
                    switch (_a.label) {
                        case 0:
                            _a.trys.push([0, 4, 5, 6]);
                            if (!!currentPaging.lastLedgerStart) return [3 /*break*/, 2];
                            return [4 /*yield*/, server.getLatestLedger()];
                        case 1:
                            latestLedgerState = _a.sent();
                            currentPaging.lastLedgerStart = latestLedgerState.sequence;
                            _a.label = 2;
                        case 2:
                            lastLedger = currentPaging.lastLedgerStart;
                            return [4 /*yield*/, server.getEvents(currentPaging.pagingToken
                                    ? {
                                        cursor: currentPaging.pagingToken,
                                        filters: [
                                            {
                                                contractIds: [contractId],
                                                topics: [[stellar_sdk_1.xdr.ScVal.scvSymbol(topic).toXDR("base64")]],
                                                type: "contract",
                                            },
                                        ],
                                        limit: 10,
                                    }
                                    : {
                                        startLedger: lastLedger,
                                        endLedger: lastLedger + 100,
                                        filters: [
                                            {
                                                contractIds: [contractId],
                                                topics: [[stellar_sdk_1.xdr.ScVal.scvSymbol(topic).toXDR("base64")]],
                                                type: "contract",
                                            },
                                        ],
                                        limit: 10,
                                    })];
                        case 3:
                            response = _a.sent();
                            currentPaging.pagingToken = undefined;
                            if (response.latestLedger) {
                                currentPaging.lastLedgerStart = response.latestLedger;
                            }
                            if (response.events && response.events.length > 0) {
                                response.events.forEach(function (event) {
                                    try {
                                        onEvent(event);
                                    }
                                    catch (error) {
                                        console.error("Poll Events: subscription callback had error: ", error);
                                    }
                                });
                                if (response.cursor) {
                                    currentPaging.pagingToken = response.cursor;
                                }
                            }
                            return [3 /*break*/, 6];
                        case 4:
                            error_1 = _a.sent();
                            console.error("Poll Events: error: ", error_1);
                            return [3 /*break*/, 6];
                        case 5:
                            if (!stop) {
                                timeoutId = setTimeout(function () { return void pollEvents(); }, pollInterval);
                            }
                            return [7 /*endfinally*/];
                        case 6: return [2 /*return*/];
                    }
                });
            });
        }
        void pollEvents();
        return function () {
            if (timeoutId != null) {
                clearTimeout(timeoutId);
            }
            stop = true;
        };
    }, [contractId, topic, onEvent, id, pollInterval]);
}
