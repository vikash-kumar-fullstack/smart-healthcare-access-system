import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import User from "../src/modules/auth/auth.model.js";
import Doctor from "../src/modules/doctor/doctor.model.js";
import Hospital from "../src/modules/hospital/hospital.model.js";
import Queue from "../src/modules/queue/queue.model.js";
import QueueSession from "../src/modules/queue/queueSession.model.js";
import Notification from "../src/modules/notification/notification.model.js";
import BookingCredit from "../src/modules/queue/booking_credit.model.js";
import PatientStats from "../src/modules/queue/patient_stats.model.js";
import DoctorSchedule from "../src/modules/doctor/doctor_schedule.model.js";
import DoctorScheduleOverride from "../src/modules/doctor/doctor_schedule_override.model.js";
import DoctorAvailabilityLog from "../src/modules/doctor/doctor_availability_log.model.js";
import DoctorAnalyticsDaily from "../src/modules/doctor/doctor_analytics_daily.model.js";
import AnalyticsRebuildAuditLog from "../src/modules/doctor/analytics_rebuild_audit_log.model.js";
import SystemMonitoring from "../src/modules/doctor/system_monitoring.model.js";
import NotificationOutbox from "../src/modules/notification/notification_outbox.model.js";
import NotificationPreferences from "../src/modules/notification/notification_preferences.model.js";
import NotificationCounter from "../src/modules/notification/notification_counter.model.js";
import NotificationDeadLetter from "../src/modules/notification/notification_dead_letter.model.js";
import NotificationSequence from "../src/modules/notification/notification_sequence.model.js";
import Visit from "../src/modules/visit/visit.model.js";
import VisitTimeline from "../src/modules/visit/visit_timeline.model.js";
import VisitSummary from "../src/modules/visit/visit_summary.model.js";
import VisitSequence from "../src/modules/visit/visit_sequence.model.js";
import SymptomDictionary from "../src/modules/search/symptom_dictionary.model.js";
import DoctorAvailabilitySnapshot from "../src/modules/search/doctor_availability_snapshot.model.js";
import SearchEvent from "../src/modules/search/search_event.model.js";
import SearchCache from "../src/modules/search/search_cache.model.js";
import SearchAnalyticsDaily from "../src/modules/search/search_analytics_daily.model.js";
import SearchMonitoringDaily from "../src/modules/search/search_monitoring_daily.model.js";
import SearchOutbox from "../src/modules/search/search_outbox.model.js";
import SearchVersionMeta from "../src/modules/search/search_version_meta.model.js";
import MedicalRecord from "../src/modules/medical-records/medical_record.model.js";
import MedicalRecordVersion from "../src/modules/medical-records/medical_record_version.model.js";
import MedicalAttachment from "../src/modules/medical-records/medical_attachment.model.js";
import MedicalRecordTimeline from "../src/modules/medical-records/medical_record_timeline.model.js";
import MedicalRecordAnalyticsDaily from "../src/modules/medical-records/medical_record_analytics_daily.model.js";
import MedicalRecordExportLog from "../src/modules/medical-records/medical_record_export_log.model.js";
import SystemEmergencyState from "../src/modules/admin/system_emergency_state.model.js";
import AdminAudit from "../src/modules/admin/admin_audit.model.js";
import AdminAction from "../src/modules/admin/admin_action.model.js";
import AdminReport from "../src/modules/admin/admin_report.model.js";
import SystemHealth from "../src/modules/admin/system_health.model.js";
import SystemHealthRollup from "../src/modules/admin/system_health_rollup.model.js";
import AdminDashboardCache from "../src/modules/admin/admin_dashboard_cache.model.js";
import QueueIntervention from "../src/modules/admin/queue_intervention.model.js";
import AdminSession from "../src/modules/admin/admin_session.model.js";

dotenv.config({ path: path.join(__dirname, "..", ".env") });

const resetDatabase = async () => {
  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error("MONGO_URI not configured in .env file");
    }

    console.log("Connecting to Database for reset...");
    await mongoose.connect(mongoUri);
    console.log("Database connected successfully.");

    const models = [
      User, Doctor, Hospital, Queue, QueueSession, Notification, BookingCredit, PatientStats,
      DoctorSchedule, DoctorScheduleOverride, DoctorAvailabilityLog, DoctorAnalyticsDaily,
      AnalyticsRebuildAuditLog, SystemMonitoring, NotificationOutbox, NotificationPreferences,
      NotificationCounter, NotificationDeadLetter, NotificationSequence, Visit, VisitTimeline,
      VisitSummary, VisitSequence, SymptomDictionary, DoctorAvailabilitySnapshot, SearchEvent,
      SearchCache, SearchAnalyticsDaily, SearchMonitoringDaily, SearchOutbox, SearchVersionMeta,
      MedicalRecord, MedicalRecordVersion, MedicalAttachment, MedicalRecordTimeline,
      MedicalRecordAnalyticsDaily, MedicalRecordExportLog, SystemEmergencyState, AdminAudit,
      AdminAction, AdminReport, SystemHealth, SystemHealthRollup, AdminDashboardCache,
      QueueIntervention, AdminSession
    ];

    console.log(`Starting purge of ${models.length} collections...`);
    
    // We clean collections in parallel
    await Promise.all(models.map(async (model) => {
      try {
        await model.deleteMany({});
        console.log(`- Cleared: ${model.modelName}`);
      } catch (err) {
        console.warn(`⚠️ Warning: Failed to clear model ${model.modelName}: ${err.message}`);
      }
    }));

    console.log("🎉 Database reset completed successfully.");
  } catch (error) {
    console.error("❌ Reset failed:", error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
};

resetDatabase();
