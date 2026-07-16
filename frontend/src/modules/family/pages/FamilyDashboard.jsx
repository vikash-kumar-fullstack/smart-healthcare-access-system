import React, { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { 
  Users, Plus, Calendar, Clock, Heart, Trash2, 
  ShieldCheck, Mail, ShieldAlert, Sparkles, X, UserCheck 
} from "lucide-react";
import toast from "react-hot-toast";
import { 
  getFamilyMembers, 
  addFamilyMember, 
  deleteFamilyMember, 
  revokeConsent 
} from "../services/familyService";

export default function FamilyDashboard() {
  const [members, setMembers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);

  // Form Wizard State
  const [step, setStep] = useState(1);
  const [relationType, setRelationType] = useState("Child");
  const [name, setName] = useState("");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState("Male");
  const [phone, setPhone] = useState("");
  const [bloodGroup, setBloodGroup] = useState("O+");
  const [email, setEmail] = useState("");
  const [validUntil, setValidUntil] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const fetchMembers = async () => {
    try {
      setLoading(true);
      const res = await getFamilyMembers();
      if (res.success) {
        setMembers(res.data || []);
      }
    } catch (err) {
      console.error(err);
      toast.error("Failed to load family members.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, []);

  const calculateAge = (dobString) => {
    if (!dobString) return "N/A";
    const birthday = new Date(dobString);
    const ageDifMs = Date.now() - birthday.getTime();
    const ageDate = new Date(ageDifMs);
    return Math.abs(ageDate.getUTCFullYear() - 1970);
  };

  const handleAddMember = async () => {
    setSubmitting(true);
    try {
      const payload = {
        relationType,
        name,
        dob,
        gender,
        phone: phone || undefined,
        bloodGroup,
        email: email || undefined,
        validUntil: validUntil || undefined
      };
      const res = await addFamilyMember(payload);
      if (res.success) {
        toast.success("Family member profile created successfully!");
        setShowAddModal(false);
        // Reset Form
        setStep(1);
        setName("");
        setDob("");
        setPhone("");
        setEmail("");
        setValidUntil("");
        fetchMembers();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to create profile.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveMember = async (relativeId) => {
    const confirm = window.confirm("Are you sure you want to remove/archive this family member profile?");
    if (!confirm) return;
    try {
      const res = await deleteFamilyMember(relativeId);
      if (res.success) {
        toast.success("Family member archived successfully.");
        fetchMembers();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to remove member.");
    }
  };

  const handleRevokeConsent = async (relativeId) => {
    const reason = window.prompt("Enter justification for revoking consent:", "Patient request");
    if (reason === null) return;
    try {
      const res = await revokeConsent(relativeId, reason);
      if (res.success) {
        toast.success("Relationship consent revoked.");
        fetchMembers();
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to revoke consent.");
    }
  };

  return (
    <div className="bg-white rounded-3xl border border-slate-200/60 p-6 shadow-sm hover-card-trigger space-y-6 text-left">
      <div className="flex items-center justify-between border-b border-slate-100 pb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center border border-blue-100 shadow-2xs shrink-0">
            <Users className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-lg font-black text-slate-800 tracking-tight">Family Care Center</h3>
            <p className="text-xs text-slate-450 font-bold uppercase tracking-wider mt-0.5">Managed Sub-Profiles & Health Consent Links</p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setStep(1);
            setShowAddModal(true);
          }}
          className="flex items-center justify-center gap-1.5 bg-[#0F4C81] hover:bg-[#0c3d68] text-white font-extrabold text-xs px-4 h-10 rounded-xl transition cursor-pointer shadow-3xs border-none"
        >
          <Plus className="h-4 w-4" /> Add Family Member
        </button>
      </div>

      {loading ? (
        <div className="text-center py-6 text-slate-400">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mx-auto mb-2" />
          Loading family profiles...
        </div>
      ) : members.length === 0 ? (
        <div className="text-center py-8 text-slate-400 bg-slate-50/50 rounded-2xl border border-dashed border-slate-200/60">
          No family profiles added to your account yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {members.map((member) => {
            const relId = member.relativeId?._id || member.relativeId?.id;
            const status = member.status;
            return (
              <div 
                key={member._id} 
                className="bg-slate-50/40 p-5 rounded-2xl border border-slate-150 hover-card-trigger flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-white border border-slate-200 rounded-xl flex items-center justify-center font-black text-slate-700 shrink-0 text-sm">
                        {member.relationType === "Child" ? "👦" : member.relationType === "Spouse" ? "👩" : "👴"}
                      </div>
                      <div>
                        <h4 className="font-extrabold text-slate-800 text-sm">{member.relativeId?.name}</h4>
                        <p className="text-[11px] text-slate-450 font-bold uppercase tracking-wider mt-0.5">
                          {member.relationType} • Age {calculateAge(member.relativeId?.dob)}
                        </p>
                      </div>
                    </div>
                    <span className={`text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-wider border ${
                      status === "ACTIVE" 
                        ? "bg-emerald-50 text-emerald-700 border-emerald-100" 
                        : "bg-amber-50 text-amber-700 border-amber-100 animate-pulse"
                    }`}>
                      {status}
                    </span>
                  </div>

                  {/* Active Booking Detail */}
                  {member.activeBooking ? (
                    <div className="bg-white p-3 rounded-xl border border-slate-150 text-xs flex items-center gap-2">
                      <Calendar className="h-3.5 w-3.5 text-blue-500 animate-bounce" />
                      <span className="font-bold text-slate-700">
                        Active Appt: {member.activeBooking.bookingDate} {member.activeBooking.slotTime} with Dr. {member.activeBooking.doctorId?.name || "Clinician"}
                      </span>
                    </div>
                  ) : (
                    <div className="text-[10px] text-slate-450 italic font-semibold">
                      No active appointment
                    </div>
                  )}

                  {/* Expiry Details */}
                  {member.validUntil && (
                    <div className="text-[10px] text-slate-400 font-mono font-bold flex items-center gap-1">
                      <Clock className="h-3 w-3" /> Valid Until: {new Date(member.validUntil).toLocaleDateString()}
                    </div>
                  )}

                  {/* Invitation Token View (For testing Spouse links) */}
                  {status === "PENDING" && member.invitationToken && (
                    <div className="bg-white p-3 rounded-xl border border-amber-100 text-[10px] font-mono space-y-1">
                      <div className="text-amber-700 font-bold">SPOUSE INVITATION PENDING:</div>
                      <div className="text-slate-600 break-all select-all font-semibold bg-slate-50 p-1.5 rounded border border-slate-150">
                        {member.invitationToken}
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 justify-end border-t border-slate-100 pt-3">
                  {member.managementType === "INVITATION_REQUIRED" && status === "ACTIVE" && (
                    <button
                      type="button"
                      onClick={() => handleRevokeConsent(relId)}
                      className="px-3 py-1.5 bg-rose-50 border border-rose-100 hover:bg-rose-100 text-rose-700 font-extrabold rounded-lg text-[10px] transition cursor-pointer"
                    >
                      Revoke Consent
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => handleRemoveMember(relId)}
                    className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-slate-50 border border-slate-200 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-150 text-slate-500 font-extrabold rounded-lg text-[10px] transition cursor-pointer"
                  >
                    <Trash2 className="h-3 w-3" /> Archive
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* --- ADD FAMILY MEMBER DIALOG WIZARD --- */}
      {showAddModal && createPortal(
        <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white w-full max-w-md rounded-3xl border border-slate-200/50 shadow-2xl p-6 relative animate-fade-in-up space-y-6">
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition"
            >
              <X className="h-5 w-5" />
            </button>

            <div>
              <div className="flex items-center gap-2 mb-1">
                <Sparkles className="h-5 w-5 text-blue-500 animate-spin" />
                <h3 className="text-lg font-black text-slate-800 tracking-tight">Add Family Member</h3>
              </div>
              <div className="flex gap-1.5 items-center text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <span>Step {step} of 3</span>
                <span>•</span>
                <span className="text-blue-600 font-bold">
                  {step === 1 && "Relationship Selection"}
                  {step === 2 && "Basic Demographics"}
                  {step === 3 && "Rules & Permissions"}
                </span>
              </div>
            </div>

            {/* --- STEP 1: RELATIONSHIP SELECTION --- */}
            {step === 1 && (
              <div className="space-y-4">
                <label className="text-[10px] text-slate-400 uppercase tracking-widest font-black block">Who are you adding?</label>
                <div className="grid grid-cols-2 gap-2">
                  {["Child", "Parent", "Spouse", "Dependent", "Guardian", "Caregiver", "Other"].map((role) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => setRelationType(role)}
                      className={`py-3 px-2 rounded-xl text-xs font-bold border transition text-center cursor-pointer ${
                        relationType === role
                          ? "bg-blue-600 border-blue-650 text-white shadow-md shadow-blue-100"
                          : "bg-white border-slate-200 text-slate-700 hover:border-blue-200"
                      }`}
                    >
                      {role}
                    </button>
                  ))}
                </div>

                <div className="bg-slate-50 p-4 rounded-xl border border-slate-150 text-xs text-slate-550 leading-relaxed font-semibold">
                  Relationship roles govern record sharing permissions, account links, and invitation flows automatically.
                </div>

                <button
                  type="button"
                  onClick={() => setStep(2)}
                  className="w-full bg-[#0F4C81] hover:bg-[#0c3d68] text-white font-extrabold text-xs py-3.5 rounded-xl cursor-pointer shadow-3xs"
                >
                  Continue to Demographics
                </button>
              </div>
            )}

            {/* --- STEP 2: DEMOGRAPHICS --- */}
            {step === 2 && (
              <div className="space-y-4">
                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] text-slate-400 uppercase tracking-widest font-black block mb-1">Full Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Rahul Kumar"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      autoComplete="off"
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs focus:border-[#0E7490] outline-none text-slate-700 font-bold focus:ring-2 focus:ring-blue-100"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-400 uppercase tracking-widest font-black block mb-1">DOB</label>
                      <input
                        type="date"
                        value={dob}
                        onChange={(e) => setDob(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs focus:border-[#0E7490] outline-none text-slate-700 font-bold focus:ring-2 focus:ring-blue-100"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 uppercase tracking-widest font-black block mb-1">Gender</label>
                      <select
                        value={gender}
                        onChange={(e) => setGender(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs focus:border-[#0E7490] outline-none text-slate-700 font-bold focus:ring-2 focus:ring-blue-100 cursor-pointer"
                      >
                        <option>Male</option>
                        <option>Female</option>
                        <option>Other</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-400 uppercase tracking-widest font-black block mb-1">Phone (Optional)</label>
                      <input
                        type="text"
                        placeholder="e.g. +91 9988776655"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        autoComplete="off"
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs focus:border-[#0E7490] outline-none text-slate-700 font-bold focus:ring-2 focus:ring-blue-100"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-400 uppercase tracking-widest font-black block mb-1">Blood Group</label>
                      <select
                        value={bloodGroup}
                        onChange={(e) => setBloodGroup(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs focus:border-[#0E7490] outline-none text-slate-700 font-bold focus:ring-2 focus:ring-blue-100 cursor-pointer"
                      >
                        {["A+", "A-", "B+", "B-", "O+", "O-", "AB+", "AB-"].map(bg => (
                          <option key={bg}>{bg}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {relationType === "Spouse" && (
                    <div>
                      <label className="text-[10px] text-slate-400 uppercase tracking-widest font-black block mb-1">Email (Required for Spouse)</label>
                      <input
                        type="email"
                        placeholder="spouse@health.local"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs focus:border-[#0E7490] outline-none text-slate-700 font-bold focus:ring-2 focus:ring-blue-100"
                      />
                    </div>
                  )}

                  {relationType === "Caregiver" && (
                    <div>
                      <label className="text-[10px] text-slate-400 uppercase tracking-widest font-black block mb-1">Temporary Expiry Date</label>
                      <input
                        type="date"
                        value={validUntil}
                        onChange={(e) => setValidUntil(e.target.value)}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2.5 text-xs focus:border-[#0E7490] outline-none text-slate-700 font-bold focus:ring-2 focus:ring-blue-100"
                      />
                    </div>
                  )}
                </div>

                <div className="flex gap-2 justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => setStep(1)}
                    className="px-5 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-650 font-extrabold text-xs rounded-xl cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={() => setStep(3)}
                    className="px-6 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl cursor-pointer"
                  >
                    Next Step
                  </button>
                </div>
              </div>
            )}

            {/* --- STEP 3: RULES & RULES ENGINE SUMMARY --- */}
            {step === 3 && (
              <div className="space-y-5">
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-150 space-y-4 text-xs font-semibold">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Relationship Mapping Review</span>
                  <div className="space-y-2.5 text-slate-700">
                    <div className="flex justify-between">
                      <span className="text-slate-450">Relation:</span>
                      <span className="font-extrabold text-slate-800">{relationType}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-450">Access Mode:</span>
                      <span className="font-extrabold text-[#0E7490]">
                        {relationType === "Child" ? "FULL_ACCESS" : relationType === "Parent" ? "CAREGIVER_ACCESS" : "INVITATION_REQUIRED"}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-450">Ownership type:</span>
                      <span className="font-extrabold text-[#0F4C81]">
                        {relationType === "Child" ? "GUARDIAN_MANAGED" : relationType === "Spouse" ? "SHARED_MANAGED" : "SELF_MANAGED"}
                      </span>
                    </div>
                    <div className="flex justify-between border-t border-slate-200/60 pt-2">
                      <span className="text-slate-450">Status:</span>
                      <span className="font-black text-slate-800 uppercase tracking-wider">
                        {relationType === "Spouse" ? "INVITATION_PENDING" : "ACTIVE"}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-2 justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => setStep(2)}
                    className="px-5 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-650 font-extrabold text-xs rounded-xl cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    onClick={handleAddMember}
                    disabled={submitting}
                    className="px-8 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs rounded-xl cursor-pointer shadow-3xs disabled:opacity-50"
                  >
                    {submitting ? "Creating..." : "Confirm & Save"}
                  </button>
                </div>
              </div>
            )}

          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
