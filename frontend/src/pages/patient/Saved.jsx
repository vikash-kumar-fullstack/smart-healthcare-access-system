import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../../services/api";
import toast from "react-hot-toast";
import {
  Heart,
  Building,
  MapPin,
  Phone,
  Clock,
  UserCheck,
  ChevronRight,
  ArrowRight,
  Plus
} from "lucide-react";

export default function Saved() {
  const navigate = useNavigate();
  const [savedIds, setSavedIds] = useState([]);
  const [hospitals, setHospitals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState("");

  useEffect(() => {
    // Decode user id from token to key favorites per user account
    const token = localStorage.getItem("token");
    let activeUserId = "default";
    if (token) {
      const parts = token.split(".");
      if (parts.length === 3) {
        const decoded = JSON.parse(atob(parts[1]));
        activeUserId = decoded.userId || decoded.id || "default";
      }
    } else {
      const cachedUser = JSON.parse(localStorage.getItem("user") || "{}");
      if (cachedUser._id || cachedUser.id) {
        activeUserId = cachedUser._id || cachedUser.id;
      }
    }
    setUserId(activeUserId);

    const localKey = `medhospi_favs_${activeUserId}`;
    const stored = JSON.parse(localStorage.getItem(localKey) || "[]");
    setSavedIds(stored);

    const fetchHospitals = async () => {
      try {
        const res = await api.get("/hospitals");
        if (res.data?.success) {
          const hospitalsArray = Array.isArray(res.data.data)
            ? res.data.data
            : (res.data.data?.data || []);
          // Filter only hospitals that exist in the saved list
          const filtered = hospitalsArray.filter(h => stored.includes(h._id));
          setHospitals(filtered);
        }
      } catch (err) {
        console.error("Failed to load saved clinics:", err);
        toast.error("Failed to sync saved clinics.");
      } finally {
        setLoading(false);
      }
    };

    fetchHospitals();
  }, []);

  const handleUnfavorite = (hospitalId, e) => {
    e.stopPropagation();
    e.preventDefault();

    const localKey = `medhospi_favs_${userId}`;
    const updated = savedIds.filter(id => id !== hospitalId);
    localStorage.setItem(localKey, JSON.stringify(updated));
    setSavedIds(updated);
    setHospitals(hospitals.filter(h => h._id !== hospitalId));
    toast.success("Removed from saved hospitals.");
  };

  const handleBookHospital = (hospitalId) => {
    navigate(`/patient/book?hospitalId=${hospitalId}`);
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header Title */}
      <div>
        <h1 className="text-2xl font-black text-slate-800 tracking-tight">Saved Hospitals & Clinics</h1>
        <p className="text-xs text-slate-500 mt-1">Book instantly and monitor waiting queues at your preferred clinics.</p>
      </div>

      {loading ? (
        <div className="py-16 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#0F4C81] mx-auto mb-3" />
          <p className="text-slate-500 text-xs">Syncing bookmarks...</p>
        </div>
      ) : hospitals.length === 0 ? (
        <div className="bg-white rounded-3xl border border-slate-200/60 p-12 text-center text-slate-500 max-w-lg mx-auto shadow-sm mt-6">
          <div className="w-14 h-14 rounded-full bg-slate-50 border border-slate-100 flex items-center justify-center text-rose-500 mx-auto mb-4">
            <Heart className="h-6 w-6 fill-current" />
          </div>
          <h3 className="font-extrabold text-slate-800 text-base">Your favorites list is empty</h3>
          <p className="text-slate-400 text-xs mt-1.5 leading-relaxed">
            Bookmark hospitals from the landing screen or discovery map to quickly book slot tokens and monitor queues.
          </p>
          <button
            onClick={() => navigate("/patient/search")}
            className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 bg-[#0E7490] hover:bg-[#0c5f76] text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
          >
            Discover Nearby Clinics
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {hospitals.map((hospital) => (
            <div
              key={hospital._id}
              className="bg-white rounded-3xl border border-slate-250/50 hover:border-slate-350 shadow-[0_2px_15px_rgba(0,0,0,0.01)] hover:shadow-md transition-all duration-300 p-5 flex flex-col justify-between gap-5 relative overflow-hidden group text-left"
            >
              {/* Top Row: Icon + Name + Heart */}
              <div className="flex justify-between items-start gap-3">
                <div className="flex gap-3">
                  <div className="w-11 h-11 rounded-2xl bg-teal-50 border border-teal-100 text-[#0E7490] flex items-center justify-center font-bold shrink-0">
                    <Building className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-800 group-hover:text-[#0F4C81] transition-colors leading-tight">
                      {hospital.name}
                    </h3>
                    <div className="flex items-center gap-1 text-slate-450 mt-1">
                      <MapPin className="h-3 w-3 shrink-0" />
                      <span className="text-[10px] truncate max-w-[200px]">{hospital.address || "Location, Patna"}</span>
                    </div>
                  </div>
                </div>
                <button
                  onClick={(e) => handleUnfavorite(hospital._id, e)}
                  className="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-100/50 cursor-pointer transition-colors"
                  title="Remove from Saved"
                >
                  <Heart className="h-4.5 w-4.5 fill-current" />
                </button>
              </div>

              {/* Stats Block */}
              <div className="grid grid-cols-2 gap-3.5 bg-slate-50 p-3.5 rounded-2xl border border-slate-150/40 text-xs">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-[#0E7490] shrink-0" />
                  <div>
                    <span className="text-[9px] text-slate-400 block font-semibold uppercase leading-none">Est. Wait</span>
                    <span className="font-extrabold text-slate-750 text-xs mt-0.5 inline-block">10-15 mins</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <UserCheck className="h-4 w-4 text-[#14B8A6] shrink-0" />
                  <div>
                    <span className="text-[9px] text-slate-400 block font-semibold uppercase leading-none">Status</span>
                    <span className="font-extrabold text-slate-750 text-xs mt-0.5 inline-block text-emerald-600">Open Now</span>
                  </div>
                </div>
              </div>

              {/* Call to Actions */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleBookHospital(hospital._id)}
                  className="flex-1 px-4 py-2.5 bg-[#0E7490] hover:bg-[#0c5f76] text-white text-xs font-bold rounded-xl transition-all cursor-pointer flex items-center justify-center gap-1"
                >
                  Book Token Pass
                  <ChevronRight className="h-4 w-4" />
                </button>
                {hospital.phone && (
                  <a
                    href={`tel:${hospital.phone}`}
                    className="p-2.5 border border-slate-200 hover:border-slate-355 rounded-xl text-slate-500 hover:text-slate-800 transition-colors"
                  >
                    <Phone className="h-4 w-4" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
