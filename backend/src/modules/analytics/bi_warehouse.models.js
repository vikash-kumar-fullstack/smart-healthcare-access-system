import mongoose from "mongoose";

const schemaOptions = { timestamps: true };

// 1. Patient Aggregate
const biPatientAggregateSchema = new mongoose.Schema({
  hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: "Hospital", required: true },
  date: { type: String, required: true, index: true },
  totalPatients: { type: Number, default: 0 },
  newPatients: { type: Number, default: 0 },
  retentionRate: { type: Number, default: 0 }
}, schemaOptions);

// 2. Appointment Aggregate
const biAppointmentAggregateSchema = new mongoose.Schema({
  hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: "Hospital", required: true },
  date: { type: String, required: true, index: true },
  totalAppointments: { type: Number, default: 0 },
  completedAppointments: { type: Number, default: 0 },
  noShowAppointments: { type: Number, default: 0 },
  cancelledAppointments: { type: Number, default: 0 },
  revenue: { type: Number, default: 0 }
}, schemaOptions);

// 3. Visit Aggregate
const biVisitAggregateSchema = new mongoose.Schema({
  hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: "Hospital", required: true },
  date: { type: String, required: true, index: true },
  totalVisits: { type: Number, default: 0 },
  avgConsultationTimeMs: { type: Number, default: 0 }
}, schemaOptions);

// 4. Queue Aggregate
const biQueueAggregateSchema = new mongoose.Schema({
  hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: "Hospital", required: true },
  date: { type: String, required: true, index: true },
  avgWaitTimeMs: { type: Number, default: 0 },
  peakHour: { type: Number, default: 0 },
  totalTransfers: { type: Number, default: 0 },
  lateArrivals: { type: Number, default: 0 }
}, schemaOptions);

// 5. Doctor Aggregate
const biDoctorAggregateSchema = new mongoose.Schema({
  hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: "Hospital", required: true },
  doctorId: { type: mongoose.Schema.Types.ObjectId, ref: "Doctor", required: true },
  date: { type: String, required: true, index: true },
  patientsConsulted: { type: Number, default: 0 },
  utilizationRate: { type: Number, default: 0 }, // e.g. % of active time in consultation
  satisfactionScore: { type: Number, default: 5 } // scale 1-5
}, schemaOptions);

// 6. Receptionist Aggregate
const biReceptionistAggregateSchema = new mongoose.Schema({
  hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: "Hospital", required: true },
  receptionistId: { type: mongoose.Schema.Types.ObjectId, ref: "Receptionist", required: true },
  date: { type: String, required: true, index: true },
  totalCheckIns: { type: Number, default: 0 },
  totalWalkIns: { type: Number, default: 0 }
}, schemaOptions);

// 7. Hospital Aggregate
const biHospitalAggregateSchema = new mongoose.Schema({
  hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: "Hospital", required: true },
  date: { type: String, required: true, index: true },
  bedUtilization: { type: Number, default: 0 },
  overallScore: { type: Number, default: 95 }
}, schemaOptions);

// 8. EMR Aggregate
const biEMRAggregateSchema = new mongoose.Schema({
  hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: "Hospital", required: true },
  date: { type: String, required: true, index: true },
  totalNotes: { type: Number, default: 0 },
  signedNotes: { type: Number, default: 0 }
}, schemaOptions);

// 9. Prescription Aggregate
const biPrescriptionAggregateSchema = new mongoose.Schema({
  hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: "Hospital", required: true },
  date: { type: String, required: true, index: true },
  totalPrescriptions: { type: Number, default: 0 },
  remindersSet: { type: Number, default: 0 }
}, schemaOptions);

// 10. Lab Aggregate
const biLabAggregateSchema = new mongoose.Schema({
  hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: "Hospital", required: true },
  date: { type: String, required: true, index: true },
  totalLabOrders: { type: Number, default: 0 },
  completedLabReports: { type: Number, default: 0 }
}, schemaOptions);

// 11. BI Worker Checkpoint (Module 28 Recovery)
const biCheckpointSchema = new mongoose.Schema({
  workerName: { type: String, required: true, unique: true },
  lastProcessedTimestamp: { type: Date, required: true, default: Date.now }
}, schemaOptions);

// 12. BI Report Scheduler (Module 27)
const biReportScheduleSchema = new mongoose.Schema({
  hospitalId: { type: mongoose.Schema.Types.ObjectId, ref: "Hospital", required: true },
  frequency: { type: String, enum: ["daily", "weekly", "monthly"], required: true },
  emailRecipient: { type: String, required: true },
  lastSent: { type: Date, default: null }
}, schemaOptions);

export const BIPatientAggregate = mongoose.models.BIPatientAggregate || mongoose.model("BIPatientAggregate", biPatientAggregateSchema);
export const BIAppointmentAggregate = mongoose.models.BIAppointmentAggregate || mongoose.model("BIAppointmentAggregate", biAppointmentAggregateSchema);
export const BIVisitAggregate = mongoose.models.BIVisitAggregate || mongoose.model("BIVisitAggregate", biVisitAggregateSchema);
export const BIQueueAggregate = mongoose.models.BIQueueAggregate || mongoose.model("BIQueueAggregate", biQueueAggregateSchema);
export const BIDoctorAggregate = mongoose.models.BIDoctorAggregate || mongoose.model("BIDoctorAggregate", biDoctorAggregateSchema);
export const BIReceptionistAggregate = mongoose.models.BIReceptionistAggregate || mongoose.model("BIReceptionistAggregate", biReceptionistAggregateSchema);
export const BIHospitalAggregate = mongoose.models.BIHospitalAggregate || mongoose.model("BIHospitalAggregate", biHospitalAggregateSchema);
export const BIEMRAggregate = mongoose.models.BIEMRAggregate || mongoose.model("BIEMRAggregate", biEMRAggregateSchema);
export const BIPrescriptionAggregate = mongoose.models.BIPrescriptionAggregate || mongoose.model("BIPrescriptionAggregate", biPrescriptionAggregateSchema);
export const BILabAggregate = mongoose.models.BILabAggregate || mongoose.model("BILabAggregate", biLabAggregateSchema);
export const BICheckpoint = mongoose.models.BICheckpoint || mongoose.model("BICheckpoint", biCheckpointSchema);
export const BIReportSchedule = mongoose.models.BIReportSchedule || mongoose.model("BIReportSchedule", biReportScheduleSchema);
