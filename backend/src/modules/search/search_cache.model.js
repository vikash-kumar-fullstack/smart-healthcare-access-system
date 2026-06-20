import mongoose from "mongoose";

const searchCacheSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true
  },
  results: {
    type: [mongoose.Schema.Types.Mixed],
    required: true
  },
  cursor: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  },
  cacheContext: {
    queueVersion: {
      type: Number,
      default: 0
    },
    availabilityVersion: {
      type: Number,
      default: 0
    },
    searchEngineVersion: {
      type: Number,
      default: 1
    }
  },
  payloadSizeBytes: {
    type: Number,
    default: 0
  },
  generatedAt: {
    type: Date,
    default: Date.now
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
}, { timestamps: true });

searchCacheSchema.index({ key: 1 }, { unique: true });
searchCacheSchema.index({ createdAt: 1 }, { expireAfterSeconds: 60 });

const SearchCache = mongoose.model("SearchCache", searchCacheSchema);
export default SearchCache;
