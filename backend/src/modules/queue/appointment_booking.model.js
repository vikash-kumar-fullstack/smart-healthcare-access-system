import mongoose from "mongoose";

const appointmentBookingSchema = new mongoose.Schema({
  bookingNumber: {
    type: String,
    required: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  doctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Doctor",
    required: true
  },
  hospitalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Hospital",
    required: true
  },
  sessionId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "QueueSession",
    required: true
  },
  date: {
    type: String, // YYYY-MM-DD
    required: true,
    index: true
  },
  slotTime: {
    type: String, // e.g. "09:20"
    required: true
  },
  status: {
    type: String,
    enum: ["BOOKED", "CONFIRMED", "REMINDER_SENT", "READY", "IN_CONSULTATION", "COMPLETED", "CANCELLED", "TRANSFERRED", "EXPIRED"],
    default: "BOOKED"
  },
  arrivalStatus: {
    type: String,
    enum: ["NOT_ARRIVED", "CHECKED_IN", "LATE", "NO_SHOW"],
    default: "NOT_ARRIVED"
  },
  checkInTime: {
    type: Date,
    default: null
  },
  checkInMethod: {
    type: String,
    enum: ["app", "qr", "reception"],
    default: null
  },
  transferredFromDoctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Doctor",
    default: null
  },
  notes: {
    type: String,
    default: ""
  }
}, { timestamps: true });

appointmentBookingSchema.index({ doctorId: 1, date: 1 });
appointmentBookingSchema.index({ userId: 1, status: 1 });
appointmentBookingSchema.index({ bookingNumber: 1, doctorId: 1 }, { unique: true });
appointmentBookingSchema.index({ doctorId: 1, date: 1, slotTime: 1 });
appointmentBookingSchema.index({ userId: 1, createdAt: 1 });
appointmentBookingSchema.index({ status: 1 });
appointmentBookingSchema.index({ checkInTime: 1 });

const AppointmentBooking = mongoose.model("AppointmentBooking", appointmentBookingSchema);
export default AppointmentBooking;
