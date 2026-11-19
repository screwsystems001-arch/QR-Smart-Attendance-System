
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    BookOpen,
    CalendarCheck,
    FileText,
    LogOut,
    QrCode,
    Users,
    BarChart3,
    Plus,
    X
} from "lucide-react";

import { useAuth } from "../../context/AuthContext";
import { logoutUser } from "../../services/authService";
import { supabase } from "../../services/supabase";
import "./TeacherDashboard.css";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function TeacherDashboard() {
    const { profile } = useAuth();
    const navigate = useNavigate();

    const [subjects, setSubjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const [showSubjectForm, setShowSubjectForm] = useState(false);
    const [subjectName, setSubjectName] = useState("");
    const [subjectCode, setSubjectCode] = useState("");
    const [creatingSubject, setCreatingSubject] = useState(false);
    const [success, setSuccess] = useState("");
    const [enrollmentSubject, setEnrollmentSubject] = useState(null);
    const [students, setStudents] = useState([]);
    const [selectedStudents, setSelectedStudents] = useState([]);
    const [loadingStudents, setLoadingStudents] = useState(false);
    const [enrollingStudents, setEnrollingStudents] = useState(false);
    const [enrollmentMessage, setEnrollmentMessage] = useState("");
    const [enrollmentError, setEnrollmentError] = useState("");

    async function getAuthHeaders() {
        const {
            data: { session },
            error: sessionError
        } = await supabase.auth.getSession();

        if (sessionError) throw sessionError;
        if (!session) throw new Error("Please log in again.");

        return {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json"
        };
    }

    async function fetchSubjects() {
        try {
            setLoading(true);
            setError("");

            const headers = await getAuthHeaders();

            const response = await fetch(`${API_BASE_URL}/subjects`, {
                headers
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.message || "Unable to load subjects.");
            }

            setSubjects(result.subjects || []);
        } catch (err) {
            setError(err.message || "Unable to load subjects.");
        } finally {
            setLoading(false);
        }
    }
    const loadStudentsForSubject = async (subject) => {
        setLoadingStudents(true);

        try {
            const headers = await getAuthHeaders();

            const response = await fetch(
                `${API_BASE_URL}/subjects/${subject.id}/students`,
                { headers }
            );

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.message || "Failed to load students.");
            }

            setStudents(result.students || []);
            return true;
        } catch (err) {
            setEnrollmentError(err.message);
            return false;
        } finally {
            setLoadingStudents(false);
        }
    };

    const openEnrollment = async (subject) => {
        setEnrollmentSubject(subject);
        setStudents([]);
        setSelectedStudents([]);
        setEnrollmentMessage("");
        setEnrollmentError("");

        await loadStudentsForSubject(subject);
    };

    const toggleStudentSelection = (studentId, checked) => {
        setSelectedStudents((previous) =>
            checked
                ? [...previous, studentId]
                : previous.filter((id) => id !== studentId)
        );
    };

    const handleEnrollSelected = async () => {
        if (!enrollmentSubject || selectedStudents.length === 0) {
            return;
        }

        setEnrollingStudents(true);
        setEnrollmentMessage("");
        setEnrollmentError("");

        try {
            const headers = await getAuthHeaders();

            let enrolledCount = 0;
            const failures = [];

            for (const studentId of selectedStudents) {
                try {
                    const response = await fetch(
                        `${API_BASE_URL}/subjects/${enrollmentSubject.id}/enrollments`,
                        {
                            method: "POST",
                            headers,
                            body: JSON.stringify({ student_id: studentId }),
                        }
                    );

                    const result = await response.json();

                    if (response.ok && result.success) {
                        enrolledCount++;
                    } else {
                        failures.push(result.message || "Enrollment failed.");
                    }
                } catch {
                    failures.push("A student could not be enrolled due to a network error.");
                }
            }

            setSelectedStudents([]);

            await loadStudentsForSubject(enrollmentSubject);

            if (enrolledCount > 0) {
                setEnrollmentMessage(
                    `${enrolledCount} student(s) enrolled successfully.`
                );
            }

            if (failures.length > 0) {
                setEnrollmentError(failures.join(" "));
            }
        } catch (err) {
            setEnrollmentError(err.message);
        } finally {
            setEnrollingStudents(false);
        }
    };

    useEffect(() => {
        fetchSubjects();
    }, []);

    async function handleAddSubject(e) {
        e.preventDefault();

        if (!subjectName.trim() || !subjectCode.trim()) {
            setError("Please enter both subject name and subject code.");
            return;
        }

        try {
            setCreatingSubject(true);
            setError("");
            setSuccess("");

            const headers = await getAuthHeaders();

            const response = await fetch(`${API_BASE_URL}/subjects`, {
                method: "POST",
                headers,
                body: JSON.stringify({
                    name: subjectName.trim(),
                    subject_code: subjectCode.trim().toUpperCase()
                })
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.message || "Unable to create subject.");
            }

            setSuccess("Subject created successfully!");
            setSubjectName("");
            setSubjectCode("");
            setShowSubjectForm(false);

            await fetchSubjects();
        } catch (err) {
            setError(err.message || "Unable to create subject.");
        } finally {
            setCreatingSubject(false);
        }
    }

    async function handleLogout() {
        try {
            await logoutUser();
            navigate("/login");
        } catch (err) {
            setError(err.message || "Logout failed.");
        }
    }

    return (
        <main className="teacher-dashboard">
            <header className="teacher-header">
                <div>
                    <h1>Teacher Dashboard</h1>
                    <p>Welcome, {profile?.full_name || "Teacher"}</p>
                </div>

                <button className="teacher-logout" onClick={handleLogout}>
                    <LogOut size={18} />
                    Logout
                </button>
            </header>

            <section className="teacher-welcome">
                <div>
                    <h2>Manage Your Classes</h2>
                    <p>
                        Create attendance sessions, generate QR codes
                        and monitor student attendance.
                    </p>
                </div>
                <BookOpen size={54} />
            </section>

            <section className="teacher-stats">
                <div className="teacher-stat-card">
                    <BookOpen size={25} />
                    <h3>{subjects.length}</h3>
                    <p>Total Subjects</p>
                </div>

                <div className="teacher-stat-card">
                    <CalendarCheck size={25} />
                    <h3>--</h3>
                    <p>Attendance Sessions</p>
                </div>

                <div className="teacher-stat-card">
                    <Users size={25} />
                    <h3>--</h3>
                    <p>Enrolled Students</p>
                </div>
            </section>

            <section className="teacher-subject-section">
                <div className="teacher-section-heading">
                    <div>
                        <h2>Your Subjects</h2>
                        <p>Subjects assigned to your account</p>
                    </div>

                    <button
                        className="add-subject-button"
                        onClick={() => {
                            setError("");
                            setSuccess("");
                            setShowSubjectForm(!showSubjectForm);
                        }}
                    >
                        {showSubjectForm ? <X size={18} /> : <Plus size={18} />}
                        {showSubjectForm ? "Cancel" : "Add New Subject"}
                    </button>
                </div>

                {showSubjectForm && (
                    <form
                        className="add-subject-form"
                        onSubmit={handleAddSubject}
                    >
                        <h3>Create New Subject</h3>

                        <div className="subject-form-fields">
                            <input
                                type="text"
                                placeholder="Subject Name (e.g. Computer Networks)"
                                value={subjectName}
                                onChange={(e) => setSubjectName(e.target.value)}
                                required
                            />

                            <input
                                type="text"
                                placeholder="Subject Code (e.g. CN101)"
                                value={subjectCode}
                                onChange={(e) => setSubjectCode(e.target.value)}
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            className="save-subject-button"
                            disabled={creatingSubject}
                        >
                            {creatingSubject ? "Creating..." : "Save Subject"}
                        </button>
                    </form>
                )}

                {success && (
                    <p className="subject-success">{success}</p>
                )}

                {error && (
                    <p className="teacher-error">{error}</p>
                )}

                {loading && <p>Loading subjects...</p>}

                {!loading && !error && subjects.length === 0 && (
                    <p>No subjects found. Add your first subject.</p>
                )}

                <div className="teacher-subject-grid">
                    {subjects.map((subject) => (
                        <article className="teacher-subject-card" key={subject.id}>
                            <div className="teacher-subject-icon">
                                <BookOpen size={25} />
                            </div>

                            <h3>{subject.name}</h3>
                            <p>Subject Code: {subject.subject_code}</p>
                            <button
                                className="enroll-students-button"
                                onClick={() => openEnrollment(subject)}
                            >
                                <Users size={17} />
                                Enroll Students
                            </button>
                            <button
                                onClick={() =>
                                    navigate("/teacher/create-session", {
                                        state: { subjectId: subject.id }
                                    })
                                }
                            >
                                <QrCode size={17} />
                                Create Attendance Session
                            </button>

                            <button
                                className="view-reports-button"
                                onClick={() =>
                                    navigate(`/teacher/reports/${subject.id}`)
                                }
                            >
                                <FileText size={17} />
                                View Attendance Reports
                            </button>

                            <button
                                className="view-analytics-button"
                                onClick={() =>
                                    navigate(`/teacher/analytics/${subject.id}`)
                                }
                            >
                                <BarChart3 size={17} />
                                Student Performance Analytics
                            </button>
                        </article>
                    ))}
                </div>
            </section>
            {enrollmentSubject && (
                <div className="enrollment-modal-overlay">
                    <div className="enrollment-modal">
                        <div className="enrollment-modal-header">
                            <div>
                                <h2>Enroll Students</h2>
                                <p>{enrollmentSubject.name}</p>
                            </div>

                            <button
                                className="enrollment-close-button"
                                onClick={() => setEnrollmentSubject(null)}
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <p className="enrollment-description">
                            Select registered students to enroll in this subject.
                        </p>

                        {enrollmentMessage && (
                            <div className="success-message">
                                {enrollmentMessage}
                            </div>
                        )}

                        {enrollmentError && (
                            <div className="error-message">
                                {enrollmentError}
                            </div>
                        )}

                        {loadingStudents ? (
                            <p className="enrollment-loading">Loading students...</p>
                        ) : students.length === 0 ? (
                            <p className="enrollment-empty">
                                No registered students found.
                            </p>
                        ) : (
                            <div className="enrollment-student-list">
                                {students.map((student) => (
                                    <label
                                        className="enrollment-student-item"
                                        key={student.user_id}
                                    >
                                        <div className="enrollment-student-info">
                                            <input
                                                type="checkbox"
                                                checked={student.is_enrolled ||
                                                    selectedStudents.includes(student.user_id)}
                                                disabled={student.is_enrolled}
                                                onChange={(e) =>
                                                    toggleStudentSelection(
                                                        student.user_id,
                                                        e.target.checked
                                                    )
                                                }
                                            />

                                            <span>{student.full_name || "Unnamed Student"}</span>
                                        </div>

                                        {student.is_enrolled && (
                                            <span className="enrolled-status">
                                                Already Enrolled
                                            </span>
                                        )}
                                    </label>
                                ))}
                            </div>
                        )}

                        <div className="enrollment-modal-footer">
                            <button
                                className="enrollment-cancel-button"
                                onClick={() => setEnrollmentSubject(null)}
                            >
                                Close
                            </button>

                            <button
                                className="enrollment-submit-button"
                                onClick={handleEnrollSelected}
                                disabled={
                                    loadingStudents ||
                                    enrollingStudents ||
                                    selectedStudents.length === 0
                                }
                            >
                                {enrollingStudents
                                    ? "Enrolling..."
                                    : `Enroll Selected (${selectedStudents.length})`}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </main>
    );
}
