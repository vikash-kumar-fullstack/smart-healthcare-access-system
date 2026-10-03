import mongoose from "mongoose";

const accountBookingCapacitySchema = new mongoose.Schema({
  ownerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true,
    index: true
  },
  activeBookings: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: "AppointmentBooking"
  }]
}, { timestamps: true });

const AccountBookingCapacity = mongoose.model("AccountBookingCapacity", accountBookingCapacitySchema);
export default AccountBookingCapacity;
