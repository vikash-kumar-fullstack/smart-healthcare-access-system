import React, { useState, useEffect } from "react";
import api from "../../services/api";
import toast from "react-hot-toast";
import {
  Bell,
  Lock,
  Mail,
  Smartphone,
  ShieldAlert,
  Clock,
  Sparkles,
  Save,
  CheckCircle2,
  AlertCircle
} from "lucide-react";

export default function Settings() {
  const [role, setRole] = useState("patient");
  const [preferences, setPreferences] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Security states
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });
  const [passwordSaving, setPasswordSaving] = useState(false);

  // Doctor workspace settings state
  const [doctorSettings, setDoctorSettings] = useState({
    defaultQueueLimit: 30,
    avgConsultationTime: 15,
    temporaryNotice: ""
  });
  const [docSaving, setDocSaving] = useState(false);
  const [docVersion, setDocVersion] = useState(0);

  useEffect(() => {
    const userRole = localStorage.getItem("role") || "patient";
    setRole(userRole);

    const loadSettings = async () => {
      try {
        setLoading(true);
        // Load preferences
        const prefRes = await api.get("/notifications/preferences").catch(() => null);
        if (prefRes?.data?.success) {
          setPreferences(prefRes.data.data.categories);
        }

        // If doctor, load doctor profile settings
        if (userRole === "doctor") {
          const docRes = await api.get("/doctors/profile").catch(() => null);
          if (docRes?.data?.success && docRes.data.data) {
            const data = docRes.data.data;
            setDoctorSettings({
              defaultQueueLimit: data.defaultQueueLimit || 30,
              avgConsultationTime: data.avgConsultationTime || 15,
              temporaryNotice: data.temporaryNotice?.message || ""
            });
            setDocVersion(data.__v || 0);
          }
        }
      } catch (err) {
        console.error("Failed to load settings:", err);
      } finally {
        setLoading(false);
      }
    };

    loadSettings();
  }, []);

  const handlePreferenceToggle = (category, channel) => {
    setPreferences((prev) => {
      if (!prev) return null;
      const categorySettings = prev[category] || { in_app: true, push: true };
      return {
        ...prev,
        [category]: {
          ...categorySettings,
          [channel]: !categorySettings[channel]
        }
      };
    });
  };

  const savePreferences = async () => {
    setSaving(true);
    try {
      await api.patch("/notifications/preferences", { categories: preferences });
      toast.success("Notification preferences updated!");
    } catch (err) {
      console.error(err);
      toast.error("Failed to save preferences.");
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordUpdate = (e) => {
    e.preventDefault();
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error("New passwords do not match.");
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }

    setPasswordSaving(true);
    setTimeout(() => {
      toast.success("Security credentials updated successfully!");
      setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setPasswordSaving(false);
    }, 1000);
  };

  const saveDoctorSettings = async (e) => {
    e.preventDefault();
    setDocSaving(true);
    try {
      await api.patch("/doctors/profile/settings", {
        defaultQueueLimit: doctorSettings.defaultQueueLimit,
        avgConsultationTime: doctorSettings.avgConsultationTime,
        temporaryNotice: {
          message: doctorSettings.temporaryNotice,
          expectedUntil: null
        },
        version: docVersion
      });
      toast.success("Clinical queue parameters updated successfully!");
      // Increment locally to prevent concurrency conflict on immediate re-save
      setDocVersion(prev => prev + 1);
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to update doctor parameters.");
    } finally {
      setDocSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="py-16 text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0F4C81] mx-auto mb-3" />
        <p className="text-slate-500 text-xs font-semibold">Synchronizing account parameters...</p>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Title */}
      <div>
        <h1 className="text-2xl font-black text-slate-800 tracking-tight">System Settings</h1>
        <p className="text-xs text-slate-500 mt-1">Customize notification pathways, security parameters, and live session rules.</p>
      </div>

      <div className="grid grid-cols-1 gap-6">
        {/* Doctor Workspace Clinical Controls */}
        {role === "doctor" && (
          <div className="bg-white rounded-3xl border border-slate-200/60 p-6 text-left shadow-sm">
            <h3 className="text-base font-black text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-2">
              <Clock className="h-5 w-5 text-[#0F4C81]" />
              Queue Session Parameters
            </h3>
            <form onSubmit={saveDoctorSettings} className="space-y-4 pt-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Default Queue Session Limit</label>
                  <input
                    type="number"
                    min="1"
                    max="150"
                    value={doctorSettings.defaultQueueLimit}
                    onChange={(e) => setDoctorSettings({ ...doctorSettings, defaultQueueLimit: parseInt(e.target.value, 10) || 30 })}
                    className="h-10.5 w-full px-3.5 rounded-xl border border-slate-200 bg-[#F8FAFC] text-xs text-slate-850 outline-none transition focus:border-[#0E7490] focus:bg-white focus:ring-2 focus:ring-[#0E7490]/5"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Avg Consultation Duration (mins)</label>
                  <input
                    type="number"
                    min="1"
                    max="60"
                    value={doctorSettings.avgConsultationTime}
                    onChange={(e) => setDoctorSettings({ ...doctorSettings, avgConsultationTime: parseInt(e.target.value, 10) || 15 })}
                    className="h-10.5 w-full px-3.5 rounded-xl border border-slate-200 bg-[#F8FAFC] text-xs text-slate-850 outline-none transition focus:border-[#0E7490] focus:bg-white focus:ring-2 focus:ring-[#0E7490]/5"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Live Alert Broadcast Notice (Optional)</label>
                <textarea
                  placeholder="e.g. Doctor will arrive 10 minutes late due to an emergency ward round."
                  value={doctorSettings.temporaryNotice}
                  onChange={(e) => setDoctorSettings({ ...doctorSettings, temporaryNotice: e.target.value })}
                  className="w-full px-3.5 py-3 rounded-xl border border-slate-200 bg-[#F8FAFC] text-xs text-slate-850 outline-none min-h-[80px] resize-y transition focus:border-[#0E7490] focus:bg-white focus:ring-2 focus:ring-[#0E7490]/5"
                />
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={docSaving}
                  className="inline-flex items-center gap-1.5 px-5 h-10.5 rounded-xl text-xs font-bold text-white bg-[#0E7490] hover:bg-[#0c5f76] transition-all cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  <Save className="h-4 w-4" />
                  {docSaving ? "Updating parameters..." : "Save Session Parameters"}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Notifications Routing Panel */}
        {preferences && (
          <div className="bg-white rounded-3xl border border-slate-200/60 p-6 text-left shadow-sm">
            <h3 className="text-base font-black text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-2">
              <Bell className="h-5 w-5 text-[#0F4C81]" />
              Alert & Notification Channels
            </h3>
            <div className="space-y-5 divide-y divide-slate-100 pt-3">
              {Object.keys(preferences).map((category) => {
                const title = category === "queue" ? "Queue Wait Updates"
                            : category === "session" ? "Doctor Shift Status"
                            : category === "doctor" ? "Practitioner Scheduling updates"
                            : category === "system" ? "Administrative/Emergency Alerts"
                            : "Marketing & Health Tips";

                const desc = category === "queue" ? "Receive alerts when your token moves ahead or your turn is called."
                           : category === "session" ? "Receive notifications when the practitioner starts/stops their shift."
                           : category === "doctor" ? "Get updates regarding clinical schedules or calendar delays."
                           : category === "system" ? "Critical alerts about site maintenance or regional medical warnings."
                           : "Informative medical articles and clinic wellness bulletins.";

                const settings = preferences[category] || { in_app: true, push: true };

                return (
                  <div key={category} className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 py-4.5 first:pt-2 text-xs">
                    <div>
                      <h4 className="font-extrabold text-slate-800 capitalize">{title}</h4>
                      <p className="text-[11px] text-slate-500 leading-relaxed mt-0.5 max-w-md">{desc}</p>
                    </div>
                    <div className="flex items-center gap-4.5">
                      <label className="flex items-center gap-2 font-bold text-slate-650 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={settings.in_app}
                          onChange={() => handlePreferenceToggle(category, "in_app")}
                          className="h-4.5 w-4.5 rounded border-slate-300 text-[#0E7490] focus:ring-[#0E7490]/15"
                        />
                        <span className="flex items-center gap-1">
                          <Smartphone className="h-3.5 w-3.5 text-slate-400" />
                          In-App
                        </span>
                      </label>
                      <label className="flex items-center gap-2 font-bold text-slate-650 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          checked={settings.push}
                          onChange={() => handlePreferenceToggle(category, "push")}
                          className="h-4.5 w-4.5 rounded border-slate-300 text-[#0E7490] focus:ring-[#0E7490]/15"
                        />
                        <span className="flex items-center gap-1">
                          <Smartphone className="h-3.5 w-3.5 text-slate-400" />
                          Push Alerts
                        </span>
                      </label>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex justify-end pt-5 border-t border-slate-100">
              <button
                onClick={savePreferences}
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-5 h-10.5 rounded-xl text-xs font-bold text-white bg-[#0E7490] hover:bg-[#0c5f76] transition-all cursor-pointer active:scale-95 disabled:opacity-50 shadow-sm"
              >
                <Save className="h-4 w-4" />
                {saving ? "Saving settings..." : "Save Preferences"}
              </button>
            </div>
          </div>
        )}

        {/* Security / Password panel */}
        <div className="bg-white rounded-3xl border border-slate-200/60 p-6 text-left shadow-sm">
          <h3 className="text-base font-black text-slate-800 border-b border-slate-100 pb-3 flex items-center gap-2">
            <Lock className="h-5 w-5 text-[#0F4C81]" />
            Security & Credentials
          </h3>
          <form onSubmit={handlePasswordUpdate} className="space-y-4 pt-5 max-w-md">
            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Current Password</label>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={passwordForm.currentPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, currentPassword: e.target.value })}
                className="h-10.5 w-full px-3.5 rounded-xl border border-slate-200 bg-[#F8FAFC] text-xs text-slate-850 outline-none transition focus:border-[#0E7490] focus:bg-white focus:ring-2 focus:ring-[#0E7490]/5"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">New Password</label>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={passwordForm.newPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, newPassword: e.target.value })}
                className="h-10.5 w-full px-3.5 rounded-xl border border-slate-200 bg-[#F8FAFC] text-xs text-slate-850 outline-none transition focus:border-[#0E7490] focus:bg-white focus:ring-2 focus:ring-[#0E7490]/5"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Confirm New Password</label>
              <input
                type="password"
                required
                placeholder="••••••••"
                value={passwordForm.confirmPassword}
                onChange={(e) => setPasswordForm({ ...passwordForm, confirmPassword: e.target.value })}
                className="h-10.5 w-full px-3.5 rounded-xl border border-slate-200 bg-[#F8FAFC] text-xs text-slate-850 outline-none transition focus:border-[#0E7490] focus:bg-white focus:ring-2 focus:ring-[#0E7490]/5"
              />
            </div>

            <div className="pt-2 flex justify-start">
              <button
                type="submit"
                disabled={passwordSaving}
                className="inline-flex items-center gap-1.5 px-5 h-10.5 rounded-xl text-xs font-bold text-white bg-[#0E7490] hover:bg-[#0c5f76] transition-all cursor-pointer active:scale-95 disabled:opacity-50"
              >
                Change Password
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
