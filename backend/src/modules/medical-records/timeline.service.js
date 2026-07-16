import PatientTimelineEvent from "./patient_timeline_event.model.js";

/**
 * Log an append-only patient timeline event
 */
export const logTimelineEvent = async (patientId, actorId, actorRole, source, eventType, referenceType, referenceId, metadata = {}) => {
  return await PatientTimelineEvent.create({
    patientId,
    actorId,
    actorRole,
    source,
    eventType,
    referenceType,
    referenceId,
    metadata
  });
};

/**
 * Fetch patient chronological feed
 */
export const getPatientFeed = async (patientId) => {
  return await PatientTimelineEvent.find({ patientId })
    .sort({ timestamp: -1 });
};
