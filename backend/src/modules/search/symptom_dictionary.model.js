import mongoose from "mongoose";

const symptomDictionarySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  aliases: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  specializationIds: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  severity: {
    type: String,
    enum: ["low", "medium", "high"],
    default: "low"
  },
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }]
}, { timestamps: true });

symptomDictionarySchema.index({ name: 1 }, { unique: true });
symptomDictionarySchema.index({ aliases: 1 });

const SymptomDictionary = mongoose.model("SymptomDictionary", symptomDictionarySchema);
export default SymptomDictionary;
