import crypto from "crypto";

/**
 * PDF Service Mock template generator
 */
export const generatePdf = async (type, data) => {
  const fileHash = crypto.createHash("sha256").update(JSON.stringify(data) + Date.now()).digest("hex").substring(0, 12);
  const mockPath = `/uploads/documents/${type}_${fileHash}.pdf`;

  // Standard layouts
  let html = `
    <html>
      <head><style>body { font-family: sans-serif; padding: 20px; color: #333; }</style></head>
      <body>
        <h2>MedHospi Digital Health Records Portal</h2>
        <hr/>
        <h3>Document Type: ${type.toUpperCase().replace(/_/g, " ")}</h3>
        <p>Generated At: ${new Date().toISOString()}</p>
        <p>Patient ID: ${data.patientId}</p>
  `;

  if (type === "prescription") {
    html += `<h4>Prescription Details:</h4><ul>`;
    for (const med of data.medicines || []) {
      html += `<li><strong>${med.genericName}</strong> (${med.brandName || "Generic"}) - ${med.dosage} - ${med.frequency} for ${med.duration} [${med.foodTiming}]</li>`;
    }
    html += `</ul>`;
    if (data.digitalSignature) {
      html += `<p>Signed Digitally: <span style="font-family: monospace;">${data.digitalSignature}</span></p>`;
    }
  }

  if (type === "visit_summary") {
    html += `
      <h4>Consultation Summary:</h4>
      <p>Chief Complaint: ${data.chiefComplaint}</p>
      <p>Diagnosis: ${data.diagnosis}</p>
      <p>Vitals BP: ${data.vitals?.bp?.systolic || "--"}/${data.vitals?.bp?.diastolic || "--"} mmHg | Pulse: ${data.vitals?.pulse || "--"} bpm | Temp: ${data.vitals?.temperature || "--"} F</p>
    `;
  }

  html += `
      </body>
    </html>
  `;

  return {
    success: true,
    fileUrl: mockPath,
    fileName: `${type}_${fileHash}.pdf`,
    rawHtml: html
  };
};
