import AdminReport from "./admin_report.model.js";
import { paginate } from "../../utils/pagination.js";

export const triggerReport = async (adminUserId, reportType) => {
  const allowed = ["doctor_performance", "queue_summary", "hospital_summary", "system_report"];
  if (!allowed.includes(reportType)) {
    throw Object.assign(new Error("Invalid report type"), { status: 400 });
  }
  return await AdminReport.create({
    requestedBy: adminUserId,
    reportType,
    status: "requested"
  });
};

export const getReports = async (queryOptions = {}) => {
  return await paginate(AdminReport, queryOptions, {}, [{ path: "requestedBy", select: "name email" }]);
};

export const getReportById = async (reportId) => {
  const report = await AdminReport.findById(reportId).populate("requestedBy", "name email");
  if (!report) {
    throw Object.assign(new Error("Report not found"), { status: 404 });
  }
  return report;
};
