import { useState, useEffect } from "react";
import api from "../../services/api";
import { 
  Building, 
  Settings, 
  Power, 
  PowerOff, 
  Trash2, 
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
  const [bookingWindowDays, setBookingWindowDays] = useState(7);
  const [bookingCutoffMinutes, setBookingCutoffMinutes] = useState(30);

  const fetchHospitals = async () => {
    try {
      setLoading(true);
      const res = await api.get("/admin/hospitals");
      if (res.data.success) {
        const list = Array.isArray(res.data.data) ? res.data.data : (res.data.data?.data || []);
        setHospitals(list);
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
        bookingWindowDays: parseInt(bookingWindowDays),
        bookingCutoffMinutes: parseInt(bookingCutoffMinutes),
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
    <div className="space-y-8 animate-fade-in-up">
      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in-up {
          animation: fadeInUp 0.75s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .hover-card-trigger {
          transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .hover-card-trigger:hover {
          transform: translateY(-4px);
          box-shadow: 0 20px 40px -15px rgba(15, 76, 129, 0.06);
        }
      `}</style>

      {error && (
        <div className="bg-rose-500/10 border border-rose-500/30 text-rose-600 p-4 rounded-2xl font-mono text-xs text-left">
          <strong>ERROR:</strong> {error}
        </div>
      )}

      {/* Hospital list grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {hospitals.map((hosp) => (
          <div key={hosp._id} className="bg-white p-6 rounded-3xl border border-slate-200/50 hover-card-trigger shadow-sm flex flex-col justify-between space-y-4 text-left">
            <div className="space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 bg-slate-50 border border-slate-100 rounded-2xl shadow-2xs">
                    <Building className="w-5 h-5 text-[#0E7490]" />
                  </div>
                  <div>
                    <h4 className="font-extrabold text-slate-850 tracking-tight text-base">{hosp.name}</h4>
                    <p className="text-xs text-slate-450 font-bold overflow-hidden text-ellipsis whitespace-nowrap max-w-[200px]">
                      {hosp.address}
                    </p>
                  </div>
                </div>
                <span className={`text-[10px] px-3 py-1 rounded-full font-black uppercase tracking-wider ${hosp.isActive ? "bg-emerald-50 text-emerald-700 border border-emerald-150" : "bg-rose-50 text-rose-700 border border-rose-150"}`}>
                  {hosp.isActive ? "Operational" : "Suspended"}
                </span>
              </div>

              <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-150 text-xs font-semibold font-mono space-y-3">
                <div className="flex justify-between">
                  <span className="text-slate-400 font-extrabold">Capacity:</span>
                  <span className="text-slate-700 font-black">{hosp.capacity || 100} beds</span>
                </div>
                <div className="flex flex-col gap-1 border-t border-slate-200/60 pt-2.5">
                  <span className="text-slate-400 font-extrabold">Operational Notice:</span>
                  <span className="text-slate-655 font-bold italic">{hosp.operationalNotice || "No active notices."}</span>
                </div>
              </div>
            </div>

            {/* Actions Panel */}
            <div className="border-t border-slate-100 pt-4 flex flex-wrap gap-2 items-center justify-between">
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setEditingId(hosp._id);
                    setCapacity(hosp.capacity || 100);
                    setNotice(hosp.operationalNotice || "");
                    setBookingWindowDays(hosp.bookingWindowDays || 7);
                    setBookingCutoffMinutes(hosp.bookingCutoffMinutes || 30);
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold rounded-xl text-xs transition duration-200 cursor-pointer shadow-3xs"
                >
                  <Settings className="w-3.5 h-3.5 text-slate-500" />
                  Manage
                </button>
                <button
                  onClick={() => handleToggleState(hosp._id, !hosp.isActive)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 font-bold rounded-xl text-xs border transition duration-200 cursor-pointer shadow-3xs ${hosp.isActive 
                    ? "bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100" 
                    : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100"}`}
                >
                  {hosp.isActive ? <PowerOff className="w-3.5 h-3.5" /> : <Power className="w-3.5 h-3.5" />}
                  {hosp.isActive ? "Suspend" : "Activate"}
                </button>
              </div>

              <button
                onClick={() => handleArchive(hosp._id)}
                className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-50 border border-slate-200 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 text-slate-500 font-bold rounded-xl text-xs transition duration-200 cursor-pointer shadow-3xs"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Archive
              </button>
            </div>

            {/* Modal edit panel inline */}
            {editingId === hosp._id && (
              <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-200 space-y-4 mt-3 animate-fadeIn shadow-inner">
                <span className="text-xs font-mono font-black text-[#0E7490] uppercase tracking-wider block">
                  Update Settings
                </span>
                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] text-slate-455 uppercase tracking-wider font-extrabold block mb-1">
                      Max Capacity
                    </label>
                    <input
                      type="number"
                      value={capacity}
                      onChange={(e) => setCapacity(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs focus:border-[#0E7490] outline-none text-slate-700 font-bold focus:ring-2 focus:ring-[#0E7490]/5"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-455 uppercase tracking-wider font-extrabold block mb-1">
                      Operational Notice
                    </label>
                    <textarea
                      value={notice}
                      onChange={(e) => setNotice(e.target.value)}
                      rows={2}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs focus:border-[#0E7490] outline-none text-slate-700 font-semibold focus:ring-2 focus:ring-[#0E7490]/5 resize-none"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-slate-455 uppercase tracking-wider font-extrabold block mb-1">
                        Booking Window (Days)
                      </label>
                      <input
                        type="number"
                        min="1"
                        max="180"
                        value={bookingWindowDays}
                        onChange={(e) => setBookingWindowDays(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs focus:border-[#0E7490] outline-none text-slate-700 font-bold focus:ring-2 focus:ring-[#0E7490]/5"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-455 uppercase tracking-wider font-extrabold block mb-1">
                        Cutoff Buffer (Mins)
                      </label>
                      <input
                        type="number"
                        min="0"
                        max="720"
                        value={bookingCutoffMinutes}
                        onChange={(e) => setBookingCutoffMinutes(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs focus:border-[#0E7490] outline-none text-slate-700 font-bold focus:ring-2 focus:ring-[#0E7490]/5"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-455 uppercase tracking-wider font-extrabold block mb-1">
                      Audit Justification (Reason)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Capacity adjustment for summer peak"
                      value={actionReason}
                      onChange={(e) => setActionReason(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs focus:border-[#0E7490] outline-none text-slate-700 font-bold focus:ring-2 focus:ring-[#0E7490]/5"
                    />
                  </div>
                </div>
                <div className="flex gap-2 justify-end pt-1">
                  <button
                    onClick={() => setEditingId(null)}
                    className="px-4 py-2 bg-slate-200 hover:bg-slate-350 text-slate-700 rounded-xl text-[11px] font-black cursor-pointer border-none"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleUpdateMeta(hosp._id)}
                    className="px-4 py-2 bg-[#14B8A6] hover:bg-[#119f90] text-white rounded-xl text-[11px] font-black cursor-pointer border-none"
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
