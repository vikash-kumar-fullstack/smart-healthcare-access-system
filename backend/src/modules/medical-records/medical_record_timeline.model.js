import mongoose from "mongoose";

const medicalRecordTimelineSchema = new mongoose.Schema({
  recordId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "MedicalRecord",
    required: true
  },
  action: {
    type: String,
    enum: ["CREATED", "UPDATED", "VIEWED", "SHARED", "ARCHIVED"],
    required: true
  },
  sequenceNumber: {
    type: Number,
    required: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  userRole: {
    type: String,
    required: true
  },
  details: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, { timestamps: true });

medicalRecordTimelineSchema.index({ recordId: 1 });

const MedicalRecordTimeline = mongoose.model("MedicalRecordTimeline", medicalRecordTimelineSchema);
export default MedicalRecordTimeline;
