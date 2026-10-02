import React, { useState, useEffect } from "react";
import {
  X,
  MapPin,
  Clock,
  Star,
  ShieldCheck,
  CheckCircle2,
  Building,
  AlertCircle,
  ArrowRight,
  User,
  Activity,
  AlertTriangle,
  Radio,
  ExternalLink,
  ChevronRight
} from "lucide-react";
import api from "../../services/api";
import { formatEstimatedTravelTime } from "../../utils/formatters";

/**
 * Level 2 Progressive Disclosure - Centered Modal Experience
 * Replaces the old right-side drawer.
 * Respects application layout and displays comprehensive research-grade
 * operational data across 10 structured sections.
 */
export default function HealthcareDetailView({
  doctorId,
  coords,
  query,
  onClose,
  onBook,
  onRequestLocation
}) {
  const [currentDoctorId, setCurrentDoctorId] = useState(doctorId);
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  // Synchronize when parent prop doctorId changes
  useEffect(() => {
    setCurrentDoctorId(doctorId);
  }, [doctorId]);

  // Handle ESC key press to close modal
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  // Fetch full research-grade details for active doctor
  useEffect(() => {
    if (!currentDoctorId) return;

    let isMounted = true;
    setLoading(true);
    setError(null);

    const fetchDetails = async () => {
      try {
        let url = `/search/details/${currentDoctorId}?q=${encodeURIComponent(query || "")}`;
        if (coords?.lat && coords?.lng) {
          url += `&lat=${coords.lat}&lng=${coords.lng}`;
        }
        const res = await api.get(url);
        if (isMounted) {
          if (res.data?.success) {
            setData(res.data.data);
          } else {
            setError("Unable to retrieve operational doctor details.");
          }
        }
      } catch (err) {
        if (isMounted) {
          console.error("Healthcare details fetch error:", err);
          setError(err.response?.data?.message || "Failed to load detailed healthcare view.");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchDetails();

    return () => {
      isMounted = false;
    };
  }, [currentDoctorId, coords, query]);

  if (!doctorId) return null;

  // Derive plain-language freshness state & badge
  const freshness = data?.freshness || {};
  const freshnessStatus = freshness.patientStatus || (
    freshness.state === "live" ? "fresh" :
    freshness.state === "recent" ? "recent" :
    freshness.state === "stale" ? "stale" : "unavailable"
  );

  const rawFreshText = freshness.patientLabel || freshness.displayText || "Update time unavailable";
  const freshnessRelativeText = rawFreshText.replace(/^Live ·\s*/i, "");

  const freshnessExplanation = freshness.patientDetailExplanation || (
    freshnessStatus === "fresh"
      ? (freshness.ageSeconds !== null && freshness.ageSeconds < 60
          ? "Hospital information was updated just now. Availability and queue state are current."
          : `Hospital information was updated ${Math.max(1, Math.floor((freshness.ageSeconds || 0) / 60))} minutes ago.`)
      : freshnessStatus === "recent"
        ? `Hospital information was updated ${Math.max(1, Math.floor((freshness.ageSeconds || 0) / 60))} minutes ago. Availability is reasonably current.`
        : freshnessStatus === "aging"
          ? `Hospital information was updated ${Math.max(1, Math.floor((freshness.ageSeconds || 0) / 60))} minutes ago. Queue and availability may have changed.`
          : freshnessStatus === "stale"
            ? "This information has not been updated recently. Please verify availability before visiting."
            : "Update time is not available for this facility. Please contact the clinic directly to confirm availability."
  );

  const freshnessBadgeStyle =
    freshnessStatus === "fresh"
      ? "text-emerald-700 bg-emerald-50 border-emerald-200"
      : freshnessStatus === "recent"
        ? "text-blue-700 bg-blue-50 border-blue-200"
        : freshnessStatus === "aging"
          ? "text-amber-800 bg-amber-50 border-amber-200"
          : freshnessStatus === "stale"
            ? "text-amber-900 bg-amber-50 border-amber-300"
            : "text-slate-600 bg-slate-100 border-slate-200";

  const freshnessBadgeDot =
    freshnessStatus === "fresh"
      ? "bg-emerald-500"
      : freshnessStatus === "recent"
        ? "bg-blue-500"
        : freshnessStatus === "aging"
          ? "bg-amber-500"
          : freshnessStatus === "stale"
            ? "bg-amber-600"
            : "bg-slate-400";

  // Filter why array for clean patient-facing reasons
  const cleanWhy = (data?.why || []).filter(r =>
    !/(f_h|v_h|c_h|n_h|telemetry|confidence|composite|fahra|score|s\(p|s_\{p)/i.test(r)
  );

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/65 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6 animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white w-full max-w-3xl max-h-[90vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-slate-100 my-auto">
        
        {/* MODAL HEADER */}
        <div className="bg-white border-b border-slate-100 p-5 sm:px-8 flex items-center justify-between sticky top-0 z-20">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full">
                Doctor Details
              </span>
              {data?.operational?.available ? (
                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Available Now
                </span>
              ) : (
                <span className="text-[10px] font-bold text-slate-500 bg-slate-100 border border-slate-200 px-2.5 py-0.5 rounded-full">
                  Next Scheduled Session
                </span>
              )}
            </div>
            <h2 className="text-xl sm:text-2xl font-black text-slate-900 mt-1">
              {loading ? "Loading Details..." : `Dr. ${data?.doctor?.name}`}
            </h2>
            {!loading && data?.doctor && (
              <p className="text-xs text-slate-500 font-semibold mt-0.5">
                <span className="text-blue-600 font-bold">{data.doctor.specialization}</span> • {data.hospital?.name}
              </p>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close details"
            className="p-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* MODAL BODY */}
        <div className="p-6 sm:p-8 overflow-y-auto flex-1 space-y-6">
          {loading ? (
            <div className="space-y-4 py-8">
              <div className="h-6 bg-slate-100 rounded-xl w-1/3 animate-pulse" />
              <div className="h-28 bg-slate-100 rounded-2xl animate-pulse" />
              <div className="h-40 bg-slate-100 rounded-2xl animate-pulse" />
              <div className="h-28 bg-slate-100 rounded-2xl animate-pulse" />
            </div>
          ) : error ? (
            <div className="bg-rose-50 border border-rose-200 rounded-3xl p-8 text-center text-rose-800">
              <AlertCircle className="w-10 h-10 text-rose-600 mx-auto mb-3" />
              <h4 className="font-extrabold text-base">{error}</h4>
              <p className="text-xs text-rose-700 mt-1">
                Please check your network connection or select another healthcare option.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="mt-4 px-4 py-2 bg-rose-600 text-white rounded-xl text-xs font-bold hover:bg-rose-700 transition cursor-pointer"
              >
                Close View
              </button>
            </div>
          ) : data ? (
            <>
              {/* STALE INFORMATION NOTICE (IF APPLICABLE) */}
              {(freshnessStatus === "aging" || freshnessStatus === "stale") && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3 text-amber-900 text-xs">
                  <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <strong className="font-extrabold block">Notice</strong>
                    <span>
                      {freshnessExplanation}
                    </span>
                  </div>
                </div>
              )}

              {/* 1. DOCTOR PROFILE & CREDENTIALS */}
              <div className="bg-slate-50 border border-slate-150 rounded-3xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <User className="w-4 h-4 text-blue-600" />
                  <h3 className="font-extrabold text-sm text-slate-900">Doctor Information</h3>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="bg-white p-3 rounded-2xl border border-slate-150">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Specialty</span>
                    <span className="font-extrabold text-slate-800 mt-0.5 block">{data.doctor.specialization}</span>
                  </div>

                  <div className="bg-white p-3 rounded-2xl border border-slate-150">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Experience</span>
                    <span className="font-extrabold text-slate-800 mt-0.5 block">
                      {data.doctor.experienceYears > 0 ? `${data.doctor.experienceYears} Years` : "Experienced Specialist"}
                    </span>
                  </div>

                  <div className="bg-white p-3 rounded-2xl border border-slate-150">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Status</span>
                    <span className="font-extrabold text-emerald-700 mt-0.5 block capitalize">
                      {data.doctor.status || "Verified"}
                    </span>
                  </div>

                  <div className="bg-white p-3 rounded-2xl border border-slate-150">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Consultation Time</span>
                    <span className="font-extrabold text-slate-800 mt-0.5 block">
                      ~{data.doctor.avgConsultationTime || 5} min / patient
                    </span>
                  </div>
                </div>
              </div>

              {/* 2. HOSPITAL FACILITY */}
              <div className="bg-slate-50 border border-slate-150 rounded-3xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Building className="w-4 h-4 text-blue-600" />
                  <h3 className="font-extrabold text-sm text-slate-900">Hospital Facility</h3>
                </div>

                <div className="space-y-3 text-xs">
                  <div className="bg-white p-4 rounded-2xl border border-slate-150 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h4 className="font-black text-slate-800 text-sm">{data.hospital?.name}</h4>
                      <p className="text-slate-500 font-medium text-xs mt-0.5 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-blue-500 flex-shrink-0" />
                        {data.hospital?.address}
                      </p>
                    </div>

                    <div className="text-left sm:text-right">
                      <span className="text-[10px] text-slate-400 font-bold uppercase block">Booking Window</span>
                      <span className="font-bold text-slate-700">Up to {data.hospital?.bookingWindowDays || 7} days ahead</span>
                    </div>
                  </div>

                  {data.hospital?.specializations && (
                    <div className="flex items-center gap-1.5 flex-wrap pt-1">
                      <span className="text-[10px] font-bold text-slate-400 uppercase mr-1">Departments:</span>
                      {data.hospital.specializations.map((spec, i) => (
                        <span key={i} className="text-[10px] bg-white border border-slate-200 px-2 py-0.5 rounded-md text-slate-600 font-medium">
                          {spec}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* 3. CURRENT AVAILABILITY & QUEUE */}
              <div className="bg-blue-50/40 border border-blue-100 rounded-3xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Activity className="w-4 h-4 text-blue-600" />
                  <h3 className="font-extrabold text-sm text-slate-900">Current Availability & Queue</h3>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="bg-white p-3.5 rounded-2xl border border-blue-100/80">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Walk-In Status</span>
                    <span className="font-extrabold text-emerald-700 mt-1 block">
                      {data.operational?.available ? "Accepting Patients" : "Next Shift Only"}
                    </span>
                  </div>

                  <div className="bg-white p-3.5 rounded-2xl border border-blue-100/80">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Current Queue</span>
                    <span className="font-extrabold text-slate-900 mt-1 text-base block">
                      {data.operational?.currentQueue ?? 0}{" "}
                      <span className="text-xs text-slate-400 font-normal">waiting</span>
                    </span>
                  </div>

                  <div className="bg-white p-3.5 rounded-2xl border border-blue-100/80">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Estimated Wait</span>
                    <span className="font-extrabold text-blue-700 mt-1 text-base block">
                      ~{data.operational?.estimatedWaitMinutes ?? 0}{" "}
                      <span className="text-xs text-slate-400 font-normal">min</span>
                    </span>
                  </div>

                  <div className="bg-white p-3.5 rounded-2xl border border-blue-100/80">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Next Turn</span>
                    <span className="font-extrabold text-slate-800 mt-1 block">
                      {data.operational?.nextAvailable || "Today"}
                    </span>
                  </div>
                </div>

                {data.operational?.todaySchedule && (
                  <p className="text-[11px] text-slate-500 font-medium mt-3 bg-white/70 p-2.5 rounded-xl border border-blue-100/50">
                    🕒 Regular Shift Hours Today: {data.operational.todaySchedule.startTime} – {data.operational.todaySchedule.endTime}
                  </p>
                )}
              </div>

              {/* 4. DISTANCE & ACCESS */}
              <div className="bg-slate-50 border border-slate-150 rounded-3xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <MapPin className="w-4 h-4 text-blue-600" />
                  <h3 className="font-extrabold text-sm text-slate-900">Distance & Travel</h3>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-150 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  {data.locationProvided && data.distance !== null ? (
                    <>
                      <div>
                        <span className="text-[10px] text-slate-400 font-bold uppercase block">Distance</span>
                        <span className="font-black text-slate-900 text-base mt-0.5 block">
                          {data.distance} km away
                        </span>
                        <span className="text-[11px] text-slate-400 font-medium">Calculated based on your provided location</span>
                      </div>
                      {data.estimatedTravelMinutes && (
                        <div className="text-left sm:text-right">
                          <span className="text-[10px] text-slate-400 font-bold uppercase block">Estimated Travel Time</span>
                          <span className="font-bold text-slate-800">{formatEstimatedTravelTime(data.estimatedTravelMinutes)}</span>
                          <span className="text-[10px] text-slate-400 block mt-0.5">Modeled urban transit estimate</span>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between w-full gap-3">
                      <div>
                        <span className="font-extrabold text-slate-700 block">Distance unavailable — location not provided</span>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Share your browser location to view real distances to healthcare facilities.
                        </p>
                      </div>
                      {onRequestLocation && (
                        <button
                          type="button"
                          onClick={onRequestLocation}
                          className="px-3.5 py-2 bg-blue-50 text-blue-700 border border-blue-200 rounded-xl font-bold hover:bg-blue-100 transition cursor-pointer text-xs flex items-center gap-1.5 self-start sm:self-auto"
                        >
                          <MapPin className="w-3.5 h-3.5" />
                          <span>Use My Location</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* 5. INFORMATION FRESHNESS */}
              <div className="bg-slate-50 border border-slate-150 rounded-3xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="w-4 h-4 text-blue-600" />
                  <h3 className="font-extrabold text-sm text-slate-900">Information Freshness</h3>
                </div>

                <div className="bg-white p-4 rounded-2xl border border-slate-150 text-xs space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className={`w-2.5 h-2.5 rounded-full ${freshnessBadgeDot}`} />
                      <span className="font-extrabold text-slate-800 text-sm capitalize">
                        {freshnessStatus === "fresh" ? "Recently updated" :
                         freshnessStatus === "recent" ? "Updated recently" :
                         freshnessStatus === "aging" ? "May have changed" :
                         freshnessStatus === "stale" ? "May be outdated" : "Update time unavailable"}
                      </span>
                    </div>

                    <span className={`inline-flex items-center px-2.5 py-1 rounded-xl text-xs font-semibold ${freshnessBadgeStyle}`}>
                      {freshnessRelativeText}
                    </span>
                  </div>

                  <p className="text-xs text-slate-600 font-medium leading-relaxed">
                    {freshnessExplanation}
                  </p>

                  <p className="text-[11px] text-slate-400 border-t border-slate-100 pt-2">
                    ℹ️ Hospital conditions, doctor shifts, and patient queues can change throughout the day.
                  </p>
                </div>
              </div>

              {/* 6. WHY THIS OPTION? */}
              {cleanWhy.length > 0 && (
                <div className="bg-slate-50 border border-slate-150 rounded-3xl p-5">
                  <div className="flex items-center gap-2 mb-3">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <h3 className="font-extrabold text-sm text-slate-900">Why this option?</h3>
                  </div>

                  <div className="space-y-2 text-xs">
                    {cleanWhy.map((reason, idx) => (
                      <div key={idx} className="flex items-start gap-2.5 text-slate-700 font-medium bg-white p-2.5 rounded-xl border border-slate-150">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                        <span>{reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 7. OTHER AVAILABLE ALTERNATIVES */}
              {data.alternatives && data.alternatives.length > 0 && (
                <div className="bg-white border border-slate-150 rounded-3xl p-5 shadow-xs">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-extrabold text-sm text-slate-900">
                      Other Verified Specialists in {data.doctor.specialization}
                    </h3>
                    <span className="text-[10px] text-slate-400 font-bold uppercase">
                      Click to inspect
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {data.alternatives.map((alt) => (
                      <button
                        type="button"
                        key={alt.doctorId}
                        onClick={() => setCurrentDoctorId(alt.doctorId)}
                        className="w-full text-left bg-slate-50 hover:bg-blue-50/50 p-3.5 rounded-2xl flex items-center justify-between gap-3 text-xs border border-slate-200 hover:border-blue-200 transition cursor-pointer group"
                      >
                        <div>
                          <p className="font-extrabold text-slate-800 group-hover:text-blue-700 transition">
                            Dr. {alt.name}
                          </p>
                          <p className="text-slate-500 font-medium text-[11px] mt-0.5">
                            {alt.hospitalName} • ~{alt.estimatedWaitMinutes} min wait
                            {alt.distance !== null && alt.distance !== undefined && ` • ${alt.distance} km away`}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                              alt.available
                                ? "bg-emerald-100 text-emerald-800"
                                : "bg-slate-200 text-slate-600"
                            }`}
                          >
                            {alt.available ? "Available" : "Next Session"}
                          </span>
                          <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition" />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* MODAL FOOTER */}
        <div className="bg-white border-t border-slate-100 p-4 sm:px-8 flex items-center justify-between gap-4 sticky bottom-0 z-20">
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-bold text-slate-600 hover:text-slate-900 px-5 py-3 rounded-xl transition cursor-pointer"
          >
            Close Details
          </button>

          <button
            type="button"
            onClick={() => {
              if (data?.doctor) {
                onClose();
                onBook({
                  ...data.doctor,
                  hospitalId: data.doctor?.hospitalId || data.hospital?._id
                });
              }
            }}
            disabled={!data?.doctor || data?.operational?.available === false}
            className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-extrabold px-6 py-3 rounded-2xl text-xs transition shadow-md active:scale-[0.98] cursor-pointer disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed"
          >
            <span>Proceed to Booking</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

      </div>
    </div>
  );
}
