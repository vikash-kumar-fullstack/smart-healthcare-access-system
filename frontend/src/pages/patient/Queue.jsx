import { useEffect, useState } from "react";
import api from "../../services/api";
import toast from "react-hot-toast";
import { useNavigate } from "react-router-dom";

// ─── Format ETA the way real hospital systems display it ─────────────────────
const formatETA = (mins) => {
  if (mins === null || mins === undefined) return null;
  const rounded = Math.round(mins); // Always whole minutes, no decimals
  if (rounded <= 0) return "Less than a minute";
  if (rounded === 1) return "~1 min";
  if (rounded < 60) return `~${rounded} mins`;
  const h = Math.floor(rounded / 60);
  const m = rounded % 60;
  if (m === 0) return `~${h} hr${h > 1 ? "s" : ""}`;
  return `~${h} hr ${m} min`;
};

// ─── Session status display ──────────────────────────────────────────────────
const SESSION_INFO = {
  inactive: {
    text: "Session not started yet",
    hint: "Please arrive on time. The doctor will start soon.",
    color: "bg-gray-100 text-gray-600 border-gray-200"
  },
  active: {
    text: "Session is Live",
    hint: null,
    color: "bg-green-100 text-green-700 border-green-200"
  },
  paused: {
    text: "Doctor on a short break",
    hint: "Please stay nearby. The session will resume soon.",
    color: "bg-yellow-100 text-yellow-700 border-yellow-200"
  },
  closed: {
    text: "Session Closed",
    hint: "The doctor has ended today's session.",
    color: "bg-red-100 text-red-700 border-red-200"
  }
};

// ─── Queue status display ────────────────────────────────────────────────────
const QUEUE_STATUS = {
  waiting:     { label: "Waiting",     color: "text-yellow-700 bg-yellow-100" },
  in_progress: { label: "Your Turn!",  color: "text-blue-700 bg-blue-100" },
  completed:   { label: "Completed",   color: "text-green-700 bg-green-100" },
  cancelled:   { label: "Cancelled",   color: "text-red-700 bg-red-100" },
  skipped:     { label: "Skipped",     color: "text-gray-600 bg-gray-100" },
  unavailable: { label: "Unavailable", color: "text-red-700 bg-red-100" }
};

const TIMELINE_EVENTS = {
  BOOKED: { label: "Booking Confirmed", emoji: "📅", color: "text-blue-600 bg-blue-50 border-blue-200" },
  QUEUE_UPDATED: { label: "Queue Updated", emoji: "🔄", color: "text-gray-600 bg-gray-50 border-gray-200" },
  DOCTOR_DELAY: { label: "Doctor Delayed", emoji: "⏳", color: "text-amber-600 bg-amber-50 border-amber-200" },
  SESSION_STARTED: { label: "Session Started", emoji: "📡", color: "text-green-600 bg-green-50 border-green-200" },
  YOUR_TURN: { label: "Your Turn Now", emoji: "🔔", color: "text-blue-600 bg-blue-50 border-blue-200 animate-pulse" },
  CONSULTATION_STARTED: { label: "Consultation In Progress", emoji: "🩺", color: "text-indigo-600 bg-indigo-50 border-indigo-200" },
  VISIT_COMPLETED: { label: "Visit Completed", emoji: "✅", color: "text-green-600 bg-green-50 border-green-200" },
  VISIT_CANCELLED: { label: "Visit Cancelled", emoji: "❌", color: "text-red-600 bg-red-50 border-red-200" },
  NO_SHOW: { label: "No Show", emoji: "🔕", color: "text-red-600 bg-red-50 border-red-200" },
  SUMMARY_UPDATED: { label: "EMR Summary Saved", emoji: "📝", color: "text-purple-600 bg-purple-50 border-purple-200" }
};

