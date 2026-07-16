import { useState, useEffect } from "react";
import api from "../../services/api";
import { 
  Users, 
  Building, 
  UserSquare, 
  Calendar, 
  Percent, 
  Activity, 
  RefreshCw 
} from "lucide-react";
import { useRealtime } from "../../components/RealtimeProvider";

export default function Dashboard() {
  const { subscribe } = useRealtime() || {};
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const res = await api.get("/admin/dashboard");
      if (res.data.success) {
        setData(res.data.data);
      } else {
        setError(res.data.message || "Failed to load dashboard statistics");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to fetch dashboard data");
    } finally {
      setLoading(false);
    }
  };

  const handleManualRefresh = async () => {
    try {
      setRefreshing(true);
      const res = await api.post("/admin/dashboard/refresh");
      if (res.data.success) {
        setData(res.data.data);
      }
    } catch (err) {
      alert(err.response?.data?.message || "Failed to force cache recalculation");
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  useEffect(() => {
    if (!subscribe) return;
    const handleUpdate = () => {
      fetchDashboardData();
    };

    const unsubQueue = subscribe("QUEUE_UPDATED", handleUpdate);
    const unsubVisitStart = subscribe("VISIT_STARTED", handleUpdate);
    const unsubVisitComplete = subscribe("VISIT_COMPLETED", handleUpdate);
    const unsubReassign = subscribe("QUEUE_REASSIGNED", handleUpdate);

    return () => {
      unsubQueue();
      unsubVisitStart();
      unsubVisitComplete();
      unsubReassign();
    };
  }, [subscribe]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] text-teal-400">
        <RefreshCw className="w-8 h-8 animate-spin" />
        <span className="ml-2 font-semibold">Loading telemetry data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 p-4 rounded-lg font-mono">
        <strong>CRITICAL FAULT:</strong> {error}
      </div>
    );
  }

  const isHospital = !!data?.isHospitalAdmin;

  const kpis = isHospital ? [
    { name: "Active Doctors", value: data?.activeDoctors ?? 0, icon: UserSquare, color: "text-sky-400" },
    { name: "Registered Patients", value: data?.activePatients ?? 0, icon: Users, color: "text-indigo-400" },
    { name: "Bookings Today", value: data?.bookings ?? 0, icon: Calendar, color: "text-amber-400" },
    { name: "Completion Rate", value: `${data?.completionRate ?? 0}%`, icon: Percent, color: "text-teal-400" },
    { name: "No Show Rate", value: `${data?.noShowRate ?? 0}%`, icon: Percent, color: "text-rose-400" }
  ] : [
    { name: "Active Hospitals", value: data?.activeHospitals ?? 0, icon: Building, color: "text-emerald-400" },
    { name: "Active Doctors", value: data?.activeDoctors ?? 0, icon: UserSquare, color: "text-sky-400" },
    { name: "Registered Patients", value: data?.activePatients ?? 0, icon: Users, color: "text-indigo-400" },
    { name: "Bookings Today", value: data?.bookings ?? 0, icon: Calendar, color: "text-amber-400" },
    { name: "Completion Rate", value: `${data?.completionRate ?? 0}%`, icon: Percent, color: "text-teal-400" },
    { name: "No Show Rate", value: `${data?.noShowRate ?? 0}%`, icon: Percent, color: "text-rose-400" },
    { name: "Patient Retention", value: `${data?.retentionRate ?? 85}%`, icon: Activity, color: "text-pink-400" },
    { name: "Queue Health Score", value: `${data?.queueHealth ?? 100}%`, icon: Activity, color: "text-fuchsia-400" }
  ];

  return (
    <div className="flex flex-col gap-8 text-left animate-fade-in-up">
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

      {/* Overview stats header (Light Theme Gradient) */}
      <div className="bg-gradient-to-br from-[#0F4C81] to-[#0A5F76] text-white p-8 rounded-[32px] shadow-xl relative overflow-hidden flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 text-left hover-card-trigger">
        <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full blur-3xl pointer-events-none transform translate-x-10 -translate-y-10" />
        <div className="relative z-10">
          <h3 className="text-2xl font-black text-white tracking-tight">
            {isHospital ? "Hospital Operations Dashboard" : "Super Admin Operations Dashboard"}
          </h3>
          <p className="text-xs text-cyan-105 mt-1 font-semibold">
            {isHospital 
              ? `${data.hospitalName || "Partnered Hospital"} Administrative Console` 
              : `Aggregated statistics compiled asynchronously. Dashboard Version: ${data?.dashboardVersion || 3}`}
          </p>
        </div>
        <button
          onClick={handleManualRefresh}
          disabled={refreshing}
          className="relative z-10 flex items-center justify-center gap-2 bg-[#14B8A6] hover:bg-[#119f90] active:bg-[#0e8376] text-white font-extrabold px-6 h-12 rounded-xl text-xs transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed shrink-0 shadow-md cursor-pointer border-none"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          Force Recalculate Cache
        </button>
      </div>

      {/* Grid widgets (Clean White Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.name} className="bg-white p-6 rounded-3xl border border-slate-200/50 hover-card-trigger flex items-center justify-between group shadow-sm text-left">
              <div className="space-y-1">
                <span className="text-xs font-black text-slate-400 uppercase tracking-widest block">
                  {kpi.name}
                </span>
                <span className="text-3xl font-black text-slate-800 tracking-tight font-mono">
                  {kpi.value}
                </span>
              </div>
              <div className="p-3 bg-slate-50 border border-slate-100 rounded-xl group-hover:bg-[#0E7490]/5 group-hover:border-[#0E7490]/10 transition">
                <Icon className={`w-6 h-6 ${kpi.color.replace('400', '600')}`} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Extra layout section (Clean White Cards) */}
      {!isHospital && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-left">
          <div className="bg-white p-6 rounded-3xl border border-slate-200/50 shadow-sm space-y-5 hover-card-trigger">
            <h4 className="font-black text-slate-800 tracking-tight border-b border-slate-100 pb-3 flex items-center gap-2 text-sm uppercase">
              <span className="w-2.5 h-2.5 rounded-full bg-[#14B8A6]"></span>
              System Cache Metadata
            </h4>
            <div className="grid grid-cols-2 gap-4 text-sm font-mono">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-150">
                <div className="text-[10px] text-slate-400 uppercase font-black mb-1 tracking-wider">Generated At</div>
                <div className="text-slate-700 text-xs font-black overflow-hidden text-ellipsis whitespace-nowrap">
                  {data?.generatedAt ? new Date(data.generatedAt).toLocaleString() : "N/A"}
                </div>
              </div>
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-150">
                <div className="text-[10px] text-slate-400 uppercase font-black mb-1 tracking-wider">Performance Mode</div>
                <div className="text-[#0E7490] font-black uppercase tracking-wider text-xs">
                  Asynchronous Cache
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-3xl border border-slate-200/50 shadow-sm space-y-5 hover-card-trigger">
            <h4 className="font-black text-slate-800 tracking-tight border-b border-slate-100 pb-3 flex items-center gap-2 text-sm uppercase">
              <span className="w-2.5 h-2.5 rounded-full bg-[#0F4C81]"></span>
              Super Admin State Machine
            </h4>
            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-center bg-slate-50 px-4 py-3 rounded-2xl border border-slate-150">
                <span className="text-slate-500 font-extrabold tracking-tight">Active Mode</span>
                <span className="text-[#0F4C81] font-mono font-black uppercase text-[10px] tracking-wider">Global Live Operations</span>
              </div>
              <div className="flex justify-between items-center bg-slate-50 px-4 py-3 rounded-2xl border border-slate-150">
                <span className="text-slate-500 font-extrabold tracking-tight">Current State</span>
                <span className={`font-mono font-black uppercase text-[10px] tracking-wider ${data?.systemHealth === "healthy" ? "text-emerald-600" : data?.systemHealth === "degraded" ? "text-orange-600" : "text-rose-600"}`}>
                  {data?.systemHealth || "HEALTHY"}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
