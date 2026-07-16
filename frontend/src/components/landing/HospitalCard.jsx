import React from "react";
import { Hospital, Clock, UserCheck, MapPin, ChevronRight } from "lucide-react";

export default function HospitalCard({
  name = "Patna Medical College Hospital (PMCH)",
  location = "Ashok Rajpath, Patna",
  queueTime = "12 min",
  doctorsAvailable = 8,
  image,
  className = "",
  onClick,
}) {
  return (
    <div
      onClick={onClick}
      className={`group relative bg-white/80 backdrop-blur-md rounded-2xl p-5 border border-slate-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_20px_40px_rgba(14,116,144,0.08)] hover:border-[#0E7490]/30 transition-all duration-300 cursor-pointer overflow-hidden ${className}`}
    >
      {/* Glow highlight */}
      <div className="absolute -right-20 -top-20 w-40 h-40 bg-gradient-to-br from-[#0E7490]/5 to-transparent rounded-full blur-2xl group-hover:scale-150 transition-all duration-500" />

      <div className="flex gap-4">
        {/* Hospital Thumbnail */}
        <div className="w-16 h-16 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center shrink-0 overflow-hidden text-[#0E7490]">
          {image ? (
            <img src={image} alt={name} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" />
          ) : (
            <Hospital className="h-7 w-7" />
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <h4 className="text-base font-bold text-slate-800 truncate group-hover:text-[#0E7490] transition-colors">
            {name}
          </h4>
          <p className="text-xs text-slate-550 flex items-center gap-1 mt-1">
            <MapPin className="h-3 w-3 text-slate-405 text-[#14B8A6]" />
            <span className="truncate">{location}</span>
          </p>

          {/* Quick Metrics */}
          <div className="flex flex-wrap items-center gap-2 mt-3.5">
            {/* Live Queue Time */}
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-[#DFF8F6] text-[#0E7490]">
              <span className="w-1.5 h-1.5 rounded-full bg-[#14B8A6] animate-pulse" />
              Queue: {queueTime}
            </span>

            {/* Doctor Avail */}
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-slate-50 text-slate-650 border border-slate-100">
              <UserCheck className="h-3.5 w-3.5 text-emerald-600" />
              {doctorsAvailable} Doctors Available
            </span>
          </div>
        </div>

        {/* Action arrow */}
        <div className="flex items-center justify-center w-8 h-8 rounded-full bg-slate-50 text-slate-400 group-hover:bg-[#0E7490] group-hover:text-white transition-all duration-300 self-center">
          <ChevronRight className="h-4 w-4" />
        </div>
      </div>
    </div>
  );
}
