import { useEffect, useState } from "react";
import api from "../../services/api";
import toast from "react-hot-toast";
import { 
  Users, CheckCircle2, AlertTriangle, Clock, Activity, Heart, RefreshCw, Download, BarChart2 
} from "lucide-react";

export default function Analytics() {
  const [range, setRange] = useState("7days");
  const [status, setStatus] = useState("loading"); // "loading" | "empty" | "error" | "success"
  const [errorMsg, setErrorMsg] = useState("");
  const [exportLoading, setExportLoading] = useState(false);
  const [data, setData] = useState(null);

  const fetchAnalytics = async () => {
    try {
      setStatus("loading");
      setErrorMsg("");
      const res = await api.get(`/doctors/profile/analytics?range=${range}`);
      const fetchedData = res.data.data;
      setData(fetchedData);
      if (fetchedData && fetchedData.hasData) {
        setStatus("success");
      } else {
        setStatus("empty");
      }
    } catch (err) {
      console.error(err);
      const msg = err.response?.data?.message || "Failed to load analytics";
      setErrorMsg(msg);
      setStatus("error");
      toast.error(msg);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [range]);

  const handleExportCSV = async () => {
    if (!data || !data.hasData) return;
    try {
      setExportLoading(true);
      const res = await api.get(`/doctors/profile/analytics?range=${range}&download=true`);
      if (res.data.csvReady) {
        const blob = new Blob([res.data.csvData], { type: "text/csv" });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `doctor-analytics-${range}-${new Date().toISOString().split("T")[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
        toast.success("CSV report downloaded!");
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to export CSV report");
    } finally {
      setExportLoading(false);
    }
  };

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-10 flex flex-col items-center justify-center text-center space-y-4">
          <AlertTriangle className="h-16 w-16 text-red-500 animate-pulse" />
          <h3 className="text-lg font-bold text-red-800">Unable to load analytics</h3>
          <p className="text-sm text-red-600 max-w-sm">{errorMsg}</p>
          <button
            onClick={fetchAnalytics}
            className="flex items-center gap-2 px-5 py-2.5 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 transition duration-200 shadow-sm cursor-pointer"
          >
            <RefreshCw className="h-4 w-4" />
            Try Again
          </button>
        </div>
      </div>
    );
  }

  const kpi = data?.kpi || {
    totalConsulted: 0,
    completionRate: 0,
    noShowRate: 0,
    avgConsultationTime: 0,
    avgWaitTime: 0,
    throughput: 0,
    totalSessionHours: 0,
    healthScore: 0,
    patientRetention: 0
  };

  const trends = data?.trends || [];
  const outcomes = data?.outcomes || { completed: 0, skipped: 0, noShow: 0, cancelled: 0 };
  const efficiency = data?.efficiency || { activeSessionHours: 0, pausedHours: 0 };
  const comparison = data?.comparison?.previousPeriod || { totalConsulted: 0, completionRate: 0, healthScore: 0 };

  // Helper for Session Health Score badge color
  const getHealthBadge = (score) => {
    if (score >= 90) return { label: "Excellent", color: "bg-green-100 text-green-800 border-green-200" };
    if (score >= 75) return { label: "Good", color: "bg-blue-100 text-blue-800 border-blue-200" };
    if (score >= 50) return { label: "Fair", color: "bg-yellow-100 text-yellow-800 border-yellow-200" };
    return { label: "Needs Improvement", color: "bg-red-100 text-red-800 border-red-200" };
  };
  const healthBadge = getHealthBadge(kpi.healthScore);

  // SVG Chart Computations
  // 1. Line Trend Chart
  const svgWidth = 500;
  const svgHeight = 200;
  const padding = 25;
  const chartWidth = svgWidth - padding * 2;
  const chartHeight = svgHeight - padding * 2;

  const maxVal = Math.max(...trends.map(t => Math.max(t.completed, t.noShow, t.cancelled)), 5);

  const getPoints = (key) => {
    if (trends.length === 0) return "";
    return trends.map((t, idx) => {
      const x = padding + (idx / (trends.length - 1 || 1)) * chartWidth;
      const y = padding + chartHeight - (t[key] / maxVal) * chartHeight;
      return `${x},${y}`;
    }).join(" ");
  };

  const completedPoints = getPoints("completed");
  const noShowPoints = getPoints("noShow");
  const cancelledPoints = getPoints("cancelled");

  // 2. Donut Chart
  const totalOutcomes = outcomes.completed + outcomes.skipped + outcomes.noShow + outcomes.cancelled;
  const radius = 60;
  const circumference = 2 * Math.PI * radius;
  
  const getSegmentStroke = (value, offset) => {
    if (totalOutcomes === 0) return { strokeDasharray: `0 ${circumference}`, strokeDashoffset: 0 };
    const pct = (value / totalOutcomes) * circumference;
    return {
      strokeDasharray: `${pct} ${circumference}`,
      strokeDashoffset: -offset
    };
  };

  const completedOffset = 0;
  const skippedOffset = outcomes.completed;
  const noShowOffset = skippedOffset + outcomes.skipped;
  const cancelledOffset = noShowOffset + outcomes.noShow;

  const outcomesData = [
    { label: "Completed", value: outcomes.completed, color: "stroke-green-500 text-green-500", offset: 0 },
    { label: "Skipped", value: outcomes.skipped, color: "stroke-gray-400 text-gray-400", offset: completedOffset + outcomes.completed },
    { label: "No-Show", value: outcomes.noShow, color: "stroke-red-500 text-red-500", offset: noShowOffset },
    { label: "Cancelled", value: outcomes.cancelled, color: "stroke-amber-500 text-amber-500", offset: cancelledOffset }
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white shadow rounded-lg p-5 gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-800">OPD Session Analytics</h2>
          <p className="text-sm text-gray-500 mt-1">
            Tracking performance for {data?.period?.start} to {data?.period?.end} (Asia/Kolkata)
          </p>
        </div>
        
        <div className="flex gap-3 w-full md:w-auto">
          <select
            value={range}
            onChange={(e) => setRange(e.target.value)}
            className="bg-gray-50 border border-gray-300 text-gray-900 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 p-2.5"
          >
            <option value="today">Today</option>
            <option value="7days">Last 7 Days</option>
            <option value="30days">Last 30 Days</option>
          </select>
          
          <button
            onClick={handleExportCSV}
            disabled={!data?.hasData || exportLoading}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition duration-200 border ${
              !data?.hasData 
                ? "bg-gray-100 text-gray-400 border-gray-200 cursor-not-allowed" 
                : "bg-blue-600 text-white border-blue-600 hover:bg-blue-700 cursor-pointer"
            }`}
          >
            {exportLoading ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            Export Report
          </button>
        </div>
      </div>

      {status === "empty" ? (
        <div className="bg-white border border-gray-200 rounded-lg p-10 flex flex-col items-center justify-center text-center space-y-3">
          <BarChart2 className="h-16 w-16 text-gray-300" />
          <h3 className="text-lg font-bold text-gray-700">Not enough data yet</h3>
          <p className="text-sm text-gray-500 max-w-sm">
            Complete at least one patient consultation to populate charts and generate the daily session health score.
          </p>
        </div>
      ) : (
        <>
          {/* Health Score Summary Header Card */}
          <div className="bg-white border border-gray-200 rounded-lg p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div className="flex items-center gap-4">
              <div className="bg-blue-50 p-3.5 rounded-full border border-blue-100">
                <Heart className="h-7 w-7 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-800">Session Health Score</h3>
                <p className="text-xs text-gray-500">Determined from completion rate, wait time, attendance, and session active uptime.</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-3xl font-extrabold text-gray-900">{kpi.healthScore}/100</span>
              <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${healthBadge.color}`}>
                {healthBadge.label}
              </span>
            </div>
          </div>

          {/* KPI Stat Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <div className="bg-white border border-gray-200 rounded-lg p-5 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-gray-400">Total Consulted</p>
                <h4 className="text-2xl font-bold text-gray-800">{kpi.totalConsulted}</h4>
                <p className="text-xs text-gray-500">
                  {comparison.totalConsulted > 0 ? `${comparison.totalConsulted} in previous period` : "First period data"}
                </p>
              </div>
              <div className="bg-green-50 p-3 rounded-lg text-green-600">
                <Users className="h-6 w-6" />
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-5 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-gray-400">Completion Rate</p>
                <h4 className="text-2xl font-bold text-gray-800">{kpi.completionRate}%</h4>
                <p className="text-xs text-gray-500">
                  {comparison.completionRate > 0 ? `${comparison.completionRate}% in previous period` : "First period data"}
                </p>
              </div>
              <div className="bg-blue-50 p-3 rounded-lg text-blue-600">
                <CheckCircle2 className="h-6 w-6" />
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-5 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-gray-400">No-Show Rate</p>
                <h4 className="text-2xl font-bold text-gray-800">{kpi.noShowRate}%</h4>
                <p className="text-xs text-gray-500">Unattended patient visits</p>
              </div>
              <div className="bg-red-50 p-3 rounded-lg text-red-600">
                <AlertTriangle className="h-6 w-6" />
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-5 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-gray-400">Average Consultation</p>
                <h4 className="text-2xl font-bold text-gray-800">{kpi.avgConsultationTime}m</h4>
                <p className="text-xs text-gray-500">Per patient consultation</p>
              </div>
              <div className="bg-amber-50 p-3 rounded-lg text-amber-600">
                <Clock className="h-6 w-6" />
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-5 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-gray-400">Average Wait Time</p>
                <h4 className="text-2xl font-bold text-gray-800">{kpi.avgWaitTime}m</h4>
                <p className="text-xs text-gray-500">Before consultation starts</p>
              </div>
              <div className="bg-purple-50 p-3 rounded-lg text-purple-600">
                <Clock className="h-6 w-6" />
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-5 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-gray-400">Queue Throughput</p>
                <h4 className="text-2xl font-bold text-gray-800">{kpi.throughput}/hr</h4>
                <p className="text-xs text-gray-500">Completed patients per hour</p>
              </div>
              <div className="bg-indigo-50 p-3 rounded-lg text-indigo-600">
                <Activity className="h-6 w-6" />
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-5 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-gray-400">Total Session Hours</p>
                <h4 className="text-2xl font-bold text-gray-800">{kpi.totalSessionHours}h</h4>
                <p className="text-xs text-gray-500">Consultation uptime hours</p>
              </div>
              <div className="bg-gray-50 p-3 rounded-lg text-gray-600">
                <Clock className="h-6 w-6" />
              </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-lg p-5 flex items-center justify-between">
              <div className="space-y-1">
                <p className="text-sm font-medium text-gray-400">Patient Retention</p>
                <h4 className="text-2xl font-bold text-gray-800">{kpi.patientRetention}%</h4>
                <p className="text-xs text-gray-500">Patients with 2+ completed visits</p>
              </div>
              <div className="bg-teal-50 p-3 rounded-lg text-teal-600">
                <Users className="h-6 w-6" />
              </div>
            </div>
          </div>

          {/* Charts Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Consultation Trends Chart */}
            <div className="bg-white border border-gray-200 rounded-lg p-5 flex flex-col space-y-4">
              <h3 className="text-base font-bold text-gray-800">Consultation Trends</h3>
              <div className="flex justify-end gap-4 text-xs font-semibold">
                <div className="flex items-center gap-1.5"><span className="w-3 h-3 bg-green-500 rounded-full inline-block"></span>Completed</div>
                <div className="flex items-center gap-1.5"><span className="w-3 h-3 bg-red-500 rounded-full inline-block"></span>No-Show</div>
                <div className="flex items-center gap-1.5"><span className="w-3 h-3 bg-amber-500 rounded-full inline-block"></span>Cancelled</div>
              </div>
              <div className="flex items-center justify-center border border-gray-100 rounded-lg p-4 bg-gray-50 min-h-[220px]">
                <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} className="w-full h-auto">
                  {/* Grid Lines */}
                  <line x1={padding} y1={padding} x2={svgWidth - padding} y2={padding} stroke="#E5E7EB" strokeWidth="1" strokeDasharray="4" />
                  <line x1={padding} y1={padding + chartHeight / 2} x2={svgWidth - padding} y2={padding + chartHeight / 2} stroke="#E5E7EB" strokeWidth="1" strokeDasharray="4" />
                  <line x1={padding} y1={padding + chartHeight} x2={svgWidth - padding} y2={padding + chartHeight} stroke="#D1D5DB" strokeWidth="1" />
                  
                  {/* Paths */}
                  {completedPoints && <polyline fill="none" stroke="#22C55E" strokeWidth="2.5" points={completedPoints} />}
                  {noShowPoints && <polyline fill="none" stroke="#EF4444" strokeWidth="2" strokeDasharray="2 2" points={noShowPoints} />}
                  {cancelledPoints && <polyline fill="none" stroke="#F59E0B" strokeWidth="2" points={cancelledPoints} />}

                  {/* Labels */}
                  <text x={padding - 5} y={padding + 4} textAnchor="end" className="text-[10px] fill-gray-400 font-bold">{maxVal}</text>
                  <text x={padding - 5} y={padding + chartHeight / 2 + 4} textAnchor="end" className="text-[10px] fill-gray-400 font-bold">{Math.round(maxVal / 2)}</text>
                  <text x={padding - 5} y={padding + chartHeight + 4} textAnchor="end" className="text-[10px] fill-gray-400 font-bold">0</text>
                  
                  {trends.map((t, idx) => {
                    if (idx === 0 || idx === trends.length - 1 || trends.length <= 7 || idx % Math.round(trends.length / 5) === 0) {
                      const x = padding + (idx / (trends.length - 1 || 1)) * chartWidth;
                      const dayLabel = t.date.slice(5); // MM-DD
                      return (
                        <text key={idx} x={x} y={svgHeight - 4} textAnchor="middle" className="text-[10px] fill-gray-400 font-medium">
                          {dayLabel}
                        </text>
                      );
                    }
                    return null;
                  })}
                </svg>
              </div>
            </div>

            {/* Donut Chart & Outcomes */}
            <div className="bg-white border border-gray-200 rounded-lg p-5 flex flex-col justify-between">
              <h3 className="text-base font-bold text-gray-800 mb-4">Outcome Distribution</h3>
              <div className="flex flex-col md:flex-row items-center gap-8 justify-around py-4">
                <div className="relative flex items-center justify-center">
                  <svg width="150" height="150" viewBox="0 0 150 150" className="-rotate-90">
                    <circle cx="75" cy="75" r={radius} fill="transparent" stroke="#F3F4F6" strokeWidth="15" />
                    {totalOutcomes > 0 && outcomesData.map((seg, idx) => {
                      const strokeProps = getSegmentStroke(seg.value, (seg.offset / totalOutcomes) * circumference);
                      return (
                        <circle
                          key={idx}
                          cx="75"
                          cy="75"
                          r={radius}
                          fill="transparent"
                          className={seg.color}
                          strokeWidth="15"
                          strokeDasharray={strokeProps.strokeDasharray}
                          strokeDashoffset={strokeProps.strokeDashoffset}
                          strokeLinecap="round"
                        />
                      );
                    })}
                  </svg>
                  <div className="absolute flex flex-col items-center justify-center">
                    <span className="text-xl font-extrabold text-gray-800">{totalOutcomes}</span>
                    <span className="text-[10px] uppercase font-bold text-gray-400">Total Visits</span>
                  </div>
                </div>

                <div className="flex flex-col gap-3 w-full md:w-auto">
                  {outcomesData.map((item, idx) => {
                    const percentage = totalOutcomes > 0 ? Math.round((item.value / totalOutcomes) * 100) : 0;
                    return (
                      <div key={idx} className="flex items-center justify-between gap-6 w-full text-sm">
                        <div className="flex items-center gap-2 font-medium text-gray-700">
                          <span className={`w-3 h-3 rounded-full inline-block ${
                            item.label === "Completed" ? "bg-green-500" :
                            item.label === "Skipped" ? "bg-gray-400" :
                            item.label === "No-Show" ? "bg-red-500" : "bg-amber-500"
                          }`}></span>
                          {item.label}
                        </div>
                        <div className="flex items-center gap-3 font-semibold text-gray-900">
                          <span>{item.value}</span>
                          <span className="text-xs text-gray-400 font-medium">({percentage}%)</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Clinic Active vs Paused Session Hours */}
          <div className="bg-white border border-gray-200 rounded-lg p-5">
            <h3 className="text-base font-bold text-gray-800 mb-4">Clinic Session Efficiency</h3>
            <div className="flex flex-col space-y-4">
              <div className="flex items-center justify-between text-sm font-semibold text-gray-700">
                <div className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 bg-blue-600 rounded-sm inline-block"></span>
                  Active Consultation: <span className="font-extrabold text-gray-900">{efficiency.activeSessionHours} hrs</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-3.5 h-3.5 bg-gray-400 rounded-sm inline-block"></span>
                  Paused / Breaks: <span className="font-extrabold text-gray-900">{efficiency.pausedHours} hrs</span>
                </div>
              </div>
              <div className="w-full bg-gray-100 rounded-full h-5 flex overflow-hidden">
                {efficiency.activeSessionHours + efficiency.pausedHours > 0 ? (
                  <>
                    <div 
                      className="bg-blue-600 h-full flex items-center justify-center text-[10px] text-white font-bold" 
                      style={{ width: `${(efficiency.activeSessionHours / (efficiency.activeSessionHours + efficiency.pausedHours)) * 100}%` }}
                    >
                      {Math.round((efficiency.activeSessionHours / (efficiency.activeSessionHours + efficiency.pausedHours)) * 100)}% Active
                    </div>
                    <div 
                      className="bg-gray-400 h-full flex items-center justify-center text-[10px] text-white font-bold" 
                      style={{ width: `${(efficiency.pausedHours / (efficiency.activeSessionHours + efficiency.pausedHours)) * 100}%` }}
                    >
                      {Math.round((efficiency.pausedHours / (efficiency.activeSessionHours + efficiency.pausedHours)) * 100)}% Breaks
                    </div>
                  </>
                ) : (
                  <div className="w-full bg-gray-100 text-gray-400 flex items-center justify-center text-xs font-medium">No sessions run yet</div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
