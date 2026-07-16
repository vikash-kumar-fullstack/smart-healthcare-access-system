import { useEffect } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { ChevronRight, Hospital, LogIn, UserPlus } from "lucide-react";
import logoImg from "../assets/logo.png";

export default function PublicLayout() {
  const location = useLocation();
  const isAuthPage = ["/login", "/signup"].includes(location.pathname);

  const isLandingPage = location.pathname === "/";

  useEffect(() => {
    // Force light theme on all public routes
    const root = document.documentElement;
    const previousTheme = root.getAttribute("data-theme");
    const wasDark = root.classList.contains("dark");
    
    root.setAttribute("data-theme", "light");
    root.classList.remove("dark");
    
    return () => {
      // Restore previous theme when leaving public layout
      if (previousTheme) {
        root.setAttribute("data-theme", previousTheme);
      }
      if (wasDark) {
        root.classList.add("dark");
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-[var(--color-light)] text-[var(--color-dark)]">
      {!isLandingPage && (
        <header className="sticky top-0 z-40 border-b border-slate-200/80 bg-white/85 backdrop-blur">
          <div className="mx-auto flex h-[72px] max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
            <Link to="/" className="flex items-center gap-3 group">
              <div className="bg-white p-1 rounded-lg border border-slate-100 shadow-sm shrink-0">
                <img src={logoImg} alt="MediHospi Logo" className="w-8 h-8 object-contain rounded" />
              </div>
              <div className="flex flex-col text-left">
                <span className="font-black text-sm leading-none tracking-tight">
                  <span className="text-[#0F4C81]">Medi</span>
                  <span className="text-[#14B8A6]">Hospi</span>
                </span>
                <span className="text-[8px] font-bold text-[#64748B] mt-1 tracking-wide hidden sm:block">
                  Smart HealthCare Access System
                </span>
              </div>
            </Link>

            <div className="flex items-center gap-2">
              <Link
                to="/login"
                className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-medium transition ${
                  location.pathname === "/login"
                    ? "bg-slate-900 text-white"
                    : "text-slate-700 hover:bg-slate-100"
                }`}
              >
                <LogIn className="h-4 w-4" />
                Sign In
              </Link>
              <Link
                to="/signup"
                className="inline-flex items-center gap-2 rounded-xl bg-[var(--color-primary)] px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-blue-700"
              >
                <UserPlus className="h-4 w-4" />
                Create Account
              </Link>
            </div>
          </div>
        </header>
      )}

      <main className={isAuthPage ? "bg-[linear-gradient(180deg,#f8fbff_0%,#f6f8fc_100%)]" : ""}>
        <Outlet />
      </main>

      {!isLandingPage && (
        <footer className="border-t border-slate-200/80 bg-white">
          <div className="mx-auto flex max-w-7xl flex-col gap-3 px-4 py-5 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
            <div className="flex items-center gap-2">
              <Hospital className="h-4 w-4" />
              <span>Production queue and appointment operations</span>
            </div>
            <div className="flex items-center gap-1">
              <span>Built for patients, doctors, admins, and hospital teams</span>
              <ChevronRight className="h-4 w-4" />
            </div>
          </div>
        </footer>
      )}
    </div>
  );
}

