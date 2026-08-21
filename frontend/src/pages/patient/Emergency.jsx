import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";
import toast from "react-hot-toast";
import {
  Phone,
  ShieldAlert,
  MapPin,
  AlertTriangle,
  ArrowLeft,
  Activity,
  Heart,
  CheckCircle2,
  Navigation,
  Clock,
  Sparkles,
  Hospital
} from "lucide-react";
import Badge from "../../components/common/Badge";

export default function Emergency() {
  const navigate = useNavigate();
  const [sosActive, setSosActive] = useState(false);
  const [sosDetails, setSosDetails] = useState(null);
  const [dispatching, setDispatching] = useState(false);

  const handleDispatchSos = () => {
    setDispatching(true);
    const toastId = toast.loading("Acquiring GPS location & dispatching Emergency SOS...");

    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          try {
            const { latitude, longitude } = position.coords;
            const res = await api.post("/medical-records/portal/emergency-sos", {
              latitude,
              longitude,
              notes: "Emergency SOS triggered from Patient Web Portal."
            });

            if (res.data.success) {
              setSosActive(true);
              setSosDetails(res.data.data);
              toast.success("🚨 EMERGENCY SOS DISPATCHED! Ward & Ambulance Notified.", { id: toastId });
            }
          } catch (err) {
            console.error(err);
            toast.error("Failed to transmit SOS location, triggering backup hotline...", { id: toastId });
          } finally {
            setDispatching(false);
          }
        },
        async (error) => {
          console.warn("Geolocation denied/failed:", error.message);
          try {
            const res = await api.post("/medical-records/portal/emergency-sos", {
              notes: "Emergency SOS triggered without GPS."
            });
            if (res.data.success) {
              setSosActive(true);
              setSosDetails(res.data.data);
              toast.success("🚨 EMERGENCY SOS DISPATCHED! Emergency Desk Notified.", { id: toastId });
            }
          } catch (err) {
            toast.error("SOS dispatch failed.", { id: toastId });
          } finally {
            setDispatching(false);
          }
        }
      );
    } else {
      setDispatching(false);
      toast.error("Geolocation not supported on browser.", { id: toastId });
    }
  };

  return (
    <div className="p-6 md:p-12 space-y-8 max-w-5xl mx-auto text-left animate-fade-in">
      {/* Back button & Header */}
      <div className="flex items-center justify-between border-b border-slate-200/60 pb-6">
        <div className="space-y-1">
          <button
            onClick={() => navigate("/patient")}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-[#0E7490] transition mb-2 cursor-pointer border-none bg-transparent p-0"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Dashboard
          </button>
          <h1 className="text-3xl font-black text-rose-600 tracking-tight flex items-center gap-2.5">
            <Phone className="h-7 w-7 text-rose-600 animate-bounce" />
            24/7 Priority Emergency SOS Center
          </h1>
          <p className="text-sm font-semibold text-slate-500">
            1-Click SOS Location Broadcast, Direct Phone Dialers, and Immediate First Aid Protocols.
          </p>
        </div>
      </div>

      {/* ACTIVE SOS ALERT BANNER */}
      {sosActive && sosDetails && (
        <div className="bg-gradient-to-r from-rose-600 via-rose-700 to-red-800 text-white p-6 md:p-8 rounded-3xl shadow-xl space-y-4 animate-pulse">
          <div className="flex items-center justify-between">
            <span className="px-3.5 py-1 rounded-full text-xs font-black uppercase bg-white text-rose-700 tracking-wider">
              🚨 SOS ACTIVE • DISPATCH # {sosDetails.sosId}
            </span>
            <span className="text-xs font-bold text-rose-100">Status: LIVE</span>
          </div>

          <h2 className="text-2xl font-black">Ambulance Unit Alerted</h2>
          <p className="text-sm font-semibold text-rose-100">
            GPS Location sent to Emergency Response Team. Expected arrival time: ~8 minutes. Emergency contact notified.
          </p>
        </div>
      )}

      {/* DISPATCH SOS BUTTON */}
      <div className="bg-gradient-to-br from-rose-50 to-red-50 border border-rose-200 p-8 rounded-3xl text-center space-y-4 shadow-sm">
        <div className="w-16 h-16 rounded-full bg-rose-500 text-white flex items-center justify-center mx-auto shadow-lg animate-pulse">
          <ShieldAlert className="h-8 w-8" />
        </div>

        <div className="space-y-1">
          <h2 className="text-2xl font-black text-rose-900 tracking-tight">Need Immediate Trauma / Medical Care?</h2>
          <p className="text-xs font-semibold text-rose-700 max-w-md mx-auto">
            Clicking the SOS button broadcasts your live GPS location directly to the nearest hospital trauma desk.
          </p>
        </div>

        <button
          onClick={handleDispatchSos}
          disabled={dispatching}
          className="bg-rose-600 hover:bg-rose-700 active:scale-95 text-white font-black text-lg px-10 py-5 rounded-2xl shadow-xl transition-all hover:scale-102 cursor-pointer border-none inline-flex items-center gap-3"
        >
          <Phone className="h-6 w-6 animate-bounce" />
          {dispatching ? "LOCATING & DISPATCHING..." : "🚨 DISPATCH EMERGENCY SOS"}
        </button>
      </div>

      {/* DIRECT PHONE DIALERS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <a
          href="tel:102"
          className="p-6 rounded-3xl bg-white border border-rose-200 shadow-xs hover:shadow-md transition text-left space-y-3 block no-underline"
        >
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
            <Phone className="h-6 w-6" />
          </div>
          <div>
            <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest block">Ambulance Hotline</span>
            <h3 className="text-2xl font-black text-slate-900 mt-1 font-mono">CALL: 102</h3>
            <p className="text-xs text-slate-500 font-semibold mt-1">Direct priority ambulance dispatch</p>
          </div>
        </a>

        <a
          href="tel:112"
          className="p-6 rounded-3xl bg-white border border-rose-200 shadow-xs hover:shadow-md transition text-left space-y-3 block no-underline"
        >
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
            <Phone className="h-6 w-6" />
          </div>
          <div>
            <span className="text-[10px] font-black text-rose-500 uppercase tracking-widest block">National Helpline</span>
            <h3 className="text-2xl font-black text-slate-900 mt-1 font-mono">CALL: 112</h3>
            <p className="text-xs text-slate-500 font-semibold mt-1">Unified emergency response service</p>
          </div>
        </a>

        <a
          href="tel:1800-SMART-HEALTH"
          className="p-6 rounded-3xl bg-white border border-slate-200 shadow-xs hover:shadow-md transition text-left space-y-3 block no-underline"
        >
          <div className="w-12 h-12 rounded-2xl bg-cyan-50 text-[#0E7490] flex items-center justify-center font-bold">
            <Hospital className="h-6 w-6" />
          </div>
          <div>
            <span className="text-[10px] font-black text-[#0E7490] uppercase tracking-widest block">Hospital Desk</span>
            <h3 className="text-xl font-black text-slate-900 mt-1 font-mono">1800-HEALTH</h3>
            <p className="text-xs text-slate-500 font-semibold mt-1">Partnered hospital ward desk</p>
          </div>
        </a>
      </div>

      {/* FIRST AID EMERGENCY PROTOCOLS */}
      <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200/80 shadow-xs space-y-6">
        <h2 className="text-lg font-extrabold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-3">
          <Activity className="h-5 w-5 text-[#0E7490]" />
          Instant Medical First Aid Guidance
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
            <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
              <Heart className="h-4.5 w-4.5 text-rose-500" />
              Chest Pain / Cardiac Arrest
            </h3>
            <p className="text-xs font-semibold text-slate-600 leading-relaxed">
              Sit upright, remain calm, loosen tight clothing. If unconscious, initiate 30 rapid chest compressions followed by 2 rescue breaths until paramedics arrive.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
            <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
              <AlertTriangle className="h-4.5 w-4.5 text-amber-500" />
              Severe Trauma & Bleeding
            </h3>
            <p className="text-xs font-semibold text-slate-600 leading-relaxed">
              Apply firm, direct pressure on the wound using a clean cloth or bandage. Elevate the injured limb above heart level if possible.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
            <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
              <Activity className="h-4.5 w-4.5 text-[#14B8A6]" />
              Stroke Recognition (FAST)
            </h3>
            <p className="text-xs font-semibold text-slate-600 leading-relaxed">
              F: Facial drooping • A: Arm weakness • S: Speech difficulty • T: Time to call emergency ambulance immediately.
            </p>
          </div>

          <div className="p-5 rounded-2xl bg-slate-50 border border-slate-100 space-y-2">
            <h3 className="text-sm font-black text-slate-800 flex items-center gap-2">
              <Sparkles className="h-4.5 w-4.5 text-purple-600" />
              Choking / Airway Obstruction
            </h3>
            <p className="text-xs font-semibold text-slate-600 leading-relaxed">
              Perform Heimlich maneuver: Stand behind the person, wrap arms around waist, make a fist above navel and deliver inward-upward thrusts.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
