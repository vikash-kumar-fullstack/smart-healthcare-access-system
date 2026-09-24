import Doctor from "../doctor/doctor.model.js";

export const getCandidateDoctors = async (specializationKeywords) => {
  // Query ceiling limit of 250 to prevent memory explosions (Freeze Rule 31)
  const query = {
    status: { $in: ["active", "verified", "approved"] },
    profileCompleted: { $ne: false }
  };

  if (specializationKeywords && specializationKeywords.length > 0) {
    // Expand specialization synonyms for ultra-flexible search
    const expandedKeywords = new Set();
    for (const k of specializationKeywords) {
      if (!k) continue;
      expandedKeywords.add(k.trim());
      const lower = k.toLowerCase().trim();
      if (lower.includes("general") || lower.includes("physician") || lower.includes("fever") || lower.includes("infection")) {
        expandedKeywords.add("General Medicine");
        expandedKeywords.add("General Physician");
        expandedKeywords.add("Internal Medicine");
      }
      if (lower.includes("heart") || lower.includes("cardio") || lower.includes("cardiology")) {
        expandedKeywords.add("Cardiology");
      }
      if (lower.includes("neuro") || lower.includes("brain") || lower.includes("neurology") || lower.includes("headache")) {
        expandedKeywords.add("Neurology");
      }
      if (lower.includes("ortho") || lower.includes("bone") || lower.includes("joint") || lower.includes("fracture") || lower.includes("orthopedics")) {
        expandedKeywords.add("Orthopedics");
      }
      if (lower.includes("ent") || lower.includes("throat") || lower.includes("ear") || lower.includes("earache") || lower.includes("nose")) {
        expandedKeywords.add("ENT");
        expandedKeywords.add("Otolaryngology");
      }
      if (lower.includes("skin") || lower.includes("derma") || lower.includes("dermatology") || lower.includes("rash") || lower.includes("acne")) {
        expandedKeywords.add("Dermatology");
      }
      if (lower.includes("pedia") || lower.includes("child") || lower.includes("pediatrics")) {
        expandedKeywords.add("Pediatrics");
      }
      if (lower.includes("gastro") || lower.includes("stomach") || lower.includes("gastric") || lower.includes("abdomen") || lower.includes("gastroenterology")) {
        expandedKeywords.add("Gastroenterology");
      }
      if (lower.includes("pulmo") || lower.includes("lung") || lower.includes("chest") || lower.includes("respiratory") || lower.includes("asthma") || lower.includes("pulmonology")) {
        expandedKeywords.add("Pulmonology");
      }
      if (lower.includes("gyne") || lower.includes("women") || lower.includes("gynecology") || lower.includes("obstetrics")) {
        expandedKeywords.add("Gynecology");
      }
      if (lower.includes("eye") || lower.includes("ophta") || lower.includes("ophthalmology") || lower.includes("vision")) {
        expandedKeywords.add("Ophthalmology");
      }
      if (lower.includes("uro") || lower.includes("kidney") || lower.includes("urine") || lower.includes("urology")) {
        expandedKeywords.add("Urology");
      }
      if (lower.includes("psych") || lower.includes("mental") || lower.includes("psychiatry") || lower.includes("anxiety") || lower.includes("depression")) {
        expandedKeywords.add("Psychiatry");
      }
      if (lower.includes("endo") || lower.includes("thyroid") || lower.includes("diabetes") || lower.includes("endocrinology")) {
        expandedKeywords.add("Endocrinology");
      }
    }

    const keywordList = Array.from(expandedKeywords);

    // Case-insensitive & whitespace-tolerant regex match against doctor specializations
    query.specialization = {
      $in: keywordList.map(k => new RegExp(`^\\s*${k.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*$`, 'i'))
    };
  }

  // Fetch candidate list populated with hospital location details
  const candidates = await Doctor.find(query)
    .populate({
      path: "hospitalId",
      match: { isActive: true }
    })
    .limit(250);

  // Filter out any candidates whose hospital was deactivated
  return candidates.filter(c => c.hospitalId);
};
