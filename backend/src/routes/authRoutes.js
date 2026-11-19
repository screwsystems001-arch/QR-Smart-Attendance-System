
import { Router } from "express";
import { authenticateUser } from "../middleware/authMiddleware.js";

const router = Router();

// Get the authenticated user's profile.
router.get("/me", authenticateUser, (req, res) => {
    return res.status(200).json({
        success: true,
        user: {
            id: req.user.id,
            email: req.user.email,
            full_name: req.user.fullName,
            role: req.user.role,
        },
    });
});

export default router;
