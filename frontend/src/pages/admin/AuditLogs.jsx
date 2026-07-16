import { useState, useEffect } from "react";
import api from "../../services/api";
import { Search, Terminal, RefreshCw } from "lucide-react";

export default function AuditLogs() {
  const [audits, setAudits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedAudit, setSelectedAudit] = useState(null);

  const fetchAudits = async () => {
    try {
      const res = await api.get("/admin/audits");
      if (res.data.success) {
        const list = Array.isArray(res.data.data) ? res.data.data : (res.data.data?.data || []);
        setAudits(list);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load audit logs database");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAudits();
  }, []);

  const filteredAudits = audits.filter(a => 
    a.action.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.targetType.toLowerCase().includes(searchQuery.toLowerCase()) ||
    a.reason.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (a.adminId?.name || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[50vh] text-teal-400">
        <RefreshCw className="w-8 h-8 animate-spin" />
        <span className="ml-2 font-semibold">Loading audit logs database...</span>
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

      {/* Filter and Search Bar */}
      <div className="flex bg-white p-4 rounded-2xl border border-slate-200/50 hover:shadow-md transition-all duration-200 shadow-sm items-center gap-3 text-left">
        <Search className="w-4 h-4 text-slate-500 shrink-0" />
        <input
          type="text"
          placeholder="Filter audit logs by action, target, admin name, or reason..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="bg-transparent border-0 outline-none text-slate-800 placeholder-slate-400 text-xs w-full font-sans"
        />
      </div>

      {/* Audit Log Table */}
      <div className="bg-white border border-slate-200/50 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-200">
        <table className="w-full text-left text-xs font-sans">
          <thead className="bg-slate-50 text-slate-500 border-b border-slate-200/80 text-[10px] uppercase font-mono">
            <tr>
              <th className="p-4">Action</th>
              <th className="p-4">Target Type</th>
              <th className="p-4">Reason</th>
              <th className="p-4">Admin</th>
              <th className="p-4">Request ID</th>
              <th className="p-4 text-right">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 font-mono text-[11px] text-slate-700">
            {filteredAudits.map((aud) => (
              <tr key={aud._id} className="hover:bg-slate-50/50 transition">
                <td className="p-4 font-semibold text-[#0E7490] uppercase tracking-wide">{aud.action}</td>
                <td className="p-4 text-slate-800 font-semibold">{aud.targetType}</td>
                <td className="p-4 text-slate-500 italic max-w-[150px] overflow-hidden text-ellipsis whitespace-nowrap">
                  {aud.reason || "N/A"}
                </td>
                <td className="p-4 text-slate-500">{aud.adminId?.name || "System"}</td>
                <td className="p-4 text-slate-450 text-[10px]">{aud.requestId || "N/A"}</td>
                <td className="p-4 text-right">
                  <button
                    onClick={() => setSelectedAudit(aud)}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-slate-50 border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold rounded-lg text-xs transition duration-200 cursor-pointer"
                  >
                    <Terminal className="w-3.5 h-3.5" />
                    Diff
                  </button>
                </td>
              </tr>
            ))}
            {filteredAudits.length === 0 && (
              <tr>
                <td colSpan="6" className="p-6 text-center text-slate-500 font-sans italic">
                  No matching audits logged.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Details Diff viewer panel */}
      {selectedAudit && (
        <div className="bg-white border border-slate-200/50 p-6 rounded-2xl shadow-md space-y-4 animate-fadeIn max-h-[500px] overflow-y-auto text-left">
          <div className="flex justify-between items-center border-b border-slate-100 pb-3">
            <div>
              <h4 className="font-extrabold text-slate-800 text-sm capitalize">
                Audit Diff: <span className="text-[#0E7490] font-mono">{selectedAudit.action}</span>
              </h4>
              <p className="text-[10px] text-slate-550 font-mono mt-0.5">Target ID: {selectedAudit.targetId}</p>
            </div>
            <button
              onClick={() => setSelectedAudit(null)}
              className="text-xs font-bold text-slate-500 hover:text-slate-700 cursor-pointer bg-none border-none"
            >
              Dismiss
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[10px] font-mono">
            <div className="space-y-2">
              <span className="text-slate-550 uppercase font-bold tracking-wider">Before State</span>
              <pre className="bg-rose-50/40 p-4 rounded-xl border border-rose-100 text-rose-700 overflow-x-auto max-h-[300px]">
                {JSON.stringify(selectedAudit.before, null, 2)}
              </pre>
            </div>
            <div className="space-y-2">
              <span className="text-slate-550 uppercase font-bold tracking-wider">After State</span>
              <pre className="bg-emerald-50/40 p-4 rounded-xl border border-emerald-100 text-emerald-700 overflow-x-auto max-h-[300px]">
                {JSON.stringify(selectedAudit.after, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
