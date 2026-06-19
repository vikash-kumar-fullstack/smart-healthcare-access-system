import mongoose from "mongoose";

const visitSequenceSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true
  },
  current: {
    type: Number,
    default: 0
  }
}, { timestamps: true });

const VisitSequence = mongoose.model("VisitSequence", visitSequenceSchema);
export default VisitSequence;
