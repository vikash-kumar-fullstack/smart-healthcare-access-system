import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  Heart,
  Search,
  MapPin,
  Hospital as HospitalIcon,
  Star,
  Clock,
  Users,
  ArrowRight,
  UserCheck,
  Stethoscope,
  BellRing,
  BarChart3,
  HelpCircle,
  Activity,
  Sparkles,
  AlertCircle,
  Play,
  CheckCircle2
} from "lucide-react";
import { getDashboardPath } from "../utils/auth";
import { recordEvent } from "../utils/experienceMetrics";

// Landing Components
import Button from "../components/landing/Button";
import SearchBar from "../components/landing/SearchBar";
import HospitalCard from "../components/landing/HospitalCard";
import Navbar from "../components/landing/Navbar";
import StatsCard from "../components/landing/StatsCard";
import Footer from "../components/landing/Footer";

// Assets
import hospital1 from "../assets/hospital_1.jpg";
import hospital2 from "../assets/hospital_2.jpg";

export default function Landing() {
  const navigate = useNavigate();
  const [symptom, setSymptom] = useState("");
  const [location, setLocation] = useState("");
  const [activeImgIndex, setActiveImgIndex] = useState(0);
  const [activeStep, setActiveStep] = useState(0);

  // Hover state for How It Works cards to trigger SVG path blinking
  const [hoveredStep, setHoveredStep] = useState(null);

  // Section Refs for scroll navigation
  const heroRef = useRef(null);
  const findHospitalRef = useRef(null);
  const doctorsRef = useRef(null);
  const queueDemoRef = useRef(null);
  const howItWorksRef = useRef(null);
  const featuresRef = useRef(null);

  // Auto transition for hospital images in Hero section (1-second crossfade)
  useEffect(() => {
    recordEvent("landing_mount");

    const interval = setInterval(() => {
      setActiveImgIndex((prev) => (prev === 0 ? 1 : 0));
    }, 4000);

    return () => clearInterval(interval);
  }, [navigate]);

  const handleScrollToSection = (sectionId) => {
    const refs = {
      hero: heroRef,
      "find-hospital": findHospitalRef,
      doctors: doctorsRef,
      "queue-demo": queueDemoRef,
      "how-it-works": howItWorksRef,
      features: featuresRef,
    };

    const targetRef = refs[sectionId];
    if (targetRef && targetRef.current) {
      targetRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const handleSearchSubmit = (searchParams) => {
    recordEvent("landing_search_attempt", searchParams);
    navigate(`/signup?symptom=${encodeURIComponent(searchParams.symptom)}&location=${encodeURIComponent(searchParams.location)}`);
  };

  const journeySteps = [
    {
      title: "Search Symptoms",
      number: "01",
      icon: Search,
      description: "Enter your symptoms (e.g., fever, chest pain). Our smart mapping logic recommends matching medical specializations instantly, ensuring you get directed to the correct care path.",
      tag: "CLINICAL TRIAGE"
    },
    {
      title: "Find Hospital",
      number: "02",
      icon: MapPin,
      description: "Discover partner healthcare centers, clinics, and emergency rooms nearest to your location, sorted dynamically by active queue length, estimated travel traffic, and patient feedback.",
      tag: "PROVIDER MATCH"
    },
    {
      title: "Reserve Slot",
      number: "03",
      icon: Clock,
      description: "Join the virtual queue by securing a digital token online. Reserve slots on-demand without spending hours sitting in physical waiting rooms.",
      tag: "QUEUE ENTRY"
    },
    {
      title: "Receive Reminder",
      number: "04",
      icon: BellRing,
      description: "Get real-time push alerts and SMS notifications. The system alerts you exactly when to start traveling based on live consultation speed updates.",
      tag: "LIVE ALERTS"
    },
    {
      title: "Check In",
      number: "05",
      icon: UserCheck,
      description: "Confirm your arrival on-site by checking in at the reception desk or scanning the counter QR code. The desk updates your status to active instantly.",
      tag: "DESK ARRIVAL"
    },
    {
      title: "Consultation",
      number: "06",
      icon: Stethoscope,
      description: "Walk directly to the doctor's room when your token is called. Your doctor has immediate access to your pre-consultation summary to speed up treatment.",
      tag: "DOCTOR CARE"
    },
    {
      title: "EMR Created",
      number: "07",
      icon: BarChart3,
      description: "Your prescriptions, clinical notes, and lab requests are securely saved into your digital health passport, accessible via password locks on any device.",
      tag: "HEALTH RECORD"
    }
  ];

  // Interactive Live Queue Demo Simulator State
  const initialQueue = [
    { name: "Amit Kumar", status: "Serving Now", active: true, eta: "0 min" },
    { name: "Priya Sharma", status: "Preparing next", active: false, eta: "6 min" },
    { name: "Rajesh Ranjan (You)", status: "Waiting", active: false, eta: "12 min" },
    { name: "Neha Singh", status: "Waiting", active: false, eta: "18 min" },
    { name: "Kunal Jha", status: "Waiting", active: false, eta: "24 min" },
  ];

  const [queue, setQueue] = useState(initialQueue);
  const [ticketPos, setTicketPos] = useState(3);
  const [etaVal, setEtaVal] = useState("12 min");
  const [simulationRound, setSimulationRound] = useState(0);

  const advanceSimulator = () => {
    recordEvent("landing_simulation_advance");
    if (queue.length <= 1 || ticketPos === 0) {
      // Reset simulator
      setQueue(initialQueue);
      setTicketPos(3);
      setEtaVal("12 min");
      setSimulationRound(0);
      return;
    }

    const updatedQueue = queue.slice(1).map((patient, idx) => {
      if (idx === 0) {
        return { ...patient, status: "Serving Now", active: true, eta: "0 min" };
      } else if (idx === 1) {
        return { ...patient, status: "Preparing next", active: false, eta: "6 min" };
      }
      return { ...patient, status: "Waiting", eta: `${(idx - 1) * 6} min` };
    });

    setQueue(updatedQueue);
    const newPos = Math.max(0, ticketPos - 1);
    setTicketPos(newPos);
    setEtaVal(newPos === 1 ? "6 min" : newPos === 0 ? "0 min (Calling...)" : `${newPos * 6} min`);
    setSimulationRound((prev) => prev + 1);
  };

  return (
    <div className="bg-[#F8FAFC] min-h-screen text-slate-800 antialiased overflow-x-hidden">
      
      {/* Inline styles for SVG path blinking animation */}
      <style>{`
        @keyframes timelineBlink {
          0%, 100% { opacity: 0.4; stroke: #0E7490; stroke-width: 3.5; }
          50% { opacity: 1; stroke: #14B8A6; stroke-width: 5.5; filter: drop-shadow(0 0 5px #14B8A6); }
        }
        .timeline-path-active {
          animation: timelineBlink 1s ease-in-out infinite;
        }
        @keyframes spiralBlink {
          0% {
            stroke-dashoffset: 64;
            stroke: #0e7490;
            stroke-width: 4.5;
            opacity: 0.6;
          }
          50% {
            stroke: #14B8A6;
            stroke-width: 6.5;
            opacity: 1;
            filter: drop-shadow(0 0 10px #14B8A6);
          }
          100% {
            stroke-dashoffset: 0;
            stroke: #0e7490;
            stroke-width: 4.5;
            opacity: 0.6;
          }
        }
        .timeline-spiral-path-active {
          animation: spiralBlink 2.2s linear infinite;
        }
        @keyframes heroTextReveal {
          0% {
            opacity: 0;
            transform: translateY(20px);
          }
          100% {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-hero-text-1 {
          animation: heroTextReveal 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          opacity: 0;
        }
        .animate-hero-text-2 {
          animation: heroTextReveal 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          animation-delay: 0.25s;
          opacity: 0;
        }
        .animate-hero-text-3 {
          animation: heroTextReveal 0.8s cubic-bezier(0.16, 1, 0.3, 1) forwards;
          animation-delay: 0.5s;
          opacity: 0;
        }
        @keyframes badgePulse {
          0%, 100% {
            transform: scale(1);
            box-shadow: 0 0 0 0 rgba(20, 184, 166, 0.2);
          }
          50% {
            transform: scale(1.04);
            box-shadow: 0 0 0 8px rgba(20, 184, 166, 0);
          }
        }
        .animate-badge {
          animation: badgePulse 3s infinite ease-in-out;
        }
      `}</style>

      {/* SECTION 1 — NAVBAR */}
      <Navbar onScrollToSection={handleScrollToSection} />

      {/* SECTION 2 — HERO */}
      <section
        ref={heroRef}
        className="relative min-h-[920px] pt-32 pb-20 flex items-center justify-center overflow-hidden bg-gradient-to-b from-[#E6FFFB]/40 via-white to-[#F8FAFC]"
      >
        {/* Soft blur backgrounds */}
        <div className="absolute top-20 left-10 w-[500px] h-[500px] bg-cyan-200/10 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-10 right-10 w-[600px] h-[600px] bg-teal-100/20 rounded-full blur-[150px] pointer-events-none" />

        <div className="max-w-7xl w-full mx-auto px-6 md:px-12 grid grid-cols-1 lg:grid-cols-12 gap-12 items-center z-10">
          
          {/* LEFT 55% CONTENT */}
          <div className="lg:col-span-7 flex flex-col items-start text-left gap-6">
            
            {/* Small Badge */}
            <span className="inline-flex items-center gap-1.5 px-5 py-2 rounded-full text-sm font-extrabold bg-[#DFF8F6] text-[#0E7490] animate-badge select-none border border-teal-200/50">
              <Sparkles className="h-4 w-4 animate-spin-slow text-[#14B8A6]" />
              SMART HEALTHCARE ACCESS SYSTEM
            </span>

            {/* Headline with high contrast explicit dark text and entrance animation */}
            <h1 className="text-5xl md:text-[68px] lg:text-[72px] font-semibold leading-[1.05] tracking-tight text-[#0F172A] select-none">
              <span className="block animate-hero-text-1">Healthcare Access.</span>
              <span className="block animate-hero-text-2 mt-2">
                <span className="bg-gradient-to-r from-[#0E7490] to-[#14B8A6] bg-clip-text text-transparent font-black">
                  Smarter.
                </span>{" "}
                Faster.
              </span>
              <span className="block animate-hero-text-3 mt-2 text-[#0E7490] font-black">
                Closer.
              </span>
            </h1>

            {/* Subheadline */}
            <p className="text-slate-650 text-lg md:text-xl font-medium max-w-[620px] leading-relaxed">
              Find hospitals instantly, view live queue estimates, and access healthcare with confidence. Skip long wait lines dynamically.
            </p>

            {/* Buttons */}
            <div className="flex flex-wrap items-center gap-4 mt-2">
              <Button
                variant="primary"
                onClick={() => navigate("/login")}
                className="bg-[#0E7490] text-white hover:bg-[#0c5f76] px-9 h-14 rounded-2xl font-black text-base shadow-md shadow-cyan-900/10 transition-transform duration-200 hover:scale-103"
              >
                Find Hospital
              </Button>
              <Button
                variant="secondary"
                onClick={() => handleScrollToSection("queue-demo")}
                className="flex items-center gap-2.5 border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 hover:border-slate-300 px-7 h-14 rounded-2xl font-black text-base transition-transform duration-200 hover:scale-103 shadow-sm"
              >
                <Play className="h-4.5 w-4.5 text-[#0E7490] fill-current" />
                Watch Demo
              </Button>
            </div>

            {/* HERO SEARCH BAR */}
            <div className="w-full mt-6">
              <SearchBar
                symptom={symptom}
                setSymptom={setSymptom}
                location={location}
                setLocation={setLocation}
                onSearch={handleSearchSubmit}
              />
              <p className="text-sm font-bold text-slate-500 mt-4 pl-2 flex items-center gap-1.5">
                <AlertCircle className="h-4 w-4 text-[#14B8A6]" />
                Try searching: <span className="underline cursor-pointer hover:text-[#0E7490]" onClick={() => setSymptom("Headache")}>Headache</span>,{" "}
                <span className="underline cursor-pointer hover:text-[#0E7490]" onClick={() => setLocation("Patna")}>Patna</span>
              </p>
            </div>

          </div>

          {/* RIGHT 45% COMPOSITION (SIGNATURE VISUAL) */}
          <div className="lg:col-span-5 relative flex justify-center items-center">
            
            {/* Ambient Background Gradient Circles */}
            <div className="absolute w-[440px] h-[440px] bg-gradient-to-tr from-[#E6FFFB] to-white rounded-full -z-10 shadow-inner blur-xl animate-pulse duration-4000" />
            
            {/* CENTER: Large phone mockup frame */}
            <div className="w-[320px] md:w-[360px] lg:w-[380px] h-[550px] md:h-[650px] lg:h-[700px] rounded-[40px] bg-slate-900 border-[8px] border-slate-850 shadow-2xl relative overflow-hidden flex-shrink-0 z-20">
              
              {/* Internal Screen Mockup */}
              <div className="relative h-full w-full bg-slate-50 p-4 flex flex-col gap-4 overflow-hidden select-none">
                
                {/* Status Bar */}
                <div className="flex justify-between items-center text-[10px] text-slate-400 px-3 py-1 font-semibold border-b border-slate-200/40">
                  <span>9:41 AM</span>
                  <div className="flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-emerald-700 font-bold">LIVE CONNECTION</span>
                  </div>
                </div>

                {/* Slideshow Hospital Images in Mockup Background (1-second transition) */}
                <div className="relative w-full h-[180px] md:h-[220px] rounded-2xl overflow-hidden shadow-inner shrink-0">
                  <img
                    src={hospital1}
                    alt="PMCH Building 1"
                    className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ease-in-out ${
                      activeImgIndex === 0 ? "opacity-100" : "opacity-0"
                    }`}
                  />
                  <img
                    src={hospital2}
                    alt="PMCH Building 2"
                    className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ease-in-out ${
                      activeImgIndex === 1 ? "opacity-100" : "opacity-0"
                    }`}
                  />
                  
                  {/* Subtle Gradient Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent flex items-end p-4">
                    <div className="text-white">
                      <p className="text-xs font-semibold uppercase tracking-wider text-[#14B8A6]">Live View</p>
                      <h6 className="text-sm font-bold truncate">MediHospi Partner Center</h6>
                    </div>
                  </div>
                </div>

                {/* Inside Mockup Hospital Card */}
                <div className="z-10 -mt-8 md:-mt-10">
                  <HospitalCard
                    name="PMCH (Partner Center)"
                    location="Ashok Rajpath, Patna"
                    queueTime="12 min"
                    doctorsAvailable={12}
                    className="shadow-md bg-white/95"
                    onClick={() => navigate("/get-started")}
                  />
                </div>

                {/* Patient Dashboard Preview Mockup Container */}
                <div className="flex flex-col gap-3.5 mt-1 overflow-y-auto max-h-[220px] pr-1">
                  <div className="bg-white p-3.5 rounded-xl border border-slate-200/50 shadow-sm">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">Active Session</span>
                      <span className="text-[9px] bg-cyan-50 text-[#0E7490] px-2 py-0.5 rounded-md font-semibold">TOKEN #234</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-teal-50 text-[#0E7490] flex items-center justify-center font-bold text-xs">
                          VK
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-850 leading-tight">Dr. Vikash Kumar</p>
                          <p className="text-[9px] text-slate-400">Cardiologist</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs font-extrabold text-[#0E7490]">ETA ~12 min</p>
                        <p className="text-[9px] text-slate-400">Position 2</p>
                      </div>
                    </div>
                  </div>
                </div>

              </div>
            </div>

            {/* FLOATING COMPOSITION CARDS OVER PHONE */}
            {/* TOP CARD: 92% Satisfaction */}
            <div className="absolute top-8 -left-10 md:-left-16 z-30 transform -rotate-3 hover:rotate-0 hover:-translate-y-1 transition-all duration-300 pointer-events-auto">
              <div className="bg-white/90 backdrop-blur-md px-4 py-3 rounded-2xl border border-white/40 shadow-xl flex items-center gap-3.5">
                <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-500 flex items-center justify-center">
                  <Heart className="h-5 w-5 fill-rose-500" />
                </div>
                <div>
                  <h6 className="text-xs font-black text-slate-900 leading-none font-bold">92%</h6>
                  <p className="text-[10px] font-bold text-slate-500 mt-1 uppercase tracking-wider">Satisfaction</p>
                </div>
              </div>
            </div>

            {/* RIGHT CARD: Nearest Hospital */}
            <div className="absolute right-[-40px] top-[30%] z-30 transform rotate-6 hover:rotate-0 hover:-translate-y-1 transition-all duration-300 pointer-events-auto">
              <div className="bg-white/90 backdrop-blur-md px-4 py-3 rounded-2xl border border-white/40 shadow-xl flex items-center gap-3.5">
                <div className="w-9 h-9 rounded-xl bg-cyan-50 text-[#0E7490] flex items-center justify-center">
                  <HospitalIcon className="h-5 w-5" />
                </div>
                <div>
                  <h6 className="text-xs font-black text-slate-900 leading-none font-bold">Nearest Care</h6>
                  <p className="text-[10px] font-bold text-slate-500 mt-1 uppercase tracking-wider">Within 1.2 Km</p>
                </div>
              </div>
            </div>

            {/* BOTTOM CARD: Live Queue */}
            <div className="absolute bottom-8 -right-8 md:-right-12 z-30 transform -rotate-6 hover:rotate-0 hover:-translate-y-1 transition-all duration-300 pointer-events-auto">
              <div className="bg-white/90 backdrop-blur-md px-4.5 py-3 rounded-2xl border border-white/40 shadow-xl flex items-center gap-3.5">
                <div className="w-9 h-9 rounded-xl bg-teal-50 text-[#14B8A6] flex items-center justify-center">
                  <Activity className="h-5 w-5" />
                </div>
                <div>
                  <h6 className="text-xs font-black text-slate-900 leading-none font-bold">Live Queue</h6>
                  <p className="text-[10px] font-bold text-slate-500 mt-1 uppercase tracking-wider">Instant booking</p>
                </div>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* SECTION 3 — TRUST STRIP */}
      <section className="bg-white py-12 border-y border-slate-200/50 shadow-sm relative overflow-hidden">
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 items-center min-h-[180px]">
            <StatsCard value="100+" label="Hospitals partnered" icon={HospitalIcon} />
            <StatsCard value="250+" label="Verified doctors" icon={Stethoscope} />
            <StatsCard value="5000+" label="Active patients" icon={Users} />
            <StatsCard value="98%" label="Queue prediction accuracy" icon={Clock} />
          </div>
        </div>
      </section>

      {/* SECTION 4 — HOW IT WORKS (INTERACTIVE 7-STEP HEALTHCARE JOURNEY TIMELINE) */}
      <section
        ref={howItWorksRef}
        className="py-24 bg-gradient-to-b from-[#F8FAFC] via-white to-[#F8FAFC] relative"
      >
        <div className="max-w-7xl mx-auto px-6 text-center">
          
          {/* Header */}
          <div className="max-w-2xl mx-auto mb-16">
            <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold bg-[#DFF8F6] text-[#0E7490] mb-4">
              <Activity className="h-3.5 w-3.5" />
              THE MEDHOSPI EXPERIENCE
            </span>
            <h2 className="text-3xl md:text-4xl font-extrabold text-[#0F172A] tracking-tight">
              Your Healthcare Journey in 7 Steps
            </h2>
            <p className="text-[#475569] mt-3.5 text-sm md:text-base leading-relaxed">
              MediHospi coordinates every single phase of your consultation cycle, eliminating traditional clinic delays.
            </p>
          </div>

          {/* Timeline Selector Nodes */}
          <div className="relative max-w-5xl mx-auto mb-20 select-none">
            
            {/* Desktop / Tablet view (md and up) - Horizontal Spiral Winding Wave */}
            <div className="hidden md:block relative w-full h-[280px] overflow-visible">
              
              {/* Spiral Winding SVG Line */}
              <div className="absolute inset-0 z-0 pointer-events-none">
                <svg className="w-full h-full overflow-visible" viewBox="0 0 1000 240" fill="none" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
                  {/* Glowing, blinking winding dotted path command */}
                  <path
                    d="M 50,120 C 150,15 250,225 350,120 C 450,15 550,225 650,120 C 750,15 850,225 950,120"
                    stroke={hoveredStep !== null ? "#14B8A6" : "#0E7490"}
                    strokeWidth="4"
                    strokeDasharray="8 8"
                    className={`transition-all duration-300 ${
                      hoveredStep !== null || activeStep !== null ? "timeline-spiral-path-active" : "opacity-45"
                    }`}
                  />
                </svg>
              </div>

              {/* Absolute coordinates positioned milestone nodes */}
              {journeySteps.map((step, idx) => {
                const StepIcon = step.icon;
                const isCompleted = idx < activeStep;
                const isActive = idx === activeStep;
                
                // Winding coordinates matching Bezier Peaks/Troughs
                const positions = [
                  { left: "5%", top: "120px" },
                  { left: "20%", top: "40px" },
                  { left: "35%", top: "200px" },
                  { left: "50%", top: "120px" },
                  { left: "65%", top: "40px" },
                  { left: "80%", top: "200px" },
                  { left: "95%", top: "120px" }
                ];
                
                const pos = positions[idx];

                return (
                  <div
                    key={step.title}
                    style={{ left: pos.left, top: pos.top }}
                    className="absolute -translate-x-1/2 -translate-y-1/2 z-10 flex flex-col items-center group"
                  >
                    {/* Node Circle Button */}
                    <button
                      onClick={() => {
                        setActiveStep(idx);
                        recordEvent("landing_journey_step_click", { step: step.title, index: idx });
                      }}
                      onMouseEnter={() => setHoveredStep(idx)}
                      onMouseLeave={() => setHoveredStep(null)}
                      className={`w-14 h-14 md:w-16 md:h-16 rounded-full flex items-center justify-center border-4 transition-all duration-[var(--transition-normal)] cursor-pointer shadow-md select-none hover:scale-115 hover:shadow-xl hover:shadow-teal-500/15 ${
                        isActive
                          ? "bg-[#14B8A6] border-white text-white scale-112 shadow-xl shadow-teal-500/20"
                          : isCompleted
                          ? "bg-teal-50 border-teal-200 text-[#0E7490]"
                          : "bg-white border-slate-200/80 text-slate-500 hover:border-slate-350"
                      }`}
                    >
                      <StepIcon className="w-6 h-6 md:w-7 md:h-7 transition-transform duration-[var(--transition-normal)]" />
                    </button>

                    {/* Step label underneath node */}
                    <div className="absolute top-[calc(100%+8px)] left-1/2 -translate-x-1/2 text-center pointer-events-none min-w-[140px]">
                      <span className="block text-[10px] font-black tracking-widest text-[#0E7490] uppercase opacity-75">
                        Step {step.number}
                      </span>
                      <span className={`block text-xs md:text-sm font-extrabold tracking-tight mt-0.5 transition-colors duration-[var(--transition-normal)] ${
                        isActive ? "text-[#14B8A6]" : "text-slate-800 group-hover:text-teal-600"
                      }`}>
                        {step.title}
                      </span>
                    </div>

                  </div>
                );
              })}

            </div>

            {/* Mobile / Small view - Vertical Timeline */}
            <div className="block md:hidden relative w-full space-y-6 text-left">
              {/* Vertical line indicator */}
              <div className="absolute left-6 top-3 bottom-3 w-0.5 border-l-2 border-dashed border-[#0E7490]/40 z-0 pointer-events-none" />

              {journeySteps.map((step, idx) => {
                const StepIcon = step.icon;
                const isCompleted = idx < activeStep;
                const isActive = idx === activeStep;

                return (
                  <button
                    key={step.title}
                    onClick={() => {
                      setActiveStep(idx);
                      recordEvent("landing_journey_step_click", { step: step.title, index: idx });
                    }}
                    className={`relative z-10 w-full flex items-start gap-4 p-4 rounded-2xl border text-left transition-all duration-[var(--transition-normal)] cursor-pointer ${
                      isActive
                        ? "bg-white border-[#14B8A6] shadow-md ring-2 ring-teal-500/5"
                        : "bg-white/80 border-slate-200/60 hover:bg-white"
                    }`}
                  >
                    {/* Circle Node */}
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 border-2 transition-all ${
                      isActive
                        ? "bg-[#14B8A6] border-white text-white shadow-md shadow-teal-500/10"
                        : isCompleted
                        ? "bg-teal-50 border-teal-200 text-[#0E7490]"
                        : "bg-slate-50 border-slate-200 text-slate-400"
                    }`}>
                      <StepIcon className="w-5 h-5" />
                    </div>

                    {/* Step Content */}
                    <div>
                      <span className="block text-[9px] font-black tracking-widest text-[#0E7490] uppercase opacity-75">
                        Step {step.number} • {step.tag}
                      </span>
                      <h4 className={`text-sm font-extrabold mt-0.5 ${isActive ? "text-[#14B8A6]" : "text-slate-800"}`}>
                        {step.title}
                      </h4>
                    </div>
                  </button>
                );
              })}
            </div>

          </div>

          {/* Selected Step Description Card */}
          <div className="max-w-4xl mx-auto bg-white rounded-3xl p-8 border border-slate-200/65 shadow-md flex flex-col md:flex-row items-center gap-8 text-left transition-all duration-[var(--transition-normal)]">
            
            {/* Step Visual Mockup (Left Side) */}
            <div className="w-full md:w-[40%] flex justify-center shrink-0">
              <div className="w-full max-w-[280px] bg-slate-50 border border-slate-200/40 rounded-2xl p-6 shadow-inner relative overflow-hidden select-none">
                
                {/* Step 1 Visual Mockup */}
                {activeStep === 0 && (
                  <div className="space-y-4 animate-in fade-in zoom-in-95 duration-[var(--transition-slow)]">
                    <div className="flex justify-between items-center border-b border-slate-200/40 pb-2">
                      <span className="text-[10px] text-slate-400 font-extrabold uppercase">Symptom Query</span>
                      <span className="w-2 h-2 rounded-full bg-teal-500" />
                    </div>
                    <div className="relative">
                      <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                      <input
                        type="text"
                        readOnly
                        value="Fever, cough, chest tightness"
                        className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-xs outline-none"
                      />
                    </div>
                    <div className="p-3 bg-[#DFF8F6]/40 border border-teal-100/50 rounded-xl">
                      <p className="text-[10px] font-black text-[#0E7490] uppercase">Suggested Specialty</p>
                      <p className="text-xs font-extrabold text-slate-700 mt-1">General Medicine / Pulmonology</p>
                    </div>
                  </div>
                )}

                {/* Step 2 Visual Mockup */}
                {activeStep === 1 && (
                  <div className="space-y-4 animate-in fade-in zoom-in-95 duration-[var(--transition-slow)]">
                    <div className="flex justify-between items-center border-b border-slate-200/40 pb-2">
                      <span className="text-[10px] text-slate-400 font-extrabold uppercase">Hospital Match</span>
                      <span className="w-2 h-2 rounded-full bg-teal-500" />
                    </div>
                    <div className="bg-white p-3 border border-slate-100 rounded-xl shadow-sm">
                      <h5 className="text-xs font-extrabold text-slate-800">AIIMS Delhi</h5>
                      <p className="text-[9px] text-slate-400">1.8 Km away • New Delhi</p>
                      <div className="flex justify-between items-center mt-3 pt-2 border-t border-slate-50">
                        <span className="text-[9px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-md font-bold">12 MIN WAIT</span>
                        <span className="text-[9px] text-slate-500 font-semibold">14 Doctors Active</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 3 Visual Mockup */}
                {activeStep === 2 && (
                  <div className="space-y-4 animate-in fade-in zoom-in-95 duration-[var(--transition-slow)]">
                    <div className="flex justify-between items-center border-b border-slate-200/40 pb-2">
                      <span className="text-[10px] text-slate-400 font-extrabold uppercase">Token Ticket</span>
                      <span className="w-2 h-2 rounded-full bg-teal-500" />
                    </div>
                    <div className="bg-gradient-to-br from-[#0e7490] to-[#14b8a6] text-white p-4 rounded-2xl shadow-md text-center">
                      <span className="text-[9px] font-black bg-white/20 px-2.5 py-0.5 rounded-full uppercase tracking-wider">RESERVATION CONFIRMED</span>
                      <h4 className="text-2xl font-black mt-2 leading-none"># MH-0043</h4>
                      <p className="text-[10px] text-teal-50/80 mt-1.5">Position in Line: 3</p>
                    </div>
                  </div>
                )}

                {/* Step 4 Visual Mockup */}
                {activeStep === 3 && (
                  <div className="space-y-3 animate-in fade-in zoom-in-95 duration-[var(--transition-slow)]">
                    <div className="flex justify-between items-center border-b border-slate-200/40 pb-2">
                      <span className="text-[10px] text-slate-400 font-extrabold uppercase">Smart Push Alert</span>
                      <span className="w-2 h-2 rounded-full bg-teal-500" />
                    </div>
                    <div className="bg-white p-3 border border-slate-100 rounded-xl shadow-sm flex items-start gap-2">
                      <div className="w-7 h-7 rounded-lg bg-[#DFF8F6] text-[#0E7490] flex items-center justify-center shrink-0">
                        <BellRing className="w-4 h-4" />
                      </div>
                      <div>
                        <h6 className="text-[10px] font-extrabold text-slate-800">Time to leave!</h6>
                        <p className="text-[9px] text-slate-500 leading-normal mt-0.5">Your turn is expected in 15 mins. Please check-in upon arrival.</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 5 Visual Mockup */}
                {activeStep === 4 && (
                  <div className="space-y-3 animate-in fade-in zoom-in-95 duration-[var(--transition-slow)]">
                    <div className="flex justify-between items-center border-b border-slate-200/40 pb-2">
                      <span className="text-[10px] text-slate-400 font-extrabold uppercase">QR Counter Scan</span>
                      <span className="w-2 h-2 rounded-full bg-teal-500" />
                    </div>
                    <div className="bg-white p-3 border border-slate-100 rounded-xl shadow-sm flex flex-col items-center gap-2">
                      <div className="w-24 h-24 bg-slate-100 rounded-lg flex items-center justify-center font-bold text-xs border border-slate-200">
                        [ QR SCANNER ]
                      </div>
                      <span className="text-[9px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-extrabold uppercase">CHECKED-IN DESK #2</span>
                    </div>
                  </div>
                )}

                {/* Step 6 Visual Mockup */}
                {activeStep === 5 && (
                  <div className="space-y-4 animate-in fade-in zoom-in-95 duration-[var(--transition-slow)]">
                    <div className="flex justify-between items-center border-b border-slate-200/40 pb-2">
                      <span className="text-[10px] text-slate-400 font-extrabold uppercase">Active Session</span>
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    </div>
                    <div className="bg-white p-3 border border-slate-100 rounded-xl shadow-sm">
                      <p className="text-[9px] text-[#0e7490] font-black uppercase">Dr. Vikash Kumar</p>
                      <h6 className="text-xs font-bold text-slate-800 mt-0.5">Consultation Workspace</h6>
                      <div className="mt-3 py-1.5 px-2.5 bg-slate-50 rounded-lg text-[9px] text-slate-500 leading-relaxed">
                        Arrived: 12:45 • Duration: 8m
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 7 Visual Mockup */}
                {activeStep === 6 && (
                  <div className="space-y-4 animate-in fade-in zoom-in-95 duration-[var(--transition-slow)]">
                    <div className="flex justify-between items-center border-b border-slate-200/40 pb-2">
                      <span className="text-[10px] text-slate-400 font-extrabold uppercase">Health Record Passport</span>
                      <span className="w-2 h-2 rounded-full bg-teal-500" />
                    </div>
                    <div className="bg-white p-3 border border-slate-150 rounded-xl shadow-sm space-y-2">
                      <div className="flex items-center justify-between text-[9px] font-bold text-slate-600">
                        <span>Clinical Note</span>
                        <span className="text-emerald-600 font-extrabold">SAVED</span>
                      </div>
                      <div className="h-1 bg-emerald-500 rounded-full w-full" />
                      <p className="text-[9px] text-slate-400">Prescription: Tab. Paracetamol 650mg</p>
                    </div>
                  </div>
                )}

              </div>
            </div>

            {/* Step Description Detail (Right Side) */}
            <div className="flex-1 space-y-4">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-black tracking-wider uppercase bg-[#E6FFFB] text-[#0E7490] border border-teal-200/50">
                {journeySteps[activeStep].tag}
              </span>
              <div className="flex justify-between items-baseline">
                <h3 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight leading-none">
                  {journeySteps[activeStep].title}
                </h3>
                <span className="text-sm text-slate-400 font-semibold">
                  Step {activeStep + 1} of 7
                </span>
              </div>
              <p className="text-sm md:text-base text-slate-650 leading-relaxed">
                {journeySteps[activeStep].description}
              </p>
              
              {/* Pagination controls */}
              <div className="flex items-center gap-3 pt-4">
                <button
                  disabled={activeStep === 0}
                  onClick={() => {
                    setActiveStep(p => Math.max(0, p - 1));
                    recordEvent("landing_journey_back_click", { activeStep: activeStep - 1 });
                  }}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-600 hover:bg-slate-50 disabled:opacity-45 disabled:pointer-events-none cursor-pointer"
                >
                  Previous
                </button>
                <button
                  disabled={activeStep === journeySteps.length - 1}
                  onClick={() => {
                    setActiveStep(p => Math.min(journeySteps.length - 1, p + 1));
                    recordEvent("landing_journey_next_click", { activeStep: activeStep + 1 });
                  }}
                  className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-[#14B8A6] hover:bg-[#0f8b7d] disabled:opacity-45 disabled:pointer-events-none cursor-pointer"
                >
                  Next Step
                </button>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* SECTION 5 — BENTO FEATURE GRID */}
      <section
        ref={featuresRef}
        className="py-24 bg-white border-y border-slate-200/50"
      >
        <div className="max-w-7xl mx-auto px-6">
          
          {/* Header */}
          <div className="text-center max-w-2xl mx-auto mb-16">
            <h2 className="text-3xl md:text-4xl font-extrabold text-[#0F172A] tracking-tight">
              Fully Integrated Healthcare Features
            </h2>
            <p className="text-slate-500 mt-3.5 text-sm md:text-base">
              A comprehensive system built to coordinate live medical appointments, analytics, and queues.
            </p>
          </div>

          {/* Bento-Style Grid Layout */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            
            {/* Bento Card 1 (Large - Spans 2 Columns on desktop) */}
            <div className="lg:col-span-2 bg-[#F8FAFC] p-8 rounded-[24px] border border-slate-250/30 hover:bg-slate-50/80 hover:border-[#14B8A6]/20 hover:shadow-lg transition-all duration-[var(--transition-normal)] flex flex-col md:flex-row items-center gap-8 group">
              <div className="flex-1 text-left space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-[#DFF8F6] text-[#0E7490] flex items-center justify-center shrink-0 group-hover:bg-[#0E7490] group-hover:text-white transition-all duration-[var(--transition-normal)]">
                  <Clock className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="text-lg font-extrabold text-[#0F172A]">⏱ Live Queue Prediction</h4>
                  <p className="text-sm text-[#475569] mt-2.5 leading-relaxed">
                    Avoid static guesswork. We estimate wait durations utilizing real-time treatment speeds and patient history loads. As the doctor updates visits, times are recalculated instantly.
                  </p>
                </div>
              </div>
              
              {/* Graphic element for Bento Card */}
              <div className="w-full max-w-[240px] bg-white border border-slate-200/60 p-4 rounded-2xl shadow-sm text-left">
                <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold mb-3 uppercase">Wait Estimates</div>
                <div className="space-y-2">
                  <div className="flex justify-between text-xs text-slate-700">
                    <span>Average Wait</span>
                    <span className="font-bold text-[#14B8A6]">12 min</span>
                  </div>
                  <div className="w-full bg-slate-100 rounded-full h-1.5">
                    <div className="bg-[#14B8A6] h-full rounded-full w-[45%]" />
                  </div>
                  <div className="flex justify-between text-xs text-slate-700 pt-1">
                    <span>Peak Hours</span>
                    <span className="font-bold text-amber-500">10:00 - 12:00</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Bento Card 2 (Standard) */}
            <div className="bg-[#F8FAFC] p-8 rounded-[24px] border border-slate-250/30 hover:bg-slate-50/80 hover:border-[#14B8A6]/20 hover:shadow-lg transition-all duration-[var(--transition-normal)] flex flex-col items-start gap-4 group text-left">
              <div className="w-12 h-12 rounded-2xl bg-[#DFF8F6] text-[#0E7490] flex items-center justify-center shrink-0 group-hover:bg-[#0E7490] group-hover:text-white transition-all duration-[var(--transition-normal)]">
                <Search className="h-6 w-6" />
              </div>
              <div>
                <h4 className="text-base font-extrabold text-[#0F172A]">🧠 Symptom Triage</h4>
                <p className="text-sm text-[#475569] mt-2 leading-relaxed">
                  Enter how you feel. Our smart algorithm maps symptoms to correct specializations, recommending matching clinical care.
                </p>
              </div>
            </div>

            {/* Bento Card 3 (Standard) */}
            <div className="bg-[#F8FAFC] p-8 rounded-[24px] border border-slate-250/30 hover:bg-slate-50/80 hover:border-[#14B8A6]/20 hover:shadow-lg transition-all duration-[var(--transition-normal)] flex flex-col items-start gap-4 group text-left">
              <div className="w-12 h-12 rounded-2xl bg-[#DFF8F6] text-[#0E7490] flex items-center justify-center shrink-0 group-hover:bg-[#0E7490] group-hover:text-white transition-all duration-[var(--transition-normal)]">
                <Stethoscope className="h-6 w-6" />
              </div>
              <div>
                <h4 className="text-base font-extrabold text-[#0F172A]">👨‍⚕️ Doctor Availability</h4>
                <p className="text-sm text-[#475569] mt-2 leading-relaxed">
                  View if doctors are active, on a short break, or delayed. Synchronized session updates avoid clinic trip mistakes.
                </p>
              </div>
            </div>

            {/* Bento Card 4 (Large - Spans 2 Columns on desktop) */}
            <div className="lg:col-span-2 bg-[#F8FAFC] p-8 rounded-[24px] border border-slate-250/30 hover:bg-slate-50/80 hover:border-[#14B8A6]/20 hover:shadow-lg transition-all duration-[var(--transition-normal)] flex flex-col md:flex-row items-center gap-8 group">
              <div className="flex-1 text-left space-y-4">
                <div className="w-12 h-12 rounded-2xl bg-[#DFF8F6] text-[#0E7490] flex items-center justify-center shrink-0 group-hover:bg-[#0E7490] group-hover:text-white transition-all duration-[var(--transition-normal)]">
                  <BarChart3 className="h-6 w-6" />
                </div>
                <div>
                  <h4 className="text-lg font-extrabold text-[#0F172A]">📊 Advanced BI Analytics</h4>
                  <p className="text-sm text-[#475569] mt-2.5 leading-relaxed">
                    Observe peak patient trends, typical wait times, operational audits, and clinic metrics for optimized hospital staffing. Built upon an isolated reporting data warehouse.
                  </p>
                </div>
              </div>
              
              {/* Graphic element for Bento Card */}
              <div className="w-full max-w-[240px] bg-white border border-slate-200/60 p-4 rounded-2xl shadow-sm text-left">
                <div className="flex justify-between items-center text-[10px] text-slate-400 font-bold mb-3 uppercase">Doctor Utilization</div>
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full bg-teal-50 flex items-center justify-center font-bold text-xs text-[#14B8A6]">94%</div>
                  <div>
                    <p className="text-xs font-bold text-slate-800">Peak Efficiency</p>
                    <p className="text-[9px] text-slate-400">System average today</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Bento Card 5 (Standard) */}
            <div className="bg-[#F8FAFC] p-8 rounded-[24px] border border-slate-250/30 hover:bg-slate-50/80 hover:border-[#14B8A6]/20 hover:shadow-lg transition-all duration-[var(--transition-normal)] flex flex-col items-start gap-4 group text-left">
              <div className="w-12 h-12 rounded-2xl bg-[#DFF8F6] text-[#0E7490] flex items-center justify-center shrink-0 group-hover:bg-[#0E7490] group-hover:text-white transition-all duration-[var(--transition-normal)]">
                <BellRing className="h-6 w-6" />
              </div>
              <div>
                <h4 className="text-base font-extrabold text-[#0F172A]">🔔 Realtime Alerts</h4>
                <p className="text-sm text-[#475569] mt-2 leading-relaxed">
                  Get notified when a doctor checks in, starts queue shifts, pauses consultations, or when your turn is close.
                </p>
              </div>
            </div>

          </div>

        </div>
      </section>

      {/* SECTION 6 — LIVE QUEUE DEMO (REAL CLINICAL DISPLAY PANEL OVERHAUL) */}
      <section
        ref={queueDemoRef}
        className="py-24 bg-gradient-to-b from-[#F8FAFC] via-white to-white relative overflow-hidden"
      >
        <div className="max-w-7xl mx-auto px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
            
            {/* LEFT SIDE: Realistic Clinic Queue Display Board */}
            <div className="lg:col-span-6 flex flex-col gap-6 order-2 lg:order-1">
              
              {/* Overhauled to clean medical visual boarding layout */}
              <div className="bg-white rounded-3xl p-6 shadow-[0_15px_40px_rgba(0,0,0,0.05)] border border-slate-200/80 text-slate-800 relative">
                
                {/* Board header */}
                <div className="flex justify-between items-center pb-4 border-b border-slate-100 mb-6">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs font-bold text-[#0E7490] uppercase tracking-wider">LIVE CLINICAL BOARD</span>
                  </div>
                  <span className="text-xs text-slate-450 font-semibold">Consultation Room 4</span>
                </div>

                {/* Patient Rows inside Simulator */}
                <div className="flex flex-col gap-3">
                  {queue.map((patient, index) => {
                    const isUser = patient.name.includes("(You)");
                    return (
                      <div
                        key={patient.name}
                        className={`flex items-center justify-between p-4 rounded-xl border transition-all duration-500 ${
                          patient.active
                            ? "bg-emerald-50/60 border-emerald-200/80 shadow-sm"
                            : isUser
                            ? "bg-cyan-50/70 border-cyan-200"
                            : "bg-slate-50 border-slate-100"
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className={`text-xs font-bold w-5 ${patient.active ? "text-emerald-700" : isUser ? "text-[#0E7490]" : "text-slate-400"}`}>
                            #{index + 1}
                          </span>
                          <div>
                            <p className={`text-xs font-bold ${patient.active ? "text-emerald-900" : isUser ? "text-[#0E7490]" : "text-slate-700"}`}>
                              {patient.name}
                            </p>
                            <p className="text-[10px] text-slate-400 mt-0.5 uppercase tracking-wide font-semibold">
                              {patient.status}
                            </p>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          {patient.active ? (
                            <span className="text-[9px] bg-emerald-100/60 text-emerald-800 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider">
                              IN CONSULTATION
                            </span>
                          ) : isUser ? (
                            <span className="text-[9px] bg-cyan-100/60 text-[#0E7490] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider animate-pulse">
                              NEXT IN LINE
                            </span>
                          ) : (
                            <span className="text-xs text-slate-500 font-bold">{patient.eta}</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Simulation Control Console */}
                <div className="mt-6 pt-4 border-t border-slate-100 flex justify-between items-center flex-wrap gap-4">
                  <div className="text-left">
                    <p className="text-[10px] text-slate-400 uppercase font-semibold">Your Live Spot</p>
                    <div className="flex items-baseline gap-1 mt-1">
                      <span className="text-lg font-black text-slate-800">
                        {ticketPos > 0 ? `Position ${ticketPos}` : "Called"}
                      </span>
                      <span className="text-xs text-[#0E7490] font-bold">({etaVal})</span>
                    </div>
                  </div>

                  <Button
                    onClick={advanceSimulator}
                    className="h-10 px-4 rounded-xl bg-[#0E7490] hover:bg-[#0c5f76] text-white font-bold text-xs"
                  >
                    {ticketPos === 0 ? "Reset Simulator" : "Simulate Turn Advance ⚡"}
                  </Button>
                </div>

              </div>

            </div>

            {/* RIGHT SIDE: Explanation */}
            <div className="lg:col-span-6 flex flex-col items-start text-left gap-6 order-1 lg:order-2">
              <span className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-xs font-bold bg-[#DFF8F6] text-[#0E7490]">
                <Activity className="h-3.5 w-3.5" />
                QUEUE VISUALIZATION
              </span>
              <h2 className="text-3xl md:text-4xl font-extrabold text-[#0F172A] tracking-tight">
                Watch Live Queue Shifts in Real-Time
              </h2>
              <p className="text-slate-500 text-sm md:text-base leading-relaxed">
                Experience how MediHospi coordinates active doctor check-ins and adjusts patient wait ETAs dynamically. 
                As the doctor completes a visit, the simulator shifts patients and triggers alerts instantly!
              </p>
              
              <div className="flex flex-col gap-4 w-full">
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 mt-0.5">
                    <UserCheck className="h-4 w-4" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-slate-850">Dynamic Turn Shifting</h5>
                    <p className="text-[11px] text-slate-500 mt-1 leading-normal">
                      When a patient is admitted, wait times shift down, keeping appointments synced.
                    </p>
                  </div>
                </div>

                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-cyan-50 text-[#0E7490] flex items-center justify-center shrink-0 mt-0.5">
                    <BellRing className="h-4 w-4" />
                  </div>
                  <div>
                    <h5 className="text-xs font-bold text-slate-850">Instant Alert Dispatch</h5>
                    <p className="text-[11px] text-slate-500 mt-1 leading-normal">
                      Receive alerts on your device when you move to position 2 ("Preparing") or when the doctor calls you.
                    </p>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* SECTION 7 — CTA (DARK STYLE) */}
      <section className="bg-[#0F172A] text-white py-20 relative overflow-hidden">
        {/* Glow accent */}
        <div className="absolute right-0 bottom-0 w-96 h-96 bg-[#14B8A6]/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute left-1/3 top-0 w-80 h-80 bg-[#0E7490]/5 rounded-full blur-2xl pointer-events-none" />

        <div className="max-w-4xl mx-auto text-center px-6 flex flex-col items-center gap-6">
          <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight">
            Healthcare Should Not Wait.
          </h2>
          <p className="text-slate-400 text-sm md:text-base max-w-xl leading-relaxed">
            Take control of your hospital consultations today. Discover clinics, observe queues, and join virtual lists with confidence.
          </p>
          <Button
            variant="accent"
            onClick={() => navigate("/get-started")}
            className="bg-[#14B8A6] text-slate-950 font-bold hover:bg-[#0f8b7d] hover:text-white px-8 h-12 rounded-[16px] mt-2 shadow-lg shadow-teal-900/20"
          >
            Start Now
          </Button>
        </div>
      </section>

      {/* FOOTER SECTION */}
      <Footer onScrollToSection={handleScrollToSection} />
    </div>
  );
}
