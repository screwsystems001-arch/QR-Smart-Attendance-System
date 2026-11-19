
import { Router } from "express";
import { adminClient } from "../config/supabase.js";
import {
    authenticateUser,
    requireRole,
} from "../middleware/authMiddleware.js";

const router = Router();

// Create a subject — teachers only
router.post(
    "/",
    authenticateUser,
    requireRole("teacher"),
    async (req, res) => {
        try {
            const { name, subject_code } = req.body;

            if (
                typeof name !== "string" ||
                !name.trim() ||
                typeof subject_code !== "string" ||
                !subject_code.trim()
            ) {
                return res.status(400).json({
                    success: false,
                    message: "Subject name and subject code are required.",
                });
            }

            const { data, error } = await adminClient
                .from("subjects")
                .insert({
                    name: name.trim(),
                    subject_code: subject_code.trim().toUpperCase(),
                    teacher_id: req.user.id,
                })
                .select()
                .single();

            if (error) {
                if (error.code === "23505") {
                    return res.status(409).json({
                        success: false,
                        message: "This subject code already exists.",
                    });
                }

                console.error("Subject creation failed:", error.message);

                return res.status(500).json({
                    success: false,
                    message: "Could not create subject.",
                });
            }

            return res.status(201).json({
                success: true,
                subject: data,
            });
        } catch (error) {
            console.error("Subject route error:", error.message);

            return res.status(500).json({
                success: false,
                message: "Internal server error.",
            });
        }
    }
);

// List subjects visible to the current user
router.get("/", authenticateUser, async (req, res) => {
    try {
        let query = adminClient
            .from("subjects")
            .select("id, name, subject_code, teacher_id, created_at");

        if (req.user.role === "teacher") {
            query = query.eq("teacher_id", req.user.id);
        } else {
            const { data: enrollments, error: enrollmentError } =
                await adminClient
                    .from("enrollments")
                    .select("subject_id")
                    .eq("student_id", req.user.id);

            if (enrollmentError) {
                return res.status(500).json({
                    success: false,
                    message: "Could not retrieve enrollments.",
                });
            }

            const subjectIds = (enrollments ?? []).map(
                (enrollment) => enrollment.subject_id
            );

            if (subjectIds.length === 0) {
                return res.status(200).json({
                    success: true,
                    subjects: [],
                });
            }

            query = query.in("id", subjectIds);
        }

        const { data, error } = await query.order("name");

        if (error) {
            console.error("Subject lookup failed:", error.message);

            return res.status(500).json({
                success: false,
                message: "Could not retrieve subjects.",
            });
        }

        return res.status(200).json({
            success: true,
            subjects: data,
        });
    } catch (error) {
        console.error("Subject lookup error:", error.message);

        return res.status(500).json({
            success: false,
            message: "Internal server error.",
        });
    }
});

// Get dashboard statistics for the logged-in teacher.
router.get(
    "/stats",
    authenticateUser,
    requireRole("teacher"),
    async (req, res) => {
        try {
            const teacherId = req.user.id;

            // Get all subjects belonging to this teacher.
            const { data: subjects, error: subjectError } =
                await adminClient
                    .from("subjects")
                    .select("id")
                    .eq("teacher_id", teacherId);

            if (subjectError) {
                throw subjectError;
            }

            const subjectIds = (subjects || []).map(
                (subject) => subject.id
            );

            // Count attendance sessions created by this teacher.
            const {
                count: attendanceSessions,
                error: sessionError
            } = await adminClient
                .from("attendance_sessions")
                .select("id", { count: "exact", head: true })
                .eq("teacher_id", teacherId);

            if (sessionError) {
                throw sessionError;
            }

            // Count unique enrolled students across all teacher subjects.
            let enrolledStudents = 0;

            if (subjectIds.length > 0) {
                const { data: enrollments, error: enrollmentError } =
                    await adminClient
                        .from("enrollments")
                        .select("student_id")
                        .in("subject_id", subjectIds);

                if (enrollmentError) {
                    throw enrollmentError;
                }

                enrolledStudents = new Set(
                    (enrollments || []).map(
                        (enrollment) => enrollment.student_id
                    )
                ).size;
            }

            return res.status(200).json({
                success: true,
                stats: {
                    attendanceSessions: attendanceSessions ?? 0,
                    enrolledStudents
                }
            });

        } catch (error) {
            console.error("Dashboard statistics error:", error.message);

            return res.status(500).json({
                success: false,
                message: "Could not retrieve dashboard statistics."
            });
        }
    }
);

