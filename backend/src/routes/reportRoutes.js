
import { Router } from "express";
import { adminClient } from "../config/supabase.js";
import {
    authenticateUser,
    requireRole,
} from "../middleware/authMiddleware.js";

const router = Router();

// Teacher views attendance records for a subject.
router.get(
    "/subject/:subjectId",
    authenticateUser,
    requireRole("teacher"),
    async (req, res) => {
        try {
            const { subjectId } = req.params;

            // Verify that the subject belongs to this teacher.
            const { data: subject, error: subjectError } =
                await adminClient
                    .from("subjects")
                    .select("id, name, subject_code, teacher_id")
                    .eq("id", subjectId)
                    .eq("teacher_id", req.user.id)
                    .maybeSingle();

            if (subjectError) {
                console.error("Subject lookup failed:", subjectError.message);

                return res.status(500).json({
                    success: false,
                    message: "Could not verify subject.",
                });
            }

            if (!subject) {
                return res.status(404).json({
                    success: false,
                    message: "Subject not found or access denied.",
                });
            }

            // Retrieve attendance sessions for this subject.
            const { data: sessions, error: sessionError } =
                await adminClient
                    .from("attendance_sessions")
                    .select("id, created_at, expires_at, status")
                    .eq("subject_id", subjectId)
                    .order("created_at", { ascending: false });

            if (sessionError) {
                console.error("Session lookup failed:", sessionError.message);

                return res.status(500).json({
                    success: false,
                    message: "Could not retrieve attendance sessions.",
                });
            }

            const sessionIds = sessions.map((session) => session.id);

            let attendanceRecords = [];

            // Retrieve attendance records for these sessions.
            if (sessionIds.length > 0) {
                const { data: records, error: recordsError } =
                    await adminClient
                        .from("attendance_records")
                        .select(`
                            id,
                            session_id,
                            student_id,
                            student_lat,
                            student_lng,
                            marked_at
                        `)
                        .in("session_id", sessionIds)
                        .order("marked_at", { ascending: false });

                if (recordsError) {
                    console.error(
                        "Attendance lookup failed:",
                        recordsError.message
                    );

                    return res.status(500).json({
                        success: false,
                        message: "Could not retrieve attendance records.",
                    });
                }

                attendanceRecords = records;
            }

            // Retrieve student profiles.
            const studentIds = [
                ...new Set(
                    attendanceRecords.map((record) => record.student_id)
                ),
            ];

            let students = [];

            if (studentIds.length > 0) {
                const { data: profiles, error: profileError } =
                    await adminClient
                        .from("profiles")
                        .select("user_id, full_name")
                        .in("user_id", studentIds);

                if (profileError) {
                    console.error(
                        "Student lookup failed:",
                        profileError.message
                    );

                    return res.status(500).json({
                        success: false,
                        message: "Could not retrieve student details.",
                    });
                }

                students = profiles;
            }

            const studentMap = new Map(
                students.map((student) => [student.user_id, student.full_name])
            );

            const report = attendanceRecords.map((record) => ({
                ...record,
                student_name:
                    studentMap.get(record.student_id) || "Unknown Student",
            }));

            return res.status(200).json({
                success: true,
                subject: {
                    id: subject.id,
                    name: subject.name,
                    subject_code: subject.subject_code,
                },
                total_sessions: sessions.length,
                total_attendance_records: report.length,
                attendance: report,
            });
        } catch (error) {
            console.error("Attendance report error:", error.message);

            return res.status(500).json({
                success: false,
                message: "Internal server error.",
            });
        }
    }
);

