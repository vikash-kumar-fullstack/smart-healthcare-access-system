import React from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, Activity, Sparkles, Navigation, Clock, MapPin, Zap } from "lucide-react";

/**
 * CarePathwayBanner
 * Communicates query understanding, relevant clinical specialties,
 * patient preference tuning pills, and immediate emergency pathways.
 */
export default function CarePathwayBanner({
  carePathway,
  preference,
  onSelectPreference,
  resultsCount
}) {
  const navigate = useNavigate();

  if (!carePathway) return null;

  const {
    isEmergency,
    emergencyMessage,
    primarySpecialties = [],
    relatedSpecialties = [],
    symptoms = [],
    pathwayTitle,
    disclaimer
  } = carePathway;

  return (
    <div className="space-y-4 mb-6">
      {/* 1. ACUTE EMERGENCY PATHWAY BANNER */}
      {isEmergency && (
        <div className="bg-gradient-to-r from-rose-50 via-rose-100/50 to-orange-50 border-2 border-rose-300 rounded-3xl p-5 shadow-sm text-rose-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-10 h-10 rounded-2xl bg-rose-600 text-white flex items-center justify-center flex-shrink-0 shadow-sm animate-pulse">
              <AlertCircle className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="bg-rose-700 text-white text-[10px] font-black px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                  Emergency Red Flag
                </span>
                <h4 className="font-extrabold text-sm text-rose-900">Immediate Medical Attention</h4>
              </div>
              <p className="text-xs text-rose-800 font-medium mt-1 leading-relaxed max-w-xl">
                {emergencyMessage ||
                  "Your query includes symptoms that may require urgent medical attention. If you are experiencing acute pain, call 108 immediately."}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => navigate("/patient/emergency")}
            className="w-full sm:w-auto bg-rose-600 hover:bg-rose-700 text-white font-extrabold px-5 py-2.5 rounded-2xl text-xs transition shadow-md whitespace-nowrap active:scale-[0.98] cursor-pointer"
          >
            🚨 Launch Emergency SOS
          </button>
        </div>
      )}

      {/* 2. CARE PATHWAY UNDERSTANDING & RELEVANT SPECIALTIES */}
      <div className="bg-white rounded-3xl border border-blue-100 p-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center text-xs">
                <Activity className="w-3.5 h-3.5" />
              </span>
              <h3 className="font-extrabold text-slate-800 text-sm">
                {pathwayTitle || "Relevant Care Pathways"}
              </h3>
            </div>

            {/* Specialties Badges */}
            <div className="flex items-center gap-2 mt-2.5 flex-wrap text-xs">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                Relevant Specialties:
              </span>
              {primarySpecialties.map((spec, i) => (
                <span
                  key={i}
                  className="bg-blue-50 text-blue-800 border border-blue-200/80 font-bold px-3 py-1 rounded-xl text-xs flex items-center gap-1.5"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                  {spec}
                </span>
              ))}

              {relatedSpecialties.map((spec, i) => (
                <span
                  key={`rel-${i}`}
                  className="bg-slate-50 text-slate-600 border border-slate-200 font-semibold px-2.5 py-1 rounded-xl text-xs"
                >
                  {spec} (Related)
                </span>
              ))}
            </div>
          </div>

          {/* 3. PATIENT PREFERENCE CONTROL PILLS */}
          <div className="flex flex-col items-start md:items-end gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
              Ranking Priority
            </span>
            <div className="inline-flex bg-slate-100 p-1 rounded-2xl border border-slate-200/60">
              <button
                type="button"
                onClick={() => onSelectPreference("balanced")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  preference === "balanced"
                    ? "bg-white text-blue-700 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                Balanced
              </button>
              <button
                type="button"
                onClick={() => onSelectPreference("fastest")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  preference === "fastest"
                    ? "bg-white text-blue-700 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <Zap className="w-3 h-3 text-amber-500" />
                Fastest
              </button>
              <button
                type="button"
                onClick={() => onSelectPreference("closest")}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                  preference === "closest"
                    ? "bg-white text-blue-700 shadow-xs"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                <MapPin className="w-3 h-3 text-emerald-500" />
                Closest
              </button>
            </div>
          </div>
        </div>

        {/* Disclaimer */}
        <p className="text-[11px] text-slate-400 font-medium mt-3 pt-3 border-t border-slate-100 flex items-center gap-1.5">
          <Sparkles className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
          {disclaimer}
        </p>
      </div>
    </div>
  );
}
