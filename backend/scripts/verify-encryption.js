import mongoose from "mongoose";
import dotenv from "dotenv";
import PatientHealthProfile from "../src/modules/medical-records/patient_health_profile.model.js";

dotenv.config();

const verifyEncryption = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log("Connected to DB for Encryption Verification.");

    // Retrieve one active profile to test
    const cleanProfile = await PatientHealthProfile.findOne({});
    if (!cleanProfile) {
      console.log("No health profiles found. Seeding a mock one for test.");
      const mockUser = new mongoose.Types.ObjectId();
      const mockProfile = new PatientHealthProfile({
        patientId: mockUser,
        bloodGroup: "O+",
        emergencyContact: {
          name: "Test Contact",
          phone: "9876543210",
          relation: "Friend"
        }
      });
      await mockProfile.save();
    }

    // Retrieve a profile using standard mongoose find (should trigger decryption)
    const profileMongoose = await PatientHealthProfile.findOne({});
    const phoneDecrypted = profileMongoose.emergencyContact.phone;
    console.log("Mongoose Read Decrypted Phone:", phoneDecrypted);

    // Retrieve the same document directly from MongoDB driver (should remain encrypted)
    const rawDoc = await PatientHealthProfile.collection.findOne({ _id: profileMongoose._id });
    const phoneRaw = rawDoc.emergencyContact.phone;
    console.log("Raw Driver Read Encrypted Phone:", phoneRaw);

    // Assertions
    if (phoneRaw === phoneDecrypted) {
      console.error("FAIL: Raw stored data matches decrypted data! Encryption is not occurring or is bypassable.");
      process.exit(1);
    }

    const parts = phoneRaw.split(":");
    if (parts.length !== 3) {
      console.error("FAIL: Stored cipher text format is invalid (should be iv:tag:cipher).");
      process.exit(1);
    }

    console.log("PASS: Data is stored encrypted and retrieved decrypted transparently.");
    console.log("ENCRYPTION VERIFICATION PASSED SUCCESSFULLY.");
    process.exit(0);
  } catch (err) {
    console.error("Field encryption verification failure:", err);
    process.exit(1);
  }
};

verifyEncryption();
