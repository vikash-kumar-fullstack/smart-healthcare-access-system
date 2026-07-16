import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import logoImg from "../../assets/logo.png";
import {
  House,
  Calendar,
  Clock,
  Bell,
  History,
  Heart,
  User,
  Settings,
  LogOut,
  Menu,
  X,
  Search,
  Building2,
  UserRoundCheck,
  GitCommit,
  FileSpreadsheet,
  Activity,
  ShieldAlert,
  HelpCircle,
  Users,
  PlusCircle,
  ArrowLeftRight
} from "lucide-react";
import api from "../../services/api";
import { clearSession } from "../../utils/auth";
import toast from "react-hot-toast";
import { useRealtime } from "../RealtimeProvider";

export default function DashboardLayout({ children, role }) {
  const { connectionState, subscribe } = useRealtime() || { connectionState: "OFFLINE" };
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [navQuery, setNavQuery] = useState("");
  const [user, setUser] = useState(() => {
    const saved = localStorage.getItem("user");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        return {
          name: parsed.name || "User",
          email: parsed.email || "",
          role: parsed.role || role
        };
      } catch (e) {
        console.error(e);
      }
    }
    return { name: "User", email: "", role: role };
  });
  const navigate = useNavigate();
  const location = useLocation();
  const dropdownRef = useRef(null);

  const handleNavSearchKeyDown = (e) => {
    if (e.key === "Enter" && navQuery.trim()) {
      if (role === "patient") {
        navigate(`/patient/search?q=${encodeURIComponent(navQuery.trim())}`);
      } else {
        toast.info(`Search query "${navQuery.trim()}" entered.`);
      }
      setNavQuery("");
    }
  };

  // Force light theme for the authenticated dashboards
  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-theme", "light");
    root.classList.remove("dark");
  }, []);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setProfileDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const fetchUnreadCount = async () => {
    if (location.pathname.endsWith("/notifications")) {
      setUnreadCount(0);
      return;
    }
    try {
      const countRes = await api.get("/notifications/unread").catch(() => null);
      if (countRes?.data?.success) {
        setUnreadCount(countRes.data.data.unreadCount || 0);
      }
    } catch (err) {
      console.error("Dashboard shell fetch unread count error:", err);
    }
  };

  const handleClearNotifications = () => {
    setUnreadCount(0);
    window.dispatchEvent(new CustomEvent("notifications-updated"));
  };

  // Fetch unread count and profile details
  useEffect(() => {
    async function fetchData() {
      try {
        await fetchUnreadCount();
        
        const saved = localStorage.getItem("user");
        if (saved) {
          const parsed = JSON.parse(saved);
          setUser({
            name: parsed.name || "User",
            email: parsed.email || "",
            role: parsed.role || role
          });
        } else if (role === "doctor") {
          const docRes = await api.get("/doctors/profile").catch(() => null);
          if (docRes?.data?.success) {
            setUser({
              name: docRes.data.data.userId?.name || "Dr. Partner",
              email: docRes.data.data.userId?.email || "",
              role: "Doctor"
            });
          }
        } else if (role === "admin" || role === "district_admin") {
          setUser({
            name: "Super Admin",
            email: "superadmin@medhospi.com",
            role: "Super Administrator"
          });
        }
      } catch (err) {
        console.error("Dashboard shell fetch error:", err);
      }
    }
    fetchData();
  }, [role, location.pathname]);

  // Realtime notification listener
  useEffect(() => {
    if (!subscribe) return;
    const unsub = subscribe("NOTIFICATION", () => {
      fetchUnreadCount();
    });
    return unsub;
  }, [subscribe]);

  // Custom window event listener to update unread count when read state changes
  useEffect(() => {
    window.addEventListener("notifications-updated", fetchUnreadCount);
    return () => window.removeEventListener("notifications-updated", fetchUnreadCount);
  }, []);

  const handleLogout = async () => {
    try {
      await api.post("/auth/logout").catch(() => null);
    } catch (err) {
      console.error("Logout failed on server", err);
    }
    clearSession();
    toast.success("Logged out successfully");
    navigate("/login", { replace: true });
  };

  // Define sidebar navigation items based on role
  const patientLinks = [
    { name: "Dashboard", path: "/patient", icon: House },
    { name: "My Appointments", path: "/patient/appointments", icon: Calendar },
    { name: "Live Queue", path: "/patient/queue", icon: Clock },
    { name: "Notifications", path: "/patient/notifications", icon: Bell, count: unreadCount },
    { name: "Medical History", path: "/patient/history", icon: History },
    { name: "Saved Hospitals", path: "/patient/saved", icon: Heart },
    { name: "Profile", path: "/patient/profile", icon: User },
    { name: "Settings", path: "/patient/settings", icon: Settings }
  ];

  const doctorLinks = [
    { name: "Dashboard", path: "/doctor", icon: House },
    { name: "Analytics", path: "/doctor/analytics", icon: FileSpreadsheet },
    { name: "Records", path: "/doctor/medical-records", icon: History },
    { name: "Timeline", path: "/doctor/timeline", icon: Clock },
    { name: "Notifications", path: "/doctor/notifications", icon: Bell, count: unreadCount },
    { name: "Profile", path: "/doctor/profile", icon: User },
    { name: "Settings", path: "/doctor/settings", icon: Settings }
  ];

  const adminLinks = [
    { name: "Dashboard", path: "/admin", icon: House },
    { name: "Hospital Overview", path: "/admin/hospital-overview", icon: Activity },
    { name: "Hospitals", path: "/admin/hospitals", icon: Building2 },
    { name: "Doctors", path: "/admin/doctors", icon: UserRoundCheck },
    { name: "Queues", path: "/admin/queues", icon: GitCommit },
    { name: "Reports", path: "/admin/reports", icon: FileSpreadsheet },
    { name: "System Health", path: "/admin/health", icon: Activity },
    { name: "Notifications", path: "/admin/notifications", icon: Bell, count: unreadCount },
    { name: "Audit Logs", path: "/admin/audits", icon: ShieldAlert },
    { name: "Profile", path: "/admin/profile", icon: User },
    { name: "Settings", path: "/admin/settings", icon: Settings }
  ];

  const hospitalAdminLinks = [
    { name: "Dashboard", path: "/admin", icon: House },
    { name: "Doctors", path: "/admin/doctors", icon: UserRoundCheck },
    { name: "Receptionists", path: "/admin/receptionists", icon: Users },
    { name: "Schedules", path: "/admin/schedules", icon: Calendar },
    { name: "Queues", path: "/admin/queues", icon: GitCommit },
    { name: "Applications", path: "/admin/applications", icon: FileSpreadsheet },
    { name: "Analytics", path: "/admin/analytics", icon: Activity },
    { name: "Notifications", path: "/admin/notifications", icon: Bell, count: unreadCount },
    { name: "Reports", path: "/admin/reports", icon: FileSpreadsheet },
    { name: "Settings", path: "/admin/settings", icon: Settings }
  ];

  const receptionistLinks = [
    { name: "Dashboard", path: "/reception", icon: House },
    { name: "Check-in Desk", path: "/reception?tab=checkin", icon: UserRoundCheck },
    { name: "Walk-ins", path: "/reception?tab=walkins", icon: PlusCircle },
    { name: "Transfers", path: "/reception?tab=transfers", icon: ArrowLeftRight },
    { name: "Queue Monitor", path: "/reception?tab=queuemonitor", icon: GitCommit },
    { name: "Doctors On Duty", path: "/reception?tab=doctors", icon: Users },
    { name: "Patient Search", path: "/reception?tab=search", icon: Search },
    { name: "Emergency Queue", path: "/reception?tab=emergency", icon: ShieldAlert },
    { name: "Notifications", path: "/reception/notifications", icon: Bell, count: unreadCount },
    { name: "Reports", path: "/reception?tab=reports", icon: FileSpreadsheet },
    { name: "Profile", path: "/reception/profile", icon: User }
  ];

  const getNotificationsPath = () => {
    const activeRole = user?.role || role;
    if (activeRole === "admin" || activeRole === "super_admin" || activeRole === "district_admin" || activeRole === "hospital_admin") {
      return "/admin/notifications";
    }
    if (activeRole === "receptionist") {
      return "/reception/notifications";
    }
    return `/${activeRole}/notifications`;
  };

  const getMenuLinks = () => {
    const activeRole = user?.role || role;
    if (activeRole === "admin" || activeRole === "super_admin" || activeRole === "district_admin") {
      const base = [...adminLinks];
      if (activeRole === "super_admin") {
        base.splice(6, 0, { name: "Security Control", path: "/admin/security", icon: ShieldAlert });
      }
      return base;
    }
    if (activeRole === "hospital_admin") return hospitalAdminLinks;
    if (activeRole === "receptionist") return receptionistLinks;
    if (activeRole === "doctor") return doctorLinks;
    return patientLinks;
  };

  const getRoleLabel = () => {
    const activeRole = user?.role || role;
    if (activeRole === "admin" || activeRole === "super_admin" || activeRole === "district_admin") return "Super Admin";
    if (activeRole === "hospital_admin") return "Hospital Admin";
    if (activeRole === "receptionist") return "Receptionist Desk";
    if (activeRole === "doctor") return "Doctor Workspace";
    return "Patient Workspace";
  };

  const menuLinks = getMenuLinks();
  const roleLabel = getRoleLabel();

  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900 font-sans flex flex-col">
      {/* TOPBAR (72px) */}
      <header className="fixed top-0 left-0 right-0 h-[72px] bg-white border-b border-slate-200/60 shadow-[0_2px_15px_rgba(0,0,0,0.015)] z-[var(--z-navbar)] px-4 md:px-6 flex items-center justify-between">
        
        {/* Left Side: Logo & Workspace Title */}
        <div className="flex items-center gap-4">
          {/* Hamburger (Mobile toggle) */}
          <button
            onClick={() => setMobileSidebarOpen(!mobileSidebarOpen)}
            className="p-2 text-slate-500 hover:bg-slate-100 rounded-xl lg:hidden focus:outline-none transition-colors"
          >
            {mobileSidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          
          <Link to="/" className="flex items-center gap-3 group">
            <div className="bg-white p-1.5 rounded-xl shadow-sm border border-slate-100/85 transition-all duration-300 group-hover:shadow-md shrink-0">
              <img src={logoImg} alt="MediHospi Logo" className="w-9 h-9 object-contain rounded-lg" />
            </div>
            <div className="flex flex-col text-left">
              <span className="font-black text-lg leading-none tracking-tight">
                <span className="text-[#0F4C81]">Medi</span>
                <span className="text-[#14B8A6]">Hospi</span>
              </span>
              <span className="text-[9px] font-bold text-[#64748B] mt-1 tracking-wide hidden sm:block">
                Smart HealthCare Access System
              </span>
            </div>
          </Link>
        </div>

        {/* Middle Side: Universal Search Input */}
        <div className="flex-1 max-w-md mx-6 hidden md:block">
          <div className="relative flex items-center">
            <Search className="absolute left-3.5 h-4.5 w-4.5 text-slate-400" />
            <input
              type="text"
              placeholder={role === "patient" ? "Search hospitals, clinics or doctors..." : "Search record ID, history..."}
              value={navQuery}
              onChange={(e) => setNavQuery(e.target.value)}
              onKeyDown={handleNavSearchKeyDown}
              className="h-10 w-full pl-11 pr-4 rounded-xl border border-slate-200 bg-[#F8FAFC] text-xs text-slate-800 outline-none transition focus:border-[#0E7490] focus:bg-white focus:ring-2 focus:ring-[#0E7490]/5"
            />
          </div>
        </div>

        {/* Right Side: Status, Notifications and Profile */}
        <div className="flex items-center gap-3.5">
          {/* Live Sync Status */}
          <span
            className={`hidden sm:inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${
              connectionState === "LIVE"
                ? "border-emerald-250 bg-emerald-50 text-emerald-700"
                : "border-rose-250 bg-rose-50 text-rose-700 animate-pulse"
            }`}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${connectionState === "LIVE" ? "bg-emerald-500" : "bg-rose-500"}`} />
            {connectionState}
          </span>

          {/* Notifications bell */}
          <Link
            to={getNotificationsPath()}
            onClick={handleClearNotifications}
            className="p-2.5 rounded-xl border border-slate-200/60 hover:bg-slate-50 relative text-slate-500 hover:text-slate-800 transition-all cursor-pointer"
          >
            <Bell className="h-5 w-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 h-4 w-4 bg-rose-500 text-white rounded-full text-[9px] font-black flex items-center justify-center border border-white">
                {unreadCount}
              </span>
            )}
          </Link>

          {/* Profile Dropdown */}
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
              className="flex items-center gap-2 p-1.5 rounded-xl border border-slate-200/60 hover:bg-slate-50 transition-all cursor-pointer"
            >
              <div className="w-7.5 h-7.5 rounded-lg bg-gradient-to-br from-[#0F4C81] to-[#14B8A6] text-white flex items-center justify-center font-bold text-xs">
                {user.name.charAt(0).toUpperCase()}
              </div>
              <span className="text-xs font-bold text-slate-700 hidden lg:inline-block pr-1">
                {user.name.split(" ")[0]}
              </span>
            </button>

            {/* Dropdown Menu */}
            {profileDropdownOpen && (
              <div className="absolute right-0 mt-2 w-52 bg-white rounded-2xl border border-slate-200/60 shadow-xl py-2 z-[var(--z-dropdown)] animate-in fade-in slide-in-from-top-2 duration-[var(--transition-normal)]">
                <div className="px-4 py-2 border-b border-slate-100 text-left">
                  <h6 className="text-xs font-extrabold text-slate-800 leading-tight">{user.name}</h6>
                  <p className="text-[10px] text-slate-400 mt-0.5 truncate">{roleLabel}</p>
                </div>
                <div className="py-1">
                  <Link
                    to={`/${role}/profile`}
                    onClick={() => setProfileDropdownOpen(false)}
                    className="flex items-center gap-2 px-4 py-2 text-xs text-slate-650 hover:bg-slate-50 transition-colors"
                  >
                    <User className="h-4 w-4 text-slate-400" />
                    My Profile
                  </Link>
                  <Link
                    to={`/${role}/settings`}
                    onClick={() => setProfileDropdownOpen(false)}
                    className="flex items-center gap-2 px-4 py-2 text-xs text-slate-650 hover:bg-slate-50 transition-colors"
                  >
                    <Settings className="h-4 w-4 text-slate-400" />
                    Settings
                  </Link>
                </div>
                <div className="border-t border-slate-100 py-1">
                  <button
                    onClick={() => {
                      setProfileDropdownOpen(false);
                      handleLogout();
                    }}
                    className="w-full flex items-center gap-2 px-4 py-2 text-xs text-rose-600 hover:bg-rose-50 transition-colors text-left"
                  >
                    <LogOut className="h-4 w-4" />
                    Sign Out
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

      </header>

      <div className="flex-1 flex pt-[72px] h-[calc(100vh-72px)] overflow-hidden relative">
        
        {/* SIDEBAR (280px) */}
        {/* Backdrop for mobile */}
        {mobileSidebarOpen && (
          <div
            onClick={() => setMobileSidebarOpen(false)}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-[calc(var(--z-navbar)-2)] lg:hidden"
          />
        )}

        <aside
          className={`fixed lg:relative top-[72px] lg:top-0 bottom-0 left-0 w-[280px] bg-white border-r border-slate-250/50 flex flex-col justify-between shrink-0 z-[calc(var(--z-navbar)-1)] transition-transform duration-[var(--transition-normal)] lg:translate-x-0 ${
            mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          {/* Scrollable nav menu items */}
          <nav className="p-4 space-y-1 overflow-y-auto flex-1">
            {menuLinks.map((item) => {
              const Icon = item.icon;
              const hasTabParam = new URLSearchParams(location.search).has("tab");
              const isActive = item.path.includes("?") 
                ? (location.pathname + location.search) === item.path 
                : (location.pathname === item.path && !hasTabParam);
              return (
                <Link
                  key={item.name}
                  to={item.path}
                  onClick={() => {
                    setMobileSidebarOpen(false);
                    if (item.name === "Notifications") {
                      handleClearNotifications();
                    }
                  }}
                  className={`
                    flex items-center justify-between px-4 py-3.5 rounded-2xl text-xs font-bold transition-all duration-200 group border
                    ${isActive
                      ? "bg-[#0F4C81]/8 border-[#0F4C81]/15 text-[#0F4C81]"
                      : "text-slate-500 hover:bg-slate-50 hover:text-slate-800 border-transparent"}
                  `}
                >
                  <div className="flex items-center gap-3.5">
                    <Icon className={`w-5 h-5 transition-transform group-hover:scale-105 shrink-0 ${isActive ? "text-[#0F4C81]" : "text-slate-400 group-hover:text-slate-600"}`} />
                    <span>{item.name}</span>
                  </div>
                  {item.count !== undefined && item.count > 0 && (
                    <span className="bg-[#14B8A6] text-white text-[9px] font-black px-2 py-0.5 rounded-full shrink-0">
                      {item.count}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>

          {/* Quick Support strip in sidebar */}
          <div className="p-4 border-t border-slate-100">
            <div className="bg-slate-50 p-4.5 rounded-2xl text-left flex items-start gap-3">
              <HelpCircle className="h-5 w-5 text-[#0F4C81] shrink-0 mt-0.5" />
              <div>
                <h6 className="text-[11px] font-extrabold text-slate-700">Need Help?</h6>
                <p className="text-[10px] text-slate-400 mt-1 leading-relaxed">Contact support for active queue scheduling issues.</p>
                <a href="mailto:support@medhospi.com" className="text-[10px] text-[#0F4C81] font-bold mt-2.5 inline-block hover:underline">
                  support@medhospi.com
                </a>
              </div>
            </div>
          </div>
        </aside>

        {/* MAIN CONTENT AREA */}
        <main className="flex-1 overflow-y-auto bg-[#F8FAFC] p-4 sm:p-6 lg:p-8 text-left">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>

      </div>
    </div>
  );
}
