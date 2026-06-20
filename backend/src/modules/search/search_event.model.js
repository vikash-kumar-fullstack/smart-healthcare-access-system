import mongoose from "mongoose";

const searchEventSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    default: null
  },
  query: {
    type: String,
    required: true
  },
  normalizedQuery: {
    type: String,
    required: true
  },
  selectedDoctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Doctor",
    default: null
  },
  booked: {
    type: Boolean,
    default: false
  },
  searchedAt: {
    type: Date,
    default: Date.now
  },
  searchVersion: {
    type: Number,
    default: 1
  },
  contractVersion: {
    type: Number,
    default: 1
  },
  state: {
    type: String,
    enum: ["searched", "opened", "booked", "expired"],
    default: "searched"
  },
  rankingSnapshot: {
    specializationScore: Number,
    distanceScore: Number,
    availabilityScore: Number,
    queueScore: Number,
    reliabilityScore: Number,
    finalScore: Number,
    why: [String]
  },
  expiresAt: {
    type: Date,
    required: true
  }
}, { timestamps: true });

searchEventSchema.index({ userId: 1, searchedAt: -1 });
searchEventSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const SearchEvent = mongoose.model("SearchEvent", searchEventSchema);
export default SearchEvent;
