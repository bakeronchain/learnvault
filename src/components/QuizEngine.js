"use strict";
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
var react_1 = require("react");
var QuizEngine = function (_a) {
    var questions = _a.questions, _b = _a.passingScore, passingScore = _b === void 0 ? 80 : _b, onPass = _a.onPass, onFail = _a.onFail;
    var _c = (0, react_1.useState)(0), currentQuestionIndex = _c[0], setCurrentQuestionIndex = _c[1];
    var _d = (0, react_1.useState)([]), selectedOptions = _d[0], setSelectedOptions = _d[1];
    var _e = (0, react_1.useState)(false), showFeedback = _e[0], setShowFeedback = _e[1];
    var _f = (0, react_1.useState)(false), isCorrect = _f[0], setIsCorrect = _f[1];
    var _g = (0, react_1.useState)(0), score = _g[0], setScore = _g[1];
    var _h = (0, react_1.useState)(false), quizEnded = _h[0], setQuizEnded = _h[1];
    var _j = (0, react_1.useState)(30), timer = _j[0], setTimer = _j[1];
    var currentQuestion = questions[currentQuestionIndex];
    var handleNext = (0, react_1.useCallback)(function () {
        setShowFeedback(false);
        setSelectedOptions([]);
        if (currentQuestionIndex < questions.length - 1) {
            setCurrentQuestionIndex(function (i) { return i + 1; });
        }
        else {
            setQuizEnded(true);
            var finalPercentage = (score / questions.length) * 100;
            if (finalPercentage >= passingScore) {
                onPass();
            }
            else {
                onFail();
            }
        }
    }, [
        currentQuestionIndex,
        questions.length,
        score,
        passingScore,
        onPass,
        onFail,
    ]);
    (0, react_1.useEffect)(function () {
        if (!currentQuestion || quizEnded || showFeedback)
            return;
        if (timer === 0) {
            handleNext();
            return;
        }
        var interval = setInterval(function () { return setTimer(function (t) { return t - 1; }); }, 1000);
        return function () { return clearInterval(interval); };
    }, [timer, quizEnded, showFeedback, currentQuestion, handleNext]);
    (0, react_1.useEffect)(function () {
        setTimer(30);
    }, [currentQuestionIndex]);
    var handleOptionToggle = function (index) {
        if (!currentQuestion || showFeedback)
            return;
        if (currentQuestion.isMultiSelect) {
            setSelectedOptions(function (prev) {
                return prev.includes(index)
                    ? prev.filter(function (i) { return i !== index; })
                    : __spreadArray(__spreadArray([], prev, true), [index], false);
            });
        }
        else {
            setSelectedOptions([index]);
        }
    };
    var handleSubmit = function () {
        if (!currentQuestion || selectedOptions.length === 0)
            return;
        var correct = false;
        if (currentQuestion.isMultiSelect) {
            var correctIndices_1 = currentQuestion.correctIndex;
            correct =
                selectedOptions.length === correctIndices_1.length &&
                    selectedOptions.every(function (val) { return correctIndices_1.includes(val); });
        }
        else {
            correct = selectedOptions[0] === currentQuestion.correctIndex;
        }
        setIsCorrect(correct);
        setShowFeedback(true);
        if (correct)
            setScore(function (s) { return s + 1; });
    };
    if (quizEnded) {
        var finalPercentage = (score / questions.length) * 100;
        var passed = finalPercentage >= passingScore;
        return (<div className="text-center p-20 glass-card rounded-[4rem] max-w-2xl mx-auto border border-white/10 shadow-2xl animate-in zoom-in duration-1000">
				<h2 className="text-4xl font-black mb-10 text-white tracking-tighter">
					Assessment Complete
				</h2>
				<div className="w-56 h-56 border-[12px] border-brand-cyan/20 rounded-full flex items-center justify-center mx-auto mb-10 relative">
					<div className="absolute inset-0 border-[12px] border-brand-cyan rounded-full animate-pulse opacity-50 shadow-[0_0_30px_rgba(0,210,255,0.4)]"/>
					<span className="text-6xl font-black text-gradient">
						{Math.round(finalPercentage)}%
					</span>
				</div>
				<p className="text-xl text-white/50 mb-12 leading-relaxed max-w-md mx-auto">
					{passed
                ? "Extraordinary! You've successfully cleared the verification process. Your reputation has increased."
                : "Verification failed. Review the technical manual and attempt again to secure your credentials."}
				</p>
				<button onClick={function () { return window.location.reload(); }} className="px-12 py-5 bg-white text-black rounded-2xl font-black text-lg uppercase tracking-widest hover:scale-105 transition-all shadow-2xl active:scale-95">
					{passed ? "Proceed to Finalize" : "Re-launch Assessment"}
				</button>
			</div>);
    }
    if (!currentQuestion)
        return null;
    return (<div className="max-w-4xl mx-auto glass-card p-16 rounded-[4rem] relative overflow-hidden animate-in fade-in slide-in-from-bottom-12 duration-1000" role="form" aria-label="Lesson Quiz">
			{/* Immersive Accents */}
			<div className={"absolute top-0 left-0 w-full h-1 transition-all duration-1000 ".concat(showFeedback ? (isCorrect ? "bg-brand-emerald" : "bg-brand-purple") : "bg-brand-cyan/20")}/>

			<div className="flex justify-between items-center mb-16">
				<div className="flex-1 mr-12">
					<div className="flex justify-between items-end mb-4">
						<p className="text-[10px] text-white/30 font-black uppercase tracking-[4px]">
							Step {currentQuestionIndex + 1} of {questions.length}
						</p>
						<p className="text-[10px] text-white/30 font-black uppercase tracking-[4px]">
							Verified Environment
						</p>
					</div>
					<div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
						<div className="h-full bg-linear-to-r from-brand-cyan to-brand-blue transition-all duration-1000 ease-out shadow-[0_0_15px_rgba(0,210,255,0.5)]" style={{
            width: "".concat(((currentQuestionIndex + 1) / questions.length) * 100, "%"),
        }}/>
					</div>
				</div>
				<div className={"text-2xl font-black tabular-nums transition-colors duration-300 ".concat(timer < 10 ? "text-brand-purple animate-pulse" : "text-brand-cyan")} aria-live="polite">
					{timer < 10 ? "0" : ""}
					{timer}
				</div>
			</div>

			<h3 className="text-3xl font-black mb-16 leading-tight tracking-tight">
				{currentQuestion.text}
			</h3>

			<div className="flex flex-col gap-5 mb-16">
				{currentQuestion.options.map(function (option, index) { return (<button key={index} className={"p-7 text-left rounded-3xl border transition-all duration-500 relative overflow-hidden group ".concat(selectedOptions.includes(index)
                ? "bg-brand-cyan/5 border-brand-cyan text-brand-cyan shadow-[0_0_30px_rgba(0,210,255,0.1)]"
                : "bg-white/5 border-white/5 text-white/50 hover:bg-white/[0.08] hover:border-white/20 hover:text-white", " ").concat(showFeedback ? "cursor-default" : "cursor-pointer active:scale-[0.98]")} onClick={function () { return handleOptionToggle(index); }} disabled={showFeedback}>
						{selectedOptions.includes(index) && (<div className="absolute top-0 right-0 p-4 opacity-20 transform translate-x-4 -translate-y-4 group-hover:translate-x-0 group-hover:translate-y-0 transition-transform">
								<div className="text-4xl font-black">✓</div>
							</div>)}
						<span className={"text-lg font-bold group-hover:translate-x-2 transition-transform duration-500 inline-block"}>
							{option}
						</span>
					</button>); })}
			</div>

			<div className="flex justify-between items-center">
				<div className="flex-1">
					{showFeedback && (<p className={"text-xl font-black tracking-tighter animate-in slide-in-from-left-4 duration-500 ".concat(isCorrect ? "text-brand-emerald" : "text-brand-purple")}>
							{isCorrect ? "MISSION SUCCESS ✓" : "INTEGRITY COMPROMISED ✖"}
						</p>)}
				</div>
				<div className="flex items-center gap-8">
					{!showFeedback ? (<button className="px-12 py-5 bg-linear-to-r from-brand-cyan to-brand-blue rounded-2xl font-black text-sm uppercase tracking-widest shadow-2xl shadow-brand-cyan/20 disabled:opacity-20 disabled:scale-95 hover:scale-105 active:scale-95 transition-all" onClick={handleSubmit} disabled={selectedOptions.length === 0}>
							Submit Verify
						</button>) : (<button className="px-12 py-5 bg-white text-black rounded-2xl font-black text-sm uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-2xl" onClick={handleNext}>
							{currentQuestionIndex === questions.length - 1
                ? "End Assessment"
                : "Proceed Next"}
						</button>)}
				</div>
			</div>
		</div>);
};
exports.default = QuizEngine;
