import mongoose from "mongoose";
import User from "../../src/modules/auth/auth.model.js";
import FamilyRelationship from "../../src/modules/user/family_relationship.model.js";
import Queue from "../../src/modules/queue/queue.model.js";
import Visit from "../../src/modules/visit/visit.model.js";
import crypto from "crypto";

export const seedFamily = async (hashedPassword, context) => {
  console.log("Seeding Family Management relationships and sub-profiles...");

  const mainPatient = context.demoUsers?.patient;
  if (!mainPatient) {
    console.error("Main patient user (patient@medhospi.com) not found in context. Skipping family seeding.");
    return;
  }

  const doctor = context.seededDoctors?.[0] || { _id: new mongoose.Types.ObjectId(), name: "Dr. Alok Sen", specialization: "Pediatrics" };
  const session = context.seededSessions?.[0] || { _id: new mongoose.Types.ObjectId() };
  const hospitalId = doctor.hospitalId || new mongoose.Types.ObjectId();

  // Clean existing family relationships and managed sub-profiles
  await FamilyRelationship.deleteMany({});
  await User.deleteMany({ email: /@family\.local$/ });

  // 1. Create Child: Rahul Kumar (GUARDIAN_MANAGED, ACTIVE)
  const childUser = await User.create({
    name: "Rahul Kumar",
    email: "managed-child-rahul@family.local",
    gender: "Male",
    dob: "2018-05-15", // 8 years old
    bloodGroup: "O+",
    role: "patient",
    profileCompleted: true,
    accountStatus: "ACTIVE"
  });

  const childRelationship = await FamilyRelationship.create({
    ownerId: mainPatient._id,
    relativeId: childUser._id,
    relationType: "Child",
    managementType: "FULL_ACCESS",
    ownershipType: "GUARDIAN_MANAGED",
    status: "ACTIVE",
    createdBy: mainPatient._id,
    updatedBy: mainPatient._id,
    lastAccessedAt: new Date()
  });

  // 2. Create Parent: Ramesh Kumar (SELF_MANAGED, ACTIVE, Caregiver Access)
  const parentUser = await User.create({
    name: "Ramesh Kumar",
    email: "managed-parent-ramesh@family.local",
    gender: "Male",
    dob: "1959-10-12", // 67 years old
    bloodGroup: "B+",
    role: "patient",
    profileCompleted: true,
    accountStatus: "ACTIVE"
  });

  const parentRelationship = await FamilyRelationship.create({
    ownerId: mainPatient._id,
    relativeId: parentUser._id,
    relationType: "Parent",
    managementType: "CAREGIVER_ACCESS",
    ownershipType: "SELF_MANAGED",
    status: "ACTIVE",
    createdBy: mainPatient._id,
    updatedBy: mainPatient._id,
    lastAccessedAt: new Date()
  });

  // 3. Create Spouse: Priya Kumar (SHARED_MANAGED, PENDING invitation)
  const spouseUser = await User.create({
    name: "Priya Kumar",
    email: "priya@family.local",
    gender: "Female",
    dob: "1994-03-24", // 32 years old
    bloodGroup: "A-",
    role: "patient",
    profileCompleted: true,
    accountStatus: "ACTIVE"
  });

  const spouseRelationship = await FamilyRelationship.create({
    ownerId: mainPatient._id,
    relativeId: spouseUser._id,
    relationType: "Spouse",
    managementType: "INVITATION_REQUIRED",
    ownershipType: "SHARED_MANAGED",
    status: "PENDING",
    invitationToken: crypto.randomBytes(32).toString("hex"),
    invitationExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
    createdBy: mainPatient._id,
    updatedBy: mainPatient._id,
    lastAccessedAt: new Date()
  });

  // 4. Seed an Active Appointment / Queue wait status for Parent (Ramesh Kumar)
  const parentQueue = await Queue.create({
    userId: parentUser._id,
    bookedByUserId: mainPatient._id,
    relationshipId: parentRelationship._id,
    bookedForType: "FAMILY_MEMBER",
    doctorId: doctor._id,
    sessionId: session._id,
    queueNumber: 4,
    status: "waiting",
    isActive: true,
    bookedAt: new Date(),
    hospitalId: hospitalId
  });

  // 5. Seed a Completed Visit / Medical Timeline Event for Child (Rahul Kumar)
  const childVisit = await Visit.create({
    publicId: "VISIT-99001",
    patientId: childUser._id,
    doctorId: doctor._id,
    hospitalId: hospitalId,
    sessionId: session._id,
    appointmentId: new mongoose.Types.ObjectId(),
    queueId: new mongoose.Types.ObjectId(),
    bookingDate: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
    status: "completed",
    visitOutcome: "consulted",
    doctorSnapshot: {
      name: doctor.name || "Dr. Alok Sen",
      specialization: doctor.specialization || "Pediatrician",
      hospitalName: "AIIMS Delhi"
    },
    patientSnapshot: {
      name: childUser.name,
      email: childUser.email,
      phone: ""
    }
  });

  console.log("  - Seeded 3 family relationships (Child, Parent, Spouse)");
  console.log("  - Seeded active queue wait ticket for Ramesh Kumar (Parent)");
  console.log("  - Seeded historical clinical visit for Rahul Kumar (Child)");
};
