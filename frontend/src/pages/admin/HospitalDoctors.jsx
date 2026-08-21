import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import api from "../../services/api";
import { getCachedData, setCachedData } from "../../services/apiCache";
import toast from "react-hot-toast";
import { 
  Building2, 
  UserSquare, 
  ArrowLeft, 
  RefreshCw, 
  Search, 
  ShieldCheck, 
  Ban, 
  Users, 
  Clock, 
  Calendar,
  Sparkles,
  AlertCircle
} from "lucide-react";

export default function HospitalDoctors() {
  const { id } = useParams();
  const navigate = useNavigate();

  const cacheKey = `hospital_doctors_${id}`;
  const cachedData = getCachedData(cacheKey);

  const [hospital, setHospital] = useState(cachedData?.hospital || null);
  const [doctors, setDoctors] = useState(cachedData?.doctors || []);
  const [loading, setLoading] = useState(!cachedData);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [specializationFilter, setSpecializationFilter] = useState("all");

  const fetchData = async (silent = false) => {
    try {
      if (!silent && !hospital) setLoading(true);
      
      // Concurrently fetch hospital info and doctors
      const [hospRes, docRes] = await Promise.all([
        api.get("/hospitals").catch(() => null),
        api.get("/admin/doctors").catch(() => null)
      ]);

      let targetHospital = null;
      if (hospRes?.data?.success) {
        const list = hospRes.data.data.data || hospRes.data.data || [];
        targetHospital = list.find(h => h._id === id || h.id === id);
        if (targetHospital) setHospital(targetHospital);
      }

      let hospDoctors = [];
      if (docRes?.data?.success) {
        const allDocs = Array.isArray(docRes.data.data) ? docRes.data.data : (docRes.data.data?.data || []);
        hospDoctors = allDocs.filter(d => {
          const docHospId = d.hospitalId?._id?.toString() || d.hospitalId?.toString();
          return docHospId === id?.toString();
        });
        setDoctors(hospDoctors);
      }

      setCachedData(cacheKey, { hospital: targetHospital, doctors: hospDoctors });
      setError("");
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.message || "Failed to load hospital details and doctors roster.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  const handleToggleDoctorStatus = async (docId, currentStatus) => {
    const actionType = currentStatus === "suspended" ? "reset" : "suspend";
    const reason = prompt(`Enter reason for running '${actionType}' on this doctor:`);
    if (!reason) return;

    const t = toast.loading(`Updating doctor status...`);
    try {
      const res = await api.patch(`/admin/doctors/${docId}/${actionType}`, { reason });
      if (res.data.success) {
        toast.success("Doctor status updated successfully!", { id: t });
        fetchData(true);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Action failed.", { id: t });
    }
  };

  // Specialization options
  const specializations = Array.from(new Set(doctors.map(d => d.specialization).filter(Boolean)));

  // Filter doctors list
  const filteredDoctors = doctors.filter(doc => {
    const matchesSearch = 
      doc.name?.toLowerCase().includes(search.toLowerCase()) ||
      doc.specialization?.toLowerCase().includes(search.toLowerCase());
    
    const matchesSpec = specializationFilter === "all" || doc.specialization === specializationFilter;

    return matchesSearch && matchesSpec;
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] text-[#0E7490]">
        <RefreshCw className="w-9 h-9 animate-spin mb-3" />
        <span className="font-extrabold text-sm text-slate-600">Loading Hospital Roster & Doctors...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-left animate-fade-in-up">
      {/* Back Button & Breadcrumb Navigation */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => navigate("/admin/hospitals")}
          className="inline-flex items-center gap-2 text-xs font-extrabold text-[#0F4C81] hover:text-[#0c3e6b] bg-white border border-slate-200/80 px-4 py-2.5 rounded-xl shadow-2xs hover:shadow-xs transition cursor-pointer"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to All Hospitals
        </button>

        <span className="text-xs font-bold text-slate-400">
          Admin Control &gt; Hospitals &gt; <strong className="text-slate-700">{hospital?.name || "Hospital Roster"}</strong>
        </span>
      </div>

      {/* Hospital Banner Header */}
      <div className="bg-gradient-to-r from-[#0F4C81] via-[#0E7490] to-[#14B8A6] p-7 rounded-[32px] text-white shadow-lg relative overflow-hidden flex flex-col md:flex-row md:items-center md:justify-between gap-6">
        <div className="space-y-2 z-10">
          <div className="flex items-center gap-2 bg-white/10 px-3.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider backdrop-blur-md w-fit">
            <Building2 className="h-3.5 w-3.5" />
            Hospital Profile & Duty Roster
          </div>
          <h1 className="text-3xl font-black tracking-tight mt-1">{hospital?.name || "Hospital Details"}</h1>
          <p className="text-xs text-cyan-100/90 font-medium max-w-xl">
            {hospital?.address || "Medical facility details and assigned medical doctor staff."}
          </p>
        </div>

        {/* Operational Status Pill & Stats */}
        <div className="flex flex-wrap items-center gap-3 z-10">
          <div className="bg-white/15 backdrop-blur-md px-4 py-3 rounded-2xl border border-white/20 text-center">
            <div className="text-2xl font-black text-white">{doctors.length}</div>
            <div className="text-[9px] font-black uppercase tracking-wider text-cyan-100">Assigned Doctors</div>
          </div>
          <div className="bg-white/15 backdrop-blur-md px-4 py-3 rounded-2xl border border-white/20 text-center">
            <div className="text-2xl font-black text-emerald-300">{hospital?.capacity || 100}</div>
            <div className="text-[9px] font-black uppercase tracking-wider text-cyan-100">Beds Capacity</div>
          </div>
        </div>
      </div>

      {/* Search & Filter Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative max-w-md w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-slate-400" />
          <input
            type="text"
            placeholder={`Search doctors in ${hospital?.name || 'this hospital'}...`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-11 w-full pl-11 pr-4 bg-white border border-slate-200/80 rounded-xl text-xs outline-none focus:border-[#0E7490] focus:ring-2 focus:ring-[#0E7490]/5 font-semibold text-slate-700 shadow-3xs"
          />
        </div>

        {/* Specialization Filter Dropdown */}
        {specializations.length > 0 && (
          <div className="flex items-center gap-2">
            <label className="text-xs font-extrabold text-slate-500">Department:</label>
            <select
              value={specializationFilter}
              onChange={(e) => setSpecializationFilter(e.target.value)}
              className="h-11 px-4 bg-white border border-slate-200/80 rounded-xl text-xs font-extrabold text-slate-700 outline-none focus:border-[#0E7490] shadow-3xs cursor-pointer"
            >
              <option value="all">All Departments ({doctors.length})</option>
              {specializations.map(spec => (
                <option key={spec} value={spec}>
                  {spec} ({doctors.filter(d => d.specialization === spec).length})
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 p-4 rounded-2xl text-xs font-bold flex items-center gap-2">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {/* Doctors Grid for this Hospital */}
      {filteredDoctors.length === 0 ? (
        <div className="bg-white border border-slate-200/60 rounded-3xl p-12 text-center text-slate-400">
          <Users className="h-10 w-10 mx-auto text-slate-350 mb-3" />
          <h3 className="text-sm font-extrabold text-slate-700">No Doctors found for {hospital?.name || "this hospital"}</h3>
          <p className="text-xs font-semibold mt-1">Doctors assigned to this facility will appear here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredDoctors.map((doc) => (
            <div
              key={doc._id}
              className="bg-white rounded-3xl border border-slate-200/60 p-6 flex flex-col justify-between space-y-4 hover:shadow-lg transition-all duration-300 shadow-sm"
            >
              <div className="space-y-3.5">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-11 h-11 rounded-2xl bg-cyan-50 border border-cyan-100 flex items-center justify-center text-[#0E7490] font-black text-base shrink-0 shadow-2xs">
                      👨‍⚕️
                    </div>
                    <div>
                      <h4 className="font-extrabold text-slate-850 tracking-tight text-sm">Dr. {doc.name}</h4>
                      <p className="text-xs text-[#0E7490] font-black capitalize mt-0.5">{doc.specialization}</p>
                    </div>
                  </div>

                  <span className={`text-[9px] px-2.5 py-1 rounded-full font-black uppercase tracking-wider ${
                    doc.status === "verified" 
                      ? "bg-teal-50 text-teal-700 border border-teal-200" 
                      : doc.status === "approved" || doc.status === "active"
                      ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                      : doc.status === "suspended"
                      ? "bg-rose-50 text-rose-700 border border-rose-200"
                      : "bg-amber-50 text-amber-700 border border-amber-200"
                  }`}>
                    {doc.status || "active"}
                  </span>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 text-xs font-semibold space-y-2 text-slate-600">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Consultation Fee:</span>
                    <span className="text-slate-800 font-extrabold">₹{doc.consultationFee || 500}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Rating:</span>
                    <span className="text-slate-800 font-extrabold">⭐ {doc.rating || "4.8"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Avg Consultation:</span>
                    <span className="text-slate-800 font-bold">{doc.avgConsultationTime || 15} Mins</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Experience:</span>
                    <span className="text-slate-800 font-bold">{doc.experienceYears || 0} Years</span>
                  </div>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="border-t border-slate-100 pt-4 flex gap-2">
                <button
                  onClick={() => handleToggleDoctorStatus(doc._id, doc.status)}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-extrabold transition cursor-pointer border-none ${
                    doc.status === "suspended"
                      ? "bg-emerald-50 text-emerald-750 hover:bg-emerald-600 hover:text-white"
                      : "bg-rose-50 text-rose-750 hover:bg-rose-600 hover:text-white"
                  }`}
                >
                  {doc.status === "suspended" ? <ShieldCheck className="w-3.5 h-3.5" /> : <Ban className="w-3.5 h-3.5" />}
                  {doc.status === "suspended" ? "Re-activate" : "Suspend"}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
