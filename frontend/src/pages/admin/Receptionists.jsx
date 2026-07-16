import { useState, useEffect } from "react";
import api from "../../services/api";
import toast from "react-hot-toast";
import { UserPlus, Power, Trash2, Key, Users, Clock, Shield, Search, ArrowRight } from "lucide-react";
import Button from "../../components/landing/Button";

export default function Receptionists() {
  const [receptionists, setReceptionists] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Create Modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    password: "",
    employeeId: "",
    shift: "General"
  });

  // Actions states
  const [selectedRep, setSelectedRep] = useState(null);
  const [showResetModal, setShowResetModal] = useState(false);
  const [newPassword, setNewPassword] = useState("");

  const fetchReceptionists = async () => {
    try {
      setLoading(true);
      const res = await api.get("/hospital/receptionists");
      if (res.data.success) {
        setReceptionists(res.data.data);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load receptionists list.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReceptionists();
  }, []);

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    const t = toast.loading("Creating receptionist profile...");
    try {
      const res = await api.post("/hospital/receptionists", form);
      toast.success(res.data.message || "Receptionist created successfully!", { id: t });
      setShowCreateModal(false);
      setForm({ name: "", email: "", phone: "", password: "", employeeId: "", shift: "General" });
      fetchReceptionists();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to create account.", { id: t });
    }
  };

  const handleStatusToggle = async (profileId, currentStatus) => {
    const nextStatus = currentStatus === "active" ? "inactive" : "active";
    const t = toast.loading(`Setting status to ${nextStatus}...`);
    try {
      await api.patch(`/hospital/receptionists/${profileId}/status`, { status: nextStatus });
      toast.success(`Receptionist status set to ${nextStatus}.`, { id: t });
      fetchReceptionists();
    } catch (err) {
      toast.error(err.response?.data?.message || "Status change failed.", { id: t });
    }
  };

  const handleArchive = async (profileId) => {
    if (!window.confirm("Are you sure you want to archive this profile? Archived records cannot perform actions.")) return;
    const t = toast.loading("Archiving employee record...");
    try {
      await api.patch(`/hospital/receptionists/${profileId}/status`, { status: "archived" });
      toast.success("Profile archived successfully.", { id: t });
      fetchReceptionists();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to archive record.", { id: t });
    }
  };

  const handleShiftChange = async (profileId, shift) => {
    const t = toast.loading(`Assigning shift: ${shift}...`);
    try {
      await api.patch(`/hospital/receptionists/${profileId}/shift`, { shift });
      toast.success(`Shift successfully updated to ${shift}.`, { id: t });
      fetchReceptionists();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to assign shift.", { id: t });
    }
  };

  const handleResetSubmit = async (e) => {
    e.preventDefault();
    if (!newPassword) {
      toast.error("Password cannot be empty.");
      return;
    }
    const t = toast.loading("Updating password credentials...");
    try {
      await api.post(`/hospital/receptionists/${selectedRep._id}/force-password-reset`, { newPassword });
      toast.success("Password reset completed successfully. Force-reset flag set.", { id: t });
      setShowResetModal(false);
      setNewPassword("");
      setSelectedRep(null);
    } catch (err) {
      toast.error(err.response?.data?.message || "Reset failed.", { id: t });
    }
  };

  const filtered = receptionists.filter(r => {
    const text = (r.userId?.name + " " + r.userId?.email + " " + r.employeeId).toLowerCase();
    return text.includes(search.toLowerCase());
  });

  return (
    <div className="space-y-6 text-left">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight">Hospital Receptionists</h1>
          <p className="text-xs text-slate-500 mt-1">Manage receptionist employee profiles, assign duty shifts, and audit logs.</p>
        </div>
        <Button
          onClick={() => setShowCreateModal(true)}
          className="bg-[#0E7490] hover:bg-[#0c5f76] text-white flex items-center gap-2 rounded-xl text-xs py-2.5 px-4 shadow-sm"
        >
          <UserPlus className="h-4.5 w-4.5" />
          ADD RECEPTIONIST
        </Button>
      </div>

      {/* Search Header */}
      <div className="relative flex items-center max-w-md">
        <Search className="absolute left-3.5 h-4.5 w-4.5 text-slate-400" />
        <input
          type="text"
          placeholder="Search by name, email or employee ID..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-10 w-full pl-11 pr-4 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:border-[#0E7490]"
        />
      </div>

      {/* Grid List */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-pulse">
          <div className="h-32 bg-slate-200/50 rounded-2xl"></div>
          <div className="h-32 bg-slate-200/50 rounded-2xl"></div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center text-slate-450">
          <Users className="h-10 w-10 mx-auto text-slate-300 mb-3" />
          <p className="text-sm font-bold">No Receptionists Found</p>
          <p className="text-xs mt-1">Add a new receptionist profile to start managing desk check-ins.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map(r => (
            <div
              key={r._id}
              className={`bg-white border rounded-2xl p-5 shadow-sm relative flex flex-col justify-between transition-all hover:shadow-md ${
                r.status === "inactive" ? "border-slate-150 bg-slate-50/50 opacity-75" : "border-slate-200/60"
              }`}
            >
              <div>
                <div className="flex items-start justify-between">
                  <div className="flex gap-3">
                    <div className="h-11 w-11 rounded-xl bg-[#0E7490]/10 flex items-center justify-center text-[#0E7490] font-black text-sm shrink-0">
                      {r.userId?.name?.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <h3 className="font-bold text-slate-800 text-sm leading-snug">{r.userId?.name}</h3>
                      <p className="text-[10px] text-slate-455 mt-0.5">{r.userId?.email}</p>
                      <p className="text-[10px] text-slate-400 mt-0.5">ID: {r.employeeId}</p>
                    </div>
                  </div>

                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full capitalize shrink-0 ${
                    r.status === "active" ? "bg-emerald-50 text-emerald-600" :
                    r.status === "inactive" ? "bg-amber-50 text-amber-600" : "bg-rose-50 text-rose-600"
                  }`}>
                    {r.status}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-4 border-t border-b border-slate-100 my-4 py-2.5">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-slate-400" />
                    <div>
                      <p className="text-[9px] uppercase font-black text-slate-400 leading-none">Shift</p>
                      <select
                        value={r.shift}
                        disabled={r.status === "archived"}
                        onChange={(e) => handleShiftChange(r._id, e.target.value)}
                        className="text-xs text-slate-700 bg-transparent border-none p-0 mt-0.5 outline-none font-bold cursor-pointer"
                      >
                        <option value="Morning">Morning</option>
                        <option value="Evening">Evening</option>
                        <option value="Night">Night</option>
                        <option value="General">General</option>
                        <option value="Weekend">Weekend</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-slate-400" />
                    <div>
                      <p className="text-[9px] uppercase font-black text-slate-400 leading-none">Permissions</p>
                      <p className="text-xs font-bold text-slate-700 mt-0.5">Desk Operations</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2 mt-2 justify-end">
                {r.status !== "archived" && (
                  <>
                    <button
                      onClick={() => handleStatusToggle(r._id, r.status)}
                      className={`h-8 px-3 rounded-lg border text-xs font-bold flex items-center gap-1.5 transition ${
                        r.status === "active"
                          ? "border-amber-200 text-amber-700 hover:bg-amber-50"
                          : "border-emerald-250 text-emerald-700 hover:bg-emerald-50"
                      }`}
                    >
                      <Power className="h-3.5 w-3.5" />
                      {r.status === "active" ? "Deactivate" : "Activate"}
                    </button>

                    <button
                      onClick={() => {
                        setSelectedRep(r);
                        setShowResetModal(true);
                      }}
                      className="h-8 px-3 border border-slate-200 text-slate-700 hover:bg-slate-50 rounded-lg text-xs font-bold flex items-center gap-1.5 transition"
                    >
                      <Key className="h-3.5 w-3.5" />
                      Force Password
                    </button>

                    <button
                      onClick={() => handleArchive(r._id)}
                      className="h-8 w-8 border border-rose-200 text-rose-600 hover:bg-rose-50 rounded-lg flex items-center justify-center transition"
                      title="Archive Employee"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-lg bg-white rounded-3xl p-6 md:p-8 shadow-xl text-left border border-slate-100">
            <h2 className="text-lg font-black text-slate-800 tracking-tight mb-1">Create Receptionist Profile</h2>
            <p className="text-[11px] text-slate-500 mb-6">Setup new receptionist access logs associated with this hospital clinic.</p>

            <form onSubmit={handleCreateSubmit} className="flex flex-col gap-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] uppercase font-bold text-slate-450 tracking-wider">Full Name</label>
                  <input
                    type="text"
                    required
                    value={form.name}
                    onChange={(e) => setForm(prev => ({ ...prev, name: e.target.value }))}
                    className="h-10 w-full px-3 border border-slate-200 rounded-xl text-xs outline-none focus:border-[#0E7490]"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[9px] uppercase font-bold text-slate-450 tracking-wider">Employee ID</label>
                  <input
                    type="text"
                    placeholder="e.g. REP-892"
                    required
                    value={form.employeeId}
                    onChange={(e) => setForm(prev => ({ ...prev, employeeId: e.target.value }))}
                    className="h-10 w-full px-3 border border-slate-200 rounded-xl text-xs outline-none focus:border-[#0E7490]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] uppercase font-bold text-slate-450 tracking-wider">Email Address</label>
                  <input
                    type="email"
                    required
                    value={form.email}
                    onChange={(e) => setForm(prev => ({ ...prev, email: e.target.value }))}
                    className="h-10 w-full px-3 border border-slate-200 rounded-xl text-xs outline-none focus:border-[#0E7490]"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[9px] uppercase font-bold text-slate-450 tracking-wider">Phone Number</label>
                  <input
                    type="tel"
                    required
                    value={form.phone}
                    onChange={(e) => setForm(prev => ({ ...prev, phone: e.target.value }))}
                    className="h-10 w-full px-3 border border-slate-200 rounded-xl text-xs outline-none focus:border-[#0E7490]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex flex-col gap-1">
                  <label className="text-[9px] uppercase font-bold text-slate-450 tracking-wider">Password</label>
                  <input
                    type="password"
                    required
                    value={form.password}
                    onChange={(e) => setForm(prev => ({ ...prev, password: e.target.value }))}
                    className="h-10 w-full px-3 border border-slate-200 rounded-xl text-xs outline-none focus:border-[#0E7490]"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label className="text-[9px] uppercase font-bold text-slate-450 tracking-wider">Shift Assignment</label>
                  <select
                    value={form.shift}
                    onChange={(e) => setForm(prev => ({ ...prev, shift: e.target.value }))}
                    className="h-10 w-full px-3 border border-slate-200 bg-white rounded-xl text-xs outline-none focus:border-[#0E7490]"
                  >
                    <option value="Morning">Morning</option>
                    <option value="Evening">Evening</option>
                    <option value="Night">Night</option>
                    <option value="General">General</option>
                    <option value="Weekend">Weekend</option>
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2.5 mt-4">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-50 rounded-xl transition"
                >
                  Cancel
                </button>
                <Button
                  type="submit"
                  className="bg-[#0E7490] hover:bg-[#0c5f76] text-white text-xs font-bold py-2 px-5 rounded-xl shadow-md"
                >
                  CREATE RECEPTIONIST
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Modal */}
      {showResetModal && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-xl text-left border border-slate-100">
            <h2 className="text-lg font-black text-slate-800 tracking-tight mb-1">Force Password Reset</h2>
            <p className="text-[11px] text-slate-500 mb-6">Enter new credentials for <strong>{selectedRep?.userId?.name}</strong>.</p>

            <form onSubmit={handleResetSubmit} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label className="text-[9px] uppercase font-bold text-slate-455 tracking-wider">New Password</label>
                <input
                  type="password"
                  required
                  placeholder="Minimum 8 characters..."
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="h-10 w-full px-3 border border-slate-200 rounded-xl text-xs outline-none focus:border-[#0E7490]"
                />
              </div>

              <div className="flex justify-end gap-2.5 mt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowResetModal(false);
                    setSelectedRep(null);
                    setNewPassword("");
                  }}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-50 rounded-xl transition"
                >
                  Cancel
                </button>
                <Button
                  type="submit"
                  className="bg-[#0E7490] hover:bg-[#0c5f76] text-white text-xs font-bold py-2 px-5 rounded-xl shadow-md"
                >
                  FORCE RESET
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
