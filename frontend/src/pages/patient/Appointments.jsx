import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../../services/api";
import { getCachedData, setCachedData } from "../../services/apiCache";
import { useRealtime } from "../../components/RealtimeProvider";
import { formatTime12, formatConsultationWindow } from "../../utils/formatters";
import toast from "react-hot-toast";
import {
  Calendar,
  Clock,
  User,
  Building,
  AlertCircle,
  FileText,
  Trash2,
  ChevronRight,
  Sparkles,
  ArrowRight,
  Heart,
  Activity
} from "lucide-react";

export default function Appointments() {
  const navigate = useNavigate();
  const cachedQueue = getCachedData("patient_queue");
  const cachedHistory = getCachedData("patient_history");

  const [activeTab, setActiveTab] = useState("upcoming"); // 'upcoming' or 'history'
  const [activeQueue, setActiveQueue] = useState(cachedQueue || null);
  const [history, setHistory] = useState(cachedHistory || []);
  const [loading, setLoading] = useState(!cachedQueue && !cachedHistory);

  // EMR Modal states
  const [selectedVisit, setSelectedVisit] = useState(null);
  const [selectedSummary, setSelectedSummary] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);

  const loadData = async () => {
    try {
      const [queueRes, historyRes] = await Promise.all([
        api.get("/queue/my").catch(() => null),
        api.get("/queue/history").catch(() => ({ data: { data: [] } }))
      ]);

      if (queueRes?.data?.success && queueRes.data.data) {
        setActiveQueue(queueRes.data.data);
        setCachedData("patient_queue", queueRes.data.data);
      } else {
        setActiveQueue(null);
        setCachedData("patient_queue", null);
      }

      if (historyRes?.data?.success) {
        const rawData = Array.isArray(historyRes.data.data) ? historyRes.data.data : [];
        const uniqueMap = new Map();
        rawData.forEach((item) => {
          const vId = typeof item.visitId === "object" ? item.visitId?._id : item.visitId;
          const doctor = (item.doctorName || "").toLowerCase().trim();
          const bookedTime = item.bookedAt ? new Date(item.bookedAt).getTime() : "";

          const key = vId ? `v_${vId}` : `d_${doctor}_${bookedTime}`;
          if (!uniqueMap.has(key)) {
            uniqueMap.set(key, item);
          }
        });
        const deduplicated = Array.from(uniqueMap.values());
        setHistory(deduplicated);
        setCachedData("patient_history", deduplicated);
      }
    } catch (err) {
      console.error("Failed to load appointments:", err);
      toast.error("Failed to sync appointments log.");
    } finally {
      setLoading(false);
    }
  };

  const { subscribe } = useRealtime() || {};

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (!subscribe) return;
    const unsub = subscribe("QUEUE_UPDATED", () => {
      loadData();
    });
    return () => unsub?.();
  }, [subscribe]);

  const handleCancelQueue = async () => {
    if (!window.confirm("Are you sure you want to cancel your queue booking? This action cannot be undone.")) {
      return;
    }
    const loadingToast = toast.loading("Cancelling booking...");
    try {
      await api.patch("/queue/cancel");
      toast.success("Booking cancelled successfully", { id: loadingToast });
      setActiveQueue(null);
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to cancel booking.", { id: loadingToast });
    }
  };

  const handleViewSummary = async (visitId) => {
    setModalLoading(true);
    setModalOpen(true);
    setSelectedVisit(null);
    setSelectedSummary(null);
    try {
      const [visitRes, summaryRes] = await Promise.all([
        api.get(`/visits/${visitId}`).catch(() => null),
        api.get(`/visits/${visitId}/summary`).catch(() => null)
      ]);
      if (visitRes?.data?.success) setSelectedVisit(visitRes.data.data.visit);
      if (summaryRes?.data?.success) setSelectedSummary(summaryRes.data.data.summary);
    } catch (err) {
      console.error("Failed to fetch medical summary:", err);
      toast.error("Could not load medical summary.");
      setModalOpen(false);
    } finally {
      setModalLoading(false);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "N/A";
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Title Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Appointments Hub</h1>
          <p className="text-xs text-slate-500 mt-1">Manage active queue tokens, view ETA, and review prescription logs.</p>
        </div>
        <Link
          to="/patient/search"
          className="inline-flex items-center justify-center gap-2 px-5 h-10.5 rounded-xl text-xs font-bold text-white bg-[#0E7490] hover:bg-[#0c5f76] transition-all cursor-pointer shadow-sm hover:shadow active:scale-95"
        >
          Book New Consultation
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200 gap-6">
        <button
          onClick={() => setActiveTab("upcoming")}
          className={`pb-3 text-xs font-extrabold transition-all border-b-2 cursor-pointer ${
            activeTab === "upcoming"
              ? "border-[#0F4C81] text-[#0F4C81]"
              : "border-transparent text-slate-500 hover:text-slate-850"
          }`}
        >
          {activeQueue?.isLiveQueue ? "Active Queue (1)" : activeQueue?.isUpcoming ? "Upcoming Appointments (1)" : "Upcoming & Queue (0)"}
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`pb-3 text-xs font-extrabold transition-all border-b-2 cursor-pointer ${
            activeTab === "history"
              ? "border-[#0F4C81] text-[#0F4C81]"
              : "border-transparent text-slate-500 hover:text-slate-850"
          }`}
        >
          Consultation History ({history.length})
        </button>
      </div>

      {/* Main Content Pane */}
      {loading ? (
        <div className="py-16 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0F4C81] mx-auto mb-3" />
          <p className="text-slate-500 text-xs font-medium">Syncing appointment records...</p>
        </div>
      ) : activeTab === "upcoming" ? (
        <div className="space-y-6">
          {activeQueue ? (
            activeQueue.isLiveQueue ? (
              /* Genuine Live Queue Card */
              <div className="bg-white rounded-3xl border border-slate-200/60 shadow-[0_4px_20px_rgba(0,0,0,0.02)] overflow-hidden">
                <div className="bg-gradient-to-br from-[#0F4C81] to-[#14B8A6] p-6 text-white text-left relative">
                  <div className="absolute top-6 right-6 bg-white/10 px-3 py-1 rounded-lg border border-white/10 text-[10px] font-bold tracking-wider uppercase">
                    Live Queue Ticket
                  </div>
                  <p className="text-xs text-teal-100 font-bold uppercase tracking-wider">Virtual Queue Pass</p>
                  <h3 className="text-2xl font-black mt-2 tracking-tight">
                    {activeQueue.arrivalStatus === "CHECKED_IN" 
                      ? `Token #${activeQueue.queueNumber || "Pending"}` 
                      : `Booking Ref: ${activeQueue.bookingNumber || "Pending"}`}
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 border-t border-white/10 pt-4 text-xs">
                    <div>
                      <span className="text-teal-100/70 block">Estimated Wait</span>
                      <span className="font-extrabold text-sm">{activeQueue.estimatedWaitMins ? `~${Math.round(activeQueue.estimatedWaitMins)} min` : "Calculating..."}</span>
                    </div>
                    <div>
                      <span className="text-teal-100/70 block">Position in Line</span>
                      <span className="font-extrabold text-sm">#{activeQueue.positionAhead !== undefined ? activeQueue.positionAhead + 1 : "Calculating..."}</span>
                    </div>
                    <div>
                      <span className="text-teal-100/70 block">Session Status</span>
                      <span className="font-extrabold text-sm capitalize">{activeQueue.sessionStatus || "Active"}</span>
                    </div>
                    <div>
                      <span className="text-teal-100/70 block">Booked At</span>
                      <span className="font-extrabold text-sm">{new Date(activeQueue.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                  </div>
                </div>

                <div className="p-6 space-y-6 text-left">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-200/50 flex items-center justify-center text-[#0F4C81] font-bold shadow-sm shrink-0">
                        <User className="h-6 w-6" />
                      </div>
                      <div>
                        <h4 className="text-base font-black text-slate-800">Dr. {activeQueue.doctorId?.name || activeQueue.doctorId?.userId?.name || "Consulting Practitioner"}</h4>
                        <p className="text-xs text-slate-450 mt-0.5">{activeQueue.doctorId?.specialization || "General Medicine"} · {activeQueue.hospitalId?.name || activeQueue.doctorId?.hospitalId?.name || "Affiliated Hospital"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <button
                        onClick={() => navigate("/patient/queue")}
                        className="px-4 py-2 border border-slate-200 hover:border-slate-350 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-bold transition-all cursor-pointer"
                      >
                        Track Progress
                      </button>
                      <button
                        onClick={handleCancelQueue}
                        className="px-4 py-2 border border-rose-200 text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <Trash2 className="h-4 w-4" />
                        Cancel Spot
                      </button>
                    </div>
                  </div>

                  <div className="bg-slate-50 p-4.5 rounded-2xl border border-slate-150/50 flex items-start gap-3">
                    <AlertCircle className="h-5 w-5 text-[#0F4C81] shrink-0 mt-0.5" />
                    <div>
                      <h5 className="text-xs font-extrabold text-slate-800">Check-in Instructions</h5>
                      <p className="text-[11px] text-slate-500 leading-relaxed mt-1">
                        Please head to the hospital reception desk at least 10 minutes before your estimated time. Show this ticket token pass to the counter personnel for check-in validation. If you miss your turn, you will be skipped.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              /* Scheduled Upcoming Appointment Card */
              <div className="bg-white rounded-3xl border border-slate-200/60 shadow-[0_4px_20px_rgba(0,0,0,0.02)] overflow-hidden text-left">
                <div className="bg-gradient-to-br from-[#1E293B] to-[#334155] p-6 text-white relative">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="px-2.5 py-1 rounded-full text-[10px] font-extrabold tracking-wide uppercase bg-sky-500/20 text-sky-200 border border-sky-400/30">
                        Upcoming Appointment
                      </span>
                      <h3 className="text-xl font-black mt-2 tracking-tight">
                        {activeQueue.hospitalId?.name || activeQueue.doctorId?.hospitalId?.name || "Affiliated Medical Center"}
                      </h3>
                      <p className="text-xs text-slate-300 mt-1">
                        Ref: {activeQueue.bookingNumber || "Confirmed"}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="inline-flex flex-col items-end bg-white/10 px-4 py-2 rounded-2xl border border-white/10">
                        <span className="text-[10px] uppercase tracking-wider text-slate-300 font-bold">Appointment Date</span>
                        <span className="text-base font-black text-white">{activeQueue.date || "Scheduled Date"}</span>
                        <span className="text-xs font-bold text-sky-200 mt-0.5">{activeQueue.slotTime || ""} Session</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="p-6 space-y-6">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-2xl bg-sky-50 border border-sky-100 flex items-center justify-center text-[#0F4C81] font-bold shadow-sm shrink-0">
                        <User className="h-6 w-6" />
                      </div>
                      <div>
                        <h4 className="text-base font-black text-slate-800">
                          Dr. {activeQueue.doctorId?.name || "Consulting Practitioner"}
                        </h4>
                        <p className="text-xs text-slate-500 mt-0.5 font-medium">
                          {activeQueue.doctorId?.specialization || "General Medicine"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <button
                        onClick={handleCancelQueue}
                        className="px-4 py-2 border border-rose-200 text-rose-600 hover:bg-rose-50 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer"
                      >
                        <Trash2 className="h-4 w-4" />
                        Cancel Appointment
                      </button>
                    </div>
                  </div>

                  {/* Live Clinic Status Card (Derived estimate) */}
                  {activeQueue.estimatedConsultationWindow ? (
                    <div className="bg-sky-50/50 p-4.5 rounded-2xl border border-sky-150/70 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Activity className="h-4 w-4 text-[#0F4C81]" />
                          <h5 className="text-xs font-black text-slate-800 uppercase tracking-wider">Live Clinic Status</h5>
                        </div>
                        {activeQueue.estimatedConsultationWindow.isPaused ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-50 text-amber-800 border border-amber-200">
                            Doctor on break
                          </span>
                        ) : activeQueue.estimatedConsultationWindow.delayMinutes > 5 ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-50 text-amber-800 border border-amber-200">
                            ~{activeQueue.estimatedConsultationWindow.delayMinutes} min behind schedule
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            On schedule
                          </span>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        <div className="bg-white p-3 rounded-xl border border-sky-100">
                          <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">Estimated Consultation</span>
                          <span className="text-sm font-black text-[#0F4C81] mt-0.5 block">
                            {formatConsultationWindow(activeQueue.estimatedConsultationWindow)}
                          </span>
                        </div>
                        <div className="bg-white p-3 rounded-xl border border-sky-100">
                          <span className="text-[10px] text-slate-400 font-extrabold uppercase tracking-wider block">Scheduled Arrival Slot</span>
                          <span className="text-sm font-bold text-slate-850 mt-0.5 block">
                            {formatTime12(activeQueue.slotTime)} (Authoritative)
                          </span>
                        </div>
                      </div>

                      <p className="text-[10px] text-slate-500 italic leading-relaxed pt-1">
                        * Note: Clinic delays do not change your scheduled check-in window. Please complete check-in on time by {formatTime12(activeQueue.slotTime)} to secure your turn.
                      </p>
                    </div>
                  ) : activeQueue.isToday && activeQueue.sessionStatus === "inactive" ? (
                    <div className="bg-slate-50 p-4 rounded-2xl border border-slate-150/60 flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <Clock className="h-4 w-4 text-slate-400" />
                        <span className="text-xs text-slate-600 font-bold">Clinic session has not opened yet today.</span>
                      </div>
                      <span className="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-md bg-slate-200 text-slate-650">
                        Scheduled: {formatTime12(activeQueue.slotTime)}
                      </span>
                    </div>
                  ) : null}

                  <div className="bg-slate-50 p-4.5 rounded-2xl border border-slate-150/50 flex items-start gap-3">
                    <Calendar className="h-5 w-5 text-[#0F4C81] shrink-0 mt-0.5" />
                    <div>
                      <h5 className="text-xs font-extrabold text-slate-800">Appointment Check-in Information</h5>
                      <p className="text-[11px] text-slate-500 leading-relaxed mt-1">
                        Your appointment is scheduled for {activeQueue.date || "your selected date"} at {formatTime12(activeQueue.slotTime) || "the booked time"}. Check-in will open 30 minutes before your slot time at the clinic reception desk or through your mobile portal.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )
          ) : (
            <div className="bg-white rounded-3xl border border-slate-200/60 p-10 text-center text-slate-500 shadow-sm max-w-lg mx-auto mt-6">
              <div className="w-14 h-14 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-[#0F4C81] mx-auto mb-4">
                <Calendar className="h-6 w-6" />
              </div>
              <h3 className="font-extrabold text-slate-800 text-base">No active appointments</h3>
              <p className="text-slate-400 text-xs mt-1.5 leading-relaxed">
                You do not have any active appointments or live queue bookings at the moment. Find clinics nearby to secure a token.
              </p>
              <button
                onClick={() => navigate("/patient/search")}
                className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-[#0E7490] hover:bg-[#0c5f76] transition-all cursor-pointer"
              >
                Find Medical Clinics
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {history.length === 0 ? (
            <div className="bg-white rounded-3xl border border-slate-200/60 p-10 text-center text-slate-550 shadow-sm max-w-lg mx-auto mt-6">
              <p className="font-extrabold text-slate-850">No past visits</p>
              <p className="text-slate-450 text-xs mt-1">Your completed and cancelled consultations log will appear here.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {history.map((item) => {
                const isNoShow = item.status === "no_show" || item.outcome === "Missed appointment" || item.outcome === "No-Show";
                const isCompleted = item.status === "completed" || item.outcome === "Completed consultation" || item.outcome === "Visited";
                const isCancelled = item.status === "cancelled" || item.outcome === "Cancelled appointment" || item.outcome === "Cancelled";

                const statusLabel = isNoShow
                  ? "Missed appointment"
                  : isCompleted
                    ? "Completed consultation"
                    : isCancelled
                      ? "Cancelled appointment"
                      : "Missed turn";

                const badgeClass = isNoShow
                  ? "bg-rose-50 text-rose-700 border border-rose-200"
                  : isCompleted
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                    : "bg-slate-100 text-slate-600 border border-slate-200";

                return (
                  <div
                    key={item.queueId}
                    className="bg-white rounded-2xl border border-slate-200/60 p-5 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 hover:shadow-sm hover:border-slate-300/80 transition-all text-left"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-11 h-11 rounded-xl bg-slate-50 border border-slate-200/50 text-[#0F4C81] flex items-center justify-center font-bold shrink-0 shadow-sm">
                        <Building className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-black text-slate-800">
                            {item.doctorName ? item.doctorName : item.doctorSnapshot?.name ? `Dr. ${item.doctorSnapshot.name}` : "Clinical Practitioner"}
                          </h4>
                          <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${badgeClass}`}>
                            {statusLabel}
                          </span>
                        </div>
                        <p className="text-xs text-slate-450 mt-1">
                          {item.specialization || item.doctorSnapshot?.specialization || "General Consultant"} · {item.hospitalName || item.doctorSnapshot?.hospitalName || "Affiliated Clinic"}
                        </p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {formatDate(item.bookedAt || item.createdAt)}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto self-stretch sm:self-auto shrink-0">
                      <button
                        onClick={() => navigate("/patient/search")}
                        className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-slate-50 border border-slate-200 hover:bg-slate-100/70 rounded-xl text-xs font-bold text-slate-700 hover:text-slate-900 transition-all cursor-pointer"
                      >
                        Book Again
                      </button>
                      {item.visitId ? (
                        <button
                          onClick={() => handleViewSummary(item.visitId)}
                          className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-3.5 py-2 bg-slate-50 border border-slate-200 hover:bg-slate-100/70 rounded-xl text-xs font-bold text-slate-700 hover:text-slate-900 transition-all cursor-pointer"
                        >
                          <FileText className="h-4 w-4 text-[#0F4C81]" />
                          View Prescription
                        </button>
                      ) : (
                        <span className="text-[10px] text-slate-400 italic px-2">No Prescription</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── EMR Summary Modal ──────────────────────────────────────────────── */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-200 text-left">
            {/* Header */}
            <div className="bg-slate-50 border-b border-slate-200 px-6 py-4.5 flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-slate-800 flex items-center gap-2">
                  <span>📋</span> EMR Medical Summary
                </h3>
                {selectedVisit && (
                  <p className="text-[10px] text-slate-400 font-mono mt-1">
                    Visit ID: {selectedVisit.publicId}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-base font-bold p-1 cursor-pointer transition-colors"
              >
                ✕
              </button>
            </div>

            {/* Content */}
            <div className="p-6 overflow-y-auto max-h-[65vh] space-y-5">
              {modalLoading ? (
                <div className="py-12 text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0F4C81] mx-auto mb-3" />
                  <p className="text-slate-500 text-xs">Fetching clinical diagnosis...</p>
                </div>
              ) : selectedVisit ? (
                <>
                  {/* Doctor Info Card */}
                  <div className="bg-gradient-to-br from-[#E6FFFB]/35 to-slate-50 p-4 rounded-2xl border border-slate-200/50">
                    <p className="text-[9px] text-[#0E7490] uppercase tracking-wider font-extrabold">Practitioner In Charge</p>
                    <h4 className="text-sm font-black text-slate-800 mt-1">Dr. {selectedVisit.doctorSnapshot.name}</h4>
                    <p className="text-[11px] text-slate-500 mt-0.5">{selectedVisit.doctorSnapshot.specialization} · {selectedVisit.doctorSnapshot.hospitalName}</p>
                  </div>

                  <div className="space-y-4">
                    {/* Chief Complaint */}
                    <div className="space-y-1">
                      <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Chief Complaint</span>
                      <p className="text-xs font-semibold text-slate-800 bg-slate-50 p-3 rounded-xl border border-slate-200/50">{selectedSummary?.chiefComplaint || "N/A"}</p>
                    </div>

                    {/* Consultation Summary */}
                    <div className="space-y-1">
                      <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Clinical Summary</span>
                      <p className="text-xs text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-200/50 whitespace-pre-line leading-relaxed">{selectedSummary?.consultationSummary || "N/A"}</p>
                    </div>

                    {/* Vitals and clinical notes */}
                    {selectedSummary?.visibility === "patient" && (
                      <div className="space-y-1">
                        <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Vitals & Clinical Notes</span>
                        <p className="text-xs text-slate-700 bg-slate-50 p-3 rounded-xl border border-slate-200/50 whitespace-pre-line leading-relaxed">{selectedSummary?.doctorNotes || "N/A"}</p>
                      </div>
                    )}

                    {/* Follow-up Advice */}
                    {selectedSummary?.followUpAdvice && (
                      <div className="space-y-1">
                        <span className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider">Follow-up & Advice</span>
                        <p className="text-xs text-teal-800 bg-[#E6FFFB]/25 p-3 rounded-xl border border-teal-100 whitespace-pre-line leading-relaxed">
                          📌 {selectedSummary.followUpAdvice}
                        </p>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <p className="text-center text-slate-500 text-xs py-8">No EMR summary details available.</p>
              )}
            </div>

            {/* Footer */}
            <div className="bg-slate-50 border-t border-slate-200 px-6 py-4 flex justify-end">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-5 py-2.5 bg-slate-200 hover:bg-slate-350 text-slate-750 font-bold rounded-xl text-xs transition cursor-pointer"
              >
                Close Prescription
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
