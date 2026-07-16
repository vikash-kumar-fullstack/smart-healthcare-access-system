import React from "react";
import { Star, Clock, Users, ArrowRight } from "lucide-react";

export default function DoctorCard({
  name = "Dr. Vikash Kumar",
  specialization = "Cardiologist",
  rating = 4.9,
  experience = "12 yrs exp",
  patientCount = 4,
  estWait = "15 min",
  status = "active",
  className = "",
}) {
  return (
    <div
      className={`group bg-white rounded-2xl p-5 border border-slate-200/60 shadow-[0_8px_30px_rgb(0,0,0,0.03)] hover:shadow-[0_20px_40px_rgba(0,0,0,0.06)] hover:border-slate-300 transition-all duration-300 ${className}`}
    >
      <div className="flex justify-between items-start">
        {/* Photo + Details */}
        <div className="flex gap-3">
          <div className="w-12 h-12 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-center font-bold text-slate-700 uppercase group-hover:bg-[#0E7490] group-hover:text-white transition-colors duration-300">
            {name.split(" ").pop()?.[0] || "D"}
          </div>
          <div>
            <h5 className="text-sm font-bold text-slate-800 leading-tight group-hover:text-[#0E7490] transition-colors">
              {name}
            </h5>
            <p className="text-xs text-slate-500 mt-0.5">{specialization}</p>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="flex items-center gap-0.5 text-xs font-semibold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-100/50">
                <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                {rating}
              </span>
              <span className="text-[10px] text-slate-400 font-medium">{experience}</span>
            </div>
          </div>
        </div>

        {/* Live Status indicator */}
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Active
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 mt-4 pt-3.5 border-t border-slate-100 text-xs">
        <div className="flex items-center gap-1.5 text-slate-600">
          <Users className="h-4 w-4 text-[#0E7490]/70" />
          <span>{patientCount} in Queue</span>
        </div>
        <div className="flex items-center gap-1.5 text-slate-600 justify-end">
          <Clock className="h-4 w-4 text-[#14B8A6]/70" />
          <span>{estWait} Wait</span>
        </div>
      </div>
    </div>
  );
}
