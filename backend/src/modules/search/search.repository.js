import Doctor from "../doctor/doctor.model.js";

export const getCandidateDoctors = async (specializationKeywords) => {
  // Query ceiling limit of 250 to prevent memory explosions (Freeze Rule 31)
  const query = {
    status: "active",
    profileCompleted: true
  };

  if (specializationKeywords && specializationKeywords.length > 0) {
    // Case-insensitive match: symptoms store keywords lowercase, doctors store Title Case
    query.specialization = {
      $in: specializationKeywords.map(k => new RegExp(`^${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'))
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
