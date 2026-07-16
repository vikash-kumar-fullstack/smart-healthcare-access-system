import { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import api from "../../services/api";
import toast from "react-hot-toast";
import { Sparkles, Calendar, MapPin, Stethoscope, ArrowRight, ArrowLeft, Clock, Shield, Users } from "lucide-react";

const groupSlotsByShift = (slotsList, dateStr) => {
  const isWeekend = (() => {
    if (!dateStr) return false;
    const [year, month, day] = dateStr.split("-").map(Number);
    const d = new Date(year, month - 1, day);
    const dayOfWeek = d.getDay();
    return dayOfWeek === 0 || dayOfWeek === 6; // Sunday or Saturday
  })();

  const grouped = {
    Morning: [],
    General: [],
    Evening: [],
    Night: [],
    Weekend: []
  };

  slotsList.forEach(s => {
    if (isWeekend) {
      grouped.Weekend.push(s);
      return;
    }
    const [hStr] = s.time.split(":");
    const hour = parseInt(hStr, 10);

    if (hour >= 6 && hour < 12) {
      grouped.Morning.push(s);
    } else if (hour >= 12 && hour < 16) {
      grouped.General.push(s);
    } else if (hour >= 16 && hour < 20) {
      grouped.Evening.push(s);
    } else {
      grouped.Night.push(s);
    }
  });

  return grouped;
};

export default function BookingJourney() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  // Route query params
  const paramHospitalId = searchParams.get("hospitalId");
  const paramDoctorId = searchParams.get("doctorId");

  // Wizard steps: 0 = Patient Select, 1 = Hospital, 2 = Doctor, 3 = Date & Slot, 4 = Summary
  const [step, setStep] = useState(0);

  const [familyMembers, setFamilyMembers] = useState([]);
  const [familyLoading, setFamilyLoading] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState(null); // null = Self

  useEffect(() => {
    const fetchFamily = async () => {
      setFamilyLoading(true);
      try {
        const res = await api.get("/family");
        if (res.data?.success) {
          setFamilyMembers(res.data.data || []);
        }
      } catch (err) {
        console.error("Failed to load family members", err);
      } finally {
        setFamilyLoading(false);
      }
    };
    fetchFamily();
  }, []);

  // Loaded database entities
  const [hospitals, setHospitals] = useState([]);
  const [hospitalsLoading, setHospitalsLoading] = useState(false);
  const [doctors, setDoctors] = useState([]);
  const [doctorsLoading, setDoctorsLoading] = useState(false);

  // Selection states
  const [selectedHospital, setSelectedHospital] = useState(null);
  const [selectedDoctor, setSelectedDoctor] = useState(null);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedSlot, setSelectedSlot] = useState(null);

  // Slots loading state
  const [slots, setSlots] = useState([]);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);

  // Step 1: Fetch partnered hospitals
  useEffect(() => {
    if (paramHospitalId && paramDoctorId) return; // Skip if direct booking handles it
    const fetchHospitals = async () => {
      setHospitalsLoading(true);
      try {
        const res = await api.get("/hospitals?limit=50");
        if (res.data?.success) {
          const payload = res.data.data;
          // API returns paginated {total, page, limit, data: [hospitals]}
          const hospitalsArray = Array.isArray(payload)
            ? payload
            : Array.isArray(payload?.data)
              ? payload.data
              : [];
          setHospitals(hospitalsArray);
          if (paramHospitalId) {
            const matched = hospitalsArray.find(
              (h) => String(h._id || h.id) === String(paramHospitalId)
            );
            if (matched) {
              setSelectedHospital(matched);
              // Do not auto-transition step; let user select patient profile first (Step 0)
            }
          }
        }
      } catch (err) {
        console.error(err);
        toast.error("Failed to load partnered hospitals.");
      } finally {
        setHospitalsLoading(false);
      }
    };
    fetchHospitals();
  }, [paramHospitalId]);

  // Step 2: Fetch doctors when hospital changes
  useEffect(() => {
    if (paramHospitalId && paramDoctorId) return; // Skip if direct booking handles it
    if (!selectedHospital) return;
    const fetchDoctors = async () => {
      setDoctorsLoading(true);
      try {
        const hospId = selectedHospital._id || selectedHospital.id;
        const res = await api.get(`/doctors?hospitalId=${hospId}`);
        if (res.data?.success) {
          const payload = res.data.data;
          // API may return array or paginated object
          const doctorsArray = Array.isArray(payload)
            ? payload
            : Array.isArray(payload?.data)
              ? payload.data
              : [];
          setDoctors(doctorsArray);
          if (paramDoctorId) {
            const matched = doctorsArray.find(
              (d) => String(d._id) === String(paramDoctorId)
            );
            if (matched) {
              setSelectedDoctor(matched);
              // Do not auto-transition step; let user select patient profile first (Step 0)
            }
          }
        }
      } catch (err) {
        console.error(err);
        toast.error("Failed to load clinicians for selected hospital.");
      } finally {
        setDoctorsLoading(false);
      }
    };
    fetchDoctors();
  }, [selectedHospital, paramDoctorId]);

  // Direct Booking Bypass: Initialize step 3 directly if doctor and hospital are specified
  useEffect(() => {
    if (paramHospitalId && paramDoctorId) {
      const initializeDirectBooking = async () => {
        setHospitalsLoading(true);
        setDoctorsLoading(true);
        try {
          const [hospRes, docRes] = await Promise.all([
            api.get("/hospitals?limit=50"),
            api.get(`/doctors?hospitalId=${paramHospitalId}`)
          ]);

          if (hospRes.data?.success && docRes.data?.success) {
            const hospPayload = hospRes.data.data;
            const hospitalsArray = Array.isArray(hospPayload)
              ? hospPayload
              : Array.isArray(hospPayload?.data)
                ? hospPayload.data
                : [];
            
            const docPayload = docRes.data.data;
            const doctorsArray = Array.isArray(docPayload)
              ? docPayload
              : Array.isArray(docPayload?.data)
                ? docPayload.data
                : [];

            console.log("Direct Booking Diag:", {
              paramHospitalId,
              paramDoctorId,
              hospitalsCount: hospitalsArray.length,
              doctorsCount: doctorsArray.length,
              hospitalsList: hospitalsArray.map(h => h._id || h.id),
              doctorsList: doctorsArray.map(d => d._id)
            });

            const matchedHosp = hospitalsArray.find(
              (h) => String(h._id || h.id || "").trim().toLowerCase() === String(paramHospitalId || "").trim().toLowerCase()
            );
            const matchedDoc = doctorsArray.find(
              (d) => String(d._id || d.id || "").trim().toLowerCase() === String(paramDoctorId || "").trim().toLowerCase()
            );

            console.log("Matched results:", {
              matchedHosp: !!matchedHosp,
              matchedDoc: !!matchedDoc
            });

            if (matchedHosp && matchedDoc) {
              setHospitals(hospitalsArray);
              setDoctors(doctorsArray);
              setSelectedHospital(matchedHosp);
              setSelectedDoctor(matchedDoc);
              // Do not auto-transition step; let user select patient profile first (Step 0)
            } else {
              setHospitals(hospitalsArray); // Ensure clinics list is populated so the page is not blank
              toast.error("Could not find the selected practitioner or medical center.");
              setStep(1);
            }
          }
        } catch (err) {
          console.error("Direct booking initialization failed:", err);
          toast.error("Failed to initialize booking details directly.");
        } finally {
          setHospitalsLoading(false);
          setDoctorsLoading(false);
        }
      };
      initializeDirectBooking();
    }
  }, [paramHospitalId, paramDoctorId]);

  // Step 3: Fetch slots when date or doctor changes
  useEffect(() => {
    if (!selectedDoctor || !selectedDate) return;
    const fetchSlots = async () => {
      setSlotsLoading(true);
      try {
        const res = await api.get(`/schedule/slots?doctorId=${selectedDoctor._id}&date=${selectedDate}`);
        if (res.data?.success) {
          setSlots(res.data.data || []);
        } else {
          setSlots([]);
        }
      } catch (err) {
        console.error(err);
        setSlots([]);
      } finally {
        setSlotsLoading(false);
      }
    };
    fetchSlots();
  }, [selectedDoctor, selectedDate]);

  // Calendar dates list helper
  const getBookingDates = (daysLimit = 7) => {
    const dates = [];
    const today = new Date();
    for (let i = 0; i < daysLimit; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const dateStr = `${yyyy}-${mm}-${dd}`;
      const dayLabel = d.toLocaleDateString("en-US", { weekday: "short" });
      const dayNum = d.getDate();
      dates.push({ dateStr, dayLabel, dayNum });
    }
    return dates;
  };

  const handleConfirmBooking = async () => {
    if (!selectedSlot) {
      toast.error("Please select an appointment time slot.");
      return;
    }
    setConfirming(true);
    const loadingToast = toast.loading("Processing booking request...");

    try {
      const doctorId = selectedDoctor._id || selectedDoctor.id;
      const res = await api.post("/queue/book", {
        doctorId,
        bookingDate: selectedDate,
        slotTime: selectedSlot,
        patientId: selectedPatient ? selectedPatient._id : undefined
      });

      if (res.data?.success && res.data.data?.canBook) {
        toast.dismiss(loadingToast);
        toast.success("Appointment Confirmed! 🎉");
        // The booking ID is in res.data.data.booking.queueId
        const queueId = res.data.data?.booking?.queueId;
        if (queueId) {
          navigate(`/patient/booking-success?id=${queueId}`);
        } else {
          navigate("/patient");
        }
      } else {
        const reason = res.data?.data?.reason || res.data?.message || "Booking failed. Please try again.";
        toast.error(reason, { id: loadingToast });
      }
    } catch (err) {
      toast.error(err.response?.data?.message || "Booking session error.", { id: loadingToast });
    } finally {
      setConfirming(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50/20 py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        
        {/* Wizard Progress Headers */}
        <div className="mb-8">
          <div className="flex items-center justify-between text-token-caption mb-3">
            <span>{step === 0 ? "STARTING WIZARD" : `STEP ${step} OF 4`}</span>
            <span className="font-bold text-blue-600">
              {step === 0 && "Select Patient Profile"}
              {step === 1 && "Select Clinic Center"}
              {step === 2 && "Choose Specialist"}
              {step === 3 && "Select Date & Slot"}
              {step === 4 && "Review Summary"}
            </span>
          </div>
          <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-blue-600 to-indigo-650 transition-all duration-300"
              style={{ width: `${((step === 0 ? 0.25 : step) / 4) * 100}%` }}
            />
          </div>
        </div>

        {/* --- STEP 0: SELECT PATIENT --- */}
        {step === 0 && (
          <div className="space-y-6 text-left">
            <div className="text-center">
              <h2 className="text-token-page-heading text-slate-800 tracking-tight flex items-center justify-center gap-2">
                <Users className="w-8 h-8 text-blue-500 animate-pulse" />
                Who is this appointment for?
              </h2>
              <p className="text-token-caption mt-2">Select the patient profile for this admission booking.</p>
            </div>

            {familyLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Option 1: Self */}
                <button
                  onClick={() => {
                    setSelectedPatient(null);
                    if (paramHospitalId && paramDoctorId) {
                      setStep(3);
                    } else if (paramHospitalId) {
                      setStep(2);
                    } else {
                      setStep(1);
                    }
                  }}
                  className={`text-left p-6 bg-white rounded-3xl border transition-all hover:shadow-md cursor-pointer ${
                    selectedPatient === null ? "border-blue-600 ring-2 ring-blue-100" : "border-slate-100"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 font-extrabold flex items-center justify-center text-sm shrink-0">
                      👨
                    </div>
                    <div>
                      <h3 className="text-token-card-title text-slate-800">Self (Arun Kumar)</h3>
                      <p className="text-xs font-semibold text-slate-450 mt-1">Account Owner Profile</p>
                    </div>
                  </div>
                </button>

                {/* Option 2: Active Family Members */}
                {familyMembers.map((member) => {
                  const relative = member.relativeId;
                  if (!relative) return null;
                  return (
                    <button
                      key={member._id}
                      onClick={() => {
                        setSelectedPatient(relative);
                        if (paramHospitalId && paramDoctorId) {
                          setStep(3);
                        } else if (paramHospitalId) {
                          setStep(2);
                        } else {
                          setStep(1);
                        }
                      }}
                      className={`text-left p-6 bg-white rounded-3xl border transition-all hover:shadow-md cursor-pointer ${
                        selectedPatient?._id === relative._id ? "border-blue-600 ring-2 ring-blue-100" : "border-slate-100"
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-sm shrink-0">
                          {member.relationType === "Child" ? "👦" : member.relationType === "Spouse" ? "👩" : "👴"}
                        </div>
                        <div>
                          <h3 className="text-token-card-title text-slate-800">{relative.name}</h3>
                          <p className="text-xs font-semibold text-slate-450 mt-1 uppercase tracking-wider">{member.relationType}</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* --- STEP 1: SELECT HOSPITAL --- */}
        {step === 1 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setStep(0)}
                className="flex items-center gap-1.5 text-sm font-bold text-slate-500 hover:text-slate-700 transition"
              >
                <ArrowLeft className="w-4 h-4" /> Back to Patient Profiles
              </button>
            </div>

            <div className="text-center">
              <h2 className="text-token-page-heading text-slate-800 tracking-tight flex items-center justify-center gap-2">
                <MapPin className="w-8 h-8 text-blue-500" />
                Select Partnered Clinic
              </h2>
              <p className="text-token-caption mt-2">Choose the nearest partnered medical facility for your check-in.</p>
            </div>

            {hospitalsLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {hospitals.map((h) => {
                  const hId = String(h._id || h.id);
                  return (
                    <button
                      key={hId}
                      onClick={() => {
                        setSelectedHospital(h);
                        setStep(2);
                      }}
                      className={`text-left p-6 bg-white rounded-3xl border transition-all hover:shadow-md cursor-pointer ${
                        String(selectedHospital?._id || selectedHospital?.id) === hId ? "border-blue-600 ring-2 ring-blue-100" : "border-slate-100"
                      }`}
                    >
                      <h3 className="text-token-card-title text-slate-800">{h.name}</h3>
                      <p className="text-token-caption mt-1.5">{typeof h.address === 'object' ? h.address?.city || h.address?.street || '' : h.address}</p>
                      <span className="inline-block mt-3 text-xs font-semibold text-blue-600 bg-blue-50 px-3 py-1 rounded-full">
                        📍 Wait status online
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* --- STEP 2: SELECT DOCTOR --- */}
        {step === 2 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setStep(1)}
                className="flex items-center gap-1.5 text-sm font-bold text-slate-500 hover:text-slate-700 transition"
              >
                <ArrowLeft className="w-4 h-4" /> Back to Clinics
              </button>
              <span className="text-xs text-slate-400 font-medium">Selected: {selectedHospital?.name}</span>
            </div>

            <div className="text-center">
              <h2 className="text-token-page-heading text-slate-800 tracking-tight flex items-center justify-center gap-2">
                <Stethoscope className="w-8 h-8 text-blue-500" />
                Select Specialist
              </h2>
              <p className="text-token-caption mt-2">Select an active consultant specializing in your symptom area.</p>
            </div>

            {doctorsLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
              </div>
            ) : doctors.length === 0 ? (
              <div className="text-center py-12 bg-white rounded-3xl border border-dashed text-slate-400">
                No active clinicians registered in this facility today.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {doctors.map((d) => {
                  const dId = String(d._id || d.id);
                  return (
                    <button
                      key={dId}
                      onClick={() => {
                        setSelectedDoctor(d);
                        setSelectedDate("");
                        setSelectedSlot(null);
                        setStep(3);
                      }}
                      className={`text-left p-6 bg-white rounded-3xl border transition-all hover:shadow-md cursor-pointer ${
                        String(selectedDoctor?._id || selectedDoctor?.id) === dId ? "border-blue-600 ring-2 ring-blue-100" : "border-slate-100"
                      }`}
                    >
                      <div className="flex items-start gap-4">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 font-extrabold flex items-center justify-center text-sm">
                          {d.name?.[0]?.toUpperCase() || "D"}
                        </div>
                        <div>
                          <h4 className="text-token-card-title text-slate-800">{d.name}</h4>
                          <p className="text-xs font-semibold text-slate-400 mt-1 uppercase tracking-wider">{d.specialization}</p>
                          <p className="text-token-caption mt-2">Avg Consultation: {d.avgConsultationTime || 5} mins</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* --- STEP 3: SELECT DATE & SLOT --- */}
        {step === 3 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setStep(2)}
                className="flex items-center gap-1.5 text-sm font-bold text-slate-500 hover:text-slate-700 transition"
              >
                <ArrowLeft className="w-4 h-4" /> Back to Specialists
              </button>
              <span className="text-xs text-slate-400 font-medium">Selected: {selectedDoctor?.name}</span>
            </div>

            <div className="text-center">
              <h2 className="text-token-page-heading text-slate-800 tracking-tight flex items-center justify-center gap-2">
                <Calendar className="w-8 h-8 text-blue-500" />
                Select Date & Time Slot
              </h2>
              <p className="text-token-caption mt-2">Choose your pre-admission check-in slot.</p>
            </div>

            {/* Date Selection Scrollbar */}
            <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
              <h4 className="text-token-card-title text-slate-700">Available Dates</h4>
              <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-none snap-x">
                {getBookingDates().map((d) => {
                  const isSelected = selectedDate === d.dateStr;
                  return (
                    <button
                      key={d.dateStr}
                      onClick={() => {
                        setSelectedDate(d.dateStr);
                        setSelectedSlot(null);
                      }}
                      className={`flex flex-col items-center justify-center p-4 rounded-2xl border text-center min-w-[76px] snap-start transition cursor-pointer active:scale-95 ${
                        isSelected
                          ? "bg-blue-600 border-blue-650 text-white shadow-lg shadow-blue-100"
                          : "bg-white border-slate-200 text-slate-700 hover:border-slate-350"
                      }`}
                    >
                      <span className={`text-[10px] font-bold uppercase tracking-wider ${isSelected ? "text-blue-100" : "text-slate-400"}`}>
                        {d.dayLabel}
                      </span>
                      <span className="text-lg font-black mt-1 leading-none">
                        {d.dayNum}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Slots Grid */}
            {selectedDate && (
              <div className="bg-white rounded-3xl p-6 border border-slate-100 shadow-sm space-y-4">
                <h4 className="text-token-card-title text-slate-700">Available Time Slots</h4>
                {slotsLoading ? (
                  <div className="grid grid-cols-4 gap-2.5">
                    {[...Array(8)].map((_, idx) => (
                      <div key={idx} className="h-11 bg-slate-100 animate-pulse rounded-xl" />
                    ))}
                  </div>
                ) : slots.length === 0 ? (
                  <div className="text-center py-8 text-slate-400 border border-dashed rounded-2xl">
                    No operating slots scheduled for this date.
                  </div>
                ) : (() => {
                  const grouped = groupSlotsByShift(slots, selectedDate);
                  return (
                    <div className="space-y-6">
                      {Object.entries(grouped).map(([shiftName, shiftSlots]) => {
                        if (shiftSlots.length === 0) return null;
                        return (
                          <div key={shiftName} className="space-y-2">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block border-b border-slate-100 pb-1 text-left">
                              {shiftName} Shift Slots
                            </span>
                            <div className="grid grid-cols-4 gap-2.5">
                              {shiftSlots.map((s) => {
                                const isSelected = selectedSlot === s.time;
                                const isAvailable = s.status === "AVAILABLE";
                                return (
                                  <button
                                    key={s.time}
                                    disabled={!isAvailable}
                                    onClick={() => setSelectedSlot(s.time)}
                                    className={`py-3 px-2 rounded-xl text-xs font-bold border transition text-center cursor-pointer ${
                                      isSelected
                                        ? "bg-[#0F4C81] border-[#0F4C81] text-white shadow-md shadow-blue-100"
                                        : isAvailable
                                        ? "bg-white border-slate-200 text-slate-700 hover:border-blue-200 hover:bg-blue-50/20"
                                        : "bg-slate-50 border-slate-100 text-slate-300 cursor-not-allowed"
                                    }`}
                                  >
                                    {s.time}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Next Step Control */}
            {selectedSlot && (
              <div className="text-right pt-2">
                <button
                  onClick={() => setStep(4)}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-8 py-3 rounded-2xl shadow-md flex items-center gap-2 ml-auto active:scale-[0.98] cursor-pointer"
                >
                  Review Summary <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
        )}

        {/* --- STEP 4: REVIEW & CONFIRM --- */}
        {step === 4 && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setStep(3)}
                className="flex items-center gap-1.5 text-sm font-bold text-slate-500 hover:text-slate-700 transition"
              >
                <ArrowLeft className="w-4 h-4" /> Back to Slots
              </button>
            </div>

            <div className="text-center">
              <h2 className="text-token-page-heading text-slate-800 tracking-tight flex items-center justify-center gap-2">
                <Sparkles className="w-8 h-8 text-blue-500" />
                Review Your Appointment
              </h2>
              <p className="text-token-caption mt-2">Verify details before generating booking ticket.</p>
            </div>

            <div className="bg-white rounded-3xl p-8 border border-slate-100 shadow-lg space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <span className="text-token-caption block">FACILITY</span>
                  <span className="text-token-section text-slate-800">{selectedHospital?.name}</span>
                  <span className="text-token-caption block mt-1">{selectedHospital?.address}</span>
                </div>
                <div>
                  <span className="text-token-caption block">CONSULTANT</span>
                  <span className="text-token-section text-slate-800">{selectedDoctor?.name}</span>
                  <span className="text-token-caption block mt-1 uppercase">{selectedDoctor?.specialization}</span>
                </div>
                <div>
                  <span className="text-token-caption block">APPOINTMENT DATE</span>
                  <span className="text-token-section text-slate-800">{selectedDate}</span>
                </div>
                <div>
                  <span className="text-token-caption block">CHECK-IN SESSION</span>
                  <span className="text-token-section text-slate-800">{selectedSlot}</span>
                </div>
                <div>
                  <span className="text-token-caption block">PATIENT</span>
                  <span className="text-token-section text-slate-800">
                    {selectedPatient ? selectedPatient.name : "Self (Arun Kumar)"}
                  </span>
                  <span className="text-token-caption block mt-1">
                    {selectedPatient ? "Family Member" : "Account Owner"}
                  </span>
                </div>
              </div>

              <div className="border-t border-slate-100 pt-6 flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-2 text-token-caption text-green-700 bg-green-50 px-4 py-2 rounded-2xl border border-green-100">
                  <Shield className="w-4 h-4" />
                  Pre-registration check-in counter verified
                </div>

                <button
                  onClick={handleConfirmBooking}
                  disabled={confirming}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold px-10 py-4 rounded-2xl shadow-lg flex items-center gap-2 active:scale-[0.98] cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {confirming ? "Confirming..." : "Confirm Booking & Generate QR"}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
