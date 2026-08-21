// Showcase Demo Accounts Registry for MedHospi

export const DEMO_PASSWORD = "Demo@123";

export const demoAccounts = [
  {
    role: "super_admin",
    email: "super@medhospi.com",
    name: "Platform Super Admin",
    description: "Access Platform Health, Global Hospitals Management, System Worker stats, Audits."
  },
  {
    role: "hospital_admin",
    email: "hospital@medhospi.com",
    name: "AIIMS Delhi Administrator",
    description: "Scoped access to AIIMS Delhi Doctors roster, Counter Receptionists, schedules, leaves, and analytics."
  },
  {
    role: "receptionist",
    email: "reception@medhospi.com",
    name: "Triage Receptionist Counter #1",
    description: "Check-in console dashboard with live Booking ID lookups, QR scanner simulators, and token printers."
  },
  {
    role: "doctor",
    email: "doctor@medhospi.com",
    name: "Dr. Alok Sen (Neurology)",
    description: "Consultation Queue Workspace (BP vitals logging, EMR Prescriptions, Diagnostic Lab Orders, Follow-ups)."
  },
  {
    role: "patient",
    email: "patient@medhospi.com",
    name: "Vikash Kumar",
    description: "Centralized journey dashboard (upcoming appointments countdown, check-in QR ticket, historical timeline)."
  }
];

export const printDemoAccounts = () => {
  console.log("--------------------------------------------------------------------------------");
  console.log("             MEDHOSPI SHOWCASE DEMO ACCOUNTS (Password: Demo@123)               ");
  console.log("--------------------------------------------------------------------------------");
  demoAccounts.forEach(account => {
    console.log(`🔑 Role: ${account.role.toUpperCase().padEnd(15)} | Email: ${account.email.padEnd(25)}`);
    console.log(`   Name: ${account.name.padEnd(30)} | Details: ${account.description}`);
    console.log("--------------------------------------------------------------------------------");
  });
};
