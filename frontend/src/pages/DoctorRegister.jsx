import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import api from "../services/api";
import toast from "react-hot-toast";
import { User, Stethoscope, Award, ShieldCheck, Hospital as HospitalIcon, FileCheck, ArrowRight, ArrowLeft, CheckCircle2, RefreshCw } from "lucide-react";
import Button from "../components/landing/Button";

export default function DoctorRegister() {
  const navigate = useNavigate();

  // Multi-step form state
  const [step, setStep] = useState(1);
  const [submitted, setSubmitted] = useState(false);
  
  // Hospital list from backend
  const [hospitals, setHospitals] = useState([]);
  const [loadingHospitals, setLoadingHospitals] = useState(false);

  // Form fields
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    specialization: "",
    experienceYears: "",
    degree: "",
    institute: "",
    gradYear: "",
    regNumber: "",
    councilName: "",
    regYear: "",
    hospitalId: "",
    avgConsultationTime: "15",
    agreeToTerms: false
  });

  // Fetch hospitals on mount
  useEffect(() => {
    const fetchHospitals = async () => {
      try {
        setLoadingHospitals(true);
        const res = await api.get("/hospitals");
        if (res.data.success) {
          const hospitalsArray = Array.isArray(res.data.data)
            ? res.data.data
            : (res.data.data?.data || []);
          setHospitals(hospitalsArray);
        }
      } catch (err) {
        console.error("Failed to load hospitals list", err);
      } finally {
        setLoadingHospitals(false);
      }
    };
    fetchHospitals();
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm({
      ...form,
      [name]: type === "checkbox" ? checked : value
    });
  };

  const handleNext = () => {
    if (step === 1 && (!form.name || !form.email || !form.phone || !form.specialization || !form.experienceYears)) {
      toast.error("Please fill all details in Step 1");
      return;
    }
    if (step === 2 && (!form.degree || !form.institute || !form.gradYear)) {
      toast.error("Please fill all qualification details");
      return;
    }
    if (step === 3 && (!form.regNumber || !form.councilName || !form.regYear)) {
      toast.error("Please fill registration details");
      return;
    }
    if (step === 4 && !form.hospitalId) {
      toast.error("Please select an affiliated hospital");
      return;
    }
    setStep((prev) => Math.min(5, prev + 1));
  };

  const handleBack = () => {
    setStep((prev) => Math.max(1, prev - 1));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.agreeToTerms) {
      toast.error("Please agree to verification terms");
      return;
    }
    toast.success("Application submitted successfully!");
    setSubmitted(true);
  };

  // Success Review Page
  if (submitted) {
    return (
      <div className="min-h-[calc(100vh-88px)] flex items-center justify-center bg-[#F8FAFC] px-6 py-12 relative overflow-hidden">
        <div className="absolute top-20 left-10 w-96 h-96 bg-emerald-100/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-teal-100/5 rounded-full blur-3xl pointer-events-none" />

        <div className="w-full max-w-xl bg-white p-8 rounded-3xl border border-slate-200/60 shadow-[0_15px_40px_rgba(0,0,0,0.04)] z-10 text-center flex flex-col items-center gap-6 animate-in fade-in zoom-in-95 duration-400">
          <div className="w-16 h-16 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center shadow-inner">
            <CheckCircle2 className="h-10 w-10" />
          </div>

          <div className="text-center">
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">Application Submitted</h2>
            <p className="text-xs text-slate-500 mt-2">MediHospi Doctor Registry Request</p>
          </div>

          {/* Verification Status Card */}
          <div className="w-full bg-slate-50 rounded-2xl p-5 border border-slate-100 text-left">
            <div className="flex justify-between items-center pb-3 border-b border-slate-200/50">
              <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Application State</span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-100 animate-pulse">
                Pending Verification
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-3 text-xs">
              <div>
                <p className="text-[10px] text-slate-400 uppercase font-semibold">Estimated Review</p>
                <p className="text-slate-700 font-bold mt-0.5">3–5 Business Days</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 uppercase font-semibold">Applicant Name</p>
                <p className="text-slate-700 font-bold mt-0.5 truncate">{form.name}</p>
              </div>
            </div>
          </div>

          {/* Timeline Process */}
          <div className="w-full flex flex-col gap-6 pl-4 text-left my-2">
            
            {/* Step 1 */}
            <div className="flex gap-4 relative">
              <div className="absolute left-3.5 top-8 bottom-[-16px] w-[2px] bg-emerald-500" />
              <div className="w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 z-10 shadow-sm">
                <CheckCircle2 className="h-4.5 w-4.5" />
              </div>
              <div>
                <h5 className="text-xs font-bold text-slate-850">Application Submitted</h5>
                <p className="text-[10px] text-slate-500 mt-0.5">Medical practitioner details received successfully.</p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex gap-4 relative">
              <div className="absolute left-3.5 top-8 bottom-[-16px] w-[2px] bg-slate-200" />
              <div className="w-7 h-7 rounded-full bg-amber-500 text-white flex items-center justify-center shrink-0 z-10 shadow-sm animate-pulse">
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              </div>
              <div>
                <h5 className="text-xs font-bold text-slate-850">Credential Verification</h5>
                <p className="text-[10px] text-slate-500 mt-0.5">Governance board checking State Medical Council registration details.</p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex gap-4 relative">
              <div className="absolute left-3.5 top-8 bottom-[-16px] w-[2px] bg-slate-200" />
              <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-400 border border-slate-200 flex items-center justify-center shrink-0 z-10">
                <span>3</span>
              </div>
              <div>
                <h5 className="text-xs font-bold text-slate-400">Endorsement</h5>
                <p className="text-[10px] text-slate-400 mt-0.5">District officer endorsement and activation approvals.</p>
              </div>
            </div>

            {/* Step 4 */}
            <div className="flex gap-4">
              <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-400 border border-slate-200 flex items-center justify-center shrink-0 z-10">
                <span>4</span>
              </div>
              <div>
                <h5 className="text-xs font-bold text-slate-400">Account Activated</h5>
                <p className="text-[10px] text-slate-400 mt-0.5">Practitioner login access configured. Confirmation email dispatched.</p>
              </div>
            </div>

          </div>

          <Button
            onClick={() => navigate("/")}
            className="w-full mt-2 bg-[#0E7490] hover:bg-[#0c5f76] text-white font-bold rounded-2xl h-12 flex items-center justify-center"
          >
            Return to Homepage
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-88px)] flex items-center justify-center bg-[#F8FAFC] px-4 py-12 relative overflow-hidden">
      
      {/* Background shape */}
      <div className="absolute top-20 left-10 w-96 h-96 bg-[#0E7490]/5 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-[#14B8A6]/5 rounded-full blur-3xl pointer-events-none" />

      <div className="w-full max-w-2xl bg-white rounded-3xl border border-slate-200/60 shadow-[0_15px_40px_rgba(0,0,0,0.06)] overflow-hidden z-10 animate-in fade-in duration-300">
        
        {/* Top Header Card Progress */}
        <div className="bg-gradient-to-br from-[#0E7490] to-[#0A5F76] text-white p-6 flex items-center justify-between">
          <div className="text-left">
            <h3 className="text-lg font-black tracking-tight">Doctor Onboarding Request</h3>
            <p className="text-[11px] text-cyan-100/80 mt-1">Submit credentials to establish your digital practice</p>
          </div>
          <div className="text-right">
            <span className="text-xs font-bold uppercase bg-white/10 px-3 py-1 rounded-full backdrop-blur-sm">
              Step {step} of 5
            </span>
          </div>
        </div>

        {/* Form area */}
        <div className="p-8 md:p-10 flex flex-col gap-6 text-left">
          
          {/* Progress Indicators Bar */}
          <div className="flex items-center justify-between gap-1 w-full pb-4 border-b border-slate-100">
            {[User, Award, ShieldCheck, HospitalIcon, FileCheck].map((Icon, idx) => {
              const active = step >= idx + 1;
              const current = step === idx + 1;
              return (
                <div key={idx} className="flex items-center flex-1 justify-center relative">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center border transition-all duration-300 ${
                    current 
                      ? "bg-[#0E7490] border-[#0E7490] text-white ring-4 ring-[#0E7490]/15" 
                      : active 
                      ? "bg-emerald-500 border-emerald-500 text-white" 
                      : "bg-slate-50 border-slate-200 text-slate-400"
                  }`}>
                    <Icon className="h-4 w-4" />
                  </div>
                </div>
              );
            })}
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-5 mt-2">

            {/* STEP 1: Personal Details */}
            {step === 1 && (
              <div className="flex flex-col gap-4 animate-in fade-in duration-200">
                <h4 className="text-sm font-bold text-slate-800">Step 1: Personal Details</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] uppercase font-bold text-slate-450 tracking-wider">Full Name</label>
                    <input
                      type="text"
                      name="name"
                      placeholder="Dr. John Smith"
                      value={form.name}
                      onChange={handleChange}
                      className="h-10 px-4 rounded-xl border border-slate-200 bg-white text-xs text-slate-800 outline-none transition focus:border-[#0E7490]"
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] uppercase font-bold text-slate-450 tracking-wider">Email Address</label>
                    <input
                      type="email"
                      name="email"
                      placeholder="practitioner@medhospi.com"
                      value={form.email}
                      onChange={handleChange}
                      className="h-10 px-4 rounded-xl border border-slate-200 bg-white text-xs text-slate-800 outline-none transition focus:border-[#0E7490]"
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] uppercase font-bold text-slate-450 tracking-wider">Phone Number</label>
                    <input
                      type="tel"
                      name="phone"
                      placeholder="Mobile contact"
                      value={form.phone}
                      onChange={handleChange}
                      className="h-10 px-4 rounded-xl border border-slate-200 bg-white text-xs text-slate-800 outline-none transition focus:border-[#0E7490]"
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] uppercase font-bold text-slate-450 tracking-wider">Specialization</label>
                    <input
                      type="text"
                      name="specialization"
                      placeholder="e.g. Cardiologist, Pediatrician"
                      value={form.specialization}
                      onChange={handleChange}
                      className="h-10 px-4 rounded-xl border border-slate-200 bg-white text-xs text-slate-800 outline-none transition focus:border-[#0E7490]"
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-1.5 md:col-span-2">
                    <label className="text-[10px] uppercase font-bold text-slate-450 tracking-wider">Years of Practice Experience</label>
                    <input
                      type="number"
                      name="experienceYears"
                      placeholder="e.g. 10"
                      value={form.experienceYears}
                      onChange={handleChange}
                      className="h-10 px-4 rounded-xl border border-slate-200 bg-white text-xs text-slate-800 outline-none transition focus:border-[#0E7490]"
                      required
                    />
                  </div>
                </div>
              </div>
            )}

            {/* STEP 2: Qualification */}
            {step === 2 && (
              <div className="flex flex-col gap-4 animate-in fade-in duration-200">
                <h4 className="text-sm font-bold text-slate-800">Step 2: Medical Qualification</h4>
                <div className="grid grid-cols-1 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] uppercase font-bold text-slate-450 tracking-wider">Highest Degree</label>
                    <input
                      type="text"
                      name="degree"
                      placeholder="e.g. MBBS, MD Cardiology"
                      value={form.degree}
                      onChange={handleChange}
                      className="h-10 px-4 rounded-xl border border-slate-200 bg-white text-xs text-slate-800 outline-none transition focus:border-[#0E7490]"
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] uppercase font-bold text-slate-450 tracking-wider">Medical School/Institute</label>
                    <input
                      type="text"
                      name="institute"
                      placeholder="e.g. Patna Medical College"
                      value={form.institute}
                      onChange={handleChange}
                      className="h-10 px-4 rounded-xl border border-slate-200 bg-white text-xs text-slate-800 outline-none transition focus:border-[#0E7490]"
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] uppercase font-bold text-slate-450 tracking-wider">Year of Graduation</label>
                    <input
                      type="number"
                      name="gradYear"
                      placeholder="e.g. 2012"
                      value={form.gradYear}
                      onChange={handleChange}
                      className="h-10 px-4 rounded-xl border border-slate-200 bg-white text-xs text-slate-800 outline-none transition focus:border-[#0E7490]"
                      required
                    />
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3: Medical Council Registration */}
            {step === 3 && (
              <div className="flex flex-col gap-4 animate-in fade-in duration-200">
                <h4 className="text-sm font-bold text-slate-800">Step 3: Registration details</h4>
                <div className="grid grid-cols-1 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] uppercase font-bold text-slate-450 tracking-wider">Medical Council Registration Number</label>
                    <input
                      type="text"
                      name="regNumber"
                      placeholder="Registration reference"
                      value={form.regNumber}
                      onChange={handleChange}
                      className="h-10 px-4 rounded-xl border border-slate-200 bg-white text-xs text-slate-800 outline-none transition focus:border-[#0E7490]"
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] uppercase font-bold text-slate-450 tracking-wider">State Medical Council Name</label>
                    <input
                      type="text"
                      name="councilName"
                      placeholder="e.g. Bihar Medical Council"
                      value={form.councilName}
                      onChange={handleChange}
                      className="h-10 px-4 rounded-xl border border-slate-200 bg-white text-xs text-slate-800 outline-none transition focus:border-[#0E7490]"
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] uppercase font-bold text-slate-450 tracking-wider">Registration Year</label>
                    <input
                      type="number"
                      name="regYear"
                      placeholder="Year"
                      value={form.regYear}
                      onChange={handleChange}
                      className="h-10 px-4 rounded-xl border border-slate-200 bg-white text-xs text-slate-800 outline-none transition focus:border-[#0E7490]"
                      required
                    />
                  </div>
                </div>
              </div>
            )}

            {/* STEP 4: Hospital Selection (DYNAMIC DROPDOWN) */}
            {step === 4 && (
              <div className="flex flex-col gap-4 animate-in fade-in duration-200">
                <h4 className="text-sm font-bold text-slate-800">Step 4: Affiliated Hospital selection</h4>
                <div className="grid grid-cols-1 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] uppercase font-bold text-slate-450 tracking-wider">Primary Affiliated Clinic/Hospital</label>
                    {loadingHospitals ? (
                      <div className="h-10 flex items-center justify-center bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-500">
                        <RefreshCw className="h-3.5 w-3.5 animate-spin mr-2" />
                        Querying partner clinics...
                      </div>
                    ) : (
                      <select
                        name="hospitalId"
                        value={form.hospitalId}
                        onChange={handleChange}
                        className="h-10 px-3.5 rounded-xl border border-slate-200 bg-white text-xs text-slate-700 outline-none transition focus:border-[#0E7490]"
                        required
                      >
                        <option value="">Select hospital from registry</option>
                        {hospitals.map((h) => (
                          <option key={h._id || h.id} value={h._id || h.id}>
                            {h.name} ({h.location || "Patna"})
                          </option>
                        ))}
                      </select>
                    )}
                    <p className="text-[10px] text-slate-400 mt-1">
                      If your hospital is not listed, they must register their clinic details first.
                    </p>
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] uppercase font-bold text-slate-450 tracking-wider">Average Consultation Time per Patient (mins)</label>
                    <input
                      type="number"
                      name="avgConsultationTime"
                      placeholder="e.g. 15"
                      value={form.avgConsultationTime}
                      onChange={handleChange}
                      className="h-10 px-4 rounded-xl border border-slate-200 bg-white text-xs text-slate-800 outline-none transition focus:border-[#0E7490]"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* STEP 5: Certificates Check & Submit */}
            {step === 5 && (
              <div className="flex flex-col gap-4 animate-in fade-in duration-200">
                <h4 className="text-sm font-bold text-slate-800">Step 5: Verify & Submit Details</h4>
                <div className="flex flex-col gap-4 bg-slate-50 rounded-2xl p-5 border border-slate-100/50">
                  <div className="text-xs text-slate-650 flex flex-col gap-2">
                    <p><strong>Practitioner:</strong> {form.name} ({form.specialization})</p>
                    <p><strong>Degree:</strong> {form.degree} ({form.institute})</p>
                    <p><strong>Council Ref:</strong> {form.regNumber} ({form.councilName})</p>
                    <p>
                      <strong>Affiliation:</strong>{" "}
                      {hospitals.find(h => (h._id || h.id) === form.hospitalId)?.name || "Selected Partner"}
                    </p>
                  </div>
                  
                  <div className="flex items-start gap-2.5 mt-2 border-t border-slate-200/50 pt-4">
                    <input
                      type="checkbox"
                      id="agreeToTerms"
                      name="agreeToTerms"
                      checked={form.agreeToTerms}
                      onChange={handleChange}
                      className="mt-0.5 h-4 w-4 accent-[#0E7490] rounded"
                      required
                    />
                    <label htmlFor="agreeToTerms" className="text-[10px] text-slate-500 leading-normal">
                      I declare that all qualification documents and Medical Council registrations submitted are authentic. I agree to MediHospi verification terms.
                    </label>
                  </div>
                </div>
              </div>
            )}

            {/* Navigation buttons */}
            <div className="flex items-center justify-between border-t border-slate-100 pt-5 mt-4">
              {step > 1 ? (
                <button
                  type="button"
                  onClick={handleBack}
                  className="inline-flex items-center gap-1.5 h-10 px-4 rounded-xl border border-slate-200 text-slate-700 bg-white hover:bg-slate-50 text-xs font-bold transition cursor-pointer"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </button>
              ) : (
                <div />
              )}

              {step < 5 ? (
                <Button
                  type="button"
                  onClick={handleNext}
                  className="h-10 px-5 rounded-xl bg-[#0E7490] hover:bg-[#0c5f76] text-white text-xs font-bold flex items-center gap-1 transition shadow-sm"
                >
                  <span>Continue</span>
                  <ArrowRight className="h-4 w-4" />
                </Button>
              ) : (
                <Button
                  type="submit"
                  className="h-10 px-5 rounded-xl bg-[#0E7490] hover:bg-[#0c5f76] text-white text-xs font-bold flex items-center gap-1 transition shadow-sm"
                >
                  Submit Application
                </Button>
              )}
            </div>

          </form>

        </div>
      </div>
    </div>
  );
}
