async function runVerification() {
  const BASE_URL = "http://localhost:5000";
  console.log(`\n======================================================`);
  console.log(`Starting Comprehensive Backend Verification on ${BASE_URL}`);
  console.log(`======================================================\n`);

  let passed = 0;
  let failed = 0;

  async function assertRequest(name: string, url: string, options: RequestInit = {}, expectedStatus = 200) {
    try {
      const res = await fetch(url, options);
      const isOk = res.status === expectedStatus;
      const xCache = res.headers.get("x-cache") || "N/A";
      const xEngine = res.headers.get("x-cache-engine") || "N/A";

      if (isOk) {
        console.log(`[PASS] ${name.padEnd(45)} -> ${res.status} (Cache: ${xCache}, Engine: ${xEngine})`);
        passed++;
        return await res.json();
      } else {
        const text = await res.text();
        console.error(`[FAIL] ${name.padEnd(45)} -> Expected ${expectedStatus}, got ${res.status}`);
        console.error(`       Body: ${text.slice(0, 200)}`);
        failed++;
        return null;
      }
    } catch (err: any) {
      console.error(`[ERROR] ${name.padEnd(45)} -> ${err.message}`);
      failed++;
      return null;
    }
  }

  // 1. Health check
  await assertRequest("1. Root Health Check", `${BASE_URL}/health`);

  // 2. Login
  const loginRes = await assertRequest(
    "2. Super Admin Login",
    `${BASE_URL}/api/v1/super-admin/auth/login`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: "admin@worksphere.com",
        password: "Admin@WorkSphere2026!",
      }),
    },
    200
  );

  const token = loginRes?.data?.token;
  if (!token) {
    console.error("FATAL: Could not acquire Bearer token. Aborting remaining tests.");
    process.exit(1);
  }

  const authHeaders = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  // 3. Auth Me
  await assertRequest("3. Auth Me Profile", `${BASE_URL}/api/v1/super-admin/auth/me`, {
    headers: authHeaders,
  });

  // 4. Dashboard Metrics (Miss then Hit)
  await assertRequest("4a. Dashboard Metrics (Cache MISS)", `${BASE_URL}/api/v1/super-admin/dashboard/metrics`, {
    headers: authHeaders,
  });
  await assertRequest("4b. Dashboard Metrics (Cache HIT)", `${BASE_URL}/api/v1/super-admin/dashboard/metrics`, {
    headers: authHeaders,
  });

  // 5. Dashboard Charts
  await assertRequest("5. Dashboard 6-Month Charts", `${BASE_URL}/api/v1/super-admin/dashboard/charts`, {
    headers: authHeaders,
  });

  // 6. Companies
  await assertRequest("6. Companies Directory", `${BASE_URL}/api/v1/super-admin/companies`, {
    headers: authHeaders,
  });

  // 7. Plans
  await assertRequest("7. Pricing Plans Catalog", `${BASE_URL}/api/v1/super-admin/plans`, {
    headers: authHeaders,
  });

  // 8. Subscriptions
  await assertRequest("8. Tenant Subscriptions", `${BASE_URL}/api/v1/super-admin/subscriptions`, {
    headers: authHeaders,
  });

  // 9. Payments
  await assertRequest("9. Payments Ledger", `${BASE_URL}/api/v1/super-admin/payments`, {
    headers: authHeaders,
  });

  // 10. Promotions
  await assertRequest("10. Promotions & Coupons", `${BASE_URL}/api/v1/super-admin/promotions`, {
    headers: authHeaders,
  });

  // 11. Tickets
  await assertRequest("11. Support Tickets Desk", `${BASE_URL}/api/v1/super-admin/tickets`, {
    headers: authHeaders,
  });

  // 12. Announcements
  await assertRequest("12. Platform Announcements", `${BASE_URL}/api/v1/super-admin/announcements`, {
    headers: authHeaders,
  });

  // 13. Admin Users
  await assertRequest("13. Platform Admin Operators", `${BASE_URL}/api/v1/super-admin/admin-users`, {
    headers: authHeaders,
  });

  // 14. Roles & Permissions
  await assertRequest("14. RBAC Roles", `${BASE_URL}/api/v1/super-admin/roles`, {
    headers: authHeaders,
  });
  await assertRequest("14b. RBAC Permission Catalog", `${BASE_URL}/api/v1/super-admin/roles/permissions`, {
    headers: authHeaders,
  });

  // 15. Audit Logs
  await assertRequest("15. Audit Logs Immutable Records", `${BASE_URL}/api/v1/super-admin/audit-logs`, {
    headers: authHeaders,
  });

  // 16. System Health & Infrastructure
  await assertRequest("16a. System Health Telemetry", `${BASE_URL}/api/v1/super-admin/system-health`, {
    headers: authHeaders,
  });
  await assertRequest("16b. Multi-Service Telemetry (/health/services)", `${BASE_URL}/health/services`, {
    headers: authHeaders,
  });

  // 17. Background Jobs & Webhooks
  await assertRequest("17. Background Queue Telemetry", `${BASE_URL}/api/v1/super-admin/jobs`, {
    headers: authHeaders,
  });
  await assertRequest("17b. Outbound Webhooks Logs", `${BASE_URL}/api/v1/super-admin/webhooks`, {
    headers: authHeaders,
  });

  // 18. Settings & Integrations
  await assertRequest("18. Platform Settings", `${BASE_URL}/api/v1/super-admin/settings`, {
    headers: authHeaders,
  });
  await assertRequest("18b. Integrations Health", `${BASE_URL}/api/v1/super-admin/integrations`, {
    headers: authHeaders,
  });
  await assertRequest("18c. Security Settings (/security-settings)", `${BASE_URL}/api/v1/super-admin/security-settings`, {
    headers: authHeaders,
  });

  // 19. Direct Prefix Compatibility Tests (BACKEND_INTEGRATION.md)
  await assertRequest("19a. Direct /dashboard/metrics", `${BASE_URL}/dashboard/metrics`, { headers: authHeaders });
  await assertRequest("19b. Direct /companies", `${BASE_URL}/companies`, { headers: authHeaders });
  await assertRequest("19c. Direct /users", `${BASE_URL}/users`, { headers: authHeaders });
  await assertRequest("19d. Direct /subscriptions/plans", `${BASE_URL}/subscriptions/plans`, { headers: authHeaders });
  await assertRequest("19e. Direct /logs", `${BASE_URL}/logs`, { headers: authHeaders });
  await assertRequest("19f. Direct /promotions/coupons", `${BASE_URL}/promotions/coupons`, { headers: authHeaders });

  // 20. Standard /api Compatibility Tests
  await assertRequest("20a. /api/dashboard/metrics", `${BASE_URL}/api/dashboard/metrics`, { headers: authHeaders });
  await assertRequest("20b. /api/companies", `${BASE_URL}/api/companies`, { headers: authHeaders });
  await assertRequest("20c. /api/users", `${BASE_URL}/api/users`, { headers: authHeaders });

  // 21. New High-Impact Features (Export & Sessions)
  await assertRequest("21a. Audit Logs Export (JSON)", `${BASE_URL}/api/v1/super-admin/audit-logs/export?format=json`, {
    headers: authHeaders,
  });
  await assertRequest("21b. Active Sessions Listing", `${BASE_URL}/auth/sessions`, {
    headers: authHeaders,
  });

  console.log(`\n======================================================`);
  console.log(`Verification Complete: ${passed} PASSED, ${failed} FAILED`);
  console.log(`======================================================\n`);

  process.exit(failed > 0 ? 1 : 0);
}

runVerification();
