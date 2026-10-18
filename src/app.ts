import express from "express";
import cors from "cors";
import router from "./routes";
import { getRootInfo } from "./routes/root";
import { getRedisHealth } from "./lib/redis";
import { SettingsController } from "./services/settings/settings.controller";
import { sendError } from "./lib/response";

const app = express();

const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  "https://admin.worksphere.com",
  ...(process.env.FRONTEND_URL ? process.env.FRONTEND_URL.split(",").map((s) => s.trim()) : []),
  ...(process.env.CORS_ORIGIN ? process.env.CORS_ORIGIN.split(",").map((s) => s.trim()) : []),
];

app.use(
  cors({
    origin: (origin, callback) => {
      // allow requests with no origin (like mobile apps, curl, postman)
      if (!origin) return callback(null, true);
      if (
        allowedOrigins.includes(origin) ||
        origin.startsWith("http://localhost:")
      ) {
        return callback(null, true);
      }
      return callback(null, true); // Dev permissive
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "Accept",
      "X-Refresh-Token",
      "X-Requested-With",
    ],
  })
);

app.use(express.json());

// Handle malformed JSON body errors from express.json() gracefully
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  if (err instanceof SyntaxError && "body" in err) {
    return sendError(res, "Malformed JSON payload in request body", 400, {
      body: ["Syntax error parsing JSON payload"],
    });
  }
  return next(err);
});

const handleHealth = async (req: express.Request, res: express.Response) => {
  const redisHealth = await getRedisHealth();
  res.json({
    status: "ok",
    service: "worksphere-backend",
    timestamp: new Date().toISOString(),
    redis: redisHealth,
  });
};

app.get("/health", handleHealth);
app.get("/api/health", handleHealth);
app.get("/health/services", SettingsController.getHealthServices);
app.get("/api/health/services", SettingsController.getHealthServices);

// API root and versioned routes
app.get("/", getRootInfo);
app.get("/api", getRootInfo);
app.use("/", router);

// 404 Catch-all for undefined routes
app.use((req: express.Request, res: express.Response) => {
  return sendError(res, `Route not found: ${req.method} ${req.originalUrl}`, 404);
});

// Global error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("[Internal Server Error]", err);
  const status = typeof err.status === "number" ? err.status : typeof err.statusCode === "number" ? err.statusCode : 500;
  const message = err.message || "Internal server error";
  const errors = err.errors || undefined;
  return sendError(res, message, status, errors);
});

export default app;