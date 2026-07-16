import mongoose from "mongoose";

const realtimeSequenceSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    unique: true
  },
  current: {
    type: Number,
    default: 0
  }
}, { timestamps: true });

const RealtimeSequence = mongoose.model("RealtimeSequence", realtimeSequenceSchema);
export default RealtimeSequence;
