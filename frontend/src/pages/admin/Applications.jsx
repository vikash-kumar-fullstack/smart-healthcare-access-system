import { useState, useEffect } from "react";
import api from "../../services/api";
import toast from "react-hot-toast";
import { 
  FileSpreadsheet, 
  Check, 
  ShieldCheck, 
  Ban, 
  RotateCcw, 
  RefreshCw,
  Search,
  UserSquare,
  Clock,
  CheckCircle2,
  AlertCircle
} from "lucide-react";

export default function Applications() {
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("pending"); // "pending", "approved", "all"

  const fetchApplications = async () => {
    try {
      setLoading(true);
      const res = await api.get("/admin/doctors");
      if (res.data.success) {
        const list = Array.isArray(res.data.data) ? res.data.data : (res.data.data?.data || []);
        setDoctors(list);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load doctor applications");
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (id, actionType) => {
    const reason = prompt(`Enter administrative note/reason for '${actionType}' on this applicant:`);
    if (!reason) return;
    const t = toast.loading(`Processing ${actionType}...`);
    try {
      const res = await api.patch(`/admin/doctors/${id}/${actionType}`, { reason });
      if (res.data.success) {
        toast.success(`Applicant ${actionType} action executed successfully!`, { id: t });
        fetchApplications();
      }
    } catch (err) {
      if (err.response?.status === 409) {
        toast.error("CONCURRENCY CONFLICT: Profile was modified by another administrator.", { id: t });
        fetchApplications();
      } else {
        toast.error(err.response?.data?.message || "Failed to execute administrative action", { id: t });
      }
    }
  };

  useEffect(() => {
    fetchApplications();
  }, []);

  // Filter application applications logic
  const isPendingStatus = (status) => ["pending", "pending_profile", "pending_activation", "inactive"].includes(status);
  const isApprovedStatus = (status) => ["approved", "verified", "active"].includes(status);

  const filteredDoctors = doctors.filter((doc) => {
    const matchesSearch = 
      doc.name?.toLowerCase().includes(search.toLowerCase()) ||
      doc.specialization?.toLowerCase().includes(search.toLowerCase()) ||
      doc.hospitalId?.name?.toLowerCase().includes(search.toLowerCase());

    if (!matchesSearch) return false;

    if (activeFilter === "pending") return isPendingStatus(doc.status);
    if (activeFilter === "approved") return isApprovedStatus(doc.status);
    return true;
  });

  const pendingCount = doctors.filter(d => isPendingStatus(d.status)).length;
  const approvedCount = doctors.filter(d => isApprovedStatus(d.status)).length;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-[#0E7490]">
        <RefreshCw className="w-9 h-9 animate-spin mb-3" />
        <span className="font-extrabold text-sm text-slate-600">Loading Doctor Onboarding Applications...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-left animate-fade-in-up">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-[#0F4C81] via-[#0E7490] to-[#14B8A6] p-7 rounded-[32px] text-white shadow-lg relative overflow-hidden flex flex-col sm:flex-row sm:items-center sm:justify-between gap-6">
        <div className="space-y-1.5 z-10">
          <div className="flex items-center gap-2 bg-white/10 px-3.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider backdrop-blur-md w-fit">
            <FileSpreadsheet className="h-3.5 w-3.5" />
            Credential Review Portal
          </div>
          <h1 className="text-2xl font-black tracking-tight mt-1">Doctor Onboarding Applications</h1>
          <p className="text-xs text-cyan-100/90 font-medium">Review, verify, and approve medical credentials for incoming clinical staff.</p>
        </div>

        <div className="flex items-center gap-3 z-10 shrink-0">
          <div className="bg-white/15 backdrop-blur-md px-4 py-3 rounded-2xl border border-white/20 text-center">
            <div className="text-2xl font-black text-amber-300">{pendingCount}</div>
            <div className="text-[9px] font-black uppercase tracking-wider text-white/80">Pending Review</div>
          </div>
          <div className="bg-white/15 backdrop-blur-md px-4 py-3 rounded-2xl border border-white/20 text-center">
            <div className="text-2xl font-black text-emerald-300">{approvedCount}</div>
            <div className="text-[9px] font-black uppercase tracking-wider text-white/80">Approved</div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        {/* Search */}
        <div className="relative max-w-md w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search applicants by name, specialization, or hospital..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-11 w-full pl-11 pr-4 bg-white border border-slate-200/80 rounded-xl text-xs outline-none focus:border-[#0E7490] focus:ring-2 focus:ring-[#0E7490]/5 font-semibold text-slate-700 shadow-3xs"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 bg-slate-100/70 p-1 rounded-2xl border border-slate-200/60 self-start sm:self-auto">
          <button
            onClick={() => setActiveFilter("pending")}
            className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer border-none ${
              activeFilter === "pending"
                ? "bg-white text-[#0F4C81] shadow-xs"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Pending Applications ({pendingCount})
          </button>

          <button
            onClick={() => setActiveFilter("approved")}
            className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer border-none ${
              activeFilter === "approved"
                ? "bg-white text-[#0F4C81] shadow-xs"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            Approved ({approvedCount})
          </button>

          <button
            onClick={() => setActiveFilter("all")}
            className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer border-none ${
              activeFilter === "all"
                ? "bg-white text-[#0F4C81] shadow-xs"
                : "text-slate-500 hover:text-slate-800"
            }`}
          >
            All Submitted ({doctors.length})
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-2xl text-xs font-bold flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Applications List */}
      {filteredDoctors.length === 0 ? (
        <div className="bg-white border border-slate-200/60 rounded-3xl p-12 text-center text-slate-400">
          <Clock className="h-10 w-10 mx-auto text-slate-350 mb-3" />
          <h3 className="text-sm font-extrabold text-slate-700">No applications match the active filter</h3>
          <p className="text-xs font-semibold mt-1">Try selecting a different filter or clearing search query.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDoctors.map((doc) => {
            const isPending = isPendingStatus(doc.status);

            return (
              <div
                key={doc._id}
                className={`bg-white rounded-3xl border ${
                  isPending ? "border-amber-300/80 shadow-md" : "border-slate-200/60 shadow-xs"
                } p-6 flex flex-col justify-between space-y-4 hover:shadow-lg transition-all duration-300 relative overflow-hidden`}
              >
                {/* Top Badge Banner */}
                {isPending && (
                  <div className="bg-amber-500 text-white text-[9px] font-black uppercase tracking-widest px-3 py-1 -mx-6 -mt-6 mb-2 flex items-center justify-between">
                    <span>⚡ Action Required: Pending Approval</span>
                    <Clock className="h-3 w-3" />
                  </div>
                )}

                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-cyan-50 border border-cyan-100 flex items-center justify-center text-[#0E7490] font-black text-sm shrink-0">
                        👨‍⚕️
                      </div>
                      <div>
                        <h4 className="font-extrabold text-slate-850 tracking-tight text-sm">Dr. {doc.name}</h4>
                        <p className="text-xs text-[#0E7490] font-black capitalize mt-0.5">{doc.specialization}</p>
                      </div>
                    </div>

                    <span className={`text-[9px] px-2.5 py-1 rounded-full font-black uppercase tracking-wider ${
                      doc.status === "verified" 
                        ? "bg-teal-50 text-teal-700 border border-teal-200" 
                        : doc.status === "approved" || doc.status === "active"
                        ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                        : doc.status === "suspended"
                        ? "bg-rose-50 text-rose-700 border border-rose-200"
                        : "bg-amber-50 text-amber-700 border border-amber-200 animate-pulse"
                    }`}>
                      {doc.status?.replace("_", " ") || "pending"}
                    </span>
                  </div>

                  {/* Profile Metadata */}
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-xs font-semibold space-y-2 text-slate-600">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Assigned Hospital:</span>
                      <span className="text-slate-800 font-extrabold truncate max-w-[140px]">
                        {doc.hospitalId?.name || "Unassigned"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Avg Consultation:</span>
                      <span className="text-slate-800 font-bold">{doc.avgConsultationTime || 15} Mins</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Experience:</span>
                      <span className="text-slate-800 font-bold">{doc.experienceYears || 0} Years</span>
                    </div>
                    <div className="flex justify-between items-center pt-1 border-t border-slate-150">
                      <span className="text-slate-400">Application Status:</span>
                      <span className={`font-black text-[10px] px-2 py-0.5 rounded-md uppercase ${doc.profileCompleted ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                        {doc.profileCompleted ? "Submission Complete" : "Draft Incomplete"}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Administrative Action Bar */}
                <div className="border-t border-slate-100 pt-4 flex flex-col gap-2">
                  {isPending && (
                    <button
                      onClick={() => handleAction(doc._id, "approve")}
                      className="w-full flex items-center justify-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white font-extrabold py-2.5 px-4 rounded-xl text-xs transition duration-200 shadow-md cursor-pointer border-none"
                    >
                      <Check className="w-4 h-4" />
                      APPROVE APPLICATION
                    </button>
                  )}

                  {doc.status === "approved" && (
                    <button
                      onClick={() => handleAction(doc._id, "verify")}
                      className="w-full flex items-center justify-center gap-1.5 bg-[#14B8A6] hover:bg-[#119f90] active:scale-95 text-white font-extrabold py-2.5 px-4 rounded-xl text-xs transition duration-200 shadow-md cursor-pointer border-none"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      VERIFY CREDENTIALS
                    </button>
                  )}

                  <div className="grid grid-cols-2 gap-2">
                    {doc.status !== "suspended" && (
                      <button
                        onClick={() => handleAction(doc._id, "suspend")}
                        className="flex items-center justify-center gap-1 bg-slate-50 border border-slate-200 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 text-slate-500 font-bold py-2 px-3 rounded-xl text-xs transition cursor-pointer"
                      >
                        <Ban className="w-3.5 h-3.5" />
                        Reject / Suspend
                      </button>
                    )}

                    {doc.status === "suspended" && (
                      <button
                        onClick={() => handleAction(doc._id, "reset")}
                        className="flex items-center justify-center gap-1 bg-slate-50 border border-slate-200 hover:bg-amber-50 hover:text-amber-600 hover:border-amber-200 text-slate-500 font-bold py-2 px-3 rounded-xl text-xs transition cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        Reset Status
                      </button>
                    )}

                    <button
                      onClick={() => handleAction(doc._id, "reset")}
                      className="flex items-center justify-center gap-1 bg-slate-50 border border-slate-200 hover:bg-cyan-50 hover:text-[#0E7490] hover:border-cyan-200 text-slate-500 font-bold py-2 px-3 rounded-xl text-xs transition cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      Request Updates
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
