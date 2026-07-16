import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Building, MapPin, ClipboardList, ShieldAlert, CheckCircle2, ArrowRight, ArrowLeft, RefreshCw } from "lucide-react";
import Button from "../components/landing/Button";
import toast from "react-hot-toast";

export default function HospitalRegister() {
  const navigate = useNavigate();

  // Step wizard state
  const [step, setStep] = useState(1);
  const [submitted, setSubmitted] = useState(false);

  // Form fields
  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    website: "",
    street: "",
    city: "",
    state: "",
    zip: "",
    departments: [],
    capacity: "100",
    agreeToTerms: false
  });

  const availableDepts = [
    "General Medicine (OPD)",
    "Cardiology",
    "Pediatrics",
    "Orthopedics",
    "Germatology",
    "Emergency Care",
    "Gynecology",
    "Neurology"
  ];

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm({
      ...form,
      [name]: type === "checkbox" ? checked : value
    });
  };

  const handleDeptToggle = (dept) => {
    const updated = form.departments.includes(dept)
      ? form.departments.filter(d => d !== dept)
      : [...form.departments, dept];
    setForm({ ...form, departments: updated });
  };

  const handleNext = () => {
    if (step === 1 && (!form.name || !form.email || !form.phone)) {
      toast.error("Please fill all details in Step 1");
      return;
    }
    if (step === 2 && (!form.street || !form.city || !form.state || !form.zip)) {
      toast.error("Please fill all address details");
      return;
    }
    if (step === 3 && form.departments.length === 0) {
      toast.error("Please select at least one department");
      return;
    }
    if (step === 4 && !form.capacity) {
      toast.error("Please fill bed capacity");
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
      toast.error("Please check terms agreement");
      return;
    }
    toast.success("Partnership application submitted!");
    setSubmitted(true);
  };

  // Status view after submit
  if (submitted) {
    return (
      <div className="min-h-[calc(100vh-88px)] flex items-center justify-center bg-[#F8FAFC] px-6 py-12 relative overflow-hidden">
        <div className="absolute top-20 left-10 w-96 h-96 bg-indigo-100/5 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-blue-100/5 rounded-full blur-3xl pointer-events-none" />

        <div className="w-full max-w-xl bg-white p-8 rounded-3xl border border-slate-200/60 shadow-[0_15px_40px_rgba(0,0,0,0.04)] z-10 text-center flex flex-col items-center gap-6 animate-in fade-in zoom-in-95 duration-400">
          <div className="w-16 h-16 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center shadow-inner">
            <CheckCircle2 className="h-10 w-10" />
          </div>

          <div className="text-center">
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">Partnership Submitted</h2>
            <p className="text-xs text-slate-500 mt-2">MediHospi Hospital Digitalization request</p>
          </div>

          {/* Verification Status Card */}
          <div className="w-full bg-slate-50 rounded-2xl p-5 border border-slate-100 text-left">
            <div className="flex justify-between items-center pb-3 border-b border-slate-200/50">
              <span className="text-xs text-slate-500 font-bold uppercase tracking-wider">Application State</span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-indigo-50 text-indigo-700 border border-indigo-100 animate-pulse">
                Pending Verification
              </span>
            </div>
            <div className="grid grid-cols-2 gap-4 mt-3 text-xs">
              <div>
                <p className="text-[10px] text-slate-400 uppercase font-semibold">Estimated Review</p>
                <p className="text-slate-700 font-bold mt-0.5">3–5 Business Days</p>
              </div>
              <div>
                <p className="text-[10px] text-slate-400 uppercase font-semibold">Hospital Name</p>
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
                <h5 className="text-xs font-bold text-slate-850">Onboarding Initiated</h5>
                <p className="text-[10px] text-slate-500 mt-0.5">Clinic digitalization proposal logged successfully.</p>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex gap-4 relative">
              <div className="absolute left-3.5 top-8 bottom-[-16px] w-[2px] bg-slate-200" />
              <div className="w-7 h-7 rounded-full bg-amber-500 text-white flex items-center justify-center shrink-0 z-10 shadow-sm animate-pulse">
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
              </div>
              <div>
                <h5 className="text-xs font-bold text-slate-850">Governance Review</h5>
                <p className="text-[10px] text-slate-500 mt-0.5">Verifying address credentials and clinical capacity levels.</p>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex gap-4 relative">
              <div className="absolute left-3.5 top-8 bottom-[-16px] w-[2px] bg-slate-200" />
              <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-400 border border-slate-200 flex items-center justify-center shrink-0 z-10">
                <span>3</span>
              </div>
              <div>
                <h5 className="text-xs font-bold text-slate-400">District Endorsement</h5>
                <p className="text-[10px] text-slate-400 mt-0.5">Endorsement by regional healthcare administration.</p>
              </div>
            </div>

            {/* Step 4 */}
            <div className="flex gap-4">
              <div className="w-7 h-7 rounded-full bg-slate-100 text-slate-400 border border-slate-200 flex items-center justify-center shrink-0 z-10">
                <span>4</span>
              </div>
              <div>
                <h5 className="text-xs font-bold text-slate-400">Digitization Active</h5>
                <p className="text-[10px] text-slate-400 mt-0.5">Hospital added to MediHospi public index. Ward accounts created.</p>
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
            <h3 className="text-lg font-black tracking-tight">Hospital Partnership Request</h3>
            <p className="text-[11px] text-cyan-100/80 mt-1">Onboard your clinical center into our queue index</p>
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
            {[Building, MapPin, ClipboardList, ShieldAlert, CheckCircle2].map((Icon, idx) => {
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

            {/* STEP 1: Hospital Details */}
            {step === 1 && (
              <div className="flex flex-col gap-4 animate-in fade-in duration-200">
                <h4 className="text-sm font-bold text-slate-800">Step 1: Hospital Details</h4>
                <div className="grid grid-cols-1 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] uppercase font-bold text-slate-450 tracking-wider">Hospital Name</label>
                    <input
                      type="text"
                      name="name"
                      placeholder="Medica Superspecialty Hospital"
                      value={form.name}
                      onChange={handleChange}
                      className="h-10 px-4 rounded-xl border border-slate-200 bg-white text-xs text-slate-800 outline-none transition focus:border-[#0E7490]"
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] uppercase font-bold text-slate-450 tracking-wider">Contact Email</label>
                    <input
                      type="email"
                      name="email"
                      placeholder="onboarding@hospital.com"
                      value={form.email}
                      onChange={handleChange}
                      className="h-10 px-4 rounded-xl border border-slate-200 bg-white text-xs text-slate-800 outline-none transition focus:border-[#0E7490]"
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] uppercase font-bold text-slate-450 tracking-wider">Contact Phone</label>
                    <input
                      type="tel"
                      name="phone"
                      placeholder="Hospital desk phone number"
                      value={form.phone}
                      onChange={handleChange}
                      className="h-10 px-4 rounded-xl border border-slate-200 bg-white text-xs text-slate-800 outline-none transition focus:border-[#0E7490]"
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] uppercase font-bold text-slate-450 tracking-wider">Website URL (Optional)</label>
                    <input
                      type="url"
                      name="website"
                      placeholder="https://hospital.com"
                      value={form.website}
                      onChange={handleChange}
                      className="h-10 px-4 rounded-xl border border-slate-200 bg-white text-xs text-slate-800 outline-none transition focus:border-[#0E7490]"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* STEP 2: Address */}
            {step === 2 && (
              <div className="flex flex-col gap-4 animate-in fade-in duration-200">
                <h4 className="text-sm font-bold text-slate-800">Step 2: Address Details</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5 md:col-span-2">
                    <label className="text-[10px] uppercase font-bold text-slate-450 tracking-wider">Street Address</label>
                    <input
                      type="text"
                      name="street"
                      placeholder="Plot number, locality reference"
                      value={form.street}
                      onChange={handleChange}
                      className="h-10 px-4 rounded-xl border border-slate-200 bg-white text-xs text-slate-800 outline-none transition focus:border-[#0E7490]"
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] uppercase font-bold text-slate-450 tracking-wider">City</label>
                    <input
                      type="text"
                      name="city"
                      placeholder="City name"
                      value={form.city}
                      onChange={handleChange}
                      className="h-10 px-4 rounded-xl border border-slate-200 bg-white text-xs text-slate-800 outline-none transition focus:border-[#0E7490]"
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] uppercase font-bold text-slate-450 tracking-wider">State</label>
                    <input
                      type="text"
                      name="state"
                      placeholder="State name"
                      value={form.state}
                      onChange={handleChange}
                      className="h-10 px-4 rounded-xl border border-slate-200 bg-white text-xs text-slate-800 outline-none transition focus:border-[#0E7490]"
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-1.5 md:col-span-2">
                    <label className="text-[10px] uppercase font-bold text-slate-450 tracking-wider">Postal / ZIP Code</label>
                    <input
                      type="text"
                      name="zip"
                      placeholder="6-digit ZIP code"
                      value={form.zip}
                      onChange={handleChange}
                      className="h-10 px-4 rounded-xl border border-slate-200 bg-white text-xs text-slate-800 outline-none transition focus:border-[#0E7490]"
                      required
                    />
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3: Departments */}
            {step === 3 && (
              <div className="flex flex-col gap-4 animate-in fade-in duration-200">
                <h4 className="text-sm font-bold text-slate-800">Step 3: Select Clinical Departments</h4>
                <p className="text-[11px] text-slate-500 -mt-2">Tick all departments active in your hospital complex:</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-1">
                  {availableDepts.map((dept) => {
                    const checked = form.departments.includes(dept);
                    return (
                      <div
                        key={dept}
                        onClick={() => handleDeptToggle(dept)}
                        className={`flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-all duration-200 ${
                          checked
                            ? "bg-indigo-50/50 border-indigo-200 text-indigo-900"
                            : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={checked}
                          readOnly
                          className="h-4 w-4 accent-indigo-600 rounded cursor-pointer pointer-events-none"
                        />
                        <span className="text-xs font-semibold">{dept}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* STEP 4: Uploads / Capacity details */}
            {step === 4 && (
              <div className="flex flex-col gap-4 animate-in fade-in duration-200">
                <h4 className="text-sm font-bold text-slate-800">Step 4: Clinical Capacity details</h4>
                <div className="grid grid-cols-1 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] uppercase font-bold text-slate-450 tracking-wider">Total Bed Capacity</label>
                    <input
                      type="number"
                      name="capacity"
                      placeholder="e.g. 150"
                      value={form.capacity}
                      onChange={handleChange}
                      className="h-10 px-4 rounded-xl border border-slate-200 bg-white text-xs text-slate-800 outline-none transition focus:border-[#0E7490]"
                      required
                    />
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[10px] uppercase font-bold text-slate-450 tracking-wider">Clinical License Reference</label>
                    <input
                      type="text"
                      placeholder="Hospital registration licensing reference"
                      className="h-10 px-4 rounded-xl border border-slate-200 bg-white text-xs text-slate-800 outline-none transition focus:border-[#0E7490]"
                      required
                    />
                  </div>
                </div>
              </div>
            )}

            {/* STEP 5: Review & Submit */}
            {step === 5 && (
              <div className="flex flex-col gap-4 animate-in fade-in duration-200">
                <h4 className="text-sm font-bold text-slate-800">Step 5: Verify & Submit Details</h4>
                <div className="flex flex-col gap-4 bg-slate-50 rounded-2xl p-5 border border-slate-100/50">
                  <div className="text-xs text-slate-650 flex flex-col gap-2">
                    <p><strong>Hospital Name:</strong> {form.name}</p>
                    <p><strong>Location:</strong> {form.street}, {form.city}, {form.state} {form.zip}</p>
                    <p><strong>Selected Departments:</strong> {form.departments.join(", ")}</p>
                    <p><strong>Beds:</strong> {form.capacity}</p>
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
                      We declare that the clinic licensing references and ward capacities submitted are accurate. We request a partner account for MediHospi digitization.
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
