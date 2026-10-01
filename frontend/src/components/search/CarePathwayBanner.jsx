import React from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, Activity, Sparkles, Navigation, Clock, MapPin, Zap, HelpCircle, CheckCircle2, Search } from "lucide-react";

/**
 * CarePathwayBanner
 * Communicates query understanding, relevant clinical specialties,
 * query confidence level, patient preference tuning pills,
 * and immediate emergency pathways without diagnosing diseases.
 */
export default function CarePathwayBanner({
  carePathway,
  preference,
  onSelectPreference,
  onQuickSearch,
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
    confidence = "HIGH",
    uncertaintyMessage,
    explanationMessage,
    suggestedActions = [],
    isKnownHealthcareQuery = true,
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

      {/* 2. UNKNOWN QUERY GUIDANCE (WHEN CONFIDENCE IS LOW) */}
      {!isKnownHealthcareQuery && (
        <div className="bg-amber-50/90 border border-amber-200 rounded-3xl p-6 shadow-xs text-slate-800">
          <div className="flex items-start gap-3.5">
            <div className="w-9 h-9 rounded-2xl bg-amber-500 text-white flex items-center justify-center flex-shrink-0">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div className="space-y-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-800 bg-amber-100 px-2.5 py-0.5 rounded-full">
                  Unrecognized Query
                </span>
                <h3 className="font-extrabold text-slate-900 text-base mt-1">
                  Unable to confidently map this search to a healthcare specialty.
                </h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                  To protect clinical accuracy, MediHospi does not guess medical care for unrecognized terms. Please try one of the following safe search options:
                </p>
              </div>

              {suggestedActions && suggestedActions.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 text-xs">
                  {suggestedActions.map((action, i) => (
                    <div key={i} className="flex items-center gap-2 bg-white/80 p-2.5 rounded-xl border border-amber-100 font-medium text-slate-700">
                      <Search className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                      <span>{action}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 3. CARE PATHWAY UNDERSTANDING & RELEVANT SPECIALTIES (KNOWN QUERIES) */}
      {isKnownHealthcareQuery && (
        <div className="bg-white rounded-3xl border border-blue-100 p-5 shadow-xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center text-xs">
                  <Activity className="w-3.5 h-3.5" />
                </span>
                <h3 className="font-extrabold text-slate-800 text-sm">
                  {pathwayTitle || "Relevant Care Pathways"}
                </h3>
                {confidence === "MEDIUM" && (
                  <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2.5 py-0.5 rounded-full">
                    Moderate Confidence
                  </span>
                )}
                {confidence === "HIGH" && (
                  <span className="bg-emerald-50 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-150">
                    High Confidence
                  </span>
                )}
              </div>

              {/* Uncertainty Warning if Medium Confidence */}
              {uncertaintyMessage && (
                <p className="text-xs text-amber-800 bg-amber-50 border border-amber-200/80 p-2 rounded-xl mt-2 font-medium">
                  ℹ️ {uncertaintyMessage}
                </p>
              )}

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

            {/* PATIENT PREFERENCE CONTROL PILLS */}
            <div className="flex flex-col items-start md:items-end gap-1.5 flex-shrink-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Ranking Priority
              </span>
              <div className="inline-flex bg-slate-100 p-1 rounded-2xl border border-slate-200/60">
                <button
                  type="button"
                  onClick={() => onSelectPreference("balanced")}
                  title="Recommended multi-objective match balancing wait time, proximity, and freshness"
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                    preference === "balanced"
                      ? "bg-white text-blue-700 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  Recommended
                </button>
                <button
                  type="button"
                  onClick={() => onSelectPreference("fastest")}
                  title="Prioritize lowest estimated waiting time and access time"
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                    preference === "fastest"
                      ? "bg-white text-blue-700 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <Zap className="w-3 h-3 text-amber-500" />
                  Shortest wait
                </button>
                <button
                  type="button"
                  onClick={() => onSelectPreference("closest")}
                  title="Prioritize geographically nearest healthcare facility"
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1 ${
                    preference === "closest"
                      ? "bg-white text-blue-700 shadow-xs"
                      : "text-slate-600 hover:text-slate-900"
                  }`}
                >
                  <MapPin className="w-3 h-3 text-emerald-500" />
                  Nearest
                </button>
              </div>
            </div>
          </div>

          {/* Disclaimer */}
          <p className="text-[11px] text-slate-400 font-medium mt-3 pt-3 border-t border-slate-100 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
            {disclaimer || "MediHospi is a healthcare navigation and decision-support system. It connects you to suitable clinical departments and operational doctors, and does not provide clinical diagnosis or treatment."}
          </p>
        </div>
      )}
    </div>
  );
}
