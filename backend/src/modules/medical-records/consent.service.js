import PatientConsent from "./patient_consent.model.js";

/**
 * Grant access consent to doctor or hospital
 */
export const grantConsent = async (patientId, granteeId, granteeType, scope, durationDays) => {
  const expiry = new Date();
  expiry.setDate(expiry.getDate() + durationDays);

  return await PatientConsent.findOneAndUpdate(
    { patientId, granteeId, granteeType },
    { scope, expiry, status: "granted" },
    { upsert: true, new: true }
  );
};

/**
 * Revoke consent
 */
export const revokeConsent = async (patientId, granteeId) => {
  const consent = await PatientConsent.findOne({ patientId, granteeId });
  if (!consent) throw new Error("Consent record not found.");

  consent.status = "revoked";
  await consent.save();
  return consent;
};

/**
 * Validate active access permission
 */
export const checkAccessConsent = async (patientId, granteeId, requiredScope, options = {}) => {
  // Check if self-access
  if (patientId.toString() === granteeId.toString()) return true;

  // Check emergency access override
  if (options.emergencyOverride) {
    const { writeAuditLog } = await import("../admin/governance.service.js").catch(() => ({}));
    if (writeAuditLog) {
      await writeAuditLog(granteeId, "EMERGENCY_OVERRIDE_ACCESS", {
        patientId,
        reason: options.overrideReason || "Emergency medical chart access bypass"
      }).catch(err => console.error("Failed to write emergency override audit log:", err));
    }
    return true;
  }

  // Check family relationship access
  try {
    const { hasFamilyAccess } = await import("../user/family.service.js");
    const hasFamily = await hasFamilyAccess(granteeId, patientId);
    if (hasFamily) return true;
  } catch (err) {
    console.error("Family access check failed in consent service:", err);
  }

  const consent = await PatientConsent.findOne({
    patientId,
    granteeId,
    status: "granted",
    expiry: { $gt: new Date() }
  });

  if (!consent) return false;
  return consent.scope.includes(requiredScope);
};
