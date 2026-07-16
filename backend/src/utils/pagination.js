import mongoose from "mongoose";

/**
 * Standardized Pagination Helper
 * @param {mongoose.Model} model - Mongoose Model to query
 * @param {Object} queryOptions - Request query options
 * @param {Object} baseQuery - Base MongoDB filter query
 * @param {Array<string|Object>} populate - Mongoose populate arguments
 * @param {string} select - Mongoose select fields projection
 * @returns {Promise<{data: Array, pagination: {page: number, limit: number, total: number, totalPages: number}}>}
 */
export const paginate = async (model, queryOptions = {}, baseQuery = {}, populate = [], select = "") => {
  const { page = 1, limit = 10, sort = "createdAt", order = "desc", search = "" } = queryOptions;

  const pageNum = Math.max(1, parseInt(page, 10));
  const limitNum = Math.max(1, parseInt(limit, 10));
  const skip = (pageNum - 1) * limitNum;

  let query = { ...baseQuery };

  // Search logic if applicable
  if (search) {
    // Dynamically look for searchable fields based on schema paths
    const paths = Object.keys(model.schema.paths);
    const searchConditions = [];

    // Fields to search on based on model
    let searchFields = [];
    if (paths.includes("name")) searchFields.push("name");
    if (paths.includes("title")) searchFields.push("title");
    if (paths.includes("email")) searchFields.push("email");
    if (paths.includes("phone")) searchFields.push("phone");
    if (paths.includes("bookingNumber")) searchFields.push("bookingNumber");
    if (paths.includes("description")) searchFields.push("description");
    if (paths.includes("action")) searchFields.push("action");

    if (searchFields.length > 0) {
      searchFields.forEach(field => {
        searchConditions.push({ [field]: { $regex: search, $options: "i" } });
      });
      query = { ...query, $or: searchConditions };
    }
  }

  const sortDirection = order.toLowerCase() === "asc" ? 1 : -1;
  const sortOption = { [sort]: sortDirection };

  // Run count query with maxTimeMS constraint
  const total = await model.countDocuments(query).maxTimeMS(5000);
  const totalPages = Math.ceil(total / limitNum);

  // Run main query with maxTimeMS constraint, selection, and lean format
  let dbQuery = model.find(query)
    .sort(sortOption)
    .skip(skip)
    .limit(limitNum)
    .maxTimeMS(5000)
    .select(select)
    .lean();

  if (populate.length > 0) {
    populate.forEach(p => {
      dbQuery = dbQuery.populate(p);
    });
  }

  const data = await dbQuery;

  return {
    data,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total,
      totalPages
    }
  };
};
