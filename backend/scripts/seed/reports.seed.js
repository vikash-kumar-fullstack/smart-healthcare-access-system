import LabOrder from "../../src/modules/medical-records/lab_order.model.js";
import Report from "../../src/modules/medical-records/report.model.js";

export const seedReports = async (hashedPassword, context) => {
  console.log("Seeding EMR Diagnostic Lab Orders & Reports...");

  const visits = context.seededVisits;
  const bulkOrders = [];
  const bulkReports = [];

  for (let i = 0; i < visits.length; i++) {
    const visit = visits[i];
    
    // Create a matching lab order
    const labOrderId = visit._id; // reuse ID for clean linking
    
    bulkOrders.push({
      _id: labOrderId,
      visitId: visit._id,
      patientId: visit.patientId,
      doctorId: visit.doctorId,
      tests: i % 2 === 0 ? ["Complete Blood Count (CBC)", "Kidney Function Test"] : ["Thyroid Profile (T3, T4, TSH)"],
      status: "ORDERED"
    });

    // Create a matching pdf report
    bulkReports.push({
      labOrderId,
      patientId: visit.patientId,
      uploadedBy: visit.doctorId,
      visitId: visit._id,
      fileUrl: "https://example.com/reports/cbc_mock.pdf",
      fileType: "application/pdf",
      fileName: "cbc_mock.pdf",
      title: i % 2 === 0 ? "Complete Blood Count (CBC) Diagnostic Report" : "Thyroid Function Test Report",
      category: "lab_report"
    });
  }

  // Pre-clean
  await LabOrder.deleteMany({});
  await Report.deleteMany({});

  const orders = await LabOrder.insertMany(bulkOrders);
  const reports = await Report.insertMany(bulkReports);

  console.log(`  - Seeded ${orders.length} lab orders.`);
  console.log(`  - Seeded ${reports.length} diagnostic reports.`);

  context.seededLabOrders = orders;
  context.seededReports = reports;
};
