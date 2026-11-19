
import { authClient, adminClient } from "../config/supabase.js";

export async function authenticateUser(req, res, next) {
    try {
        const authorization = req.headers.authorization;

        if (!authorization || !authorization.startsWith("Bearer ")) {
            return res.status(401).json({
                success: false,
                message: "Missing or invalid Authorization header.",
            });
        }

        const token = authorization.slice(7).trim();

        if (!token) {
            return res.status(401).json({
                success: false,
                message: "Access token is required.",
            });
        }

        // Ask Supabase Auth to validate the access token.
        const {
            data: { user },
            error: authError,
        } = await authClient.auth.getUser(token);

        if (authError || !user) {
            return res.status(401).json({
                success: false,
                message: "Invalid or expired access token.",
            });
        }

        // Load the application's role from the trusted database.
        const { data: profile, error: profileError } =
            await adminClient
                .from("profiles")
                .select("user_id, full_name, role")
                .eq("user_id", user.id)
                .maybeSingle();

        if (profileError) {
            console.error("Profile lookup failed:", profileError.message);

            return res.status(500).json({
                success: false,
                message: "Unable to verify user profile.",
            });
        }

        if (!profile) {
            return res.status(403).json({
                success: false,
                message: "User profile not found.",
            });
        }

        // Attach verified identity and database role to the request.
        req.user = {
            id: user.id,
            email: user.email,
            fullName: profile.full_name,
            role: profile.role,
        };

        next();
    } catch (error) {
        console.error("Authentication middleware error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Authentication service error.",
        });
    }
}

export function requireRole(...allowedRoles) {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: "Authentication required.",
            });
        }

        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: "You do not have permission to access this resource.",
            });
        }

        next();
    };
}
