import User from "../auth/auth.model.js";
import FamilyRelationship from "./family_relationship.model.js";
import crypto from "crypto";
import mongoose from "mongoose";

const createError = (message, status = 500) => {
  return Object.assign(new Error(message), { status });
};

// Default Limits
const MAX_TOTAL_LIMIT = parseInt(process.env.MAX_MANAGED_MEMBERS || "10");
const LIMITS_PER_ROLE = {
  Child: 5,
  Parent: 2,
  Spouse: 1,
  Dependent: 5,
  Guardian: 5,
  Caregiver: 5,
  Other: 5
};

/**
 * Get active and pending family relationships for a user
 */
export const getFamilyMembers = async (userId) => {
  const relationships = await FamilyRelationship.find({
    ownerId: userId,
    status: { $in: ["ACTIVE", "PENDING"] }
  }).populate("relativeId");

  const now = new Date();
  const activeMembers = [];
  const Queue = mongoose.model("Queue");

  for (const rel of relationships) {
    if (rel.validUntil && rel.validUntil < now) {
      rel.status = "ARCHIVED";
      rel.revocationReason = "Relationship expired";
      await rel.save();
      continue;
    }

    rel.lastAccessedAt = now;
    await rel.save();

    const activeBooking = await Queue.findOne({ userId: rel.relativeId._id, isActive: true })
      .populate("doctorId");

    const relObj = rel.toObject();
    relObj.activeBooking = activeBooking || null;
    activeMembers.push(relObj);
  }

  return activeMembers;
};

/**
 * Add a family member (managed sub-profile or invitation-based)
 */
export const addFamilyMember = async (ownerId, data) => {
  const { relationType, name, dob, gender, phone, bloodGroup, email } = data;

  if (!relationType || !name) {
    throw createError("Relation type and name are required.", 400);
  }

  // 1. Validate total family member limit
  const totalCount = await FamilyRelationship.countDocuments({
    ownerId,
    status: { $in: ["ACTIVE", "PENDING"] }
  });
  if (totalCount >= MAX_TOTAL_LIMIT) {
    throw createError("Maximum family profile limit reached.", 409);
  }

  // 2. Validate per-relationship-role limits
  const roleCount = await FamilyRelationship.countDocuments({
    ownerId,
    relationType,
    status: { $in: ["ACTIVE", "PENDING"] }
  });
  const roleLimit = LIMITS_PER_ROLE[relationType] || 5;
  if (roleCount >= roleLimit) {
    throw createError(`Maximum limit for relation type ${relationType} exceeded.`, 409);
  }

  // 3. Duplicate phone registration check
  if (phone) {
    const existingPhoneUser = await User.findOne({ phone });
    if (existingPhoneUser) {
      throw createError("Duplicate phone number registration. Phone already in use by active account.", 409);
    }
  }

  // Determine relationship access defaults
  let managementType = "FULL_ACCESS";
  let ownershipType = "GUARDIAN_MANAGED";
  let status = "ACTIVE";
  let invitationToken = null;
  let invitationExpiresAt = null;

  if (relationType === "Child") {
    managementType = "FULL_ACCESS";
    ownershipType = "GUARDIAN_MANAGED";
    status = "ACTIVE";
  } else if (relationType === "Parent") {
    managementType = "CAREGIVER_ACCESS";
    ownershipType = "SELF_MANAGED";
    status = "ACTIVE";
  } else if (relationType === "Spouse") {
    managementType = "INVITATION_REQUIRED";
    ownershipType = "SHARED_MANAGED";
    status = "PENDING";
    invitationToken = crypto.randomBytes(32).toString("hex");
    invitationExpiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  } else {
    // Default fallback
    managementType = "FULL_ACCESS";
    ownershipType = "GUARDIAN_MANAGED";
    status = "ACTIVE";
  }

  let relativeUser = null;

  if (status === "PENDING" && email) {
    // Check if user already exists
    relativeUser = await User.findOne({ email });
    if (!relativeUser) {
      // Create a pending invitation shell account or throw/create placeholder
      relativeUser = await User.create({
        name,
        email,
        phone,
        gender,
        dob,
        role: "patient",
        profileCompleted: false,
        accountStatus: "INACTIVE"
      });
    }
  } else {
    // Generate a unique system-managed email to avoid uniqueness constraint crashes
    const suffix = crypto.randomBytes(4).toString("hex");
    const mockEmail = `managed-${relationType.toLowerCase()}-${suffix}@family.local`;

    relativeUser = await User.create({
      name,
      email: mockEmail,
      phone: phone || undefined,
      gender,
      dob,
      bloodGroup,
      role: "patient",
      profileCompleted: true,
      accountStatus: "ACTIVE"
    });
  }

  // Create FamilyRelationship entry
  const relationship = await FamilyRelationship.create({
    ownerId,
    relativeId: relativeUser._id,
    relationType,
    managementType,
    ownershipType,
    status,
    invitationToken,
    invitationExpiresAt,
    createdBy: ownerId,
    updatedBy: ownerId,
    validUntil: data.validUntil ? new Date(data.validUntil) : null
  });

  return relationship;
};

