import User from "../../src/modules/auth/auth.model.js";

export const seedPatients = async (hashedPassword, context) => {
  console.log("Seeding Patient Registry & Demographics...");

  const firstNames = ["Amit", "Suman", "Priya", "Kunal", "Raj", "Vikram", "Anjali", "Suresh", "Ritu", "Sunita", "Deepak", "Asha"];
  const lastNames = ["Kumar", "Sharma", "Singh", "Patel", "Verma", "Reddy", "Gupta", "Nair", "Das", "Joshi"];
  
  const seeded = [];

  // 1. Showcase Patient
  if (context.demoUsers?.patient) {
    const user = context.demoUsers.patient;
    // We update Rajesh Kumar to Vikash Kumar as requested in context greeting
    await User.findByIdAndUpdate(user._id, {
      name: "Vikash Kumar",
      healthProfile: {
        bloodGroup: "O+",
        allergies: ["Penicillin"],
        chronicConditions: ["Hypertension"],
        weight: 68,
        height: 174,
        emergencyContact: { name: "Anjali Kumar", relationship: "Spouse", phone: "9000000999" }
      }
    });
    seeded.push(user);
  }

  // 2. Seed 5000 Patients distributed across scenarios
  const totalPatients = 5000;
  const conditions = [
    { bloodGroup: "A+", allergies: [], chronicConditions: ["None"], weight: 70, height: 170 },
    { bloodGroup: "B+", allergies: ["Sulfa Drugs"], chronicConditions: ["Diabetes Type 2"], weight: 82, height: 165 },
    { bloodGroup: "O+", allergies: [], chronicConditions: ["Hypertension"], weight: 76, height: 178 },
    { bloodGroup: "AB+", allergies: ["Peanuts"], chronicConditions: ["Asthma"], weight: 58, height: 155 },
    { bloodGroup: "O-", allergies: [], chronicConditions: ["None"], weight: 64, height: 168 }
  ];

  // We batch insert/update or loop. Since creating 5000 records takes some seconds, let's optimize with bulkWrite or loops of 5000!
  // To prevent slow single database operations, let's do a bulk array creation of user objects and write them!
  const bulkData = [];
  
  for (let i = 1; i <= totalPatients; i++) {
    const email = `patient_${i}@medhospi.com`;
    const fName = firstNames[i % firstNames.length];
    const lName = lastNames[i % lastNames.length];
    const cond = conditions[i % conditions.length];

    bulkData.push({
      email,
      name: `${fName} ${lName}`,
      phone: `94444${String(i).padStart(5, "0")}`,
      password: hashedPassword,
      role: "patient",
      profileCompleted: true,
      healthProfile: {
        ...cond,
        emergencyContact: { name: `Emergency Person ${i}`, relationship: "Family", phone: `91111${String(i).padStart(5, "0")}` }
      }
    });
  }

  // Clear existing non-demo patients first to keep it clean and avoid duplicates
  await User.deleteMany({ role: "patient", email: { $ne: "patient@medhospi.com" } });
  
  // Bulk Insert
  const created = await User.insertMany(bulkData);
  seeded.push(...created);

  console.log(`  - Seeded ${seeded.length} patients including showcase accounts.`);
  context.seededPatients = seeded;
};
