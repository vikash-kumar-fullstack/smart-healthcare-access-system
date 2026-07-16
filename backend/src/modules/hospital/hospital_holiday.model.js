import mongoose from "mongoose";

const hospitalHolidaySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  date: {
    type: String, // "YYYY-MM-DD"
    required: true
  },
  type: {
    type: String,
    enum: ["national_holiday", "state_holiday", "district_holiday", "hospital_holiday", "emergency_closure"],
    default: "hospital_holiday"
  },
  district: {
    type: String
  },
  state: {
    type: String
  }
}, { timestamps: true });

hospitalHolidaySchema.index({ date: 1, type: 1 });

const HospitalHoliday = mongoose.model("HospitalHoliday", hospitalHolidaySchema);
export default HospitalHoliday;
