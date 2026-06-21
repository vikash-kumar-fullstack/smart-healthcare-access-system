import AdminReport from "./admin_report.model.js";
import Doctor from "../doctor/doctor.model.js";
import Hospital from "../hospital/hospital.model.js";
import Queue from "../queue/queue.model.js";
import SystemHealth from "./system_health.model.js";

let isReportWorkerRunning = false;
let reportInterval = null;

export const processPendingReports = async () => {
  if (isReportWorkerRunning) return;
  isReportWorkerRunning = true;

  try {
    const pendingReport = await AdminReport.findOneAndUpdate(
      { status: "requested" },
      { status: "processing" },
      { new: true }
    );

    if (!pendingReport) {
      isReportWorkerRunning = false;
      return;
    }

    try {
      const type = pendingReport.reportType;
      let payload = {};

      if (type === "doctor_performance") {
        const doctors = await Doctor.find({});
        const performanceData = [];
        for (const doc of doctors) {
          const queues = await Queue.find({ doctorId: doc._id });
          const total = queues.length;
          const completed = queues.filter(q => q.status === "completed").length;
          const noShow = queues.filter(q => q.status === "no_show").length;
          const completionRate = total ? (completed / total) * 100 : 0;
          performanceData.push({
            doctorId: doc._id,
            name: doc.name,
            specialization: doc.specialization,
            totalBookings: total,
            completedBookings: completed,
            noShowBookings: noShow,
            completionRate: Math.round(completionRate * 100) / 100,
            rating: doc.rating
          });
        }
        payload = { doctors: performanceData };

      } else if (type === "queue_summary") {
        const queues = await Queue.find({});
        const total = queues.length;
        const statusCounts = {
          waiting: queues.filter(q => q.status === "waiting").length,
          in_progress: queues.filter(q => q.status === "in_progress").length,
          completed: queues.filter(q => q.status === "completed").length,
          cancelled: queues.filter(q => q.status === "cancelled").length,
          skipped: queues.filter(q => q.status === "skipped").length,
          no_show: queues.filter(q => q.status === "no_show").length
        };
        payload = {
          totalBookings: total,
          statusCounts,
          generatedAt: new Date().toISOString()
        };

      } else if (type === "hospital_summary") {
        const hospitals = await Hospital.find({});
        const hospitalData = [];
        for (const hosp of hospitals) {
          const docsCount = await Doctor.countDocuments({ hospitalId: hosp._id, status: { $in: ["active", "approved", "verified"] } });
          hospitalData.push({
            hospitalId: hosp._id,
            name: hosp.name,
            address: hosp.address,
            activeDoctorsCount: docsCount,
            isActive: hosp.isActive
          });
        }
        payload = { hospitals: hospitalData };

      } else if (type === "system_report") {
        const healthLogs = await SystemHealth.find({}).sort({ createdAt: -1 }).limit(50);
        if (healthLogs.length > 0) {
          const avgDbLatency = healthLogs.reduce((acc, l) => acc + l.dbLatency, 0) / healthLogs.length;
          const avgSearchP95 = healthLogs.reduce((acc, l) => acc + l.searchP95, 0) / healthLogs.length;
          const avgSockets = healthLogs.reduce((acc, l) => acc + l.activeSockets, 0) / healthLogs.length;
          const avgErrors = healthLogs.reduce((acc, l) => acc + l.errorRate, 0) / healthLogs.length;
          payload = {
            totalLogsSampled: healthLogs.length,
            averageDbLatencyMs: Math.round(avgDbLatency * 100) / 100,
            averageSearchP95Ms: Math.round(avgSearchP95 * 100) / 100,
            averageActiveSockets: Math.round(avgSockets * 100) / 100,
            averageErrorRate: Math.round(avgErrors * 100) / 100
          };
        } else {
          payload = { message: "No health telemetry logs compiled yet." };
        }
      }

      pendingReport.payload = payload;
      pendingReport.status = "completed";
      pendingReport.generatedAt = new Date();
      await pendingReport.save();

    } catch (computeErr) {
      pendingReport.status = "failed";
      await pendingReport.save();
      console.error(`Failed to process report ID ${pendingReport._id}:`, computeErr);
    }

  } catch (err) {
    console.error("Error in report background worker process run:", err);
  } finally {
    isReportWorkerRunning = false;
  }
};

export const initReportWorker = (intervalMs = 5000) => {
  if (reportInterval) clearInterval(reportInterval);
  reportInterval = setInterval(processPendingReports, intervalMs);
};

export const stopReportWorker = () => {
  if (reportInterval) {
    clearInterval(reportInterval);
    reportInterval = null;
  }
};
