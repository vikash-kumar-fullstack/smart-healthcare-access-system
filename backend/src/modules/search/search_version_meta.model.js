import mongoose from "mongoose";

const searchVersionMetaSchema = new mongoose.Schema({
  key: {
    type: String,
    required: true,
    unique: true,
    default: "global-versions"
  },
  queueVersion: {
    type: Number,
    required: true,
    default: 0
  },
  availabilityVersion: {
    type: Number,
    required: true,
    default: 0
  }
}, { timestamps: true });

searchVersionMetaSchema.index({ key: 1 }, { unique: true });

const SearchVersionMeta = mongoose.model("SearchVersionMeta", searchVersionMetaSchema);
export default SearchVersionMeta;
