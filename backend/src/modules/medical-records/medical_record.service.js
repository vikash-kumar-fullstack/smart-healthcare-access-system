import mongoose from "mongoose";
import MedicalRecord from "./medical_record.model.js";
import MedicalRecordVersion from "./medical_record_version.model.js";
import MedicalAttachment from "./medical_attachment.model.js";
import MedicalRecordTimeline from "./medical_record_timeline.model.js";
import MedicalRecordAnalyticsDaily from "./medical_record_analytics_daily.model.js";
import MedicalRecordExportLog from "./medical_record_export_log.model.js";
import Visit from "../visit/visit.model.js";
import Doctor from "../doctor/doctor.model.js";
import { createNotification } from "../notification/notification.service.js";

const getTodayIST = () =>
  new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

export const incrementAnalytics = async (dateStr, field) => {
  await MedicalRecordAnalyticsDaily.findOneAndUpdate(
    { date: dateStr },
    { $inc: { [field]: 1 } },
    { upsert: true, new: true }
  );
};

export const logTimeline = async (recordId, action, userId, userRole, details = {}, session = null) => {
  const opts = session ? { session, new: true } : { new: true };
  const record = await MedicalRecord.findByIdAndUpdate(
    recordId,
    { $inc: { timelineSequence: 1 } },
    opts
  );
  if (!record) return;

  const timelineObj = {
    recordId,
    action,
    sequenceNumber: record.timelineSequence,
    userId,
    userRole,
    details
  };

  if (session) {
    await MedicalRecordTimeline.create([timelineObj], { session });
  } else {
    await MedicalRecordTimeline.create(timelineObj);
  }
};

const compileSearchText = (summary, diagnosis = [], medications = [], doctorSnapshot = {}) => {
  const parts = [
    summary.chiefComplaint || "",
    summary.consultationSummary || "",
    summary.doctorNotes || "",
    summary.followUpAdvice || "",
    ...diagnosis.map(d => `${d.name || ""} ${d.notes || ""}`),
    ...medications.map(m => `${m.name || ""} ${m.instructions || ""}`),
    doctorSnapshot.name || "",
    doctorSnapshot.specialization || "",
    doctorSnapshot.hospitalName || ""
  ];
  return parts.filter(Boolean).join(" ").toLowerCase().replace(/\s+/g, " ").trim();
};

export const createFromVisit = async (visitId, summaryData, doctorUserId, session = null) => {
  const dbSession = session || null;

  const visit = await Visit.findById(visitId).session(dbSession);
  if (!visit) {
    throw Object.assign(new Error("Visit not found"), { status: 404 });
  }

  const existing = await MedicalRecord.findOne({ visitId }).session(dbSession);
  if (existing) {
    return existing;
  }

  const versionId = new mongoose.Types.ObjectId();

  const doctorSnapshot = {
    name: visit.doctorSnapshot.name,
    specialization: visit.doctorSnapshot.specialization,
    hospitalName: visit.doctorSnapshot.hospitalName
  };

  const record = await MedicalRecord.create([{
    patientId: visit.patientId,
    visitId: visit._id,
    doctorSnapshot,
    latestVersion: 1,
    activeVersionId: versionId,
    status: "active",
    timelineSequence: 0
  }], { session: dbSession });

  const createdRecord = record[0];

  const summary = {
    chiefComplaint: summaryData.chiefComplaint,
    doctorNotes: summaryData.doctorNotes,
    consultationSummary: summaryData.consultationSummary,
    followUpAdvice: summaryData.followUpAdvice || ""
  };

  const diagnosis = summaryData.diagnosis || [];
  const medications = summaryData.medications || [];

  const visibilityRules = summaryData.visibilityRules || {
    visibleToPatient: summaryData.visibility !== "internal",
    visibleToDoctor: true,
    containsInternalNotes: summaryData.visibility === "internal"
  };

  const searchText = compileSearchText(summary, diagnosis, medications, doctorSnapshot);

  await MedicalRecordVersion.create([{
    _id: versionId,
    recordId: createdRecord._id,
    version: 1,
    summary,
    diagnosis,
    medications,
    visibilityRules,
    searchText,
    createdBy: doctorUserId
  }], { session: dbSession });

  // Log timeline using atomic sequencing
  await logTimeline(createdRecord._id, "CREATED", doctorUserId, "doctor", { reason: "Created automatically from completed visit" }, dbSession);

  // Update daily analytics
  const today = getTodayIST();
  await incrementAnalytics(today, "recordsCreated");

  // Trigger notification outbox
  await createNotification(
    visit.patientId,
    "New Medical Record Available 🏥",
    `A new medical record has been created for your visit with Dr. ${doctorSnapshot.name}.`,
    "update",
    {
      session: dbSession,
      category: "system",
      eventType: "record_created",
      aggregateType: "MedicalRecord",
      aggregateId: createdRecord._id,
      metadata: { route: `/patient/medical-records/${createdRecord._id}`, entityId: createdRecord._id.toString() }
    }
  );

  return createdRecord;
};

