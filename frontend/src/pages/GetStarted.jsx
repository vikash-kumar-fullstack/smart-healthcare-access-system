import React from "react";
import { useNavigate, Link } from "react-router-dom";
import { User, Stethoscope, Building, ArrowRight, Sparkles } from "lucide-react";
import Button from "../components/landing/Button";

export default function GetStarted() {
  const navigate = useNavigate();

  const options = [
    {
      title: "Patient",
      icon: User,
      description: "Find nearby hospitals, check live wait times, and join virtual doctor consultation queues instantly.",
      cta: "Continue as Patient",
      color: "from-cyan-50 to-teal-50/20 text-[#0F4C81] hover:border-[#0F4C81]/30",
      iconBg: "bg-cyan-100/50 text-[#0F4C81]",
      route: "/signup",
      btnClass: "get-started-btn-patient border-[#0F4C81] text-[#0F4C81]"
    },
    {
      title: "Doctor",
      icon: Stethoscope,
      description: "Coordinate patient appointments, control your daily active session queue, and review historical analytics.",
      cta: "Continue as Doctor",
      color: "from-emerald-50 to-teal-50/20 text-emerald-700 hover:border-emerald-500/30",
      iconBg: "bg-emerald-100/50 text-emerald-700",
      route: "/doctor/register",
      btnClass: "get-started-btn-doctor border-emerald-600 text-emerald-600"
    },
    {
      title: "Hospital Board",
      icon: Building,
      description: "Manage clinical departments, verify practitioner schedules, audit operations, and optimize wait times.",
      cta: "Continue as Hospital",
      color: "from-indigo-50 to-blue-50/20 text-indigo-700 hover:border-indigo-500/30",
      iconBg: "bg-indigo-100/50 text-indigo-700",
      route: "/hospital/register",
      btnClass: "get-started-btn-hospital border-indigo-600 text-indigo-600"
    }
  ];

  return (
    <div className="min-h-[calc(100vh-88px)] flex flex-col justify-center items-center bg-[#F8FAFC] px-6 py-12 relative overflow-hidden">
      {/* Background soft glows */}
      <div className="absolute top-20 left-10 w-[500px] h-[500px] bg-cyan-200/5 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-20 right-10 w-[500px] h-[500px] bg-teal-150/5 rounded-full blur-[120px] pointer-events-none" />

      {/* Header */}
      <div className="text-center max-w-2xl mx-auto mb-12 z-10 animate-in fade-in slide-in-from-top-4 duration-350">
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold bg-[#DFF8F6] text-[#0E7490] uppercase tracking-wider">
          <Sparkles className="h-3.5 w-3.5" />
          Welcome to MediHospi
        </span>
        <h1 className="text-3xl md:text-5xl font-black text-slate-800 tracking-tight mt-4">
          Healthcare Access, <br />
          <span className="bg-gradient-to-r from-[#0F4C81] to-[#14B8A6] bg-clip-text text-transparent">
            Built For Everyone.
          </span>
        </h1>
        <p className="text-slate-500 text-xs md:text-sm mt-3">
          Select your registration path to join the MediHospi care coordination system.
        </p>
      </div>

      {/* Cards Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 max-w-6xl w-full z-10 animate-in fade-in slide-in-from-bottom-5 duration-400">
        {options.map((opt) => {
          const Icon = opt.icon;
          return (
            <div
              key={opt.title}
              onClick={() => navigate(opt.route)}
              className={`group bg-white rounded-3xl p-8 border border-slate-200/60 shadow-[0_8px_30px_rgba(0,0,0,0.02)] hover:shadow-[0_20px_40px_rgba(0,0,0,0.05)] transition-all duration-300 cursor-pointer flex flex-col justify-between items-start text-left min-h-[300px] relative overflow-hidden`}
            >
              {/* Subtle top indicator border */}
              <div className="absolute top-0 left-0 right-0 h-1 bg-transparent group-hover:bg-gradient-to-r from-[#0F4C81] to-[#14B8A6] transition-all" />

              <div>
                {/* Icon box */}
                <div className={`w-12 h-12 rounded-2xl ${opt.iconBg} flex items-center justify-center mb-6 transition-all duration-300 group-hover:scale-105 shadow-sm`}>
                  <Icon className="h-6 w-6" />
                </div>

                {/* Info */}
                <h3 className="text-lg font-black text-slate-800 group-hover:text-[#0F4C81] transition-colors">
                  {opt.title}
                </h3>
                <p className="text-xs text-slate-500 mt-2.5 leading-relaxed">
                  {opt.description}
                </p>
              </div>

              {/* Action Button - custom styled to avoid tailwind priority override bugs */}
              <button
                className={`mt-8 w-full border bg-transparent rounded-xl h-11 text-xs font-bold transition-all duration-300 flex items-center justify-center gap-1.5 cursor-pointer active:scale-95 ${opt.btnClass}`}
              >
                <span>{opt.cta}</span>
                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" />
              </button>
            </div>
          );
        })}
      </div>

      {/* Bottom login link */}
      <p className="text-xs text-slate-500 mt-10 z-10">
        Already have an account?{" "}
        <Link to="/login" className="text-[#0E7490] font-bold hover:underline">
          Sign In ➔
        </Link>
      </p>
    </div>
  );
}
