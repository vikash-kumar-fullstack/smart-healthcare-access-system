import mongoose from "mongoose";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import bcrypt from "bcrypt";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load models
import User from "../src/modules/auth/auth.model.js";
import Doctor from "../src/modules/doctor/doctor.model.js";
import Hospital from "../src/modules/hospital/hospital.model.js";
import Queue from "../src/modules/queue/queue.model.js";
import QueueSession from "../src/modules/queue/queueSession.model.js";
import Notification from "../src/modules/notification/notification.model.js";
import DoctorSchedule from "../src/modules/doctor/doctor_schedule.model.js";
import Visit from "../src/modules/visit/visit.model.js";
import AppointmentBooking from "../src/modules/queue/appointment_booking.model.js";
import ClinicalNote from "../src/modules/medical-records/clinical_note.model.js";
import Prescription from "../src/modules/medical-records/prescription.model.js";
import LabOrder from "../src/modules/medical-records/lab_order.model.js";
import Report from "../src/modules/medical-records/report.model.js";
import Receptionist from "../src/modules/admin/receptionist.model.js";
import FamilyRelationship from "../src/modules/user/family_relationship.model.js";
import SecurityIncident from "../src/modules/admin/security_incident.model.js";
import FollowUp from "../src/modules/medical-records/follow_up.model.js";
import { seedSymptoms } from "./seed/symptoms.seed.js";
import DoctorAvailabilitySnapshot from "../src/modules/search/doctor_availability_snapshot.model.js";

dotenv.config({ path: path.join(__dirname, "..", ".env") });

const DEFAULT_PASSWORD = "Password123!";

