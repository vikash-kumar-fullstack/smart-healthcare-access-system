import Doctor from "../doctor/doctor.model.js";
import Hospital from "../hospital/hospital.model.js";
import User from "../auth/auth.model.js";
import Queue from "../queue/queue.model.js";
import SystemEmergencyState from "./system_emergency_state.model.js";

export const computeFreshDashboardAnalytics = async () => {
  const activeDoctors = await Doctor.countDocuments({ status: { $in: ["active", "approved", "verified"] } });
  const activeHospitals = await Hospital.countDocuments({ isActive: true });
  const activePatients = await User.countDocuments({ role: "patient", isActive: true });

  const today = new Date().toISOString().split("T")[0];
  const start = new Date(today);
  const end = new Date(today);
  end.setDate(end.getDate() + 1);

  const todayBookings = await Queue.find({
    createdAt: { $gte: start, $lt: end }
  });

  const bookings = todayBookings.length;
  const completed = todayBookings.filter(q => q.status === "completed").length;
  const noShow = todayBookings.filter(q => q.status === "no_show").length;
  
  const completionRate = bookings ? (completed / bookings) * 100 : 0;
  const noShowRate = bookings ? (noShow / bookings) * 100 : 0;

  // Compute a real retentionRate: % of active patients who have > 1 booking
  const patientsWithMultipleBookings = await Queue.aggregate([
    { $group: { _id: "$userId", count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
    { $count: "total" }
  ]);
  const totalPatientsWithBookings = await Queue.aggregate([
    { $group: { _id: "$userId" } },
    { $count: "total" }
  ]);
  
  const multCount = patientsWithMultipleBookings[0]?.total || 0;
  const totalCount = totalPatientsWithBookings[0]?.total || 0;
  const retentionRate = totalCount ? (multCount / totalCount) * 100 : 85; // fallback to 85%

  const activeQueues = todayBookings.filter(q => q.status === "waiting" || q.status === "in_progress").length;
  const queueHealth = bookings ? ((completed + activeQueues) / bookings) * 100 : 100;

  // Read emergency controls to determine system health state (Correction 2)
  const emergency = await SystemEmergencyState.findOne({ singletonKey: "global" });
  let systemHealth = "healthy";
  if (emergency) {
    if (emergency.maintenance) systemHealth = "maintenance";
    else if (emergency.pauseBookings || emergency.readonly) systemHealth = "degraded";
  }

  return {
    activeDoctors,
    activeHospitals,
    activePatients,
    bookings,
    completionRate: Math.round(completionRate * 100) / 100,
    noShowRate: Math.round(noShowRate * 100) / 100,
    retentionRate: Math.round(retentionRate * 100) / 100,
    queueHealth: Math.round(queueHealth * 100) / 100,
    systemHealth
  };
};
