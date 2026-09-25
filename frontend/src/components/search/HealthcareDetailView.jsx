import React, { useState, useEffect } from "react";
import { X, MapPin, Clock, Star, Calendar, ShieldCheck, CheckCircle2, Building, AlertCircle, ArrowRight, User } from "lucide-react";
import api from "../../services/api";

/**
 * Level 2 Progressive Disclosure Detail View
 * Discloses comprehensive verified healthcare information on-demand
 * without overloading the initial search results page.
 */
export default function HealthcareDetailView({
  doctorId,
  coords,
  query,
  onClose,
  onBook
}) {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!doctorId) return;

    let isMounted = true;
    setLoading(true);
    setError(null);

    const fetchDetails = async () => {
      try {
        let url = `/search/details/${doctorId}?q=${encodeURIComponent(query || "")}`;
        if (coords?.lat && coords?.lng) {
          url += `&lat=${coords.lat}&lng=${coords.lng}`;
        }
        const res = await api.get(url);
        if (isMounted) {
          if (res.data?.success) {
            setData(res.data.data);
          } else {
            setError("Unable to load doctor details");
          }
        }
      } catch (err) {
        if (isMounted) {
          console.error("Healthcare details fetch error:", err);
          setError(err.response?.data?.message || "Failed to load detailed view.");
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchDetails();

    return () => {
      isMounted = false;
    };
  }, [doctorId, coords, query]);

  if (!doctorId) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex justify-end transition-opacity">
      <div className="bg-white w-full max-w-2xl min-h-screen shadow-2xl flex flex-col justify-between transform transition-transform">
        
        {/* TOP MODAL HEADER */}
        <div className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-slate-100 p-5 px-6 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 bg-blue-50 px-2.5 py-0.5 rounded-full">
              Detailed Healthcare View
            </span>
            <h2 className="text-xl font-black text-slate-900 mt-1">
              {loading ? "Loading Clinical Details..." : data?.doctor?.name}
            </h2>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* BODY CONTENT */}
        <div className="p-6 overflow-y-auto flex-1 space-y-6">
          {loading ? (
            <div className="space-y-4 py-8">
              <div className="h-6 bg-slate-100 rounded-xl w-3/4 animate-pulse" />
              <div className="h-24 bg-slate-100 rounded-2xl animate-pulse" />
              <div className="h-32 bg-slate-100 rounded-2xl animate-pulse" />
              <div className="h-24 bg-slate-100 rounded-2xl animate-pulse" />
            </div>
          ) : error ? (
            <div className="bg-rose-50 border border-rose-200 rounded-3xl p-6 text-center text-rose-800">
              <AlertCircle className="w-8 h-8 text-rose-600 mx-auto mb-2" />
              <h4 className="font-extrabold text-sm">{error}</h4>
              <p className="text-xs text-rose-700 mt-1">Please try closing and selecting again.</p>
            </div>
          ) : data ? (
            <>
              {/* SECTION A: DOCTOR CREDENTIALS */}
              <div className="bg-slate-50/70 border border-slate-100 rounded-3xl p-5">
                <div className="flex items-center gap-2 mb-3">
                  <User className="w-4 h-4 text-blue-600" />
                  <h3 className="font-extrabold text-sm text-slate-900">Doctor Profile & Qualifications</h3>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                  <div className="bg-white p-3 rounded-2xl border border-slate-150">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Specialization</span>
                    <span className="font-extrabold text-slate-800 mt-0.5 block">{data.doctor.specialization}</span>
                  </div>

                  <div className="bg-white p-3 rounded-2xl border border-slate-150">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Experience</span>
                    <span className="font-extrabold text-slate-800 mt-0.5 block">
                      {data.doctor.experienceYears > 0 ? `${data.doctor.experienceYears} Years` : "Established Practitioner"}
                    </span>
                  </div>

                  <div className="bg-white p-3 rounded-2xl border border-slate-150">
                    <span className="text-[10px] text-slate-400 font-bold uppercase block">Avg. Session</span>
                    <span className="font-extrabold text-slate-800 mt-0.5 block">
                      ~{data.doctor.avgConsultationTime || 5} min / patient
                    </span>
                  </div>
                </div>

                {data.doctor.temporaryNotice && (
                  <div className="mt-3 bg-amber-50 border border-amber-200 text-amber-900 p-3 rounded-2xl text-xs font-semibold">
                    📢 {data.doctor.temporaryNotice}
                  </div>
                )}
              </div>

              {/* SECTION B: HOSPITAL & LOCATION */}
              <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-xs">
                <div className="flex items-center gap-2 mb-3">
                  <Building className="w-4 h-4 text-blue-600" />
                  <h3 className="font-extrabold text-sm text-slate-900">Hospital & Campus Facility</h3>
                </div>

                <div className="space-y-2 text-xs">
                  <p className="font-bold text-slate-900 text-sm">{data.hospital.name}</p>
                  <p className="text-slate-500 font-medium flex items-start gap-1.5">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
                    <span>{data.hospital.address} {data.hospital.district ? `(${data.hospital.district})` : ""}</span>
                  </p>

                  {/* Distance & Travel time */}
                  {data.distance !== null && data.distance !== undefined && (
                    <div className="mt-3 flex items-center gap-3 bg-blue-50/60 border border-blue-100 p-3 rounded-2xl text-xs">
                      <span className="font-bold text-blue-800">
                        📍 {data.distance} km from your pin
                      </span>
                      {data.estimatedTravelMinutes && (
                        <span className="text-slate-500 font-medium">
                          (~{data.estimatedTravelMinutes} min drive in normal traffic)
                        </span>
                      )}
                    </div>
                  )}

                  {/* Departments */}
                  {data.hospital.specializations && data.hospital.specializations.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-slate-100">
                      <span className="text-[10px] text-slate-400 font-bold uppercase block mb-1.5">
                        Available Departments
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {data.hospital.specializations.map((spec, i) => (
                          <span
                            key={i}
                            className="bg-slate-100 text-slate-700 font-semibold px-2.5 py-0.5 rounded-lg text-[11px]"
                          >
                            {spec}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* SECTION C: OPERATIONAL TELEMETRY & WAITING TIMES */}
              <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-xs">
                <div className="flex items-center gap-2 mb-3">
                  <Clock className="w-4 h-4 text-emerald-600" />
                  <h3 className="font-extrabold text-sm text-slate-900">Current Operational Status</h3>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs mb-3">
                  <div className="bg-emerald-50/60 border border-emerald-100 p-3 rounded-2xl">
                    <span className="text-[10px] text-emerald-800 font-bold uppercase block">Walk-In Status</span>
                    <span className="font-black text-emerald-700 mt-0.5 block text-sm">
                      {data.operational.available ? "Accepting Patients" : "Next Session Only"}
                    </span>
                  </div>

                  <div className="bg-blue-50/60 border border-blue-100 p-3 rounded-2xl">
                    <span className="text-[10px] text-blue-800 font-bold uppercase block">Active Queue</span>
                    <span className="font-black text-blue-900 mt-0.5 block text-sm">
                      {data.operational.currentQueue} Patients Waiting
                    </span>
                  </div>

                  <div className="bg-slate-50 border border-slate-150 p-3 rounded-2xl">
                    <span className="text-[10px] text-slate-500 font-bold uppercase block">Estimated Wait</span>
                    <span className="font-black text-slate-800 mt-0.5 block text-sm">
                      ~{data.operational.estimatedWaitMinutes} min
                    </span>
                  </div>
                </div>

                {data.operational.todaySchedule && (
                  <div className="bg-slate-50 p-3 rounded-2xl text-xs text-slate-600 flex items-center justify-between">
                    <span className="font-semibold">Today's Clinic Shift:</span>
                    <span className="font-bold text-slate-900">
                      {data.operational.todaySchedule.startTime} — {data.operational.todaySchedule.endTime}
                    </span>
                  </div>
                )}
              </div>

              {/* SECTION D: INFORMATION FRESHNESS */}
              <div className="bg-slate-50/70 border border-slate-100 rounded-3xl p-5 text-xs">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Data Freshness & Reliability
                  </span>
                  <span
                    className={`font-bold px-2.5 py-0.5 rounded-full text-[11px] ${
                      data.freshness.state === "live"
                        ? "bg-emerald-100 text-emerald-800"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    {data.freshness.displayText}
                  </span>
                </div>
                <p className="text-slate-500 leading-relaxed">
                  {data.freshness.reliabilityExplanation}
                </p>
              </div>

              {/* SECTION E: WHY THIS OPTION? */}
              {data.why && data.why.length > 0 && (
                <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-xs">
                  <div className="flex items-center gap-2 mb-3">
                    <ShieldCheck className="w-4 h-4 text-blue-600" />
                    <h3 className="font-extrabold text-sm text-slate-900">Why this recommendation?</h3>
                  </div>
                  <div className="space-y-2 text-xs">
                    {data.why.map((reason, idx) => (
                      <div key={idx} className="flex items-start gap-2 text-slate-700 font-medium">
                        <CheckCircle2 className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                        <span>{reason}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* SECTION F: ALTERNATIVE OPTIONS */}
              {data.alternatives && data.alternatives.length > 0 && (
                <div className="bg-white border border-slate-100 rounded-3xl p-5 shadow-xs">
                  <h3 className="font-extrabold text-sm text-slate-900 mb-3">
                    Other Specialists in {data.doctor.specialization}
                  </h3>
                  <div className="space-y-2.5">
                    {data.alternatives.map((alt) => (
                      <div
                        key={alt.doctorId}
                        className="bg-slate-50 p-3 rounded-2xl flex items-center justify-between gap-3 text-xs border border-slate-150"
                      >
                        <div>
                          <p className="font-extrabold text-slate-800">{alt.name}</p>
                          <p className="text-slate-400 font-medium text-[11px]">{alt.hospitalName}</p>
                        </div>
                        <div className="text-right">
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              alt.available ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-600"
                            }`}
                          >
                            {alt.available ? "Available" : "Next Session"}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : null}
        </div>

        {/* STICKY BOTTOM ACTION FOOTER */}
        <div className="sticky bottom-0 bg-white border-t border-slate-100 p-5 px-6 flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={onClose}
            className="text-xs font-bold text-slate-600 hover:text-slate-900 px-4 py-2.5 rounded-xl transition cursor-pointer"
          >
            Close Details
          </button>

          <button
            type="button"
            onClick={() => {
              if (data?.doctor) {
                onClose();
                onBook(data.doctor);
              }
            }}
            disabled={!data?.doctor || data?.operational?.available === false}
            className="flex-1 max-w-xs inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-extrabold px-6 py-3 rounded-2xl text-xs transition shadow-md active:scale-[0.98] cursor-pointer disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed"
          >
            <span>Proceed to Booking</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>

      </div>
    </div>
  );
}
