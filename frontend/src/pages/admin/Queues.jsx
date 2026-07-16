import { useState, useEffect } from "react";
import api from "../../services/api";
import { 
  GitCommit, 
  Pause, 
  Play, 
  XSquare, 
  ArrowLeftRight, 
  RefreshCw 
} from "lucide-react";
import { useRealtime } from "../../components/RealtimeProvider";

export default function Queues() {
  const { subscribe } = useRealtime() || {};
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Reassignment Form State
  const [entryId, setEntryId] = useState("");
  const [targetDoctorId, setTargetDoctorId] = useState("");
  const [reassignReason, setReassignReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchSessions = async () => {
    try {
      setLoading(true);
      const res = await api.get("/admin/queues");
      if (res.data.success) {
        setSessions(res.data.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load queue sessions");
    } finally {
      setLoading(false);
    }
  };

  const handleOverride = async (id, actionType) => {
    const reason = prompt(`Enter reason for running ${actionType} on this queue session:`);
    if (!reason) return;
    try {
      const res = await api.patch(`/admin/queues/${id}/${actionType}`, { reason });
      if (res.data.success) {
        fetchSessions();
      }
    } catch (err) {
      alert(err.response?.data?.message || "Failed to trigger queue session override");
    }
  };

  const handleReassign = async (e) => {
    e.preventDefault();
    if (!entryId || !targetDoctorId || !reassignReason) {
      alert("Please fill all reassignment fields");
      return;
    }

    try {
      setSubmitting(true);
      const res = await api.patch("/admin/queues/reassign", {
        queueEntryId: entryId,
        targetDoctorId,
        reason: reassignReason
      });

      if (res.data.success) {
        alert("Patient reassigned successfully! Ticket updated.");
        setEntryId("");
        setTargetDoctorId("");
        setReassignReason("");
        fetchSessions();
      }
    } catch (err) {
      alert(err.response?.data?.message || "Reassignment Failed (REASSIGN_LOCKED constraint triggered)");
    } finally {
      setSubmitting(false);
    }
  };

  useEffect(() => {
    fetchSessions();
  }, []);

  useEffect(() => {
    if (!subscribe) return;
    const handleUpdate = () => {
      fetchSessions();
    };

    const unsubQueue = subscribe("QUEUE_UPDATED", handleUpdate);
    const unsubVisitStart = subscribe("VISIT_STARTED", handleUpdate);
    const unsubVisitComplete = subscribe("VISIT_COMPLETED", handleUpdate);
    const unsubReassign = subscribe("QUEUE_REASSIGNED", handleUpdate);
    const unsubPause = subscribe("SESSION_PAUSED", handleUpdate);

    return () => {
      unsubQueue();
      unsubVisitStart();
      unsubVisitComplete();
      unsubReassign();
      unsubPause();
    };
  }, [subscribe]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] text-teal-400">
        <RefreshCw className="w-8 h-8 animate-spin" />
        <span className="ml-2 font-semibold">Loading active queue sessions...</span>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {error && (
        <div className="bg-rose-500/10 border border-rose-500/30 text-rose-650 p-4 rounded-xl font-mono text-xs text-left font-bold">
          <strong>ERROR:</strong> {error}
        </div>
      )}

      {/* Grid of active queue sessions */}
      <div className="space-y-4">
        <h3 className="text-md font-bold text-slate-800 pb-2 flex items-center gap-2 text-left">
          <GitCommit className="w-4 h-4 text-[#0E7490]" />
          Active Queue Sessions
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {sessions.map((sess) => (
            <div key={sess._id} className="bg-white p-6 rounded-2xl border border-slate-200/50 hover:shadow-md transition-all duration-205 shadow-sm flex flex-col justify-between space-y-4 text-left">
              <div className="space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-extrabold text-slate-850 text-sm">Dr. {sess.doctorId?.name || "Unknown Doctor"}</h4>
                    <p className="text-xs text-slate-500 font-mono mt-0.5">Session Date: {sess.date}</p>
                  </div>
                  <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                    sess.sessionStatus === "active"
                      ? "bg-emerald-50 text-emerald-600 border border-emerald-100/50"
                      : sess.sessionStatus === "paused"
                      ? "bg-amber-50 text-amber-600 border border-amber-100/50"
                      : "bg-rose-50 text-rose-600 border border-rose-100/50"
                  }`}>
                    {sess.sessionStatus}
                  </span>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-150 text-xs font-mono grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-slate-500 block text-[10px]">Queue Number</span>
                    <span className="text-slate-700 text-sm font-bold">{sess.currentQueueNumber || 0}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 block text-[10px]">Capacity Limit</span>
                    <span className="text-slate-700 text-sm font-bold">{sess.maxQueueLimit || 50}</span>
                  </div>
                </div>
              </div>

              {/* Session Control Buttons */}
              <div className="border-t border-slate-150 pt-4 flex gap-2">
                {sess.sessionStatus === "active" && (
                  <button
                    onClick={() => handleOverride(sess._id, "pause")}
                    className="flex-1 flex items-center justify-center gap-1 bg-slate-50 border border-slate-200 hover:bg-amber-50 hover:text-amber-600 hover:border-amber-200 text-slate-500 font-bold py-1.5 rounded-lg text-xs transition duration-205 cursor-pointer"
                  >
                    <Pause className="w-3.5 h-3.5" />
                    Pause
                  </button>
                )}

                {sess.sessionStatus === "paused" && (
                  <button
                    onClick={() => handleOverride(sess._id, "reopen")}
                    className="flex-1 flex items-center justify-center gap-1 bg-slate-50 border border-slate-200 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200 text-slate-500 font-bold py-1.5 rounded-lg text-xs transition duration-205 cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5" />
                    Resume
                  </button>
                )}

                {sess.sessionStatus !== "closed" && (
                  <button
                    onClick={() => handleOverride(sess._id, "close")}
                    className="flex-1 flex items-center justify-center gap-1 bg-slate-50 border border-slate-200 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 text-slate-500 font-bold py-1.5 rounded-lg text-xs transition duration-205 cursor-pointer"
                  >
                    <XSquare className="w-3.5 h-3.5" />
                    Force Close
                  </button>
                )}

                {sess.sessionStatus === "closed" && (
                  <button
                    onClick={() => handleOverride(sess._id, "reopen")}
                    className="flex-1 flex items-center justify-center gap-1 bg-slate-50 border border-slate-200 hover:bg-emerald-50 hover:text-emerald-600 hover:border-emerald-200 text-slate-500 font-bold py-1.5 rounded-lg text-xs transition duration-205 cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5" />
                    Reopen
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Patient Reassignment Form */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/50 hover:shadow-md transition-all duration-200 shadow-sm space-y-4 max-w-xl text-left">
        <h4 className="font-extrabold text-slate-800 tracking-tight border-b border-slate-100 pb-3 flex items-center gap-2">
          <ArrowLeftRight className="w-4 h-4 text-[#0E7490]" />
          Patient Queue Reassignment (Intervention Override)
        </h4>

        <form onSubmit={handleReassign} className="space-y-4 text-sm font-sans">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold block mb-1">
                Queue Entry / Booking ID
              </label>
              <input
                type="text"
                required
                placeholder="e.g. 603f90..."
                value={entryId}
                onChange={(e) => setEntryId(e.target.value)}
                className="w-full bg-white border border-slate-250 rounded-lg px-3 py-2 text-xs focus:border-[#0E7490] outline-none text-slate-700 font-mono"
              />
            </div>

            <div>
              <label className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold block mb-1">
                Target Doctor ID
              </label>
              <input
                type="text"
                required
                placeholder="e.g. 603f92..."
                value={targetDoctorId}
                onChange={(e) => setTargetDoctorId(e.target.value)}
                className="w-full bg-white border border-slate-250 rounded-lg px-3 py-2 text-xs focus:border-[#0E7490] outline-none text-slate-700 font-mono"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold block mb-1">
              Reassignment Justification Reason
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Doctor schedule delayed, re-routing to equivalent cardiologist"
              value={reassignReason}
              onChange={(e) => setReassignReason(e.target.value)}
              className="w-full bg-white border border-slate-250 rounded-lg px-3 py-2 text-xs focus:border-[#0E7490] outline-none text-slate-700"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full bg-[#14B8A6] hover:bg-[#119f90] text-white font-bold py-2.5 rounded-lg text-xs transition duration-200 disabled:opacity-50 font-mono cursor-pointer border-none shadow-sm"
          >
            {submitting ? "Processing Override..." : "Execute Reassignment"}
          </button>
        </form>
      </div>
    </div>
  );
}
