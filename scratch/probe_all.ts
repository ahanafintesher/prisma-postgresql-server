import "dotenv/config";
import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET || "7882a5f0e9cc387e199b42d426718201291fdaa11a963ddb1c73970bf4b35b4e86b9835facad5eb3ddcb136d33bbf7f354dffd0a9eb34bc64018cb239771e8fb";

const token = jwt.sign(
  {
    id: "cfd0a2c7-15f1-4f2e-aa19-3e024956aafe",
    email: "admin@worksphere.com",
    role: "Super Admin (Root)",
    roleSlug: "super-admin-root",
    permissions: [
      "platform.dashboard.view",
      "platform.companies.view",
      "platform.companies.manage",
      "platform.subscriptions.manage",
      "platform.payments.view",
      "platform.tickets.reply",
      "platform.admins.manage",
      "platform.roles.manage",
      "platform.settings.manage",
      "platform.audit.view",
    ],
  },
  JWT_SECRET,
  { expiresIn: "1h" }
);

async function probe() {
  const endpoints = [
    "/api/v1/super-admin/dashboard/metrics",
    "/api/v1/super-admin/companies",
    "/api/v1/super-admin/subscriptions",
    "/api/v1/super-admin/payments",
    "/api/v1/super-admin/promotions",
    "/api/v1/super-admin/tickets",
    "/api/v1/super-admin/announcements",
    "/api/v1/super-admin/admin-users",
    "/api/v1/super-admin/roles",
    "/api/v1/super-admin/settings",
  ];

  console.log("Probing all Super Admin endpoints with fresh dummy data...");

  for (const ep of endpoints) {
    const res = await fetch("http://127.0.0.1:5000" + ep, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data: any = await res.json();
    const count = Array.isArray(data.data) ? `${data.data.length} items` : typeof data.data;
    console.log(`[HTTP ${res.status}] ${ep.padEnd(42)} -> Success: ${data.success} | Payload: ${count}`);
  }

  process.exit(0);
}

probe().catch((err) => {
  console.error("Probe error:", err);
  process.exit(1);
});
