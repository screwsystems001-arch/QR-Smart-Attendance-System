import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
    ArrowLeft,
    Trophy,
    AlertTriangle,
    Users,
    Percent,
    RefreshCw
} from "lucide-react";

import { supabase } from "../../services/supabase";
import "./StudentAnalytics.css";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function StudentAnalytics() {
    const { subjectId } = useParams();
    const navigate = useNavigate();

    const [summary, setSummary] = useState([]);
    const [subject, setSubject] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    async function fetchAnalytics() {
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
                `${API_BASE_URL}/reports/subject/${subjectId}/summary`,
                {
                    headers: {
                        Authorization: `Bearer ${session.access_token}`
                    }
                }
            );

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(
                    result.message || "Unable to load analytics."
                );
            }

            setSubject(result.subject);
            setSummary(result.summary || []);
        } catch (err) {
            setError(err.message || "Unable to load analytics.");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        fetchAnalytics();
    }, [subjectId]);

    const sortedStudents = [...summary].sort(
        (a, b) => b.attendance_percentage - a.attendance_percentage
    );

    const topPerformers = sortedStudents
        .filter((student) => student.present > 0)
        .slice(0, 5);

    const lowAttendance = sortedStudents.filter(
        (student) => student.attendance_percentage < 75
    );

    const totalStudents = summary.length;

    const averageAttendance = totalStudents > 0
        ? Number((
            summary.reduce(
                (total, student) =>
                    total + student.attendance_percentage,
                0
            ) / totalStudents
        ).toFixed(2))
        : 0;

    const safeStudents = summary.filter(
        (student) => student.attendance_percentage >= 75
    ).length;

    const lowStudents = lowAttendance.length;

    if (loading) {
        return (
            <main className="analytics-page">
                <p>Loading student analytics...</p>
            </main>
        );
    }

    return (
        <main className="analytics-page">
            <header className="analytics-header">
                <button
                    className="analytics-back-button"
                    onClick={() => navigate("/teacher")}
                >
                    <ArrowLeft size={18} />
                    Back to Dashboard
                </button>

                <button
                    className="analytics-refresh-button"
                    onClick={fetchAnalytics}
                >
                    <RefreshCw size={17} />
                    Refresh
                </button>
            </header>

            <section className="analytics-title">
                <h1>Student Performance Analytics</h1>
                <p>
                    {subject?.name} ({subject?.subject_code})
                </p>
            </section>

            {error && (
                <div className="analytics-error">{error}</div>
            )}

            {!error && (
                <>
                    <section className="analytics-stats">
                        <article className="analytics-stat-card">
                            <Users size={25} />
                            <h2>{totalStudents}</h2>
                            <p>Total Students</p>
                        </article>

                        <article className="analytics-stat-card">
                            <Percent size={25} />
                            <h2>{averageAttendance}%</h2>
                            <p>Average Attendance</p>
                        </article>

                        <article className="analytics-stat-card">
                            <Trophy size={25} />
                            <h2>{safeStudents}</h2>
                            <p>Students at or above 75%</p>
                        </article>

                        <article className="analytics-stat-card">
                            <AlertTriangle size={25} />
                            <h2>{lowStudents}</h2>
                            <p>Students below 75%</p>
                        </article>
                    </section>

                    <section className="analytics-section">
                        <h2>
                            <Trophy size={21} />
                            Top Performing Students
                        </h2>

                        {topPerformers.length === 0 ? (
                            <p>No attendance data available yet.</p>
                        ) : (
                            <div className="analytics-table-wrapper">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Rank</th>
                                            <th>Student Name</th>
                                            <th>Present</th>
                                            <th>Attendance</th>
                                        </tr>
                                    </thead>

                                    <tbody>
                                        {topPerformers.map((student, index) => (
                                            <tr key={student.student_id}>
                                                <td>#{index + 1}</td>
                                                <td>{student.student_name}</td>
                                                <td>{student.present}</td>
                                                <td className="analytics-good">
                                                    {student.attendance_percentage}%
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </section>

                    <section className="analytics-section">
                        <h2>
                            <AlertTriangle size={21} />
                            Students Below 75%
                        </h2>

                        {lowAttendance.length === 0 ? (
                            <p>All students have attendance of at least 75%.</p>
                        ) : (
                            <div className="analytics-table-wrapper">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Student Name</th>
                                            <th>Present</th>
                                            <th>Absent</th>
                                            <th>Attendance</th>
                                        </tr>
                                    </thead>

                                    <tbody>
                                        {lowAttendance.map((student) => (
                                            <tr key={student.student_id}>
                                                <td>{student.student_name}</td>
                                                <td>{student.present}</td>
                                                <td>{student.absent}</td>
                                                <td className="analytics-low">
                                                    {student.attendance_percentage}%
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </section>

                    <section className="analytics-section">
                        <h2>Attendance Distribution</h2>

                        <div className="distribution-item">
                            <div>
                                <span>75% and above</span>
                                <strong>{safeStudents} students</strong>
                            </div>

                            <div className="distribution-track">
                                <div
                                    className="distribution-safe"
                                    style={{
                                        width: `${totalStudents ? (safeStudents / totalStudents) * 100 : 0}%`
                                    }}
                                />
                            </div>
                        </div>

                        <div className="distribution-item">
                            <div>
                                <span>Below 75%</span>
                                <strong>{lowStudents} students</strong>
                            </div>

                            <div className="distribution-track">
                                <div
                                    className="distribution-low"
                                    style={{
                                        width: `${totalStudents ? (lowStudents / totalStudents) * 100 : 0}%`
                                    }}
                                />
                            </div>
                        </div>
                    </section>
                </>
            )}
        </main>
    );
}