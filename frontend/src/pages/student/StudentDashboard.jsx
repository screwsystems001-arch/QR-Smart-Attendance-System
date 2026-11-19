import "./StudentDashboard.css";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { BookOpen, CalendarCheck, LogOut, ScanQrCode } from "lucide-react";

import { useAuth } from "../../context/AuthContext";
import { logoutUser } from "../../services/authService";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function StudentDashboard() {
    const { user, profile } = useAuth();
    const navigate = useNavigate();

    const [subjects, setSubjects] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        async function fetchSubjects() {
            try {
                const { data: { session }, error: sessionError } =
                    await import("../../services/supabase").then(
                        ({ supabase }) => supabase.auth.getSession()
                    );

                if (sessionError) throw sessionError;
                if (!session) throw new Error("Please sign in again.");

                const response = await fetch(`${API_BASE_URL}/subjects`, {
                    headers: {
                        Authorization: `Bearer ${session.access_token}`,
                    },
                });

                const result = await response.json();

                if (!response.ok || !result.success) {
                    throw new Error(result.message || "Unable to load subjects.");
                }

                setSubjects(result.subjects || []);
            } catch (err) {
                setError(err.message || "Something went wrong.");
            } finally {
                setLoading(false);
            }
        }

        fetchSubjects();
    }, []);

    async function handleLogout() {
        try {
            await logoutUser();
            navigate("/login");
        } catch (err) {
            setError(err.message);
        }
    }

    return (
        <div className="student-dashboard">
            <header className="dashboard-header">
                <div>
                    <h2>QR Attendance</h2>
                    <span>Student Portal</span>
                </div>

                <button className="logout-button" onClick={handleLogout}>
                    <LogOut size={17} />
                    Logout
                </button>
            </header>

            <main className="dashboard-content">
                <section className="welcome-section">
                    <h1>Hello, {profile?.full_name || user?.email}!</h1>
                    <p>Welcome to your student dashboard.</p>
                </section>

                <section className="dashboard-stats">
                    <article className="stat-card">
                        <BookOpen size={25} />
                        <p>Enrolled Subjects</p>
                        <h2>{loading ? "..." : subjects.length}</h2>
                    </article>

                    <article className="stat-card">
                        <CalendarCheck size={25} />
                        <p>Attendance Overview</p>
                        <h2>--</h2>
                        <small>Coming soon</small>
                    </article>
                </section>

                <section className="subjects-section">
                    <div className="section-heading">
                        <h2>My Subjects</h2>
                        <span>{subjects.length} enrolled</span>
                    </div>

                    {loading && <p>Loading your subjects...</p>}

                    {error && <p className="dashboard-error">{error}</p>}

                    {!loading && !error && subjects.length === 0 && (
                        <p>You are not enrolled in any subjects yet.</p>
                    )}

                    <div className="subjects-grid">
                        {subjects.map((subject) => (
                            <article className="subject-card" key={subject.id}>
                                <div className="subject-icon">
                                    <BookOpen size={24} />
                                </div>

                                <h3>{subject.name}</h3>
                                <p>Subject Code: {subject.subject_code}</p>
                            </article>
                        ))}
                    </div>
                </section>

                <section className="quick-actions">
                    <h2>Quick Actions</h2>

                    <button
                        className="scan-button"
                        onClick={() => navigate("/student/scan")}
                    >
                        <ScanQrCode size={20} />
                        Scan Attendance QR
                    </button>
                    <button
                        className="scan-button"
                        onClick={() => navigate("/student/history")}
                    >
                        <CalendarCheck size={20} />
                        View Attendance History
                    </button>
                </section>
            </main>
        </div>
    );
}
