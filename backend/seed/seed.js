// import mongoose from "mongoose";
// import dotenv from "dotenv";
// import bcrypt from "bcrypt";

// import Hospital from "../src/modules/hospital/hospital.model.js";
// import Doctor from "../src/modules/doctor/doctor.model.js";
// import User from "../src/modules/auth/auth.model.js";

// dotenv.config();

// const seed = async () => {
//   try {
//     // 🔌 Connect DB
//     await mongoose.connect(process.env.MONGO_URI);
//     console.log("✅ DB connected");

//     // 🧹 Clear old data
//     await Promise.all([
//       Hospital.deleteMany(),
//       Doctor.deleteMany(),
//       User.deleteMany()
//     ]);

//     console.log("🧹 Old data cleared");

//     // 🏥 Create Hospitals
//     const hospitals = await Hospital.insertMany([
//       {
//         name: "City Hospital",
//         address: "Patna",
//         location: {
//           type: "Point",
//           coordinates: [85.1, 25.6]
//         },
//         specializations: ["cardiology", "neurology"]
//       },
//       {
//         name: "HealthCare Plus",
//         address: "Delhi",
//         location: {
//           type: "Point",
//           coordinates: [77.2, 28.6]
//         },
//         specializations: ["dermatology", "orthopedics"]
//       }
//     ]);

//     console.log("🏥 Hospitals seeded");

//     // 👨‍⚕️ Create Doctors
//     const doctors = await Doctor.insertMany([
//       {
//         name: "Dr Sharma",
//         specialization: "cardiology",
//         hospitalId: hospitals[0]._id,
//         rating: 4.5,
//         experienceYears: 10,
//         avgConsultationTime: 5
//       },
//       {
//         name: "Dr Mehta",
//         specialization: "dermatology",
//         hospitalId: hospitals[1]._id,
//         rating: 4.2,
//         experienceYears: 8,
//         avgConsultationTime: 6
//       }
//     ]);

//     console.log("👨‍⚕️ Doctors seeded");

//     // 🔐 Create Admin User
//     const hashedPassword = await bcrypt.hash("123456", 10);

//     const admin = await User.create({
//       name: "Admin",
//       email: "admin@gmail.com",
//       phone: "9999999999",
//       password: hashedPassword,
//       role: "admin"
//     });

//     console.log("🔐 Admin created");

//     console.log("\n🔥 SEEDING COMPLETED SUCCESSFULLY");

//   } catch (error) {
//     console.error("❌ Seeding error:", error);
//   } finally {
//     await mongoose.connection.close();
//     process.exit();
//   }
// };

// seed();

import bcrypt from "bcrypt";

const hashed = await bcrypt.hash("12345678", 10);
console.log(hashed);