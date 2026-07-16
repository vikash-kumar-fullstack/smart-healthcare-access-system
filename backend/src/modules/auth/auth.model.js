import mongoose from "mongoose";

const providerSchema = new mongoose.Schema({
  type: {
    type: String,
    enum: ["local", "google", "linkedin"],
    required: true
  },
  providerId: {
    type: String,
    default: null
  }
}, { _id: false });

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },

  email: {
    type: String,
    required: true,
    unique: true
  },

  phone: {
    type: String,
    unique: true,
    sparse: true
  },

  password: {
    type: String
  },

  role: {
    type: String,
    enum: ["patient", "doctor", "admin", "super_admin", "district_admin", "hospital_admin", "receptionist"],
    default: "patient"
  },

  providers: {
    type: [providerSchema],
    default: [{ type: "local", providerId: null }]
  },

  isEmailVerified: {
    type: Boolean,
    default: false
  },

  isPhoneVerified: {
    type: Boolean,
    default: false
  },

  profileCompleted: {
    type: Boolean,
    default: false
  },

  gender: {
    type: String,
    default: null
  },

  dob: {
    type: Date,
    default: null
  },

  avatar: {
    type: String,
    default: null
  },

  hospitalId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Hospital",
    default: null
  },

  district: {
    type: String,
    default: null
  },

  address: {
    type: String,
    default: null
  },

  isActive: {
    type: Boolean,
    default: true
  },

  accountStatus: {
    type: String,
    enum: ["ACTIVE", "INACTIVE", "DECEASED", "ARCHIVED"],
    default: "ACTIVE"
  },

  refreshToken: {
    type: String,
    default: null
  }

}, { timestamps: true });

userSchema.index({ role: 1 });
userSchema.index({ hospitalId: 1 });
userSchema.index({ accountStatus: 1 });

// Check existing model to avoid OverwriteModelError
const User = mongoose.models.User || mongoose.model("User", userSchema);

export default User;