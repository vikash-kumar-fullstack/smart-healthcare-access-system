import { Link, Outlet, useNavigate, useLocation } from "react-router-dom";
import api from "../services/api";
import { 
  LayoutDashboard, 
  Building2, 
  UserRoundCheck, 
  GitCommit, 
  FileSpreadsheet, 
  Activity, 
  ShieldAlert, 
  LogOut, 
  UserX 
} from "lucide-react";

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();

  const handleLogout = async () => {
    try {
      await api.post("/auth/logout");
    } catch (err) {
      console.error("Logout failed on server:", err);
    }
    localStorage.removeItem("token");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("role");
    navigate("/login");
  };

  const handleLogoutAll = async () => {
    if (!window.confirm("Are you sure you want to terminate all active administrative sessions?")) return;
    try {
      await api.post("/admin/logout-all");
    } catch (err) {
      console.error("Failed to revoke all sessions:", err);
    }
    localStorage.removeItem("token");
    localStorage.removeItem("refreshToken");
    localStorage.removeItem("role");
    navigate("/login");
  };

  const menuItems = [
    { name: "Dashboard", path: "/admin", icon: LayoutDashboard },
    { name: "Hospitals", path: "/admin/hospitals", icon: Building2 },
    { name: "Doctors", path: "/admin/doctors", icon: UserRoundCheck },
    { name: "Queues", path: "/admin/queues", icon: GitCommit },
    { name: "Reports", path: "/admin/reports", icon: FileSpreadsheet },
    { name: "System Health", path: "/admin/health", icon: Activity },
    { name: "Audit Logs", path: "/admin/audits", icon: ShieldAlert }
  ];

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col md:flex-row font-sans">
      {/* Sidebar */}
      <aside className="w-full md:w-64 bg-slate-950 border-b md:border-b-0 md:border-r border-slate-800 flex flex-col justify-between shrink-0">
        <div>
          {/* Logo Title */}
          <div className="p-6 border-b border-slate-800 flex items-center justify-between">
            <span className="text-xl font-bold tracking-wider text-teal-400 font-mono">
              HEALTH-CORE
            </span>
            <span className="bg-teal-500/10 text-teal-400 text-xs px-2 py-0.5 rounded-full border border-teal-500/20 font-semibold uppercase">
              District
            </span>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1">
            {menuItems.map((item) => {
              const Icon = item.icon;
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.name}
                  to={item.path}
                  className={`
                    flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all duration-200 group
                    ${isActive 
                      ? "bg-teal-500/10 text-teal-400 border border-teal-500/30 shadow-lg shadow-teal-500/5" 
                      : "text-slate-400 hover:bg-slate-900 hover:text-slate-100 border border-transparent"}
                  `}
                >
                  <Icon className={`w-4 h-4 transition-transform group-hover:scale-110 ${isActive ? "text-teal-400" : "text-slate-400 group-hover:text-slate-100"}`} />
                  {item.name}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Footer Logout controls */}
        <div className="p-4 border-t border-slate-800 space-y-2">
          <button
            onClick={handleLogoutAll}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold rounded-lg bg-orange-600/10 text-orange-400 hover:bg-orange-600/20 border border-orange-500/30 transition duration-200"
          >
            <UserX className="w-3.5 h-3.5" />
            Revoke All Sessions
          </button>
          <button
            onClick={handleLogout}
            className="w-full flex items-center justify-center gap-2 px-3 py-2.5 text-xs font-semibold rounded-lg bg-rose-600/10 text-rose-400 hover:bg-rose-600/20 border border-rose-500/30 transition duration-200"
          >
            <LogOut className="w-3.5 h-3.5" />
            Log Out
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 bg-slate-900 flex flex-col">
        {/* Top Navbar status header */}
        <header className="h-16 border-b border-slate-800 bg-slate-950/50 backdrop-blur px-6 flex items-center justify-between shrink-0">
          <h2 className="text-lg font-bold text-slate-100 tracking-wide font-mono">
            {menuItems.find(item => item.path === location.pathname)?.name || "Control Center"}
          </h2>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-2 text-xs text-slate-400 font-semibold bg-slate-900 border border-slate-800 px-3 py-1.5 rounded-full">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              SECURE SESSION ACTIVE
            </span>
          </div>
        </header>

        {/* Child Router container */}
        <div className="flex-1 p-6 overflow-y-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
