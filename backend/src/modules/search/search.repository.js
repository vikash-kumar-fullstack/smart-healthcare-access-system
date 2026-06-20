import Doctor from "../doctor/doctor.model.js";

export const getCandidateDoctors = async (specializationKeywords) => {
  // Query ceiling limit of 250 to prevent memory explosions (Freeze Rule 31)
  const query = {
    status: "active",
    profileCompleted: true
  };

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
