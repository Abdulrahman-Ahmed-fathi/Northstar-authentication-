
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { env } from "./config/env.js";
import healthRoutes from "./routes/health.js";
import { notFoundHandler } from "./middlewares/not-found.middleware.js";
import { errorHandler } from "./middlewares/error.middleware.js";
import authRoutes from "./routes/auth.routes.js";

const app = express();


//common http security headers
app.use(helmet())


//allow requests from the configured frontend origin
app.use(cors({
    origin: env.FRONTEND_URL,
    credentials: true,
}))


//parse incoming JSON requests bodies
app.use(express.json({
    limit: "10mb"
}))

//Register API routes 
app.use("/api/v1", healthRoutes)

app.use("/api/v1/auth", authRoutes)

app.use(notFoundHandler)


app.use(errorHandler)



export default app;