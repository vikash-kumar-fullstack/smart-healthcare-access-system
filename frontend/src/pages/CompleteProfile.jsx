import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../services/api";
import toast from "react-hot-toast";
import { Phone, Calendar, User, ArrowRight, MapPin, Heart, ShieldAlert, Activity, FileText } from "lucide-react";
import Button from "../components/landing/Button";
import logoImg from "../assets/logo.png";

export default function CompleteProfile() {
  const navigate = useNavigate();
  const [form, setForm] = useState({
    phone: "",
    gender: "male",
    dob: "",
    address: "",
    bloodGroup: "A+",
    emergencyContactName: "",
    emergencyContactNumber: "",
    allergies: "",
    currentMedications: "",
    chronicDiseases: "",
    height: "",
    weight: ""
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const root = window.document.documentElement;
    const previousTheme = root.getAttribute("data-theme");
    const hadDarkClass = root.classList.contains("dark");

    // Force light theme
    root.setAttribute("data-theme", "light");
    root.classList.remove("dark");

    return () => {
      // Restore previous theme
      if (previousTheme) {
        root.setAttribute("data-theme", previousTheme);
      } else {
        root.removeAttribute("data-theme");
      }
      
      if (hadDarkClass) {
        root.classList.add("dark");
      } else {
        root.classList.remove("dark");
      }
    };
  }, []);

  const handleChange = (e) => {
    setForm(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (
      !form.phone || 
      !form.dob || 
      !form.gender || 
      !form.address || 
      !form.bloodGroup || 
      !form.emergencyContactName || 
      !form.emergencyContactNumber
    ) {
      toast.error("Please fill in all required details to finalize registration.");
      return;
    }

    const t = toast.loading("Saving profile details...");
    try {
      setLoading(true);
      const res = await api.post("/auth/complete-profile", form);
      
      // Update local storage user profile state
      const userStr = localStorage.getItem("user");
      if (userStr) {
        const user = JSON.parse(userStr);
        user.profileCompleted = true;
        localStorage.setItem("user", JSON.stringify(user));
      }

      toast.success("Profile registration completed successfully!", { id: t });
      navigate("/patient", { replace: true });
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to complete profile details", { id: t });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="h-[calc(100vh-88px)] w-full flex items-center justify-center bg-[#F8FAFC] px-4 py-12 relative overflow-hidden">
      {/* Ambient background blobs */}
      <div className="absolute top-10 left-10 w-96 h-96 bg-teal-500/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-10 right-10 w-96 h-96 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-xl bg-white rounded-3xl border border-slate-200/60 shadow-[0_15px_40px_rgba(0,0,0,0.06)] p-8 md:p-10 z-10 text-left my-4 max-h-[90vh] flex flex-col">
        
        {/* Brand Header */}
        <div className="flex items-center gap-3 bg-slate-50 px-4 py-2.5 rounded-2xl border border-slate-100 shadow-sm w-fit shrink-0 mb-5">
          <div className="bg-white p-1 rounded-lg border border-slate-200 shadow-sm shrink-0">
            <img src={logoImg} alt="MediHospi Logo" className="w-6 h-6 object-contain rounded" />
          </div>
          <div className="flex flex-col text-left">
            <span className="font-black text-xs leading-none tracking-tight text-slate-800">
              <span className="text-[#0F4C81]">Medi</span>
              <span className="text-[#14B8A6]">Hospi</span>
            </span>
            <span className="text-[8px] font-bold text-[#64748B] mt-1 tracking-wide">
              Smart HealthCare Access System
            </span>
          </div>
        </div>

        <div className="mb-6 shrink-0">
          <div className="text-2xl font-black text-slate-800 tracking-tight">Complete Your Profile</div>
          <p className="text-xs text-slate-500 mt-1">Please provide the remaining details to access care booking sessions.</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5 overflow-y-auto pr-2 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-250 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-slate-350">
          
          {/* Section 1: Demographics & Address (Required) */}
          <div className="border border-slate-100 bg-slate-50/40 rounded-2xl p-4 flex flex-col gap-3.5">
            <div className="text-xs font-bold text-[#0F4C81] tracking-wider uppercase border-b border-slate-200/60 pb-2 mb-1">
              1. Demographics & Contact
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Phone */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  Mobile Phone *
                </label>
                <div className="relative flex items-center">
                  <Phone className="absolute left-3.5 h-4.5 w-4.5 text-slate-400" />
                  <input
                    type="tel"
                    name="phone"
                    placeholder="e.g. 9876543210"
                    value={form.phone}
                    onChange={handleChange}
                    maxLength="10"
                    className="h-12 w-full pl-11 pr-4 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder-slate-400 outline-none transition focus:border-[#0F4C81] focus:ring-2 focus:ring-[#0F4C81]/10"
                    required
                  />
                </div>
              </div>

              {/* DOB */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  Date of Birth *
                </label>
                <div className="relative flex items-center">
                  <Calendar className="absolute left-3.5 h-4.5 w-4.5 text-slate-400" />
                  <input
                    type="date"
                    name="dob"
                    value={form.dob}
                    onChange={handleChange}
                    className="h-12 w-full pl-11 pr-4 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder-slate-400 outline-none transition focus:border-[#0F4C81] focus:ring-2 focus:ring-[#0F4C81]/10"
                    required
                  />
                </div>
              </div>

              {/* Gender */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  Gender *
                </label>
                <div className="relative flex items-center">
                  <User className="absolute left-3.5 h-4.5 w-4.5 text-slate-400" />
                  <select
                    name="gender"
                    value={form.gender}
                    onChange={handleChange}
                    className="h-12 w-full pl-11 pr-4 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 outline-none transition focus:border-[#0F4C81] focus:ring-2 focus:ring-[#0F4C81]/10"
                    required
                  >
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Address */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                Full Residential Address *
              </label>
              <div className="relative flex items-center">
                <MapPin className="absolute left-3.5 h-4.5 w-4.5 text-slate-400" />
                <input
                  type="text"
                  name="address"
                  placeholder="Street, Landmark, City, State"
                  value={form.address}
                  onChange={handleChange}
                  className="h-12 w-full pl-11 pr-4 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder-slate-400 outline-none transition focus:border-[#0F4C81] focus:ring-2 focus:ring-[#0F4C81]/10"
                  required
                />
              </div>
            </div>
          </div>

          {/* Section 2: Emergency Contact (Required) */}
          <div className="border border-slate-100 bg-slate-50/40 rounded-2xl p-4 flex flex-col gap-3.5">
            <div className="text-xs font-bold text-[#0F4C81] tracking-wider uppercase border-b border-slate-200/60 pb-2 mb-1">
              2. Emergency Contact
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Contact Name */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  Contact Person Name *
                </label>
                <div className="relative flex items-center">
                  <User className="absolute left-3.5 h-4.5 w-4.5 text-slate-400" />
                  <input
                    type="text"
                    name="emergencyContactName"
                    placeholder="e.g. Jane Doe"
                    value={form.emergencyContactName}
                    onChange={handleChange}
                    className="h-12 w-full pl-11 pr-4 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder-slate-400 outline-none transition focus:border-[#0F4C81] focus:ring-2 focus:ring-[#0F4C81]/10"
                    required
                  />
                </div>
              </div>

              {/* Contact Phone */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  Contact Phone Number *
                </label>
                <div className="relative flex items-center">
                  <Phone className="absolute left-3.5 h-4.5 w-4.5 text-slate-400" />
                  <input
                    type="tel"
                    name="emergencyContactNumber"
                    placeholder="e.g. 9876543210"
                    value={form.emergencyContactNumber}
                    onChange={handleChange}
                    maxLength="10"
                    className="h-12 w-full pl-11 pr-4 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder-slate-400 outline-none transition focus:border-[#0F4C81] focus:ring-2 focus:ring-[#0F4C81]/10"
                    required
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Section 3: Essential Medical Details (Required/Optional) */}
          <div className="border border-slate-100 bg-slate-50/40 rounded-2xl p-4 flex flex-col gap-3.5">
            <div className="text-xs font-bold text-[#0F4C81] tracking-wider uppercase border-b border-slate-200/60 pb-2 mb-1">
              3. Vital Statistics & Medical Data
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Blood Group */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  Blood Group *
                </label>
                <div className="relative flex items-center">
                  <Heart className="absolute left-3.5 h-4.5 w-4.5 text-red-500" />
                  <select
                    name="bloodGroup"
                    value={form.bloodGroup}
                    onChange={handleChange}
                    className="h-12 w-full pl-11 pr-4 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 outline-none transition focus:border-[#0F4C81] focus:ring-2 focus:ring-[#0F4C81]/10"
                    required
                  >
                    {["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map(bg => (
                      <option key={bg} value={bg}>{bg}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Height */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  Height (cm)
                </label>
                <div className="relative flex items-center">
                  <Activity className="absolute left-3.5 h-4.5 w-4.5 text-slate-400" />
                  <input
                    type="number"
                    name="height"
                    placeholder="e.g. 175"
                    value={form.height}
                    onChange={handleChange}
                    className="h-12 w-full pl-11 pr-4 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder-slate-400 outline-none transition focus:border-[#0F4C81] focus:ring-2 focus:ring-[#0F4C81]/10"
                  />
                </div>
              </div>

              {/* Weight */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                  Weight (kg)
                </label>
                <div className="relative flex items-center">
                  <Activity className="absolute left-3.5 h-4.5 w-4.5 text-slate-400" />
                  <input
                    type="number"
                    name="weight"
                    placeholder="e.g. 70"
                    value={form.weight}
                    onChange={handleChange}
                    className="h-12 w-full pl-11 pr-4 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder-slate-400 outline-none transition focus:border-[#0F4C81] focus:ring-2 focus:ring-[#0F4C81]/10"
                  />
                </div>
              </div>
            </div>

            {/* Allergies */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                Allergies (Optional)
              </label>
              <div className="relative flex items-center">
                <ShieldAlert className="absolute left-3.5 h-4.5 w-4.5 text-amber-500" />
                <input
                  type="text"
                  name="allergies"
                  placeholder="e.g. Penicillin, Peanuts (comma separated)"
                  value={form.allergies}
                  onChange={handleChange}
                  className="h-12 w-full pl-11 pr-4 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder-slate-400 outline-none transition focus:border-[#0F4C81] focus:ring-2 focus:ring-[#0F4C81]/10"
                />
              </div>
            </div>

            {/* Medications */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                Current Medications (Optional)
              </label>
              <div className="relative flex items-center">
                <FileText className="absolute left-3.5 h-4.5 w-4.5 text-slate-400" />
                <input
                  type="text"
                  name="currentMedications"
                  placeholder="e.g. Metformin, Aspirin (comma separated)"
                  value={form.currentMedications}
                  onChange={handleChange}
                  className="h-12 w-full pl-11 pr-4 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder-slate-400 outline-none transition focus:border-[#0F4C81] focus:ring-2 focus:ring-[#0F4C81]/10"
                />
              </div>
            </div>

            {/* Chronic Conditions */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                Chronic Conditions / Diseases (Optional)
              </label>
              <div className="relative flex items-center">
                <ShieldAlert className="absolute left-3.5 h-4.5 w-4.5 text-rose-500" />
                <input
                  type="text"
                  name="chronicDiseases"
                  placeholder="e.g. Diabetes, Hypertension (comma separated)"
                  value={form.chronicDiseases}
                  onChange={handleChange}
                  className="h-12 w-full pl-11 pr-4 rounded-xl border border-slate-200 bg-white text-sm text-slate-800 placeholder-slate-400 outline-none transition focus:border-[#0F4C81] focus:ring-2 focus:ring-[#0F4C81]/10"
                />
              </div>
            </div>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full h-12 bg-gradient-to-r from-[#0F4C81] to-[#14B8A6] hover:from-[#0d4372] hover:to-[#0f8b7d] text-white font-bold rounded-xl text-sm flex items-center justify-center gap-2 shadow-md shadow-cyan-900/10 transition-all shrink-0 cursor-pointer border-none"
          >
            {loading ? "Finalizing..." : "COMPLETE PROFILE"}
            {!loading && <ArrowRight className="h-4.5 w-4.5" />}
          </Button>
        </form>
      </div>
    </div>
  );
}
