import mongoose from "mongoose";

const loginAttemptSchema = new mongoose.Schema({
  email: {
    type: String,
    required: true,
    index: true
  },
  ipAddress: {
    type: String,
    required: true
  },
  attempts: {
    type: Number,
    default: 0
  },
  lockoutUntil: {
    type: Date,
    default: null
  }
}, { timestamps: true });

const LoginAttempt = mongoose.model("LoginAttempt", loginAttemptSchema);
export default LoginAttempt;
