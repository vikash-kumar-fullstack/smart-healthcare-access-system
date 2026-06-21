import { useState, useEffect } from "react";
import api from "../../services/api";
import { 
  UserSquare, 
  Check, 
  ShieldCheck, 
  AlertTriangle, 
  Ban, 
  RotateCcw, 
  RefreshCw 
} from "lucide-react";

export default function Doctors() {
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchDoctors = async () => {
    try {
      setLoading(true);
      const res = await api.get("/admin/doctors");
      if (res.data.success) {
        setDoctors(res.data.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load doctors database");
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (id, actionType) => {
    const reason = prompt(`Enter reason for running '${actionType}' on this doctor profile:`);
    if (!reason) return;
    try {
      const res = await api.patch(`/admin/doctors/${id}/${actionType}`, { reason });
      if (res.data.success) {
        fetchDoctors();
      }
    } catch (err) {
      if (err.response?.status === 409) {
        alert("CONCURRENCY CONFLICT: This doctor profile was modified or approved by another administrator while you were viewing it. Refreshing list...");
        fetchDoctors();
      } else {
        alert(err.response?.data?.message || "Failed to execute administrative action");
      }
    }
  };

  useEffect(() => {
    fetchDoctors();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] text-teal-400">
        <RefreshCw className="w-8 h-8 animate-spin" />
        <span className="ml-2 font-semibold">Loading doctors database...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 p-4 rounded-lg font-mono text-xs">
          <strong>ERROR:</strong> {error}
        </div>
      )}

      {/* Grid wrapper */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {doctors.map((doc) => (
          <div key={doc._id} className="bg-slate-950/40 p-5 rounded-xl border border-slate-800 backdrop-blur shadow-md flex flex-col justify-between space-y-4">
            <div className="space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-slate-900 border border-slate-800 rounded-lg">
                    <UserSquare className="w-5 h-5 text-teal-400" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-100 tracking-wide text-sm">Dr. {doc.name}</h4>
                    <p className="text-xs text-slate-400 capitalize">{doc.specialization}</p>
                  </div>
                </div>
                <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                  doc.status === "verified" 
                    ? "bg-teal-500/10 text-teal-400 border border-teal-500/20" 
                    : doc.status === "approved" || doc.status === "active"
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    : doc.status === "suspended"
                    ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                    : "bg-amber-500/10 text-amber-400 border border-amber-500/20"
                }`}>
                  {doc.status || "pending"}
                </span>
              </div>

              <div className="bg-slate-900/60 p-3.5 rounded-lg border border-slate-800 text-xs font-mono space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-400">Hospital:</span>
                  <span className="text-slate-200 overflow-hidden text-ellipsis whitespace-nowrap max-w-[120px]">
                    {doc.hospitalId?.name || "Unassigned"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Rating:</span>
                  <span className="text-slate-200">{doc.rating || 0} ★</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Profile complete:</span>
                  <span className={`font-bold ${doc.profileCompleted ? "text-emerald-400" : "text-amber-400"}`}>
                    {doc.profileCompleted ? "YES" : "NO"}
                  </span>
                </div>
              </div>
            </div>

            {/* Lifecycle Action Buttons */}
            <div className="border-t border-slate-800/80 pt-3.5 grid grid-cols-2 gap-2 text-center">
              {["pending_profile", "pending_activation", "pending", "inactive"].includes(doc.status) && (
                <button
                  onClick={() => handleAction(doc._id, "approve")}
                  className="flex items-center justify-center gap-1 bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 text-slate-950 font-bold py-1.5 px-2.5 rounded-lg text-xs transition duration-200 shadow-md col-span-2"
                >
                  <Check className="w-3.5 h-3.5" />
                  Approve Profile
                </button>
              )}

              {doc.status === "approved" && (
                <button
                  onClick={() => handleAction(doc._id, "verify")}
                  className="flex items-center justify-center gap-1 bg-teal-500 hover:bg-teal-600 active:bg-teal-700 text-slate-950 font-bold py-1.5 px-2.5 rounded-lg text-xs transition duration-200 shadow-md col-span-2"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Verify (Security)
                </button>
              )}

              {doc.status !== "suspended" && (
                <button
                  onClick={() => handleAction(doc._id, "suspend")}
                  className="flex items-center justify-center gap-1 bg-slate-900 border border-slate-800 hover:bg-rose-600/10 hover:text-rose-400 hover:border-rose-500/20 text-slate-300 font-semibold py-1.5 px-2.5 rounded-lg text-xs transition duration-200"
                >
                  <Ban className="w-3.5 h-3.5" />
                  Suspend
                </button>
              )}

              {doc.status === "suspended" && (
                <button
                  onClick={() => handleAction(doc._id, "reset")}
                  className="flex items-center justify-center gap-1 bg-slate-900 border border-slate-800 hover:bg-amber-600/10 hover:text-amber-400 hover:border-amber-500/20 text-slate-300 font-semibold py-1.5 px-2.5 rounded-lg text-xs transition duration-200"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset to Pending
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
