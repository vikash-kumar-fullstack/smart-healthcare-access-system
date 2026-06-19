import mongoose from "mongoose";

const hospitalSchema = new mongoose.Schema({

  name: {
    type: String,
    required: true
  },

  address: {
    type: String,
    required: true
  },

  location: {
    type: {
      type: String,
      enum: ["Point"],
      default: "Point"
    },
    coordinates: {
      type: [Number], // [lng, lat]
      required: true
    }
  },

  specializations: [{
    type: String
  }],

  rating: {
    type: Number,
    default: 0
  },

  isActive: {
    type: Boolean,
    default: true
  }

}, { timestamps: true });


// GEO INDEX
hospitalSchema.index({ location: "2dsphere" });

const Hospital = mongoose.model("Hospital", hospitalSchema);

export default Hospital;