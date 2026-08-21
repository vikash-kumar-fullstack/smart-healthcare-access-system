import User from "../../src/modules/auth/auth.model.js";

export const seedUsers = async (hashedPassword, context) => {
  console.log("Seeding Predefined Showcase Demo Accounts...");

  // Predefined Demo accounts
  const demoUsers = [
    {
      email: "super@medhospi.com",
      name: "Super Admin",
      role: "super_admin",
      phone: "9000000001",
      profileCompleted: true
    },
    {
      email: "district@medhospi.com",
      name: "Delhi District Admin",
      role: "district_admin",
      phone: "9000000002",
      district: "Delhi",
      profileCompleted: true
    },
    {
      email: "hospital@medhospi.com",
      name: "AIIMS Chief Admin",
      role: "hospital_admin",
      phone: "9000000003",
      profileCompleted: true
    },
    {
      email: "reception@medhospi.com",
      name: "AIIMS Receptionist Desk",
      role: "receptionist",
      phone: "9000000004",
      profileCompleted: true
    },
    {
      email: "doctor@medhospi.com",
      name: "Alok Sen",
      role: "doctor",
      phone: "9000000005",
      profileCompleted: true
    },
    {
      email: "patient@medhospi.com",
      name: "Vikash Kumar",
      role: "patient",
      phone: "9000000006",
      profileCompleted: true
    }
  ];

  const seededUsersMap = {};

  for (const item of demoUsers) {
    const user = await User.findOneAndUpdate(
      { email: item.email },
      {
        ...item,
        password: hashedPassword
      },
      { upsert: true, new: true }
    );
    seededUsersMap[item.role] = user;
    console.log(`  - Registered ${item.role}: ${item.email}`);
  }

  context.demoUsers = seededUsersMap;
};
