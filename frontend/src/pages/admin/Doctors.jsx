import { useState, useEffect } from "react";
import api from "../../services/api";
import { 
  UserSquare, 
  Check, 
  ShieldCheck, 
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
        const list = Array.isArray(res.data.data) ? res.data.data : (res.data.data?.data || []);
        setDoctors(list);
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
        <div className="bg-rose-500/10 border border-rose-500/30 text-rose-600 p-4 rounded-xl font-mono text-xs text-left">
          <strong>ERROR:</strong> {error}
        </div>
      )}

      {/* Grid wrapper */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {doctors.map((doc) => (
          <div key={doc._id} className="bg-white p-6 rounded-2xl border border-slate-200/50 hover:shadow-md transition-all duration-205 shadow-sm flex flex-col justify-between space-y-4 text-left">
            <div className="space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-slate-50 border border-slate-100 rounded-xl">
                    <UserSquare className="w-5 h-5 text-[#0E7490]" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-slate-850 tracking-tight text-sm">Dr. {doc.name}</h4>
                    <p className="text-xs text-slate-500 font-semibold capitalize">{doc.specialization}</p>
                  </div>
                </div>
                <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                  doc.status === "verified" 
                    ? "bg-teal-50 text-teal-600 border border-teal-100/50" 
                    : doc.status === "approved" || doc.status === "active"
                    ? "bg-emerald-50 text-emerald-600 border border-emerald-100/50"
                    : doc.status === "suspended"
                    ? "bg-rose-50 text-rose-600 border border-rose-100/50"
                    : "bg-amber-50 text-amber-600 border border-amber-100/50"
                }`}>
                  {doc.status || "pending"}
                </span>
              </div>

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-150 text-xs font-mono space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-500">Hospital:</span>
                  <span className="text-slate-700 font-bold overflow-hidden text-ellipsis whitespace-nowrap max-w-[120px]">
                    {doc.hospitalId?.name || "Unassigned"}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Rating:</span>
                  <span className="text-slate-700 font-bold">{doc.rating || 0} ★</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">Profile complete:</span>
                  <span className={`font-bold ${doc.profileCompleted ? "text-emerald-650" : "text-amber-650"}`}>
                    {doc.profileCompleted ? "YES" : "NO"}
                  </span>
                </div>
              </div>
            </div>

            {/* Lifecycle Action Buttons */}
            <div className="border-t border-slate-150 pt-4 grid grid-cols-2 gap-2 text-center">
              {["pending_profile", "pending_activation", "pending", "inactive"].includes(doc.status) && (
                <button
                  onClick={() => handleAction(doc._id, "approve")}
                  className="flex items-center justify-center gap-1 bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-1.5 px-2.5 rounded-lg text-xs transition duration-200 shadow-md col-span-2 cursor-pointer border-none"
                >
                  <Check className="w-3.5 h-3.5" />
                  Approve Profile
                </button>
              )}

              {doc.status === "approved" && (
                <button
                  onClick={() => handleAction(doc._id, "verify")}
                  className="flex items-center justify-center gap-1 bg-[#14B8A6] hover:bg-[#119f90] text-white font-bold py-1.5 px-2.5 rounded-lg text-xs transition duration-200 shadow-md col-span-2 cursor-pointer border-none"
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  Verify (Security)
                </button>
              )}

              {doc.status !== "suspended" && (
                <button
                  onClick={() => handleAction(doc._id, "suspend")}
                  className="flex items-center justify-center gap-1 bg-slate-50 border border-slate-200 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 text-slate-500 font-bold py-1.5 px-2.5 rounded-lg text-xs transition duration-200 cursor-pointer"
                >
                  <Ban className="w-3.5 h-3.5" />
                  Suspend
                </button>
              )}

              {doc.status === "suspended" && (
                <button
                  onClick={() => handleAction(doc._id, "reset")}
                  className="flex items-center justify-center gap-1 bg-slate-50 border border-slate-200 hover:bg-amber-50 hover:text-amber-600 hover:border-amber-200 text-slate-500 font-bold py-1.5 px-2.5 rounded-lg text-xs transition duration-200 cursor-pointer"
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
