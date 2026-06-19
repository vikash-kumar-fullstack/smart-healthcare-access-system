import Hospital from "./hospital.model.js";

export const getHospitals = async (query) => {

  let { specialization, lat, lng, page = 1, limit = 10 } = query;

  const pageNum = parseInt(page) || 1;
  const limitNum = Math.min(parseInt(limit) || 10, 50); // clamp limit

  const parsedLat = parseFloat(lat);
  const parsedLng = parseFloat(lng);

  const isValidLocation =
    !isNaN(parsedLat) && !isNaN(parsedLng);

  let filter = { isActive: true };

  if (specialization) {
    filter.specializations = { $in: [specialization] };
  }

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
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean();
  }

  else {
    hospitals = await Hospital.find(filter)
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
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
        id: h._id,
        name: h.name,
        address: h.address,
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
    });
  } else {
    total = await Hospital.countDocuments(filter);
  }

  return {
    total,
    page: pageNum,
    limit: limitNum,
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

  return await Hospital.create({
    name,
    address,
    location: {
      type: "Point",
      coordinates: [lng, lat]
    },
    specializations
  });
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
