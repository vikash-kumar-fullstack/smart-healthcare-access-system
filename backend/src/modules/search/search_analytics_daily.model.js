import mongoose from "mongoose";

const searchAnalyticsDailySchema = new mongoose.Schema({
  date: {
    type: String, // "YYYY-MM-DD"
    required: true
  },
  scope: {
    type: String, // e.g. "global", "symptom_fever", etc.
    required: true
  },
  searches: {
    type: Number,
    default: 0
  },
  clicks: {
    type: Number,
    default: 0
  },
  bookings: {
    type: Number,
    default: 0
  },
  ctr: {
    type: Number,
    default: 0
  },
  conversionRate: {
    type: Number,
    default: 0
  }
}, { timestamps: true });

searchAnalyticsDailySchema.index({ date: 1, scope: 1 }, { unique: true });

const SearchAnalyticsDaily = mongoose.model("SearchAnalyticsDaily", searchAnalyticsDailySchema);
export default SearchAnalyticsDaily;