export const createManualRecord = async (doctorUserId, recordData) => {
  const doctor = await Doctor.findOne({ userId: doctorUserId }).populate("hospitalId");
  if (!doctor) {
    throw Object.assign(new Error("Doctor profile not found"), { status: 403 });
  }

  const doctorSnapshot = {
    name: doctor.name,
    specialization: doctor.specialization,
    hospitalName: doctor?.hospitalId?.name || "Unknown Hospital"
  };

  const versionId = new mongoose.Types.ObjectId();

  const record = await MedicalRecord.create({
    patientId: recordData.patientId,
    visitId: null,
    doctorSnapshot,
    latestVersion: 1,
    activeVersionId: versionId,
    status: "active",
    timelineSequence: 0
  });

  const summary = {
    chiefComplaint: recordData.chiefComplaint,
    doctorNotes: recordData.doctorNotes,
    consultationSummary: recordData.consultationSummary,
    followUpAdvice: recordData.followUpAdvice || ""
  };

  const diagnosis = recordData.diagnosis || [];
  const medications = recordData.medications || [];

  const visibilityRules = recordData.visibilityRules || {
    visibleToPatient: true,
    visibleToDoctor: true,
    containsInternalNotes: false
  };

  const searchText = compileSearchText(summary, diagnosis, medications, doctorSnapshot);

  await MedicalRecordVersion.create({
    _id: versionId,
    recordId: record._id,
    version: 1,
    summary,
    diagnosis,
    medications,
    visibilityRules,
    searchText,
    createdBy: doctorUserId
  });

  await logTimeline(record._id, "CREATED", doctorUserId, "doctor", { reason: "Manually created EMR" });
  await incrementAnalytics(getTodayIST(), "recordsCreated");

  // Trigger notification outbox
  await createNotification(
    record.patientId,
    "New Medical Record Available 🏥",
    `A new medical record has been created for you by Dr. ${doctorSnapshot.name}.`,
    "update",
    {
      category: "system",
      eventType: "record_created",
      aggregateType: "MedicalRecord",
      aggregateId: record._id,
      metadata: { route: `/patient/medical-records/${record._id}`, entityId: record._id.toString() }
    }
  );

  return record;
};

