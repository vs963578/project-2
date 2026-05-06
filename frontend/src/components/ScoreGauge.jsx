import React from "react";

export const ScoreGauge = ({ score = 0, size = 180 }) => {
  const radius = (size - 20) / 2;
  const cx = size / 2;
  const cy = size / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.max(0, Math.min(100, score));
  const offset = circumference - (pct / 100) * circumference;

  const color =
    pct >= 80 ? "#16a34a" : pct >= 60 ? "#2563eb" : pct >= 40 ? "#f59e0b" : "#dc2626";

  return (
    <div className="relative inline-flex items-center justify-center" data-testid="qa-score-gauge">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={cx} cy={cy} r={radius} stroke="#e4e4e7" strokeWidth="10" fill="none" />
        <circle
          cx={cx}
          cy={cy}
          r={radius}
          stroke={color}
          strokeWidth="10"
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 0.8s ease-out" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className="text-5xl font-bold tracking-tight font-display text-zinc-950" data-testid="qa-score-value">
          {pct}
        </div>
        <div className="text-xs uppercase tracking-wider text-zinc-500 font-semibold mt-1">QA Score</div>
      </div>
    </div>
  );
};
