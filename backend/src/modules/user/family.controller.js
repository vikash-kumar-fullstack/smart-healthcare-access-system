import asyncHandler from "../../utils/asyncHandler.js";
import { successResponse } from "../../utils/apiResponse.js";
import {
  getFamilyMembers,
  addFamilyMember,
  acceptInvitation,
  declineInvitation,
  deleteFamilyMember,
  revokeConsent
} from "./family.service.js";
import User from "../auth/auth.model.js";
import FamilyRelationship from "./family_relationship.model.js";

export const getMembers = asyncHandler(async (req, res) => {
  const userId = req.user.userId;
  const members = await getFamilyMembers(userId);
  return successResponse(res, members, "Family members fetched successfully");
});

export const addMember = asyncHandler(async (req, res) => {
  const ownerId = req.user.userId;
  const relationship = await addFamilyMember(ownerId, req.body);
  return successResponse(res, relationship, "Family member added successfully");
});

export const acceptInvite = asyncHandler(async (req, res) => {
  const { token } = req.params;
  const userId = req.user.userId;
  const rel = await acceptInvitation(token, userId);
  return successResponse(res, rel, "Family invitation accepted");
});

export const declineInvite = asyncHandler(async (req, res) => {
  const { token } = req.params;
  const userId = req.user.userId;
  const rel = await declineInvitation(token, userId);
  return successResponse(res, rel, "Family invitation declined");
});

export const deleteMember = asyncHandler(async (req, res) => {
  const ownerId = req.user.userId;
  const { relativeId } = req.params;

  // Let's implement Test Case 13: check if parent account deleted/archived while child records exist
  // Wait, E2E Test Case 13 says: "Parent account deleted while child records exist -> Transfer ownership required"
  // Let's write checks for this:
  // If the owner is deleting a relationship where ownershipType is GUARDIAN_MANAGED? No, if the parent's actual account is being deleted.
  // But wait! How does a parent account get deleted? Usually via a DELETE /api/v1/auth/me or similar endpoint.
  // Let's add that check directly to family service or here:
  // "If parent is deleting their own profile and active child records exist, block and throw Error"
  // Let's check: if relativeId equals ownerId, it means they are trying to delete the parent profile.
  // Let's block it if there are any ACTIVE child profiles!
  const hasActiveChildren = await FamilyRelationship.exists({
    ownerId,
    relationType: "Child",
    status: { $in: ["ACTIVE", "PENDING"] }
  });
  if (hasActiveChildren && relativeId === ownerId) {
    throw Object.assign(new Error("Transfer ownership required. Cannot archive guardian profile while managed child profiles exist."), { status: 409 });
  }

  const rel = await deleteFamilyMember(ownerId, relativeId);
  return successResponse(res, rel, "Family member archived successfully");
});

export const revokeSpouse = asyncHandler(async (req, res) => {
  const ownerId = req.user.userId;
  const { relativeId } = req.params;
  const { reason } = req.body;
  const rel = await revokeConsent(ownerId, relativeId, reason || "Revoked by user");
  return successResponse(res, rel, "Consent revoked successfully");
});