export const updateRecord = async (recordId, doctorUserId, updateData, expectedVersion = null) => {
  const record = await MedicalRecord.findById(recordId);
  if (!record) {
    throw Object.assign(new Error("Medical record not found"), { status: 404 });
  }

  if (record.status === "locked") {
    throw Object.assign(new Error("Record is locked and cannot be edited"), { status: 400 });
  }

  // Concurrency Check (Rule 1)
  if (expectedVersion !== null && parseInt(expectedVersion) !== record.latestVersion) {
    throw Object.assign(new Error("Conflict: EMR record has been modified by another practitioner"), { status: 409 });
  }

  const nextVersion = record.latestVersion + 1;
  const versionId = new mongoose.Types.ObjectId();

  const summary = {
    chiefComplaint: updateData.chiefComplaint,
    doctorNotes: updateData.doctorNotes,
    consultationSummary: updateData.consultationSummary,
    followUpAdvice: updateData.followUpAdvice || ""
  };

  const diagnosis = updateData.diagnosis || [];
  const medications = updateData.medications || [];

  const visibilityRules = updateData.visibilityRules || {
    visibleToPatient: true,
    visibleToDoctor: true,
    containsInternalNotes: false
  };

  const searchText = compileSearchText(summary, diagnosis, medications, record.doctorSnapshot);

  await MedicalRecordVersion.create({
    _id: versionId,
    recordId: record._id,
    version: nextVersion,
    summary,
    diagnosis,
    medications,
    visibilityRules,
    searchText,
    createdBy: doctorUserId
  });

  record.latestVersion = nextVersion;
  record.activeVersionId = versionId;
  await record.save();

  // Copy active attachments to the new version (Rule 2)
  const prevAttachments = await MedicalAttachment.find({ recordId, version: record.latestVersion - 1, deletedAt: null });
  if (prevAttachments.length > 0) {
    const clonedAttachments = prevAttachments.map(att => ({
      recordId,
      version: nextVersion,
      storageKey: att.storageKey,
      mimeType: att.mimeType,
      size: att.size,
      attachmentType: att.attachmentType,
      fileName: att.fileName,
      uploadedBy: att.uploadedBy
    }));
    await MedicalAttachment.insertMany(clonedAttachments);
  }

  await logTimeline(record._id, "UPDATED", doctorUserId, "doctor", { version: nextVersion });
  await incrementAnalytics(getTodayIST(), "versionsCreated");

  // Trigger notification outbox
  await createNotification(
    record.patientId,
    "Medical Record Updated 🏥",
    `Your medical record from Dr. ${record.doctorSnapshot.name} has been updated to version ${nextVersion}.`,
    "update",
    {
      category: "system",
      eventType: "record_updated",
      aggregateType: "MedicalRecord",
      aggregateId: record._id,
      metadata: { route: `/patient/medical-records/${record._id}`, entityId: record._id.toString() }
    }
  );

  return record;
};

export const getRecordDetail = async (recordId, userRole, userId) => {
  const record = await MedicalRecord.findById(recordId);
  if (!record || record.status === "deleted") {
    throw Object.assign(new Error("Medical record not found"), { status: 404 });
  }

  // RBAC checks
  if (userRole === "patient" && record.patientId.toString() !== userId.toString()) {
    throw Object.assign(new Error("Unauthorized access to medical record"), { status: 403 });
  }

  // Get active version details
  const activeVersion = await MedicalRecordVersion.findById(record.activeVersionId).lean();
  if (!activeVersion) {
    throw Object.assign(new Error("Active record version not found"), { status: 500 });
  }

  // Lock 8 Visibility rules and sanitize
  if (userRole === "patient") {
    if (!activeVersion.visibilityRules.visibleToPatient) {
      throw Object.assign(new Error("Access to this medical record version is restricted"), { status: 403 });
    }
    if (activeVersion.visibilityRules.containsInternalNotes) {
      activeVersion.summary.doctorNotes = "Sanitized/Restricted Notes";
    }
  }

  // Get all versions list
  let versions = [];
  if (userRole === "doctor") {
    versions = await MedicalRecordVersion.find({ recordId }).sort({ version: -1 }).lean();
  } else if (userRole === "patient") {
    versions = await MedicalRecordVersion.find({
      recordId,
      "visibilityRules.visibleToPatient": true
    }).sort({ version: -1 }).lean();
    // sanitize
    versions.forEach(v => {
      if (v.visibilityRules.containsInternalNotes) {
        v.summary.doctorNotes = "Sanitized/Restricted Notes";
      }
    });
  }

  // Fetch attachments for active version (Filter out soft-deleted attachments)
  const attachments = await MedicalAttachment.find({ recordId, version: record.latestVersion, deletedAt: null });

  // Admin access (Metadata only)
  if (userRole === "admin") {
    return {
      record: {
        _id: record._id,
        patientId: record.patientId,
        visitId: record.visitId,
        doctorSnapshot: record.doctorSnapshot,
        latestVersion: record.latestVersion,
        status: record.status,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt
      }
    };
  }

  // Log viewed action
  await logTimeline(record._id, "VIEWED", userId, userRole);

  return {
    record,
    activeVersion,
    versions,
    attachments
  };
};

