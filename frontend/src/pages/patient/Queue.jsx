import React, { useEffect, useState } from "react";
import api from "../../services/api";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";
import { useRealtime } from "../../components/RealtimeProvider";
import {
  Clock,
  User,
  Hospital,
  AlertCircle,
  Activity,
  CheckCircle2,
  Trash2,
  CalendarDays
} from "lucide-react";

const formatETA = (mins) => {
  if (mins === null || mins === undefined) return null;
  const rounded = Math.round(mins);
  if (rounded <= 0) return "Less than a minute";
  if (rounded === 1) return "~1 min";
  if (rounded < 60) return `~${rounded} mins`;
  const h = Math.floor(rounded / 60);
  const m = rounded % 60;
  if (m === 0) return `~${h} hr${h > 1 ? "s" : ""}`;
  return `~${h} hr ${m} min`;
};

const SESSION_INFO = {
  inactive: { text: "Session not started yet", color: "bg-slate-100 text-slate-600 border-slate-200" },
  active: { text: "Session is Live", color: "bg-emerald-50 text-emerald-700 border-emerald-250/20" },
  paused: { text: "Doctor on a break", color: "bg-amber-50 text-amber-700 border-amber-250/20" },
  closed: { text: "Session Closed", color: "bg-rose-50 text-rose-700 border-rose-250/20" }
};

const QUEUE_STATUS = {
  waiting: { label: "Waiting", color: "text-[#0F4C81] bg-[#0F4C81]/5 border-[#0F4C81]/15" },
  in_progress: { label: "Your Turn!", color: "text-[#14B8A6] bg-[#14B8A6]/10 border-[#14B8A6]/20 animate-pulse" },
  completed: { label: "Completed", color: "text-slate-700 bg-slate-100 border-slate-200" },
  cancelled: { label: "Cancelled", color: "text-rose-700 bg-rose-50 border-rose-200" },
  skipped: { label: "Skipped", color: "text-slate-500 bg-slate-50 border-slate-200" }
};

