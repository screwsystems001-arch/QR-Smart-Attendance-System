import { calculateDistanceMeters } from "../utils/distance.js";
import { generateSessionQR } from "../utils/qrGenerator.js";
import { Router } from "express";
import { randomUUID } from "node:crypto";
import { adminClient } from "../config/supabase.js";
import {
    authenticateUser,
    requireRole,
} from "../middleware/authMiddleware.js";

const router = Router();

// Teacher creates a time-limited attendance session.
router.post(
    "/sessions",
    authenticateUser,
    requireRole("teacher"),
    async (req, res) => {
        try {
            const {
                subject_id,
                classroom_lat,
                classroom_lng,
                radius_meters = 100,
                duration_minutes = 5,
            } = req.body;

            if (
                typeof subject_id !== "string" ||
                !Number.isFinite(classroom_lat) ||
                !Number.isFinite(classroom_lng) ||
                !Number.isInteger(radius_meters) ||
                radius_meters < 10 ||
                radius_meters > 1000 ||
                !Number.isInteger(duration_minutes) ||
                duration_minutes < 1 ||
                duration_minutes > 60 ||
                classroom_lat < -90 ||
                classroom_lat > 90 ||
                classroom_lng < -180 ||
                classroom_lng > 180
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid session details or classroom coordinates.",
                });
            }

            // Confirm that the teacher owns this subject.
            const { data: subject, error: subjectError } = await adminClient
                .from("subjects")
                .select("id, teacher_id")
                .eq("id", subject_id)
                .maybeSingle();

            if (subjectError) {
                return res.status(500).json({
                    success: false,
                    message: "Could not verify subject.",
                });
            }

            if (!subject) {
                return res.status(404).json({
                    success: false,
                    message: "Subject not found.",
                });
            }

            if (subject.teacher_id !== req.user.id) {
                return res.status(403).json({
                    success: false,
                    message: "You do not own this subject.",
                });
            }

            const expiresAt = new Date(
                Date.now() + duration_minutes * 60 * 1000
            ).toISOString();

            const { data: session, error } = await adminClient
                .from("attendance_sessions")
                .insert({
                    id: randomUUID(),
                    subject_id,
                    teacher_id: req.user.id,
                    classroom_lat,
                    classroom_lng,
                    radius_meters,
                    expires_at: expiresAt,
                    status: "active",
                })
                .select()
                .single();

            if (error) {
                console.error("Session creation failed:", error.message);

                return res.status(500).json({
                    success: false,
                    message: "Could not create attendance session.",
                });
            }

            return res.status(201).json({
                success: true,
                message: "Attendance session created.",
                session,
            });
        } catch (error) {
            console.error("Session route error:", error.message);

            return res.status(500).json({
                success: false,
                message: "Internal server error.",
            });
        }
    }
);

router.get(
    "/sessions/:id/qr",
    authenticateUser,
    requireRole("teacher"),
    async (req, res) => {
        try {
            const { data: session, error } = await adminClient
                .from("attendance_sessions")
                .select("*")
                .eq("id", req.params.id)
                .eq("teacher_id", req.user.id)
                .maybeSingle();

            if (error) {
                return res.status(500).json({
                    success: false,
                    message: "Could not retrieve session.",
                });
            }

            if (!session) {
                return res.status(404).json({
                    success: false,
                    message: "Attendance session not found.",
                });
            }

            if (
                session.status !== "active" ||
                new Date(session.expires_at) <= new Date()
            ) {
                return res.status(410).json({
                    success: false,
                    message: "Attendance session has expired or is closed.",
                });
            }

            const qrCode = await generateSessionQR(session.id);

            return res.status(200).json({
                success: true,
                session_id: session.id,
                expires_at: session.expires_at,
                qr_code: qrCode,
            });
        } catch (error) {
            console.error("QR generation failed:", error.message);

            return res.status(500).json({
                success: false,
                message: "Could not generate QR code.",
            });
        }
    }
);

