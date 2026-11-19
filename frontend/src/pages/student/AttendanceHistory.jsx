import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
    ArrowLeft,
    BookOpen,
    CalendarCheck,
    CheckCircle,
    XCircle,
    RefreshCw,
    Percent
} from "lucide-react";

import { supabase } from "../../services/supabase";
import "./AttendanceHistory.css";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function AttendanceHistory() {
    const navigate = useNavigate();

    const [subjects, setSubjects] = useState([]);
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    async function fetchHistory() {
        try {
            setLoading(true);
            setError("");

            const {
                data: { session },
                error: sessionError
            } = await supabase.auth.getSession();

            if (sessionError) throw sessionError;
            if (!session) throw new Error("Please log in again.");

            const response = await fetch(
                `${API_BASE_URL}/reports/student/history`,
                {
                    headers: {
                        Authorization: `Bearer ${session.access_token}`
                    }
                }
            );

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(
                    result.message || "Unable to load attendance history."
                );
            }

            setSubjects(result.subjects || []);
            setHistory(result.history || []);
        } catch (err) {
            setError(err.message || "Unable to load attendance history.");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        fetchHistory();
    }, []);

    const totalSessions = subjects.reduce(
        (total, subject) => total + subject.total_sessions,
        0
    );

    const totalPresent = subjects.reduce(
        (total, subject) => total + subject.present,
        0
    );

    const totalAbsent = subjects.reduce(
        (total, subject) => total + subject.absent,
        0
    );

    const overallPercentage = totalSessions > 0
        ? Number(((totalPresent / totalSessions) * 100).toFixed(2))
        : 0;
    function getClassesNeeded(present, total) {
        if (total === 0) return null;

        const currentPercentage = (present / total) * 100;

        if (currentPercentage >= 75) return 0;

        return Math.ceil((75 * total - 100 * present) / 25);
    }

    if (loading) {
        return (
            <main className="attendance-history-page">
                <p>Loading attendance history...</p>
            </main>
        );
    }

    return (
        <main className="attendance-history-page">
            <header className="history-header">
                <button
                    className="history-back-button"
                    onClick={() => navigate("/student")}
                >
                    <ArrowLeft size={18} />
                    Back to Dashboard
                </button>

                <button
                    className="history-refresh-button"
                    onClick={fetchHistory}
                >
                    <RefreshCw size={17} />
                    Refresh
                </button>
            </header>

            <section className="history-title">
                <h1>My Attendance History</h1>
                <p>Track your attendance across all enrolled subjects.</p>
            </section>

            {error && (
                <div className="history-error">
                    {error}
                </div>
            )}

            {!error && (
                <>
                    <section className="history-stats">
                        <article className="history-stat-card">
                            <BookOpen size={25} />
                            <h2>{subjects.length}</h2>
                            <p>Enrolled Subjects</p>
                        </article>

                        <article className="history-stat-card">
                            <CalendarCheck size={25} />
                            <h2>{totalSessions}</h2>
                            <p>Total Sessions</p>
                        </article>

                        <article className="history-stat-card">
                            <CheckCircle size={25} />
                            <h2>{totalPresent}</h2>
                            <p>Present</p>
                        </article>

                        <article className="history-stat-card">
                            <XCircle size={25} />
                            <h2>{totalAbsent}</h2>
                            <p>Absent</p>
                        </article>

                        <article className="history-stat-card">
                            <Percent size={25} />
                            <h2>{overallPercentage}%</h2>
                            <p>Overall Attendance</p>
                        </article>
                    </section>

                    <section className="history-section">
                        <h2>Subject-wise Attendance</h2>

                        {subjects.length === 0 ? (
                            <p>You are not enrolled in any subjects yet.</p>
                        ) : (
                            <div className="history-subject-grid">
                                {subjects.map((subject) => (
                                    <article
                                        className={`history-subject-card ${subject.attendance_percentage >= 75
                                            ? "attendance-safe"
                                            : "attendance-low"
                                            }`}
                                        key={subject.id}
                                    >
                                        <h3>{subject.name}</h3>
                                        <p>{subject.subject_code}</p>

                                        <div className="history-progress">
                                            <div
                                                className={`history-progress-fill ${subject.attendance_percentage >= 75
                                                    ? "progress-safe"
                                                    : "progress-low"
                                                    }`}
                                                style={{
                                                    width: `${Math.min(subject.attendance_percentage, 100)}%`
                                                }}
                                            />
                                        </div>

                                        <strong className={
                                            subject.attendance_percentage >= 75
                                                ? "percentage-safe"
                                                : "percentage-low"
                                        }>
                                            {subject.attendance_percentage}%
                                        </strong>

                                        {subject.attendance_percentage < 75 && (
                                            <p className="attendance-warning">
                                                ⚠ Low attendance! Minimum required is 75%.
                                            </p>
                                        )}

                                        {subject.attendance_percentage >= 75 && (
                                            <p className="attendance-good">
                                                ✓ Attendance requirement achieved.
                                            </p>
                                        )}

                                        <div className="history-subject-details">
                                            <span>Total: {subject.total_sessions}</span>
                                            <span>Present: {subject.present}</span>
                                            <span>Absent: {subject.absent}</span>
                                        </div>
                                        {subject.attendance_percentage < 75 && (
                                            <div className="attendance-calculator">
                                                <strong>Attendance Recovery Plan</strong>

                                                <p>
                                                    Attend the next{" "}
                                                    <strong>
                                                        {getClassesNeeded(
                                                            subject.present,
                                                            subject.total_sessions
                                                        )}
                                                    </strong>{" "}
                                                    consecutive classes to reach 75%.
                                                </p>
                                            </div>
                                        )}

                                        {subject.attendance_percentage >= 75 && (
                                            <div className="attendance-calculator calculator-safe">
                                                <strong>✓ Attendance Target Achieved</strong>
                                                <p>Maintain your attendance above 75%.</p>
                                            </div>
                                        )}
                                    </article>
                                ))}
                            </div>
                        )}
                    </section>

                    <section className="history-section">
                        <h2>Individual Attendance Records</h2>

                        {history.length === 0 ? (
                            <p>No completed attendance sessions found.</p>
                        ) : (
                            <div className="history-table-wrapper">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Subject</th>
                                            <th>Subject Code</th>
                                            <th>Date</th>
                                            <th>Status</th>
                                        </tr>
                                    </thead>

                                    <tbody>
                                        {history.map((record) => (
                                            <tr key={record.session_id}>
                                                <td>{record.subject_name}</td>
                                                <td>{record.subject_code}</td>
                                                <td>
                                                    {new Date(
                                                        record.attendance_date
                                                    ).toLocaleString()}
                                                </td>
                                                <td>
                                                    <span
                                                        className={
                                                            record.status === "Present"
                                                                ? "history-present-badge"
                                                                : "history-absent-badge"
                                                        }
                                                    >
                                                        {record.status}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </section>
                </>
            )}
        </main>
    );
}