export const getPatientHistory = async (patientId, userRole, userId, limit = 10, cursor = null) => {
  // RBAC
  if (userRole === "patient" && patientId.toString() !== userId.toString()) {
    throw Object.assign(new Error("Unauthorized access to medical history"), { status: 403 });
  }

  const query = { patientId, status: { $ne: "deleted" } };

  if (cursor) {
    try {
      const [cursorTime, cursorId] = Buffer.from(cursor, "base64").toString("ascii").split("_");
      if (cursorTime && cursorId) {
        query.$or = [
          { createdAt: { $lt: new Date(cursorTime) } },
          { createdAt: new Date(cursorTime), _id: { $lt: new mongoose.Types.ObjectId(cursorId) } }
        ];
      }
    } catch (e) {
      throw Object.assign(new Error("Invalid cursor"), { status: 400 });
    }
  }

  const records = await MedicalRecord.find(query)
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit + 1);

  const hasMore = records.length > limit;
  if (hasMore) {
    records.pop();
  }

  let nextCursor = null;
  if (records.length > 0) {
    const lastItem = records[records.length - 1];
    nextCursor = Buffer.from(`${lastItem.createdAt.toISOString()}_${lastItem._id}`).toString("base64");
  }

  const populatedRecords = [];
  for (const rec of records) {
    const activeVersion = await MedicalRecordVersion.findById(rec.activeVersionId).lean();
    if (activeVersion) {
      if (userRole === "patient") {
        if (!activeVersion.visibilityRules.visibleToPatient) {
          continue; // skip completely
        }
        if (activeVersion.visibilityRules.containsInternalNotes) {
          activeVersion.summary.doctorNotes = "Sanitized/Restricted Notes";
        }
      }
      populatedRecords.push({
        ...rec.toObject(),
        activeVersion
      });
    }
  }

  // Group by year (longitudinal timeline)
  const grouped = {};
  populatedRecords.forEach(item => {
    const year = new Date(item.createdAt).getFullYear().toString();
    if (!grouped[year]) grouped[year] = [];
    grouped[year].push({
      _id: item._id,
      patientId: item.patientId,
      visitId: item.visitId,
      doctorSnapshot: item.doctorSnapshot,
      latestVersion: item.latestVersion,
      status: item.status,
      createdAt: item.createdAt,
      activeVersion: item.activeVersion
    });
  });

  return {
    records: grouped,
    nextCursor,
    hasMore
  };
};