/**
 * Get all registered students and their enrollment status
 * for a subject. Only the subject's teacher can access this.
 */
router.get(
    "/:id/students",
    authenticateUser,
    requireRole("teacher"),
    async (req, res) => {
        try {
            const { id } = req.params;

            // Verify that this subject belongs to the teacher.
            const { data: subject, error: subjectError } = await adminClient
                .from("subjects")
                .select("id, teacher_id")
                .eq("id", id)
                .maybeSingle();

            if (subjectError) {
                return res.status(500).json({
                    success: false,
                    message: "Could not verify subject ownership.",
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
                    message: "You cannot access another teacher's subject.",
                });
            }

            // Fetch all registered student profiles.
            const { data: students, error: studentsError } = await adminClient
                .from("profiles")
                .select("user_id, full_name")
                .eq("role", "student")
                .order("full_name");

            if (studentsError) {
                return res.status(500).json({
                    success: false,
                    message: "Could not retrieve students.",
                });
            }

            // Fetch students already enrolled in this subject.
            const { data: enrollments, error: enrollmentError } =
                await adminClient
                    .from("enrollments")
                    .select("student_id")
                    .eq("subject_id", id);

            if (enrollmentError) {
                return res.status(500).json({
                    success: false,
                    message: "Could not retrieve enrollment records.",
                });
            }

            const enrolledStudentIds = new Set(
                (enrollments || []).map(
                    (enrollment) => enrollment.student_id
                )
            );

            const result = (students || []).map((student) => ({
                user_id: student.user_id,
                full_name: student.full_name,
                is_enrolled: enrolledStudentIds.has(student.user_id),
            }));

            return res.status(200).json({
                success: true,
                students: result,
            });

        } catch (error) {
            console.error("Student listing error:", error.message);

            return res.status(500).json({
                success: false,
                message: "Internal server error.",
            });
        }
    }
);

/**
 * Enroll a student in a subject.
 * Only the teacher who owns the subject can enroll students.
 */
router.post(
    "/:id/enrollments",
    authenticateUser,
    requireRole("teacher"),
    async (req, res) => {
        try {
            const { id } = req.params;
            const { student_id } = req.body;

            if (
                typeof student_id !== "string" ||
                !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(student_id)
            ) {
                return res.status(400).json({
                    success: false,
                    message: "A valid student_id is required.",
                });
            }

            // Confirm that the subject belongs to this teacher.
            const { data: subject, error: subjectError } = await adminClient
                .from("subjects")
                .select("id, teacher_id")
                .eq("id", id)
                .maybeSingle();

            if (subjectError) {
                return res.status(500).json({
                    success: false,
                    message: "Could not verify subject ownership.",
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
                    message: "You cannot enroll students in another teacher's subject.",
                });
            }

            // Confirm the target is an actual student.
            const { data: student, error: studentError } = await adminClient
                .from("profiles")
                .select("user_id, role")
                .eq("user_id", student_id)
                .maybeSingle();

            if (studentError) {
                return res.status(500).json({
                    success: false,
                    message: "Could not verify student.",
                });
            }

            if (!student || student.role !== "student") {
                return res.status(404).json({
                    success: false,
                    message: "Student not found.",
                });
            }

            const { data, error } = await adminClient
                .from("enrollments")
                .insert({
                    subject_id: subject.id,
                    student_id: student.user_id,
                })
                .select()
                .single();

            if (error) {
                if (error.code === "23505") {
                    return res.status(409).json({
                        success: false,
                        message: "Student is already enrolled in this subject.",
                    });
                }

                console.error("Enrollment failed:", error.message);

                return res.status(500).json({
                    success: false,
                    message: "Could not enroll student.",
                });
            }

            return res.status(201).json({
                success: true,
                enrollment: data,
            });
        } catch (error) {
            console.error("Enrollment route error:", error.message);

            return res.status(500).json({
                success: false,
                message: "Internal server error.",
            });
        }
    }
);

export default router;