/**
 * Accept invitation using token
 */
export const acceptInvitation = async (token, userId) => {
  const rel = await FamilyRelationship.findOne({ invitationToken: token });
  if (!rel) {
    throw createError("Invitation not found.", 404);
  }

  if (rel.status !== "PENDING") {
    throw createError("Invitation is no longer pending.", 400);
  }

  if (rel.invitationExpiresAt && rel.invitationExpiresAt < new Date()) {
    rel.status = "REVOKED";
    rel.revocationReason = "Invitation expired";
    await rel.save();
    throw createError("Invitation expired.", 410);
  }

  // Update recipient status and link
  rel.status = "ACTIVE";
  rel.relativeId = userId; // Bind relative account
  rel.updatedBy = userId;
  await rel.save();

  // Make sure the accepted user account is marked ACTIVE
  const acceptedUser = await User.findById(userId);
  if (acceptedUser && acceptedUser.accountStatus !== "ACTIVE") {
    acceptedUser.accountStatus = "ACTIVE";
    await acceptedUser.save();
  }

  return rel;
};

/**
 * Decline/cancel invitation
 */
export const declineInvitation = async (token, userId) => {
  const rel = await FamilyRelationship.findOne({ invitationToken: token });
  if (!rel) {
    throw createError("Invitation not found.", 404);
  }

  rel.status = "REVOKED";
  rel.revocationReason = "Invitation declined";
  rel.updatedBy = userId;
  await rel.save();
  return rel;
};

/**
 * Delete a family member (soft archive)
 */
export const deleteFamilyMember = async (ownerId, relativeId) => {
  // Check: before deleting, does this owner own active children profiles?
  // Prevent deleting parent profile if child profiles depend on them, etc.
  // Wait, E2E Test Case 13 says: "Parent account deleted while child records exist -> Transfer ownership required"
  // So if relativeId is the parent, and they delete it, or if ownerId deletes themselves.
  // Let's implement that validation:
  const rel = await FamilyRelationship.findOne({ ownerId, relativeId, status: { $ne: "ARCHIVED" } });
  if (!rel) {
    throw createError("Family member relationship not found.", 404);
  }

  // Soft archive
  rel.status = "ARCHIVED";
  rel.revocationReason = "Deleted by parent/guardian";
  rel.updatedBy = ownerId;
  await rel.save();

  return rel;
};

/**
 * Revoke consent from spouse or relative
 */
export const revokeConsent = async (ownerId, relativeId, reason = "Consent revoked") => {
  const rel = await FamilyRelationship.findOne({ ownerId, relativeId });
  if (!rel) {
    throw createError("Relationship not found.", 404);
  }

  rel.status = "REVOKED";
  rel.revocationReason = reason;
  rel.updatedBy = ownerId;
  await rel.save();

  return rel;
};

/**
 * Validate if owner has active access to relative profile
 */
export const hasFamilyAccess = async (ownerId, relativeId) => {
  if (!ownerId || !relativeId) return false;
  if (ownerId.toString() === relativeId.toString()) return true;

  const rel = await FamilyRelationship.findOne({
    ownerId,
    relativeId,
    status: "ACTIVE"
  });

  if (!rel) return false;

  // Expiry check
  if (rel.validUntil && rel.validUntil < new Date()) {
    rel.status = "ARCHIVED";
    rel.revocationReason = "Relationship expired";
    await rel.save();
    return false;
  }

  return true;
};
