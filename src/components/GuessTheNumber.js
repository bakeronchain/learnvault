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
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.GuessTheNumber = void 0;
var design_system_1 = require("@stellar/design-system");
var react_1 = require("react");
// import game from "../contracts/guess_the_number"
var useWallet_1 = require("../hooks/useWallet");
var GuessTheNumber_module_css_1 = require("./GuessTheNumber.module.css");
var generatedContractModules = import.meta.glob("../contracts/*.ts");
var guessClientModuleLoader = (_a = Object.entries(generatedContractModules).find(function (_a) {
    var path = _a[0];
    return path.endsWith("/guess_the_number.ts");
})) === null || _a === void 0 ? void 0 : _a[1];
var loadGuessClient = function () { return __awaiter(void 0, void 0, void 0, function () {
    var module;
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0:
                if (!guessClientModuleLoader) {
                    return [2 /*return*/, null];
                }
                return [4 /*yield*/, guessClientModuleLoader()];
            case 1:
                module = _a.sent();
                if (typeof module === "object" &&
                    module !== null &&
                    "default" in module &&
                    module.default) {
                    return [2 /*return*/, module.default];
                }
                return [2 /*return*/, null];
        }
    });
}); };
var missingClientMessage = "Guess The Number bindings are missing. Run `stellar learnvault watch --build-clients` to generate the contract client.";
var GuessTheNumber = function () {
    var _a = (0, useWallet_1.useWallet)(), address = _a.address, updateBalances = _a.updateBalances, signTransaction = _a.signTransaction;
    var _b = (0, react_1.useState)("idle"), result = _b[0], setResult = _b[1];
    var _c = (0, react_1.useState)(null), errorMessage = _c[0], setErrorMessage = _c[1];
    var submitGuess = function (formData) { return __awaiter(void 0, void 0, void 0, function () {
        var guess;
        return __generator(this, function (_a) {
            setErrorMessage(null);
            if (!address) {
                setErrorMessage("Connect to your wallet in order to guess.");
                setResult("failure");
                return [2 /*return*/];
            }
            guess = formData.get("guess");
            if (typeof guess !== "string" || !guess) {
                setErrorMessage("Enter a number from 1 to 10 before submitting.");
                setResult("failure");
                return [2 /*return*/];
            }
            setResult("loading");
            // TODO: Create a transaction using the contract client
            // const tx = await game.guess(
            // 	{ a_number: BigInt(guess), guesser: address },
            // 	// @ts-expect-error js-stellar-sdk has bad typings; publicKey is, in fact, allowed
            // 	{ publicKey: address },
            // )
            // // Send the transaction to the current network
            // const { result } = await tx.signAndSend({ signTransaction })
            // // Handle result and update wallet balance
            // if (result.isErr()) {
            // 	console.error(result.unwrapErr())
            // } else {
            // 	setResult(result.unwrap() ? "success" : "failure")
            // 	await updateBalances()
            // }
            // Placeholder: simulate success
            setTimeout(function () {
                setResult(Math.random() > 0.5 ? "success" : "failure");
            }, 1000);
            return [2 /*return*/];
        });
    }); };
    var reset = function () {
        setResult("idle");
        setErrorMessage(null);
    };
    return (<div className={GuessTheNumber_module_css_1.default.GuessTheNumber}>
			<form action={submitGuess}>
				<design_system_1.Input placeholder="Guess a number from 1 to 10!" id="guess" name="guess" fieldSize="lg" isError={result === "failure"} error={result === "failure" ? (errorMessage !== null && errorMessage !== void 0 ? errorMessage : undefined) : undefined} onChange={reset}/>

				<design_system_1.Button type="submit" disabled={result === "loading"} variant="primary" size="lg">
					Submit
				</design_system_1.Button>
			</form>

			{result === "success" && (<design_system_1.Card>
					<design_system_1.Icon.CheckCircle className={GuessTheNumber_module_css_1.default.success}/>
					<p>
						You got it! Play again by calling <design_system_1.Code size="md">reset</design_system_1.Code> in
						the Contract Explorer.
					</p>
				</design_system_1.Card>)}
			{result === "failure" && (<design_system_1.Card>
					<design_system_1.Icon.XCircle className={GuessTheNumber_module_css_1.default.failure}/>
					<p>{errorMessage !== null && errorMessage !== void 0 ? errorMessage : "Incorrect guess. Try again!"}</p>
				</design_system_1.Card>)}
		</div>);
};
exports.GuessTheNumber = GuessTheNumber;
