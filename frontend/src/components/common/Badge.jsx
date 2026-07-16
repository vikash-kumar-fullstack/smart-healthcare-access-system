import React from "react";

export default function Badge({
  label,
  variant = "info", // success, danger, warning, info, neutral, primary
  icon: Icon = null,
  className = ""
}) {
  const baseClasses = "inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-extrabold tracking-wide border uppercase shrink-0";

  const variants = {
    primary: "bg-teal-50 border-teal-200/50 text-[#14B8A6]",
    success: "bg-emerald-50 border-emerald-200/50 text-emerald-700",
    danger: "bg-rose-50 border-rose-250/50 text-rose-700",
    warning: "bg-amber-50 border-amber-250/50 text-amber-700",
    info: "bg-sky-50 border-sky-250/50 text-sky-700",
    neutral: "bg-slate-100 border-slate-200/60 text-slate-700"
  };

  return (
    <span className={`${baseClasses} ${variants[variant] || variants.info} ${className}`}>
      {Icon && <Icon className="w-3 h-3 shrink-0" />}
      <span>{label}</span>
    </span>
  );
}