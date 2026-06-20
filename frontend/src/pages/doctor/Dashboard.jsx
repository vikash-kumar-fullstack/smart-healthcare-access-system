import { useEffect, useState } from "react";
import api from "../../services/api";
import toast from "react-hot-toast";

// ─── Session state config ────────────────────────────────────────────────────
const SESSION_CONFIG = {
  inactive: {
    label: "Session Inactive",
    color: "bg-gray-100 text-gray-600 border-gray-200",
    dot: "bg-gray-400",
    badge: "Not Started"
  },
  active: {
    label: "Session Active",
    color: "bg-green-50 text-green-700 border-green-200",
    dot: "bg-green-500",
    badge: "Live"
  },
  paused: {
    label: "Session Paused",
    color: "bg-yellow-50 text-yellow-700 border-yellow-200",
    dot: "bg-yellow-500",
    badge: "On Break"
  },
  closed: {
    label: "Session Closed",
    color: "bg-red-50 text-red-700 border-red-200",
    dot: "bg-red-500",
    badge: "Closed"
  }
};

// ─── Status badge for individual patient cards ──────────────────────────────
const StatusBadge = ({ status }) => {
  const map = {
    waiting:     "bg-amber-50 text-amber-700 border border-amber-200",
    in_progress: "bg-blue-50 text-blue-700 border border-blue-200",
    completed:   "bg-green-50 text-green-700 border border-green-200",
    skipped:     "bg-gray-50 text-gray-500 border border-gray-200",
    no_show:     "bg-red-50 text-red-700 border border-red-200",
    cancelled:   "bg-red-50 text-red-600 border border-red-200"
  };
  const labels = {
    waiting:     "Waiting",
    in_progress: "In Progress",
    completed:   "Completed",
    skipped:     "Skipped",
    no_show:     "No Show",
    cancelled:   "Cancelled"
  };
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-semibold ${map[status] || "bg-gray-50 text-gray-500 border"}`}>
      {labels[status] || status}
    </span>
  );
};

export default function DoctorDashboard() {
  const [profile, setProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState("");

  const [sessionStatus, setSessionStatus] = useState("inactive");
  const [stats, setStats] = useState({
    waiting: 0,
    completed: 0,
    skipped: 0,
    noShow: 0,
    remaining: 0,
    avgConsultationTime: 5,
    completionRate: 100
  });
  const [currentPatient, setCurrentPatient] = useState(null);
  const [upcomingPatients, setUpcomingPatients] = useState([]);
  const [historyPatients, setHistoryPatients] = useState([]);
  const [queueLoading, setQueueLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const [sessionStartedAt, setSessionStartedAt] = useState(null);
  const [activeDurationMs, setActiveDurationMs] = useState(0);
  const [sessionDuration, setSessionDuration] = useState("00:00:00");

  // Form State
  const [form, setForm] = useState({
    avgConsultationTime: 5,
    experienceYears: 0
  });

  const [settingsForm, setSettingsForm] = useState({
    availabilityState: "available",
    sessionPolicy: "continue",
    temporaryNoticeMessage: "",
    temporaryNoticeExpectedUntil: "",
    defaultQueueLimit: 50,
    avgConsultationTime: 5,
    schedules: [],
    overrides: []
  });

  const [clinicalModalOpen, setClinicalModalOpen] = useState(false);
  const [editingVisitId, setEditingVisitId] = useState(null);
  const [clinicalForm, setClinicalForm] = useState({
    chiefComplaint: "",
    doctorNotes: "",
    consultationSummary: "",
    followUpAdvice: "",
    visitOutcome: "consulted"
  });

  const activeVisitId = editingVisitId || currentPatient?.visitId;

  useEffect(() => {
    if (!clinicalModalOpen || !activeVisitId) return;

    const timer = setTimeout(() => {
      localStorage.setItem(`visitDraft_${activeVisitId}`, JSON.stringify(clinicalForm));
    }, 2000);

    return () => clearTimeout(timer);
  }, [clinicalForm, clinicalModalOpen, activeVisitId]);



  // ── Fetch doctor profile ────────────────────────────────────────────────────
  const fetchProfile = async (silent = false) => {
    try {
      if (!silent) setProfileLoading(true);
      const res = await api.get("/doctors/profile");
      const doc = res.data.data.doctor;
      setProfile(doc);
      setProfileError("");
      if (doc) {
        setForm({
          avgConsultationTime: doc.avgConsultationTime || 5,
          experienceYears: doc.experienceYears || 0
        });

        // Initialize schedules for 7 days
        const initialSchedules = [];
        for (let i = 0; i < 7; i++) {
          const existingSch = doc.schedules?.find(s => s.dayOfWeek === i);
          initialSchedules.push({
            dayOfWeek: i,
            startTime: existingSch ? existingSch.startTime : "09:00",
            endTime: existingSch ? existingSch.endTime : "18:00",
            enabled: existingSch ? existingSch.enabled : false
          });
        }

        setSettingsForm({
          availabilityState: doc.availabilityState || "available",
          sessionPolicy: "continue",
          temporaryNoticeMessage: doc.temporaryNotice?.message || "",
          temporaryNoticeExpectedUntil: doc.temporaryNotice?.expectedUntil 
            ? new Date(doc.temporaryNotice.expectedUntil).toISOString().slice(0, 16) 
            : "",
          defaultQueueLimit: doc.defaultQueueLimit || 50,
          avgConsultationTime: doc.avgConsultationTime || 5,
          schedules: initialSchedules,
          overrides: doc.overrides || []
        });
      }
    } catch (err) {
      console.error(err);
      setProfileError(err.response?.data?.message || "Doctor profile not found.");
    } finally {
      if (!silent) setProfileLoading(false);
    }
  };

  const handleScheduleChange = (idx, field, value) => {
    setSettingsForm(prev => {
      const updated = [...prev.schedules];
      updated[idx] = { ...updated[idx], [field]: value };
      return { ...prev, schedules: updated };
    });
  };

  const handleAddOverride = () => {
    setSettingsForm(prev => ({
      ...prev,
      overrides: [
        ...prev.overrides,
        {
          date: new Date().toLocaleDateString("en-CA"),
          startTime: "09:00",
          endTime: "18:00",
          enabled: true,
          isFullDay: false
        }
      ]
    }));
  };

  const handleRemoveOverride = (idx) => {
    setSettingsForm(prev => ({
      ...prev,
      overrides: prev.overrides.filter((_, i) => i !== idx)
    }));
  };

  const handleOverrideChange = (idx, field, value) => {
    setSettingsForm(prev => {
      const updated = [...prev.overrides];
      updated[idx] = { ...updated[idx], [field]: value };
      return { ...prev, overrides: updated };
    });
  };

  const handleSaveSettings = async (e) => {
    e.preventDefault();
    const t = toast.loading("Saving settings...");
    try {
      const payload = {
        availabilityState: settingsForm.availabilityState,
        defaultQueueLimit: parseInt(settingsForm.defaultQueueLimit),
        avgConsultationTime: parseInt(settingsForm.avgConsultationTime),
        temporaryNotice: {
          message: settingsForm.temporaryNoticeMessage,
          expectedUntil: settingsForm.temporaryNoticeExpectedUntil || null
        },
        schedules: settingsForm.schedules,
        overrides: settingsForm.overrides,
        sessionPolicy: settingsForm.sessionPolicy,
        version: profile.__v
      };

      await api.patch("/doctors/profile/settings", payload);
      toast.success("Settings updated successfully!", { id: t });
      await fetchProfile(true);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update settings", { id: t });
    }
  };

  // ── Fetch queue + session state ────────────────────────────────────────────
  const fetchQueue = async () => {
    try {
      const res = await api.get("/queue/doctor");
      const data = res.data.data;
      setSessionStatus(data.sessionState || "inactive");
      setStats(data.stats || {
        waiting: 0,
        completed: 0,
        skipped: 0,
        noShow: 0,
        remaining: 0,
        avgConsultationTime: 5,
        completionRate: 100
      });
      setCurrentPatient(data.currentPatient || null);
      setUpcomingPatients(data.upcomingPatients || []);
      setHistoryPatients(data.history || []);
      setSessionStartedAt(data.sessionStartedAt || null);
      setActiveDurationMs(data.activeDurationMs || 0);
    } catch (err) {
      console.error(err);
    } finally {
      setQueueLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  useEffect(() => {
    if (profile && profile.profileCompleted && profile.status === "active") {
      fetchQueue();
      const interval = setInterval(fetchQueue, 15000);
      return () => clearInterval(interval);
    }
  }, [profile]);

  // ── Session Duration Ticker (Pause-Aware) ──────────────────────────────────
  useEffect(() => {
    if (!sessionStartedAt || sessionStatus === "inactive" || sessionStatus === "closed") {
      setSessionDuration("00:00:00");
      return;
    }

    let currentDurationMs = activeDurationMs;

    const formatDuration = (totalMs) => {
      const diffSecs = Math.max(0, Math.floor(totalMs / 1000));
      const hours = Math.floor(diffSecs / 3600);
      const minutes = Math.floor((diffSecs % 3600) / 60);
      const seconds = diffSecs % 60;
      return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
    };

    setSessionDuration(formatDuration(currentDurationMs));

    if (sessionStatus === "paused") {
      return; // Freeze timer while paused
    }

    const interval = setInterval(() => {
      currentDurationMs += 1000;
      setSessionDuration(formatDuration(currentDurationMs));
    }, 1000);

    return () => clearInterval(interval);
  }, [sessionStartedAt, sessionStatus, activeDurationMs]);

  useEffect(() => {
    if (!currentPatient || !currentPatient.startedAt) {
      setElapsedSeconds(0);
      return;
    }

    const startedTime = new Date(currentPatient.startedAt).getTime();
    setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startedTime) / 1000)));

    const interval = setInterval(() => {
      const seconds = Math.floor((Date.now() - startedTime) / 1000);
      setElapsedSeconds(seconds >= 0 ? seconds : 0);
    }, 1000);

    return () => clearInterval(interval);
  }, [currentPatient]);

  const formatMMSS = (totalSeconds) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  // ── Form input helper ──────────────────────────────────────────────────────
  const handleFormChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value
    });
  };

  // ── Submit profile completion ──────────────────────────────────────────────
  const handleProfileComplete = async (e) => {
    e.preventDefault();
    const t = toast.loading("Saving profile details...");
    try {
      await api.post("/doctors/profile/complete", form);
      toast.success("Profile submitted successfully. Pending activation.", { id: t });
      await fetchProfile();
    } catch (err) {
      toast.error(err.response?.data?.message || "Submission failed", { id: t });
    }
  };

  // ── Session action helper ──────────────────────────────────────────────────
  const sessionAction = async (endpoint, successMsg) => {
    setActionLoading(true);
    const t = toast.loading("Please wait...");
    try {
      await api.patch(endpoint);
      toast.success(successMsg, { id: t });
      await fetchQueue();
    } catch (err) {
      toast.error(err.response?.data?.message || "Action failed", { id: t });
    } finally {
      setActionLoading(false);
    }
  };

  // ── Patient action helper ──────────────────────────────────────────────────
  const patientAction = async (endpoint, body, successMsg) => {
    const t = toast.loading("Processing...");
    try {
      await api.patch(endpoint, body);
      toast.success(successMsg, { id: t });
      await fetchQueue();
    } catch (err) {
      toast.error(err.response?.data?.message || "Action failed", { id: t });
    }
  };

  // ── Visit action handlers ──────────────────────────────────────────────────
  const handleStartConsultation = async (visitId) => {
    setActionLoading(true);
    const t = toast.loading("Starting consultation...");
    try {
      await api.patch(`/visits/${visitId}/start`);
      toast.success("Consultation started!", { id: t });
      await fetchQueue();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to start consultation", { id: t });
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenCompleteConsultation = () => {
    const activeVisitId = currentPatient?.visitId;
    if (!activeVisitId) return;

    const savedDraft = localStorage.getItem(`visitDraft_${activeVisitId}`);
    if (savedDraft) {
      try {
        setClinicalForm(JSON.parse(savedDraft));
        toast.success("Restored unsaved draft notes.");
      } catch (e) {
        console.error("Failed to parse draft", e);
        setClinicalForm({
          chiefComplaint: "",
          doctorNotes: "",
          consultationSummary: "",
          followUpAdvice: "",
          visitOutcome: "consulted"
        });
      }
    } else {
      setClinicalForm({
        chiefComplaint: "",
        doctorNotes: "",
        consultationSummary: "",
        followUpAdvice: "",
        visitOutcome: "consulted"
      });
    }
    setEditingVisitId(null);
    setClinicalModalOpen(true);
  };

  const handleOpenEditEMR = async (visitId) => {
    const t = toast.loading("Loading EMR details...");
    try {
      const [visitRes, summaryRes] = await Promise.all([
        api.get(`/visits/${visitId}`),
        api.get(`/visits/${visitId}/summary`)
      ]);
      const visit = visitRes.data.data.visit;
      const summary = summaryRes.data.data.summary;
      
      const savedDraft = localStorage.getItem(`visitDraft_${visitId}`);
      if (savedDraft) {
        try {
          setClinicalForm(JSON.parse(savedDraft));
          toast.success("Restored unsaved draft edits.");
        } catch (e) {
          console.error("Failed to parse draft", e);
          setClinicalForm({
            chiefComplaint: summary?.chiefComplaint || "",
            doctorNotes: summary?.doctorNotes || "",
            consultationSummary: summary?.consultationSummary || "",
            followUpAdvice: summary?.followUpAdvice || "",
            visitOutcome: visit?.visitOutcome || "consulted"
          });
        }
      } else {
        setClinicalForm({
          chiefComplaint: summary?.chiefComplaint || "",
          doctorNotes: summary?.doctorNotes || "",
          consultationSummary: summary?.consultationSummary || "",
          followUpAdvice: summary?.followUpAdvice || "",
          visitOutcome: visit?.visitOutcome || "consulted"
        });
      }
      setEditingVisitId(visitId);
      setClinicalModalOpen(true);
      toast.dismiss(t);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load EMR details", { id: t });
    }
  };

  const handleSubmitClinicalForm = async (e) => {
    e.preventDefault();
    if (!clinicalForm.chiefComplaint || !clinicalForm.doctorNotes || !clinicalForm.consultationSummary) {
      toast.error("Please fill in all required fields.");
      return;
    }

    const t = toast.loading("Saving EMR summary...");
    try {
      if (editingVisitId) {
        await api.patch(`/visits/${editingVisitId}/summary`, {
          chiefComplaint: clinicalForm.chiefComplaint,
          doctorNotes: clinicalForm.doctorNotes,
          consultationSummary: clinicalForm.consultationSummary,
          followUpAdvice: clinicalForm.followUpAdvice
        });
        localStorage.removeItem(`visitDraft_${editingVisitId}`);
        toast.success("EMR Summary updated successfully!", { id: t });
      } else {
        await api.patch(`/visits/${currentPatient.visitId}/complete`, clinicalForm);
        localStorage.removeItem(`visitDraft_${currentPatient.visitId}`);
        toast.success("Consultation completed and EMR Summary created!", { id: t });
      }
      setClinicalModalOpen(false);
      setEditingVisitId(null);
      setClinicalForm({
        chiefComplaint: "",
        doctorNotes: "",
        consultationSummary: "",
        followUpAdvice: "",
        visitOutcome: "consulted"
      });
      await fetchQueue();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save clinical details", { id: t });
    }
  };


  const cfg             = SESSION_CONFIG[sessionStatus] || SESSION_CONFIG.inactive;

  // 1. Loader screen (prevents layout flashing)
  if (profileLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Verifying profile status...</p>
        </div>
      </div>
    );
  }

  // 2. Profile Stub Missing Error Screen (Admin hasn't created stub yet)
  if (profileError) {
    return (
      <div className="max-w-md mx-auto my-16 px-4">
        <div className="bg-white rounded-2xl shadow-sm border border-red-100 p-8 text-center">
          <div className="text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Account Incomplete</h2>
          <p className="text-gray-600 text-sm mb-6 leading-relaxed">
            {profileError}
          </p>
          <div className="text-xs text-gray-400 bg-gray-50 rounded-lg p-3 border border-gray-100">
            Hint: Doctor profile stubs must be provisioned by a hospital administrator before activation.
          </div>
        </div>
      </div>
    );
  }

  // 3. Incomplete Profile Form (profileCompleted === false)
  if (profile && !profile.profileCompleted) {
    return (
      <div className="max-w-xl mx-auto my-10 px-4">
        <form onSubmit={handleProfileComplete} className="bg-white rounded-2xl shadow p-6 space-y-6 border border-gray-100">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Complete Professional Profile</h1>
            <p className="text-gray-500 text-xs mt-1">Please confirm your hospital assignment and provide average consultation details.</p>
          </div>

          <div className="space-y-4">
            {/* Doctor Name (Read-Only) */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Full Name</label>
              <input
                type="text"
                disabled
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 bg-gray-50 text-gray-600 cursor-not-allowed font-medium text-sm"
                value={profile.name}
              />
            </div>

            {/* Hospital (Read-Only) */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Assigned Hospital</label>
              <input
                type="text"
                disabled
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 bg-gray-50 text-gray-600 cursor-not-allowed font-medium text-sm"
                value={profile.hospitalId?.name || "N/A"}
              />
            </div>

            {/* Specialization (Read-Only) */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Specialization</label>
              <input
                type="text"
                disabled
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 bg-gray-50 text-gray-600 cursor-not-allowed font-medium text-sm"
                value={profile.specialization}
              />
            </div>

            {/* Average Consultation Time (Editable) */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Average Consultation Time (Minutes)</label>
              <input
                type="number"
                name="avgConsultationTime"
                min="1"
                max="60"
                required
                className="w-full border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:outline-none rounded-lg px-4 py-2.5 text-sm"
                value={form.avgConsultationTime}
                onChange={handleFormChange}
              />
            </div>

            {/* Experience (Editable) */}
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Years of Experience</label>
              <input
                type="number"
                name="experienceYears"
                min="0"
                max="50"
                required
                className="w-full border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:outline-none rounded-lg px-4 py-2.5 text-sm"
                value={form.experienceYears}
                onChange={handleFormChange}
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full bg-blue-500 hover:bg-blue-600 text-white transition py-3 rounded-lg font-medium text-sm shadow-md active:scale-[0.98]"
          >
            Complete Profile Submission
          </button>
        </form>
      </div>
    );
  }

  // 4. Pending Activation Screen (profileCompleted === true, status === "pending_activation")
  if (profile && profile.status === "pending_activation") {
    return (
      <div className="max-w-lg mx-auto my-12 px-4">
        <div className="bg-white rounded-2xl shadow-sm border border-yellow-100 p-8 text-center space-y-6">
          <div className="text-5xl animate-bounce">⏳</div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-gray-800">Profile Verification In Progress</h2>
            <p className="text-gray-500 text-sm leading-relaxed">
              Your professional details have been recorded. Our clinical review administrators are validating your details and credentials.
            </p>
          </div>

          <div className="border-t border-gray-100 pt-5 text-left space-y-2 text-xs text-gray-500">
            <p><strong>Hospital Assignment:</strong> {profile.hospitalId?.name}</p>
            <p><strong>Specialization:</strong> {profile.specialization}</p>
            <p><strong>Experience Recorded:</strong> {profile.experienceYears} Years</p>
            <p><strong>Avg. Consultation:</strong> {profile.avgConsultationTime} mins</p>
          </div>

          <div className="bg-yellow-50 text-yellow-800 rounded-xl px-4 py-3 text-xs border border-yellow-100">
            ℹ️ You will gain access to patient queues and active boards once your profile is verified and marked active by the administrator.
          </div>
        </div>
      </div>
    );
  }

  // 5. Inactive or Suspended Notice (status !== "active")
  if (profile && profile.status !== "active") {
    return (
      <div className="max-w-md mx-auto my-16 px-4">
        <div className="bg-white rounded-2xl shadow-sm border border-red-100 p-8 text-center space-y-4">
          <div className="text-5xl">🛑</div>
          <h2 className="text-xl font-bold text-gray-800">Account Restricted</h2>
          <p className="text-gray-600 text-sm leading-relaxed">
            Your doctor status is currently <strong>{profile.status}</strong>. Your clinical rights have been paused or suspended.
          </p>
          <p className="text-xs text-gray-400">
            Please contact your hospital panel or admin staff to restore active access.
          </p>
        </div>
      </div>
    );
  }

  // 6. Active Dashboard View (status === "active")
  if (queueLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto mb-3" />
          <p className="text-gray-500 text-sm">Loading queue metrics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="flex flex-col md:flex-row justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Doctor Dashboard</h1>
          <p className="text-gray-500 mt-1">Dr. {profile.name} · {profile.specialization} · {profile.hospitalId?.name}</p>
        </div>

        {/* Session Status Badge */}
        <div className={`flex items-center gap-2 px-4 py-2 rounded-xl border text-sm font-medium self-start ${cfg.color}`}>
          <span className={`w-2.5 h-2.5 rounded-full animate-pulse ${cfg.dot}`} />
          {cfg.label}
          <span className="ml-1 text-xs opacity-75">· {cfg.badge}</span>
        </div>
      </div>

      {/* ── Session Control Panel ───────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-sm border p-5">
        <h2 className="text-base font-semibold text-gray-700 mb-4">Session Controls</h2>

        <div className="flex flex-wrap gap-3">

          {/* START — only when inactive */}
          {sessionStatus === "inactive" && (
            <button
              onClick={() => sessionAction("/queue/start-session", "Session started! First patient notified.")}
              disabled={actionLoading}
              className="flex items-center gap-2 bg-green-500 hover:bg-green-600 disabled:opacity-50 transition text-white px-5 py-2.5 rounded-lg font-medium shadow-sm"
            >
              <span>▶</span> Start Session
            </button>
          )}

          {/* PAUSE — only when active */}
          {sessionStatus === "active" && (
            <button
              onClick={() => sessionAction("/queue/pause-session", "Session paused. Patients notified.")}
              disabled={actionLoading}
              className="flex items-center gap-2 bg-yellow-500 hover:bg-yellow-600 disabled:opacity-50 transition text-white px-5 py-2.5 rounded-lg font-medium shadow-sm"
            >
              <span>⏸</span> Pause Session
            </button>
          )}

          {/* RESUME — only when paused */}
          {sessionStatus === "paused" && (
            <button
              onClick={() => sessionAction("/queue/resume-session", "Session resumed! Continuing queue.")}
              disabled={actionLoading}
              className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 transition text-white px-5 py-2.5 rounded-lg font-medium shadow-sm"
            >
              <span>▶</span> Resume Session
            </button>
          )}

          {/* CLOSE — when active or paused */}
          {(sessionStatus === "active" || sessionStatus === "paused") && (
            <button
              onClick={() => {
                if (window.confirm("Are you sure you want to close the session? Remaining waiting patients will be cancelled.")) {
                  sessionAction("/queue/close-session", "Session closed for today.");
                }
              }}
              disabled={actionLoading}
              className="flex items-center gap-2 bg-red-500 hover:bg-red-600 disabled:opacity-50 transition text-white px-5 py-2.5 rounded-lg font-medium shadow-sm"
            >
              <span>■</span> Close Session
            </button>
          )}

          {/* CLOSED state info */}
          {sessionStatus === "closed" && (
            <div className="flex items-center gap-2 text-gray-500 text-sm bg-gray-50 px-4 py-2.5 rounded-lg border border-gray-200">
              ✅ Today's session is closed. New bookings are blocked.
            </div>
          )}

        </div>

        {/* Break hint */}
        {sessionStatus === "paused" && (
          <p className="mt-3 text-sm text-yellow-700 bg-yellow-50 border border-yellow-200 rounded-lg px-4 py-2">
            ⏸ Session is paused — patients have been notified of the break. Click <strong>Resume</strong> when ready.
          </p>
        )}
      </div>

      {/* ── Analytics Preview ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 my-4">
        {/* Session Duration */}
        <div className="bg-gradient-to-br from-indigo-500 to-blue-600 rounded-xl p-4 text-white shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-indigo-100">Session Duration</div>
            <div className="text-2xl font-bold mt-1">{sessionDuration}</div>
          </div>
          <span className="text-3xl bg-white/20 p-2 rounded-lg">⏱️</span>
        </div>

        {/* Patients Seen Today */}
        <div className="bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl p-4 text-white shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-emerald-100">Patients Seen Today</div>
            <div className="text-2xl font-bold mt-1">{stats.completed}</div>
          </div>
          <span className="text-3xl bg-white/20 p-2 rounded-lg">👥</span>
        </div>

        {/* Avg Consultation Time */}
        <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl p-4 text-white shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-amber-100">Avg Consultation</div>
            <div className="text-2xl font-bold mt-1">{stats.avgConsultationTime} mins</div>
          </div>
          <span className="text-3xl bg-white/20 p-2 rounded-lg">📅</span>
        </div>

        {/* Completion Rate */}
        <div className="bg-gradient-to-br from-rose-500 to-pink-600 rounded-xl p-4 text-white shadow-sm flex items-center justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-rose-100">Completion Rate</div>
            <div className="text-2xl font-bold mt-1">{stats.completionRate}%</div>
          </div>
          <span className="text-3xl bg-white/20 p-2 rounded-lg">📈</span>
        </div>
      </div>

      {/* ── Queue Stats ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {[
          { label: "Waiting",      value: stats.waiting,      icon: "⏳", color: "text-amber-600" },
          { label: "Completed",    value: stats.completed,    icon: "✅", color: "text-green-600" },
          { label: "Skipped",      value: stats.skipped,      icon: "⏭", color: "text-gray-500" },
          { label: "No Show",      value: stats.noShow,       icon: "⚠️", color: "text-red-500" },
          { label: "Remaining",    value: stats.remaining,    icon: "📋", color: "text-blue-600" }
        ].map(stat => (
          <div key={stat.label} className="bg-white rounded-xl border shadow-sm p-4 text-center flex flex-col justify-between">
            <div className="text-2xl mb-1">{stat.icon}</div>
            <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
            <div className="text-xs text-gray-500 mt-1 font-medium">{stat.label}</div>
          </div>
        ))}
      </div>

      {/* ── Current Patient ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-sm border p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          🩺 Current Patient
          {currentPatient && (
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
              In Progress
            </span>
          )}
        </h2>

        {currentPatient ? (
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6 w-full">
            <div className="space-y-2 w-full md:w-auto">
              <p className="text-xl font-bold text-gray-800 flex items-center gap-2">
                👤 {currentPatient.name}
                {currentPatient.isPriority && (
                  <span className="bg-amber-100 text-amber-850 text-xs px-2.5 py-0.5 rounded-full font-bold border border-amber-200 shadow-sm flex items-center gap-0.5 animate-pulse">
                    ⭐ Priority
                  </span>
                )}
              </p>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm bg-gray-50 p-4 rounded-xl border border-gray-100">
                <div>
                  <span className="block text-[10px] text-gray-400 font-bold uppercase tracking-wider">Queue No</span>
                  <span className="font-bold text-gray-700 text-lg">#{currentPatient.queueNumber}</span>
                </div>
                <div>
                  <span className="block text-[10px] text-gray-400 font-bold uppercase tracking-wider">Elapsed</span>
                  <span className="font-mono font-bold text-blue-600 text-lg">{formatMMSS(elapsedSeconds)}</span>
                </div>
                <div>
                  <span className="block text-[10px] text-gray-400 font-bold uppercase tracking-wider">Remaining ETA</span>
                  {(() => {
                    const avgConsTime = profile?.avgConsultationTime || 5;
                    const avgSec = avgConsTime * 60;
                    const remSec = Math.max(0, avgSec - elapsedSeconds);
                    return (
                      <span className={`font-mono font-bold text-lg ${remSec === 0 ? "text-red-500 animate-pulse font-extrabold" : "text-green-600"}`}>
                        {formatMMSS(remSec)}
                      </span>
                    );
                  })()}
                </div>
                <div>
                  <span className="block text-[10px] text-gray-400 font-bold uppercase tracking-wider">Avg Consultation</span>
                  <span className="font-bold text-gray-700 text-lg">{profile?.avgConsultationTime || 5} mins</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2.5 self-center">
              {currentPatient.visitId && (currentPatient.visitStatus === "waiting" || currentPatient.visitStatus === "scheduled") ? (
                <button
                  onClick={() => handleStartConsultation(currentPatient.visitId)}
                  className="bg-blue-600 hover:bg-blue-700 active:scale-95 transition text-white px-5 py-3 rounded-xl font-semibold text-sm shadow-md flex items-center gap-1.5 animate-pulse"
                >
                  <span>🩺</span> Start Consultation
                </button>
              ) : (
                <button
                  onClick={handleOpenCompleteConsultation}
                  className="bg-green-600 hover:bg-green-700 active:scale-95 transition text-white px-5 py-3 rounded-xl font-semibold text-sm shadow-md flex items-center gap-1.5"
                >
                  <span>✅</span> Complete Consultation
                </button>
              )}
              <button
                onClick={() => patientAction("/queue/skip", { queueId: currentPatient._id }, "Patient skipped.")}
                className="bg-amber-500 hover:bg-amber-600 active:scale-95 transition text-white px-5 py-3 rounded-xl font-semibold text-sm shadow-md flex items-center gap-1.5"
              >
                <span>⏭</span> Skip
              </button>
              <button
                onClick={() => {
                  if (window.confirm("Mark this patient as a No Show? The queue will auto-advance.")) {
                    patientAction("/queue/no-show", { queueId: currentPatient._id }, "Patient marked as no-show.");
                  }
                }}
                className="bg-red-500 hover:bg-red-600 active:scale-95 transition text-white px-5 py-3 rounded-xl font-semibold text-sm shadow-md flex items-center gap-1.5"
              >
                <span>⚠️</span> No Show
              </button>
            </div>
          </div>
        ) : (
          <p className="text-gray-400 text-sm">
            {sessionStatus === "inactive"
              ? "Start your session to begin seeing patients."
              : sessionStatus === "paused"
              ? "Session is paused. Resume to call the next patient."
              : sessionStatus === "closed"
              ? "Session closed for today."
              : "No patient in progress right now."}
          </p>
        )}
      </div>

      {/* ── Upcoming Queue ───────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-sm border p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          📋 Upcoming Queue
          {upcomingPatients.length > 0 && (
            <span className="ml-2 text-sm bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-0.5 rounded-full font-semibold">
              {upcomingPatients.length} waiting
            </span>
          )}
        </h2>

        {upcomingPatients.length === 0 ? (
          <p className="text-gray-400 text-sm">No patients waiting.</p>
        ) : (
          <div className="space-y-3">
            {upcomingPatients.map((patient, idx) => {
              const diffMins = Math.floor((Date.now() - new Date(patient.createdAt).getTime()) / 60000);
              const waitStr = diffMins < 1 ? "Just now" : `${diffMins} min${diffMins > 1 ? "s" : ""} ago`;

              return (
                <div
                  key={patient._id}
                  className="flex items-center justify-between border border-gray-100 rounded-xl px-4 py-3 bg-gray-50 hover:bg-gray-100 transition shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-sm font-bold shadow-inner">
                      {idx + 1}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-semibold text-gray-800 text-sm">{patient.name}</p>
                        {patient.isPriority && (
                          <span className="bg-amber-100 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full text-[10px] font-bold shadow-sm animate-pulse flex items-center gap-0.5">
                            ⭐ Priority Credit
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-400">Queue #{patient.queueNumber} · Waiting: <span className="font-medium text-gray-600">{waitStr}</span></p>
                    </div>
                  </div>
                  <StatusBadge status={patient.status} />
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Session History ────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-sm border p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          🕒 Session History
          {historyPatients.length > 0 && (
            <span className="ml-2 text-sm bg-gray-100 text-gray-600 px-2.5 py-0.5 rounded-full font-semibold">
              {historyPatients.length} processed
            </span>
          )}
        </h2>

        {historyPatients.length === 0 ? (
          <p className="text-gray-400 text-sm">No history recorded for today's session.</p>
        ) : (
          <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
            {historyPatients.map((patient) => {
              const completedTimeStr = patient.completedAt
                ? new Date(patient.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : new Date(patient.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

              return (
                <div
                  key={patient._id}
                  className="flex items-center justify-between border border-gray-100 rounded-xl px-4 py-2.5 bg-gray-50/50 hover:bg-gray-50 transition"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-gray-400" />
                    <div>
                      <p className="font-medium text-gray-800 text-sm">{patient.name}</p>
                      <p className="text-xs text-gray-400">
                        Queue #{patient.queueNumber} · Time: <span className="font-medium text-gray-500">{completedTimeStr}</span>
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <StatusBadge status={patient.status} />
                    {patient.visitId && patient.status === "completed" && (
                      <button
                        onClick={() => handleOpenEditEMR(patient.visitId)}
                        className="text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 font-semibold px-2.5 py-1 rounded-lg border border-blue-200 transition active:scale-95 flex items-center gap-1"
                      >
                        <span>📝</span> View/Edit EMR
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Settings & Schedules Panel ────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-sm border p-6 space-y-6">
        <div className="border-b pb-4">
          <h2 className="text-xl font-bold text-gray-800">⚙️ Doctor & Queue Settings</h2>
          <p className="text-gray-500 text-xs mt-1">Configure your live status, shift schedules, overrides, and capacity limits.</p>
        </div>

        <form onSubmit={handleSaveSettings} className="space-y-6">
          
          {/* Live operational settings */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Live Availability State</label>
              <select
                className="w-full border border-gray-300 rounded-lg p-2.5 text-sm"
                value={settingsForm.availabilityState}
                onChange={(e) => setSettingsForm(prev => ({ ...prev, availabilityState: e.target.value }))}
              >
                <option value="available">🟢 Available (Accepting bookings)</option>
                <option value="break">⏸️ On Break (Temporary notice shown)</option>
                <option value="unavailable">🔴 Unavailable (Offline / Out of office)</option>
              </select>
            </div>

            {settingsForm.availabilityState === "unavailable" && (
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Unavailable Session Policy</label>
                <select
                  className="w-full border border-gray-300 rounded-lg p-2.5 text-sm"
                  value={settingsForm.sessionPolicy}
                  onChange={(e) => setSettingsForm(prev => ({ ...prev, sessionPolicy: e.target.value }))}
                >
                  <option value="continue">Keep current session active (continue treating current queue)</option>
                  <option value="stop_bookings">Stop new bookings only (mark session as closing)</option>
                  <option value="close_session">Close today's session immediately (cancels waiting patients)</option>
                </select>
              </div>
            )}
          </div>

          {/* Temporary notice inputs */}
          {settingsForm.availabilityState === "break" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-4 bg-yellow-50 rounded-xl border border-yellow-100">
              <div>
                <label className="block text-xs font-bold text-yellow-850 uppercase mb-2">Temporary Notice Message</label>
                <input
                  type="text"
                  placeholder="e.g. Away for lunch, back in 20 mins"
                  className="w-full border border-gray-300 rounded-lg p-2.5 text-sm"
                  value={settingsForm.temporaryNoticeMessage}
                  onChange={(e) => setSettingsForm(prev => ({ ...prev, temporaryNoticeMessage: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-yellow-850 uppercase mb-2">Expected Return Time</label>
                <input
                  type="datetime-local"
                  className="w-full border border-gray-300 rounded-lg p-2.5 text-sm"
                  value={settingsForm.temporaryNoticeExpectedUntil}
                  onChange={(e) => setSettingsForm(prev => ({ ...prev, temporaryNoticeExpectedUntil: e.target.value }))}
                />
              </div>
            </div>
          )}

          {/* Capacities */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Default Queue Capacity Limit</label>
              <input
                type="number"
                min="1"
                max="200"
                className="w-full border border-gray-300 rounded-lg p-2.5 text-sm"
                value={settingsForm.defaultQueueLimit}
                onChange={(e) => setSettingsForm(prev => ({ ...prev, defaultQueueLimit: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Average Consultation Time (Minutes)</label>
              <input
                type="number"
                min="1"
                max="90"
                className="w-full border border-gray-300 rounded-lg p-2.5 text-sm"
                value={settingsForm.avgConsultationTime}
                onChange={(e) => setSettingsForm(prev => ({ ...prev, avgConsultationTime: e.target.value }))}
              />
            </div>
          </div>

          {/* Weekday Schedule */}
          <div>
            <h3 className="text-sm font-bold text-gray-700 mb-3">🕒 Weekly Operating Hours</h3>
            <div className="space-y-3">
              {settingsForm.schedules.map((sch, idx) => (
                <div key={sch.dayOfWeek} className="flex flex-wrap items-center justify-between gap-4 p-3 bg-gray-50 rounded-xl border">
                  <div className="flex items-center gap-3 w-32">
                    <input
                      type="checkbox"
                      id={`sch-chk-${sch.dayOfWeek}`}
                      checked={sch.enabled}
                      onChange={(e) => handleScheduleChange(idx, "enabled", e.target.checked)}
                      className="rounded text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor={`sch-chk-${sch.dayOfWeek}`} className="text-sm font-semibold text-gray-700">
                      {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][sch.dayOfWeek]}
                    </label>
                  </div>
                  {sch.enabled && (
                    <div className="flex items-center gap-3">
                      <input
                        type="text"
                        placeholder="HH:MM"
                        className="border rounded px-2.5 py-1 text-sm w-20 text-center font-mono"
                        value={sch.startTime}
                        onChange={(e) => handleScheduleChange(idx, "startTime", e.target.value)}
                      />
                      <span className="text-gray-400 text-xs">to</span>
                      <input
                        type="text"
                        placeholder="HH:MM"
                        className="border rounded px-2.5 py-1 text-sm w-20 text-center font-mono"
                        value={sch.endTime}
                        onChange={(e) => handleScheduleChange(idx, "endTime", e.target.value)}
                      />
                    </div>
                  )}
                  {!sch.enabled && (
                    <span className="text-xs text-gray-400 font-medium italic">Off-duty</span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Schedule Overrides */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold text-gray-700">📅 Schedule Overrides & Holidays</h3>
              <button
                type="button"
                onClick={handleAddOverride}
                className="text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 font-semibold px-3 py-1.5 rounded-lg border border-blue-200 transition"
              >
                + Add Override
              </button>
            </div>
            {settingsForm.overrides.length === 0 ? (
              <p className="text-xs text-gray-400 italic bg-gray-50 p-4 rounded-xl border text-center">No overrides configured.</p>
            ) : (
              <div className="space-y-3">
                {settingsForm.overrides.map((ovr, idx) => (
                  <div key={idx} className="flex flex-wrap items-center justify-between gap-4 p-3.5 bg-gray-50 rounded-xl border border-gray-200">
                    <div className="flex flex-wrap items-center gap-3">
                      <input
                        type="date"
                        className="border rounded px-2.5 py-1.5 text-sm font-medium"
                        value={ovr.date}
                        onChange={(e) => handleOverrideChange(idx, "date", e.target.value)}
                      />
                      
                      <label className="flex items-center gap-1.5 text-xs text-gray-600 font-semibold">
                        <input
                          type="checkbox"
                          checked={ovr.enabled}
                          onChange={(e) => handleOverrideChange(idx, "enabled", e.target.checked)}
                          className="rounded text-blue-600"
                        />
                        Working
                      </label>

                      {ovr.enabled && (
                        <label className="flex items-center gap-1.5 text-xs text-gray-600 font-semibold">
                          <input
                            type="checkbox"
                            checked={ovr.isFullDay}
                            onChange={(e) => handleOverrideChange(idx, "isFullDay", e.target.checked)}
                            className="rounded text-blue-600"
                          />
                          Full Day Leave
                        </label>
                      )}
                    </div>

                    {ovr.enabled && !ovr.isFullDay ? (
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          placeholder="HH:MM"
                          className="border rounded px-2 py-1 text-xs w-16 text-center font-mono"
                          value={ovr.startTime}
                          onChange={(e) => handleOverrideChange(idx, "startTime", e.target.value)}
                        />
                        <span className="text-gray-400 text-[10px]">to</span>
                        <input
                          type="text"
                          placeholder="HH:MM"
                          className="border rounded px-2 py-1 text-xs w-16 text-center font-mono"
                          value={ovr.endTime}
                          onChange={(e) => handleOverrideChange(idx, "endTime", e.target.value)}
                        />
                      </div>
                    ) : (
                      <span className="text-xs text-red-500 font-bold bg-red-50 border border-red-100 rounded px-2.5 py-0.5">Holiday/Leave</span>
                    )}

                    <button
                      type="button"
                      onClick={() => handleRemoveOverride(idx)}
                      className="text-xs text-red-500 hover:text-red-700 font-semibold px-2 py-1"
                    >
                      Delete
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="pt-4 border-t flex justify-end">
            <button
              type="submit"
              className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-6 py-3 rounded-xl transition text-sm shadow active:scale-98"
            >
              Save Doctor Settings
            </button>
          </div>

        </form>
      </div>

      {/* ── Clinical Modal (EMR Entry/Edit) ─────────────────────────────────── */}
      {clinicalModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl border shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-250">
            {/* Header */}
            <div className="bg-gray-50 border-b px-6 py-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-800">
                {editingVisitId ? "Edit Medical Summary (EMR)" : "Complete Consultation & Record EMR"}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setClinicalModalOpen(false);
                  setEditingVisitId(null);
                }}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold p-1"
              >
                ✕
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmitClinicalForm} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Chief Complaint *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Chronic headache, high fever"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  value={clinicalForm.chiefComplaint}
                  onChange={(e) => setClinicalForm(prev => ({ ...prev, chiefComplaint: e.target.value }))}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Consultation Summary *</label>
                <textarea
                  required
                  rows="3"
                  placeholder="Diagnosed migraine, advice rest..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  value={clinicalForm.consultationSummary}
                  onChange={(e) => setClinicalForm(prev => ({ ...prev, consultationSummary: e.target.value }))}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Doctor Notes (EMR Sensitive) *</label>
                <textarea
                  required
                  rows="3"
                  placeholder="Clinical observations, vital stats..."
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  value={clinicalForm.doctorNotes}
                  onChange={(e) => setClinicalForm(prev => ({ ...prev, doctorNotes: e.target.value }))}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Follow-up Advice</label>
                <textarea
                  rows="2"
                  placeholder="e.g. Review in 7 days if symptom persists"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none"
                  value={clinicalForm.followUpAdvice}
                  onChange={(e) => setClinicalForm(prev => ({ ...prev, followUpAdvice: e.target.value }))}
                />
              </div>

              {!editingVisitId && (
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Visit Outcome *</label>
                  <select
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:outline-none bg-white"
                    value={clinicalForm.visitOutcome}
                    onChange={(e) => setClinicalForm(prev => ({ ...prev, visitOutcome: e.target.value }))}
                  >
                    <option value="consulted">Consulted (Normal Completion)</option>
                    <option value="follow_up_required">Follow-up Required</option>
                    <option value="referred">Referred to Specialist</option>
                  </select>
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-4 border-t flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setClinicalModalOpen(false);
                    setEditingVisitId(null);
                  }}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50 text-sm font-medium text-gray-600 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-semibold shadow-sm transition active:scale-95"
                >
                  {editingVisitId ? "Save Changes" : "Complete Visit"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}