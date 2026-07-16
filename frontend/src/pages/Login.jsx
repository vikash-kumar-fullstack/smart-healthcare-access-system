import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../services/api";
import toast from "react-hot-toast";
import { ArrowRight, LogIn, Mail, Lock, Sparkles, Building, User, Eye, EyeOff } from "lucide-react";
import Button from "../components/landing/Button";
import logoImg from "../assets/logo.png";
import { clearSession, getDashboardPath } from "../utils/auth";
import { recordEvent } from "../utils/experienceMetrics";
export default function Login() {
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const errorParam = params.get("error");
    if (errorParam) {
      if (errorParam === "account_not_found") {
        toast.error("Account does not exist. Please sign up first.");
      } else if (errorParam === "account_exists") {
        toast.error("An account with this email already exists. Please sign in.");
      } else {
        toast.error(decodeURIComponent(errorParam));
      }
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const [form, setForm] = useState({
    email: "",
    password: ""
  });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [activeRole, setActiveRole] = useState("patient");

  const handleChange = (e) => {
    setForm({
      ...form,
      [e.target.name]: e.target.value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      recordEvent("login_start");
      setLoading(true);
      const res = await api.post("/auth/login", form);
      const { token, refreshToken, role, user } = res.data.data;

      clearSession();
      localStorage.setItem("token", token);
      localStorage.setItem("refreshToken", refreshToken);
      localStorage.setItem("role", role);
      localStorage.setItem("user", JSON.stringify(user));

      recordEvent("login_success");
      toast.success("Login successful");

      navigate(getDashboardPath(role), { replace: true });
    } catch (err) {
      toast.error(
        err.response?.data?.message || "Login failed"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-88px)] flex items-center justify-center bg-[#F8FAFC] px-4 py-12 relative overflow-hidden">
      {/* Background ambient shapes */}
      <div className="absolute top-10 left-10 w-96 h-96 bg-[#14B8A6]/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-[#0E7490]/5 rounded-full blur-3xl pointer-events-none" />

      {/* Main Dual Split Card Container */}
      <div className="w-full max-w-4xl bg-white rounded-3xl border border-slate-200/60 shadow-[0_15px_40px_rgba(0,0,0,0.06)] overflow-hidden grid grid-cols-1 md:grid-cols-12 min-h-[580px] z-10 animate-in fade-in zoom-in-95 duration-400">
        
        {/* LEFT PANEL: Sliding Brand Gradient Panel (5 cols) */}
        <div className="md:col-span-5 bg-gradient-to-br from-[#0E7490] to-[#0A5F76] text-white p-8 md:p-12 flex flex-col justify-between relative overflow-hidden">
          {/* Subtle design element circles */}
          <div className="absolute -top-12 -right-12 w-40 h-40 bg-white/5 rounded-full blur-lg pointer-events-none" />
          <div className="absolute -bottom-16 -left-16 w-52 h-52 bg-white/5 rounded-full blur-xl pointer-events-none" />
          
          {/* Header */}
          <div className="flex items-center gap-3 bg-white/95 backdrop-blur-sm px-4 py-2.5 rounded-2xl border border-white/10 shadow-sm w-fit shrink-0">
            <div className="bg-white p-1 rounded-lg border border-slate-150 shadow-sm shrink-0">
              <img src={logoImg} alt="MediHospi Logo" className="w-6 h-6 object-contain rounded" />
            </div>
            <div className="flex flex-col text-left">
              <span className="font-black text-xs leading-none tracking-tight">
                <span className="text-[#0F4C81]">Medi</span>
                <span className="text-[#14B8A6]">Hospi</span>
              </span>
              <span className="text-[8px] font-bold text-[#64748B] mt-1 tracking-wide">
                Smart HealthCare Access System
              </span>
            </div>
          </div>

          {/* Welcome Text */}
          <div className="my-auto py-8 flex flex-col gap-4 text-left">
            <h3 className="text-3xl font-black tracking-tight leading-tight">Welcome Back!</h3>
            <p className="text-xs text-cyan-50/80 leading-relaxed max-w-xs">
              To keep connected with your clinic scheduling, patient queues, or doctor profile details, please sign in.
            </p>
          </div>

          {/* Sign Up Redirect */}
          <div className="flex flex-col items-start gap-3 mt-auto text-left">
            <p className="text-xs text-cyan-100/70 font-semibold">New to our platform?</p>
            <button
              onClick={() => navigate("/get-started")}
              className="inline-flex items-center gap-2 h-10 px-5 rounded-xl border border-white/30 bg-white/10 text-white font-bold text-xs hover:bg-white hover:text-[#0E7490] transition-all duration-300"
            >
              CREATE ACCOUNT
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* RIGHT PANEL: Form Container (7 cols) */}
        <div className="md:col-span-7 p-8 md:p-12 flex flex-col justify-center">
          <div className="max-w-md w-full mx-auto flex flex-col gap-6">
            
            {/* Header */}
            <div className="text-left">
              <h2 className="text-2xl font-black text-slate-800 tracking-tight">Sign In</h2>
              <p className="text-xs text-slate-500 mt-1">Access your patient, doctor, or hospital dashboard</p>
            </div>

            {/* Role Tab Selector for Google OAuth */}
            <div className="flex flex-col gap-1.5 text-left">
              <div className="grid grid-cols-3 gap-1 bg-slate-100 p-1 rounded-xl">
                {[
                  { id: "patient", label: "Patient" },
                  { id: "doctor", label: "Doctor" },
                  { id: "hospital", label: "Hospital" }
                ].map((roleTab) => (
                  <button
                    key={roleTab.id}
                    type="button"
                    onClick={() => setActiveRole(roleTab.id)}
                    className={`py-1.5 rounded-lg text-[10px] font-bold transition-all cursor-pointer border-none ${
                      activeRole === roleTab.id
                        ? "bg-white text-[#0E7490] shadow-sm"
                        : "text-slate-500 hover:text-slate-700 bg-transparent"
                    }`}
                  >
                    {roleTab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Google Login Button */}
            <button
              type="button"
              onClick={() => {
                window.location.href = `${import.meta.env.VITE_API_URL}/auth/${activeRole}/google?action=login`;
              }}
              className="w-full h-11 border border-slate-200 hover:border-red-500/30 hover:bg-red-50/20 text-slate-700 font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <svg className="w-4 h-4 mr-1" viewBox="0 0 24 24">
                <path fill="#EA4335" d="M12.24 10.285V14.4h6.887c-.648 2.41-2.519 4.114-5.136 4.114A5.99 5.99 0 0 1 8 12.5a5.99 5.99 0 0 1 5.99-6.012c1.49 0 2.854.542 3.906 1.439l3.078-3.078C19.1 3.23 16.666 2 13.99 2 8.162 2 3.5 6.662 3.5 12.5s4.662 10.5 10.49 10.5c5.783 0 10.024-4.06 10.024-10.155 0-.616-.055-1.21-.16-1.78l-11.614.22Z" />
              </svg>
              Continue with Google
            </button>

            {/* Divider */}
            <div className="relative flex py-1 items-center">
              <div className="flex-grow border-t border-slate-200"></div>
              <span className="flex-shrink mx-4 text-[10px] text-slate-400 font-bold uppercase tracking-wider">or use email login</span>
              <div className="flex-grow border-t border-slate-200"></div>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="flex flex-col gap-4 text-left">
              
              {/* Email */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-bold text-slate-450 tracking-wider">
                  Email Address
                </label>
                <div className="relative flex items-center">
                  <Mail className="absolute left-3.5 h-4.5 w-4.5 text-slate-400" />
                  <input
                    type="email"
                    name="email"
                    placeholder="name@example.com"
                    value={form.email}
                    onChange={handleChange}
                    className="h-11 w-full pl-11 pr-4 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 outline-none transition focus:border-[#0E7490] focus:ring-2 focus:ring-[#0E7490]/5"
                    autoComplete="email"
                    required
                  />
                </div>
              </div>

              {/* Password */}
              <div className="flex flex-col gap-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] uppercase font-bold text-slate-450 tracking-wider">
                    Password
                  </label>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      toast.success("Password recovery link sent!");
                    }}
                    className="text-[10px] text-[#0E7490] font-bold hover:underline cursor-pointer bg-transparent border-none p-0"
                  >
                    Forgot Password?
                  </button>
                </div>
                 <div className="relative flex items-center w-full">
                  <Lock className="absolute left-3.5 h-4.5 w-4.5 text-slate-400" />
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    placeholder="••••••••"
                    value={form.password}
                    onChange={handleChange}
                    className="h-11 w-full pl-11 pr-11 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 outline-none transition focus:border-[#0E7490] focus:ring-2 focus:ring-[#0E7490]/5"
                    autoComplete="current-password"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 flex items-center justify-center text-slate-400 hover:text-[#0E7490] focus:outline-none transition-colors cursor-pointer"
                  >
                    {showPassword ? <EyeOff className="h-4.5 w-4.5" /> : <Eye className="h-4.5 w-4.5" />}
                  </button>
                </div>
              </div>

              {/* Submit */}
              <Button
                type="submit"
                disabled={loading}
                className="mt-2 w-full h-11 bg-[#0E7490] hover:bg-[#0c5f76] text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 shadow-md shadow-cyan-900/10 transition-all duration-300"
              >
                {loading ? "Signing in..." : "SIGN IN"}
                {!loading && <ArrowRight className="h-4.5 w-4.5" />}
              </Button>

            </form>

            {/* Switch on Mobile */}
            <p className="md:hidden text-center text-xs text-slate-500 mt-2">
              New to MediHospi?{" "}
              <Link to="/get-started" className="text-[#0E7490] font-bold hover:underline">
                Create Account
              </Link>
            </p>

          </div>
        </div>

      </div>
    </div>
  );
}
