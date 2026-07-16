import { useState, useEffect } from "react";
import api from "../../services/api";
import toast from "react-hot-toast";
import { 
  Shield, 
  ShieldAlert, 
  Key, 
  Users, 
  Activity, 
  FileText, 
  AlertTriangle, 
  RefreshCw,
  FolderLock
} from "lucide-react";

export default function SecurityDashboard() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchSecurityStats = async () => {
    try {
      const res = await api.get("/admin/security/stats");
      if (res.data.success) {
        setData(res.data.data);
      }
    } catch (err) {
      console.error("Failed to load security statistics:", err);
      toast.error("Failed to load security telemetry.");
    } finally {
      setLoading(false);
    }
  };

  const handleManualRefresh = async () => {
    try {
      setRefreshing(true);
      await fetchSecurityStats();
      toast.success("Security telemetry refreshed!");
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSecurityStats();
    const interval = setInterval(fetchSecurityStats, 10000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] text-[#0F4C81]">
        <RefreshCw className="w-8 h-8 animate-spin" />
        <span className="ml-2 font-semibold">Loading security telemetry...</span>
      </div>
    );
  }

  const statsList = [
    { name: "Active Sessions", value: data?.activeSessions ?? 0, icon: Users, color: "text-indigo-600", bg: "bg-indigo-50" },
    { name: "Failed Login Attempts", value: data?.failedAttempts ?? 0, icon: Key, color: "text-amber-600", bg: "bg-amber-50" },
    { name: "Rate Limit Triggers", value: data?.rateLimitTriggers ?? 0, icon: Activity, color: "text-rose-600", bg: "bg-rose-50" },
    { name: "Security Incidents", value: data?.securityIncidents ?? 0, icon: ShieldAlert, color: "text-red-600", bg: "bg-red-50" },
    { name: "Backup Health", value: data?.backupHealth ?? "N/A", icon: FolderLock, color: "text-emerald-600", bg: "bg-emerald-50" },
    { name: "Audit Logs Volume", value: data?.auditVolume ?? 0, icon: FileText, color: "text-sky-600", bg: "bg-sky-50" },
    { name: "API Abuse Attempts", value: data?.apiAbuseAttempts ?? 0, icon: AlertTriangle, color: "text-purple-600", bg: "bg-purple-50" }
  ];

  return (
    <div className="flex flex-col gap-8 text-left animate-fade-in-up">
      {/* Top Banner */}
      <div className="bg-gradient-to-br from-[#0F4C81] to-[#0A5F76] text-white p-8 rounded-[32px] shadow-xl relative overflow-hidden flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full blur-3xl pointer-events-none transform translate-x-10 -translate-y-10" />
        <div className="relative z-10 flex items-center gap-4">
          <div className="p-3 bg-white/10 rounded-2xl">
            <Shield className="w-8 h-8 text-cyan-200" />
          </div>
          <div>
            <h3 className="text-2xl font-black text-white tracking-tight">Security & Compliance Dashboard</h3>
            <p className="text-xs text-cyan-100 mt-1 font-semibold">HIPAA Compliance controls and telemetry details</p>
          </div>
        </div>
        <button
          onClick={handleManualRefresh}
          disabled={refreshing}
          className="relative z-10 flex items-center justify-center gap-2 bg-[#14B8A6] hover:bg-[#119f90] active:bg-[#0e8376] text-white font-extrabold px-6 h-12 rounded-xl text-xs transition duration-200 disabled:opacity-50 border-none cursor-pointer shadow-md"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          Refresh Stats
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {statsList.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.name} className="bg-white p-6 rounded-3xl border border-slate-200/50 flex items-center justify-between shadow-sm">
              <div className="space-y-1">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                  {stat.name}
                </span>
                <span className="text-2xl font-black text-slate-800 tracking-tight font-mono">
                  {stat.value}
                </span>
              </div>
              <div className={`p-3 rounded-2xl ${stat.bg}`}>
                <Icon className={`w-6 h-6 ${stat.color}`} />
              </div>
            </div>
          );
        })}
      </div>

      {/* Incidents and Audits Split */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Security Incidents Card */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/50 shadow-sm space-y-4">
          <h4 className="font-black text-slate-800 tracking-tight border-b border-slate-100 pb-3 flex items-center gap-2 text-sm uppercase">
            <span className="w-2.5 h-2.5 rounded-full bg-rose-500"></span>
            Recent Security Incidents
          </h4>
          
          {(!data?.incidents || data.incidents.length === 0) ? (
            <p className="text-xs text-slate-400 py-6 text-center">No security incidents detected.</p>
          ) : (
            <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
              {data.incidents.map((inc) => (
                <div key={inc._id} className="p-4 bg-slate-50 border border-slate-150 rounded-2xl text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-0.5 bg-rose-50 border border-rose-150 rounded-full text-[9px] font-black text-rose-700 uppercase tracking-wider">
                      {inc.category}
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {new Date(inc.detectedAt).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-slate-600 font-medium">{inc.description}</p>
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="font-semibold text-slate-400">Severity: <span className="font-bold text-slate-700 capitalize">{inc.severity}</span></span>
                    <span className={`px-2 py-0.5 rounded-md font-bold uppercase ${inc.status === "open" ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"}`}>
                      {inc.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Audit Logs Card */}
        <div className="bg-white p-6 rounded-3xl border border-slate-200/50 shadow-sm space-y-4">
          <h4 className="font-black text-slate-800 tracking-tight border-b border-slate-100 pb-3 flex items-center gap-2 text-sm uppercase">
            <span className="w-2.5 h-2.5 rounded-full bg-[#0F4C81]"></span>
            Audit Activity Trail
          </h4>

          {(!data?.recentAudits || data.recentAudits.length === 0) ? (
            <p className="text-xs text-slate-400 py-6 text-center">No recent audit log operations recorded.</p>
          ) : (
            <div className="space-y-3 max-h-[350px] overflow-y-auto pr-1">
              {data.recentAudits.map((aud) => (
                <div key={aud._id} className="p-4 bg-slate-50 border border-slate-150 rounded-2xl text-xs space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="font-black text-[#0F4C81]">{aud.action}</span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {new Date(aud.timestamp).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-slate-500 font-medium">
                    <span>Role: <span className="font-bold text-slate-700 capitalize">{aud.actorRole}</span></span>
                    <span>•</span>
                    <span>Path: <span className="font-mono text-slate-650">{aud.requestPath || "system"}</span></span>
                  </div>
                  <div className="text-[10px] flex gap-2">
                    <span className="text-slate-400">Snapshot Permissions:</span>
                    <span className="font-mono text-slate-600 font-bold truncate max-w-[280px]">
                      {JSON.stringify(aud.permissionSnapshot || [])}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
