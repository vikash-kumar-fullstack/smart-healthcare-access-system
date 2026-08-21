import dotenv from "dotenv";
import { generatePrescriptionSignature, verifyPrescriptionSignature } from "../src/utils/signature.service.js";

dotenv.config();

const verifySignatures = async () => {
  try {
    const mockPrescription = {
      doctorId: "6a51ce09941a7b91722e722d",
      patientId: "6a51ce09941a7b91722e7001",
      medicines: [
        { genericName: "Paracetamol", dosage: "500mg", frequency: "1-0-1" }
      ]
    };

    // Generate hash
    const signature = generatePrescriptionSignature(mockPrescription);
    mockPrescription.signatureHash = signature;
    console.log("Generated Signature Hash:", signature);

    // Verify original matches
    const isValidOriginal = verifyPrescriptionSignature(mockPrescription);
    if (!isValidOriginal) {
      console.error("FAIL: Original signature verification failed.");
      process.exit(1);
    }
    console.log("PASS: Original signature verified successfully.");

    // Simulate tampering (change Paracetamol to Ibuprofen)
    mockPrescription.medicines[0].genericName = "Ibuprofen";
    const isValidTampered = verifyPrescriptionSignature(mockPrescription);
    if (isValidTampered) {
      console.error("FAIL: Tampered prescription was validated!");
      process.exit(1);
    }
    console.log("PASS: Tampering successfully detected. Signature verification rejected the altered prescription.");

    console.log("SIGNATURE VERIFICATION PASSED SUCCESSFULLY.");
    process.exit(0);
  } catch (err) {
    console.error("Prescription signature verification failure:", err);
    process.exit(1);
  }
};

verifySignatures();
