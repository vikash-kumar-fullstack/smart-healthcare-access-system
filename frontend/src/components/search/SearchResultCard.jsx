import React from "react";
import { MapPin, Clock, Star, Heart, ArrowRight, Info, CheckCircle2, AlertTriangle, ShieldCheck } from "lucide-react";

/**
 * Level 1 Concise Healthcare Search Result Card
 * Prioritizes essential comparative information:
 * 1. Doctor/hospital name
 * 2. Relevant specialty
 * 3. Current availability
 * 4. Estimated waiting time
 * 5. Distance (if location enabled)
 * 6. Information freshness
 * 7. View Details
 * 8. Book Appointment
 */
export default function SearchResultCard({
  item,
  isFavorite,
  onToggleFavorite,
  onViewDetails,
  onBook
}) {
  const doc = item.doctor || {};
  const hospital = item.hospital || {};
  const availability = item.availability || {};
  const freshness = item.freshness || {};
  const isRecommended = item.recommended || false;
  const why = item.why || [];
  const distance = item.distance;
  const estimatedWait = item.estimatedWaitMinutes;
  const currentQueue = item.currentQueue ?? 0;

  // Availability styling
  const isAvailable = availability.available || doc.availabilityState === "available";
  const isOnBreak = doc.availabilityState === "break";

  // Freshness badge color
  const freshnessColor =
    freshness.state === "live"
      ? "text-emerald-700 bg-emerald-50 border-emerald-200"
      : freshness.state === "recent"
        ? "text-amber-700 bg-amber-50 border-amber-200"
        : "text-slate-600 bg-slate-100 border-slate-200";

  return (
    <div
      className={`bg-white rounded-3xl border transition-all duration-200 shadow-xs hover:shadow-md ${
        isRecommended
          ? "border-blue-200 ring-1 ring-blue-100/80 bg-gradient-to-br from-white via-white to-blue-50/20"
          : "border-slate-100"
      }`}
    >
      <div className="p-6">
        {/* Top bar: Doctor Info & Live Telemetry Badges */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          
          <div className="flex items-start gap-4">
            {/* Avatar / Monogram */}
            <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 text-blue-700 font-black flex items-center justify-center text-lg flex-shrink-0 shadow-xs">
              {doc.name?.[0]?.toUpperCase() || "D"}
            </div>

            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-extrabold text-slate-800 text-base leading-snug">
                  {doc.name}
                </h3>
                {isRecommended && (
                  <span className="bg-blue-600 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider flex items-center gap-1 shadow-xs">
                    <ShieldCheck className="w-3 h-3" />
                    Recommended
                  </span>
                )}
              </div>

              <p className="text-xs font-semibold text-slate-500 mt-0.5">
                <span className="text-blue-700 font-bold">{doc.specialization}</span> • {hospital.name || doc.hospitalName || "Partnered Hospital"}
              </p>

              {/* Badges: Ratings, Experience, Distance */}
              <div className="flex items-center gap-2.5 mt-2 flex-wrap text-xs">
                {doc.rating > 0 && (
                  <span className="inline-flex items-center gap-1 bg-amber-50 text-amber-800 font-semibold px-2 py-0.5 rounded-lg border border-amber-100/60">
                    <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    {doc.rating.toFixed(1)}
                  </span>
                )}
                {doc.experienceYears > 0 && (
                  <span className="text-slate-500 font-medium bg-slate-50 border border-slate-100 px-2 py-0.5 rounded-lg">
                    {doc.experienceYears} yrs exp
                  </span>
                )}
                {distance !== null && distance !== undefined && (
                  <span className="inline-flex items-center gap-1 text-slate-700 font-bold bg-slate-100/80 px-2 py-0.5 rounded-lg">
                    <MapPin className="w-3.5 h-3.5 text-blue-500" />
                    {distance.toFixed(1)} km
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Right side: Operational State & Favorite Button */}
          <div className="flex items-start justify-between sm:justify-end gap-3 pt-1">
            <div className="text-left sm:text-right">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Live Status
              </span>
              <div className="mt-0.5 flex items-center gap-1.5 sm:justify-end">
                <span
                  className={`w-2 h-2 rounded-full ${
                    isAvailable ? "bg-emerald-500 animate-pulse" : isOnBreak ? "bg-amber-400" : "bg-slate-300"
                  }`}
                />
                <span
                  className={`text-xs font-extrabold ${
                    isAvailable ? "text-emerald-700" : isOnBreak ? "text-amber-700" : "text-slate-500"
                  }`}
                >
                  {isAvailable ? "Accepting Patients" : isOnBreak ? "On Break" : "Next Session"}
                </span>
              </div>
            </div>

            {hospital._id && (
              <button
                type="button"
                onClick={(e) => onToggleFavorite(hospital._id, e)}
                className={`p-2 rounded-xl border transition-all cursor-pointer ${
                  isFavorite
                    ? "bg-rose-50 border-rose-200 text-rose-600"
                    : "bg-slate-50 border-slate-200 text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                }`}
                title={isFavorite ? "Saved Hospital" : "Save Hospital"}
              >
                <Heart className={`w-4 h-4 ${isFavorite ? "fill-current" : ""}`} />
              </button>
            )}
          </div>
        </div>

        {/* Middle Bar: Estimated Wait & Freshness Indicator */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-3 flex-wrap">
            {/* Wait time */}
            <div className="flex items-center gap-1.5 text-slate-700 font-semibold bg-blue-50/60 border border-blue-100 px-3 py-1 rounded-xl">
              <Clock className="w-3.5 h-3.5 text-blue-600" />
              <span>
                Est. Wait:{" "}
                <strong className="text-slate-900">
                  {currentQueue === 0 ? "~5 min (Next)" : `~${estimatedWait} min`}
                </strong>
              </span>
              <span className="text-slate-400 text-[10px]">({currentQueue} in queue)</span>
            </div>

            {/* Freshness telemetry */}
            {freshness.displayText && (
              <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-[11px] font-semibold ${freshnessColor}`}>
                <span className="w-1.5 h-1.5 rounded-full bg-current" />
                <span>{freshness.displayText}</span>
              </div>
            )}
          </div>
        </div>

        {/* Why this option badges (Explainability) */}
        {why.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {why.slice(0, 3).map((reason, idx) => (
              <span
                key={idx}
                className="text-[10px] font-bold text-slate-600 bg-slate-50 border border-slate-150 px-2.5 py-0.5 rounded-lg flex items-center gap-1"
              >
                <CheckCircle2 className="w-2.5 h-2.5 text-blue-500" />
                {reason}
              </span>
            ))}
          </div>
        )}

        {/* Bottom Actions: View Details (Progressive Disclosure) + Book Appointment */}
        <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={() => onViewDetails(doc._id)}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 hover:text-slate-900 px-4 py-2.5 rounded-xl transition cursor-pointer active:scale-[0.98]"
          >
            <Info className="w-4 h-4 text-blue-600" />
            View Details
          </button>

          <button
            type="button"
            onClick={() => onBook(doc)}
            disabled={doc.availabilityState === "unavailable"}
            className={`inline-flex items-center gap-1.5 font-bold px-5 py-2.5 rounded-xl text-xs transition shadow-sm active:scale-[0.98] ${
              doc.availabilityState !== "unavailable"
                ? "bg-blue-600 hover:bg-blue-700 text-white cursor-pointer"
                : "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200"
            }`}
          >
            <span>Book Appointment</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
