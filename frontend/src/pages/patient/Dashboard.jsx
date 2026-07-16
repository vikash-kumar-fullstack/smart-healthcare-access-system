import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../../services/api";
import toast from "react-hot-toast";
import {
  Calendar,
  Clock,
  Search,
  MapPin,
  Hospital,
  ArrowRight,
  Sparkles,
  AlertCircle,
  Activity,
  Heart,
  FileText,
  Phone,
  UserCheck,
  Bell,
  CheckCircle2,
  Lock,
  Plus
} from "lucide-react";
import { recordEvent } from "../../utils/experienceMetrics";
import PatientJourneyTracker from "../../components/patient/PatientJourneyTracker";
import Skeleton from "../../components/common/Skeleton";
import EmptyState from "../../components/common/EmptyState";
import Badge from "../../components/common/Badge";
import FamilyDashboard from "../../modules/family/pages/FamilyDashboard";

export default function PatientDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [deferredLoad, setDeferredLoad] = useState(false);
  const [userName, setUserName] = useState("Patient");
  const [activeQueue, setActiveQueue] = useState(null);
  const [timelineLogs, setTimelineLogs] = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const [allHospitals, setAllHospitals] = useState([]);
  const [history, setHistory] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [stats, setStats] = useState({
    activeQueuesCount: 0,
    completedVisits: 0,
    unreadAlerts: 0
  });

  const [searchSymptom, setSearchSymptom] = useState(() => localStorage.getItem("symptom_filter") || "");
  const [searchLocation, setSearchLocation] = useState("");
  const [hoveredStep, setHoveredStep] = useState(null);
  const [favorites, setFavorites] = useState([]);
  const [userId, setUserId] = useState("default");

  useEffect(() => {
    localStorage.setItem("symptom_filter", searchSymptom);
  }, [searchSymptom]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    let activeUserId = "default";
    if (token) {
      const parts = token.split(".");
      if (parts.length === 3) {
        try {
          const decoded = JSON.parse(atob(parts[1]));
          activeUserId = decoded.userId || decoded.id || "default";
        } catch (e) {
          console.error(e);
        }
      }
    } else {
      const cachedUser = JSON.parse(localStorage.getItem("user") || "{}");
      if (cachedUser._id || cachedUser.id) {
        activeUserId = cachedUser._id || cachedUser.id;
      }
    }
    setUserId(activeUserId);
    const localKey = `medhospi_favs_${activeUserId}`;
    setFavorites(JSON.parse(localStorage.getItem(localKey) || "[]"));
  }, []);

  const toggleFavorite = (hospitalId, e) => {
    e.stopPropagation();
    e.preventDefault();
    if (!hospitalId) return;
    const localKey = `medhospi_favs_${userId}`;
    let updated;
    if (favorites.includes(hospitalId)) {
      updated = favorites.filter(id => id !== hospitalId);
      toast.success("Removed from saved hospitals.");
    } else {
      updated = [...favorites, hospitalId];
      toast.success("Added to saved hospitals!");
    }
    localStorage.setItem(localKey, JSON.stringify(updated));
    setFavorites(updated);
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const userStr = localStorage.getItem("user");
      if (userStr) {
        try {
          const userObj = JSON.parse(userStr);
          if (userObj && userObj.name) {
            setUserName(userObj.name);
          }
        } catch (e) {
          console.error(e);
        }
      } else {
        const token = localStorage.getItem("token");
        if (token) {
          const parts = token.split(".");
          if (parts.length === 3) {
            const decoded = JSON.parse(atob(parts[1]));
            setUserName(decoded.name || "Patient");
          }
        }
      }

      const [queueRes, hospitalsRes, visitsRes, notificationsRes] = await Promise.all([
        api.get("/queue/my").catch(() => null),
        api.get("/hospitals").catch(() => ({ data: { data: [] } })),
        api.get("/visits").catch(() => ({ data: { data: [] } })),
        api.get("/notifications").catch(() => ({ data: { data: [] } }))
      ]);

      if (queueRes?.data?.success && queueRes.data.data) {
        setActiveQueue(queueRes.data.data);
      } else {
        setActiveQueue(null);
      }

      if (hospitalsRes?.data?.success) {
        const payload = hospitalsRes.data.data;
        // API returns {total, page, limit, data: [...hospitals]}
        const hospitalsArray = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.data)
            ? payload.data
            : [];
        setAllHospitals(hospitalsArray);
        setHospitals(hospitalsArray.slice(0, 3));
      }

      const visitsArray = visitsRes?.data?.data
        ? (Array.isArray(visitsRes.data.data) ? visitsRes.data.data : (visitsRes.data.data.visits || []))
        : [];
      if (visitsRes?.data?.success) {
        setHistory(visitsArray.slice(0, 5));
      }

      const notificationsArray = notificationsRes?.data?.data
        ? (Array.isArray(notificationsRes.data.data) ? notificationsRes.data.data : (notificationsRes.data.data.notifications || []))
        : [];
      if (notificationsRes?.data?.success) {
        setNotifications(notificationsArray.slice(0, 5));
      }

      setStats({
        activeQueuesCount: (queueRes?.data?.success && queueRes.data.data) ? 1 : 0,
        completedVisits: visitsArray.filter(v => v.status === "completed").length,
        unreadAlerts: notificationsArray.filter(n => n.status !== "read" && !n.isRead).length
      });

      recordEvent("patient_dashboard_loaded");
    } catch (err) {
      console.error("Error loading patient dashboard details:", err);
      toast.error("Failed to load dashboard statistics");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (activeQueue?._id) {
      api.get(`/queue/timeline/${activeQueue._id}`)
        .then(res => {
          if (res.data.success) {
            setTimelineLogs(res.data.data);
          }
        })
        .catch(console.error);
    } else {
      setTimelineLogs([]);
    }
  }, [activeQueue?._id]);

  // Performance Deferred lazy load hook
  useEffect(() => {
    const timer = setTimeout(() => {
      setDeferredLoad(true);
    }, 450);
    return () => clearTimeout(timer);
  }, []);

  const handleSelfCheckIn = async () => {
    if (!activeQueue) return;
    const t = toast.loading("Verifying clinic proximity...");
    try {
      await api.post("/queue/checkin", {
        bookingSearch: activeQueue.bookingNumber,
        hospitalId: activeQueue.hospitalId?._id || activeQueue.hospitalId,
        method: "app"
      });
      toast.success("Self check-in completed! Added to ready queue.", { id: t });
      loadData();
    } catch (err) {
      toast.error(err.response?.data?.message || "Check-in failed. Outside opening buffer or grace window.", { id: t });
    }
  };

  const handleBookHospital = async (hospitalId, docId) => {
    const loadingToast = toast.loading("Booking queue token...");
    try {
      let targetDoctorId = docId;
      if (!targetDoctorId) {
        const docsRes = await api.get("/doctors").catch(() => null);
        if (docsRes?.data?.success) {
          const affiliated = docsRes.data.data.find(d => d.hospitalId?._id === hospitalId || d.hospitalId === hospitalId);
          if (affiliated) {
            targetDoctorId = affiliated.id || affiliated._id;
          }
        }
      }

      if (!targetDoctorId) {
        toast.error("No active practitioners available at this clinic today", { id: loadingToast });
        return;
      }

      await api.post("/queue/book", { doctorId: targetDoctorId });
      toast.success("Joined virtual queue successfully!", { id: loadingToast });
      loadData();
      navigate("/patient/queue");
    } catch (err) {
      toast.error(err.response?.data?.message || "Booking failed. Clinic schedule closed.", { id: loadingToast });
    }
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const querySym = searchSymptom.toLowerCase().trim();
    const queryLoc = searchLocation.toLowerCase().trim();

    if (!querySym && !queryLoc) {
      setHospitals(allHospitals.slice(0, 3));
      return;
    }

    const symptomMap = {
      fever: "general_medicine",
      cough: "general_medicine",
      cold: "general_medicine",
      flu: "general_medicine",
      headache: "neurology",
      migraine: "neurology",
      brain: "neurology",
      stroke: "neurology",
      heart: "cardiology",
      chest: "cardiology",
      cardio: "cardiology",
      skin: "dermatology",
      rash: "dermatology",
      acne: "dermatology",
      bone: "orthopedics",
      joint: "orthopedics",
      fracture: "orthopedics",
      child: "pediatrics",
      kid: "pediatrics",
      pediatric: "pediatrics",
      baby: "pediatrics",
      general: "general_medicine"
    };

    let filtered = allHospitals;

    if (querySym) {
      const matchedSpec = symptomMap[querySym] || querySym;
      filtered = filtered.filter(h => {
        const nameMatch = h.name.toLowerCase().includes(querySym);
        const specsMatch = h.specializations && h.specializations.some(spec =>
          spec.toLowerCase().includes(querySym) || spec.toLowerCase().includes(matchedSpec)
        );
        return nameMatch || specsMatch;
      });
    }

    if (queryLoc) {
      filtered = filtered.filter(h => {
        const addressStr = typeof h.address === "object"
          ? `${h.address.street || ""} ${h.address.city || ""}`.toLowerCase()
          : (h.address || "").toLowerCase();
        const nameMatch = h.name.toLowerCase().includes(queryLoc);
        return addressStr.includes(queryLoc) || nameMatch;
      });
    }

    setHospitals(filtered);

    if (filtered.length === 0) {
      toast.error("No matching partnered clinics found.");
    } else {
      toast.success(`Found ${filtered.length} matching clinics directly!`);
    }
  };

  // Determine current context-aware patient state
  // State options: NO_BOOKING, BOOKING_ACTIVE, IN_QUEUE, POST_CONSULTATION
  const getPatientState = () => {
    if (!activeQueue) {
      const hasRecentVisits = history && history.length > 0;
      if (hasRecentVisits) {
        return "POST_CONSULTATION";
      }
      return "NO_BOOKING";
    }
    if (activeQueue.arrivalStatus === "CHECKED_IN" || activeQueue.arrivalStatus === "ACTIVE") {
      return "IN_QUEUE";
    }
    return "BOOKING_ACTIVE";
  };

  const patientState = getPatientState();

  // Get active step index for the 10-stage tracker
  const getActiveJourneyStep = () => {
    if (patientState === "NO_BOOKING") return 0;
    if (patientState === "POST_CONSULTATION") {
      const lastVisit = history[0];
      if (lastVisit?.prescriptionFile) return 8; // Reports
      return 7; // Prescription
    }

    if (activeQueue) {
      const status = activeQueue.status;
      const arrival = activeQueue.arrivalStatus;

      if (status === "COMPLETED") return 8; // Reports
      if (status === "IN_CONSULTATION" || arrival === "ACTIVE") return 6; // Consultation
      if (arrival === "CHECKED_IN") return 5; // Queue
      if (status === "READY" || arrival === "CHECK_IN_OPEN") return 4; // Check-in
      if (status === "REMINDER_SENT") return 2; // Reminder Sent
      if (status === "CONFIRMED") return 1; // Confirmed
      if (status === "BOOKED") return 0; // Booked
    }
    return 3; // Default Travel to Hospital
  };

  const activeJourneyStep = getActiveJourneyStep();

  // Categorize and sort notifications for the Priority Notification Center
  const getPriorityAlerts = () => {
    return notifications.map(n => {
      const text = (n.title || n.message || "").toLowerCase();
      let priority = "info"; // Default
      let badgeColor = "info";

      if (text.includes("consultation") || text.includes("immediately") || text.includes("now") || text.includes("10 min")) {
        priority = "critical";
        badgeColor = "danger";
      } else if (text.includes("prescription") || text.includes("report") || text.includes("lab") || text.includes("ready")) {
        priority = "important";
        badgeColor = "warning";
      }

      return { ...n, priority, badgeColor };
    }).sort((a, b) => {
      const weight = { critical: 3, important: 2, info: 1 };
      return weight[b.priority] - weight[a.weight];
    });
  };

  const priorityAlerts = getPriorityAlerts();

  if (loading) {
    return (
      <div className="p-12 space-y-10 text-left">
        {/* Greeting Skeleton */}
        <div className="space-y-3">
          <Skeleton className="h-10 w-64 rounded-xl" />
          <Skeleton className="h-5 w-48 rounded-lg" />
        </div>

        {/* Journey Tracker Skeleton */}
        <Skeleton className="h-44 w-full rounded-[20px]" />

        {/* Appointment Skeleton */}
        <Skeleton className="h-56 w-full rounded-[20px]" />

        {/* Grid widgets */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Skeleton className="h-28 rounded-[20px]" />
          <Skeleton className="h-28 rounded-[20px]" />
          <Skeleton className="h-28 rounded-[20px]" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-12 space-y-10 text-left max-w-7xl mx-auto animate-fade-in-up">
      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in-up {
          animation: fadeInUp 0.75s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .hover-card-trigger {
          transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .hover-card-trigger:hover {
          transform: translateY(-5px);
          box-shadow: 0 20px 40px -15px rgba(15, 76, 129, 0.08);
        }
        .boarding-pass-glow {
          box-shadow: 0 12px 40px -12px rgba(15, 76, 129, 0.4);
        }
        .glass-pill-container {
          background: rgba(255, 255, 255, 0.08);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.12);
        }
      `}</style>

      {/* SECTION 1: PERSONALIZED GREETING */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-linear-to-r from-slate-50 via-white to-white p-6 rounded-3xl border border-slate-100 shadow-xs">
        <div>
          <h2 className="text-4xl md:text-[42px] font-black text-slate-900 tracking-tight leading-none">
            Good Morning, {userName.split(" ")[0]} 👋
          </h2>
          <p className="text-sm md:text-base font-bold text-slate-500 mt-2.5">
            Today is {new Date().toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' })} • PATIENT PORTAL
          </p>
        </div>

        {/* Live system state badge */}
        <div className="flex items-center gap-3 bg-white p-2 rounded-2xl border border-slate-100 shadow-2xs">
          <Badge label="LIVE ACCESS" variant="success" />
          <span className="text-xs font-bold text-slate-400">Sync: 1m ago</span>
        </div>
      </div>

      {/* SECTION 2: TODAY'S APPOINTMENT CARD (BOARDING PASS TICKET AESTHETIC) */}
      {activeQueue ? (
        <div className="bg-linear-to-br from-[#0e7490] via-[#0F4C81] to-[#1e1b4b] text-white p-8 rounded-[28px] boarding-pass-glow relative overflow-hidden flex flex-col justify-between min-h-60 transition-all duration-500 hover:scale-[1.005]">
          <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none transform translate-x-12 -translate-y-12 animate-pulse duration-4000" />
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-teal-500/5 rounded-full blur-3xl pointer-events-none transform -translate-x-12 translate-y-12" />

          <div className="relative z-10 space-y-6">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-white/10 pb-6">
              <div className="space-y-2">
                <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-cyan-400/20 text-cyan-200 border border-cyan-300/20">
                  <Sparkles className="h-3 w-3 animate-pulse" />
                  Active Clinic Reservation
                </span>
                <h3 className="text-3xl font-extrabold text-white leading-tight tracking-tight mt-1">
                  {activeQueue.hospitalId?.name || "Partner Clinic"}
                </h3>
                <p className="text-sm font-semibold text-cyan-100/90 flex items-center gap-2">
                  Dr. {activeQueue.doctorId?.name} • {activeQueue.doctorId?.specialization}
                </p>
              </div>

              {/* Dotted divider for boarding pass look */}
              <div className="hidden md:block h-20 border-r border-dashed border-white/20 mx-4" />

              {/* Check-in QR ticket container */}
              <div className="p-2.5 bg-white rounded-2xl shrink-0 flex flex-col items-center gap-1 shadow-md hover:scale-105 transition-transform duration-300 select-none">
                <img
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=100x100&data=${encodeURIComponent(activeQueue.bookingNumber)}`}
                  alt="Check-in QR"
                  className="w-24 h-24 object-contain rounded-lg"
                />
                <span className="text-[8px] font-black text-slate-500 uppercase tracking-wider">Scan at Desk</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              <div className="glass-pill-container rounded-2xl p-4">
                <span className="text-[10px] text-cyan-200 uppercase font-black tracking-wider block">Arrival Status</span>
                <span className="inline-block mt-2 px-3 py-1 rounded-full text-xs font-black uppercase bg-emerald-500 text-white shadow-2xs">
                  {activeQueue.arrivalStatus?.replace("_", " ") || "Pending"}
                </span>
              </div>

              <div className="glass-pill-container rounded-2xl p-4">
                <span className="text-[10px] text-cyan-200 uppercase font-black tracking-wider block">
                  {activeQueue.arrivalStatus === "CHECKED_IN" ? "Queue Number" : "Booking Reference"}
                </span>
                <span className="text-base font-extrabold text-white block mt-2.5 font-mono leading-none tracking-wide">
                  {activeQueue.arrivalStatus === "CHECKED_IN" ? `#${activeQueue.queueNumber || "N/A"}` : activeQueue.bookingNumber}
                </span>
              </div>

              <div className="glass-pill-container rounded-2xl p-4">
                <span className="text-[10px] text-cyan-200 uppercase font-black tracking-wider block">Queue Status / Estimated Session</span>
                <span className="text-base font-extrabold text-white block mt-2.5 leading-tight">
                  {activeQueue.arrivalStatus === "CHECKED_IN" ? "Checked-in • Ready at Counter" : `Expected Time: ${activeQueue.slotTime || "09:30 AM"}`}
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* Module 12: Guidance empty state personalized block */
        <div className="bg-linear-to-br from-cyan-500/5 via-white to-white border border-cyan-500/10 p-8 rounded-3xl shadow-xs flex flex-col md:flex-row items-center justify-between gap-6 hover-card-trigger">
          <div className="space-y-2">
            <h3 className="text-2xl font-black text-slate-800 tracking-tight">No Active Appointments Today</h3>
            <p className="text-sm font-semibold text-slate-500">
              Need medical care? Discover local partnered clinics or reserve your next virtual queue token now.
            </p>
          </div>
          <button
            onClick={() => navigate("/patient/search")}
            className="bg-linear-to-r from-[#0E7490] to-[#14B8A6] hover:from-[#0c5f76] hover:to-[#0f8b7d] text-white font-extrabold text-sm px-7 py-4 rounded-2xl shadow-md shadow-cyan-900/10 transition-all duration-300 hover:scale-103 shrink-0 cursor-pointer border-none"
          >
            Find Partner Clinics
          </button>
        </div>
      )}

      {/* SECTION 3: TODAY'S HEALTHCARE JOURNEY TRACKER */}
      {(patientState === "BOOKING_ACTIVE" || patientState === "IN_QUEUE" || patientState === "POST_CONSULTATION") && (
        <PatientJourneyTracker activeStep={activeJourneyStep} />
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

        {/* LEFT COLUMN: 8 COLS */}
        <div className="lg:col-span-8 space-y-6">

          {/* SECTION 4: PRIORITY NOTIFICATION CENTER (MODULE 11) */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200/60 shadow-sm text-left space-y-4 hover-card-trigger">
            <h4 className="text-lg md:text-xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
              <Bell className="h-5.5 w-5.5 text-[#0F4C81]" />
              Priority Alerts Center
            </h4>

            <div className="space-y-3">
              {priorityAlerts.length > 0 ? (
                priorityAlerts.map((n) => (
                  <div key={n._id} className="p-3.5 rounded-xl border border-slate-100 bg-slate-50/50 flex items-start justify-between gap-4 transition-colors hover:bg-slate-50">
                    <div className="flex gap-3">
                      <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${n.priority === "critical" ? "bg-rose-500 animate-pulse" : n.priority === "important" ? "bg-amber-500" : "bg-emerald-500"
                        }`} />
                      <div>
                        <p className="text-sm font-extrabold text-slate-800 leading-snug">{n.title || n.message}</p>
                        <p className="text-xs font-semibold text-slate-400 mt-1">
                          {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>
                    </div>
                    <Badge
                      label={n.priority.toUpperCase()}
                      variant={n.badgeColor}
                    />
                  </div>
                ))
              ) : (
                <EmptyState
                  variant="empty"
                  title="No Alerts Active"
                  description="Dynamic clinical notifications and check-in gate alerts will update here in real time."
                />
              )}
            </div>
          </div>

          {/* SECTION 5: QUICK ACTIONS DOCK */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200/60 shadow-sm hover-card-trigger">
            <h4 className="text-lg md:text-xl font-extrabold text-slate-800 tracking-tight mb-4">Patient Action Shortcuts</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-5">
              <button
                onClick={() => navigate("/patient/search")}
                className="p-6 rounded-[20px] border border-slate-200/60 bg-slate-50/50 hover:bg-[#0F4C81]/5 hover:border-[#0F4C81]/20 transition-all text-left flex flex-col gap-4 group cursor-pointer hover:-translate-y-1"
              >
                <div className="w-12 h-12 bg-white rounded-xl border border-slate-100 flex items-center justify-center group-hover:scale-115 transition-all duration-300">
                  <Hospital className="h-6 w-6 text-[#0F4C81]" />
                </div>
                <span className="text-sm font-extrabold text-slate-750">Book Appointment</span>
              </button>

              <button
                onClick={() => navigate("/patient/queue")}
                className="p-6 rounded-[20px] border border-slate-200/60 bg-slate-50/50 hover:bg-[#0F4C81]/5 hover:border-[#0F4C81]/20 transition-all text-left flex flex-col gap-4 group cursor-pointer hover:-translate-y-1"
              >
                <div className="w-12 h-12 bg-white rounded-xl border border-slate-100 flex items-center justify-center group-hover:scale-115 transition-all duration-300">
                  <Clock className="h-6 w-6 text-[#14B8A6]" />
                </div>
                <span className="text-sm font-extrabold text-slate-750">Live Wait Queue</span>
              </button>

              <button
                onClick={() => navigate("/patient/history")}
                className="p-6 rounded-[20px] border border-slate-200/60 bg-slate-50/50 hover:bg-[#0F4C81]/5 hover:border-[#0F4C81]/20 transition-all text-left flex flex-col gap-4 group cursor-pointer hover:-translate-y-1"
              >
                <div className="w-12 h-12 bg-white rounded-xl border border-slate-100 flex items-center justify-center group-hover:scale-115 transition-all duration-300">
                  <FileText className="h-6 w-6 text-slate-500" />
                </div>
                <span className="text-sm font-extrabold text-slate-750">Medical Passport</span>
              </button>
            </div>
          </div>

          {/* SECTION 6: HEALTH SNAPSHOT */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <div className="bg-white p-6 rounded-3xl border border-slate-200/50 shadow-sm text-left flex items-center gap-4 hover-card-trigger">
              <div className="w-12 h-12 rounded-xl bg-cyan-50 text-[#0F4C81] flex items-center justify-center shrink-0">
                <Calendar className="h-6 w-6" />
              </div>
              <div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Reserved Tickets</span>
                <h4 className="text-2xl font-black text-slate-800 mt-0.5">{stats.activeQueuesCount}</h4>
              </div>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-200/50 shadow-sm text-left flex items-center gap-4 hover-card-trigger">
              <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <CheckCircle2 className="h-6 w-6" />
              </div>
              <div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Completed Visits</span>
                <h4 className="text-2xl font-black text-slate-800 mt-0.5">{stats.completedVisits}</h4>
              </div>
            </div>

            <div className="bg-white p-6 rounded-3xl border border-slate-200/50 shadow-sm text-left flex items-center gap-4 hover-card-trigger">
              <div className="w-12 h-12 rounded-xl bg-rose-50 text-rose-500 flex items-center justify-center shrink-0">
                <Bell className="h-6 w-6" />
              </div>
              <div>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Pending Alert logs</span>
                <h4 className="text-2xl font-black text-slate-800 mt-0.5">{stats.unreadAlerts}</h4>
              </div>
            </div>
          </div>

          <FamilyDashboard />

          {/* DEFERRED/PERFORMANCE LAZY LOAD ELEMENTS */}
          {deferredLoad && (
            <>
              {/* SECTION 7: ACTIVE MEDICATION DIARY (MODULE 12) */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200/60 shadow-sm text-left space-y-4 hover-card-trigger">
                <h4 className="text-lg md:text-xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
                  <Activity className="h-5.5 w-5.5 text-[#14B8A6]" />
                  Active Medications Passport
                </h4>
                {history.some(v => v.prescriptionFile) ? (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                      <div className="text-[10px] font-black text-slate-450 uppercase">Morning dosage</div>
                      <p className="text-sm font-extrabold text-slate-800 mt-1 flex items-center gap-1.5">
                        <CheckCircle2 className="h-4.5 w-4.5 text-emerald-500" />
                        Tab Paracetamol 650mg
                      </p>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                      <div className="text-[10px] font-black text-slate-450 uppercase">Afternoon dosage</div>
                      <p className="text-sm font-extrabold text-[#0E7490] mt-1 flex items-center gap-1.5">
                        <Clock className="h-4.5 w-4.5" />
                        Upcoming at 13:00
                      </p>
                    </div>
                    <div className="p-4 rounded-xl bg-slate-50 border border-slate-100">
                      <div className="text-[10px] font-black text-slate-450 uppercase">Night dosage</div>
                      <p className="text-sm font-extrabold text-slate-500 mt-1">None scheduled</p>
                    </div>
                  </div>
                ) : (
                  <EmptyState
                    variant="empty"
                    title="No Active Medications"
                    description="No medications currently mapped on your profile. Prescriptions will show here after upload."
                  />
                )}
              </div>

              {/* SECTION 8: RECENT HISTORY TIMELINE */}
              <div className="bg-white p-6 rounded-3xl border border-slate-200/60 shadow-sm text-left space-y-5 hover-card-trigger">
                <h4 className="text-lg md:text-xl font-extrabold text-slate-800 tracking-tight">Recent Clinical Activity Timeline</h4>
                <div className="relative border-l-2 border-slate-100 ml-4 pl-6 space-y-6">
                  {history.length > 0 ? (
                    history.map((v) => (
                      <div key={v._id} className="relative">
                        <span className="absolute -left-7.75 top-0 w-4 h-4 rounded-full bg-[#14B8A6] border-2 border-white shadow-xs" />
                        <div className="space-y-1">
                          <span className="text-[10px] text-slate-400 font-bold uppercase">
                            {new Date(v.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                          <h5 className="text-sm font-extrabold text-slate-800">
                            Consulted Dr. {v.doctorId?.userId?.name || "Clinical Practitioner"}
                          </h5>
                          <p className="text-xs font-semibold text-slate-500">
                            {v.doctorId?.hospitalId?.name || "Medical Center"} • {v.doctorId?.specialization || "General Medicine"}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <EmptyState
                      variant="empty"
                      title="No Medical Activity Logs"
                      description="Your diagnostic activity and consultation visits reports will list here."
                    />
                  )}
                </div>
              </div>

              {/* SECTION 9: NEARBY PARTNER HOSPITALS */}
              <div className="flex flex-col gap-4 text-left">
                <div className="flex items-center justify-between">
                  <h4 className="text-lg md:text-xl font-extrabold text-slate-800 tracking-tight">Partnered Medical Centers</h4>
                  <Link to="/patient/search?tab=clinics" className="text-xs font-extrabold text-[#0E7490] hover:underline flex items-center gap-1">
                    View All Clinics <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {hospitals.length > 0 ? (
                    hospitals.map((hosp) => (
                      <div
                        key={hosp._id}
                        className="bg-white rounded-3xl p-5 border border-slate-200/50 shadow-xs hover-card-trigger flex flex-col justify-between text-left relative overflow-hidden group"
                      >
                        <div className="absolute top-0 left-0 right-0 h-1 bg-transparent hover:bg-linear-to-r from-[#0F4C81] to-[#14B8A6] transition-all" />
                        <div className="absolute top-3.5 right-3.5 z-10">
                          <button
                            onClick={(e) => toggleFavorite(hosp._id, e)}
                            className={`p-1.5 rounded-lg border transition-all cursor-pointer ${favorites.includes(hosp._id)
                                ? "bg-rose-50 border-rose-200 text-rose-600"
                                : "bg-slate-50 border-slate-200 text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                              }`}
                            title="Save Hospital"
                          >
                            <Heart className={`h-3.5 w-3.5 ${favorites.includes(hosp._id) ? "fill-current" : ""}`} />
                          </button>
                        </div>
                        <div>
                          <div className="w-10 h-10 rounded-xl bg-cyan-50 text-[#0F4C81] flex items-center justify-center mb-3">
                            <Hospital className="h-5 w-5" />
                          </div>
                          <h5 className="text-sm font-extrabold text-slate-800 leading-tight line-clamp-1 pr-6">{hosp.name}</h5>
                          <p className="text-xs font-bold text-slate-400 mt-1.5 flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5 text-slate-450" />
                            {hosp.address?.city || hosp.city || "Nearby"}
                          </p>
                        </div>

                        <div className="mt-4 pt-3.5 border-t border-slate-100 flex items-center justify-between">
                          <span className="text-[10px] font-bold text-slate-450">Wait status: online</span>
                          <button
                            onClick={() => navigate(`/patient/book?hospitalId=${hosp._id}`)}
                            className="px-4 py-2 rounded-xl bg-linear-to-r from-[#14B8A6]/10 to-[#14B8A6]/5 hover:from-[#14B8A6] hover:to-[#0f8b7d] text-[#14B8A6] hover:text-white font-extrabold text-xs transition-all duration-300 cursor-pointer border-none"
                          >
                            BOOK
                          </button>
                        </div>
                      </div>
                    ))
                  ) : (
                    <EmptyState
                      variant="empty"
                      title="No Medical Centers"
                      description="No partnered hospitals or clinic counters are currently loaded."
                    />
                  )}
                </div>
              </div>
            </>
          )}

        </div>

        {/* RIGHT COLUMN: 4 COLS (EMERGENCY & INSIGHTS) */}
        <div className="lg:col-span-4 space-y-6">

          {/* SECTION 10: EMERGENCY STATIC CONTACT (NEVER HIDDEN) */}
          <div className="bg-rose-500/5 border border-rose-500/10 p-6 rounded-3xl text-left space-y-4 hover-card-trigger">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center shrink-0">
                <Phone className="h-5.5 w-5.5 animate-bounce" />
              </div>
              <div>
                <h4 className="text-base font-extrabold text-rose-800 tracking-tight leading-none">Emergency Hotline</h4>
                <p className="text-xs text-rose-500 mt-1">24/7 Priority Ambulance</p>
              </div>
            </div>
            <div className="p-3 bg-rose-500 text-white text-center font-mono font-black text-xl rounded-xl shadow-xs">
              CALL: 102
            </div>
            <button
              onClick={() => toast.error("Dialing hospital desk...")}
              className="w-full bg-white hover:bg-slate-50 border border-rose-200 text-rose-700 font-extrabold text-xs py-2.5 rounded-lg transition shrink-0 cursor-pointer"
            >
              Contact Local Ward Desk
            </button>
          </div>

          {/* SECTION 11: HEALTH INSIGHTS DATA */}
          {deferredLoad && (
            <div className="bg-white p-6 rounded-3xl border border-slate-200/60 shadow-sm text-left space-y-4 hover-card-trigger">
              <h4 className="text-lg md:text-xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
                <Heart className="h-5.5 w-5.5 text-rose-500" />
                Personal Vitals
              </h4>
              <div className="grid grid-cols-1 gap-4 text-sm">
                <div className="flex justify-between items-center bg-linear-to-r from-slate-50 to-white hover:from-cyan-50/20 hover:to-white p-4 rounded-xl border border-slate-100 hover:border-cyan-100/50 transition-all duration-300 shadow-2xs">
                  <span className="text-slate-500 font-bold flex items-center gap-2">
                    <Activity className="h-4.5 w-4.5 text-[#0F4C81]" />
                    Blood Pressure
                  </span>
                  <div className="text-right">
                    <span className="font-extrabold text-slate-700 block">120/80 mmHg</span>
                    <span className="text-[10px] text-emerald-600 font-bold block">Stable Range</span>
                  </div>
                </div>
                <div className="flex justify-between items-center bg-linear-to-r from-slate-50 to-white hover:from-cyan-50/20 hover:to-white p-4 rounded-xl border border-slate-100 hover:border-cyan-100/50 transition-all duration-300 shadow-2xs">
                  <span className="text-slate-500 font-bold flex items-center gap-2">
                    <Sparkles className="h-4.5 w-4.5 text-[#14B8A6]" />
                    Body Mass Index
                  </span>
                  <div className="text-right">
                    <span className="font-extrabold text-[#0E7490] block">22.4</span>
                    <span className="text-[10px] text-emerald-600 font-bold block">Healthy (Normal)</span>
                  </div>
                </div>
                <div className="flex justify-between items-center bg-linear-to-r from-slate-50 to-white hover:from-cyan-50/20 hover:to-white p-4 rounded-xl border border-slate-100 hover:border-cyan-100/50 transition-all duration-300 shadow-2xs">
                  <span className="text-slate-500 font-bold flex items-center gap-2">
                    <Heart className="h-4.5 w-4.5 text-rose-500" />
                    Last Weight
                  </span>
                  <div className="text-right">
                    <span className="font-extrabold text-slate-700 block">68 Kg</span>
                    <span className="text-[10px] text-slate-450 font-bold block">No change</span>
                  </div>
                </div>
              </div>
            </div>
          )}

        </div>

      </div>

    </div>
  );
}
