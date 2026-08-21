const BASE_URL = "http://localhost:5000/api/v1";

async function testLoginSpeed() {
  console.log("Measuring authentication and dashboard API response latency...\n");

  const credentials = [
    { label: "Patient Login", email: "patient@example.com", password: "Password123!" },
    { label: "Doctor Login", email: "doctor@example.com", password: "Password123!" },
    { label: "District Admin Login", email: "admin@example.com", password: "Password123!" }
  ];

  for (const cred of credentials) {
    const start = Date.now();
    try {
      const res = await fetch(`${BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: cred.email, password: cred.password })
      });
      const data = await res.json();
      const elapsed = Date.now() - start;

      if (!data.success) {
        console.error(`❌ ${cred.label} failed:`, data.message);
        continue;
      }

      const { role, token } = data.data;
      console.log(`✅ ${cred.label}: Completed in ${elapsed} ms (Role: ${role})`);

      // Test Dashboard endpoint latency for this token
      if (role === "patient") {
        const dStart = Date.now();
        await fetch(`${BASE_URL}/hospitals?limit=6`, { headers: { Authorization: `Bearer ${token}` } });
        console.log(`   ⚡ Patient Dashboard Hospital Fetch: ${Date.now() - dStart} ms`);
      } else if (role === "doctor") {
        const dStart = Date.now();
        await fetch(`${BASE_URL}/doctors/profile`, { headers: { Authorization: `Bearer ${token}` } });
        console.log(`   ⚡ Doctor Profile Fetch: ${Date.now() - dStart} ms`);
      }
    } catch (err) {
      console.error(`❌ ${cred.label} failed:`, err.message);
    }
  }

  console.log("\n=========================================");
  console.log("Authentication & Dashboard Speed Test Done!");
  console.log("=========================================\n");
}

testLoginSpeed();