const TIMELINE_EVENTS = {
  BOOKED: { label: "Booking Confirmed", emoji: "📅", color: "text-blue-600 bg-blue-50 border-blue-200" },
  QUEUE_UPDATED: { label: "Queue Updated", emoji: "🔄", color: "text-slate-600 bg-slate-50 border-slate-200" },
  DOCTOR_DELAY: { label: "Doctor Delayed", emoji: "⏳", color: "text-amber-600 bg-amber-50 border-amber-200" },
  SESSION_STARTED: { label: "Session Started", emoji: "📡", color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
  YOUR_TURN: { label: "Your Turn Now", emoji: "🔔", color: "text-[#14B8A6] bg-teal-50 border-teal-200 animate-pulse" },
  CONSULTATION_STARTED: { label: "Consultation Started", emoji: "🩺", color: "text-indigo-650 bg-indigo-50 border-indigo-200" },
  VISIT_COMPLETED: { label: "Visit Completed", emoji: "✅", color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
  VISIT_CANCELLED: { label: "Visit Cancelled", emoji: "❌", color: "text-rose-600 bg-rose-50 border-rose-200" },
  NO_SHOW: { label: "No Show", emoji: "🔕", color: "text-rose-600 bg-rose-50 border-rose-200" },
  SUMMARY_UPDATED: { label: "Prescription Summary Saved", emoji: "📝", color: "text-purple-600 bg-purple-50 border-purple-200" }
};

export default function Queue() {
  const { subscribe } = useRealtime() || {};
  const [queue, setQueue] = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  const fetchTimeline = async (visitId) => {
    try {
      const res = await api.get(`/visits/${visitId}/timeline`);
      setTimeline(res.data.data.timeline || []);
    } catch (err) {
      console.error("Failed to fetch visit timeline:", err);
    }
  };

  const fetchQueue = async () => {
    try {
      const res = await api.get("/queue/my");
      const qData = res.data.data;
      setQueue(qData);
      if (qData?.visitId) {
        await fetchTimeline(qData.visitId);
      } else {
        setTimeline([]);
      }
    } catch (err) {
      if (err.response?.status !== 404) console.error(err);
      setQueue(null);
      setTimeline([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
    const interval = setInterval(fetchQueue, 20000); // refresh every 20s
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!subscribe) return;
    const handleUpdate = () => {
      fetchQueue();
    };

    const unsubQueue = subscribe("QUEUE_UPDATED", handleUpdate);
    const unsubVisitStart = subscribe("VISIT_STARTED", handleUpdate);
    const unsubVisitComplete = subscribe("VISIT_COMPLETED", handleUpdate);
    const unsubEmr = subscribe("EMR_UPDATED", handleUpdate);
    const unsubReassign = subscribe("QUEUE_REASSIGNED", handleUpdate);
    const unsubPause = subscribe("SESSION_PAUSED", handleUpdate);

    return () => {
      unsubQueue();
      unsubVisitStart();
      unsubVisitComplete();
      unsubEmr();
      unsubReassign();
      unsubPause();
    };
  }, [subscribe]);

  const handleCancel = async () => {
    const confirmed = window.confirm("Are you sure you want to cancel your active queue token?");
    if (!confirmed) return;

    const t = toast.loading("Cancelling your queue token...");
    try {
      await api.patch("/queue/cancel");
      toast.success("Booking cancelled successfully.", { id: t });
      setQueue(null);
      navigate("/patient");
    } catch (err) {
      toast.error(err.response?.data?.message || "Cancellation failed", { id: t });
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="animate-spin rounded-full h-9 w-9 border-b-2 border-[#0F4C81] mb-4" />
        <p className="text-slate-400 text-xs">Fetching active queue status...</p>
      </div>
    );
  }

  if (!queue) {
    return (
      <div className="flex items-center justify-center py-16 px-4">
        <div className="bg-white rounded-3xl border border-slate-200/60 shadow-sm p-10 max-w-sm w-full text-center">
          <div className="w-14 h-14 rounded-2xl bg-cyan-50 text-[#0F4C81] flex items-center justify-center mx-auto mb-5">
            <Hospital className="h-7 w-7" />
          </div>
          <h2 className="text-lg font-black text-slate-800 tracking-tight">No Active Queue Token</h2>
          <p className="text-slate-500 text-xs mt-2.5 mb-6 leading-relaxed">
            You do not hold any live appointments or active queue bookings at this time.
          </p>
          <button
            onClick={() => navigate("/patient")}
            className="w-full bg-[#0F4C81] hover:bg-[#0A5F76] transition-colors text-white h-11 rounded-xl font-bold text-xs cursor-pointer shadow-md"
          >
            Find Doctor & Book Token
          </button>
        </div>
      </div>
    );
  }

  const sessionStatus = queue.sessionStatus || (queue.sessionActive ? "active" : "inactive");
  const sessionCfg = SESSION_INFO[sessionStatus] || SESSION_INFO.inactive;
  const queueStatusCfg = QUEUE_STATUS[queue.status] || { label: queue.status, color: "text-slate-600 bg-slate-100 border-slate-200" };
  const eta = formatETA(queue.eta);
  const isInProgress = queue.status === "in_progress";

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Page Header */}
      <div className="text-left">
        <h1 className="text-2xl font-black text-slate-800 tracking-tight">Live Queue Tracker</h1>
        <p className="text-slate-400 text-xs mt-1">Real-time coordinates synced with practitioner session speeds</p>
      </div>

      {/* Your Turn Alert banner */}
      {isInProgress && (
        <div className="bg-[#14B8A6] text-white rounded-2xl p-5 text-center shadow-lg animate-bounce">
          <h2 className="text-lg font-extrabold">🏥 Proceed to Room</h2>
          <p className="text-cyan-50 text-xs mt-1.5 font-bold">
            It is your turn now! Please walk inside the doctor's consultation office.
          </p>
        </div>
      )}

      {/* ── Main Queue Info Card ── */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200/60 overflow-hidden text-left">
        
        {/* Card Header (Stats summary) */}
        <div className="bg-gradient-to-br from-cyan-50/50 to-teal-50/10 px-6 py-8 text-center border-b border-slate-150 flex flex-col items-center">
          <p className="text-[10px] font-extrabold text-slate-450 uppercase tracking-widest mb-1.5">
            Patients Ahead of You
          </p>
          <div className="text-6xl font-black text-[#0F4C81] leading-none">
            {queue.patientsAhead}
          </div>
          
          <div className="flex flex-col items-center gap-2 mt-4">
            <span className={`px-3 py-1 rounded-full text-[10px] font-extrabold border uppercase tracking-wider ${queueStatusCfg.color}`}>
              {queueStatusCfg.label}
            </span>
            {queue.isPriority && (
              <span className="bg-amber-50 text-amber-800 border border-amber-200 rounded-full text-[9px] font-bold px-2 py-0.5 animate-pulse">
                🌟 Priority Booking
              </span>
            )}
          </div>
        </div>

        {/* Info Grid */}
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between py-2.5 border-b border-slate-100">
            <span className="text-xs text-slate-500 font-semibold flex items-center gap-2">
              <User className="h-4.5 w-4.5 text-slate-450" /> Clinic Doctor
            </span>
            <span className="text-xs font-bold text-slate-800">
              Dr. {queue.doctorName || "Practitioner"}
            </span>
          </div>

          <div className="flex items-center justify-between py-2.5 border-b border-slate-100">
            <span className="text-xs text-slate-500 font-semibold flex items-center gap-2">
              <Hospital className="h-4.5 w-4.5 text-slate-450" /> Medical Facility
            </span>
            <span className="text-xs font-bold text-slate-800">
              {queue.doctorId?.hospitalId?.name || "Clinic"}
            </span>
          </div>

          <div className="flex items-center justify-between py-2.5 border-b border-slate-100">
            <span className="text-xs text-slate-500 font-semibold flex items-center gap-2">
              <Clock className="h-4.5 w-4.5 text-slate-450" /> Estimated Wait
            </span>
            <span className="text-xs font-bold text-slate-850">
              {eta ? eta : sessionStatus === "inactive" ? "Waiting for session start" : "Calculating..."}
            </span>
          </div>

          <div className="flex items-center justify-between py-2.5">
            <span className="text-xs text-slate-500 font-semibold flex items-center gap-2">
              <Activity className="h-4.5 w-4.5 text-slate-450" /> Session Status
            </span>
            <span className={`text-[10px] font-extrabold px-2.5 py-1 rounded-full border uppercase tracking-wider ${sessionCfg.color}`}>
              {sessionCfg.text}
            </span>
          </div>
        </div>
      </div>

      {/* ── Progress Tracker / Step Timeline ── */}
      <div className="bg-white rounded-3xl border border-slate-200/60 p-6 text-left">
        <h4 className="text-sm font-black text-slate-800 tracking-tight mb-5 flex items-center gap-1.5">
          <CalendarDays className="h-4.5 w-4.5 text-[#0F4C81]" /> Event Timeline History
        </h4>

        {timeline.length > 0 ? (
          <div className="relative border-l-2 border-slate-150 ml-3 space-y-6">
            {timeline.map((event, idx) => {
              const config = TIMELINE_EVENTS[event.eventType] || {
                label: event.eventType,
                emoji: "📍",
                color: "text-slate-600 bg-slate-50 border-slate-250/30"
              };
              const timeStr = new Date(event.occurredAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit"
              });
              return (
                <div key={event._id || idx} className="relative pl-6">
                  {/* Event indicator node */}
                  <div className={`absolute -left-[13px] top-0.5 w-6 h-6 rounded-full border flex items-center justify-center text-[10px] shadow-sm bg-white font-normal ${config.color}`}>
                    {config.emoji}
                  </div>
                  <div>
                    <h6 className="font-extrabold text-xs text-slate-800">{config.label}</h6>
                    <p className="text-[11px] text-slate-500 mt-1 leading-normal">{event.message}</p>
                    <span className="text-[9px] text-slate-400 mt-1.5 block font-medium">{timeStr}</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-slate-400 italic">No queue events logged yet. Stay tuned.</p>
        )}
      </div>

      {/* ── Actions ── */}
      {queue.status === "waiting" && (
        <button
          onClick={handleCancel}
          className="w-full h-12 bg-rose-50 text-rose-600 border border-rose-200 hover:bg-rose-100 transition-colors rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 cursor-pointer"
        >
          <Trash2 className="h-4.5 w-4.5" />
          Cancel Active Queue Token
        </button>
      )}
    </div>
  );
}
