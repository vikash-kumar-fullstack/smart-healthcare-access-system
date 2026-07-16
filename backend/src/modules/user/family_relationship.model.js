import mongoose from "mongoose";

const familyRelationshipSchema = new mongoose.Schema({
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  relativeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  relationType: {
    type: String,
    enum: ["Child", "Parent", "Spouse", "Dependent", "Guardian", "Caregiver", "Other"],
    required: true
  },
  managementType: {
    type: String,
    enum: ["FULL_ACCESS", "CAREGIVER_ACCESS", "INVITATION_REQUIRED"],
    required: true
  },
  ownershipType: {
    type: String,
    enum: ["SELF_MANAGED", "GUARDIAN_MANAGED", "SHARED_MANAGED"],
    required: true
  },
  status: {
    type: String,
    enum: ["PENDING", "ACTIVE", "REVOKED", "ARCHIVED"],
    default: "PENDING"
  },
  invitationToken: {
    type: String,
    default: null
  },
  invitationExpiresAt: {
    type: Date,
    default: null
  },
  validUntil: {
    type: Date,
    default: null
  },
  revocationReason: {
    type: String,
    default: ""
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  lastAccessedAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

familyRelationshipSchema.index({ ownerId: 1, relativeId: 1 }, { unique: true });
familyRelationshipSchema.index({ invitationToken: 1 });

const FamilyRelationship = mongoose.models.FamilyRelationship || mongoose.model("FamilyRelationship", familyRelationshipSchema);
export default FamilyRelationship;
