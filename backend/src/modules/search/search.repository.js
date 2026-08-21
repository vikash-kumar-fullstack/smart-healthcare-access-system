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
      expandedKeywords.add(k);
      const lower = k.toLowerCase();
      if (lower.includes("general")) {
        expandedKeywords.add("General Medicine");
        expandedKeywords.add("General Physician");
        expandedKeywords.add("Internal Medicine");
      }
      if (lower.includes("heart") || lower.includes("cardio")) {
        expandedKeywords.add("Cardiology");
      }
      if (lower.includes("neuro")) {
        expandedKeywords.add("Neurology");
      }
      if (lower.includes("ortho") || lower.includes("bone")) {
        expandedKeywords.add("Orthopedics");
      }
      if (lower.includes("ent") || lower.includes("throat") || lower.includes("ear")) {
        expandedKeywords.add("ENT");
      }
      if (lower.includes("skin") || lower.includes("derma")) {
        expandedKeywords.add("Dermatology");
      }
      if (lower.includes("pedia") || lower.includes("child")) {
        expandedKeywords.add("Pediatrics");
      }
      if (lower.includes("gastro") || lower.includes("stomach")) {
        expandedKeywords.add("Gastroenterology");
      }
      if (lower.includes("pulmo") || lower.includes("lung")) {
        expandedKeywords.add("Pulmonology");
      }
      if (lower.includes("gyne") || lower.includes("women")) {
        expandedKeywords.add("Gynecology");
      }
      if (lower.includes("eye") || lower.includes("ophta")) {
        expandedKeywords.add("Ophthalmology");
      }
      if (lower.includes("uro") || lower.includes("kidney")) {
        expandedKeywords.add("Urology");
      }
      if (lower.includes("psych") || lower.includes("mental")) {
        expandedKeywords.add("Psychiatry");
      }
      if (lower.includes("endo") || lower.includes("thyroid") || lower.includes("diabetes")) {
        expandedKeywords.add("Endocrinology");
      }
    }

    const keywordList = Array.from(expandedKeywords);

    // Case-insensitive regex match against doctor specializations
    query.specialization = {
      $in: keywordList.map(k => new RegExp(`^${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'))
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
