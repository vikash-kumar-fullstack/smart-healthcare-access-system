import Hospital from "../../src/modules/hospital/hospital.model.js";
import User from "../../src/modules/auth/auth.model.js";

export const seedHospitals = async (hashedPassword, context) => {
  console.log("Seeding Partnered Clinic Networks...");

  const baseHospitals = [
    { name: "AIIMS Delhi", address: "Ansari Nagar, New Delhi", coordinates: [77.2100, 28.5672] },
    { name: "Apollo Delhi", address: "Sarita Vihar, Delhi Mathura Road, New Delhi", coordinates: [77.2890, 28.5361] },
    { name: "Fortis Hospital Delhi", address: "Vasant Kunj, New Delhi", coordinates: [77.1610, 28.5284] },
    { name: "Max Super Specialty Hospital", address: "Saket, New Delhi", coordinates: [77.2144, 28.5262] },
    { name: "Safdarjung Hospital", address: "Ansari Nagar, New Delhi", coordinates: [77.2084, 28.5679] }
  ];

  const seeded = [];
  
  // Seed 20 hospitals for medium scale demo
  const targetCount = 20;
  for (let i = 0; i < targetCount; i++) {
    const base = baseHospitals[i % baseHospitals.length];
    const suffix = i >= baseHospitals.length ? ` - Clinic Branch ${Math.floor(i / baseHospitals.length) + 1}` : "";
    
    const hosp = await Hospital.create({
      name: `${base.name}${suffix}`,
      address: base.address,
      location: {
        type: "Point",
        coordinates: [base.coordinates[0] + (i * 0.001), base.coordinates[1] + (i * 0.001)]
      },
      specializations: ["Cardiology", "Neurology", "Orthopedics", "ENT", "Dermatology", "Pediatrics", "General Medicine"],
      isActive: true,
      district: "Delhi"
    });
    seeded.push(hosp);
  }

  console.log(`  - Registered ${seeded.length} partnered hospitals.`);
  context.seededHospitals = seeded;

  // Bind showcase Hospital Admin & District Admin relationships
  const firstHospId = seeded[0]._id;
  
  if (context.demoUsers?.hospital_admin) {
    await User.findByIdAndUpdate(context.demoUsers.hospital_admin._id, { hospitalId: firstHospId });
  }
};
