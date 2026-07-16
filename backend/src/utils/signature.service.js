import crypto from "crypto";

const getServerSalt = () => {
  return process.env.PRESCRIPTION_SIGNING_SALT || "medhospi_secret_signing_salt_2026";
};

export const generatePrescriptionSignature = (prescription) => {
  // Normalize fields that impact the medical validity of the prescription
  const docId = String(prescription.doctorId || prescription.signedBy || "");
  const patientId = String(prescription.patientId || "");
  const medications = Array.isArray(prescription.medications)
    ? prescription.medications.map(m => `${m.name || ""}:${m.dosage || ""}:${m.frequency || ""}`).join("|")
    : Array.isArray(prescription.medicines)
      ? prescription.medicines.map(m => `${m.genericName || ""}:${m.dosage || ""}:${m.frequency || ""}`).join("|")
      : "";
  
  // Combine fields into a canonical format
  const payload = [docId, patientId, medications].join(";");
  
  // Sign using HMAC-SHA256
  return crypto.createHmac("sha256", getServerSalt()).update(payload).digest("hex");
};

export const verifyPrescriptionSignature = (prescription) => {
  if (!prescription.signatureHash) return false;
  try {
    const currentHash = generatePrescriptionSignature(prescription);
    return crypto.timingSafeEqual(
      Buffer.from(currentHash, "hex"),
      Buffer.from(prescription.signatureHash, "hex")
    );
  } catch (err) {
    return false;
  }
};
