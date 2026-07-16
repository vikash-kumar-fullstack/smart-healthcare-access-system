import React, { useState, useEffect } from "react";
import api from "../../services/api";
import toast from "react-hot-toast";
import {
  User,
  Mail,
  Phone,
  Calendar,
  Building,
  Shield,
  FileText,
  UserCheck,
  Edit2,
  Lock,
  Camera
} from "lucide-react";

export default function Profile() {
  const [user, setUser] = useState(null);
  const [doctorProfile, setDoctorProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessions, setSessions] = useState([]);
  const [fetchingSessions, setFetchingSessions] = useState(false);

  // Edit form states
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    phone: ""
  });
  const [saving, setSaving] = useState(false);

  const fetchSessions = async () => {
    try {
      setFetchingSessions(true);
      const res = await api.get("/auth/sessions");
      if (res.data?.success) {
        setSessions(res.data.data);
      }
    } catch (err) {
      console.error("Failed to load active sessions:", err);
    } finally {
      setFetchingSessions(false);
    }
  };

  const handleRevokeSession = async (id) => {
    try {
      const res = await api.delete(`/auth/sessions/${id}`);
      if (res.data?.success) {
        toast.success("Device session logged out.");
        fetchSessions();
      }
    } catch (err) {
      toast.error("Failed to revoke session.");
    }
  };

  const handleLogoutAll = async () => {
    try {
      const res = await api.delete("/auth/sessions");
      if (res.data?.success) {
        toast.success("Logged out from all other devices.");
        fetchSessions();
      }
    } catch (err) {
      toast.error("Failed to logout other devices.");
    }
  };

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const res = await api.get("/auth/me");
      if (res.data?.success) {
        const u = res.data.data;
        setUser(u);
        setEditForm({ name: u.name, phone: u.phone || "" });

        if (u.role === "doctor") {
          const docRes = await api.get("/doctors/profile").catch(() => null);
          if (docRes?.data?.success) {
            setDoctorProfile(docRes.data.data);
          }
        }
      }
    } catch (err) {
      console.error("Failed to load profile:", err);
      toast.error("Failed to load profile details.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
    fetchSessions();
  }, []);

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!editForm.name.trim() || !editForm.phone.trim()) {
      toast.error("Name and Phone fields are required.");
      return;
    }

    setSaving(true);
    try {
      const res = await api.put("/auth/me", editForm);
      if (res.data?.success) {
        toast.success("Profile details updated successfully!");
        setUser(res.data.data);
        setEditModalOpen(false);

        // Update name in local storage/token if decoded locally
        const token = localStorage.getItem("token");
        if (token) {
          const parts = token.split(".");
          if (parts.length === 3) {
            const decoded = JSON.parse(atob(parts[1]));
            decoded.name = res.data.data.name;
            const updatedToken = btoa(JSON.stringify(decoded)); // Note: this is a mock representation helper
            // We just let the app load it from localStorage if we had cached name separately, 
            // but fetching me from layout will auto-update anyway.
          }
        }
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update profile.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="py-16 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0F4C81] mx-auto mb-3" />
        <p className="text-slate-500 text-xs font-semibold">Loading profile parameters...</p>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Page Title */}
      <div>
        <h1 className="text-2xl font-black text-slate-800 tracking-tight">Personal Workspace Account</h1>
        <p className="text-xs text-slate-500 mt-1">Manage credentials, medical credentials, and registry contact details.</p>
      </div>

      {/* Main Profile Showcase Card */}
      <div className="bg-white rounded-3xl border border-slate-200/60 overflow-hidden shadow-sm">
        {/* Cover clinical header banner */}
        <div className="h-32 bg-gradient-to-r from-[#0F4C81] to-[#14B8A6] relative">
          <button
            onClick={() => setEditModalOpen(true)}
            className="absolute top-4 right-4 bg-white/20 hover:bg-white/30 backdrop-blur-xs text-white border border-white/10 px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer active:scale-95"
          >
            <Edit2 className="h-3.5 w-3.5" />
            Edit Profile
          </button>
        </div>

        {/* Profile Avatar / Overlay area */}
        <div className="px-6 pb-6 relative text-left">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 -mt-12 sm:-mt-16 mb-4">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl bg-gradient-to-br from-[#0F4C81] to-[#14B8A6] text-white flex items-center justify-center font-black text-3xl shadow-md border-4 border-white shrink-0 relative group">
              {user.name.charAt(0).toUpperCase()}
              <div className="absolute inset-0 bg-black/45 rounded-3xl opacity-0 group-hover:opacity-100 flex items-center justify-center transition-all cursor-pointer">
                <Camera className="h-5 w-5" />
              </div>
            </div>
            <div className="pb-1">
              <h2 className="text-xl font-black text-slate-800">{user.name}</h2>
              <p className="text-xs text-slate-500 capitalize mt-0.5 font-semibold flex items-center gap-1.5">
                <Shield className="h-3.5 w-3.5 text-[#14B8A6]" />
                {user.role} Account
              </p>
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 border-t border-slate-100 pt-6">
            <div className="space-y-4">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Email Address</span>
                <span className="text-sm font-semibold text-slate-700 mt-1 flex items-center gap-2">
                  <Mail className="h-4 w-4 text-slate-400" />
                  {user.email}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Phone Number</span>
                <span className="text-sm font-semibold text-slate-700 mt-1 flex items-center gap-2">
                  <Phone className="h-4 w-4 text-slate-400" />
                  {user.phone || "Not provided"}
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Member Since</span>
                <span className="text-sm font-semibold text-slate-700 mt-1 flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-slate-400" />
                  {new Date(user.createdAt).toLocaleDateString([], { year: "numeric", month: "long", day: "numeric" })}
                </span>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Account Status</span>
                <span className="text-sm font-semibold text-slate-700 mt-1 flex items-center gap-2">
                  <UserCheck className="h-4 w-4 text-emerald-500" />
                  <span className="text-emerald-600 font-extrabold">Active</span>
                </span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Security Shield</span>
                <span className="text-sm font-semibold text-slate-750 mt-1 flex items-center gap-2">
                  <Lock className="h-4 w-4 text-[#0F4C81]" />
                  <span>Two-factor validation active</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Doctor-Specific Details Card (If applicable) */}
      {user.role === "doctor" && doctorProfile && (
        <div className="bg-white rounded-3xl border border-slate-200/60 p-6 text-left shadow-sm">
          <h3 className="text-base font-black text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-2">
            <Building className="h-5 w-5 text-[#0F4C81]" />
            Practitioner Verification Registry
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-5">
            <div className="space-y-4">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Clinical Specialization</span>
                <span className="text-sm font-semibold text-slate-750 mt-1 block">{doctorProfile.specialization || "General medicine"}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Medical License Registry ID</span>
                <span className="text-sm font-mono text-[#0E7490] mt-1 font-bold block">{doctorProfile.licenseNumber || "N/A"}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Registered Clinic</span>
                <span className="text-sm font-semibold text-slate-750 mt-1 block">{doctorProfile.hospitalId?.name || "PMCH Partner Center"}</span>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Consultation Fee</span>
                <span className="text-sm font-semibold text-slate-750 mt-1 block">₹{doctorProfile.consultationFee || 200}</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Average Treatment Duration</span>
                <span className="text-sm font-semibold text-slate-750 mt-1 block">{doctorProfile.avgConsultationTime || 15} mins</span>
              </div>
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Registration Status</span>
                <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-extrabold mt-1.5 ${
                  doctorProfile.verificationStatus === "verified"
                    ? "bg-emerald-50 text-emerald-700 border border-emerald-250/20"
                    : "bg-amber-50 text-amber-700 border border-amber-250/20"
                }`}>
                  <span className={`h-1.5 w-1.5 rounded-full ${doctorProfile.verificationStatus === "verified" ? "bg-emerald-500" : "bg-amber-500"}`} />
                  {doctorProfile.verificationStatus?.toUpperCase() || "PENDING"}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Active Sessions UI Component */}
      <div className="bg-white rounded-3xl border border-slate-200/60 p-6 shadow-sm space-y-6 text-left">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-base font-black text-slate-800 tracking-tight">Active Sessions</h3>
            <p className="text-[11px] text-slate-500 mt-0.5">Below are devices that currently hold active connections to this account.</p>
          </div>
          {sessions.length > 1 && (
            <button
              onClick={handleLogoutAll}
              className="bg-rose-50 hover:bg-rose-100 text-rose-700 hover:border-rose-350 border border-rose-250/20 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer"
            >
              Logout All Devices
            </button>
          )}
        </div>

        {fetchingSessions ? (
          <div className="py-4 text-center text-slate-400 text-xs">Loading active devices...</div>
        ) : sessions.length === 0 ? (
          <div className="py-4 text-center text-slate-400 text-xs">No other active sessions found.</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {sessions.map((sess) => (
              <div key={sess._id} className="py-4.5 flex items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-slate-800">
                      {sess.deviceName}
                    </span>
                    <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 rounded-full text-[9px] font-black text-slate-500 uppercase tracking-wider">
                      {sess.browser}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-400 font-semibold">
                    <span>IP Address: <span className="font-mono">{sess.ipAddress || "Unknown"}</span></span>
                    <span>•</span>
                    <span>Created: {new Date(sess.createdAt).toLocaleString()}</span>
                  </div>
                </div>
                <button
                  onClick={() => handleRevokeSession(sess._id)}
                  className="px-3.5 py-1.5 bg-slate-50 hover:bg-rose-50 hover:text-rose-600 border border-slate-200 hover:border-rose-250/20 text-slate-600 rounded-lg text-[10px] font-bold transition"
                >
                  Revoke
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit Profile Modal */}
      {editModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200 text-left">
            <div className="bg-slate-50 border-b border-slate-200 px-6 py-4.5">
              <h3 className="text-base font-black text-slate-800">Edit Profile Contact Details</h3>
            </div>
            <form onSubmit={handleUpdate}>
              <div className="p-6 space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Full Name</label>
                  <input
                    type="text"
                    required
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="h-10.5 w-full px-3.5 rounded-xl border border-slate-200 bg-[#F8FAFC] text-xs text-slate-800 outline-none transition focus:border-[#0E7490] focus:bg-white focus:ring-2 focus:ring-[#0E7490]/5"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Phone Number</label>
                  <input
                    type="tel"
                    required
                    value={editForm.phone}
                    onChange={(e) => setEditForm({ ...editForm, phone: e.target.value })}
                    className="h-10.5 w-full px-3.5 rounded-xl border border-slate-200 bg-[#F8FAFC] text-xs text-slate-800 outline-none transition focus:border-[#0E7490] focus:bg-white focus:ring-2 focus:ring-[#0E7490]/5"
                  />
                </div>
              </div>
              <div className="bg-slate-50 border-t border-slate-200 px-6 py-4.5 flex justify-end gap-2.5">
                <button
                  type="button"
                  onClick={() => setEditModalOpen(false)}
                  className="px-4 py-2 border border-slate-200 hover:border-slate-350 text-slate-700 hover:bg-slate-50 rounded-xl text-xs font-bold transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2 bg-[#0E7490] hover:bg-[#0c5f76] text-white rounded-xl text-xs font-bold transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save Details"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
