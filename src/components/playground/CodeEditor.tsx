import React, { useState, useEffect, useCallback } from "react";
import { Exercise, ValidationResult } from "./types";

interface CodeEditorProps {
  exercise: Exercise;
  onComplete?: (exerciseId: string) => void;
  className?: string;
}

export const CodeEditor: React.FC<CodeEditorProps> = ({
  exercise,
  onComplete,
  className = "",
}) => {
  const storageKey = `learnvault_exercise_${exercise.id}`;

  const [code, setCode] = useState<string>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      return saved ?? exercise.starterCode;
    } catch {
      return exercise.starterCode;
    }
  });

  const [hintIndex, setHintIndex] = useState<number>(0);
  const [validationResults, setValidationResults] = useState<ValidationResult[] | null>(null);
  const [isCompleted, setIsCompleted] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  // Sync to local storage on edits
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, code);
    } catch {
      // Ignore storage errors in restrictive environments
    }
  }, [code, storageKey]);

  const handleReset = useCallback(() => {
    setCode(exercise.starterCode);
    setValidationResults(null);
    setIsCompleted(false);
  }, [exercise.starterCode]);

  const handleCopy = useCallback(async () => {
    try {
      const fullSnippet = `${exercise.preamble}\n${code}\n${exercise.postscript}`;
      await navigator.clipboard.writeText(fullSnippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
    }
  }, [code, exercise.preamble, exercise.postscript]);

  const handleShowHint = useCallback(() => {
    if (hintIndex < exercise.hints.length) {
      setHintIndex((prev) => prev + 1);
    }
  }, [hintIndex, exercise.hints.length]);

  const handleValidate = useCallback(() => {
    const results: ValidationResult[] = exercise.rules.map((rule) => {
      const passed = rule.validate(code);
      return {
        ruleId: rule.id,
        passed,
        message: passed ? rule.description : rule.failureMessage,
      };
    });

    setValidationResults(results);

    const allPassed = results.every((r) => r.passed);
    setIsCompleted(allPassed);

    if (allPassed) {
      onComplete?.(exercise.id);
    }
  }, [code, exercise.rules, exercise.id, onComplete]);

  return (
    <div
      className={`border border-white/10 rounded-2xl bg-slate-900 text-slate-100 p-6 flex flex-col gap-5 ${className}`}
      data-testid="soroban-code-editor"
    >
      {/* Exercise Header */}
      <div className="flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-bold text-white">{exercise.title}</h3>
          <span className="text-xs px-2.5 py-1 rounded-full bg-indigo-950 text-indigo-300 border border-indigo-700/50">
            Guided Pattern Check
          </span>
        </div>
        <p className="text-sm text-slate-300">{exercise.description}</p>
        <p className="text-xs text-slate-400 italic">
          Note: This editor performs a guided structural check against expected Soroban patterns (not live compilation).
        </p>
      </div>

      {/* Editor Surface */}
      <div className="rounded-xl overflow-hidden border border-slate-700/60 bg-slate-950 font-mono text-xs sm:text-sm">
        {/* Read-Only Preamble */}
        <div className="bg-slate-900/80 px-4 py-2 border-b border-slate-800 text-slate-400 select-none">
          <span className="text-xs uppercase tracking-wider font-semibold text-slate-500 mb-1 block">
            Read-only Contract Scaffold
          </span>
          <pre className="overflow-x-auto whitespace-pre font-mono text-slate-400">
            {exercise.preamble}
          </pre>
        </div>

        {/* Editable Workspace */}
        <div className="p-2 relative bg-slate-950">
          <label htmlFor={`editor-${exercise.id}`} className="sr-only">
            Soroban Rust Code Input for {exercise.title}
          </label>
          <textarea
            id={`editor-${exercise.id}`}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            rows={Math.max(6, code.split("\n").length + 1)}
            aria-label={`Rust Editor for ${exercise.title}`}
            spellCheck={false}
            className="w-full bg-transparent text-emerald-300 font-mono focus:outline-none focus:ring-1 focus:ring-emerald-500 rounded p-2 resize-y whitespace-pre"
          />
        </div>

        {/* Read-Only Postscript */}
        <div className="bg-slate-900/80 px-4 py-2 border-t border-slate-800 text-slate-400 select-none">
          <pre className="overflow-x-auto whitespace-pre font-mono text-slate-400">
            {exercise.postscript}
          </pre>
        </div>
      </div>

      {/* Action Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleReset}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 transition"
          >
            Reset Starter
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 transition"
          >
            {copied ? "Copied!" : "Copy Full Code"}
          </button>
          {exercise.hints.length > 0 && hintIndex < exercise.hints.length && (
            <button
              type="button"
              onClick={handleShowHint}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-amber-300 bg-amber-950/60 border border-amber-800 hover:bg-amber-900/60 transition"
            >
              Show Hint ({hintIndex + 1}/{exercise.hints.length})
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={handleValidate}
          className="px-5 py-2 rounded-xl text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg transition"
        >
          Check My Solution
        </button>
      </div>

      {/* Revealed Hints */}
      {hintIndex > 0 && (
        <div className="flex flex-col gap-2 p-3 rounded-xl bg-amber-950/30 border border-amber-800/40 text-xs text-amber-200">
          <span className="font-bold text-amber-300">Hints:</span>
          {exercise.hints.slice(0, hintIndex).map((hint, idx) => (
            <p key={idx} className="pl-2 border-l border-amber-600">
              💡 {hint}
            </p>
          ))}
        </div>
      )}

      {/* Validation Feedback & Screen Reader Live Region */}
      <div
        role="status"
        aria-live="polite"
        className="flex flex-col gap-2"
        data-testid="validation-feedback"
      >
        {validationResults && (
          <div className="flex flex-col gap-2 p-4 rounded-xl bg-slate-950/80 border border-slate-800">
            <span className="font-semibold text-sm text-slate-200">
              {isCompleted
                ? "🎉 Great work! Your code matches what this exercise expects."
                : "Checking your solution:"}
            </span>
            <ul className="flex flex-col gap-1.5 text-xs">
              {validationResults.map((res) => (
                <li
                  key={res.ruleId}
                  className={`flex items-start gap-2 ${
                    res.passed ? "text-emerald-400" : "text-rose-400"
                  }`}
                >
                  <span>{res.passed ? "✓" : "✗"}</span>
                  <span>{res.message}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
};
