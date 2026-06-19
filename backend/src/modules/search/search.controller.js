import asyncHandler from "../../utils/asyncHandler.js";
import { successResponse } from "../../utils/apiResponse.js";
import { searchBySymptom } from "./search.service.js";
import { symptomMap } from "../../utils/symptomMap.js";
import { symptomSchema } from "./search.validation.js";

export const search = asyncHandler(async (req, res) => {

  const result = symptomSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).json({
      success: false,
      message: "Symptom is required"
    });
  }
  const { symptom } = result.data;
  const doctors = await searchBySymptom(symptom);
  return successResponse(res, doctors, "Doctors found");
});




