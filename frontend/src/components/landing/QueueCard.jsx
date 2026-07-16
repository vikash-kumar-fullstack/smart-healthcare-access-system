import React from "react";
import { Users, Clock, ArrowRight, UserCheck } from "lucide-react";

export default function QueueCard({
  position = 3,
  eta = "18 min",
  doctorName = "Dr. Vikash Kumar",
  specialization = "Cardiologist",
  status = "Active",
  className = "",
}) {
  return (
    <div
      className={`relative bg-white/90 backdrop-blur-md rounded-2xl border border-slate-200/50 shadow-[0_8px_30px_rgb(0,0,0,0.03)] p-4 flex flex-col gap-3 overflow-hidden group hover:border-[#14B8A6]/30 transition-all duration-300 ${className}`}
    >
      {/* Decorative ticket line */}
      <div className="absolute top-1/2 left-0 right-0 border-t border-dashed border-slate-200" />
      
      {/* Top half: Position and Doctor */}
      <div className="flex justify-between items-center z-10 pb-1">
        <div>
          <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
            Current Queue
          </p>
          <h5 className="text-sm font-bold text-slate-800 leading-tight">
            {doctorName}
          </h5>
          <p className="text-[11px] text-slate-500">{specialization}</p>
        </div>
        
        {/* Large ticket position */}
        <div className="text-right">
          <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
            Your Spot
          </p>
          <span className="text-3xl font-extrabold text-[#0E7490] leading-none">
            #{position}
          </span>
        </div>
      </div>
      
      {/* Bottom half: Wait time and status */}
      <div className="flex justify-between items-center z-10 pt-1">
        <div className="flex items-center gap-1.5 text-slate-700">
          <Clock className="h-4 w-4 text-[#14B8A6]" />
          <span className="text-xs font-bold">{eta} ETA</span>
        </div>
        
        {/* Doctor Status Badge */}
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Doctor Active
        </span>
      </div>
    </div>
  );
}
