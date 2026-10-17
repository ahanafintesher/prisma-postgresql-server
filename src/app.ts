import express from "express";
import cors from "cors";
import router from "./routes";
import { getRootInfo } from "./routes/root";
import { getRedisHealth } from "./lib/redis";
import { SettingsController } from "./services/settings/settings.controller";

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
    return res.status(400).json({
      success: false,
      error: "Malformed JSON payload in request body",
      message: err.message,
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
  res.status(404).json({
    success: false,
    error: `Route not found: ${req.method} ${req.originalUrl}`,
  });
});

// Global error handler
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("[Internal Server Error]", err);
  const status = err.status || err.statusCode || 500;
  res.status(status).json({
    success: false,
    error: err.message || "Internal server error",
  });
});

export default app;