const phiClassification = {
  PUBLIC: ["hospitalName", "specialization", "address", "city", "rating"],
  INTERNAL: ["schedules", "utilization", "shifts"],
  SENSITIVE: ["phone", "email", "emergencyContact.phone", "aadhaarNumber", "governmentId", "insuranceId"],
  PHI: ["diagnosis", "prescription", "clinicalNotes", "labReports", "medicalAttachments", "vitals"]
};

export default phiClassification;
