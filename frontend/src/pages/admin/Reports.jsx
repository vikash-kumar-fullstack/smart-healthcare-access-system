import { useState, useEffect } from "react";
import api from "../../services/api";
import { 
  FileSpreadsheet, 
  Plus, 
  Download, 
  Eye, 
  RefreshCw 
} from "lucide-react";

export default function Reports() {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reportType, setReportType] = useState("doctor_performance");
  const [requesting, setRequesting] = useState(false);
  const [viewingPayload, setViewingPayload] = useState(null);

  const fetchReports = async () => {
    try {
      const res = await api.get("/admin/reports");
      if (res.data.success) {
        setReports(res.data.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load reports history");
    } finally {
      setLoading(false);
    }
  };

  const handleRequestReport = async (e) => {
    e.preventDefault();
    try {
      setRequesting(true);
      const res = await api.post("/admin/reports", { reportType });
      if (res.data.success) {
        alert("Report request submitted! It will generate in the background in a few seconds.");
        fetchReports();
      }
    } catch (err) {
      alert(err.response?.data?.message || "Failed to request report");
    } finally {
      setRequesting(false);
    }
  };

  const handleViewPayload = async (id) => {
    try {
      const res = await api.get(`/admin/reports/${id}`);
      if (res.data.success) {
        setViewingPayload(res.data.data);
      }
    } catch (err) {
      alert(err.response?.data?.message || "Failed to load report payload");
    }
  };

  useEffect(() => {
    fetchReports();
    // Poll every 5 seconds to update processing status in real time
    const interval = setInterval(fetchReports, 5000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] text-teal-400">
        <RefreshCw className="w-8 h-8 animate-spin" />
        <span className="ml-2 font-semibold">Loading reports engine...</span>
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

      {/* Trigger Form */}
      <div className="bg-slate-950/40 p-6 rounded-xl border border-slate-800 backdrop-blur shadow-md max-w-xl">
        <h4 className="font-bold text-slate-100 tracking-wide font-mono border-b border-slate-800 pb-3 flex items-center gap-2">
          <FileSpreadsheet className="w-4 h-4 text-teal-400" />
          Request New Administrative Summary Report
        </h4>
        <form onSubmit={handleRequestReport} className="flex flex-col sm:flex-row gap-4 items-end mt-4">
          <div className="flex-1">
            <label className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold block mb-1">
              Select Report Profile
            </label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2.5 text-xs focus:border-teal-500 outline-none text-slate-200"
            >
              <option value="doctor_performance">Doctor Performance (Queue Metrics)</option>
              <option value="queue_summary">Daily Queue Activity Summary</option>
              <option value="hospital_summary">Hospital Governance & Capacity</option>
              <option value="system_report">System Health (Latency / Telemetry)</option>
            </select>
          </div>
          <button
            type="submit"
            disabled={requesting}
            className="flex items-center justify-center gap-1.5 bg-teal-500 hover:bg-teal-600 active:bg-teal-700 text-slate-950 font-bold px-4 py-2.5 rounded-lg text-xs transition duration-200 disabled:opacity-50 font-mono shadow-lg shadow-teal-500/10 shrink-0"
          >
            <Plus className="w-4 h-4" />
            Generate Report
          </button>
        </form>
      </div>

      {/* List reports generated */}
      <div className="bg-slate-950/40 border border-slate-800 rounded-xl overflow-hidden shadow-md">
        <table className="w-full text-left text-xs font-sans">
          <thead className="bg-slate-950 text-slate-300 border-b border-slate-800 text-[10px] uppercase font-mono">
            <tr>
              <th className="p-4">Report Type</th>
              <th className="p-4">Requested By</th>
              <th className="p-4">Status</th>
              <th className="p-4">Generated At</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono">
            {reports.map((rep) => (
              <tr key={rep._id} className="hover:bg-slate-900/30 transition text-slate-300">
                <td className="p-4 font-semibold text-slate-200 capitalize">{rep.reportType.replace("_", " ")}</td>
                <td className="p-4 text-slate-400">{rep.requestedBy?.name || "System"}</td>
                <td className="p-4">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                    rep.status === "completed" 
                      ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                      : rep.status === "processing"
                      ? "bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse"
                      : rep.status === "failed"
                      ? "bg-rose-500/10 text-rose-400 border border-rose-500/20"
                      : "bg-slate-800 text-slate-400 border border-slate-700"
                  }`}>
                    {rep.status}
                  </span>
                </td>
                <td className="p-4 text-slate-400">
                  {rep.generatedAt ? new Date(rep.generatedAt).toLocaleString() : "Pending Calculation..."}
                </td>
                <td className="p-4 text-right">
                  {rep.status === "completed" && (
                    <button
                      onClick={() => handleViewPayload(rep._id)}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-200 font-bold rounded-lg text-xs transition duration-200"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      View Data
                    </button>
                  )}
                </td>
              </tr>
            ))}
            {reports.length === 0 && (
              <tr>
                <td colSpan="5" className="p-6 text-center text-slate-500 font-sans italic">
                  No reports generated yet. Use the selector above to compile records.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* JSON Viewer modal / details panel */}
      {viewingPayload && (
        <div className="bg-slate-950/60 border border-teal-500/30 p-6 rounded-xl space-y-4 animate-fadeIn max-h-[400px] overflow-y-auto">
          <div className="flex justify-between items-center border-b border-slate-800 pb-3">
            <h4 className="font-bold text-slate-100 text-sm font-mono capitalize">
              Data Payload: {viewingPayload.reportType.replace("_", " ")}
            </h4>
            <button
              onClick={() => setViewingPayload(null)}
              className="text-xs font-bold text-slate-400 hover:text-slate-200"
            >
              Dismiss
            </button>
          </div>
          <pre className="bg-slate-900/60 p-4 rounded-lg border border-slate-800 text-[10px] text-teal-300 font-mono overflow-x-auto select-all max-h-[300px]">
            {JSON.stringify(viewingPayload.payload, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
