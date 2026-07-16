import { useState, useEffect } from "react";
import api from "../../services/api";
import { Calendar, Check, X, RefreshCw, AlertCircle } from "lucide-react";
import toast from "react-hot-toast";

export default function Schedules() {
  const [leaves, setLeaves] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actioningId, setActioningId] = useState(null);

  const fetchLeaves = async () => {
    try {
      setLoading(true);
      const res = await api.get("/schedule/leaves");
      if (res.data.success) {
        setLeaves(res.data.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load leave schedules.");
    } finally {
      setLoading(false);
    }
  };

  const handleLeaveAction = async (id, actionType) => {
    const reasonOverride = prompt(`Enter optional comments for this leave ${actionType}:`) || "";
    try {
      setActioningId(id);
      const res = await api.patch(`/schedule/leave/${id}/${actionType}`, { reasonOverride });
      if (res.data.success) {
        toast.success(`Leave request ${actionType}d successfully.`);
        fetchLeaves();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || `Failed to ${actionType} leave.`);
    } finally {
      setActioningId(null);
    }
  };

  useEffect(() => {
    fetchLeaves();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] text-teal-500">
        <RefreshCw className="w-8 h-8 animate-spin" />
        <span className="ml-2 font-semibold">Loading doctor schedules and leave requests...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/50 shadow-sm text-left">
        <h2 className="text-xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
          <Calendar className="w-5 h-5 text-[#0F4C81]" />
          Doctor Availability & Leave Management
        </h2>
        <p className="text-xs text-slate-500 mt-1">
          Review and approve/reject doctor leave requests. Approving a leave will automatically cancel/reassign patients booked in those slots.
        </p>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-xl text-xs text-left font-mono">
          <strong>ERROR:</strong> {error}
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {leaves.length === 0 ? (
          <div className="col-span-2 bg-white p-12 rounded-2xl border border-slate-200/50 text-center text-slate-500 shadow-sm">
            <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h4 className="font-bold text-slate-700 text-sm">No leave requests found</h4>
            <p className="text-xs text-slate-400 mt-1">All doctor slots are currently running on active shifts.</p>
          </div>
        ) : (
          leaves.map((leave) => (
            <div 
              key={leave._id} 
              className="bg-white p-6 rounded-2xl border border-slate-200/50 hover:shadow-md transition-all duration-200 shadow-sm flex flex-col justify-between space-y-4 text-left"
            >
              <div className="space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-extrabold text-slate-850 text-sm">
                      Dr. {leave.doctorId?.userId?.name || "Unknown Doctor"}
                    </h4>
                    <p className="text-xs text-slate-500 font-medium mt-0.5">
                      {leave.doctorId?.userId?.email}
                    </p>
                  </div>
                  <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                    leave.status === "approved"
                      ? "bg-emerald-50 text-emerald-600 border border-emerald-100/50"
                      : leave.status === "rejected"
                      ? "bg-rose-50 text-rose-600 border border-rose-100/50"
                      : "bg-amber-50 text-amber-600 border border-amber-100/50"
                  }`}>
                    {leave.status}
                  </span>
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-150 text-xs font-mono space-y-2">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Leave Type:</span>
                    <span className="text-slate-700 font-bold capitalize">{leave.leaveType.replace("_", " ")}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Dates:</span>
                    <span className="text-slate-700 font-bold">
                      {leave.startDate} to {leave.endDate}
                    </span>
                  </div>
                  {(leave.startTime || leave.endTime) && (
                    <div className="flex justify-between">
                      <span className="text-slate-500">Hours:</span>
                      <span className="text-slate-700 font-bold">
                        {leave.startTime || "00:00"} - {leave.endTime || "24:00"}
                      </span>
                    </div>
                  )}
                  {leave.reason && (
                    <div className="border-t border-slate-200/60 pt-2 mt-2">
                      <span className="text-slate-500 block mb-1">Reason:</span>
                      <p className="text-slate-650 text-xs italic font-sans leading-relaxed">
                        "{leave.reason}"
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {leave.status === "pending" && (
                <div className="border-t border-slate-100 pt-4 flex gap-2">
                  <button
                    onClick={() => handleLeaveAction(leave._id, "approve")}
                    disabled={actioningId !== null}
                    className="flex-1 flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 rounded-xl text-xs transition duration-200 disabled:opacity-50 border-none shadow-sm cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Approve Leave
                  </button>
                  <button
                    onClick={() => handleLeaveAction(leave._id, "reject")}
                    disabled={actioningId !== null}
                    className="flex-1 flex items-center justify-center gap-1.5 bg-slate-50 border border-slate-200 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 text-slate-500 font-bold py-2 rounded-xl text-xs transition duration-200 disabled:opacity-50 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                    Reject
                  </button>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
