import React from "react";

export default function ProgressRing({
  value = 0,
  max = 100,
  size = 60,
  strokeWidth = 6,
  variant = "primary", // primary, success, warning, danger
  className = ""
}) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percentage / 100) * circumference;

  const colors = {
    primary: "stroke-[#14B8A6]",
    success: "stroke-emerald-500",
    warning: "stroke-amber-500",
    danger: "stroke-rose-500"
  };

  const textColors = {
    primary: "text-[#14B8A6]",
    success: "text-emerald-700",
    warning: "text-amber-700",
    danger: "text-rose-700"
  };

  return (
    <div className={`relative flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
      <svg className="transform -rotate-90 w-full h-full">
        {/* Track circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          className="stroke-slate-100 fill-none"
          strokeWidth={strokeWidth}
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          className={`fill-none transition-all duration-300 ${colors[variant] || colors.primary}`}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      {/* Label overlay */}
      <span className={`absolute text-[10px] font-black tracking-tighter ${textColors[variant] || textColors.primary}`}>
        {Math.round(percentage)}%
      </span>
    </div>
  );
}

export default function ProgressBar({
  value = 0,
  max = 100,
  variant = "primary",
  className = ""
}) {
  const percentage = Math.min(Math.max((value / max) * 100, 0), 100);

  const colors = {
    primary: "bg-[#14B8A6]",
    success: "bg-emerald-500",
    warning: "bg-amber-500",
    danger: "bg-rose-500"
  };

  return (
    <div className={`w-full bg-slate-100 rounded-full h-2 overflow-hidden ${className}`}>
      <div
        className={`h-full rounded-full transition-all duration-300 ${colors[variant] || colors.primary}`}
        style={{ width: `${percentage}%` }}
      />
    </div>
  );
}
