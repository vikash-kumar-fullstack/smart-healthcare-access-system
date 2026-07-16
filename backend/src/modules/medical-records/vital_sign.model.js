import mongoose from "mongoose";

const vitalSignSchema = new mongoose.Schema({
  patientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true
  },
  doctorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Doctor",
    required: true
  },
  visitId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Visit",
    required: true,
    index: true
  },
  bp: {
    systolic: { type: Number },
    diastolic: { type: Number }
  },
  pulse: { type: Number },
  height: { type: Number }, // in cm
  weight: { type: Number }, // in kg
  bmi: { type: Number },
  temperature: { type: Number }, // in Fahrenheit
  respRate: { type: Number },
  spo2: { type: Number } // percentage
}, { timestamps: true });

const VitalSign = mongoose.models.VitalSign || mongoose.model("VitalSign", vitalSignSchema);
export default VitalSign;
