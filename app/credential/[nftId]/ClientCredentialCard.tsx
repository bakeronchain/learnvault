"use strict";
"use client";

import React, { useState } from "react";

interface ClientCredentialCardProps {
  address: string;
}

export function ClientCredentialCard({ address }: ClientCredentialCardProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy text: ", err);
    }
  };

  return (
    <div className="flex items-center gap-2 bg-slate-950 p-2.5 rounded-lg border border-slate-800">
      <span className="font-mono text-xs text-slate-300 break-all select-all flex-1">
        {address}
      </span>
      <button
        onClick={handleCopy}
        className={`flex-shrink-0 flex items-center justify-center p-1.5 rounded transition-all duration-200 ${
          copied
            ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"
            : "bg-slate-800 hover:bg-slate-700 text-slate-400 border border-slate-700"
        }`}
        aria-label={copied ? "Copied scholar address" : "Copy scholar address"}
      >
        {copied ? (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
            />
          </svg>
        )}
      </button>
    </div>
  );
}
