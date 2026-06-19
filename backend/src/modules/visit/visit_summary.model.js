import mongoose from "mongoose";

const visitSummarySchema = new mongoose.Schema({
  visitId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Visit",
    required: true
  },
  chiefComplaint: {
    type: String,
    required: true
  },
  doctorNotes: {
    type: String,
    required: true
  },
  consultationSummary: {
    type: String,
    required: true
  },
  followUpAdvice: {
    type: String,
    default: ""
  },
  visibility: {
    type: String,
    enum: ["patient", "doctor", "internal"],
    default: "patient"
  },
  version: {
    type: Number,
    default: 1
  },
  summaryStatus: {
    type: String,
    enum: ["active", "archived"],
    default: "active"
  },
  deletedAt: {
    type: Date,
    default: null
  }
}, { timestamps: true });

visitSummarySchema.index({ visitId: 1, version: 1 }, { unique: true });

const VisitSummary = mongoose.model("VisitSummary", visitSummarySchema);
export default VisitSummary;
