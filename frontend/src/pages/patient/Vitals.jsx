import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";
import { getCachedData, setCachedData } from "../../services/apiCache";
import toast from "react-hot-toast";
import {
  Heart,
  Activity,
  Sparkles,
  Save,
  ArrowLeft,
  UserCheck,
  ShieldAlert,
  Phone,
  CheckCircle2,
  AlertTriangle
} from "lucide-react";
import Badge from "../../components/common/Badge";
import Skeleton from "../../components/common/Skeleton";

export default function Vitals() {
  const navigate = useNavigate();
  const cachedVitals = getCachedData("patient_vitals");
  const [loading, setLoading] = useState(!cachedVitals);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState(cachedVitals || {
    bloodGroup: "O+",
    height: 172,
    weight: 66,
    allergies: "",
    chronicDiseases: "",
    currentMedications: "",
    emergencyContactName: "",
    emergencyContactPhone: "",
    emergencyContactRelation: "Spouse",
    smoking: "never",
    alcohol: "never",
    organDonor: false
  });

  const bloodGroups = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"];

  useEffect(() => {
    async function fetchVitals() {
      try {
        const res = await api.get("/medical-records/portal/summary").catch(() => null);
        if (res?.data?.success && res.data.data?.profile) {
          const p = res.data.data.profile;
          const updatedForm = {
            bloodGroup: p.bloodGroup || "O+",
            height: p.height || 172,
            weight: p.weight || 66,
            allergies: Array.isArray(p.allergies) ? p.allergies.join(", ") : (p.allergies || ""),
            chronicDiseases: Array.isArray(p.chronicDiseases) ? p.chronicDiseases.join(", ") : (p.chronicDiseases || ""),
            currentMedications: Array.isArray(p.currentMedications) ? p.currentMedications.join(", ") : (p.currentMedications || ""),
            emergencyContactName: p.emergencyContact?.name || "",
            emergencyContactPhone: p.emergencyContact?.phone || "",
            emergencyContactRelation: p.emergencyContact?.relation || "Spouse",
            smoking: p.smoking || "never",
            alcohol: p.alcohol || "never",
            organDonor: !!p.organDonor
          };
          setForm(updatedForm);
          setCachedData("patient_vitals", updatedForm);
        }
      } catch (err) {
        console.error("Failed to load patient health profile:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchVitals();
  }, []);

  const calculateBmi = () => {
    if (!form.height || !form.weight) return { val: "N/A", label: "Incomplete Data", colorClass: "text-slate-400", bgClass: "bg-slate-100" };
    const hM = form.height / 100;
    const val = (form.weight / (hM * hM)).toFixed(1);
    const num = parseFloat(val);
    let label = "Healthy Weight";
    let colorClass = "text-emerald-600";
    let bgClass = "bg-emerald-50 text-emerald-700 border-emerald-200";

    if (num < 18.5) {
      label = "Underweight";
      colorClass = "text-amber-600";
      bgClass = "bg-amber-50 text-amber-700 border-amber-200";
    } else if (num >= 25 && num < 30) {
      label = "Overweight";
      colorClass = "text-amber-600";
      bgClass = "bg-amber-50 text-amber-700 border-amber-200";
    } else if (num >= 30) {
      label = "Obese";
      colorClass = "text-rose-600";
      bgClass = "bg-rose-50 text-rose-700 border-rose-200";
    }
    return { val, label, colorClass, bgClass };
  };

  const bmi = calculateBmi();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const toastId = toast.loading("Saving health profile & vitals...");

    try {
      const payload = {
        bloodGroup: form.bloodGroup,
        height: Number(form.height),
        weight: Number(form.weight),
        allergies: form.allergies ? form.allergies.split(",").map(s => s.trim()).filter(Boolean) : [],
        chronicDiseases: form.chronicDiseases ? form.chronicDiseases.split(",").map(s => s.trim()).filter(Boolean) : [],
        currentMedications: form.currentMedications ? form.currentMedications.split(",").map(s => s.trim()).filter(Boolean) : [],
        emergencyContact: {
          name: form.emergencyContactName || "Primary Contact",
          phone: form.emergencyContactPhone || "102",
          relation: form.emergencyContactRelation || "Family"
        },
        smoking: form.smoking,
        alcohol: form.alcohol,
        organDonor: form.organDonor
      };

      const res = await api.put("/medical-records/portal/vitals", payload);
      if (res.data.success) {
        toast.success("Health Profile & Vitals saved successfully!", { id: toastId });
        // Update cached health details
        const savedUser = JSON.parse(localStorage.getItem("user") || "{}");
        savedUser.vitals = payload;
        localStorage.setItem("user", JSON.stringify(savedUser));
      } else {
        toast.error("Failed to save health profile.", { id: toastId });
      }
    } catch (err) {
      console.error("Vitals update error:", err);
      toast.error(err.response?.data?.message || "Failed to save vitals.", { id: toastId });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="p-8 md:p-12 space-y-6 max-w-4xl mx-auto text-left">
        <Skeleton className="h-10 w-48 rounded-xl" />
        <Skeleton className="h-64 w-full rounded-3xl" />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-12 space-y-8 max-w-4xl mx-auto text-left animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 border-b border-slate-200/60 pb-6">
        <div className="space-y-1">
          <button
            onClick={() => navigate("/patient")}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-[#0E7490] transition mb-2 cursor-pointer border-none bg-transparent p-0"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Dashboard
          </button>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-2.5">
            <Heart className="h-7 w-7 text-rose-500" />
            Personal Vitals & Health Profile
          </h1>
          <p className="text-sm font-semibold text-slate-500">
            Keep your clinical vitals, blood type, allergies, and emergency contact details updated.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* SECTION 1: PHYSICAL VITALS & BMI CARD */}
        <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200/80 shadow-xs space-y-6">
          <h2 className="text-lg font-extrabold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-3">
            <Activity className="h-5 w-5 text-[#0E7490]" />
            Biometric Vitals & BMI Calculation
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Blood Group */}
            <div>
              <label className="block text-xs font-black text-slate-600 uppercase tracking-wider mb-2">
                Blood Group *
              </label>
              <select
                value={form.bloodGroup}
                onChange={(e) => setForm({ ...form, bloodGroup: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-extrabold text-slate-800 outline-none focus:border-[#0E7490] transition"
              >
                {bloodGroups.map(bg => (
                  <option key={bg} value={bg}>{bg}</option>
                ))}
              </select>
            </div>

            {/* Height */}
            <div>
              <label className="block text-xs font-black text-slate-600 uppercase tracking-wider mb-2">
                Height (in cm)
              </label>
              <input
                type="number"
                min="50"
                max="250"
                value={form.height}
                onChange={(e) => setForm({ ...form, height: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-extrabold text-slate-800 outline-none focus:border-[#0E7490] transition"
                placeholder="e.g. 172"
              />
            </div>

            {/* Weight */}
            <div>
              <label className="block text-xs font-black text-slate-600 uppercase tracking-wider mb-2">
                Weight (in kg)
              </label>
              <input
                type="number"
                min="20"
                max="300"
                value={form.weight}
                onChange={(e) => setForm({ ...form, weight: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-extrabold text-slate-800 outline-none focus:border-[#0E7490] transition"
                placeholder="e.g. 66"
              />
            </div>
          </div>

          {/* BMI Computed Widget */}
          <div className={`p-4 rounded-2xl border ${bmi.bgClass} flex items-center justify-between gap-4`}>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white/80 flex items-center justify-center shrink-0 shadow-2xs">
                <Sparkles className="h-5 w-5 text-[#0E7490]" />
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-widest block opacity-80">Calculated Body Mass Index</span>
                <span className="text-xl font-black">{bmi.val} kg/m²</span>
              </div>
            </div>
            <span className="px-3.5 py-1.5 rounded-full text-xs font-black uppercase bg-white shadow-2xs">
              {bmi.label}
            </span>
          </div>
        </div>

        {/* SECTION 2: MEDICAL HISTORY & ALLERGIES */}
        <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200/80 shadow-xs space-y-6">
          <h2 className="text-lg font-extrabold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-3">
            <ShieldAlert className="h-5 w-5 text-amber-500" />
            Allergies & Chronic Health Conditions
          </h2>

          <div className="space-y-5">
            <div>
              <label className="block text-xs font-black text-slate-600 uppercase tracking-wider mb-2">
                Known Allergies (Comma Separated)
              </label>
              <input
                type="text"
                value={form.allergies}
                onChange={(e) => setForm({ ...form, allergies: e.target.value })}
                placeholder="e.g. Penicillin, Peanuts, Latex, Dust"
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-semibold text-slate-800 outline-none focus:border-[#0E7490] transition"
              />
            </div>

            <div>
              <label className="block text-xs font-black text-slate-600 uppercase tracking-wider mb-2">
                Chronic Health Conditions
              </label>
              <input
                type="text"
                value={form.chronicDiseases}
                onChange={(e) => setForm({ ...form, chronicDiseases: e.target.value })}
                placeholder="e.g. Asthma, Hypertension, Type-2 Diabetes"
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-semibold text-slate-800 outline-none focus:border-[#0E7490] transition"
              />
            </div>

            <div>
              <label className="block text-xs font-black text-slate-600 uppercase tracking-wider mb-2">
                Current Active Medications
              </label>
              <input
                type="text"
                value={form.currentMedications}
                onChange={(e) => setForm({ ...form, currentMedications: e.target.value })}
                placeholder="e.g. Paracetamol 650mg, Insulin 10IU"
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-semibold text-slate-800 outline-none focus:border-[#0E7490] transition"
              />
            </div>
          </div>
        </div>

        {/* SECTION 3: EMERGENCY CONTACT */}
        <div className="bg-white p-6 md:p-8 rounded-3xl border border-slate-200/80 shadow-xs space-y-6">
          <h2 className="text-lg font-extrabold text-slate-800 flex items-center gap-2 border-b border-slate-100 pb-3">
            <Phone className="h-5 w-5 text-rose-500" />
            Emergency Contact Information
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-xs font-black text-slate-600 uppercase tracking-wider mb-2">
                Contact Name *
              </label>
              <input
                type="text"
                value={form.emergencyContactName}
                onChange={(e) => setForm({ ...form, emergencyContactName: e.target.value })}
                placeholder="e.g. Anjali Sen"
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-semibold text-slate-800 outline-none focus:border-[#0E7490] transition"
              />
            </div>

            <div>
              <label className="block text-xs font-black text-slate-600 uppercase tracking-wider mb-2">
                Contact Phone *
              </label>
              <input
                type="text"
                value={form.emergencyContactPhone}
                onChange={(e) => setForm({ ...form, emergencyContactPhone: e.target.value })}
                placeholder="e.g. +91 9876543210"
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-semibold text-slate-800 outline-none focus:border-[#0E7490] transition"
              />
            </div>

            <div>
              <label className="block text-xs font-black text-slate-600 uppercase tracking-wider mb-2">
                Relationship
              </label>
              <select
                value={form.emergencyContactRelation}
                onChange={(e) => setForm({ ...form, emergencyContactRelation: e.target.value })}
                className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-semibold text-slate-800 outline-none focus:border-[#0E7490] transition"
              >
                <option value="Spouse">Spouse</option>
                <option value="Parent">Parent</option>
                <option value="Sibling">Sibling</option>
                <option value="Child">Child</option>
                <option value="Friend">Friend</option>
              </select>
            </div>
          </div>
        </div>

        {/* SAVE BUTTON */}
        <div className="flex justify-end pt-4">
          <button
            type="submit"
            disabled={saving}
            className="bg-gradient-to-r from-[#0E7490] to-[#14B8A6] hover:from-[#0c5f76] hover:to-[#0f8b7d] text-white font-extrabold text-sm px-8 py-4 rounded-2xl shadow-md transition-all hover:scale-102 flex items-center gap-2 cursor-pointer border-none"
          >
            <Save className="h-5 w-5" />
            {saving ? "Saving Profile..." : "Save Vitals & Profile"}
          </button>
        </div>
      </form>
    </div>
  );
}
