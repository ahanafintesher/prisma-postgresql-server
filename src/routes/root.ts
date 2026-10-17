import { Request, Response } from "express";
import { getRedisHealth } from "../lib/redis";

export const getRootInfo = async (req: Request, res: Response) => {
  const redisHealth = await getRedisHealth();

  // If the client explicitly requests JSON (e.g., API client, fetch, curl)
  if (req.headers.accept && req.headers.accept.includes("application/json") && !req.headers.accept.includes("text/html")) {
    return res.json({
      name: "WorkSphere EMS - Super Admin API",
      status: "operational",
      version: "1.0.0",
      environment: process.env.NODE_ENV || "production",
      cloud: "Vercel Serverless",
      database: "PostgreSQL (Neon Connected)",
      cache: redisHealth,
      timestamp: new Date().toISOString(),
      documentation: "/health",
      endpoints: {
        health: "GET /health",
        auth: {
          login: "POST /api/v1/super-admin/auth/login",
          profile: "GET /api/v1/super-admin/auth/me",
        },
        dashboard: {
          metrics: "GET /api/v1/super-admin/dashboard/metrics",
          growth: "GET /api/v1/super-admin/dashboard/growth",
        },
        companies: {
          list: "GET /api/v1/super-admin/companies",
          create: "POST /api/v1/super-admin/companies",
        },
        subscriptions: {
          plans: "GET /api/v1/super-admin/plans",
          list: "GET /api/v1/super-admin/subscriptions",
        },
        payments: {
          list: "GET /api/v1/super-admin/payments",
        },
        support: {
          tickets: "GET /api/v1/super-admin/tickets",
        },
        auditLogs: {
          list: "GET /api/v1/super-admin/audit-logs",
        },
      },
    });
  }

  // Otherwise, render a rich, modern, dark-mode status and API explorer UI
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>WorkSphere EMS | Backend API Gateway</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&family=JetBrains+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
  <style>
    :root {
      --bg: #07090e;
      --card-bg: rgba(18, 22, 34, 0.7);
      --card-border: rgba(255, 255, 255, 0.08);
      --text-main: #f1f5f9;
      --text-muted: #94a3b8;
      --primary: #3b82f6;
      --primary-glow: rgba(59, 130, 246, 0.25);
      --accent: #8b5cf6;
      --emerald: #10b981;
      --emerald-glow: rgba(16, 185, 129, 0.2);
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      background: radial-gradient(circle at 50% 0%, #171d33 0%, var(--bg) 70%);
      color: var(--text-main);
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 3rem 1.5rem;
      position: relative;
      overflow-x: hidden;
    }
    .background-glow {
      position: absolute;
      top: -150px;
      left: 50%;
      transform: translateX(-50%);
      width: 700px;
      height: 400px;
      background: radial-gradient(circle, rgba(59, 130, 246, 0.18) 0%, rgba(139, 92, 246, 0.1) 40%, transparent 70%);
      pointer-events: none;
      z-index: 0;
    }
    .container {
      width: 100%;
      max-width: 900px;
      z-index: 1;
    }
    header {
      text-align: center;
      margin-bottom: 2.5rem;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
      padding: 0.35rem 0.85rem;
      border-radius: 9999px;
      background: rgba(16, 185, 129, 0.1);
      border: 1px solid rgba(16, 185, 129, 0.3);
      color: #34d399;
      font-size: 0.8125rem;
      font-weight: 500;
      margin-bottom: 1.25rem;
      backdrop-filter: blur(8px);
    }
    .pulse-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #10b981;
      box-shadow: 0 0 10px #10b981;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
      70% { transform: scale(1); box-shadow: 0 0 0 8px rgba(16, 185, 129, 0); }
      100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
    }
    h1 {
      font-size: 2.5rem;
      font-weight: 800;
      letter-spacing: -0.03em;
      background: linear-gradient(135deg, #ffffff 40%, #94a3b8 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 0.75rem;
    }
    .subtitle {
      font-size: 1.05rem;
      color: var(--text-muted);
      max-width: 540px;
      margin: 0 auto;
      line-height: 1.6;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
      margin-bottom: 2rem;
    }
    .stat-card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 1rem;
      padding: 1.25rem;
      backdrop-filter: blur(16px);
      transition: all 0.2s ease;
    }
    .stat-card:hover {
      border-color: rgba(255, 255, 255, 0.18);
      transform: translateY(-2px);
    }
    .stat-label {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
      margin-bottom: 0.35rem;
    }
    .stat-value {
      font-size: 1.15rem;
      font-weight: 700;
      color: #fff;
    }
    .card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 1.25rem;
      padding: 1.75rem;
      backdrop-filter: blur(16px);
      margin-bottom: 2rem;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
    }
    .card-title {
      font-size: 1.125rem;
      font-weight: 700;
      margin-bottom: 1rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      color: #fff;
    }
    .endpoint-list {
      display: flex;
      flex-direction: column;
      gap: 0.6rem;
    }
    .endpoint-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0.85rem 1rem;
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid rgba(255, 255, 255, 0.05);
      border-radius: 0.75rem;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.85rem;
      transition: background 0.15s;
    }
    .endpoint-item:hover {
      background: rgba(255, 255, 255, 0.05);
    }
    .endpoint-left {
      display: flex;
      align-items: center;
      gap: 0.75rem;
      overflow: hidden;
    }
    .method {
      padding: 0.2rem 0.5rem;
      border-radius: 0.375rem;
      font-size: 0.75rem;
      font-weight: 700;
    }
    .method-get {
      background: rgba(16, 185, 129, 0.15);
      color: #34d399;
      border: 1px solid rgba(16, 185, 129, 0.3);
    }
    .method-post {
      background: rgba(59, 130, 246, 0.15);
      color: #60a5fa;
      border: 1px solid rgba(59, 130, 246, 0.3);
    }
    .endpoint-path {
      color: #e2e8f0;
      white-space: nowrap;
      text-overflow: ellipsis;
      overflow: hidden;
    }
    .endpoint-desc {
      font-family: 'Inter', sans-serif;
      font-size: 0.75rem;
      color: var(--text-muted);
    }
    .test-section {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 1rem;
      flex-wrap: wrap;
      margin-top: 1rem;
      padding-top: 1rem;
      border-top: 1px solid rgba(255, 255, 255, 0.06);
    }
    button.btn {
      background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
      color: #fff;
      border: none;
      border-radius: 0.6rem;
      padding: 0.65rem 1.25rem;
      font-size: 0.875rem;
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 4px 14px rgba(37, 99, 235, 0.3);
      transition: all 0.2s ease;
      display: inline-flex;
      align-items: center;
      gap: 0.5rem;
    }
    button.btn:hover {
      background: linear-gradient(135deg, #3b82f6 0%, #2563eb 100%);
      box-shadow: 0 6px 20px rgba(59, 130, 246, 0.45);
      transform: translateY(-1px);
    }
    button.btn:active {
      transform: translateY(0);
    }
    .preview-box {
      width: 100%;
      background: #04060a;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 0.75rem;
      padding: 1rem;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.8125rem;
      color: #38bdf8;
      overflow-x: auto;
      margin-top: 0.75rem;
      display: none;
    }
    footer {
      text-align: center;
      font-size: 0.8125rem;
      color: #64748b;
      margin-top: 2rem;
    }
    footer a {
      color: #94a3b8;
      text-decoration: none;
      transition: color 0.15s;
    }
    footer a:hover {
      color: #fff;
    }
  </style>
</head>
<body>
  <div class="background-glow"></div>
  <div class="container">
    <header>
      <div class="badge">
        <span class="pulse-dot"></span>
        System Operational
      </div>
      <h1>WorkSphere EMS</h1>
      <p class="subtitle">Platform Super Admin Enterprise Backend API Gateway powered by Express, Prisma & Neon PostgreSQL.</p>
    </header>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="stat-label">Deployment</div>
        <div class="stat-value">Vercel Edge</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Database</div>
        <div class="stat-value" style="color: #34d399;">Neon PostgreSQL</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">ORM</div>
        <div class="stat-value">Prisma 7.9</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">API Version</div>
        <div class="stat-value">v1 (Super Admin)</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">Cache Engine</div>
        <div class="stat-value" style="color: #38bdf8;">Redis / Memory</div>
      </div>
    </div>

    <div class="card">
      <div class="card-title">
        <span>⚡</span> Core API Endpoints
      </div>
      <div class="endpoint-list">
        <div class="endpoint-item">
          <div class="endpoint-left">
            <span class="method method-get">GET</span>
            <span class="endpoint-path">/health</span>
          </div>
          <span class="endpoint-desc">System health & telemetry</span>
        </div>
        <div class="endpoint-item">
          <div class="endpoint-left">
            <span class="method method-post">POST</span>
            <span class="endpoint-path">/api/v1/super-admin/auth/login</span>
          </div>
          <span class="endpoint-desc">Platform admin JWT authentication</span>
        </div>
        <div class="endpoint-item">
          <div class="endpoint-left">
            <span class="method method-get">GET</span>
            <span class="endpoint-path">/api/v1/super-admin/dashboard/metrics</span>
          </div>
          <span class="endpoint-desc">Live platform KPI cards & revenue stats</span>
        </div>
        <div class="endpoint-item">
          <div class="endpoint-left">
            <span class="method method-get">GET</span>
            <span class="endpoint-path">/api/v1/super-admin/companies</span>
          </div>
          <span class="endpoint-desc">Tenant companies directory & subscriptions</span>
        </div>
        <div class="endpoint-item">
          <div class="endpoint-left">
            <span class="method method-get">GET</span>
            <span class="endpoint-path">/api/v1/super-admin/plans</span>
          </div>
          <span class="endpoint-desc">SaaS subscription tiers & pricing packages</span>
        </div>
        <div class="endpoint-item">
          <div class="endpoint-left">
            <span class="method method-get">GET</span>
            <span class="endpoint-path">/api/v1/super-admin/payments</span>
          </div>
          <span class="endpoint-desc">Transaction records & billing logs</span>
        </div>
        <div class="endpoint-item">
          <div class="endpoint-left">
            <span class="method method-get">GET</span>
            <span class="endpoint-path">/api/v1/super-admin/tickets</span>
          </div>
          <span class="endpoint-desc">Customer support ticket desk</span>
        </div>
        <div class="endpoint-item">
          <div class="endpoint-left">
            <span class="method method-get">GET</span>
            <span class="endpoint-path">/api/v1/super-admin/audit-logs</span>
          </div>
          <span class="endpoint-desc">Immutable platform audit trail</span>
        </div>
      </div>

      <div class="test-section">
        <div>
          <strong style="font-size: 0.9rem; color: #fff;">Live Gateway Ping Test</strong>
          <p style="font-size: 0.75rem; color: var(--text-muted);">Ping <code>/health</code> directly from your browser to check latency and connectivity.</p>
        </div>
        <button id="ping-btn" class="btn" onclick="testHealth()">Ping /health</button>
      </div>
      <pre id="ping-result" class="preview-box"></pre>
    </div>

    <footer>
      WorkSphere Enterprise Management System &bull; <a href="/health" target="_blank">Health Check JSON</a>
    </footer>
  </div>

  <script>
    async function testHealth() {
      const btn = document.getElementById('ping-btn');
      const box = document.getElementById('ping-result');
      const start = performance.now();
      btn.innerText = 'Pinging...';
      try {
        const res = await fetch('/health');
        const duration = Math.round(performance.now() - start);
        const data = await res.json();
        box.style.display = 'block';
        box.textContent = JSON.stringify({ ...data, roundTripLatency: duration + 'ms' }, null, 2);
        btn.innerText = 'Ping /health (' + duration + 'ms)';
      } catch (err) {
        box.style.display = 'block';
        box.textContent = 'Error pinging /health: ' + err.message;
        btn.innerText = 'Ping /health';
      }
    }
  </script>
</body>
</html>`;

  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(html);
};