// Teacher views student-wise attendance summary for a subject.
router.get(
    "/subject/:subjectId/summary",
    authenticateUser,
    requireRole("teacher"),
    async (req, res) => {
        try {
            const { subjectId } = req.params;

            // Verify subject ownership.
            const { data: subject, error: subjectError } =
                await adminClient
                    .from("subjects")
                    .select("id, name, subject_code")
                    .eq("id", subjectId)
                    .eq("teacher_id", req.user.id)
                    .maybeSingle();

            if (subjectError) {
                console.error("Subject verification failed:", subjectError.message);

                return res.status(500).json({
                    success: false,
                    message: "Could not verify subject.",
                });
            }

            if (!subject) {
                return res.status(404).json({
                    success: false,
                    message: "Subject not found or access denied.",
                });
            }

            // Get all enrolled students.
            const { data: enrollments, error: enrollmentError } =
                await adminClient
                    .from("enrollments")
                    .select("student_id")
                    .eq("subject_id", subjectId);

            if (enrollmentError) {
                console.error("Enrollment lookup failed:", enrollmentError.message);

                return res.status(500).json({
                    success: false,
                    message: "Could not retrieve enrolled students.",
                });
            }

            // Get sessions that have expired or have been closed.
            const now = new Date().toISOString();

            const { data: sessions, error: sessionError } =
                await adminClient
                    .from("attendance_sessions")
                    .select("id")
                    .eq("subject_id", subjectId)
                    .or(`status.eq.closed,expires_at.lte.${now}`);

            if (sessionError) {
                console.error("Session lookup failed:", sessionError.message);

                return res.status(500).json({
                    success: false,
                    message: "Could not retrieve completed sessions.",
                });
            }

            const sessionIds = sessions.map((session) => session.id);

            // Get attendance records from completed sessions.
            let records = [];

            if (sessionIds.length > 0) {
                const { data, error: recordError } =
                    await adminClient
                        .from("attendance_records")
                        .select("student_id, session_id")
                        .in("session_id", sessionIds);

                if (recordError) {
                    console.error("Attendance lookup failed:", recordError.message);

                    return res.status(500).json({
                        success: false,
                        message: "Could not retrieve attendance records.",
                    });
                }

                records = data;
            }

            // Get enrolled student profiles.
            const studentIds = enrollments.map(
                (enrollment) => enrollment.student_id
            );

            let profiles = [];

            if (studentIds.length > 0) {
                const { data, error: profileError } =
                    await adminClient
                        .from("profiles")
                        .select("user_id, full_name")
                        .in("user_id", studentIds);

                if (profileError) {
                    console.error("Profile lookup failed:", profileError.message);

                    return res.status(500).json({
                        success: false,
                        message: "Could not retrieve student profiles.",
                    });
                }

                profiles = data;
            }

            // Calculate student-wise attendance.
            const summary = profiles.map((student) => {
                const present = records.filter(
                    (record) => record.student_id === student.user_id
                ).length;

                const totalSessions = sessionIds.length;
                const absent = totalSessions - present;

                const percentage =
                    totalSessions > 0
                        ? Number(((present / totalSessions) * 100).toFixed(2))
                        : 0;

                return {
                    student_id: student.user_id,
                    student_name: student.full_name,
                    total_sessions: totalSessions,
                    present,
                    absent,
                    attendance_percentage: percentage,
                };
            });

            return res.status(200).json({
                success: true,
                subject: {
                    id: subject.id,
                    name: subject.name,
                    subject_code: subject.subject_code,
                },
                total_completed_sessions: sessionIds.length,
                total_enrolled_students: summary.length,
                summary,
            });
        } catch (error) {
            console.error("Attendance summary error:", error.message);

            return res.status(500).json({
                success: false,
                message: "Internal server error.",
            });
        }
    }
);


export default router;
// Student views their own attendance history.
router.get(
    "/student/history",
    authenticateUser,
    requireRole("student"),
    async (req, res) => {
        try {
            const studentId = req.user.id;
            const now = new Date().toISOString();

            // Get subjects in which the student is enrolled.
            const { data: enrollments, error: enrollmentError } =
                await adminClient
                    .from("enrollments")
                    .select("subject_id")
                    .eq("student_id", studentId);

            if (enrollmentError) throw enrollmentError;

            const subjectIds = enrollments.map(
                (enrollment) => enrollment.subject_id
            );

            if (subjectIds.length === 0) {
                return res.status(200).json({
                    success: true,
                    subjects: [],
                    history: []
                });
            }

            // Fetch enrolled subjects.
            const { data: subjects, error: subjectError } =
                await adminClient
                    .from("subjects")
                    .select("id, name, subject_code")
                    .in("id", subjectIds);

            if (subjectError) throw subjectError;

            // Fetch completed or expired attendance sessions.
            const { data: sessions, error: sessionError } =
                await adminClient
                    .from("attendance_sessions")
                    .select("id, subject_id, created_at, expires_at, status")
                    .in("subject_id", subjectIds)
                    .or(`status.eq.closed,expires_at.lte.${now}`)
                    .order("created_at", { ascending: false });

            if (sessionError) throw sessionError;

            const sessionIds = sessions.map((session) => session.id);

            // Fetch only this student's attendance records.
            let records = [];

            if (sessionIds.length > 0) {
                const { data, error: recordError } =
                    await adminClient
                        .from("attendance_records")
                        .select("id, session_id, marked_at")
                        .eq("student_id", studentId)
                        .in("session_id", sessionIds);

                if (recordError) throw recordError;

                records = data;
            }

            const recordMap = new Map(
                records.map((record) => [record.session_id, record])
            );

            // Calculate subject-wise attendance.
            const subjectSummary = subjects.map((subject) => {
                const subjectSessions = sessions.filter(
                    (session) => session.subject_id === subject.id
                );

                const present = subjectSessions.filter(
                    (session) => recordMap.has(session.id)
                ).length;

                const totalSessions = subjectSessions.length;
                const absent = totalSessions - present;

                const percentage = totalSessions > 0
                    ? Number(((present / totalSessions) * 100).toFixed(2))
                    : 0;

                return {
                    ...subject,
                    total_sessions: totalSessions,
                    present,
                    absent,
                    attendance_percentage: percentage
                };
            });

            // Build individual session history.
            const subjectMap = new Map(
                subjects.map((subject) => [subject.id, subject])
            );

            const history = sessions.map((session) => {
                const record = recordMap.get(session.id);
                const subject = subjectMap.get(session.subject_id);

                return {
                    session_id: session.id,
                    subject_name: subject?.name || "Unknown Subject",
                    subject_code: subject?.subject_code || "",
                    attendance_date: record?.marked_at || session.created_at,
                    status: record ? "Present" : "Absent"
                };
            });

            return res.status(200).json({
                success: true,
                total_subjects: subjects.length,
                subjects: subjectSummary,
                history
            });

        } catch (error) {
            console.error("Student attendance history error:", error.message);

            return res.status(500).json({
                success: false,
                message: "Unable to retrieve attendance history."
            });
        }
    }
);

