import mongoose from "mongoose";
import Doctor from "../../src/modules/doctor/doctor.model.js";
import DoctorSchedule from "../../src/modules/doctor/doctor_schedule.model.js";
import User from "../../src/modules/auth/auth.model.js";

export const seedDoctors = async (hashedPassword, context) => {
  console.log("Seeding Doctors & Clinic Rosters (Optimized Native Bulk Insert)...");

  const depts = ["Cardiology", "Neurology", "Orthopedics", "ENT", "Dermatology", "Pediatrics", "General Medicine"];
  const firstNames = ["Rajesh", "Alok", "Sunil", "Anil", "Amit", "Sanjay", "Vikram", "Pradeep", "Vijay", "Ramesh"];
  const lastNames = ["Sen", "Verma", "Kumar", "Sharma", "Singh", "Gupta", "Nair", "Reddy", "Patel", "Das"];
  
  const seeded = [];
  const hospitals = context.seededHospitals;

  await DoctorSchedule.deleteMany({}); // clear all schedules

  // 1. Seed predefined Showcase Doctor
  let showcaseDoc;
  if (context.demoUsers?.doctor) {
    const docUser = context.demoUsers.doctor;
    showcaseDoc = await Doctor.findOneAndUpdate(
      { userId: docUser._id },
      {
        hospitalId: hospitals[0]._id,
        name: docUser.name,
        specialization: "Cardiology",
        status: "active",
        profileCompleted: true,
        isActive: true,
        rating: 4.9,
        experience: 18,
        qualification: "MD, DM (Cardiology) - AIIMS",
        registrationNumber: "MCI-48592",
        languages: ["English", "Hindi", "Bengali"],
        consultationFee: 800,
        availabilityStatus: "Available"
      },
      { upsert: true, new: true }
    );
    
    // Seed schedules Mon-Fri for showcase doctor using native driver to bypass hooks
    const showcaseSchedules = [];
    for (let day = 1; day <= 5; day++) {
      showcaseSchedules.push({
        doctorId: showcaseDoc._id,
        dayOfWeek: day,
        startTime: "09:00",
        endTime: "17:00",
        enabled: true,
        status: "published",
        version: 1,
        effectiveFrom: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }
    await mongoose.connection.db.collection("doctorschedules").insertMany(showcaseSchedules);
    
    seeded.push(showcaseDoc);
  }

  // 2. Prepare bulk insert arrays for the remaining 299 doctors
  const totalDocs = 300;
  const availabilities = ["Available", "Busy", "On Break", "On Leave", "Session Closed"];

  const usersData = [];
  for (let i = 1; i < totalDocs; i++) {
    const email = `doctor_${i}@medhospi.com`;
    const fName = firstNames[i % firstNames.length];
    const lName = lastNames[i % lastNames.length];
    const dept = depts[i % depts.length];

    usersData.push({
      email,
      name: `${fName} ${lName}`,
      phone: `93333${String(i).padStart(5, "0")}`,
      password: hashedPassword,
      role: "doctor",
      profileCompleted: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }

  // Clear non-showcase doctors users
  await User.deleteMany({ role: "doctor", email: { $ne: "doctor@medhospi.com" } });
  const createdUsersResult = await mongoose.connection.db.collection("users").insertMany(usersData);
  
  // Retrieve inserted users
  const createdUsers = await User.find({ role: "doctor", email: { $ne: "doctor@medhospi.com" } });

  const doctorsData = [];
  const doctorSchedulesData = [];

  for (let i = 0; i < createdUsers.length; i++) {
    const user = createdUsers[i];
    const dept = depts[(i + 1) % depts.length];
    const docId = new mongoose.Types.ObjectId();

    doctorsData.push({
      _id: docId,
      userId: user._id,
      hospitalId: hospitals[(i + 1) % hospitals.length]._id,
      name: user.name,
      specialization: dept,
      status: "active",
      profileCompleted: true,
      isActive: true,
      availabilityState: "available",
      rating: 4.0 + ((i + 1) % 10) * 0.1,
      experienceYears: 5 + ((i + 1) % 15),
      qualification: `MBBS, MD (${dept})`,
      registrationNumber: `REG-${10001 + i}`,
      languages: ["English", "Hindi"],
      consultationFee: 300 + ((i + 1) % 5) * 100,
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Seed schedule Mon-Fri
    for (let day = 1; day <= 5; day++) {
      doctorSchedulesData.push({
        doctorId: docId,
        dayOfWeek: day,
        startTime: "09:00",
        endTime: "17:00",
        enabled: true,
        status: "published",
        version: 1,
        effectiveFrom: new Date(),
        createdAt: new Date(),
        updatedAt: new Date()
      });
    }
  }

  await Doctor.deleteMany({ userId: { $ne: context.demoUsers?.doctor?._id } });

  await mongoose.connection.db.collection("doctors").insertMany(doctorsData);
  await mongoose.connection.db.collection("doctorschedules").insertMany(doctorSchedulesData);

  const createdDocs = await Doctor.find({ userId: { $ne: context.demoUsers?.doctor?._id } });
  seeded.push(...createdDocs);

  // Bulk seed availability snapshots to prevent search query lag (Phase 14.6 Performance Fix)
  const availabilitySnapshotsData = [];
  for (const doc of seeded) {
    availabilitySnapshotsData.push({
      doctorId: doc._id,
      available: true,
      currentQueue: 0,
      nextAvailable: "Now",
      lastComputedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }

  const DoctorAvailabilitySnapshot = (await import("../../src/modules/search/doctor_availability_snapshot.model.js")).default;
  await DoctorAvailabilitySnapshot.deleteMany({});
  await mongoose.connection.db.collection("doctoravailabilitysnapshots").insertMany(availabilitySnapshotsData);

  console.log(`  - Registered ${seeded.length} verified doctors with schedules & snapshots in bulk.`);
  context.seededDoctors = seeded;
};
