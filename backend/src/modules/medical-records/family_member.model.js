import mongoose from "mongoose";

const familyMemberSchema = new mongoose.Schema({
  primaryUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  memberUserId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  relationship: {
    type: String,
    enum: ["parent", "child", "spouse", "dependent", "guardian", "caregiver"],
    required: true
  }
}, { timestamps: true });

familyMemberSchema.index({ primaryUserId: 1, memberUserId: 1 }, { unique: true });

const FamilyMember = mongoose.models.FamilyMember || mongoose.model("FamilyMember", familyMemberSchema);
export default FamilyMember;