const seed = async () => {
  console.log("Starting production-ready Demo Certification Seeding...");

  try {
    const mongoUri = process.env.MONGO_URI;
    if (!mongoUri) {
      throw new Error("MONGO_URI not configured in .env");
    }

    await mongoose.connect(mongoUri);
    console.log("Connected to Database for seeding.");

    // Clear all target collections sequentially to avoid race conditions/locks
    console.log("Purging collections...");
    await User.deleteMany({});
    await Doctor.deleteMany({});
    await Hospital.deleteMany({});
    await Receptionist.deleteMany({});
    await DoctorSchedule.deleteMany({});
    await QueueSession.deleteMany({});
    await Queue.deleteMany({});
    await AppointmentBooking.deleteMany({});
    await Visit.deleteMany({});
    await ClinicalNote.deleteMany({});
    await Prescription.deleteMany({});
    await LabOrder.deleteMany({});
    await Report.deleteMany({});
    await FamilyRelationship.deleteMany({});
    await SecurityIncident.deleteMany({});
    await FollowUp.deleteMany({});
    await DoctorAvailabilitySnapshot.deleteMany({});
    console.log("Purged legacy transactional, EMR, and master collections.");

    // Seed symptoms dictionary
    await seedSymptoms();

    const hashedPassword = await bcrypt.hash(DEFAULT_PASSWORD, 10);

    // 1. Seed exactly 10 Hospitals
    console.log("Seeding 10 hospitals...");
    const seededHospitals = [];
    const baseHospitals = [
      { name: "AIIMS Delhi", address: "Ansari Nagar, New Delhi", coordinates: [77.2100, 28.5672] },
      { name: "Apollo Delhi", address: "Sarita Vihar, Delhi Mathura Road, New Delhi", coordinates: [77.2890, 28.5361] },
      { name: "Fortis Hospital Delhi", address: "Vasant Kunj, New Delhi", coordinates: [77.1610, 28.5284] },
      { name: "Max Super Specialty Hospital", address: "Saket, New Delhi", coordinates: [77.2144, 28.5262] },
      { name: "Safdarjung Hospital", address: "Ansari Nagar, New Delhi", coordinates: [77.2084, 28.5679] }
    ];

    for (let i = 0; i < 10; i++) {
      const base = baseHospitals[i % baseHospitals.length];
      const suffix = i >= baseHospitals.length ? ` - Branch ${Math.floor(i / baseHospitals.length) + 1}` : "";
      
      const hosp = await Hospital.findOneAndUpdate(
        { name: `${base.name}${suffix}` },
        {
          $set: {
            address: base.address,
            location: {
              type: "Point",
              coordinates: [base.coordinates[0] + (i * 0.001), base.coordinates[1] + (i * 0.001)]
            },
            specializations: ["Cardiology", "Neurology", "Orthopedics", "ENT", "Dermatology", "Pediatrics", "General Medicine"],
            isActive: true,
            district: "Delhi"
          }
        },
        { upsert: true, new: true }
      );
      seededHospitals.push(hosp);
    }
    console.log(`✓ Seeded ${seededHospitals.length} Hospitals.`);

    // 2. Seed District Admin & Hospital Admins
    const showcaseAdmin = await User.findOneAndUpdate(
      { email: "admin@example.com" },
      {
        $set: {
          name: "District Admin Delhi",
          phone: "9100000000",
          password: hashedPassword,
          role: "admin",
          district: "Delhi",
          profileCompleted: true
        }
      },
      { upsert: true, new: true }
    );
    console.log(`✓ Seeded District Admin: ${showcaseAdmin.email}`);

    // Seed Showcase Hospital Admin for each of the 10 hospitals
    console.log("Seeding 10 hospital administrators...");
    const seededHospitalAdmins = [];
    for (let i = 0; i < 10; i++) {
      const email = i === 0 ? "hospital@example.com" : `hospital${i}@smarthealth.com`;
      const hospAdmin = await User.findOneAndUpdate(
        { email },
        {
          $set: {
            name: `${seededHospitals[i].name} Administrator`,
            phone: `91222${String(i).padStart(5, "0")}`,
            password: hashedPassword,
            role: "hospital_admin",
            hospitalId: seededHospitals[i]._id,
            profileCompleted: true
          }
        },
        { upsert: true, new: true }
      );
      seededHospitalAdmins.push(hospAdmin);
    }
    console.log(`✓ Seeded ${seededHospitalAdmins.length} Hospital Administrators.`);

    // 3. Seed exactly 20 Receptionists (2 per hospital)
    console.log("Seeding 20 receptionists (2 per hospital)...");
    const seededReceptionists = [];
    let receptionistCount = 0;
    for (let h = 0; h < seededHospitals.length; h++) {
      const hospital = seededHospitals[h];
      for (let r = 1; r <= 2; r++) {
        const email = `receptionist${receptionistCount}@smarthealth.com`;
        const recUser = await User.findOneAndUpdate(
          { email },
          {
            $set: {
              name: `Receptionist ${r} - ${hospital.name}`,
              phone: `92222${String(receptionistCount).padStart(5, "0")}`,
              password: hashedPassword,
              role: "receptionist",
              profileCompleted: true
            }
          },
          { upsert: true, new: true }
        );
        
        const rec = await Receptionist.findOneAndUpdate(
          { userId: recUser._id },
          {
            $set: {
              hospitalId: hospital._id,
              employeeId: `EMP-H${h}-R${r}`,
              shift: r === 1 ? "Morning" : "Evening",
              status: "active"
            }
          },
          { upsert: true, new: true }
        );
        seededReceptionists.push(rec);
        receptionistCount++;
      }
    }
    console.log(`✓ Seeded ${seededReceptionists.length} Receptionists (2 per hospital).`);

    // 4. Seed exactly 50 Doctors
    console.log("Seeding 50 doctors...");
    const depts = ["Cardiology", "Neurology", "Orthopedics", "ENT", "Dermatology", "Pediatrics", "General Medicine", "Gastroenterology", "Pulmonology", "Gynecology", "Ophthalmology", "Urology", "Psychiatry", "Endocrinology"];
    const seededDoctors = [];
    const scheduleDocs = [];

    for (let i = 0; i < 50; i++) {
      const email = i === 0 ? "doctor@example.com" : `doctor${i}@smarthealth.com`;
      const dept = depts[i % depts.length];
      
      const docUser = await User.findOneAndUpdate(
        { email },
        {
          $set: {
            name: i === 0 ? "Alok Sen" : `${['Sharma', 'Patel', 'Verma', 'Gupta', 'Singh', 'Reddy', 'Nair'][i % 7]}`,
            phone: i === 0 ? "9333399999" : `93333${String(i).padStart(5, "0")}`,
            password: hashedPassword,
            role: "doctor",
            profileCompleted: true
          }
        },
        { upsert: true, new: true }
      );

      const doc = await Doctor.findOneAndUpdate(
        { userId: docUser._id },
        {
          $set: {
            hospitalId: seededHospitals[i % seededHospitals.length]._id,
            name: docUser.name,
            specialization: dept,
            status: "active",
            profileCompleted: true,
            isActive: true,
            availabilityState: "available",
            rating: 4.5 + (i % 5) * 0.1
          }
        },
        { upsert: true, new: true }
      );
      seededDoctors.push(doc);

      // Queue flat DoctorSchedule documents for Monday through Friday
      for (let day = 1; day <= 5; day++) {
        scheduleDocs.push({
          doctorId: doc._id,
          dayOfWeek: day,
          startTime: "09:00",
          endTime: "17:00",
          status: "published",
          enabled: true
        });
      }
    }
    
    // Bulk insert Doctor Schedules
    await DoctorSchedule.insertMany(scheduleDocs);

    // Bulk insert Doctor Availability Snapshots for instant search availability
    const snapshots = seededDoctors.map(d => ({
      doctorId: d._id,
      available: true,
      currentQueue: 0,
      nextAvailable: "Now",
      lastComputedAt: new Date()
    }));
    await DoctorAvailabilitySnapshot.insertMany(snapshots);

    console.log(`✓ Seeded ${seededDoctors.length} Doctors, Schedules & Availability Snapshots.`);

    // 5. Seed exactly 500 Patients
    console.log("Seeding 500 patients...");
    const patientUsers = [];
    for (let i = 0; i < 500; i++) {
      const email = i === 0 ? "patient@example.com" : `patient${i}@smarthealth.com`;
      const patUser = await User.findOneAndUpdate(
        { email },
        {
          $set: {
            name: i === 0 ? "Rajesh Kumar" : `Patient ${['Raj', 'Amit', 'Suman', 'Vikram', 'Priya', 'Anjali', 'Kunal'][i % 7]} ${i}`,
            phone: i === 0 ? "9444499999" : `94444${String(i).padStart(5, "0")}`,
            password: hashedPassword,
            role: "patient",
            profileCompleted: true
          }
        },
        { upsert: true, new: true }
      );
      patientUsers.push(patUser);
    }
    console.log(`✓ Seeded ${patientUsers.length} Patients.`);

    // 6. Seed exactly 150 Family Relationships
    console.log("Seeding 150 family relationships...");
    const relationshipTypes = ["Child", "Parent", "Spouse", "Dependent", "Guardian", "Caregiver"];
    const relationshipDocs = [];
    for (let i = 0; i < 150; i++) {
      const owner = patientUsers[i % patientUsers.length];
      const relative = patientUsers[(i + 1) % patientUsers.length];
      relationshipDocs.push({
        ownerId: owner._id,
        relativeId: relative._id,
        relationType: relationshipTypes[i % relationshipTypes.length],
        managementType: "FULL_ACCESS",
        ownershipType: "SELF_MANAGED",
        status: "ACTIVE",
        createdBy: owner._id,
        updatedBy: owner._id
      });
    }
    await FamilyRelationship.insertMany(relationshipDocs);
    console.log(`✓ Seeded 150 Family Relationships.`);

    // 7. Seed Queue Sessions: 50 Active, 5 Paused, 10 Active Doctor sessions
    console.log("Seeding 55 Queue Sessions (50 active, 5 paused)...");
    const todayStr = new Date().toISOString().split("T")[0];
    const seededSessions = [];
    
    // Seed 50 Active Sessions
    for (let i = 0; i < 50; i++) {
      const doc = seededDoctors[i];
      const qSession = await QueueSession.create({
        doctorId: doc._id,
        hospitalId: doc.hospitalId,
        date: todayStr,
        sessionStatus: "active",
        sessionState: "ACTIVE",
        isActive: true,
        scheduleSnapshot: {
          startTime: "09:00",
          endTime: "17:00",
          queueLimit: 50,
          doctorName: doc.name,
          hospitalName: seededHospitals[i % seededHospitals.length].name,
          averageConsultationTime: 15
        }
      });
      seededSessions.push(qSession);
    }

    // Seed 5 Paused Sessions (linked to doctors 40-44)
    for (let i = 40; i < 45; i++) {
      const doc = seededDoctors[i];
      await QueueSession.updateOne(
        { doctorId: doc._id },
        { $set: { sessionStatus: "paused", sessionState: "PAUSED", isActive: false } }
      );
    }
    console.log("✓ Seeded Queue Sessions.");

    // 8. Seed exactly 5000 Bookings, including exactly 1000 completed visits
    console.log("Seeding 5000 Bookings (1000 completed, 4000 scheduled)...");
    const outcomes = ["consulted", "follow_up_required", "referred"];
    const timeSlots = ["09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "14:00", "14:30"];
    
    const bookingsData = [];
    for (let i = 0; i < 5000; i++) {
      const patient = patientUsers[i % patientUsers.length];
      const doc = seededDoctors[i % seededDoctors.length];
      const session = seededSessions[i % seededSessions.length];
      const slot = timeSlots[i % timeSlots.length];
      const isCompleted = i < 1000;

      bookingsData.push({
        bookingNumber: `MH-${i}-${Date.now()}`,
        userId: patient._id,
        doctorId: doc._id,
        hospitalId: doc.hospitalId,
        sessionId: session._id,
        date: todayStr,
        slotTime: slot,
        status: isCompleted ? "COMPLETED" : "BOOKED",
        arrivalStatus: isCompleted ? "CHECKED_IN" : "NOT_ARRIVED"
      });
    }

    // Bulk insert bookings
    const seededBookings = [];
    for (let b = 0; b < bookingsData.length; b += 1000) {
      const chunk = await AppointmentBooking.insertMany(bookingsData.slice(b, b + 1000));
      seededBookings.push(...chunk);
    }
    console.log("   ✓ Bookings inserted.");

    // 9. Seed EMR transactional records for the 1000 completed bookings
    console.log("Seeding EMR transactional records for 1000 completed visits...");
    
    // Create matching Queue entries in bulk
    const queuesData = [];
    for (let i = 0; i < 1000; i++) {
      const patient = patientUsers[i % patientUsers.length];
      const doc = seededDoctors[i % seededDoctors.length];
      const session = seededSessions[i % seededSessions.length];
      queuesData.push({
        userId: patient._id,
        doctorId: doc._id,
        sessionId: session._id,
        queueNumber: i + 1,
        status: "completed",
        isActive: false,
        bookedAt: new Date()
      });
    }
    const seededQueues = await Queue.insertMany(queuesData);
    console.log(`   ✓ Seeded ${seededQueues.length} completed Queue entries.`);

    // Create matching Visit entries in bulk
    const visitsData = [];
    for (let i = 0; i < 1000; i++) {
      const booking = seededBookings[i];
      const patient = patientUsers[i % patientUsers.length];
      const doc = seededDoctors[i % seededDoctors.length];
      const session = seededSessions[i % seededSessions.length];
      const queue = seededQueues[i];

      visitsData.push({
        publicId: `VISIT-${10000 + i}`,
        patientId: patient._id,
        doctorId: doc._id,
        hospitalId: doc.hospitalId,
        sessionId: session._id,
        queueId: queue._id,
        appointmentId: booking._id,
        bookingDate: todayStr,
        status: "completed",
        visitOutcome: outcomes[i % outcomes.length],
        doctorSnapshot: { name: doc.name, specialization: doc.specialization, hospitalName: "Showcase Hospital" },
        patientSnapshot: { name: patient.name, email: patient.email, phone: patient.phone }
      });
    }
    const seededVisits = await Visit.insertMany(visitsData);
    console.log(`   ✓ Seeded ${seededVisits.length} completed Visits.`);

    // Create matching ClinicalNote entries in bulk
    const notesData = [];
    for (let i = 0; i < 1000; i++) {
      const visit = seededVisits[i];
      notesData.push({
        visitId: visit._id,
        patientId: visit.patientId,
        doctorId: visit.doctorId,
        chiefComplaint: "General checkup and headache reviews.",
        clinicalFindings: "BP Normal, Mild fever.",
        diagnosis: "Essential Hypertension",
        status: "SIGNED"
      });
    }
    const seededNotes = await ClinicalNote.insertMany(notesData);
    console.log(`   ✓ Seeded ${seededNotes.length} completed Clinical Notes.`);

    // 10. Seed exactly 1500 Prescriptions in bulk
    console.log("Seeding exactly 1500 prescriptions across visits...");
    const prescriptionsData = [];
    for (let i = 0; i < 1000; i++) {
      const visit = seededVisits[i];
      const note = seededNotes[i];
      const numRx = i < 500 ? 2 : 1;

      for (let r = 0; r < numRx; r++) {
        prescriptionsData.push({
          visitId: visit._id,
          patientId: visit.patientId,
          doctorId: visit.doctorId,
          clinicalNoteId: note._id,
          medicines: [{
            genericName: r === 0 ? "Paracetamol" : "Ibuprofen",
            dosage: "400mg",
            frequency: "1-0-1",
            duration: "5 days",
            quantity: 10,
            route: "Oral",
            form: "tablet",
            foodTiming: "after_food"
          }],
          status: "SIGNED"
        });
      }
    }
    await Prescription.insertMany(prescriptionsData);
    console.log(`   ✓ Seeded 1500 Prescriptions.`);

    // 11. Seed exactly 600 Lab Orders in bulk
    console.log("Seeding exactly 600 lab orders...");
    const labOrdersData = [];
    for (let i = 0; i < 600; i++) {
      const visit = seededVisits[i];
      labOrdersData.push({
        visitId: visit._id,
        patientId: visit.patientId,
        doctorId: visit.doctorId,
        tests: ["Complete Blood Count (CBC)", "Thyroid Profile"],
        status: "ORDERED"
      });
    }
    const seededLabOrders = await LabOrder.insertMany(labOrdersData);
    console.log(`   ✓ Seeded ${seededLabOrders.length} Lab Orders.`);

    // 12. Seed exactly 400 Reports in bulk
    console.log("Seeding exactly 400 reports linked to lab orders...");
    const reportsData = [];
    for (let i = 0; i < 400; i++) {
      const lab = seededLabOrders[i];
      const visit = seededVisits[i];
      reportsData.push({
        labOrderId: lab._id,
        patientId: lab.patientId,
        uploadedBy: lab.doctorId,
        visitId: visit._id,
        fileUrl: "https://example.com/reports/cbc.pdf",
        fileType: "application/pdf",
        fileName: "cbc.pdf",
        title: "Complete Blood Count (CBC) Report",
        category: "lab_report"
      });
    }
    await Report.insertMany(reportsData);
    console.log(`   ✓ Seeded 400 Reports.`);

    // 13. Seed exactly 300 Follow-Ups in bulk
    console.log("Seeding exactly 300 follow-ups...");
    const followUpsData = [];
    for (let i = 0; i < 300; i++) {
      const visit = seededVisits[i];
      const nextDate = new Date();
      nextDate.setDate(nextDate.getDate() + 7);
      
      followUpsData.push({
        patientId: visit.patientId,
        doctorId: visit.doctorId,
        visitId: visit._id,
        nextVisit: nextDate,
        reason: "Routine clinical progress review.",
        department: "General Medicine",
        assignedDoctorId: visit.doctorId,
        priority: "medium",
        status: "scheduled"
      });
    }
    await FollowUp.insertMany(followUpsData);
    console.log(`   ✓ Seeded 300 Follow-Ups.`);

    // 14. Seed exactly 3 Emergency Incidents
    console.log("Seeding exactly 3 emergency incidents...");
    await SecurityIncident.create({
      severity: "high",
      category: "LOGIN_ABUSE",
      description: "Multiple failed login attempts from IP 192.168.1.100",
      status: "open"
    });
    await SecurityIncident.create({
      severity: "critical",
      category: "SESSION_HIJACK_ATTEMPT",
      description: "Detected token reuse for active user session",
      status: "open"
    });
    await SecurityIncident.create({
      severity: "medium",
      category: "RATE_LIMIT_TRIGGER",
      description: "IP 203.0.113.50 triggered rate limiter on public search",
      status: "open"
    });
    console.log(`   ✓ Seeded 3 Security Incidents.`);

    console.log("\n🚀 DEMO CERTIFICATION SEEDING COMPLETED SUCCESSFULLY.");
  } catch (error) {
    console.error("❌ Seed failed:", error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    process.exit(0);
  }
};

seed();
