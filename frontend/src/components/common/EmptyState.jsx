import React from "react";
import { Inbox, AlertCircle, RefreshCw, WifiOff, ShieldAlert } from "lucide-react";

export default function EmptyState({
  title = "No Data Found",
  description = "There are no records matching your criteria at this moment.",
  variant = "empty", // empty, error, offline, unauthorized
  actionLabel = "Retry",
  onAction = null,
  className = ""
}) {
  const icons = {
    empty: Inbox,
    error: AlertCircle,
    offline: WifiOff,
    unauthorized: ShieldAlert
  };

  const Icon = icons[variant] || icons.empty;

  const accentColors = {
    empty: "text-[#14B8A6] bg-teal-50 border-teal-100",
    error: "text-rose-600 bg-rose-50 border-rose-100",
    offline: "text-amber-600 bg-amber-50 border-amber-100",
    unauthorized: "text-indigo-600 bg-indigo-50 border-indigo-100"
  };

  return (
    <div className={`flex flex-col items-center justify-center text-center p-8 border border-dashed border-slate-200 bg-white rounded-3xl max-w-lg mx-auto my-6 shadow-sm ${className}`}>
      <div className={`p-4 rounded-2xl border ${accentColors[variant] || accentColors.empty} mb-4 flex items-center justify-center`}>
        <Icon className="w-8 h-8" />
      </div>
      <h3 className="text-sm font-extrabold text-slate-800 tracking-tight mb-2">
        {title}
      </h3>
      <p className="text-xs text-slate-500 leading-relaxed max-w-sm mb-5">
        {description}
      </p>
      {onAction && (
        <button
          onClick={onAction}
          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-[#14B8A6] hover:bg-[#0f8b7d] active:scale-95 shadow-sm shadow-teal-900/10 cursor-pointer transition-all duration-150"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          {actionLabel}
        </button>
      )}
    </div>
  );
}