export const searchRecords = async (userRole, userId, queryParams) => {
  const limit = Math.min(20, Math.max(1, parseInt(queryParams.limit) || 10));
  const cursor = queryParams.cursor;

  const matchQuery = { status: { $ne: "deleted" } };

  if (userRole === "patient") {
    matchQuery.patientId = new mongoose.Types.ObjectId(userId);
  } else if (queryParams.patientId) {
    matchQuery.patientId = new mongoose.Types.ObjectId(queryParams.patientId);
  }

  if (queryParams.date) {
    const start = new Date(queryParams.date);
    start.setHours(0, 0, 0, 0);
    const end = new Date(queryParams.date);
    end.setHours(23, 59, 59, 999);
    matchQuery.createdAt = { $gte: start, $lte: end };
  }

  if (queryParams.outcome) {
    const outcomeVisits = await Visit.find({ visitOutcome: queryParams.outcome }).select("_id");
    const visitIds = outcomeVisits.map(v => v._id);
    matchQuery.visitId = { $in: visitIds };
  }

  if (queryParams.doctor) {
    matchQuery["doctorSnapshot.name"] = new RegExp(queryParams.doctor, "i");
  }

  const records = await MedicalRecord.find(matchQuery).sort({ createdAt: -1 });

  const activeVersionIds = records.map(r => r.activeVersionId);

  const versionQuery = { _id: { $in: activeVersionIds } };

  if (queryParams.q) {
    versionQuery.$text = { $search: queryParams.q };
  }
  if (queryParams.diagnosis) {
    versionQuery["diagnosis.name"] = new RegExp(queryParams.diagnosis, "i");
  }

  let matchedVersions = await MedicalRecordVersion.find(versionQuery).lean();

  const matchedVersionMap = new Map(matchedVersions.map(v => [v._id.toString(), v]));
  const finalRecords = [];

  for (const rec of records) {
    const version = matchedVersionMap.get(rec.activeVersionId.toString());
    if (version) {
      if (userRole === "patient") {
        if (!version.visibilityRules.visibleToPatient) continue;
        if (version.visibilityRules.containsInternalNotes) {
          version.summary.doctorNotes = "Sanitized/Restricted Notes";
        }
      }
      finalRecords.push({
        ...rec.toObject(),
        activeVersion: version
      });
    }
  }

  let sliced = [];
  let nextCursor = null;
  let hasMore = false;

  if (cursor) {
    try {
      const decodedIdx = parseInt(Buffer.from(cursor, "base64").toString("ascii"));
      const startIndex = isNaN(decodedIdx) ? 0 : decodedIdx;
      sliced = finalRecords.slice(startIndex, startIndex + limit + 1);
      hasMore = sliced.length > limit;
      if (hasMore) sliced.pop();
      if (sliced.length > 0) {
        nextCursor = Buffer.from(String(startIndex + sliced.length)).toString("base64");
      }
    } catch (e) {
      sliced = finalRecords.slice(0, limit);
    }
  } else {
    sliced = finalRecords.slice(0, limit + 1);
    hasMore = sliced.length > limit;
    if (hasMore) sliced.pop();
    if (sliced.length > 0) {
      nextCursor = Buffer.from(String(sliced.length)).toString("base64");
    }
  }

  return {
    records: sliced,
    nextCursor,
    hasMore
  };
};

export const addAttachment = async (recordId, version, storageKey, mimeType, size, fileName, userId) => {
  const record = await MedicalRecord.findById(recordId);
  if (!record) {
    throw Object.assign(new Error("Medical record not found"), { status: 404 });
  }

  if (record.status === "locked") {
    throw Object.assign(new Error("Record is locked and attachments cannot be added"), { status: 400 });
  }

  const existing = await MedicalAttachment.findOne({ recordId, version, storageKey, deletedAt: null });
  if (existing) {
    return existing;
  }

  let type = "image";
  if (mimeType.includes("pdf")) type = "pdf";
  else if (fileName.includes("prescription")) type = "prescription";
  else if (fileName.includes("lab_report")) type = "lab_report";

  const attachment = await MedicalAttachment.create({
    recordId,
    version,
    storageKey,
    mimeType,
    size,
    attachmentType: type,
    fileName,
    uploadedBy: userId
  });

  await logTimeline(recordId, "UPDATED", userId, "doctor", { action: "ATTACHMENT_UPLOADED", file: fileName });
  await incrementAnalytics(getTodayIST(), "attachmentsUploaded");

  return attachment;
};

// Soft Delete Attachment (Rule 2)
export const softDeleteAttachment = async (recordId, storageKey, userId, userRole) => {
  const record = await MedicalRecord.findById(recordId);
  if (!record) {
    throw Object.assign(new Error("Medical record not found"), { status: 404 });
  }

  if (record.status === "locked") {
    throw Object.assign(new Error("Record is locked and attachments cannot be modified"), { status: 400 });
  }

  const attachment = await MedicalAttachment.findOne({ recordId, version: record.latestVersion, storageKey, deletedAt: null });
  if (!attachment) {
    throw Object.assign(new Error("Attachment not found"), { status: 404 });
  }

  attachment.deletedAt = new Date();
  attachment.retentionUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days retention policy
  await attachment.save();

  await logTimeline(recordId, "UPDATED", userId, userRole, { action: "ATTACHMENT_SOFT_DELETED", file: attachment.fileName });

  return attachment;
};

