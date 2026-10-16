import express from "express";
import cors from "cors";
import router from "./routes";

const app = express();

const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  "https://admin.worksphere.com",
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

// API root and versioned routes
app.use("/", router);

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "worksphere-backend",
    timestamp: new Date().toISOString(),
  });
});

export default app;