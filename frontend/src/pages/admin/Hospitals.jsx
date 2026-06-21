import { useState, useEffect } from "react";
import api from "../../services/api";
import { 
  Building, 
  Settings, 
  Power, 
  PowerOff, 
  Trash2, 
  Plus, 
  RefreshCw 
} from "lucide-react";

export default function Hospitals() {
  const [hospitals, setHospitals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [capacity, setCapacity] = useState(100);
  const [notice, setNotice] = useState("");
  const [actionReason, setActionReason] = useState("");

  const fetchHospitals = async () => {
    try {
      setLoading(true);
      const res = await api.get("/admin/hospitals");
      if (res.data.success) {
        setHospitals(res.data.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load hospitals");
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateMeta = async (id) => {
    if (!actionReason) {
      alert("Please provide an audit justification reason");
      return;
    }
    try {
      const res = await api.patch(`/admin/hospitals/${id}`, {
        capacity: parseInt(capacity),
        operationalNotice: notice,
        reason: actionReason
      });
      if (res.data.success) {
        setEditingId(null);
        setActionReason("");
        fetchHospitals();
      }
    } catch (err) {
      alert(err.response?.data?.message || "Failed to update hospital metadata");
    }
  };

  const handleToggleState = async (id, isActive) => {
    const reason = prompt(`Enter reason for ${isActive ? "reopening" : "suspending"} this hospital:`);
    if (!reason) return;
    try {
      const path = isActive ? `/admin/hospitals/${id}/reopen` : `/admin/hospitals/${id}/suspend`;
      const res = await api.patch(path, { reason });
      if (res.data.success) {
        fetchHospitals();
      }
    } catch (err) {
      alert(err.response?.data?.message || "Failed to toggle hospital state");
    }
  };

  const handleArchive = async (id) => {
    const reason = prompt("Enter reason for archiving this hospital:");
    if (!reason) return;
    try {
      const res = await api.patch(`/admin/hospitals/${id}/archive`, { reason });
      if (res.data.success) {
        fetchHospitals();
      }
    } catch (err) {
      alert(err.response?.data?.message || "Failed to archive hospital");
    }
  };

  useEffect(() => {
    fetchHospitals();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] text-teal-400">
        <RefreshCw className="w-8 h-8 animate-spin" />
        <span className="ml-2 font-semibold">Loading hospitals database...</span>
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

      {/* Hospital list grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {hospitals.map((hosp) => (
          <div key={hosp._id} className="bg-slate-950/40 p-6 rounded-xl border border-slate-800 backdrop-blur shadow-md flex flex-col justify-between space-y-4">
            <div className="space-y-2">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-slate-900 border border-slate-800 rounded-lg">
                    <Building className="w-5 h-5 text-teal-400" />
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-100 tracking-wide text-sm">{hosp.name}</h4>
                    <p className="text-xs text-slate-400 overflow-hidden text-ellipsis whitespace-nowrap max-w-[200px]">
                      {hosp.address}
                    </p>
                  </div>
                </div>
                <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${hosp.isActive ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-rose-500/10 text-rose-400 border border-rose-500/20"}`}>
                  {hosp.isActive ? "Operational" : "Suspended"}
                </span>
              </div>

              <div className="bg-slate-900/60 p-4 rounded-lg border border-slate-800 text-xs font-mono space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-400">Capacity:</span>
                  <span className="text-slate-200 font-semibold">{hosp.capacity || 100} beds</span>
                </div>
                <div className="flex flex-col gap-1 border-t border-slate-800/80 pt-2">
                  <span className="text-slate-400">Operational Notice:</span>
                  <span className="text-slate-200 italic">{hosp.operationalNotice || "No active notices."}</span>
                </div>
              </div>
            </div>

            {/* Actions Panel */}
            <div className="border-t border-slate-800/80 pt-4 flex flex-wrap gap-2 items-center justify-between">
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setEditingId(hosp._id);
                    setCapacity(hosp.capacity || 100);
                    setNotice(hosp.operationalNotice || "");
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-200 font-bold rounded-lg text-xs transition duration-200"
                >
                  <Settings className="w-3.5 h-3.5" />
                  Manage
                </button>
                <button
                  onClick={() => handleToggleState(hosp._id, !hosp.isActive)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 font-bold rounded-lg text-xs border transition duration-200 ${hosp.isActive 
                    ? "bg-rose-600/10 text-rose-400 border-rose-500/30 hover:bg-rose-600/20" 
                    : "bg-emerald-600/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-600/20"}`}
                >
                  {hosp.isActive ? <PowerOff className="w-3.5 h-3.5" /> : <Power className="w-3.5 h-3.5" />}
                  {hosp.isActive ? "Suspend" : "Activate"}
                </button>
              </div>

              <button
                onClick={() => handleArchive(hosp._id)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 border border-slate-800 hover:bg-rose-600/10 hover:text-rose-400 hover:border-rose-500/20 text-slate-400 font-bold rounded-lg text-xs transition duration-200"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Archive
              </button>
            </div>

            {/* Modal edit panel inline */}
            {editingId === hosp._id && (
              <div className="bg-slate-900 p-4 rounded-lg border border-teal-500/30 space-y-3 mt-3 animate-fadeIn">
                <span className="text-xs font-mono font-bold text-teal-400 uppercase tracking-wide block">
                  Update Settings
                </span>
                <div className="space-y-2">
                  <div>
                    <label className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block mb-1">
                      Max Capacity
                    </label>
                    <input
                      type="number"
                      value={capacity}
                      onChange={(e) => setCapacity(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs focus:border-teal-500 outline-none text-slate-200"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block mb-1">
                      Operational Notice
                    </label>
                    <textarea
                      value={notice}
                      onChange={(e) => setNotice(e.target.value)}
                      rows={2}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs focus:border-teal-500 outline-none text-slate-200 resize-none"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block mb-1">
                      Audit Justification (Reason)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Capacity adjustment for summer peak"
                      value={actionReason}
                      onChange={(e) => setActionReason(e.target.value)}
                      className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1.5 text-xs focus:border-teal-500 outline-none text-slate-200"
                    />
                  </div>
                </div>
                <div className="flex gap-2 justify-end">
                  <button
                    onClick={() => setEditingId(null)}
                    className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-[11px] font-bold"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleUpdateMeta(hosp._id)}
                    className="px-2.5 py-1 bg-teal-500 hover:bg-teal-600 text-slate-950 rounded text-[11px] font-bold"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
