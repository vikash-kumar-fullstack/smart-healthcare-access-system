import { useState, useEffect } from "react";
import api from "../../services/api";
import toast from "react-hot-toast";
import { Hospital, Users, BarChart3, Activity, Clock, ShieldAlert, CheckCircle2 } from "lucide-react";

export default function HospitalOverview() {
  const [hospitals, setHospitals] = useState([]);
  const [selectedHospitalId, setSelectedHospitalId] = useState("");
  const [loading, setLoading] = useState(true);
  const [queues, setQueues] = useState([]);

  const fetchHospitals = async () => {
    try {
      const res = await api.get("/hospitals");
      if (res.data.success) {
        let list = res.data.data.data || res.data.data || [];
        
        // Scope hospitals selection list for hospital admin
        const role = localStorage.getItem("role");
        if (role === "hospital_admin") {
          const userObj = JSON.parse(localStorage.getItem("user") || "{}");
          const myHospId = userObj.hospitalId;
          if (myHospId) {
            list = list.filter(h => h._id === myHospId);
          }
        }
        
        setHospitals(list);
        if (list.length > 0) {
          setSelectedHospitalId(list[0]._id);
        }
      }
    } catch (err) {
      toast.error("Failed to load hospitals list.");
    } finally {
      setLoading(false);
    }
  };

  const fetchHospitalMetrics = async () => {
    if (!selectedHospitalId) return;
    try {
      // Query metrics from backend (returns all queues)
      const res = await api.get("/admin/queues");
      if (res.data.success) {
        // Filter by the selected hospital ID on the frontend
        const allQueues = res.data.data || [];
        const filtered = allQueues.filter(q => 
          q.doctorId?.hospitalId?._id?.toString() === selectedHospitalId.toString() ||
          q.doctorId?.hospitalId?.toString() === selectedHospitalId.toString()
        );
        setQueues(filtered);
      }
    } catch (err) {
      console.error("Failed to load hospital metrics", err);
    }
  };

  useEffect(() => {
    fetchHospitals();
  }, []);

  useEffect(() => {
    fetchHospitalMetrics();
  }, [selectedHospitalId]);

  // Compute metrics dynamically from the active queue sessions
  const activeQueuesCount = queues.length;
  const activeDoctorsCount = new Set(queues.map(q => q.doctorId?._id?.toString()).filter(Boolean)).size;
  const totalWaiting = queues.reduce((sum, q) => sum + (q.activeCount || 0), 0);
  const avgWaitTime = Math.max(5, totalWaiting * 6);

  let receptionLoad = "Optimal";
  if (totalWaiting > 12) receptionLoad = "Critical";
  else if (totalWaiting > 6) receptionLoad = "Busy";
  else if (totalWaiting > 2) receptionLoad = "Normal";

  return (
    <div className="space-y-8 text-left animate-fade-in-up">
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

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">Hospital Operational Overview</h1>
          <p className="text-xs text-slate-500 mt-1 font-semibold">Cross-hospital queue metrics, wait times, active doctors, and receptionist loads (Read-Only).</p>
        </div>

        {hospitals.length > 1 ? (
          <select
            value={selectedHospitalId}
            onChange={(e) => setSelectedHospitalId(e.target.value)}
            className="border border-slate-200 rounded-xl px-4 py-2.5 text-xs font-black bg-white focus:outline-none focus:border-[#0F4C81] focus:ring-2 focus:ring-[#0F4C81]/5 cursor-pointer text-slate-700 shadow-3xs"
          >
            {hospitals.map(h => (
              <option key={h._id} value={h._id}>{h.name}</option>
            ))}
          </select>
        ) : (
          hospitals.length === 1 && (
            <span className="bg-[#0F4C81]/10 border border-[#0F4C81]/20 rounded-xl px-4 py-2 text-xs font-black text-[#0F4C81] uppercase tracking-wider">
              {hospitals[0].name}
            </span>
          )
        )}
      </div>

      {/* KPI metrics row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <div className="bg-white p-5 rounded-3xl border border-slate-200/50 shadow-sm flex items-center gap-4 hover-card-trigger">
          <div className="h-12 w-12 bg-[#0F4C81]/10 rounded-2xl flex items-center justify-center text-[#0F4C81] border border-[#0F4C81]/15 shadow-2xs">
            <Clock className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-black text-slate-400 tracking-widest">Avg Wait Time</p>
            <p className="text-xl font-black text-slate-800 mt-1 font-mono">{avgWaitTime} Mins</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200/50 shadow-sm flex items-center gap-4 hover-card-trigger">
          <div className="h-12 w-12 bg-[#14B8A6]/10 rounded-2xl flex items-center justify-center text-[#14B8A6] border border-[#14B8A6]/15 shadow-2xs">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-black text-slate-400 tracking-widest">Active Queues</p>
            <p className="text-xl font-black text-slate-800 mt-1 font-mono">{activeQueuesCount}</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200/50 shadow-sm flex items-center gap-4 hover-card-trigger">
          <div className="h-12 w-12 bg-amber-50 rounded-2xl flex items-center justify-center text-amber-600 border border-amber-100 shadow-2xs">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-black text-slate-400 tracking-widest">Duty Doctors</p>
            <p className="text-xl font-black text-slate-800 mt-1 font-mono">{activeDoctorsCount} Active</p>
          </div>
        </div>

        <div className="bg-white p-5 rounded-3xl border border-slate-200/50 shadow-sm flex items-center gap-4 hover-card-trigger">
          <div className="h-12 w-12 bg-emerald-50 rounded-2xl flex items-center justify-center text-emerald-600 border border-emerald-100 shadow-2xs">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[10px] uppercase font-black text-slate-400 tracking-widest">Reception Load</p>
            <p className="text-xl font-black text-slate-800 mt-1 font-mono">{receptionLoad}</p>
          </div>
        </div>
      </div>

      {/* Queues monitor table */}
      <div className="bg-white border border-slate-200/60 rounded-[24px] shadow-sm overflow-hidden hover-card-trigger">
        <div className="p-5 border-b border-slate-100">
          <h3 className="font-extrabold text-slate-800 text-sm">Active Queue Sessions</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100 text-slate-550 font-black uppercase tracking-wider text-[10px]">
                <th className="px-5 py-3.5">Doctor</th>
                <th className="px-5 py-3.5">Department</th>
                <th className="px-5 py-3.5">Active Patients</th>
                <th className="px-5 py-3.5">Completed Today</th>
                <th className="px-5 py-3.5">Session Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-semibold text-slate-655">
              {queues.length === 0 ? (
                <tr>
                  <td colSpan="5" className="px-5 py-8 text-center text-slate-400">
                    No active queue sessions configured for this hospital.
                  </td>
                </tr>
              ) : (
                queues.map(q => (
                  <tr key={q._id} className="hover:bg-slate-50/40 transition">
                    <td className="px-5 py-4 font-extrabold text-slate-800">Dr. {q.doctorId?.name || "Guest"}</td>
                    <td className="px-5 py-4 text-slate-600">{q.doctorId?.specialization || "General"}</td>
                    <td className="px-5 py-4 font-mono font-black text-slate-700">{q.activeCount || 0}</td>
                    <td className="px-5 py-4 font-mono text-slate-550">{q.completedCount || 0}</td>
                    <td className="px-5 py-4">
                      <span className={`px-2.5 py-0.5 rounded-full text-[9px] font-black uppercase tracking-wider ${
                        q.sessionStatus === "active" ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-slate-100 text-slate-500"
                      }`}>
                        {q.sessionStatus || q.status}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
