import asyncHandler from "../../utils/asyncHandler.js";
import { successResponse } from "../../utils/apiResponse.js";
import { getHospitals,createHospitalService,updateHospitalService,disableHospitalService } from "./hospital.service.js";
import { hospitalQuerySchema, createHospitalSchema, updateHospitalSchema } from "./hospital.validation.js";

export const listHospitals = asyncHandler(async (req, res) => {

  const result = hospitalQuerySchema.safeParse(req.query);

  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: result.error.issues[0].message
    });
  }

  const hospitals = await getHospitals(result.data);

  return successResponse(res, hospitals, "Hospitals fetched");
});

export const createHospital = asyncHandler(async (req, res) => {

  const result = createHospitalSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: result.error.issues[0].message
    });
  }

  const hospital = await createHospitalService(result.data);

  return successResponse(res, hospital, "Hospital created");
});

export const updateHospital = asyncHandler(async (req, res) => {

  const result = updateHospitalSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: result.error.issues[0].message
    });
  }

  const { id } = req.params;

  const hospital = await updateHospitalService(id, result.data);

  return successResponse(res, hospital, "Hospital updated");
});

export const disableHospital = asyncHandler(async (req, res) => {

  const { id } = req.params;

  await disableHospitalService(id);

  return successResponse(res, null, "Hospital disabled");
});
