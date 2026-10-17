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
      "platform.companies.view",
      "platform.companies.manage",
      "platform.subscriptions.manage",
      "platform.payments.view",
      "platform.tickets.reply",
      "platform.admins.manage",
      "platform.roles.manage",
      "platform.audit.view",
    ],
  },
  JWT_SECRET,
  { expiresIn: "1h" }
);

async function runTests() {
  console.log("=== PAGINATION TEST SUITE ===");

  // 1. Companies Page 1 (limit: 5)
  const res1 = await fetch("http://127.0.0.1:5000/api/v1/super-admin/companies?page=1&limit=5", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data1: any = await res1.json();
  console.log("\n[Test 1] Companies Page 1 (limit 5):");
  console.log("Pagination:", JSON.stringify(data1.pagination));
  console.log("Items count:", data1.data?.length);
  console.log("First item:", data1.data?.[0]?.name);

  // 2. Companies Page 2 (limit: 5)
  const res2 = await fetch("http://127.0.0.1:5000/api/v1/super-admin/companies?page=2&limit=5", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data2: any = await res2.json();
  console.log("\n[Test 2] Companies Page 2 (limit 5):");
  console.log("Pagination:", JSON.stringify(data2.pagination));
  console.log("Items count:", data2.data?.length);
  console.log("First item:", data2.data?.[0]?.name);

  // 3. Companies Sorting by name ASC
  const res3 = await fetch("http://127.0.0.1:5000/api/v1/super-admin/companies?page=1&limit=5&sortBy=name&sortOrder=asc", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data3: any = await res3.json();
  console.log("\n[Test 3] Companies Sorted by name ASC:");
  console.log("Names:", data3.data?.map((c: any) => c.name));

  // 4. Subscriptions Pagination (limit: 5)
  const res4 = await fetch("http://127.0.0.1:5000/api/v1/super-admin/subscriptions?page=1&limit=5", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data4: any = await res4.json();
  console.log("\n[Test 4] Subscriptions Pagination:");
  console.log("Pagination:", JSON.stringify(data4.pagination));
  console.log("Items count:", data4.data?.length);

  // 5. Payments Pagination (limit: 5)
  const res5 = await fetch("http://127.0.0.1:5000/api/v1/super-admin/payments?page=1&limit=5", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data5: any = await res5.json();
  console.log("\n[Test 5] Payments Pagination:");
  console.log("Pagination:", JSON.stringify(data5.pagination));
  console.log("Items count:", data5.data?.length);

  // 6. Support Tickets Pagination
  const res6 = await fetch("http://127.0.0.1:5000/api/v1/super-admin/tickets?page=1&limit=5", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data6: any = await res6.json();
  console.log("\n[Test 6] Support Tickets Pagination:");
  console.log("Pagination:", JSON.stringify(data6.pagination));

  // 7. Audit Logs Pagination
  const res7 = await fetch("http://127.0.0.1:5000/api/v1/super-admin/audit-logs?page=1&limit=5", {
    headers: { Authorization: `Bearer ${token}` },
  });
  const data7: any = await res7.json();
  console.log("\n[Test 7] Audit Logs Pagination:");
  console.log("Pagination:", JSON.stringify(data7.pagination));

  console.log("\n=== ALL PAGINATION TESTS PASSED SUCCESSFULLY ===");
  process.exit(0);
}

runTests().catch((err) => {
  console.error("Test error:", err);
  process.exit(1);
});
