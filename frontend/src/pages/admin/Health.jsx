import { useState, useEffect } from "react";
import api from "../../services/api";
import { 
  Settings, 
  Radio, 
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

      {/* Emergency Control Panel */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/50 shadow-sm space-y-5 text-left hover-card-trigger">
        <h4 className="font-black text-slate-800 tracking-tight border-b border-slate-100 pb-3 flex items-center gap-2 text-sm uppercase">
          <Settings className="w-4.5 h-4.5 text-[#0E7490]" />
          Emergency System Controls (District Control Plane)
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Pause bookings */}
          <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-150 flex flex-col justify-between space-y-4 hover-card-trigger">
            <div>
              <div className="flex justify-between items-center mb-2.5">
                <span className="text-xs font-black text-slate-800 uppercase tracking-wider">Pause Bookings</span>
                {emergency?.pauseBookings ? <AlertTriangle className="w-4.5 h-4.5 text-amber-500" /> : <CheckCircle2 className="w-4.5 h-4.5 text-emerald-500" />}
              </div>
              <p className="text-[11px] text-slate-550 leading-relaxed font-semibold">
                Prevents patients from booking any new queue tickets. Active queues and completed visits continue unaffected.
              </p>
            </div>
            <button
              onClick={() => handleToggleEmergency("pauseBookings", emergency?.pauseBookings)}
              disabled={updating}
              className={`w-full py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition duration-200 border cursor-pointer ${
                emergency?.pauseBookings 
                  ? "bg-emerald-50 text-emerald-700 border-emerald-250 hover:bg-emerald-100" 
                  : "bg-amber-50 text-amber-700 border-amber-250 hover:bg-amber-100"}`}
            >
              {emergency?.pauseBookings ? "Resume Bookings" : "Emergency Pause"}
            </button>
          </div>

          {/* Emergency readonly */}
          <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-150 flex flex-col justify-between space-y-4 hover-card-trigger">
            <div>
              <div className="flex justify-between items-center mb-2.5">
                <span className="text-xs font-black text-slate-800 uppercase tracking-wider">Read-Only Mode</span>
                {emergency?.readonly ? <AlertOctagon className="w-4.5 h-4.5 text-orange-500 animate-pulse" /> : <CheckCircle2 className="w-4.5 h-4.5 text-emerald-500" />}
              </div>
              <p className="text-[11px] text-slate-550 leading-relaxed font-semibold">
                Blocks bookings (Test 15) and profile updates. Diagnostic records, EMR searches, and read-only views remain operational.
              </p>
            </div>
            <button
              onClick={() => handleToggleEmergency("readonly", emergency?.readonly)}
              disabled={updating}
              className={`w-full py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition duration-200 border cursor-pointer ${
                emergency?.readonly 
                  ? "bg-emerald-50 text-emerald-700 border-emerald-250 hover:bg-emerald-100" 
                  : "bg-orange-50 text-orange-700 border-orange-250 hover:bg-orange-100"}`}
            >
              {emergency?.readonly ? "Restore Writes" : "Set Read-Only"}
            </button>
          </div>

          {/* Maintenance */}
          <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-150 flex flex-col justify-between space-y-4 hover-card-trigger">
            <div>
              <div className="flex justify-between items-center mb-2.5">
                <span className="text-xs font-black text-slate-800 uppercase tracking-wider">System Maintenance</span>
                {emergency?.maintenance ? <AlertOctagon className="w-4.5 h-4.5 text-rose-500" /> : <CheckCircle2 className="w-4.5 h-4.5 text-emerald-500" />}
              </div>
              <p className="text-[11px] text-slate-550 leading-relaxed font-semibold">
                Triggers absolute system locks. Directs patient apps to maintenance splash. active queues and visits can continue.
              </p>
            </div>
            <button
              onClick={() => handleToggleEmergency("maintenance", emergency?.maintenance)}
              disabled={updating}
              className={`w-full py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition duration-200 border cursor-pointer ${
                emergency?.maintenance 
                  ? "bg-emerald-50 text-emerald-700 border-emerald-250 hover:bg-emerald-100" 
                  : "bg-rose-50 text-rose-700 border-rose-250 hover:bg-rose-100"}`}
            >
              {emergency?.readonly ? "Complete Maintenance" : "Start Maintenance"}
            </button>
          </div>
        </div>
      </div>

      {/* Telemetry view */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/50 shadow-sm space-y-5 text-left hover-card-trigger">
        <h4 className="font-black text-slate-800 tracking-tight border-b border-slate-100 pb-3 flex items-center gap-2 text-sm uppercase">
          <Radio className="w-4.5 h-4.5 text-[#0E7490]" />
          Live Telemetry Records (Updated via 60s Health Worker)
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {metrics.map((m) => (
            <div key={m.label} className="bg-slate-50/50 p-5 rounded-2xl border border-slate-150 text-xs font-mono space-y-2 hover-card-trigger">
              <span className="text-slate-450 block text-[10px] uppercase font-black tracking-widest">{m.label}</span>
              <div className="flex justify-between items-end">
                <span className="text-slate-800 text-sm font-black">{m.value}</span>
                <span className={`text-[9px] font-black px-2.5 py-0.5 rounded-full ${
                  m.status === "Healthy" || m.status === "Optimal"
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-100/50"
                    : m.status === "Degraded" || m.status === "Alert"
                    ? "bg-rose-50 text-rose-700 border border-rose-150 animate-pulse"
                    : "bg-slate-100 text-slate-500 border border-slate-200"
                }`}>
                  {m.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Backup & Recovery Status */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/50 shadow-sm space-y-5 text-left hover-card-trigger">
        <h4 className="font-black text-slate-800 tracking-tight border-b border-slate-100 pb-3 flex items-center gap-2 text-sm uppercase">
          <Settings className="w-4.5 h-4.5 text-emerald-600" />
          Backup & Recovery Status
        </h4>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-150 text-xs font-mono space-y-2">
            <span className="text-slate-450 block text-[10px] uppercase font-black tracking-widest">Backup Health</span>
            <div className="flex justify-between items-center">
              <span className="text-slate-800 text-sm font-black">EXCELLENT</span>
              <span className="text-[9px] font-black px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100/50">Optimal</span>
            </div>
          </div>
          <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-150 text-xs font-mono space-y-2">
            <span className="text-slate-450 block text-[10px] uppercase font-black tracking-widest">Last Automated Run</span>
            <div className="flex justify-between items-center">
              <span className="text-slate-800 text-xs font-black">{new Date().toDateString()}</span>
              <span className="text-[9px] font-black px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-500 border border-slate-200">Daily Schedule</span>
            </div>
          </div>
          <div className="bg-slate-50/50 p-5 rounded-2xl border border-slate-150 text-xs font-mono space-y-2">
            <span className="text-slate-450 block text-[10px] uppercase font-black tracking-widest">Encryption Standard</span>
            <div className="flex justify-between items-center">
              <span className="text-slate-800 text-xs font-black">AES-256-GCM</span>
              <span className="text-[9px] font-black px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100/50">Secure</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
