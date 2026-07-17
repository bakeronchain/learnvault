"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
exports.default = ScholarshipApply;
var design_system_1 = require("@stellar/design-system");
var react_1 = require("react");
var react_router_dom_1 = require("react-router-dom");
var useScholarshipApplication_1 = require("../hooks/useScholarshipApplication");
var useWallet_1 = require("../hooks/useWallet");
var scholarshipApplications_1 = require("../util/scholarshipApplications");
var ScholarshipApply_module_css_1 = require("./ScholarshipApply.module.css");
var steps = [
    "Eligibility Check",
    "Program Details",
    "Funding Request",
    "Review & Submit",
    "Confirmation",
];
var programFieldScopes = [
    "programName",
    "programUrl",
    "programDescription",
    "startDate",
];
var fundingFieldScopes = ["amountUsdc", "milestones"];
var reviewFieldScopes = ["walletConfirmed"];
var matchesScope = function (path, scope) {
    return path === scope || path.startsWith("".concat(scope, "."));
};
var filterErrorsByScopes = function (errors, scopes) {
    return Object.fromEntries(Object.entries(errors).filter(function (_a) {
        var path = _a[0];
        return scopes.some(function (scope) { return matchesScope(path, scope); });
    }));
};
function ScholarshipApply() {
    var _this = this;
    var _a;
    var address = (0, useWallet_1.useWallet)().address;
    var _b = (0, useScholarshipApplication_1.useScholarshipApplication)(), eligible = _b.eligible, eligibilityBalance = _b.eligibilityBalance, eligibilitySource = _b.eligibilitySource, isCheckingEligibility = _b.isCheckingEligibility, isSubmitting = _b.isSubmitting, latestSubmittedProposal = _b.latestSubmittedProposal, lrnGap = _b.lrnGap, minLrnRequired = _b.minLrnRequired, submitApplication = _b.submitApplication;
    var _c = (0, react_1.useState)(0), stepIndex = _c[0], setStepIndex = _c[1];
    var _d = (0, react_1.useState)(scholarshipApplications_1.emptyScholarshipApplication), formValues = _d[0], setFormValues = _d[1];
    var _e = (0, react_1.useState)({}), errors = _e[0], setErrors = _e[1];
    var _f = (0, react_1.useState)(null), submitError = _f[0], setSubmitError = _f[1];
    var _g = (0, react_1.useState)(null), submittedProposal = _g[0], setSubmittedProposal = _g[1];
    var clearErrorsForScopes = function (scopes) {
        setErrors(function (current) {
            return Object.fromEntries(Object.entries(current).filter(function (_a) {
                var path = _a[0];
                return !scopes.some(function (scope) { return matchesScope(path, scope); });
            }));
        });
    };
    var replaceErrorsForScopes = function (scopes, nextScopedErrors) {
        setErrors(function (current) { return (__assign(__assign({}, Object.fromEntries(Object.entries(current).filter(function (_a) {
            var path = _a[0];
            return !scopes.some(function (scope) { return matchesScope(path, scope); });
        }))), nextScopedErrors)); });
        return Object.keys(nextScopedErrors).length === 0;
    };
    var updateField = function (field, value) {
        setFormValues(function (current) {
            var _a;
            return (__assign(__assign({}, current), (_a = {}, _a[field] = value, _a)));
        });
        clearErrorsForScopes([field]);
        setSubmitError(null);
    };
    var updateMilestone = function (index, field, value) {
        setFormValues(function (current) { return (__assign(__assign({}, current), { milestones: current.milestones.map(function (milestone, milestoneIndex) {
                var _a;
                return milestoneIndex === index ? __assign(__assign({}, milestone), (_a = {}, _a[field] = value, _a)) : milestone;
            }) })); });
        clearErrorsForScopes(["milestones.".concat(index, ".").concat(field), "milestones"]);
        setSubmitError(null);
    };
    var validateEligibilityStep = function () {
        if (!address) {
            return replaceErrorsForScopes(["eligibility"], {
                eligibility: "Connect your wallet to check LRN eligibility.",
            });
        }
        if (isCheckingEligibility) {
            return replaceErrorsForScopes(["eligibility"], {
                eligibility: "Wait for the LRN balance check to finish.",
            });
        }
        if (!eligible) {
            return replaceErrorsForScopes(["eligibility"], {
                eligibility: "You need ".concat((0, scholarshipApplications_1.formatLrnBalance)(lrnGap), " more LRN to continue."),
            });
        }
        return replaceErrorsForScopes(["eligibility"], {});
    };
    var validateProgramDetailsStep = function () {
        var result = scholarshipApplications_1.programDetailsSchema.safeParse({
            programName: formValues.programName,
            programUrl: formValues.programUrl,
            programDescription: formValues.programDescription,
            startDate: formValues.startDate,
        });
        var nextErrors = result.success
            ? {}
            : filterErrorsByScopes((0, scholarshipApplications_1.flattenZodErrors)(result.error), programFieldScopes);
        return replaceErrorsForScopes(programFieldScopes, nextErrors);
    };
    var validateFundingStep = function () {
        var result = scholarshipApplications_1.scholarshipApplicationSchema.safeParse(__assign(__assign({}, formValues), { walletConfirmed: true }));
        var nextErrors = result.success
            ? {}
            : filterErrorsByScopes((0, scholarshipApplications_1.flattenZodErrors)(result.error), fundingFieldScopes);
        return replaceErrorsForScopes(fundingFieldScopes, nextErrors);
    };
    var validateReviewStep = function () {
        var result = scholarshipApplications_1.reviewSchema.safeParse({
            walletConfirmed: formValues.walletConfirmed,
        });
        var nextErrors = result.success
            ? {}
            : filterErrorsByScopes((0, scholarshipApplications_1.flattenZodErrors)(result.error), reviewFieldScopes);
        return replaceErrorsForScopes(reviewFieldScopes, nextErrors);
    };
    var goToNextStep = function () {
        var isValid = stepIndex === 0
            ? validateEligibilityStep()
            : stepIndex === 1
                ? validateProgramDetailsStep()
                : stepIndex === 2
                    ? validateFundingStep()
                    : true;
        if (isValid) {
            setStepIndex(function (current) { return Math.min(current + 1, steps.length - 1); });
        }
    };
    var handleSubmit = function () { return __awaiter(_this, void 0, void 0, function () {
        var validation, nextErrors, proposal, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    validation = scholarshipApplications_1.scholarshipApplicationSchema.safeParse(formValues);
                    if (!validation.success) {
                        nextErrors = (0, scholarshipApplications_1.flattenZodErrors)(validation.error);
                        setErrors(nextErrors);
                        if (Object.keys(nextErrors).some(function (path) {
                            return programFieldScopes.some(function (scope) { return matchesScope(path, scope); });
                        })) {
                            setStepIndex(1);
                        }
                        else if (Object.keys(nextErrors).some(function (path) {
                            return fundingFieldScopes.some(function (scope) { return matchesScope(path, scope); });
                        })) {
                            setStepIndex(2);
                        }
                        else {
                            setStepIndex(3);
                        }
                        return [2 /*return*/];
                    }
                    if (!validateReviewStep()) {
                        return [2 /*return*/];
                    }
                    setSubmitError(null);
                    _a.label = 1;
                case 1:
                    _a.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, submitApplication(validation.data)];
                case 2:
                    proposal = _a.sent();
                    setSubmittedProposal(proposal);
                    setErrors({});
                    setStepIndex(4);
                    return [3 /*break*/, 4];
                case 3:
                    error_1 = _a.sent();
                    setSubmitError(error_1 instanceof Error
                        ? error_1.message
                        : "Failed to submit the scholarship proposal.");
                    return [3 /*break*/, 4];
                case 4: return [2 /*return*/];
            }
        });
    }); };
    var resetApplication = function () {
        setFormValues((0, scholarshipApplications_1.emptyScholarshipApplication)());
        setErrors({});
        setSubmitError(null);
        setSubmittedProposal(null);
        setStepIndex(0);
    };
    var confirmationProposal = submittedProposal !== null && submittedProposal !== void 0 ? submittedProposal : latestSubmittedProposal;
    var transactionUrl = (confirmationProposal === null || confirmationProposal === void 0 ? void 0 : confirmationProposal.txHash)
        ? (0, scholarshipApplications_1.explorerTransactionUrl)(confirmationProposal.txHash)
        : undefined;
    return (<div className={ScholarshipApply_module_css_1.default.Page}>
			<section className={ScholarshipApply_module_css_1.default.Hero}>
				<div>
					<p className={ScholarshipApply_module_css_1.default.Eyebrow}>Route: /scholarships/apply</p>
					<h1>Scholarship application wizard</h1>
					<p className={ScholarshipApply_module_css_1.default.HeroText}>
						Submit a polished proposal to the DAO treasury with eligibility
						checks, milestone planning, and wallet-backed submission.
					</p>
				</div>
				<div className={ScholarshipApply_module_css_1.default.HeroMeta}>
					<span>Minimum required: {(0, scholarshipApplications_1.formatLrnBalance)(minLrnRequired)} LRN</span>
					<span>
						Estimated network fee: {scholarshipApplications_1.ESTIMATED_NETWORK_FEE_XLM.toFixed(2)} XLM
					</span>
					<span>
						Wallet: {address ? (0, scholarshipApplications_1.shortenAddress)(address) : "Connect to begin"}
					</span>
				</div>
			</section>

			<div className={ScholarshipApply_module_css_1.default.Layout}>
				<design_system_1.Card>
					<div className={ScholarshipApply_module_css_1.default.StepRail}>
						{steps.map(function (label, index) {
            var state = index === stepIndex
                ? "active"
                : index < stepIndex
                    ? "done"
                    : "upcoming";
            return (<div key={label} className={ScholarshipApply_module_css_1.default.StepRow} data-state={state}>
									<div className={ScholarshipApply_module_css_1.default.StepIndex}>{index + 1}</div>
									<div>
										<p className={ScholarshipApply_module_css_1.default.StepLabel}>{label}</p>
										<p className={ScholarshipApply_module_css_1.default.StepCaption}>
											{index === 0
                    ? "Check balance and threshold"
                    : index === 1
                        ? "Describe the program"
                        : index === 2
                            ? "Break funding into 3 milestones"
                            : index === 3
                                ? "Review, confirm, and sign"
                                : "Track hash and DAO link"}
										</p>
									</div>
								</div>);
        })}
					</div>
				</design_system_1.Card>

				<div className={ScholarshipApply_module_css_1.default.MainColumn}>
					<design_system_1.Card>
						{stepIndex === 0 && (<div className={ScholarshipApply_module_css_1.default.StepPanel}>
								<h2>Eligibility check</h2>
								<p className={ScholarshipApply_module_css_1.default.StepDescription}>
									Your LRN balance is checked as soon as a wallet is connected.
									If a generated LearnToken client is available, the form reads
									the contract balance first and falls back to the wallet asset
									view otherwise.
								</p>
								<div className={ScholarshipApply_module_css_1.default.StatGrid}>
									<div className={ScholarshipApply_module_css_1.default.StatCard}>
										<span className={ScholarshipApply_module_css_1.default.StatLabel}>Connected wallet</span>
										<strong>
											{address ? (0, scholarshipApplications_1.shortenAddress)(address) : "Not connected"}
										</strong>
									</div>
									<div className={ScholarshipApply_module_css_1.default.StatCard}>
										<span className={ScholarshipApply_module_css_1.default.StatLabel}>
											Current LRN balance
										</span>
										<strong>
											{isCheckingEligibility
                ? "Checking..."
                : "".concat((0, scholarshipApplications_1.formatLrnBalance)(eligibilityBalance), " LRN")}
										</strong>
									</div>
									<div className={ScholarshipApply_module_css_1.default.StatCard}>
										<span className={ScholarshipApply_module_css_1.default.StatLabel}>Threshold</span>
										<strong>{(0, scholarshipApplications_1.formatLrnBalance)(minLrnRequired)} LRN</strong>
									</div>
									<div className={ScholarshipApply_module_css_1.default.StatCard}>
										<span className={ScholarshipApply_module_css_1.default.StatLabel}>Eligibility status</span>
										<strong className={eligible ? ScholarshipApply_module_css_1.default.SuccessText : ScholarshipApply_module_css_1.default.WarningText}>
											{eligible
                ? "Eligible to continue"
                : "Below the required threshold"}
										</strong>
									</div>
								</div>
								<p className={ScholarshipApply_module_css_1.default.HelperText}>
									Balance source:{" "}
									{eligibilitySource === "contract"
                ? "LearnToken contract"
                : eligibilitySource === "wallet"
                    ? "wallet asset fallback"
                    : "no wallet connected"}
								</p>
								{errors.eligibility && (<p className={ScholarshipApply_module_css_1.default.ErrorText}>{errors.eligibility}</p>)}
							</div>)}

						{stepIndex === 1 && (<div className={ScholarshipApply_module_css_1.default.StepPanel}>
								<h2>Program details</h2>
								<p className={ScholarshipApply_module_css_1.default.StepDescription}>
									Share where you want to study, what you plan to learn, and
									when the program begins.
								</p>
								<div className={ScholarshipApply_module_css_1.default.FormGrid}>
									<label className={ScholarshipApply_module_css_1.default.Field}>
										<span>Program or bootcamp name</span>
										<input value={formValues.programName} onChange={function (event) {
                return updateField("programName", event.target.value);
            }} placeholder="Soroban builder bootcamp"/>
										{errors.programName && (<span className={ScholarshipApply_module_css_1.default.ErrorText}>
												{errors.programName}
											</span>)}
									</label>
									<label className={ScholarshipApply_module_css_1.default.Field}>
										<span>Program URL</span>
										<input value={formValues.programUrl} onChange={function (event) {
                return updateField("programUrl", event.target.value);
            }} placeholder="https://example.com/program"/>
										{errors.programUrl && (<span className={ScholarshipApply_module_css_1.default.ErrorText}>
												{errors.programUrl}
											</span>)}
									</label>
									<label className={"".concat(ScholarshipApply_module_css_1.default.Field, " ").concat(ScholarshipApply_module_css_1.default.FullWidth)}>
										<span>Why this program matters</span>
										<textarea rows={5} value={formValues.programDescription} onChange={function (event) {
                return updateField("programDescription", event.target.value);
            }} placeholder="Describe the skills you plan to build and how the scholarship changes your trajectory."/>
										{errors.programDescription && (<span className={ScholarshipApply_module_css_1.default.ErrorText}>
												{errors.programDescription}
											</span>)}
									</label>
									<label className={ScholarshipApply_module_css_1.default.Field}>
										<span>Program start date</span>
										<input type="date" value={formValues.startDate} onChange={function (event) {
                return updateField("startDate", event.target.value);
            }}/>
										{errors.startDate && (<span className={ScholarshipApply_module_css_1.default.ErrorText}>
												{errors.startDate}
											</span>)}
									</label>
								</div>
							</div>)}

						{stepIndex === 2 && (<div className={ScholarshipApply_module_css_1.default.StepPanel}>
								<h2>Funding request</h2>
								<p className={ScholarshipApply_module_css_1.default.StepDescription}>
									Break the request into three concrete milestones the DAO can
									review and track over time.
								</p>
								<label className={ScholarshipApply_module_css_1.default.Field}>
									<span>Requested amount (USDC)</span>
									<input type="number" min="0" step="0.0000001" value={formValues.amountUsdc} onChange={function (event) {
                return updateField("amountUsdc", event.target.value);
            }} placeholder="1500"/>
									{errors.amountUsdc && (<span className={ScholarshipApply_module_css_1.default.ErrorText}>
											{errors.amountUsdc}
										</span>)}
								</label>

								<div className={ScholarshipApply_module_css_1.default.MilestoneStack}>
									{formValues.milestones.map(function (milestone, index) { return (<div key={"milestone-".concat(index)} className={ScholarshipApply_module_css_1.default.MilestoneCard}>
											<h3>Milestone {index + 1}</h3>
											<label className={ScholarshipApply_module_css_1.default.Field}>
												<span>Description</span>
												<textarea rows={3} value={milestone.description} onChange={function (event) {
                    return updateMilestone(index, "description", event.target.value);
                }} placeholder="What will be delivered at this checkpoint?"/>
												{errors["milestones.".concat(index, ".description")] && (<span className={ScholarshipApply_module_css_1.default.ErrorText}>
														{errors["milestones.".concat(index, ".description")]}
													</span>)}
											</label>
											<label className={ScholarshipApply_module_css_1.default.Field}>
												<span>Target date</span>
												<input type="date" value={milestone.dueDate} onChange={function (event) {
                    return updateMilestone(index, "dueDate", event.target.value);
                }}/>
												{errors["milestones.".concat(index, ".dueDate")] && (<span className={ScholarshipApply_module_css_1.default.ErrorText}>
														{errors["milestones.".concat(index, ".dueDate")]}
													</span>)}
											</label>
										</div>); })}
								</div>
							</div>)}

						{stepIndex === 3 && (<div className={ScholarshipApply_module_css_1.default.StepPanel}>
								<h2>Review & submit</h2>
								<p className={ScholarshipApply_module_css_1.default.StepDescription}>
									Review the proposal summary, confirm the connected wallet, and
									sign the transaction when prompted.
								</p>
								<div className={ScholarshipApply_module_css_1.default.ReviewGrid}>
									<div className={ScholarshipApply_module_css_1.default.ReviewBlock}>
										<span>Program</span>
										<strong>
											{formValues.programName || "Not provided yet"}
										</strong>
										<p>
											{formValues.programUrl || "No program URL added yet."}
										</p>
									</div>
									<div className={ScholarshipApply_module_css_1.default.ReviewBlock}>
										<span>Funding request</span>
										<strong>
											{(0, scholarshipApplications_1.formatUsdcAmount)(formValues.amountUsdc || 0)}
										</strong>
										<p>
											Estimated network fee:{" "}
											{scholarshipApplications_1.ESTIMATED_NETWORK_FEE_XLM.toFixed(2)} XLM
										</p>
									</div>
									<div className={"".concat(ScholarshipApply_module_css_1.default.ReviewBlock, " ").concat(ScholarshipApply_module_css_1.default.FullWidth)}>
										<span>Learning goal</span>
										<p>
											{formValues.programDescription ||
                "No description added yet."}
										</p>
									</div>
									<div className={"".concat(ScholarshipApply_module_css_1.default.ReviewBlock, " ").concat(ScholarshipApply_module_css_1.default.FullWidth)}>
										<span>Milestones</span>
										<div className={ScholarshipApply_module_css_1.default.ReviewMilestones}>
											{formValues.milestones.map(function (milestone, index) { return (<div key={"review-".concat(index)} className={ScholarshipApply_module_css_1.default.ReviewMilestone}>
													<strong>Milestone {index + 1}</strong>
													<p>
														{milestone.description || "Description pending"}
													</p>
													<span>{milestone.dueDate || "Date pending"}</span>
												</div>); })}
										</div>
									</div>
								</div>

								<label className={ScholarshipApply_module_css_1.default.CheckboxRow}>
									<input type="checkbox" checked={formValues.walletConfirmed} onChange={function (event) {
                return updateField("walletConfirmed", event.target.checked);
            }}/>
									<span>
										I confirm that{" "}
										{address ? (0, scholarshipApplications_1.shortenAddress)(address) : "the connected wallet"}
										should receive scholarship disbursements.
									</span>
								</label>
								{errors.walletConfirmed && (<p className={ScholarshipApply_module_css_1.default.ErrorText}>{errors.walletConfirmed}</p>)}
								{submitError && (<p className={ScholarshipApply_module_css_1.default.ErrorText}>{submitError}</p>)}
							</div>)}

						{stepIndex === 4 && confirmationProposal && (<div className={ScholarshipApply_module_css_1.default.StepPanel}>
								<h2>Confirmation</h2>
								<p className={ScholarshipApply_module_css_1.default.StepDescription}>
									Your proposal has been recorded and linked back into the DAO
									view.
								</p>
								<div className={ScholarshipApply_module_css_1.default.StatGrid}>
									<div className={ScholarshipApply_module_css_1.default.StatCard}>
										<span className={ScholarshipApply_module_css_1.default.StatLabel}>Proposal ID</span>
										<strong>{confirmationProposal.proposalId}</strong>
									</div>
									<div className={ScholarshipApply_module_css_1.default.StatCard}>
										<span className={ScholarshipApply_module_css_1.default.StatLabel}>Submission source</span>
										<strong>{confirmationProposal.source}</strong>
									</div>
									<div className={"".concat(ScholarshipApply_module_css_1.default.StatCard, " ").concat(ScholarshipApply_module_css_1.default.FullWidth)}>
										<span className={ScholarshipApply_module_css_1.default.StatLabel}>Transaction hash</span>
										<strong>
											{(_a = confirmationProposal.txHash) !== null && _a !== void 0 ? _a : "No hash returned in fallback mode"}
										</strong>
									</div>
								</div>
								<div className={ScholarshipApply_module_css_1.default.ActionRow}>
									<react_router_dom_1.Link to={confirmationProposal.daoPath}>
										<design_system_1.Button variant="primary" size="md">
											View on DAO page
										</design_system_1.Button>
									</react_router_dom_1.Link>
									{transactionUrl && (<react_router_dom_1.Link to={transactionUrl} target="_blank">
											<design_system_1.Button variant="tertiary" size="md">
												Open transaction
											</design_system_1.Button>
										</react_router_dom_1.Link>)}
									<design_system_1.Button variant="secondary" size="md" onClick={resetApplication}>
										Start another proposal
									</design_system_1.Button>
								</div>
							</div>)}

						{stepIndex < 4 && (<div className={ScholarshipApply_module_css_1.default.ActionRow}>
								<design_system_1.Button variant="tertiary" size="md" onClick={function () {
                return setStepIndex(function (current) { return Math.max(current - 1, 0); });
            }} disabled={stepIndex === 0 || isSubmitting}>
									Back
								</design_system_1.Button>
								{stepIndex < 3 ? (<design_system_1.Button variant="primary" size="md" onClick={goToNextStep} disabled={isSubmitting}>
										Continue
									</design_system_1.Button>) : (<design_system_1.Button variant="primary" size="md" onClick={handleSubmit} disabled={isSubmitting}>
										{isSubmitting ? "Submitting..." : "Sign & submit"}
									</design_system_1.Button>)}
							</div>)}
					</design_system_1.Card>
				</div>
			</div>
		</div>);
}
