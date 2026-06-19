import Hospital from "../hospital/hospital.model.js";
import Doctor from "../doctor/doctor.model.js";
import Queue from "../queue/queue.model.js";
import User from "../auth/auth.model.js";

export const getDashboardAnalytics = async () => {

  const today = new Date().toISOString().split("T")[0];

  const start = new Date(today);
  const end = new Date(today);
  end.setDate(end.getDate() + 1);

  const totalHospitals = await Hospital.countDocuments({ isActive: true });
  const totalDoctors = await Doctor.countDocuments({ isAvailable: true });
  const totalUsers = await User.countDocuments({ role: "patient" });

  const todayBookings = await Queue.find({
    createdAt: { $gte: start, $lt: end }
  });

  const totalBookingsToday = todayBookings.length;

  const completedToday = todayBookings.filter(q => q.status === "completed").length;
  const cancelledToday = todayBookings.filter(q => q.status === "cancelled").length;
  const activeToday = todayBookings.filter(q => q.isActive).length;

  const cancellationRate = totalBookingsToday
    ? (cancelledToday / totalBookingsToday) * 100
    : 0;

  const completionRate = totalBookingsToday
    ? (completedToday / totalBookingsToday) * 100
    : 0;

  return {
    system: {
      totalHospitals,
      totalDoctors,
      totalUsers
    },

    today: {
      totalBookingsToday,
      completedToday,
      cancelledToday,
      activeToday
    },

    performance: {
      cancellationRate: Math.round(cancellationRate * 100) / 100,
      completionRate: Math.round(completionRate * 100) / 100
    }
  };
};