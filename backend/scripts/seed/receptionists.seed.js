import mongoose from "mongoose";
import Receptionist from "../../src/modules/admin/receptionist.model.js";
import User from "../../src/modules/auth/auth.model.js";

export const seedReceptionists = async (hashedPassword, context) => {
  console.log("Seeding Receptionist Desks & Staff (Optimized Native Bulk Insert)...");

  const hospitals = context.seededHospitals;
  const seeded = [];

  // 1. Showcase Receptionist
  if (context.demoUsers?.receptionist) {
    const user = context.demoUsers.receptionist;
    await User.findByIdAndUpdate(user._id, { hospitalId: hospitals[0]._id });

    const recep = await Receptionist.findOneAndUpdate(
      { userId: user._id },
      {
        hospitalId: hospitals[0]._id,
        employeeId: "EMP-R01",
        shift: "Morning",
        status: "active"
      },
      { upsert: true, new: true }
    );
    seeded.push(recep);
  }

  // 2. Seed 120 Receptionists for hospitals
  const totalRecep = 120;
  const shifts = ["Morning", "Evening", "Night"];
  const usersData = [];

  for (let i = 1; i < totalRecep; i++) {
    const email = `reception_${i}@medhospi.com`;
    usersData.push({
      email,
      name: `Receptionist Staff ${i}`,
      phone: `92222${String(i).padStart(5, "0")}`,
      password: hashedPassword,
      role: "receptionist",
      hospitalId: hospitals[i % hospitals.length]._id,
      profileCompleted: true,
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }

  await User.deleteMany({ role: "receptionist", email: { $ne: "reception@medhospi.com" } });
  await mongoose.connection.db.collection("users").insertMany(usersData);
  
  const createdUsers = await User.find({ role: "receptionist", email: { $ne: "reception@medhospi.com" } });

  const receptionistsData = [];
  for (let i = 0; i < createdUsers.length; i++) {
    const user = createdUsers[i];
    receptionistsData.push({
      userId: user._id,
      hospitalId: user.hospitalId,
      employeeId: `EMP-R${101 + i}`,
      shift: shifts[i % shifts.length],
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date()
    });
  }

  await Receptionist.deleteMany({ userId: { $ne: context.demoUsers?.receptionist?._id } });
  await mongoose.connection.db.collection("receptionists").insertMany(receptionistsData);
  
  const createdReceps = await Receptionist.find({ userId: { $ne: context.demoUsers?.receptionist?._id } });
  seeded.push(...createdReceps);

  console.log(`  - Registered ${seeded.length} hospital desk receptionists in bulk.`);
  context.seededReceptionists = seeded;
};
