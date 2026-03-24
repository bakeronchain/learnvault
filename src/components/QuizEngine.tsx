import React, { useState, useEffect, useCallback } from "react"

interface Question {
	id: number
	text: string
	options: string[]
	correctIndex: number | number[]
	isMultiSelect?: boolean
}

interface QuizEngineProps {
	questions: Question[]
	passingScore?: number // percentage, e.g. 80
	onPass: () => void
	onFail: () => void
}

const QuizEngine: React.FC<QuizEngineProps> = ({
	questions,
	passingScore = 80,
	onPass,
	onFail,
}) => {
	const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
	const [selectedOptions, setSelectedOptions] = useState<number[]>([])
	const [showFeedback, setShowFeedback] = useState(false)
	const [isCorrect, setIsCorrect] = useState(false)
	const [score, setScore] = useState(0)
	const [quizEnded, setQuizEnded] = useState(false)
	const [timer, setTimer] = useState(30)

	const currentQuestion = questions[currentQuestionIndex]

	const handleNext = useCallback(() => {
		setShowFeedback(false)
		setSelectedOptions([])
		if (currentQuestionIndex < questions.length - 1) {
			setCurrentQuestionIndex((i) => i + 1)
		} else {
			setQuizEnded(true)
			const finalPercentage = (score / questions.length) * 100
			if (finalPercentage >= passingScore) {
				onPass()
			} else {
				onFail()
			}
		}
	}, [
		currentQuestionIndex,
		questions.length,
		score,
		passingScore,
		onPass,
		onFail,
	])

	useEffect(() => {
		if (!currentQuestion || quizEnded || showFeedback) return
		if (timer === 0) {
			handleNext()
			return
		}
		const interval = setInterval(() => setTimer((t) => t - 1), 1000)
		return () => clearInterval(interval)
	}, [timer, quizEnded, showFeedback, currentQuestion, handleNext])

	useEffect(() => {
		setTimer(30)
	}, [currentQuestionIndex])

	const handleOptionToggle = (index: number) => {
		if (!currentQuestion || showFeedback) return
		if (currentQuestion.isMultiSelect) {
			setSelectedOptions((prev) =>
				prev.includes(index)
					? prev.filter((i) => i !== index)
					: [...prev, index],
			)
		} else {
			setSelectedOptions([index])
		}
	}

	const handleSubmit = () => {
		if (!currentQuestion || selectedOptions.length === 0) return

		let correct = false
		if (currentQuestion.isMultiSelect) {
			const correctIndices = currentQuestion.correctIndex as number[]
			correct =
				selectedOptions.length === correctIndices.length &&
				selectedOptions.every((val) => correctIndices.includes(val))
		} else {
			correct = selectedOptions[0] === currentQuestion.correctIndex
		}

		setIsCorrect(correct)
		setShowFeedback(true)
		if (correct) setScore((s) => s + 1)
	}

	if (quizEnded) {
		const finalPercentage = (score / questions.length) * 100
		const passed = finalPercentage >= passingScore
		return (
			<div className="text-center p-20 glass-card rounded-[4rem] max-w-2xl mx-auto border border-white/10 shadow-2xl animate-in zoom-in duration-1000">
				<h2 className="text-4xl font-black mb-10 text-white tracking-tighter">
					Assessment Complete
				</h2>
				<div className="w-56 h-56 border-[12px] border-brand-cyan/20 rounded-full flex items-center justify-center mx-auto mb-10 relative">
					<div className="absolute inset-0 border-[12px] border-brand-cyan rounded-full animate-pulse opacity-50 shadow-[0_0_30px_rgba(0,210,255,0.4)]" />
					<span className="text-6xl font-black text-gradient">
						{Math.round(finalPercentage)}%
					</span>
				</div>
				<p className="text-xl text-white/50 mb-12 leading-relaxed max-w-md mx-auto">
					{passed
						? "Extraordinary! You've successfully cleared the verification process. Your reputation has increased."
						: "Verification failed. Review the technical manual and attempt again to secure your credentials."}
				</p>
				<button
					onClick={() => window.location.reload()}
					className="px-12 py-5 bg-white text-black rounded-2xl font-black text-lg uppercase tracking-widest hover:scale-105 transition-all shadow-2xl active:scale-95"
				>
					{passed ? "Proceed to Finalize" : "Re-launch Assessment"}
				</button>
			</div>
		)
	}

	if (!currentQuestion) return null

	return (
		<div
			className="max-w-4xl mx-auto glass-card p-16 rounded-[4rem] relative overflow-hidden animate-in fade-in slide-in-from-bottom-12 duration-1000"
			role="form"
			aria-label="Lesson Quiz"
		>
			{/* Immersive Accents */}
			<div
				className={`absolute top-0 left-0 w-full h-1 transition-all duration-1000 ${showFeedback ? (isCorrect ? "bg-brand-emerald" : "bg-brand-purple") : "bg-brand-cyan/20"}`}
			/>

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
						<div
							className="h-full bg-linear-to-r from-brand-cyan to-brand-blue transition-all duration-1000 ease-out shadow-[0_0_15px_rgba(0,210,255,0.5)]"
							style={{
								width: `${((currentQuestionIndex + 1) / questions.length) * 100}%`,
							}}
						/>
					</div>
				</div>
				<div
					className={`text-2xl font-black tabular-nums transition-colors duration-300 ${timer < 10 ? "text-brand-purple animate-pulse" : "text-brand-cyan"}`}
					aria-live="polite"
				>
					{timer < 10 ? "0" : ""}
					{timer}
				</div>
			</div>

			<h3 className="text-3xl font-black mb-16 leading-tight tracking-tight">
				{currentQuestion.text}
			</h3>

			<div className="flex flex-col gap-5 mb-16">
				{currentQuestion.options.map((option, index) => (
					<button
						key={index}
						className={`p-7 text-left rounded-3xl border transition-all duration-500 relative overflow-hidden group ${
							selectedOptions.includes(index)
								? "bg-brand-cyan/5 border-brand-cyan text-brand-cyan shadow-[0_0_30px_rgba(0,210,255,0.1)]"
								: "bg-white/5 border-white/5 text-white/50 hover:bg-white/[0.08] hover:border-white/20 hover:text-white"
						} ${showFeedback ? "cursor-default" : "cursor-pointer active:scale-[0.98]"}`}
						onClick={() => handleOptionToggle(index)}
						disabled={showFeedback}
					>
						{selectedOptions.includes(index) && (
							<div className="absolute top-0 right-0 p-4 opacity-20 transform translate-x-4 -translate-y-4 group-hover:translate-x-0 group-hover:translate-y-0 transition-transform">
								<div className="text-4xl font-black">✓</div>
							</div>
						)}
						<span
							className={`text-lg font-bold group-hover:translate-x-2 transition-transform duration-500 inline-block`}
						>
							{option}
						</span>
					</button>
				))}
			</div>

			<div className="flex justify-between items-center">
				<div className="flex-1">
					{showFeedback && (
						<p
							className={`text-xl font-black tracking-tighter animate-in slide-in-from-left-4 duration-500 ${isCorrect ? "text-brand-emerald" : "text-brand-purple"}`}
						>
							{isCorrect ? "MISSION SUCCESS ✓" : "INTEGRITY COMPROMISED ✖"}
						</p>
					)}
				</div>
				<div className="flex items-center gap-8">
					{!showFeedback ? (
						<button
							className="px-12 py-5 bg-linear-to-r from-brand-cyan to-brand-blue rounded-2xl font-black text-sm uppercase tracking-widest shadow-2xl shadow-brand-cyan/20 disabled:opacity-20 disabled:scale-95 hover:scale-105 active:scale-95 transition-all"
							onClick={handleSubmit}
							disabled={selectedOptions.length === 0}
						>
							Submit Verify
						</button>
					) : (
						<button
							className="px-12 py-5 bg-white text-black rounded-2xl font-black text-sm uppercase tracking-widest hover:scale-105 active:scale-95 transition-all shadow-2xl"
							onClick={handleNext}
						>
							{currentQuestionIndex === questions.length - 1
								? "End Assessment"
								: "Proceed Next"}
						</button>
					)}
				</div>
			</div>
		</div>
	)
}

export default QuizEngine
