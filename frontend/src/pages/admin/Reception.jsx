import { useState, useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import api from "../../services/api";
import toast from "react-hot-toast";
import {
  Search,
  UserCheck,
  ArrowLeftRight,
  PlusCircle,
  XSquare,
  AlertCircle,
  RefreshCw,
  Phone,
  Clock,
  Sparkles,
  ShieldAlert,
  User,
  Hospital,
  Users,
  Calendar,
  FileSpreadsheet,
  CheckCircle,
  HelpCircle,
  TrendingUp,
  Heart,
  Printer
} from "lucide-react";
import Button from "../../components/landing/Button";

export default function Reception() {
  const location = useLocation();
  const navigate = useNavigate();
  const queryParams = new URLSearchParams(location.search);
  const activeTab = queryParams.get("tab") || "dashboard";

  const [profile, setProfile] = useState({
    name: "Receptionist",
    hospitalName: "St. Mary Health Center",
    shift: "General"
  });
  const [bookings, setBookings] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [lookupVal, setLookupVal] = useState("");

  // Walk-in Form State
  const [walkInForm, setWalkInForm] = useState({
    patientName: "",
    patientPhone: "",
    doctorId: "",
    isPriority: false
  });

  // Transfer Form State
  const [transferBookingId, setTransferBookingId] = useState("");
  const [transferDoctorId, setTransferDoctorId] = useState("");
  const [transferReason, setTransferReason] = useState("");

  // Rebook Form State
  const [rebookBookingId, setRebookBookingId] = useState("");
  const [rebookDate, setRebookDate] = useState("");
  const [rebookSlot, setRebookSlot] = useState("");
  const [rebookReason, setRebookReason] = useState("");

  // Cancel/NoShow state
  const [overrideTargetId, setOverrideTargetId] = useState("");
  const [overrideAction, setOverrideAction] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [showOverrideModal, setShowOverrideModal] = useState(false);

  const fetchProfile = async () => {
    try {
      const res = await api.get("/reception/profile");
      if (res.data.success) {
        setProfile(res.data.data);
      }
    } catch (err) {
      console.error("Failed to load receptionist profile context:", err);
    }
  };

  const fetchDoctors = async () => {
    try {
      const res = await api.get("/reception/doctors");
      if (res.data.success) {
        setDoctors(res.data.data);
      }
    } catch (err) {
      console.error("Failed to load active duty doctors:", err);
    }
  };

  const fetchBookings = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/reception/dashboard?search=${search}`);
      if (res.data.success) {
        setBookings(res.data.data);
      }
    } catch (err) {
      toast.error("Failed to load dashboard bookings.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
    fetchDoctors();
  }, []);

  useEffect(() => {
    fetchBookings();
  }, [search]);

  const handleRegisterWalkIn = async (e) => {
    e.preventDefault();
    if (!walkInForm.doctorId || !walkInForm.patientName || !walkInForm.patientPhone) {
      toast.error("Please fill in all walk-in details.");
      return;
    }
    const t = toast.loading("Registering walk-in...");
    try {
      await api.post("/reception/walkin", walkInForm);
      toast.success("Walk-in registered successfully!", { id: t });
      setWalkInForm({ patientName: "", patientPhone: "", doctorId: "", isPriority: false });
      fetchBookings();
      navigate("/reception"); // switch back to dashboard
    } catch (err) {
      toast.error(err.response?.data?.message || "Registration failed.", { id: t });
    }
  };

  const handleCheckInDirect = async (bookingId, reasonText = "") => {
    let reason = reasonText;
    if (!reason) {
      reason = window.prompt("Enter Check-in override reason:");
      if (reason === null) return; // cancelled
      if (!reason.trim()) {
        toast.error("Override reason is mandatory.");
        return;
      }
    }

    const t = toast.loading("Logging check-in...");
    try {
      await api.post("/reception/checkin", { bookingId, reason });
      toast.success("Check-in override logged successfully!", { id: t });
      fetchBookings();
    } catch (err) {
      toast.error(err.response?.data?.message || "Check-in failed.", { id: t });
    }
  };

  const handlePrintToken = (booking) => {
    const printWindow = window.open("", "_blank");
    printWindow.document.write(`
      <html>
        <head>
          <title>MedHospi Queue Token</title>
          <style>
            body { font-family: monospace; text-align: center; padding: 20px; color: #333; }
            .ticket { border: 2px dashed #000; padding: 20px; display: inline-block; }
            h1 { font-size: 20px; margin: 0 0 10px 0; }
            .token { font-size: 36px; font-weight: bold; margin: 15px 0; border: 1px solid #000; padding: 5px; }
            .details { text-align: left; font-size: 11px; line-height: 1.6; }
            .footer { margin-top: 15px; font-size: 9px; border-top: 1px dashed #000; padding-top: 10px; }
          </style>
        </head>
        <body onload="window.print(); window.close();">
          <div class="ticket">
            <h1>MEDHOSPI QUEUE</h1>
            <p>${profile.hospitalName || "Partner Clinic"}</p>
            <div class="token">${booking.bookingNumber}</div>
            <div class="details">
              <strong>Patient:</strong> ${booking.userId?.name}<br/>
              <strong>Doctor:</strong> Dr. ${booking.doctorId?.name}<br/>
              <strong>Specialty:</strong> ${booking.doctorId?.specialization}<br/>
              <strong>Check-in Time:</strong> ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </div>
            <div class="footer">
              Please wait for your token to be announced.
            </div>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleTransferSubmit = async (e) => {
    e.preventDefault();
    if (!transferBookingId || !transferDoctorId || !transferReason.trim()) {
      toast.error("Booking ID, target doctor and reason are required.");
      return;
    }

    const t = toast.loading("Transferring patient...");
    try {
      await api.post("/reception/transfer", {
        bookingId: transferBookingId,
        newDoctorId: transferDoctorId,
        reason: transferReason
      });
      toast.success("Patient transferred successfully!", { id: t });
      setTransferBookingId("");
      setTransferDoctorId("");
      setTransferReason("");
      fetchBookings();
      navigate("/reception"); // go back to dashboard
    } catch (err) {
      toast.error(err.response?.data?.message || "Transfer failed.", { id: t });
    }
  };

  const handleOverrideAction = async (e) => {
    e.preventDefault();
    if (!overrideReason.trim()) {
      toast.error("Override reason is mandatory.");
      return;
    }

    const t = toast.loading("Logging override action...");
    try {
      await api.post("/reception/override", {
        bookingId: overrideTargetId,
        action: overrideAction,
        reason: overrideReason,
        rebookDate,
        rebookSlot
      });
      toast.success("Override action logged successfully!", { id: t });
      setShowOverrideModal(false);
      setOverrideTargetId("");
      setOverrideAction("");
      setOverrideReason("");
      setRebookDate("");
      setRebookSlot("");
      fetchBookings();
    } catch (err) {
      toast.error(err.response?.data?.message || "Override failed.", { id: t });
    }
  };

  // Filter bookings based on activeTab filters
  const filteredBookings = bookings.filter(b => {
    if (activeTab === "emergency") {
      return b.arrivalStatus === "CHECKED_IN" && b.status === "READY";
    }
    return true;
  });

  return (
    <div className="space-y-8 text-left animate-fade-in-up">
      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-fade-in-up {
          animation: fadeInUp 0.75s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        .hover-card-trigger {
          transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .hover-card-trigger:hover {
          transform: translateY(-4px);
          box-shadow: 0 20px 40px -15px rgba(15, 76, 129, 0.06);
        }
        .verification-glow {
          box-shadow: 0 0 30px rgba(20, 184, 166, 0.15);
          border-color: rgba(20, 184, 166, 0.25) !important;
        }
      `}</style>
      {/* Scoped Header Panel */}
      <div className="bg-gradient-to-r from-[#0F4C81] to-[#14B8A6] p-7 rounded-[32px] text-white shadow-lg relative overflow-hidden flex flex-col xl:flex-row xl:items-center xl:justify-between gap-6">
        <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full blur-2xl pointer-events-none" />
        
        <div className="space-y-1.5 z-10 text-left shrink-0">
          <div className="flex items-center gap-2 bg-white/10 px-3 py-1 rounded-full text-[10px] font-bold w-fit uppercase tracking-wider backdrop-blur-md">
            <Hospital className="h-3.5 w-3.5" />
            {profile.hospitalName || "Hospital Desk"}
          </div>
          <h1 className="text-2xl font-black tracking-tight mt-1">Reception Desk</h1>
          <p className="text-xs text-white/80">Manage active clinic bookings, logs, walk-ins, and doctor duty handovers.</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 bg-black/15 p-5 rounded-2xl backdrop-blur-md z-10 w-full xl:w-auto">
          <div>
            <p className="text-[9px] uppercase font-black text-white/70">Receptionist</p>
            <p className="text-xs font-black text-white mt-0.5">{profile.name}</p>
          </div>
          <div>
            <p className="text-[9px] uppercase font-black text-white/70">Hospital</p>
            <p className="text-xs font-black text-cyan-200 mt-0.5">{profile.hospitalName || "St Mary's"}</p>
          </div>
          <div>
            <p className="text-[9px] uppercase font-black text-white/70">Shift Schedule</p>
            <p className="text-xs font-black text-[#FFD700] mt-0.5">{profile.shift} (09:00 - 17:00)</p>
          </div>
          <div>
            <p className="text-[9px] uppercase font-black text-white/70">Station Counter</p>
            <p className="text-xs font-black text-white mt-0.5">Counter 2</p>
          </div>
          <div>
            <p className="text-[9px] uppercase font-black text-white/70">Desk Status</p>
            <p className="text-xs font-black text-emerald-400 mt-0.5">Online • Active</p>
          </div>
        </div>
      </div>

      {/* RENDER VIEWS BASED ON ACTIVE TAB */}

      {/* 1. Walk-ins Tab */}
      {activeTab === "walkins" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200/60 p-6 shadow-sm hover-card-trigger">
            <h3 className="text-lg font-black text-slate-800 tracking-tight flex items-center gap-2 mb-4">
              <PlusCircle className="h-5 w-5 text-[#0E7490]" />
              New Walk-In Registration
            </h3>
            <form onSubmit={handleRegisterWalkIn} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5 text-left">
                  <label className="text-xs font-bold text-slate-650">Patient Full Name</label>
                  <input
                    type="text"
                    required
                    value={walkInForm.patientName}
                    onChange={(e) => setWalkInForm({ ...walkInForm, patientName: e.target.value })}
                    placeholder="e.g. Rahul Sharma"
                    className="h-11 px-4 border border-slate-200 rounded-xl text-sm outline-none focus:border-[#0E7490]"
                  />
                </div>
                <div className="flex flex-col gap-1.5 text-left">
                  <label className="text-xs font-bold text-slate-650">Patient Contact Phone</label>
                  <input
                    type="tel"
                    required
                    value={walkInForm.patientPhone}
                    onChange={(e) => setWalkInForm({ ...walkInForm, patientPhone: e.target.value })}
                    placeholder="10-digit mobile number"
                    className="h-11 px-4 border border-slate-200 rounded-xl text-sm outline-none focus:border-[#0E7490]"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1.5 text-left">
                <label className="text-xs font-bold text-slate-650">Assign Consulting Doctor</label>
                <select
                  required
                  value={walkInForm.doctorId}
                  onChange={(e) => setWalkInForm({ ...walkInForm, doctorId: e.target.value })}
                  className="h-11 px-4 border border-slate-200 rounded-xl text-sm bg-white outline-none focus:border-[#0E7490]"
                >
                  <option value="">Select doctor on duty...</option>
                  {doctors.map(d => (
                    <option key={d._id} value={d._id}>Dr. {d.name} ({d.specialization})</option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2.5 pt-2">
                <input
                  type="checkbox"
                  id="walkin-priority"
                  checked={walkInForm.isPriority}
                  onChange={(e) => setWalkInForm({ ...walkInForm, isPriority: e.target.checked })}
                  className="h-4 w-4 text-[#0E7490] rounded focus:ring-[#0E7490]"
                />
                <label htmlFor="walkin-priority" className="text-xs font-bold text-slate-700 flex items-center gap-1.5 select-none cursor-pointer">
                  <ShieldAlert className="h-4 w-4 text-red-500" />
                  Mark as High Priority (Fast-track to position 1)
                </label>
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  className="bg-[#0E7490] hover:bg-[#0c5f76] text-white text-xs font-bold py-2.5 px-6 rounded-xl shadow-md w-full sm:w-auto"
                >
                  REGISTER PATIENT
                </Button>
              </div>
            </form>
          </div>

          <div className="bg-slate-50/50 border border-slate-200 rounded-3xl p-6 hover-card-trigger">
            <h4 className="font-extrabold text-slate-800 text-sm mb-3">Live Walk-in Guidelines</h4>
            <ul className="text-xs text-slate-500 space-y-3 list-disc pl-4 leading-relaxed">
              <li>Use walk-in registration for patients arriving without online reservations.</li>
              <li>Standard walk-ins are appended to the end of the doctor's queue session.</li>
              <li><strong>High Priority</strong> flags should only be checked for emergency triage, placing them at position 1.</li>
              <li>Always verify phone numbers to cross-link existing Medical Records history.</li>
            </ul>
          </div>
        </div>
      )}

      {/* 2. Transfers Tab */}
      {activeTab === "transfers" && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-left">
          <div className="lg:col-span-2 bg-white rounded-3xl border border-slate-200/60 p-6 shadow-sm hover-card-trigger">
            <h3 className="text-lg font-black text-slate-800 tracking-tight flex items-center gap-2 mb-4">
              <ArrowLeftRight className="h-5 w-5 text-[#0E7490]" />
              Queue Patient Transfer Control
            </h3>
            <form onSubmit={handleTransferSubmit} className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-650">Select Active Booking Reference</label>
                <select
                  required
                  value={transferBookingId}
                  onChange={(e) => setTransferBookingId(e.target.value)}
                  className="h-11 px-4 border border-slate-200 rounded-xl text-sm bg-white outline-none focus:border-[#0E7490]"
                >
                  <option value="">Choose booking in line...</option>
                  {bookings.map(b => (
                    <option key={b._id} value={b._id}>
                      {b.bookingNumber} - {b.userId?.name} (Current: Dr. {b.doctorId?.name})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-650">Select Destination Doctor</label>
                <select
                  required
                  value={transferDoctorId}
                  onChange={(e) => setTransferDoctorId(e.target.value)}
                  className="h-11 px-4 border border-slate-200 rounded-xl text-sm bg-white outline-none focus:border-[#0E7490]"
                >
                  <option value="">Choose target doctor on duty...</option>
                  {doctors.map(d => (
                    <option key={d._id} value={d._id}>Dr. {d.name} ({d.specialization})</option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs font-bold text-slate-650">Reason for Queue Transfer</label>
                <textarea
                  required
                  rows="3"
                  value={transferReason}
                  onChange={(e) => setTransferReason(e.target.value)}
                  placeholder="e.g., Patient requested doctor specialized in specific area / Current doctor session delayed."
                  className="p-3 border border-slate-200 rounded-xl text-sm outline-none focus:border-[#0E7490]"
                />
              </div>

              <div className="pt-2">
                <Button
                  type="submit"
                  className="bg-[#0E7490] hover:bg-[#0c5f76] text-white text-xs font-bold py-2.5 px-6 rounded-xl shadow-md w-full sm:w-auto"
                >
                  EXECUTE TRANSFER
                </Button>
              </div>
            </form>
          </div>

          <div className="bg-slate-50/50 border border-slate-200 rounded-3xl p-6 hover-card-trigger">
            <h4 className="font-extrabold text-slate-800 text-sm mb-3">Transfer Auditing</h4>
            <p className="text-xs text-slate-500 leading-relaxed">
              All transfers trigger queue version updates and notify the target doctor automatically. Reasons are preserved in the patient's journey audit timeline.
            </p>
          </div>
        </div>
      )}

      {/* 3. Live Queue Monitor Tab */}
      {activeTab === "queuemonitor" && (
        <div className="bg-white rounded-3xl border border-slate-200/60 p-6 shadow-sm hover-card-trigger">
          <h3 className="text-lg font-black text-slate-800 tracking-tight flex items-center gap-2 mb-6">
            <Clock className="h-5 w-5 text-[#0E7490]" />
            Live Clinic Queue Status
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {doctors.map(d => {
              // Count waiting bookings for this doctor
              const waitingCount = bookings.filter(b => b.doctorId?._id?.toString() === d._id?.toString() && b.arrivalStatus === "CHECKED_IN").length;
              return (
                <div key={d._id} className="p-5 border border-slate-200/70 rounded-2xl bg-slate-50/50 flex items-center justify-between hover-card-trigger">
                  <div>
                    <h5 className="font-extrabold text-slate-800 text-sm">Dr. {d.name}</h5>
                    <p className="text-xs text-slate-455 mt-0.5">{d.specialization}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-xs font-black px-2.5 py-1 rounded-full bg-[#DFF8F6] text-[#0E7490]">
                      {waitingCount} waiting
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 4. Doctors List Tab */}
      {activeTab === "doctors" && (
        <div className="bg-white rounded-3xl border border-slate-200/60 p-6 shadow-sm hover-card-trigger">
          <h3 className="text-lg font-black text-slate-800 tracking-tight flex items-center gap-2 mb-6">
            <Users className="h-5 w-5 text-[#0E7490]" />
            Doctors Roster & Duty Logs
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {doctors.map(d => (
              <div key={d._id} className="p-6 border border-slate-200/60 rounded-3xl bg-white shadow-xs hover:shadow-md transition-all duration-300 relative overflow-hidden flex flex-col justify-between hover-card-trigger">
                <div className="flex items-start justify-between">
                  <div>
                    <h4 className="font-extrabold text-slate-850 text-base">Dr. {d.name}</h4>
                    <p className="text-xs text-slate-455 mt-0.5">{d.specialization}</p>
                  </div>
                  <span className={`px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider ${
                    d.availabilityStatus === "Available" ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : "bg-slate-100 text-slate-550"
                  }`}>
                    {d.availabilityStatus}
                  </span>
                </div>

                <div className="mt-5 pt-3.5 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs font-bold text-slate-400">
                  <div>Consultation Fee:</div>
                  <div className="text-right text-slate-800 font-extrabold">₹{d.consultationFee}</div>
                  <div>Rating:</div>
                  <div className="text-right text-slate-800 font-extrabold">⭐ {d.rating || "4.5"}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 5. Patient Search Tab */}
      {activeTab === "search" && (
        <div className="bg-white rounded-3xl border border-slate-200/60 p-6 shadow-sm hover-card-trigger">
          <h3 className="text-lg font-black text-slate-800 tracking-tight flex items-center gap-2 mb-5">
            <Search className="h-5 w-5 text-[#0E7490]" />
            Lookup Patient Registry
          </h3>
          <div className="space-y-5">
            <div className="relative flex items-center max-w-lg">
              <Search className="absolute left-3.5 h-4.5 w-4.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search patient by name or phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-11 w-full pl-11 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-[#0E7490] focus:bg-white focus:ring-2 focus:ring-[#0E7490]/5 font-semibold"
              />
            </div>

            <div className="border border-slate-200/60 rounded-2xl overflow-hidden shadow-xs">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-slate-550 font-black uppercase tracking-wider text-[10px]">
                    <th className="px-5 py-3.5">Patient Name</th>
                    <th className="px-5 py-3.5">Phone</th>
                    <th className="px-5 py-3.5">Active Booking ID</th>
                    <th className="px-5 py-3.5">Specialization Requested</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-semibold text-slate-600">
                  {bookings.map(b => (
                    <tr key={b._id} className="hover:bg-slate-50/50 transition">
                      <td className="px-5 py-4 font-extrabold text-slate-800">{b.userId?.name}</td>
                      <td className="px-5 py-4 font-mono font-bold text-slate-550">{b.userId?.phone}</td>
                      <td className="px-5 py-4 font-mono text-[#0E7490] font-black">{b.bookingNumber}</td>
                      <td className="px-5 py-4 text-slate-500">{b.doctorId?.specialization}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
          {/* 6. Reports / Summary Tab */}
      {activeTab === "reports" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 text-left">
          <div className="bg-white border border-slate-200/60 p-5 rounded-2xl flex items-center gap-4 shadow-sm hover-card-trigger">
            <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center shrink-0 border border-emerald-100 shadow-2xs">
              <CheckCircle className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Check-Ins</p>
              <h3 className="text-2xl font-black text-slate-800 mt-1">{bookings.filter(b => b.arrivalStatus === "CHECKED_IN").length}</h3>
            </div>
          </div>

          <div className="bg-white border border-slate-200/60 p-5 rounded-2xl flex items-center gap-4 shadow-sm hover-card-trigger">
            <div className="w-12 h-12 bg-[#DFF8F6] text-[#0E7490] rounded-xl flex items-center justify-center shrink-0 border border-cyan-100 shadow-2xs">
              <PlusCircle className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Today's Walk-ins</p>
              <h3 className="text-2xl font-black text-slate-800 mt-1">{bookings.filter(b => b.bookingNumber?.includes("-99")).length}</h3>
            </div>
          </div>

          <div className="bg-white border border-slate-200/60 p-5 rounded-2xl flex items-center gap-4 shadow-sm hover-card-trigger">
            <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center shrink-0 border border-rose-100 shadow-2xs">
              <XSquare className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cancellations</p>
              <h3 className="text-2xl font-black text-slate-800 mt-1">{bookings.filter(b => b.status === "CANCELLED").length}</h3>
            </div>
          </div>

          <div className="bg-white border border-slate-200/60 p-5 rounded-2xl flex items-center gap-4 shadow-sm hover-card-trigger">
            <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center shrink-0 border border-blue-100 shadow-2xs">
              <ArrowLeftRight className="h-6 w-6" />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Queue Size</p>
              <h3 className="text-2xl font-black text-slate-800 mt-1">{bookings.length}</h3>
            </div>
          </div>
        </div>
      )}

      {/* 7. Default Dashboard Tab (Table / Booking List) */}
      {(activeTab === "dashboard" || activeTab === "appointments" || activeTab === "emergency") && (
        <>
          {/* Action Header bar */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="relative flex items-center max-w-md w-full">
              <Search className="absolute left-3.5 h-4.5 w-4.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search by name, phone, or Booking ID..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-11 w-full pl-11 pr-4 bg-white border border-slate-200 rounded-xl text-xs outline-none focus:border-[#0E7490] focus:ring-2 focus:ring-[#0E7490]/5 font-semibold text-slate-700 shadow-3xs"
              />
            </div>

            <Button
              onClick={() => navigate("/reception?tab=walkins")}
              className="bg-[#0E7490] hover:bg-[#0c5f76] text-white flex items-center gap-2 rounded-xl text-xs py-3 px-5 shadow-md shrink-0 border-none cursor-pointer transition active:scale-95 font-extrabold uppercase tracking-wider"
            >
              <PlusCircle className="h-4.5 w-4.5" />
              NEW WALK-IN
            </Button>
          </div>

          {activeTab === "emergency" && (
            <div className="bg-rose-50 border border-rose-200 text-rose-800 p-4.5 rounded-2xl text-xs text-left font-bold animate-pulse">
              <span className="font-black block mb-1">🚨 EMERGENCY TRIAGE QUEUE MONITOR</span>
              Showing patients who have checked in and are ready to consult, or walk-ins marked as high priority.
            </div>
          )}

          {/* Bookings List Table */}
          {loading ? (
            <div className="space-y-4 animate-pulse">
              <div className="h-12 bg-slate-200/50 rounded-xl"></div>
              <div className="h-12 bg-slate-200/50 rounded-xl"></div>
            </div>
          ) : filteredBookings.length === 0 ? (
            <div className="bg-white border border-slate-200/60 rounded-3xl p-12 text-center text-slate-400 hover-card-trigger">
              <Clock className="h-10 w-10 mx-auto text-slate-350 mb-3" />
              <p className="text-sm font-extrabold text-slate-700">No Active Bookings found</p>
              <p className="text-xs font-semibold mt-1">Bookings or Walk-ins registered today will show up here.</p>
            </div>
          ) : (
            <div className="bg-white border border-slate-200/60 rounded-[24px] shadow-sm overflow-hidden hover-card-trigger">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                     <tr className="bg-slate-50 border-b border-slate-100 text-slate-550 font-black uppercase tracking-wider text-[10px]">
                      <th className="px-5 py-3.5">Booking ID</th>
                      <th className="px-5 py-3.5">Patient Info</th>
                      <th className="px-5 py-3.5">Doctor Assigned</th>
                      <th className="px-5 py-3.5">Slot Time</th>
                      <th className="px-5 py-3.5">Arrival Status</th>
                      <th className="px-5 py-3.5 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-semibold text-slate-655">
                    {filteredBookings.map(b => (
                      <tr key={b._id} className="hover:bg-slate-50/40 transition">
                        <td className="px-5 py-4 font-mono text-[#0E7490] font-black">{b.bookingNumber}</td>
                        <td className="px-5 py-4">
                          <div className="font-extrabold text-slate-800">{b.userId?.name}</div>
                          <div className="text-[10px] text-slate-400 font-bold mt-0.5">{b.userId?.phone}</div>
                        </td>
                        <td className="px-5 py-4">
                          <div className="font-extrabold text-slate-800">Dr. {b.doctorId?.name}</div>
                          <div className="text-[10px] text-slate-455 font-bold mt-0.5">{b.doctorId?.specialization}</div>
                        </td>
                        <td className="px-5 py-4 font-mono font-black text-slate-500">{b.slotTime}</td>
                        <td className="px-5 py-4">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                              b.arrivalStatus === "CHECKED_IN"
                                ? "bg-emerald-50 text-emerald-700 border border-emerald-100"
                                : b.arrivalStatus === "CHECK_IN_OPEN"
                                ? "bg-teal-50 text-teal-700 border border-teal-100"
                                : b.arrivalStatus === "NO_SHOW"
                                ? "bg-rose-50 text-rose-700 border border-rose-100"
                                : "bg-slate-50 text-slate-600 border border-slate-100"
                            }`}
                          >
                            {b.arrivalStatus?.replace("_", " ")}
                          </span>
                        </td>
                        <td className="px-5 py-4 text-right flex items-center justify-end gap-2">
                          {b.arrivalStatus !== "CHECKED_IN" && (
                            <button
                              onClick={() => handleCheckInDirect(b._id)}
                              className="px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-750 hover:bg-emerald-600 hover:text-white transition font-black text-[10px] cursor-pointer border border-emerald-250/20"
                            >
                              Check-In
                            </button>
                          )}

                          <button
                            onClick={() => {
                              setTransferBookingId(b._id);
                              navigate("/reception?tab=transfers");
                            }}
                            className="px-3 py-1.5 rounded-xl bg-blue-50 text-blue-750 hover:bg-blue-600 hover:text-white transition font-black text-[10px] cursor-pointer border border-blue-250/20"
                          >
                            Transfer
                          </button>

                          <button
                            onClick={() => {
                              setOverrideTargetId(b._id);
                              setOverrideAction("no_show");
                              setShowOverrideModal(true);
                            }}
                            className="px-3 py-1.5 rounded-xl bg-rose-50 text-rose-750 hover:bg-rose-600 hover:text-white transition font-black text-[10px] cursor-pointer border border-rose-250/20"
                          >
                            No Show
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
       {/* 8. Dedicated QR & Phone Check-in Desk Tab */}
      {activeTab === "checkin" && (
        <div className="space-y-6 animate-fade-in-up">
          <div className="bg-gradient-to-br from-[#0F4C81] to-[#0A5F76] text-white p-8 rounded-[24px] shadow-xl relative overflow-hidden flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 text-left hover-card-trigger">
            <div className="absolute top-0 right-0 w-80 h-80 bg-white/5 rounded-full blur-3xl pointer-events-none transform translate-x-10 -translate-y-10" />
            <div className="relative z-10">
              <h3 className="text-2xl font-black text-white tracking-tight flex items-center gap-2">
                <UserCheck className="h-6 w-6 text-teal-300 animate-bounce" />
                QR & Phone Check-in Desk
              </h3>
              <p className="text-xs text-cyan-100/90 mt-1">
                Scan patient QR code tickets or lookup phone number / Booking ID to verify check-ins.
              </p>
            </div>
            <button
              onClick={() => {
                const pending = bookings.find(b => b.arrivalStatus !== "CHECKED_IN");
                if (pending) {
                  setLookupVal(pending.bookingNumber);
                  toast.success(`Scanned QR code: ${pending.bookingNumber}`);
                } else {
                  toast.error("No pending bookings found today to scan.");
                }
              }}
              className="relative z-10 flex items-center justify-center gap-2 bg-[#14B8A6] hover:bg-[#119f90] active:bg-[#0e8376] text-white font-extrabold px-6 h-12 rounded-xl text-xs transition duration-200 shadow-md cursor-pointer border-none"
            >
              Simulate QR Scanner Tap
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Box: Scanner Box & Manual Entry */}
            <div className="lg:col-span-5 bg-white border border-slate-200/60 rounded-3xl p-6 shadow-sm flex flex-col gap-6 text-left hover-card-trigger">
              <div>
                <h4 className="font-extrabold text-slate-800 text-sm mb-1">Lookup Input</h4>
                <p className="text-xs font-semibold text-slate-400">Search by patient phone or alphanumeric Booking ID</p>
              </div>

              <div className="relative">
                <Search className="absolute left-3.5 top-3.5 h-4.5 w-4.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Enter Booking ID or Phone Number..."
                  value={lookupVal}
                  onChange={(e) => setLookupVal(e.target.value)}
                  className="h-11 w-full pl-11 pr-4 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-[#0E7490] focus:ring-2 focus:ring-[#0E7490]/5 font-semibold text-slate-700"
                />
              </div>

              {/* QR Scanner Simulation Frame */}
              <div className="border-2 border-dashed border-slate-200 rounded-2xl p-8 flex flex-col items-center justify-center text-center relative overflow-hidden bg-slate-50 min-h-[220px]">
                <div className="absolute top-4 left-4 w-4 h-4 border-t-2 border-l-2 border-slate-400" />
                <div className="absolute top-4 right-4 w-4 h-4 border-t-2 border-r-2 border-slate-400" />
                <div className="absolute bottom-4 left-4 w-4 h-4 border-b-2 border-l-2 border-slate-400" />
                <div className="absolute bottom-4 right-4 w-4 h-4 border-b-2 border-r-2 border-slate-400" />

                <div className="w-16 h-16 bg-[#0E7490]/10 text-[#0E7490] rounded-2xl flex items-center justify-center mb-3 border border-[#0E7490]/25 shadow-inner">
                  <UserCheck className="h-8 w-8" />
                </div>
                
                <h5 className="text-xs font-bold text-slate-700">QR Code Camera Feed</h5>
                <p className="text-[10px] font-semibold text-slate-450 mt-1 max-w-[180px] leading-relaxed">
                  Place patient ticket QR code directly in front of the counter webcam scanner.
                </p>

                <button
                  type="button"
                  onClick={() => {
                    const pending = bookings.find(b => b.arrivalStatus !== "CHECKED_IN");
                    if (pending) {
                      setLookupVal(pending.bookingNumber);
                      toast.success(`Scanned QR code: ${pending.bookingNumber}`);
                    } else {
                      toast.error("No pending bookings found today.");
                    }
                  }}
                  className="mt-4 px-4.5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 font-extrabold rounded-xl text-[10px] transition border-none cursor-pointer"
                >
                  Trigger Webcam Scanner
                </button>
              </div>
            </div>

            {/* Right Box: Verification Panel */}
            <div className="lg:col-span-7 bg-white border border-slate-200/60 rounded-3xl p-6 shadow-sm flex flex-col justify-between text-left min-h-[350px] hover-card-trigger verification-glow">
              {(() => {
                const booking = bookings.find(b => 
                  b.bookingNumber?.toLowerCase() === lookupVal.trim().toLowerCase() ||
                  b.userId?.phone === lookupVal.trim()
                );

                if (!booking) {
                  return (
                    <div className="my-auto flex flex-col items-center justify-center text-center p-8 text-slate-400 animate-in fade-in duration-150">
                      <HelpCircle className="w-12 h-12 text-slate-250 mb-3" />
                      <h4 className="text-sm font-extrabold text-slate-700">No Booking Selected</h4>
                      <p className="text-xs font-semibold text-slate-455 mt-1 max-w-xs leading-relaxed">
                        Enter a valid phone number or Booking ID on the left, or simulate scanning to inspect and verify.
                      </p>
                    </div>
                  );
                }

                const isCheckedIn = booking.arrivalStatus === "CHECKED_IN";

                return (
                  <div className="space-y-6 flex-1 flex flex-col justify-between animate-in fade-in duration-200">
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h4 className="font-extrabold text-slate-800 text-sm">Check-in Verification Panel</h4>
                        <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider ${
                          isCheckedIn 
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-100" 
                            : "bg-amber-50 text-amber-700 border border-amber-100"
                        }`}>
                          {booking.arrivalStatus?.replace("_", " ")}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-4 text-xs bg-slate-50/50 p-5 rounded-2xl border border-slate-100">
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Patient Name</p>
                          <p className="font-extrabold text-slate-800 mt-1">{booking.userId?.name}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Phone Number</p>
                          <p className="font-bold font-mono text-slate-800 mt-1">{booking.userId?.phone}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Booking Reference ID</p>
                          <p className="font-black font-mono text-[#0E7490] mt-1">{booking.bookingNumber}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Appointment Slot</p>
                          <p className="font-extrabold text-slate-800 mt-1">{booking.slotTime}</p>
                        </div>
                        <div className="col-span-2 border-t border-slate-200/60 pt-3 mt-1">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Assigned Doctor & Specialty</p>
                          <p className="font-extrabold text-slate-800 mt-1">
                            Dr. {booking.doctorId?.name} ({booking.doctorId?.specialization})
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="pt-6 border-t border-slate-100 space-y-3">
                      {isCheckedIn ? (
                        <div className="space-y-3">
                          <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 rounded-2xl p-4.5 flex items-center gap-3 justify-center">
                            <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
                            <div className="text-xs text-left">
                              <p className="font-extrabold">Check-In Verified</p>
                              <p className="text-emerald-600 mt-0.5 font-semibold">Ticket printed and queue position allotted.</p>
                            </div>
                          </div>
                          <button
                            onClick={() => handlePrintToken(booking)}
                            className="w-full py-3.5 rounded-xl bg-slate-800 hover:bg-slate-900 transition-all text-white font-extrabold text-xs shadow-md border-none cursor-pointer flex items-center justify-center gap-2 hover:scale-[1.01]"
                          >
                            <Printer className="w-4.5 h-4.5" />
                            PRINT QUEUE TOKEN SLIP
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => handleCheckInDirect(booking._id, "Checked in via Receptionist Desk Console")}
                          className="w-full py-3.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 active:scale-[0.98] transition-all text-white font-extrabold text-xs shadow-md border-none cursor-pointer hover:scale-[1.01]"
                        >
                          CONFIRM CHECK-IN & ALLOT QUEUE
                        </button>
                      )}
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      )}

      {/* Override Modal */}
      {showOverrideModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-4 z-[var(--z-modal)] animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl p-6 max-w-md w-full relative hover-card-trigger">
            <h2 className="text-lg font-black text-slate-800 tracking-tight mb-4 uppercase">
              RECEPTIONIST FORCE OVERRIDE CONTROL
            </h2>

            <form onSubmit={handleOverrideAction} className="space-y-4">
              <div className="flex flex-col gap-1">
                <label className="text-[9px] uppercase font-bold text-slate-455 tracking-wider">Select Override Action</label>
                <select
                  required
                  value={overrideAction}
                  onChange={(e) => setOverrideAction(e.target.value)}
                  className="h-10 w-full px-3 border border-slate-200 rounded-xl text-xs outline-none focus:border-[#0E7490] bg-white font-bold text-slate-700"
                >
                  <option value="no_show">Mark as No-Show (Cancel Booking)</option>
                  <option value="rebook">Rebook Appointment (Change Slot/Date)</option>
                  <option value="priority_bump">Force-Bump to Position 1 in Session</option>
                </select>
              </div>

              {overrideAction === "rebook" && (
                <>
                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] uppercase font-bold text-slate-455 tracking-wider">New Date</label>
                    <input
                      type="date"
                      required
                      value={rebookDate}
                      onChange={(e) => setRebookDate(e.target.value)}
                      className="h-10 w-full px-3 border border-slate-200 rounded-xl text-xs outline-none focus:border-[#0E7490] font-bold text-slate-700"
                    />
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-[9px] uppercase font-bold text-slate-455 tracking-wider">New Slot</label>
                    <input
                      type="text"
                      placeholder="e.g. 10:30 AM"
                      required
                      value={rebookSlot}
                      onChange={(e) => setRebookSlot(e.target.value)}
                      className="h-10 w-full px-3 border border-slate-200 rounded-xl text-xs outline-none focus:border-[#0E7490] font-bold text-slate-700"
                    />
                  </div>
                </>
              )}

              <div className="flex flex-col gap-1">
                <label className="text-[9px] uppercase font-bold text-slate-455 tracking-wider">Reason for Override</label>
                <textarea
                  required
                  rows="2"
                  value={overrideReason}
                  onChange={(e) => setOverrideReason(e.target.value)}
                  placeholder="Explain why this action is being performed..."
                  className="p-3 border border-slate-200 rounded-xl text-xs outline-none focus:border-[#0E7490] font-bold text-slate-700 bg-white"
                />
              </div>

              <div className="flex justify-end gap-2.5 mt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowOverrideModal(false);
                    setOverrideTargetId("");
                    setOverrideAction("");
                    setOverrideReason("");
                  }}
                  className="px-4 py-2 text-xs font-bold text-slate-500 hover:bg-slate-50 rounded-xl transition cursor-pointer border-none bg-transparent"
                >
                  Cancel
                </button>
                <Button
                  type="submit"
                  className="bg-[#0E7490] hover:bg-[#0c5f76] text-white text-xs font-bold py-2.5 px-5 rounded-xl shadow-md border-none cursor-pointer transition active:scale-95"
                >
                  SUBMIT OVERRIDE
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
