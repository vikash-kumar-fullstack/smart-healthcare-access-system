import { useState, useEffect } from "react";
import api from "../../services/api";
import { 
  ShieldAlert, 
  Search, 
  Terminal, 
  RefreshCw 
} from "lucide-react";

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
        setAudits(res.data.data);
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
        <div className="bg-rose-500/10 border border-rose-500/30 text-rose-400 p-4 rounded-lg font-mono text-xs">
          <strong>ERROR:</strong> {error}
        </div>
      )}

      {/* Filter and Search Bar */}
      <div className="flex bg-slate-950/40 p-4 rounded-xl border border-slate-800 backdrop-blur items-center gap-3">
        <Search className="w-4 h-4 text-slate-400 shrink-0" />
        <input
          type="text"
          placeholder="Filter audit logs by action, target, admin name, or reason..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="bg-transparent border-0 outline-none text-slate-200 text-xs w-full font-sans"
        />
      </div>

      {/* Audit Log Table */}
      <div className="bg-slate-950/40 border border-slate-800 rounded-xl overflow-hidden shadow-md">
        <table className="w-full text-left text-xs font-sans">
          <thead className="bg-slate-950 text-slate-300 border-b border-slate-800 text-[10px] uppercase font-mono">
            <tr>
              <th className="p-4">Action</th>
              <th className="p-4">Target Type</th>
              <th className="p-4">Reason</th>
              <th className="p-4">Admin</th>
              <th className="p-4">Request ID</th>
              <th className="p-4 text-right">Details</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-mono text-[11px] text-slate-300">
            {filteredAudits.map((aud) => (
              <tr key={aud._id} className="hover:bg-slate-900/30 transition">
                <td className="p-4 font-semibold text-teal-400 uppercase tracking-wide">{aud.action}</td>
                <td className="p-4 text-slate-200">{aud.targetType}</td>
                <td className="p-4 text-slate-400 italic max-w-[150px] overflow-hidden text-ellipsis whitespace-nowrap">
                  {aud.reason || "N/A"}
                </td>
                <td className="p-4 text-slate-400">{aud.adminId?.name || "System"}</td>
                <td className="p-4 text-slate-500 text-[10px]">{aud.requestId || "N/A"}</td>
                <td className="p-4 text-right">
                  <button
                    onClick={() => setSelectedAudit(aud)}
                    className="inline-flex items-center gap-1 px-3 py-1 bg-slate-900 border border-slate-800 hover:border-slate-700 text-slate-200 font-bold rounded-lg text-xs transition duration-200"
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
        <div className="bg-slate-950/60 border border-teal-500/30 p-6 rounded-xl space-y-4 animate-fadeIn max-h-[500px] overflow-y-auto">
          <div className="flex justify-between items-center border-b border-slate-800 pb-3">
            <div>
              <h4 className="font-bold text-slate-100 text-sm font-mono uppercase text-teal-400">
                Audit Diff: {selectedAudit.action}
              </h4>
              <p className="text-[10px] text-slate-400 font-mono mt-0.5">Target ID: {selectedAudit.targetId}</p>
            </div>
            <button
              onClick={() => setSelectedAudit(null)}
              className="text-xs font-bold text-slate-400 hover:text-slate-200"
            >
              Dismiss
            </button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-[10px] font-mono">
            <div className="space-y-1">
              <span className="text-slate-400 uppercase font-bold tracking-wider">Before State</span>
              <pre className="bg-slate-900/60 p-4 rounded-lg border border-slate-800 text-rose-300 overflow-x-auto max-h-[300px]">
                {JSON.stringify(selectedAudit.before, null, 2)}
              </pre>
            </div>
            <div className="space-y-1">
              <span className="text-slate-400 uppercase font-bold tracking-wider">After State</span>
              <pre className="bg-slate-900/60 p-4 rounded-lg border border-slate-800 text-emerald-300 overflow-x-auto max-h-[300px]">
                {JSON.stringify(selectedAudit.after, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
