import React from "react";
import {
  Calendar,
  Bell,
  MapPin,
  UserCheck,
  Clock,
  Stethoscope,
  FileText,
  Activity,
  Heart,
  CheckCircle2
} from "lucide-react";

const PatientJourneyTracker = React.memo(function PatientJourneyTracker({ activeStep = 0, hoveredStep = null, setHoveredStep = () => {} }) {
  const steps = [
    { title: "Booked", icon: Calendar, tag: "BOOKED" },
    { title: "Confirmed", icon: CheckCircle2, tag: "CONFIRMED" },
    { title: "Reminder Sent", icon: Bell, tag: "REMINDER" },
    { title: "Travel to Hospital", icon: MapPin, tag: "TRAVEL" },
    { title: "Check-in", icon: UserCheck, tag: "CHECK_IN" },
    { title: "Queue", icon: Clock, tag: "QUEUE" },
    { title: "Consultation", icon: Stethoscope, tag: "CONSULTATION" },
    { title: "Prescription", icon: FileText, tag: "PRESCRIPTION" },
    { title: "Reports", icon: Activity, tag: "REPORTS" },
    { title: "Follow-up", icon: Heart, tag: "FOLLOW_UP" }
  ];

  return (
    <div className="bg-white p-6 rounded-[20px] border border-slate-200/60 shadow-sm text-left relative overflow-hidden select-none">
      <div className="flex justify-between items-center mb-6">
        <h4 className="text-lg font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-[#14B8A6] animate-pulse" />
          Today's Healthcare Journey
        </h4>
        <span className="text-xs text-slate-400 font-bold">
          Step {activeStep + 1} of {steps.length}
        </span>
      </div>

      {/* Desktop horizontal layout */}
      <div className="hidden lg:flex justify-between items-start max-w-full overflow-x-auto py-2">
        <div className="absolute top-[28px] left-[32px] right-[32px] h-1 bg-slate-100 -z-0" />
        <div
          className="absolute top-[28px] left-[32px] h-1 bg-gradient-to-r from-[#0F4C81] to-[#14B8A6] transition-all duration-700 ease-in-out -z-0"
          style={{ width: `${(activeStep / (steps.length - 1)) * 88}%` }}
        />

        {steps.map((step, idx) => {
          const StepIcon = step.icon;
          const isCompleted = idx < activeStep;
          const isActive = idx === activeStep;
          const isHovered = idx === hoveredStep;

          return (
            <div
              key={step.title}
              className="flex flex-col items-center flex-1 min-w-[70px] relative z-10 cursor-pointer transition-transform duration-300"
              style={{
                transform: isActive || isHovered ? "scale(1.08)" : "scale(1)",
              }}
              onMouseEnter={() => setHoveredStep(idx)}
              onMouseLeave={() => setHoveredStep(null)}
            >
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all duration-500 ${
                  isCompleted
                    ? "bg-[#0F4C81] border-[#0F4C81] text-white shadow-md shadow-[#0F4C81]/10"
                    : isActive
                    ? "bg-white border-[#14B8A6] text-[#14B8A6] shadow-lg shadow-[#14B8A6]/20 ring-4 ring-[#14B8A6]/10"
                    : "bg-white border-slate-200 text-slate-400 hover:border-slate-350"
                }`}
              >
                <StepIcon className="w-5 h-5" />
              </div>
              <span
                className={`text-[9px] font-extrabold mt-3.5 text-center tracking-tight transition-colors duration-300 max-w-[64px] ${
                  isActive
                    ? "text-[#14B8A6]"
                    : isCompleted
                    ? "text-[#0F4C81] font-bold"
                    : "text-slate-400"
                }`}
              >
                {step.title}
              </span>
            </div>
          );
        })}
      </div>

      {/* Mobile / Tablet vertical layout */}
      <div className="block lg:hidden relative w-full space-y-4">
        <div className="absolute left-5 top-2 bottom-2 w-0.5 border-l-2 border-dashed border-[#0E7490]/40 z-0 pointer-events-none" />

        {steps.map((step, idx) => {
          const StepIcon = step.icon;
          const isCompleted = idx < activeStep;
          const isActive = idx === activeStep;

          return (
            <div
              key={step.title}
              className={`relative z-10 w-full flex items-center gap-3.5 p-3 rounded-xl border transition-all duration-300 ${
                isActive ? "bg-[#14B8A6]/5 border-[#14B8A6]/20 shadow-sm" : "bg-white border-transparent"
              }`}
            >
              <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 border transition-all ${
                isActive
                  ? "bg-[#14B8A6] border-white text-white shadow-md shadow-teal-500/10"
                  : isCompleted
                  ? "bg-teal-50 border-teal-150 text-[#0E7490]"
                  : "bg-slate-50 border-slate-200 text-slate-400"
              }`}>
                <StepIcon className="w-4.5 h-4.5" />
              </div>
              <div className="text-left">
                <span className="block text-[8px] font-black tracking-widest text-[#0E7490] uppercase opacity-75">
                  {step.tag}
                </span>
                <span className={`block text-xs font-extrabold tracking-tight ${isActive ? "text-[#14B8A6]" : "text-slate-700"}`}>
                  {step.title}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Time reminder badges displayed dynamically when Confirmed is active */}
      {activeStep >= 1 && (
        <div className="mt-6 p-4 bg-slate-50 border border-slate-100 rounded-2xl flex flex-wrap items-center justify-center gap-3">
          <span className="text-xs font-bold text-slate-500 mr-2">Reminder Badges:</span>
          <span className="flex items-center gap-1.5 bg-green-50 text-green-700 px-3 py-1 rounded-full text-[10px] font-bold border border-green-100">
            <CheckCircle2 className="w-3.5 h-3.5" /> 24 hours reminder
          </span>
          <span className="flex items-center gap-1.5 bg-green-50 text-green-700 px-3 py-1 rounded-full text-[10px] font-bold border border-green-100">
            <CheckCircle2 className="w-3.5 h-3.5" /> 1 hour reminder
          </span>
          <span className="flex items-center gap-1.5 bg-green-50 text-green-700 px-3 py-1 rounded-full text-[10px] font-bold border border-green-100">
            <CheckCircle2 className="w-3.5 h-3.5" /> 30 minutes reminder
          </span>
          <span className="flex items-center gap-1.5 bg-green-50 text-green-700 px-3 py-1 rounded-full text-[10px] font-bold border border-green-100">
            <CheckCircle2 className="w-3.5 h-3.5" /> 10 minutes reminder
          </span>
        </div>
      )}
    </div>
  );
});

export default PatientJourneyTracker;
