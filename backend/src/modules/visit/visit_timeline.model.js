import mongoose from "mongoose";

const visitTimelineSchema = new mongoose.Schema({
  visitId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Visit",
    required: true
  },
  eventType: {
    type: String,
    enum: [
      "BOOKED",
      "QUEUE_UPDATED",
      "DOCTOR_DELAY",
      "SESSION_STARTED",
      "YOUR_TURN",
      "CONSULTATION_STARTED",
      "VISIT_COMPLETED",
      "VISIT_CANCELLED",
      "NO_SHOW",
      "SUMMARY_UPDATED"
    ],
    required: true
  },
  message: {
    type: String,
    required: true
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  occurredAt: {
    type: Date,
    default: Date.now
  },
  sequence: {
    type: Number,
    required: true
  },
  deletedAt: {
    type: Date,
    default: null
  }
}, { timestamps: true });

visitTimelineSchema.index({ visitId: 1, sequence: 1 }, { unique: true });

visitTimelineSchema.pre("save", async function () {
  if (!this.isNew) {
    throw new Error("Timeline events are append-only and cannot be modified (Lock 3).");
  }
});

const VisitTimeline = mongoose.model("VisitTimeline", visitTimelineSchema);
export default VisitTimeline;
