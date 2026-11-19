import subjectRoutes from "./routes/subjectRoutes.js";
import "dotenv/config";
import attendanceRoutes from "./routes/attendanceRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import reportRoutes from "./routes/reportRoutes.js";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";

import {
    authenticateUser,
    requireRole,
} from "./middleware/authMiddleware.js";

const app = express();
const PORT = process.env.PORT || 5000;

app.use(helmet());

app.use(
    cors({
        origin: process.env.FRONTEND_URL || "http://localhost:5173",
    })
);

app.use(express.json({ limit: "10kb" }));

app.use(
    "/api",
    rateLimit({
        windowMs: 60 * 1000,
        limit: 100,
        standardHeaders: true,
        legacyHeaders: false,
    })
);


// Public health check
app.get("/api/health", (req, res) => {
    res.status(200).json({
        success: true,
        message: "QR Attendance API is running.",
    });
});
app.use("/api/subjects", subjectRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api/auth", authRoutes);
// Protected: any authenticated user
app.get("/api/me", authenticateUser, (req, res) => {
    res.status(200).json({
        success: true,
        user: req.user,
    });
});

// Protected: teachers only
app.get(
    "/api/teacher/test",
    authenticateUser,
    requireRole("teacher"),
    (req, res) => {
        res.status(200).json({
            success: true,
            message: "Teacher authorization successful.",
            user: req.user,
        });
    }
);

// Protected: students only
app.get(
    "/api/student/test",
    authenticateUser,
    requireRole("student"),
    (req, res) => {
        res.status(200).json({
            success: true,
            message: "Student authorization successful.",
            user: req.user,
        });
    }
);

// Unknown endpoint
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: "API endpoint not found.",
    });
});

// Central error handler
app.use((err, req, res, next) => {
    console.error(err);

    res.status(500).json({
        success: false,
        message: "Internal server error.",
    });
});

app.listen(PORT, "0.0.0.0", () => {
    console.log(`QR Attendance API running on port ${PORT}`);
});