export const archiveRecord = async (recordId, userId, userRole) => {
  const record = await MedicalRecord.findById(recordId);
  if (!record) {
    throw Object.assign(new Error("Medical record not found"), { status: 404 });
  }

  if (record.status === "locked") {
    throw Object.assign(new Error("Record is locked and status cannot be updated"), { status: 400 });
  }

  record.status = "archived";
  await record.save();

  await logTimeline(recordId, "ARCHIVED", userId, userRole);
  await incrementAnalytics(getTodayIST(), "archiveCount");

  return record;
};

export const lockRecord = async (recordId, userId, userRole) => {
  const record = await MedicalRecord.findById(recordId);
  if (!record) {
    throw Object.assign(new Error("Medical record not found"), { status: 404 });
  }

  record.status = "locked";
  await record.save();

  await logTimeline(recordId, "UPDATED", userId, userRole, { action: "LOCKED" });

  return record;
};

export const deleteRecord = async (recordId, userId, userRole) => {
  const record = await MedicalRecord.findById(recordId);
  if (!record) {
    throw Object.assign(new Error("Medical record not found"), { status: 404 });
  }

  record.status = "deleted";
  record.deletedAt = new Date();
  await record.save();

  await logTimeline(recordId, "ARCHIVED", userId, userRole, { action: "DELETED" });

  return record;
};

export const exportRecord = async (recordId, userRole, userId, format = "json") => {
  const details = await getRecordDetail(recordId, userRole, userId);
  
  if (userRole === "admin") {
    // Log audit trail (Rule 4)
    await MedicalRecordExportLog.create({
      recordId,
      exportedBy: userId,
      format,
      version: details.record.latestVersion
    });
    await incrementAnalytics(getTodayIST(), "exportsGenerated");

    return {
      exportVersion: details.record.latestVersion,
      generatedAt: new Date().toISOString(),
      record: details.record
    };
  }

  const payload = {
    exportVersion: details.record.latestVersion,
    generatedAt: new Date().toISOString(),
    record: details.record,
    activeVersion: details.activeVersion,
    attachments: details.attachments
  };

  // Log audit trail (Rule 4)
  await MedicalRecordExportLog.create({
    recordId,
    exportedBy: userId,
    format,
    version: details.record.latestVersion
  });
  await incrementAnalytics(getTodayIST(), "exportsGenerated");

  if (format === "pdf_ready") {
    const printableHtml = `
      <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2>EMR Medical Record Export (Frozen Snapshot)</h2>
        <p><strong>Export Version:</strong> ${payload.exportVersion}</p>
        <p><strong>Generated At:</strong> ${payload.generatedAt}</p>
        <hr/>
        <h3>Practitioner Snapshot</h3>
        <p><strong>Doctor Name:</strong> Dr. ${payload.record.doctorSnapshot.name}</p>
        <p><strong>Specialization:</strong> ${payload.record.doctorSnapshot.specialization}</p>
        <p><strong>Hospital Name:</strong> ${payload.record.doctorSnapshot.hospitalName}</p>
        <hr/>
        <h3>Active EMR Summary</h3>
        <p><strong>Chief Complaint:</strong> ${payload.activeVersion.summary.chiefComplaint}</p>
        <p><strong>Clinical Summary:</strong> ${payload.activeVersion.summary.consultationSummary}</p>
        <p><strong>Follow-up Advice:</strong> ${payload.activeVersion.summary.followUpAdvice || "None"}</p>
        <hr/>
        <h3>Diagnoses</h3>
        <ul>
          ${payload.activeVersion.diagnosis.map(d => `<li><strong>${d.name}</strong> (Severity: ${d.severity}, Confidence: ${d.confidence}%) - ${d.notes || "No notes"}</li>`).join("")}
        </ul>
        <hr/>
        <h3>Medications</h3>
        <ul>
          ${payload.activeVersion.medications.map(m => `<li><strong>${m.name}</strong> - ${m.dosage} (${m.frequency} for ${m.duration})</li>`).join("")}
        </ul>
      </div>
    `;
    return {
      exportVersion: payload.exportVersion,
      generatedAt: payload.generatedAt,
      pdfReadyHtml: printableHtml
    };
  }

  return payload;
};
