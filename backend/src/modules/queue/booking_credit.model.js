import mongoose from "mongoose";

const bookingCreditSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  credits: {
    type: Number,
    default: 1
  },
  expiresAt: {
    type: Date,
    required: true
  },
  reason: {
    type: String,
    enum: ["session_closed", "doctor_cancelled", "future_compensation"],
    required: true
  },
  used: {
    type: Boolean,
    default: false
  },
  expired: {
    type: Boolean,
    default: false
  }
}, { timestamps: true });

bookingCreditSchema.index({ userId: 1, used: 1, expired: 1, expiresAt: 1 });

const BookingCredit = mongoose.model("BookingCredit", bookingCreditSchema);
export default BookingCredit;