export default function Queue() {

  const [queue, setQueue]   = useState(null);
  const [timeline, setTimeline] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate            = useNavigate();

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
      // 404 = no active booking — that's fine
      if (err.response?.status !== 404) console.error(err);
      setQueue(null);
      setTimeline([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchQueue();
    const interval = setInterval(fetchQueue, 10000); // live refresh every 10s
    return () => clearInterval(interval);
  }, []);

  const handleCancel = async () => {
    const confirmed = window.confirm("Are you sure you want to cancel your booking?");
    if (!confirmed) return;

    const t = toast.loading("Cancelling booking...");
    try {
      await api.patch("/queue/cancel");
      toast.success("Booking cancelled successfully.", { id: t });
      setQueue(null);
      navigate("/patient");
    } catch (err) {
      toast.error(err.response?.data?.message || "Cancel failed", { id: t });
    }
  };

  // ── Loading state ──────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Fetching your queue status...</p>
        </div>
      </div>
    );
  }

  // ── No booking state ───────────────────────────────────────────────────────
  if (!queue) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl shadow-sm border p-10 max-w-sm w-full text-center">
          <div className="text-5xl mb-4">🏥</div>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">No Active Booking</h2>
          <p className="text-gray-500 text-sm mb-6">
            You don't have any active queue booking right now.
          </p>
          <button
            onClick={() => navigate("/patient")}
            className="bg-blue-500 hover:bg-blue-600 transition text-white px-6 py-2.5 rounded-lg font-medium text-sm"
          >
            Book a Doctor
          </button>
        </div>
      </div>
    );
  }

  const sessionStatus = queue.sessionStatus || (queue.sessionActive ? "active" : "inactive");
  const sessionCfg    = SESSION_INFO[sessionStatus] || SESSION_INFO.inactive;
  const queueStatusCfg = QUEUE_STATUS[queue.status] || { label: queue.status, color: "text-gray-600 bg-gray-100" };
  const eta           = formatETA(queue.eta);
  const isInProgress  = queue.status === "in_progress";

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4">
      <div className="max-w-lg mx-auto space-y-4">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Your Queue Status</h1>
          <p className="text-gray-500 text-sm mt-1">Live updates every 10 seconds</p>
        </div>

        {/* ── It's Your Turn Alert ────────────────────────────────────────── */}
        {isInProgress && (
          <div className="bg-blue-600 text-white rounded-2xl p-5 text-center shadow-lg">
            <div className="text-3xl mb-2">🔔</div>
            <h2 className="text-xl font-bold">It's Your Turn!</h2>
            <p className="text-blue-200 text-sm mt-1">
              Please proceed to the consultation room now.
            </p>
          </div>
        )}

        {/* ── Next in Line Alert ──────────────────────────────────────────── */}
        {queue.isNext && !isInProgress && (
          <div className="bg-yellow-50 border border-yellow-300 text-yellow-800 rounded-2xl p-4 flex items-start gap-3">
            <span className="text-xl">🔥</span>
            <div>
              <p className="font-semibold text-sm">You're next in line!</p>
              <p className="text-xs mt-0.5">Please be ready and stay nearby.</p>
            </div>
          </div>
        )}

        {/* ── Main Queue Card ─────────────────────────────────────────────── */}
        <div className="bg-white rounded-2xl shadow-sm border overflow-hidden">

          {/* Patients ahead hero section */}
          <div className="bg-gradient-to-br from-blue-50 to-indigo-50 px-6 py-8 text-center border-b">
            <p className="text-xs text-gray-400 uppercase tracking-widest mb-2 font-medium">
              Patients Ahead of You
            </p>
            <div className="text-6xl font-extrabold text-blue-600 leading-none">
              {queue.patientsAhead}
            </div>
            
            <div className="flex flex-col items-center gap-2 mt-3">
              <div className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${queueStatusCfg.color}`}>
                {queueStatusCfg.label}
              </div>
              {queue.isPriority && (
                <div className="inline-block px-3 py-1 bg-amber-50 text-amber-800 border border-amber-200 rounded-full text-[10px] font-bold shadow-sm animate-pulse flex items-center gap-0.5">
                  🌟 Priority Applied
                </div>
              )}
            </div>
          </div>

          {/* Details */}
          <div className="px-6 py-5 space-y-4">

            {/* Doctor */}
            <div className="flex items-center justify-between py-2 border-b border-gray-50">
              <span className="text-sm text-gray-500 flex items-center gap-2">
                <span>👨‍⚕️</span> Doctor
              </span>
              <span className="text-sm font-semibold text-gray-800">
                {queue.doctorName}
              </span>
            </div>

            {/* Visit ID */}
            {queue.publicId && (
              <div className="flex items-center justify-between py-2 border-b border-gray-50">
                <span className="text-sm text-gray-500 flex items-center gap-2">
                  <span>🆔</span> Visit ID
                </span>
                <span className="text-sm font-semibold text-gray-800 font-mono">
                  {queue.publicId}
                </span>
              </div>
            )}

            {/* ETA — KEY FIX: always shows whole minutes */}
            <div className="flex items-center justify-between py-2 border-b border-gray-50">
              <span className="text-sm text-gray-500 flex items-center gap-2">
                <span>⏳</span> Estimated Wait
              </span>
              <span className="text-sm font-semibold text-gray-800">
                {eta
                  ? eta
                  : sessionStatus === "inactive"
                  ? "Session not started"
                  : sessionStatus === "paused"
                  ? "Doctor on break"
                  : "Calculating..."}
              </span>
            </div>

            {/* Session Status */}
            <div className="flex items-center justify-between py-2">
              <span className="text-sm text-gray-500 flex items-center gap-2">
                <span>📡</span> Session
              </span>
              <span className={`text-xs font-medium px-2.5 py-1 rounded-full border ${sessionCfg.color}`}>
                {sessionCfg.text}
              </span>
            </div>

          </div>
        </div>

        {/* ── Visit Timeline Card ─────────────────────────────────────────── */}
        {timeline.length > 0 && (
          <div className="bg-white rounded-2xl shadow-sm border p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2">
              <span>Timeline Tracker</span>
              {queue.publicId && (
                <span className="text-xs font-normal text-gray-400 font-mono">({queue.publicId})</span>
              )}
            </h2>
            <div className="relative border-l-2 border-blue-100 ml-3 space-y-6">
              {timeline.map((event, idx) => {
                const config = TIMELINE_EVENTS[event.eventType] || {
                  label: event.eventType,
                  emoji: "📍",
                  color: "text-gray-600 bg-gray-50 border-gray-200"
                };
                const timeStr = new Date(event.occurredAt).toLocaleTimeString("en-US", {
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: true
                });
                return (
                  <div key={event._id || idx} className="relative pl-6">
                    {/* Circle Indicator */}
                    <div className={`absolute -left-[13px] top-1 w-6 h-6 rounded-full border flex items-center justify-center text-xs ${config.color} shadow-sm bg-white`}>
                      {config.emoji}
                    </div>
                    {/* Event Info */}
                    <div>
                      <p className="font-semibold text-sm text-gray-800">{config.label}</p>
                      <p className="text-xs text-gray-500 mt-0.5">{event.message}</p>
                      <span className="text-[10px] text-gray-400 mt-1 block">{timeStr}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── Session Hint Banner ──────────────────────────────────────────── */}
        {sessionCfg.hint && (
          <div className={`rounded-xl border px-4 py-3 text-sm ${sessionCfg.color}`}>
            ℹ️ {sessionCfg.hint}
          </div>
        )}

        {/* ── Paused Delay Notice ──────────────────────────────────────────── */}
        {sessionStatus === "paused" && eta && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-xl px-4 py-3 text-sm text-yellow-700">
            ⚠️ ETA shown is approximate. Actual wait may be longer due to the break.
          </div>
        )}

        {/* ── Cancel Button ────────────────────────────────────────────────── */}
        {queue.status === "waiting" && (
          <button
            onClick={handleCancel}
            className="w-full bg-red-500 hover:bg-red-600 transition text-white py-3 rounded-xl font-medium text-sm shadow-sm"
          >
            Cancel Booking
          </button>
        )}

      </div>
    </div>
  );
}
