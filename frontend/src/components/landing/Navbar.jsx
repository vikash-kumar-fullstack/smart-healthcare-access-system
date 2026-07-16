import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import logoImg from "../../assets/logo.png";
import Button from "./Button";
import { Menu, X } from "lucide-react";

export default function Navbar({
  onScrollToSection,
}) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => {
      if (window.scrollY > 20) {
        setIsScrolled(true);
      } else {
        setIsScrolled(false);
      }
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navItems = [
    { label: "Home", sectionId: "hero" },
    { label: "Find Hospital", sectionId: "find-hospital" },
    { label: "Doctors", sectionId: "doctors" },
    { label: "Queue", sectionId: "queue-demo" },
    { label: "About", sectionId: "how-it-works" },
  ];

  const handleNavClick = (sectionId, label) => {
    setMobileMenuOpen(false);
    if (label === "Find Hospital" || label === "Doctors") {
      navigate("/login");
      return;
    }
    if (onScrollToSection) {
      onScrollToSection(sectionId);
    }
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-[var(--z-navbar)] px-4 py-4 transition-all duration-300">
      <div
        className={`max-w-7xl mx-auto h-[88px] px-6 md:px-10 rounded-[20px] flex items-center justify-between transition-all duration-500 ${
          isScrolled
            ? "bg-white/90 backdrop-blur-xl border border-slate-200/50 shadow-[0_8px_30px_rgba(0,0,0,0.06)]"
            : "bg-transparent border-transparent"
        }`}
      >
        {/* LOGO */}
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

        {/* Desktop Menu links */}
        <div className="hidden lg:flex items-center gap-8">
          {navItems.map((item) => (
            <button
              key={item.label}
              onClick={() => handleNavClick(item.sectionId, item.label)}
              className="text-base font-bold text-slate-700 hover:text-[#0E7490] transition-colors cursor-pointer"
            >
              {item.label}
            </button>
          ))}
        </div>

        {/* Desktop Actions */}
        <div className="hidden lg:flex items-center gap-4">
          <Link
            to="/login"
            className="text-base font-black text-slate-800 hover:text-[#0E7490] px-4 py-2 transition-colors cursor-pointer"
          >
            Login
          </Link>
          <Button
            variant="primary"
            onClick={() => navigate("/get-started")}
            className="bg-[#0E7490] text-white hover:bg-[#0c5f76] px-6 h-12 rounded-[16px] font-black text-base"
          >
            Get Started
          </Button>
        </div>

        {/* Mobile Hamburguer button */}
        <div className="lg:hidden flex items-center gap-2">
          <Link
            to="/login"
            className="text-sm font-extrabold text-slate-700 hover:text-[#0E7490] px-3 py-2 transition-colors"
          >
            Login
          </Link>
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="p-2 text-slate-600 hover:text-[#0E7490] focus:outline-none"
          >
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden absolute top-[110px] left-4 right-4 bg-white/95 backdrop-blur-xl border border-slate-200/60 rounded-3xl p-6 shadow-xl flex flex-col gap-4 animate-in fade-in slide-in-from-top-5 duration-350">
          {navItems.map((item) => (
            <button
              key={item.label}
              onClick={() => handleNavClick(item.sectionId, item.label)}
              className="text-left py-2.5 text-base font-semibold text-slate-700 border-b border-slate-100 hover:text-[#0E7490]"
            >
              {item.label}
            </button>
          ))}
          <Button
            variant="primary"
            onClick={() => {
              setMobileMenuOpen(false);
              navigate("/get-started");
            }}
            className="w-full mt-2 bg-[#0E7490] h-12 rounded-2xl font-bold"
          >
            Get Started
          </Button>
        </div>
      )}
    </nav>
  );
}
