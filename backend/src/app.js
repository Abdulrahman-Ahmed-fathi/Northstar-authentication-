import "dotenv/config";

import express from "express";
import cors from "cors";
import helmet from "helmet";

import healthRoutes from "./routes/health.js";

const app = express();

const frontendOrigin = process.env.FRONTEND_URL || "http://localhost:3000";


//common http security headers
app.use(helmet())


//allow requests from the configured frontend origin
app.use(cors({
    origin: frontendOrigin,
    credentials: true,
}))


//parse incoming JSON requests bodies
app.use(express.json({
    limit: "10mb"
}))

//Register API routes 
app.use("/api/v1", healthRoutes)

// handle unknown routes
app.use((req,res)=>{
    res.status(404).json({
        error:{
            code: "not_found",
            message: "The requested resource was not found"
        }
    })
})

export default app;