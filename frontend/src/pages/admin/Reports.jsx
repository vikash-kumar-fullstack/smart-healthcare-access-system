import { useState, useEffect } from "react";
import api from "../../services/api";
import { 
  FileSpreadsheet, 
  Plus, 
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
        const list = Array.isArray(res.data.data) ? res.data.data : (res.data.data?.data || []);
        setReports(list);
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
        <div className="bg-rose-500/10 border border-rose-500/30 text-rose-650 p-4 rounded-xl font-mono text-xs text-left font-bold">
          <strong>ERROR:</strong> {error}
        </div>
      )}

      {/* Trigger Form */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200/50 hover:shadow-md transition-all duration-200 shadow-sm max-w-xl text-left">
        <h4 className="font-extrabold text-slate-800 tracking-tight border-b border-slate-100 pb-3 flex items-center gap-2">
          <FileSpreadsheet className="w-4 h-4 text-[#0E7490]" />
          Request New Administrative Summary Report
        </h4>
        <form onSubmit={handleRequestReport} className="flex flex-col sm:flex-row gap-4 items-end mt-4">
          <div className="flex-1 w-full">
            <label className="text-[10px] text-slate-500 uppercase tracking-wider font-semibold block mb-1">
              Select Report Profile
            </label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              className="w-full bg-white border border-slate-250 rounded-lg px-3 py-2.5 text-xs focus:border-[#0E7490] outline-none text-slate-700 cursor-pointer"
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
            className="flex items-center justify-center gap-1.5 bg-[#14B8A6] hover:bg-[#119f90] text-white font-bold px-4 py-2.5 rounded-lg text-xs transition duration-200 disabled:opacity-50 font-mono shadow-sm shrink-0 cursor-pointer border-none h-[38px]"
          >
            <Plus className="w-4 h-4" />
            Generate Report
          </button>
        </form>
      </div>

      {/* List reports generated */}
      <div className="bg-white border border-slate-200/50 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-200">
        <table className="w-full text-left text-xs font-sans">
          <thead className="bg-slate-50 text-slate-500 border-b border-slate-200/80 text-[10px] uppercase font-mono">
            <tr>
              <th className="p-4">Report Type</th>
              <th className="p-4">Requested By</th>
              <th className="p-4">Status</th>
              <th className="p-4">Generated At</th>
              <th className="p-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-mono">
            {reports.map((rep) => (
              <tr key={rep._id} className="hover:bg-slate-50/50 transition text-slate-700">
                <td className="p-4 font-semibold text-slate-800 capitalize">{rep.reportType.replace("_", " ")}</td>
                <td className="p-4 text-slate-500">{rep.requestedBy?.name || "System"}</td>
                <td className="p-4">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                    rep.status === "completed" 
                      ? "bg-emerald-50 text-emerald-600 border border-emerald-100/50"
                      : rep.status === "processing"
                      ? "bg-amber-50 text-amber-600 border border-amber-100/50 animate-pulse"
                      : rep.status === "failed"
                      ? "bg-rose-50 text-rose-600 border border-rose-100/50"
                      : "bg-slate-100 text-slate-500 border border-slate-200"
                  }`}>
                    {rep.status}
                  </span>
                </td>
                <td className="p-4 text-slate-500">
                  {rep.generatedAt ? new Date(rep.generatedAt).toLocaleString() : "Pending Calculation..."}
                </td>
                <td className="p-4 text-right">
                  {rep.status === "completed" && (
                    <button
                      onClick={() => handleViewPayload(rep._id)}
                      className="inline-flex items-center gap-1 px-3 py-1 bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold rounded-lg text-xs transition duration-200 cursor-pointer"
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
        <div className="bg-white border border-slate-200/50 p-6 rounded-2xl shadow-md space-y-4 animate-fadeIn max-h-[400px] overflow-y-auto text-left">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <h4 className="font-extrabold text-slate-800 text-sm capitalize">
              Data Payload: {viewingPayload.reportType.replace("_", " ")}
            </h4>
            <button
              onClick={() => setViewingPayload(null)}
              className="text-xs font-bold text-slate-500 hover:text-slate-700 cursor-pointer bg-none border-none"
            >
              Dismiss
            </button>
          </div>
          <pre className="bg-slate-50 p-4 rounded-xl border border-slate-150 text-[10.5px] text-[#0E7490] font-mono overflow-x-auto select-all max-h-[300px]">
            {JSON.stringify(viewingPayload.payload, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}
