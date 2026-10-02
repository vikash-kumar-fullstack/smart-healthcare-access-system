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
  Users,
  Plus,
  ShieldAlert
} from "lucide-react";
import PatientJourneyTracker from "../../components/patient/PatientJourneyTracker";
import Skeleton from "../../components/common/Skeleton";
import EmptyState from "../../components/common/EmptyState";
import Badge from "../../components/common/Badge";

export default function PatientDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(() => {
    return !localStorage.getItem("user");
  });
  
  // Initialize user name immediately from local storage to prevent layout pop-in
  const [userName, setUserName] = useState(() => {
    try {
      const u = localStorage.getItem("user");
      if (u) {
        const parsed = JSON.parse(u);
        if (parsed?.name) return parsed.name;
      }
    } catch (e) {}
    return "Patient";
  });

  const [activeQueue, setActiveQueue] = useState(null);
  const [hospitals, setHospitals] = useState([]);
  const [recentVisits, setRecentVisits] = useState([]);
  const [unreadAlertsCount, setUnreadAlertsCount] = useState(0);
  const [healthProfile, setHealthProfile] = useState(null);

  const [searchSymptom, setSearchSymptom] = useState("");
  const [favorites, setFavorites] = useState([]);
  const [userId, setUserId] = useState("default");

  const presetSymptoms = [
    { label: "Fever & Cold", icon: "🌡️", query: "fever" },
    { label: "Headache", icon: "🧠", query: "headache" },
    { label: "Stomach Pain", icon: "🤢", query: "stomach pain" },
    { label: "Chest Pain", icon: "❤️", query: "chest pain" },
    { label: "Skin Rash", icon: "🧴", query: "rash" },
    { label: "Bone / Joint", icon: "🦴", query: "joint pain" }
  ];

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

  // Ultra-fast lightweight API fetch for dashboard main view (<50ms)
  const loadData = async () => {
    try {
      const [queueRes, visitsRes, hospitalsRes, unreadRes] = await Promise.all([
        api.get("/queue/my").catch(() => null),
        api.get("/visits?limit=3").catch(() => ({ data: { data: [] } })),
        api.get("/hospitals?limit=3").catch(() => ({ data: { data: [] } })),
        api.get("/notifications/unread").catch(() => null)
      ]);

      if (queueRes?.data?.success && queueRes.data.data) {
        setActiveQueue(queueRes.data.data);
      } else {
        setActiveQueue(null);
      }

      if (hospitalsRes?.data?.success) {
        const payload = hospitalsRes.data.data;
        const hospitalsArray = Array.isArray(payload)
          ? payload
          : Array.isArray(payload?.data)
            ? payload.data
            : [];
        setHospitals(hospitalsArray.slice(0, 3));
      }

      const visitsArray = visitsRes?.data?.data
        ? (Array.isArray(visitsRes.data.data) ? visitsRes.data.data : (visitsRes.data.data.visits || []))
        : [];
      if (visitsRes?.data?.success) {
        // Deduplicate recent visits by doctor + date
        const seen = new Set();
        const cleanVisits = visitsArray.filter(v => {
          const key = `${v.doctorId?.userId?.name || v.doctorId?.name}_${v.createdAt}`;
          if (seen.has(key)) return false;
          seen.add(key);
          return true;
        });
        setRecentVisits(cleanVisits.slice(0, 3));
      }

      if (unreadRes?.data?.success) {
        setUnreadAlertsCount(unreadRes.data.data.unreadCount || 0);
      }
    } catch (err) {
      console.error("Error loading patient dashboard statistics:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const handleSync = () => {
      api.get("/notifications/unread").then(res => {
        if (res?.data?.success) {
          setUnreadAlertsCount(res.data.data.unreadCount || 0);
        }
      }).catch(() => {});
    };
    window.addEventListener("notifications-updated", handleSync);
    return () => window.removeEventListener("notifications-updated", handleSync);
  }, []);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    const query = searchSymptom.trim();
    if (query) {
      navigate(`/patient/search?q=${encodeURIComponent(query)}`);
    } else {
      navigate("/patient/search");
    }
  };

  const getBmiDetails = () => {
    if (!healthProfile?.height || !healthProfile?.weight) {
      return { val: "22.4", status: "Healthy (Normal)", colorClass: "text-emerald-600" };
    }
    const hM = healthProfile.height / 100;
    const val = (healthProfile.weight / (hM * hM)).toFixed(1);
    const num = parseFloat(val);
    let status = "Healthy (Normal)";
    let colorClass = "text-emerald-600";
    if (num < 18.5) {
      status = "Underweight";
      colorClass = "text-amber-600";
    } else if (num >= 25 && num < 30) {
      status = "Overweight";
      colorClass = "text-amber-600";
    } else if (num >= 30) {
      status = "Obese";
      colorClass = "text-rose-600";
    }
    return { val, status, colorClass };
  };

  const bmiDetails = getBmiDetails();

  if (loading) {
    return (
      <div className="p-8 md:p-12 space-y-8 text-left max-w-7xl mx-auto">
        <div className="space-y-3">
          <Skeleton className="h-10 w-64 rounded-xl" />
          <Skeleton className="h-5 w-48 rounded-lg" />
        </div>
        <Skeleton className="h-44 w-full rounded-3xl" />
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Skeleton className="h-32 rounded-3xl" />
          <Skeleton className="h-32 rounded-3xl" />
          <Skeleton className="h-32 rounded-3xl" />
          <Skeleton className="h-32 rounded-3xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 md:p-12 space-y-8 text-left max-w-7xl mx-auto animate-fade-in-up">
      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(16px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in-up {
          animation: fadeInUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .hover-card-trigger {
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .hover-card-trigger:hover {
          transform: translateY(-4px);
          box-shadow: 0 16px 32px -12px rgba(14, 116, 144, 0.1);
        }
        .boarding-pass-glow {
          box-shadow: 0 12px 40px -12px rgba(14, 116, 144, 0.35);
        }
        .glass-pill-container {
          background: rgba(255, 255, 255, 0.08);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.12);
        }
      `}</style>

      {/* SECTION 1: HERO GREETING & SYMPTOM SEARCH BANNER */}
      <div className="bg-gradient-to-br from-[#0E7490] via-[#0F4C81] to-[#0A5F76] text-white p-8 md:p-10 rounded-3xl shadow-lg relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-cyan-400/10 rounded-full blur-3xl pointer-events-none transform translate-x-12 -translate-y-12" />
        <div className="absolute bottom-0 left-0 w-80 h-80 bg-teal-400/10 rounded-full blur-3xl pointer-events-none transform -translate-x-12 translate-y-12" />

        <div className="relative z-10 space-y-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-white/15 text-cyan-200 border border-white/20">
                  Patient Portal
                </span>
                <span className="text-xs font-semibold text-cyan-100/80">
                  {new Date().toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
                </span>
              </div>
              <h2 className="text-3xl md:text-4xl font-black tracking-tight leading-none text-white">
                Welcome back, {userName.split(" ")[0]} 👋
              </h2>
              <p className="text-xs md:text-sm font-semibold text-cyan-100/80 mt-2">
                Find trusted doctors, manage active queue tokens, or view your medical care records.
              </p>
            </div>

            {unreadAlertsCount > 0 && (
              <button
                onClick={() => navigate("/patient/notifications")}
                className="flex items-center gap-2.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white px-4 py-2.5 rounded-2xl text-xs font-bold transition-all cursor-pointer"
              >
                <Bell className="h-4 w-4 text-cyan-300 animate-bounce" />
                <span>{unreadAlertsCount} Unread Alert{unreadAlertsCount === 1 ? "" : "s"}</span>
              </button>
            )}
          </div>

          {/* Instant Symptom Search Bar */}
          <form onSubmit={handleSearchSubmit} className="relative max-w-3xl">
            <div className="relative flex items-center bg-white rounded-2xl p-2 shadow-md border border-slate-100">
              <Search className="h-5 w-5 text-slate-400 ml-3 shrink-0" />
              <input
                type="text"
                value={searchSymptom}
                onChange={(e) => setSearchSymptom(e.target.value)}
                placeholder="Search symptoms (e.g. fever, headache, chest pain) or doctor name..."
                className="w-full pl-3 pr-4 py-2.5 text-sm text-slate-800 placeholder-slate-400 bg-transparent border-none outline-none font-semibold"
              />
              <button
                type="submit"
                className="bg-[#0E7490] hover:bg-[#0A5F76] text-white font-extrabold text-xs px-6 py-3 rounded-xl transition-all shadow-sm shrink-0 cursor-pointer border-none"
              >
                Search
              </button>
            </div>
          </form>

          {/* Preset Symptom Shortcut Pills */}
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="text-xs font-bold text-cyan-100/70 mr-1">Quick Search:</span>
            {presetSymptoms.map((sym) => (
              <button
                key={sym.query}
                onClick={() => navigate(`/patient/search?q=${encodeURIComponent(sym.query)}`)}
                className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/25 border border-white/15 text-white text-xs font-semibold transition-all duration-200 flex items-center gap-1.5 cursor-pointer"
              >
                <span>{sym.icon}</span>
                <span>{sym.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* SECTION 2: ACTIVE RESERVATION TICKET CARD */}
      {activeQueue ? (
        <div className="bg-gradient-to-br from-[#0E7490] via-[#0F4C81] to-[#1e1b4b] text-white p-6 md:p-8 rounded-3xl boarding-pass-glow relative overflow-hidden hover-card-trigger">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-white/10 pb-6">
            <div className="space-y-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-cyan-400/20 text-cyan-200 border border-cyan-300/20">
                <Sparkles className="h-3 w-3 animate-pulse" />
                Active Clinic Token
              </span>
              <h3 className="text-2xl md:text-3xl font-extrabold text-white leading-tight tracking-tight mt-1">
                {activeQueue.hospitalId?.name || "Partnered Clinic"}
              </h3>
              <p className="text-sm font-semibold text-cyan-100/90 flex items-center gap-2">
                Dr. {activeQueue.doctorId?.name} • {activeQueue.doctorId?.specialization}
              </p>
            </div>

            <div className="p-2 bg-white rounded-2xl shrink-0 flex flex-col items-center gap-1 shadow-md">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=90x90&data=${encodeURIComponent(activeQueue.bookingNumber)}`}
                alt="Token QR"
                className="w-20 h-20 object-contain rounded-lg"
              />
              <span className="text-[8px] font-black text-slate-500 uppercase tracking-wider">Scan Token</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-6">
            <div className="glass-pill-container rounded-2xl p-4">
              <span className="text-[10px] text-cyan-200 uppercase font-black tracking-wider block">Arrival Status</span>
              <span className="inline-block mt-2 px-3 py-1 rounded-full text-xs font-black uppercase bg-emerald-500 text-white">
                {activeQueue.arrivalStatus?.replace("_", " ") || "Confirmed"}
              </span>
            </div>

            <div className="glass-pill-container rounded-2xl p-4">
              <span className="text-[10px] text-cyan-200 uppercase font-black tracking-wider block">Queue Number</span>
              <span className="text-base font-extrabold text-white block mt-2 font-mono">
                #{activeQueue.queueNumber || activeQueue.bookingNumber}
              </span>
            </div>

            <div className="glass-pill-container rounded-2xl p-4 flex flex-col justify-between">
              <span className="text-[10px] text-cyan-200 uppercase font-black tracking-wider block">Action</span>
              <button
                onClick={() => navigate("/patient/queue")}
                className="mt-2 text-xs font-bold text-cyan-300 hover:text-white underline text-left cursor-pointer border-none bg-transparent p-0"
              >
                Open Live Queue Tracker →
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-slate-200/80 p-6 md:p-8 rounded-3xl shadow-xs flex flex-col md:flex-row items-center justify-between gap-6 hover-card-trigger">
          <div className="space-y-1 text-left">
            <h3 className="text-xl font-extrabold text-slate-800 tracking-tight">No Active Tokens Today</h3>
            <p className="text-xs font-semibold text-slate-500">
              Need a consultation? Search partnered clinics or reserve your next virtual queue ticket.
            </p>
          </div>
          <button
            onClick={() => navigate("/patient/search")}
            className="bg-gradient-to-r from-[#0E7490] to-[#14B8A6] hover:from-[#0c5f76] hover:to-[#0f8b7d] text-white font-extrabold text-xs px-6 py-3.5 rounded-2xl shadow-sm transition-all hover:scale-102 shrink-0 cursor-pointer border-none"
          >
            Find Clinics & Book
          </button>
        </div>
      )}

      {/* SECTION 3: 4 CORE ACTION PILLARS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-5">
        <button
          onClick={() => navigate("/patient/search")}
          className="p-6 rounded-3xl border border-slate-200/60 bg-white hover:bg-slate-50/80 transition-all text-left flex flex-col justify-between gap-4 group cursor-pointer hover-card-trigger shadow-xs"
        >
          <div className="w-12 h-12 bg-cyan-50 text-[#0E7490] rounded-2xl border border-cyan-100 flex items-center justify-center group-hover:scale-110 transition-transform">
            <Hospital className="h-6 w-6" />
          </div>
          <div>
            <h4 className="text-base font-extrabold text-slate-800 leading-snug">Book Appointment</h4>
            <p className="text-xs text-slate-500 font-semibold mt-1">Search doctors & clinics</p>
          </div>
        </button>

        <button
          onClick={() => navigate("/patient/queue")}
          className="p-6 rounded-3xl border border-slate-200/60 bg-white hover:bg-slate-50/80 transition-all text-left flex flex-col justify-between gap-4 group cursor-pointer hover-card-trigger shadow-xs"
        >
          <div className="w-12 h-12 bg-teal-50 text-[#14B8A6] rounded-2xl border border-teal-100 flex items-center justify-center group-hover:scale-110 transition-transform">
            <Clock className="h-6 w-6" />
          </div>
          <div>
            <h4 className="text-base font-extrabold text-slate-800 leading-snug">Live Queue</h4>
            <p className="text-xs text-slate-500 font-semibold mt-1">Track token ETA & status</p>
          </div>
        </button>

        <button
          onClick={() => navigate("/patient/history")}
          className="p-6 rounded-3xl border border-slate-200/60 bg-white hover:bg-slate-50/80 transition-all text-left flex flex-col justify-between gap-4 group cursor-pointer hover-card-trigger shadow-xs"
        >
          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl border border-indigo-100 flex items-center justify-center group-hover:scale-110 transition-transform">
            <FileText className="h-6 w-6" />
          </div>
          <div>
            <h4 className="text-base font-extrabold text-slate-800 leading-snug">Medical Passport</h4>
            <p className="text-xs text-slate-500 font-semibold mt-1">Visits, lab reports & notes</p>
          </div>
        </button>

        <button
          onClick={() => navigate("/patient/family")}
          className="p-6 rounded-3xl border border-slate-200/60 bg-white hover:bg-slate-50/80 transition-all text-left flex flex-col justify-between gap-4 group cursor-pointer hover-card-trigger shadow-xs"
        >
          <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-2xl border border-purple-100 flex items-center justify-center group-hover:scale-110 transition-transform">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <h4 className="text-base font-extrabold text-slate-800 leading-snug">Family Health</h4>
            <p className="text-xs text-slate-500 font-semibold mt-1">Manage family profiles</p>
          </div>
        </button>
      </div>

      {/* SECTION 4: 2-COLUMN MAIN DASHBOARD BODY */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

        {/* LEFT COLUMN: 8 COLS (RECENT ACTIVITY & CLINICS) */}
        <div className="lg:col-span-8 space-y-6">

          {/* Recent Visits / Clinical Activity */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200/60 shadow-xs space-y-4 hover-card-trigger">
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
                <Activity className="h-5 w-5 text-[#0E7490]" />
                Recent Clinical Activity
              </h4>
              <Link to="/patient/history" className="text-xs font-bold text-[#0E7490] hover:underline flex items-center gap-1">
                View All <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="space-y-3">
              {recentVisits.length > 0 ? (
                recentVisits.map((v) => (
                  <div key={v._id} className="p-4 rounded-2xl border border-slate-100 bg-slate-50/50 flex items-center justify-between gap-4 transition-colors hover:bg-slate-50">
                    <div className="space-y-1">
                      <h5 className="text-sm font-extrabold text-slate-800">
                        Consultation with Dr. {v.doctorId?.userId?.name || v.doctorId?.name || "Practitioner"}
                      </h5>
                      <p className="text-xs font-semibold text-slate-500">
                        {v.doctorId?.hospitalId?.name || "Partner Clinic"} • {v.doctorId?.specialization || "General Medicine"}
                      </p>
                      <span className="text-[10px] text-slate-400 font-bold block">
                        {new Date(v.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                      </span>
                    </div>
                    <Badge label={v.status?.toUpperCase() || "COMPLETED"} variant="success" />
                  </div>
                ))
              ) : (
                <EmptyState
                  variant="empty"
                  title="No Recent Clinical Activity"
                  description="Your consultation history and medical reports will list here."
                />
              )}
            </div>
          </div>

          {/* Featured Partner Clinics */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200/60 shadow-xs space-y-4 hover-card-trigger">
            <div className="flex items-center justify-between">
              <h4 className="text-lg font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
                <Hospital className="h-5 w-5 text-[#14B8A6]" />
                Partnered Medical Centers
              </h4>
              <Link to="/patient/search?tab=clinics" className="text-xs font-bold text-[#0E7490] hover:underline flex items-center gap-1">
                View All Clinics <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {hospitals.length > 0 ? (
                hospitals.map((hosp) => (
                  <div key={hosp._id} className="bg-slate-50/60 rounded-2xl p-4 border border-slate-100 flex flex-col justify-between text-left space-y-3 relative group">
                    <div className="flex justify-between items-start">
                      <div className="w-9 h-9 rounded-xl bg-white text-[#0E7490] border border-slate-100 flex items-center justify-center shrink-0">
                        <Hospital className="h-4.5 w-4.5" />
                      </div>
                      <button
                        onClick={(e) => toggleFavorite(hosp._id, e)}
                        className={`p-1.5 rounded-lg border transition-all cursor-pointer ${favorites.includes(hosp._id) ? "bg-rose-50 border-rose-200 text-rose-600" : "bg-white border-slate-200 text-slate-400 hover:text-slate-600"}`}
                        title="Save Hospital"
                      >
                        <Heart className={`h-3.5 w-3.5 ${favorites.includes(hosp._id) ? "fill-current" : ""}`} />
                      </button>
                    </div>

                    <div>
                      <h5 className="text-xs font-extrabold text-slate-800 line-clamp-1">{hosp.name}</h5>
                      <p className="text-[11px] font-semibold text-slate-400 mt-1 flex items-center gap-1">
                        <MapPin className="h-3 w-3 shrink-0" />
                        {hosp.address?.city || hosp.city || "Delhi"}
                      </p>
                    </div>

                    <button
                      onClick={() => navigate(`/patient/book?hospitalId=${hosp._id}`)}
                      className="w-full py-2 rounded-xl bg-[#0E7490] hover:bg-[#0A5F76] text-white font-extrabold text-xs transition-all cursor-pointer border-none shadow-xs"
                    >
                      Book Ticket
                    </button>
                  </div>
                ))
              ) : (
                <EmptyState variant="empty" title="No Partner Clinics Loaded" />
              )}
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: 4 COLS (VITALS & EMERGENCY) */}
        <div className="lg:col-span-4 space-y-6">

          {/* Health Vitals Summary Card */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200/60 shadow-xs space-y-4 hover-card-trigger">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h4 className="text-base font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
                <Heart className="h-5 w-5 text-rose-500" />
                Personal Vitals
              </h4>
              <button
                onClick={() => navigate("/patient/vitals")}
                className="text-xs font-extrabold text-[#0E7490] hover:underline cursor-pointer border-none bg-transparent p-0"
              >
                Edit Vitals →
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="flex justify-between items-center bg-slate-50/60 p-3.5 rounded-2xl border border-slate-100">
                <span className="text-slate-500 font-bold flex items-center gap-2">
                  <Heart className="h-4 w-4 text-rose-500" />
                  Blood Group
                </span>
                <span className="font-black text-slate-800">{healthProfile?.bloodGroup || "O+"}</span>
              </div>

              <div className="flex justify-between items-center bg-slate-50/60 p-3.5 rounded-2xl border border-slate-100">
                <span className="text-slate-500 font-bold flex items-center gap-2">
                  <Activity className="h-4 w-4 text-[#0E7490]" />
                  Height / Weight
                </span>
                <span className="font-black text-slate-800">
                  {healthProfile?.height || "172"} cm / {healthProfile?.weight || "66"} kg
                </span>
              </div>

              <div className="flex justify-between items-center bg-slate-50/60 p-3.5 rounded-2xl border border-slate-100">
                <span className="text-slate-500 font-bold flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-[#14B8A6]" />
                  Body Mass Index
                </span>
                <div className="text-right">
                  <span className="font-black text-[#0E7490] block">{bmiDetails.val}</span>
                  <span className={`text-[10px] font-bold block ${bmiDetails.colorClass}`}>{bmiDetails.status}</span>
                </div>
              </div>
            </div>
          </div>

          {/* 24/7 Emergency Hotline Card */}
          <div className="bg-rose-500/5 border border-rose-500/10 p-6 rounded-3xl text-left space-y-4 hover-card-trigger">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-rose-500/10 text-rose-600 flex items-center justify-center shrink-0">
                <Phone className="h-5 w-5 animate-bounce" />
              </div>
              <div>
                <h4 className="text-sm font-black text-rose-800 tracking-tight leading-none">Emergency Hotline</h4>
                <p className="text-[11px] text-rose-500 font-semibold mt-1">24/7 Priority Ambulance</p>
              </div>
            </div>
            
            <a
              href="tel:102"
              className="p-3 bg-rose-500 hover:bg-rose-600 text-white text-center font-mono font-black text-xl rounded-2xl shadow-xs block no-underline transition"
            >
              CALL: 102
            </a>

            <button
              onClick={() => navigate("/patient/emergency")}
              className="w-full bg-white hover:bg-slate-50 border border-rose-200 text-rose-700 font-extrabold text-xs py-2.5 rounded-xl transition cursor-pointer"
            >
              🚨 Open SOS Dispatch & Trauma Center
            </button>
          </div>

        </div>

      </div>

    </div>
  );
}
