import React from "react";

export default function StatsCard({
  value = "100+",
  label = "Hospitals",
  icon: Icon,
  className = "",
}) {
  return (
    <div
      className={`group bg-white rounded-2xl p-6 border border-slate-200/50 shadow-[0_4px_20px_rgba(0,0,0,0.02)] hover:-translate-y-2 hover:shadow-[0_20px_40px_rgba(14,116,144,0.06)] hover:border-[#0E7490]/25 transition-all duration-300 flex flex-col justify-center items-center text-center overflow-hidden relative ${className}`}
    >
      {/* Decorative backdrop shape */}
      <div className="absolute -bottom-10 -right-10 w-24 h-24 bg-[#14B8A6]/5 rounded-full blur-xl group-hover:scale-150 transition-all duration-500" />
      
      {Icon && (
        <div className="mb-3 p-2.5 rounded-xl bg-slate-50 text-[#0E7490] group-hover:bg-[#0E7490] group-hover:text-white transition-colors duration-300">
          <Icon className="h-5 w-5" />
        </div>
      )}
      
      <span className="text-3xl md:text-4xl font-extrabold bg-gradient-to-r from-[#0E7490] to-[#14B8A6] bg-clip-text text-transparent tracking-tight">
        {value}
      </span>
      
      <span className="text-sm font-semibold text-slate-500 mt-2 tracking-wide group-hover:text-slate-800 transition-colors duration-300">
        {label}
      </span>
    </div>
  );
}
