import Hospital from "./hospital.model.js";
import HospitalSchedulingPolicy from "./hospital_scheduling_policy.model.js";

export const getHospitals = async (query) => {

  let { specialization, lat, lng, page = 1, limit = 10, sort = "name", order = "asc", search = "" } = query;

  const pageNum = parseInt(page) || 1;
  const limitNum = Math.min(parseInt(limit) || 10, 100); // clamp limit

  const parsedLat = parseFloat(lat);
  const parsedLng = parseFloat(lng);

  const isValidLocation =
    !isNaN(parsedLat) && !isNaN(parsedLng);

  let filter = { isActive: true };

  if (specialization) {
    filter.specializations = { $in: [specialization] };
  }

  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { address: { $regex: search, $options: "i" } }
    ];
  }

  const sortDirection = order.toLowerCase() === "desc" ? -1 : 1;
  const sortOption = { [sort]: sortDirection };

  let hospitals;

  if (isValidLocation) {
    hospitals = await Hospital.find({
      ...filter,
      location: {
        $near: {
          $geometry: {
            type: "Point",
            coordinates: [parsedLng, parsedLat]
          },
          $maxDistance: 10000 // 10km
        }
      }
    })
      .sort(sortOption)
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .maxTimeMS(5000)
      .lean();
  }

  else {
    hospitals = await Hospital.find(filter)
      .sort(sortOption)
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .maxTimeMS(5000)
      .lean();
  }

  hospitals = hospitals.map((h, index) => {

    let score = (h.rating || 0) * 2;

    if (specialization && h.specializations.includes(specialization)) {
      score += 5;
    }

    if (isValidLocation) {
      score -= index;
    }

    return {
      data: {
        _id: h._id,
        id: h._id,
        name: h.name,
        address: h.address,
        city: h.city || (typeof h.address === 'object' ? h.address?.city : null),
        specializations: h.specializations,
        rating: h.rating
      },
      score
    };
  });

  if (!isValidLocation) {
    hospitals.sort((a, b) => b.score - a.score);
  }

  const cleanHospitals = hospitals.map(h => h.data);

  let total;

  if (isValidLocation) {
    total = await Hospital.countDocuments({
      ...filter,
      location: {
        $geoWithin: {
          $centerSphere: [
            [parsedLng, parsedLat],
            10000 / 6378137 // radius in radians
          ]
        }
      }
    }).maxTimeMS(5000);
  } else {
    total = await Hospital.countDocuments(filter).maxTimeMS(5000);
  }

  return {
    total,
    page: pageNum,
    limit: limitNum,
    totalPages: Math.ceil(total / limitNum),
    data: cleanHospitals
  };
};

export const createHospitalService = async (data) => {

  const { name, address, lat, lng, specializations } = data;

  if (!lat || !lng) {
    const err = new Error("Location coordinates required");
    err.status = 400;
    throw err;
  }

  const hosp = await Hospital.create({
    name,
    address,
    location: {
      type: "Point",
      coordinates: [lng, lat]
    },
    specializations
  });

  await HospitalSchedulingPolicy.create({ hospitalId: hosp._id });
  return hosp;
};

export const updateHospitalService = async (id, data) => {

  const hospital = await Hospital.findByIdAndUpdate(
    id,
    data,
    { returnDocument: "after" }
  );

  if (!hospital) {
    const err = new Error("Hospital not found");
    err.status = 404;
    throw err;
  }

  return hospital;
};

export const disableHospitalService = async (id) => {

  const hospital = await Hospital.findByIdAndUpdate(
    id,
    { isActive: false },
    { returnDocument: "after" }
  );

  if (!hospital) {
    const err = new Error("Hospital not found");
    err.status = 404;
    throw err;
  }

  return hospital;
};

export const getHospitalSchedulingPolicy = async (hospitalId) => {
  let policy = await HospitalSchedulingPolicy.findOne({ hospitalId });
  if (!policy) {
    policy = await HospitalSchedulingPolicy.create({ hospitalId });
  }
  return policy;
};
