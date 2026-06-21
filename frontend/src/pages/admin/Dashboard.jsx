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

export default function Dashboard() {
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

  const kpis = [
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
    <div className="space-y-6">
      {/* Overview stats header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-slate-950/40 p-6 rounded-xl border border-slate-800 backdrop-blur">
        <div>
          <h3 className="text-xl font-bold text-slate-100 tracking-wide font-mono">District Operations Dashboard</h3>
          <p className="text-sm text-slate-400 mt-1">Aggregated statistics compiled asynchronously. Dashboard Version: <span className="font-mono text-teal-400 font-semibold">{data?.dashboardVersion || 3}</span></p>
        </div>
        <button
          onClick={handleManualRefresh}
          disabled={refreshing}
          className="flex items-center justify-center gap-2 bg-teal-500 hover:bg-teal-600 active:bg-teal-700 text-slate-950 font-bold px-4 py-2.5 rounded-lg text-sm transition duration-200 disabled:opacity-50 disabled:cursor-not-allowed shrink-0 shadow-lg shadow-teal-500/10"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          Force Recalculate Cache
        </button>
      </div>

      {/* Grid widgets */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => {
          const Icon = kpi.icon;
          return (
            <div key={kpi.name} className="bg-slate-950/40 p-5 rounded-xl border border-slate-800 hover:border-slate-700 transition-all duration-200 flex items-center justify-between group shadow-md">
              <div className="space-y-1">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider block">
                  {kpi.name}
                </span>
                <span className="text-2xl font-bold text-slate-100 tracking-tight font-mono">
                  {kpi.value}
                </span>
              </div>
              <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg group-hover:border-slate-700 transition">
                <Icon className={`w-6 h-6 ${kpi.color}`} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Extra layout section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-slate-950/40 p-6 rounded-xl border border-slate-800 shadow-md space-y-4">
          <h4 className="font-bold text-slate-100 tracking-wide font-mono border-b border-slate-800 pb-3 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-teal-400"></span>
            System Cache Metadata
          </h4>
          <div className="grid grid-cols-2 gap-4 text-sm font-mono">
            <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-800/80">
              <div className="text-xs text-slate-400 font-semibold mb-1">Generated At</div>
              <div className="text-slate-200 text-xs overflow-hidden text-ellipsis whitespace-nowrap">
                {data?.generatedAt ? new Date(data.generatedAt).toLocaleString() : "N/A"}
              </div>
            </div>
            <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-800/80">
              <div className="text-xs text-slate-400 font-semibold mb-1">Performance Mode</div>
              <div className="text-emerald-400 font-bold uppercase tracking-wider text-xs">
                Asynchronous Cache
              </div>
            </div>
          </div>
        </div>

        <div className="bg-slate-950/40 p-6 rounded-xl border border-slate-800 shadow-md space-y-4">
          <h4 className="font-bold text-slate-100 tracking-wide font-mono border-b border-slate-800 pb-3 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-400"></span>
            District State Machine
          </h4>
          <div className="space-y-2 text-xs">
            <div className="flex justify-between items-center bg-slate-900/50 px-4 py-3 rounded-lg border border-slate-800/80">
              <span className="text-slate-400 font-semibold">Active Mode</span>
              <span className="text-teal-400 font-mono font-semibold uppercase">District Live Operations</span>
            </div>
            <div className="flex justify-between items-center bg-slate-900/50 px-4 py-3 rounded-lg border border-slate-800/80">
              <span className="text-slate-400 font-semibold">Current State</span>
              <span className={`font-mono font-bold uppercase ${data?.systemHealth === "healthy" ? "text-emerald-400" : data?.systemHealth === "degraded" ? "text-orange-400" : "text-rose-400"}`}>
                {data?.systemHealth || "HEALTHY"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
