import mongoose from "mongoose";

const receptionAuditSchema = new mongoose.Schema({
  hospitalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Hospital",
    required: true
  },
  operatorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  action: {
    type: String,
    enum: [
      "CHECK_IN",
      "WALK_IN",
      "TRANSFER",
      "LATE_CHECK_IN",
      "MANUAL_OVERRIDE",
      "NO_SHOW_OVERRIDE",
      "EMERGENCY",
      "TOKEN_PRINT"
    ],
    required: true
  },
  bookingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "AppointmentBooking"
  },
  reason: {
    type: String
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed
  }
}, { timestamps: true });

receptionAuditSchema.pre("save", function () {
  if (!this.isNew) {
    throw new Error("ReceptionAudit log entry is immutable and cannot be updated.");
  }
});

receptionAuditSchema.pre("deleteOne", { document: true, query: true }, function () {
  throw new Error("ReceptionAudit log entry is immutable and cannot be deleted.");
});

receptionAuditSchema.pre("remove", function () {
  throw new Error("ReceptionAudit log entry is immutable and cannot be deleted.");
});

const ReceptionAudit = mongoose.models.ReceptionAudit || mongoose.model("ReceptionAudit", receptionAuditSchema);

export default ReceptionAudit;
