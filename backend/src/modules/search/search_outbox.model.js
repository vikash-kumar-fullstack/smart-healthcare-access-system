import mongoose from "mongoose";

const searchOutboxSchema = new mongoose.Schema({
  eventType: {
    type: String,
    enum: ["SEARCH_EXECUTED", "SEARCH_CLICKED", "SEARCH_BOOKED"],
    required: true
  },
  payload: {
    type: mongoose.Schema.Types.Mixed,
    required: true
  },
  status: {
    type: String,
    enum: ["pending", "processing", "processed", "failed"],
    default: "pending"
  },
  lockedAt: {
    type: Date
  },
  attempts: {
    type: Number,
    default: 0
  },
  nextRetryAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

searchOutboxSchema.index({ status: 1, nextRetryAt: 1 });

const SearchOutbox = mongoose.model("SearchOutbox", searchOutboxSchema);
export default SearchOutbox;
