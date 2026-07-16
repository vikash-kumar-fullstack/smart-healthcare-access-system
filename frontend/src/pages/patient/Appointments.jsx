import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../../services/api";
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
  Heart
} from "lucide-react";

export default function Appointments() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("upcoming"); // 'upcoming' or 'history'
  const [activeQueue, setActiveQueue] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  // EMR Modal states
  const [selectedVisit, setSelectedVisit] = useState(null);
  const [selectedSummary, setSelectedSummary] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [modalLoading, setModalLoading] = useState(false);

  const loadData = async () => {
    try {
      setLoading(true);
      const [queueRes, historyRes] = await Promise.all([
        api.get("/queue/my").catch(() => null),
        api.get("/queue/history").catch(() => ({ data: { data: [] } }))
      ]);

      if (queueRes?.data?.success && queueRes.data.data) {
        setActiveQueue(queueRes.data.data);
      } else {
        setActiveQueue(null);
      }

      if (historyRes?.data?.success) {
        setHistory(historyRes.data.data);
      }
    } catch (err) {
      console.error("Failed to load appointments:", err);
      toast.error("Failed to sync appointments log.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

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
          Active Tokens ({activeQueue ? 1 : 0})
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
            <div className="bg-white rounded-3xl border border-slate-200/60 shadow-[0_4px_20px_rgba(0,0,0,0.02)] overflow-hidden">
              <div className="bg-gradient-to-br from-[#0F4C81] to-[#14B8A6] p-6 text-white text-left relative">
                <div className="absolute top-6 right-6 bg-white/10 px-3 py-1 rounded-lg border border-white/10 text-[10px] font-bold tracking-wider uppercase">
                  Active Booking
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
              {history.map((item) => (
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
                          {item.doctorSnapshot?.name ? `Dr. ${item.doctorSnapshot.name}` : "Clinical Practitioner"}
                        </h4>
                        <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                          item.status === "completed"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                            : "bg-rose-50 text-rose-700 border border-rose-100"
                        }`}>
                          {item.status}
                        </span>
                      </div>
                      <p className="text-xs text-slate-450 mt-1">
                        {item.doctorSnapshot?.specialization || "General Consultant"} · {item.doctorSnapshot?.hospitalName || "Affiliated Clinic"}
                      </p>
                      <p className="text-[10px] text-slate-400 mt-0.5">
                        {formatDate(item.createdAt)}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto self-stretch sm:self-auto shrink-0">
                    {item.visitId ? (
                      <button
                        onClick={() => handleViewSummary(item.visitId)}
                        className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 px-4.5 py-2.5 bg-slate-50 border border-slate-200 hover:bg-slate-100/70 rounded-xl text-xs font-bold text-slate-700 hover:text-slate-900 transition-all cursor-pointer"
                      >
                        <FileText className="h-4 w-4 text-[#0F4C81]" />
                        View Prescription
                      </button>
                    ) : (
                      <span className="text-[10px] text-slate-400 italic px-3">No EMR Record</span>
                    )}
                  </div>
                </div>
              ))}
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
