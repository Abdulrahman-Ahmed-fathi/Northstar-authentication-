
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";

import { env } from "./config/env.js";

import healthRoutes from "./routes/health.js";
import authRoutes from "./routes/auth.routes.js";

import { notFoundHandler } from "./middlewares/not-found.middleware.js";
import { errorHandler } from "./middlewares/error.middleware.js";

const app = express();

// 1. Add common HTTP security headers.
app.use(helmet());

// 2. Allow requests from the configured frontend origin.
app.use(
  cors({
    origin: env.FRONTEND_URL,
    credentials: true,
  })
);

// 3. Parse incoming JSON request bodies.
app.use(
  express.json({
    limit: "10kb",
  })
);

// 4. Parse cookies before routes access req.cookies.
app.use(cookieParser());

// 5. Register API routes.
app.use("/api/v1", healthRoutes);
app.use("/api/v1/auth", authRoutes);

// 6. Handle requests to unknown routes.
app.use(notFoundHandler);

// 7. Handle errors passed through next(error).
app.use(errorHandler);

export default app;