router.post(
    "/mark",
    authenticateUser,
    requireRole("student"),
    async (req, res) => {
        try {
            const { session_id, student_lat, student_lng } = req.body;

            // Validate session ID and student coordinates.
            const uuidPattern =
                /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

            if (
                typeof session_id !== "string" ||
                !uuidPattern.test(session_id) ||
                typeof student_lat !== "number" ||
                !Number.isFinite(student_lat) ||
                typeof student_lng !== "number" ||
                !Number.isFinite(student_lng) ||
                student_lat < -90 ||
                student_lat > 90 ||
                student_lng < -180 ||
                student_lng > 180
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Invalid session ID or location coordinates.",
                });
            }

            // Retrieve the attendance session.
            const { data: session, error: sessionError } =
                await adminClient
                    .from("attendance_sessions")
                    .select(
                        "id, subject_id, classroom_lat, classroom_lng, radius_meters, expires_at, status"
                    )
                    .eq("id", session_id)
                    .maybeSingle();

            if (sessionError) {
                console.error(
                    "Session lookup failed:",
                    sessionError.message
                );

                return res.status(500).json({
                    success: false,
                    message: "Could not verify attendance session.",
                });
            }

            if (!session) {
                return res.status(404).json({
                    success: false,
                    message: "Attendance session not found.",
                });
            }

            if (
                session.status !== "active" ||
                new Date(session.expires_at).getTime() <= Date.now()
            ) {
                return res.status(410).json({
                    success: false,
                    message: "Attendance session has expired or is closed.",
                });
            }

            // Verify that this student is enrolled in the subject.
            const { data: enrollment, error: enrollmentError } =
                await adminClient
                    .from("enrollments")
                    .select("subject_id")
                    .eq("subject_id", session.subject_id)
                    .eq("student_id", req.user.id)
                    .maybeSingle();

            if (enrollmentError) {
                console.error(
                    "Enrollment lookup failed:",
                    enrollmentError.message
                );

                return res.status(500).json({
                    success: false,
                    message: "Could not verify subject enrollment.",
                });
            }

            if (!enrollment) {
                return res.status(403).json({
                    success: false,
                    message: "You are not enrolled in this subject.",
                });
            }

            // Calculate the distance from the classroom.
            const distance = calculateDistanceMeters(
                session.classroom_lat,
                session.classroom_lng,
                student_lat,
                student_lng
            );

            if (distance > session.radius_meters) {
                return res.status(403).json({
                    success: false,
                    message: "You are outside the permitted attendance area.",
                    distance_meters: Math.round(distance),
                    allowed_radius_meters: session.radius_meters,
                });
            }

            // Record attendance. The database unique constraint prevents
            // multiple records for the same student and session.
            const { data: record, error: insertError } =
                await adminClient
                    .from("attendance_records")
                    .insert({
                        session_id: session.id,
                        student_id: req.user.id,
                        student_lat,
                        student_lng,
                    })
                    .select("id, session_id, student_id, marked_at")
                    .single();

            if (insertError) {
                if (insertError.code === "23505") {
                    return res.status(409).json({
                        success: false,
                        message:
                            "Attendance has already been marked for this session.",
                    });
                }

                console.error(
                    "Attendance insertion failed:",
                    insertError.message
                );

                return res.status(500).json({
                    success: false,
                    message: "Could not record attendance.",
                });
            }

            return res.status(201).json({
                success: true,
                message: "Attendance marked successfully.",
                attendance: record,
                distance_meters: Math.round(distance),
            });
        } catch (error) {
            console.error("Attendance marking error:", error.message);

            return res.status(500).json({
                success: false,
                message: "Internal server error.",
            });
        }
    }
);

// Teacher manually closes an attendance session.
router.patch(
    "/sessions/:id/close",
    authenticateUser,
    requireRole("teacher"),
    async (req, res) => {
        try {
            const { id } = req.params;

            // Verify that the session belongs to this teacher.
            const { data: session, error: lookupError } =
                await adminClient
                    .from("attendance_sessions")
                    .select("id, status, expires_at")
                    .eq("id", id)
                    .eq("teacher_id", req.user.id)
                    .maybeSingle();

            if (lookupError) {
                console.error("Session lookup failed:", lookupError.message);

                return res.status(500).json({
                    success: false,
                    message: "Could not retrieve attendance session.",
                });
            }

            if (!session) {
                return res.status(404).json({
                    success: false,
                    message: "Attendance session not found.",
                });
            }

            if (session.status === "closed") {
                return res.status(409).json({
                    success: false,
                    message: "Attendance session is already closed.",
                });
            }

            if (new Date(session.expires_at).getTime() <= Date.now()) {
                return res.status(410).json({
                    success: false,
                    message: "Attendance session has already expired.",
                });
            }

            // Close the active session.
            const { data: updatedSession, error: updateError } =
                await adminClient
                    .from("attendance_sessions")
                    .update({ status: "closed" })
                    .eq("id", id)
                    .eq("teacher_id", req.user.id)
                    .eq("status", "active")
                    .select("id, status, expires_at")
                    .single();

            if (updateError) {
                console.error("Session closing failed:", updateError.message);

                return res.status(500).json({
                    success: false,
                    message: "Could not close attendance session.",
                });
            }

            return res.status(200).json({
                success: true,
                message: "Attendance session closed successfully.",
                session: updatedSession,
            });
        } catch (error) {
            console.error("Session closing error:", error.message);

            return res.status(500).json({
                success: false,
                message: "Internal server error.",
            });
        }
    }
);

export default router;
