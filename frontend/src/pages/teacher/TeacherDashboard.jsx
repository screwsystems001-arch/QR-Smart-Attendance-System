
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
        </main>
    );
}
