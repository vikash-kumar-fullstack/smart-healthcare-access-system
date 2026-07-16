import mongoose from "mongoose";

const bookingCounterSchema = new mongoose.Schema({
  hospitalId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true
  },
  date: {
    type: String,
    required: true
  },
  count: {
    type: Number,
    default: 0
  }
});

bookingCounterSchema.index({ hospitalId: 1, date: 1 }, { unique: true });

const BookingCounter = mongoose.model("BookingCounter", bookingCounterSchema);
export default BookingCounter;
