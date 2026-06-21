import { useState, useEffect } from "react";
import api from "../../services/api";
import { 
  Activity, 
  Settings, 
  Radio, 
  Terminal, 
  CheckCircle2, 
  AlertOctagon, 
  AlertTriangle,
  RefreshCw
} from "lucide-react";

export default function Health() {
  const [telemetry, setTelemetry] = useState(null);
  const [emergency, setEmergency] = useState(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  const fetchHealthData = async () => {
    try {
      const healthRes = await api.get("/admin/health");
      const emergencyRes = await api.get("/admin/emergency");
      setTelemetry(healthRes.data.data);
      setEmergency(emergencyRes.data.data);
    } catch (err) {
      console.error("Failed to load telemetry health records:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleEmergency = async (field, currentValue) => {
    const reason = prompt(`Enter reason for ${!currentValue ? "ENABLING" : "DISABLING"} ${field} mode:`);
    if (!reason) return;

    try {
      setUpdating(true);
      const res = await api.patch(`/admin/emergency/${field.replace(/([a-z0-9])([A-Z])/g, "$1-$2").toLowerCase()}`, {
        active: !currentValue,
        reason
      });
      if (res.data.success) {
        setEmergency(res.data.data);
      }
    } catch (err) {
      alert(err.response?.data?.message || "Failed to update emergency setting");
    } finally {
      setUpdating(false);
    }
  };

  useEffect(() => {
    fetchHealthData();
    const interval = setInterval(fetchHealthData, 5000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] text-teal-400">
        <RefreshCw className="w-8 h-8 animate-spin" />
        <span className="ml-2 font-semibold">Resolving system telemetry...</span>
      </div>
    );
  }

  const metrics = [
    { label: "Database Ping", value: `${telemetry?.dbLatency ?? 0} ms`, status: (telemetry?.dbLatency ?? 0) < 50 ? "Healthy" : "Degraded" },
    { label: "Search P95 Latency", value: `${telemetry?.searchP95 ?? 0} ms`, status: (telemetry?.searchP95 ?? 0) < 400 ? "Healthy" : "Degraded" },
    { label: "Notification Outbox Backlog", value: `${telemetry?.notificationBacklog ?? 0} items`, status: (telemetry?.notificationBacklog ?? 0) < 100 ? "Healthy" : "Backlog Risk" },
    { label: "Queue Waiting Bookings", value: `${telemetry?.queueBacklog ?? 0} entries`, status: "Operational" },
    { label: "Active Socket Sockets", value: `${telemetry?.activeSockets ?? 0} channels`, status: "Active" },
    { label: "API Error rate (60s)", value: `${telemetry?.errorRate ?? 0}%`, status: (telemetry?.errorRate ?? 0) < 5 ? "Healthy" : "Alert" },
    { label: "Search Cache Hit Rate", value: `${telemetry?.cacheHitRate ?? 0}%`, status: "Optimal" }
  ];

  return (
    <div className="space-y-6">
      {/* Emergency Control Panel */}
      <div className="bg-slate-950/40 p-6 rounded-xl border border-slate-800 backdrop-blur shadow-md space-y-4">
        <h4 className="font-bold text-slate-100 tracking-wide font-mono border-b border-slate-800 pb-3 flex items-center gap-2">
          <Settings className="w-4 h-4 text-teal-400" />
          Emergency System Controls (District Control Plane)
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Pause bookings */}
          <div className="bg-slate-900/50 p-5 rounded-lg border border-slate-800 flex flex-col justify-between space-y-4">
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold text-slate-200 font-mono">Pause Bookings</span>
                {emergency?.pauseBookings ? <AlertTriangle className="w-4.5 h-4.5 text-amber-500" /> : <CheckCircle2 className="w-4.5 h-4.5 text-emerald-500" />}
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Prevents patients from booking any new queue tickets. Active queues and completed visits continue unaffected.
              </p>
            </div>
            <button
              onClick={() => handleToggleEmergency("pauseBookings", emergency?.pauseBookings)}
              disabled={updating}
              className={`w-full py-2 rounded-lg text-xs font-bold font-mono transition duration-200 border ${
                emergency?.pauseBookings 
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20" 
                  : "bg-amber-600/10 text-amber-400 border-amber-500/30 hover:bg-amber-600/20"}`}
            >
              {emergency?.pauseBookings ? "Resume Bookings" : "Emergency Pause"}
            </button>
          </div>

          {/* Emergency readonly */}
          <div className="bg-slate-900/50 p-5 rounded-lg border border-slate-800 flex flex-col justify-between space-y-4">
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold text-slate-200 font-mono">Read-Only Mode</span>
                {emergency?.readonly ? <AlertOctagon className="w-4.5 h-4.5 text-orange-500" /> : <CheckCircle2 className="w-4.5 h-4.5 text-emerald-500" />}
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Blocks bookings (Test 15) and profile updates. Diagnostic records, EMR searches, and read-only views remain operational.
              </p>
            </div>
            <button
              onClick={() => handleToggleEmergency("readonly", emergency?.readonly)}
              disabled={updating}
              className={`w-full py-2 rounded-lg text-xs font-bold font-mono transition duration-200 border ${
                emergency?.readonly 
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20" 
                  : "bg-orange-600/10 text-orange-400 border-orange-500/30 hover:bg-orange-600/20"}`}
            >
              {emergency?.readonly ? "Restore Writes" : "Set Read-Only"}
            </button>
          </div>

          {/* Maintenance */}
          <div className="bg-slate-900/50 p-5 rounded-lg border border-slate-800 flex flex-col justify-between space-y-4">
            <div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-xs font-bold text-slate-200 font-mono">System Maintenance</span>
                {emergency?.maintenance ? <AlertOctagon className="w-4.5 h-4.5 text-rose-500" /> : <CheckCircle2 className="w-4.5 h-4.5 text-emerald-500" />}
              </div>
              <p className="text-[11px] text-slate-400 leading-relaxed">
                Triggers absolute system locks. Directs patient apps to maintenance splash. active queues and visits can continue.
              </p>
            </div>
            <button
              onClick={() => handleToggleEmergency("maintenance", emergency?.maintenance)}
              disabled={updating}
              className={`w-full py-2 rounded-lg text-xs font-bold font-mono transition duration-200 border ${
                emergency?.maintenance 
                  ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20" 
                  : "bg-rose-600/10 text-rose-400 border-rose-500/30 hover:bg-rose-600/20"}`}
            >
              {emergency?.maintenance ? "Complete Maintenance" : "Start Maintenance"}
            </button>
          </div>
        </div>
      </div>

      {/* Telemetry view */}
      <div className="bg-slate-950/40 p-6 rounded-xl border border-slate-800 backdrop-blur shadow-md space-y-4">
        <h4 className="font-bold text-slate-100 tracking-wide font-mono border-b border-slate-800 pb-3 flex items-center gap-2">
          <Radio className="w-4 h-4 text-teal-400" />
          Live Telemetry Records (Updated via 60s Health Worker)
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {metrics.map((m) => (
            <div key={m.label} className="bg-slate-900/50 p-4 rounded-lg border border-slate-800 text-xs font-mono space-y-1.5">
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">{m.label}</span>
              <div className="flex justify-between items-end">
                <span className="text-slate-100 text-sm font-bold">{m.value}</span>
                <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full ${
                  m.status === "Healthy" || m.status === "Optimal"
                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                    : m.status === "Degraded" || m.status === "Alert"
                    ? "bg-rose-500/10 text-rose-400 border border-rose-500/20 animate-pulse"
                    : "bg-slate-800 text-slate-400 border border-slate-700"
                }`}>
                  {m.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
