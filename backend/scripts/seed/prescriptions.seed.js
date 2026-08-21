import Prescription from "../../src/modules/medical-records/prescription.model.js";
import ClinicalNote from "../../src/modules/medical-records/clinical_note.model.js";

export const seedPrescriptions = async (hashedPassword, context) => {
  console.log("Seeding EMR Prescriptions & Diagnostic Notes...");

  const visits = context.seededVisits;
  const bulkNotes = [];
  const bulkPrescriptions = [];

  for (let i = 0; i < visits.length; i++) {
    const visit = visits[i];
    
    // 1. Create a matching clinical note
    const note = {
      _id: visit._id, // match ID directly to keep linking easy
      visitId: visit._id,
      patientId: visit.patientId,
      doctorId: visit.doctorId,
      chiefComplaint: i % 2 === 0 ? "Severe headache with nausea" : "High fever, body ache, dry cough",
      clinicalFindings: "BP 130/85, Temp 100.2F",
      diagnosis: i % 2 === 0 ? "Migraine Episode" : "Viral Influenza",
      status: "SIGNED"
    };
    bulkNotes.push(note);

    // 2. Create matching prescriptions
    bulkPrescriptions.push({
      visitId: visit._id,
      patientId: visit.patientId,
      doctorId: visit.doctorId,
      clinicalNoteId: note._id,
      medicines: [
        {
          genericName: i % 2 === 0 ? "Sumatriptan" : "Paracetamol",
          dosage: i % 2 === 0 ? "50mg" : "650mg",
          frequency: "1-0-1",
          duration: "3 days",
          quantity: 6,
          route: "Oral",
          form: "tablet",
          foodTiming: "after_food"
        },
        {
          genericName: "Pantoprazole",
          dosage: "40mg",
          frequency: "1-0-0",
          duration: "5 days",
          quantity: 5,
          route: "Oral",
          form: "tablet",
          foodTiming: "before_food"
        }
      ],
      status: "SIGNED"
    });
  }

  // Pre-clean existing EMR data
  await ClinicalNote.deleteMany({});
  await Prescription.deleteMany({});

  const notesCreated = await ClinicalNote.insertMany(bulkNotes);
  const rxCreated = await Prescription.insertMany(bulkPrescriptions);

  console.log(`  - Seeded ${notesCreated.length} clinical notes.`);
  console.log(`  - Seeded ${rxCreated.length} EMR prescriptions.`);
  
  context.seededNotes = notesCreated;
  context.seededPrescriptions = rxCreated;
};
