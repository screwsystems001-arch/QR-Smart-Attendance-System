import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
    ArrowLeft,
    Users,
    UserCheck,
    UserX,
    Percent,
    RefreshCw,
    FileSpreadsheet,
    FileText
} from "lucide-react";

import * as XLSX from "xlsx";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import { supabase } from "../../services/supabase";
import "./AttendanceReports.css";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function AttendanceReports() {
    const { subjectId } = useParams();
    const navigate = useNavigate();

    const [report, setReport] = useState(null);
    const [summary, setSummary] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        async function fetchReports() {
            try {
                setLoading(true);
                setError("");

                const {
                    data: { session },
                    error: sessionError
                } = await supabase.auth.getSession();

                if (sessionError) throw sessionError;
                if (!session) throw new Error("Please log in again.");

                const headers = {
                    Authorization: `Bearer ${session.access_token}`
                };

                const [reportResponse, summaryResponse] = await Promise.all([
                    fetch(
                        `${API_BASE_URL}/reports/subject/${subjectId}`,
                        { headers }
                    ),
                    fetch(
                        `${API_BASE_URL}/reports/subject/${subjectId}/summary`,
                        { headers }
                    )
                ]);

                const [reportResult, summaryResult] = await Promise.all([
                    reportResponse.json(),
                    summaryResponse.json()
                ]);

                if (!reportResponse.ok || !reportResult.success) {
                    throw new Error(
                        reportResult.message || "Unable to load attendance report."
                    );
                }

                if (!summaryResponse.ok || !summaryResult.success) {
                    throw new Error(
                        summaryResult.message || "Unable to load attendance summary."
                    );
                }

                setReport(reportResult);
                setSummary(summaryResult.summary || []);
            } catch (err) {
                setError(err.message || "Unable to load reports.");
            } finally {
                setLoading(false);
            }
        }

        fetchReports();
    }, [subjectId]);

    if (loading) {
        return (
            <main className="attendance-reports-page">
                <p>Loading attendance reports...</p>
            </main>
        );
    }

    if (error) {
        return (
            <main className="attendance-reports-page">
                <button onClick={() => navigate("/teacher")}>
                    <ArrowLeft size={18} />
                    Back to Dashboard
                </button>
                <p className="reports-error">{error}</p>
            </main>
        );
    }

    const totalStudents = summary.length;

    const presentCount = summary.reduce(
        (total, student) => total + (student.present > 0 ? 1 : 0),
        0
    );

    const absentCount = summary.reduce(
        (total, student) => total + (student.absent > 0 ? 1 : 0),
        0
    );

    const totalAttendance = summary.reduce(
        (total, student) => total + student.present,
        0
    );

    const totalPossibleAttendance = summary.reduce(
        (total, student) => total + student.total_sessions,
        0
    );

    const attendancePercentage = totalPossibleAttendance > 0
        ? Number(
            ((totalAttendance / totalPossibleAttendance) * 100).toFixed(2)
        )
        : 0;

    const records = report?.attendance || [];

    const subjectName = report?.subject?.name || "Attendance";
    const subjectCode = report?.subject?.subject_code || "";

    const fileName = subjectName
        .replace(/[^a-z0-9]/gi, "_");

    // Export Excel Report
    function exportExcel() {
        const summaryData = summary.map((student) => ({
            "Student Name": student.student_name,
            "Student ID": student.student_id,
            "Total Sessions": student.total_sessions,
            "Present": student.present,
            "Absent": student.absent,
            "Attendance Percentage": `${student.attendance_percentage}%`
        }));

        const detailedData = records.map((record) => ({
            "Student Name": record.student_name,
            "Student ID": record.student_id,
            "Attendance Date": new Date(
                record.marked_at
            ).toLocaleString(),
            "Status": "Present"
        }));

        const workbook = XLSX.utils.book_new();

        const summarySheet = XLSX.utils.json_to_sheet(summaryData);
        const detailedSheet = XLSX.utils.json_to_sheet(detailedData);

        XLSX.utils.book_append_sheet(
            workbook,
            summarySheet,
            "Attendance Summary"
        );

        XLSX.utils.book_append_sheet(
            workbook,
            detailedSheet,
            "Detailed Records"
        );

        XLSX.writeFile(
            workbook,
            `${fileName}_Attendance_Report.xlsx`
        );
    }

    // Export PDF Report
    function exportPDF() {
        const pdf = new jsPDF();

        pdf.setFontSize(20);
        pdf.text("Attendance Report", 14, 20);

        pdf.setFontSize(12);
        pdf.text(`Subject: ${subjectName}`, 14, 32);
        pdf.text(`Subject Code: ${subjectCode}`, 14, 40);

        pdf.setFontSize(11);
        pdf.text(`Total Students: ${totalStudents}`, 14, 52);
        pdf.text(`Students Present: ${presentCount}`, 14, 60);
        pdf.text(`Students With Absences: ${absentCount}`, 14, 68);
        pdf.text(
            `Overall Attendance: ${attendancePercentage}%`,
            14,
            76
        );

        autoTable(pdf, {
            startY: 86,
            head: [[
                "Student Name",
                "Student ID",
                "Total",
                "Present",
                "Absent",
                "Attendance %"
            ]],
            body: summary.map((student) => [
                student.student_name,
                student.student_id,
                student.total_sessions,
                student.present,
                student.absent,
                `${student.attendance_percentage}%`
            ]),
            styles: {
                fontSize: 8,
                cellPadding: 3
            },
            headStyles: {
                fillColor: [37, 99, 235]
            }
        });

        const finalY = pdf.lastAutoTable.finalY || 100;

        if (records.length > 0) {
            autoTable(pdf, {
                startY: finalY + 12,
                head: [[
                    "Student Name",
                    "Student ID",
                    "Attendance Date",
                    "Status"
                ]],
                body: records.map((record) => [
                    record.student_name,
                    record.student_id,
                    new Date(record.marked_at).toLocaleString(),
                    "Present"
                ]),
                styles: {
                    fontSize: 8,
                    cellPadding: 3
                },
                headStyles: {
                    fillColor: [22, 163, 74]
                }
            });
        }

        pdf.save(`${fileName}_Attendance_Report.pdf`);
    }

    return (
        <main className="attendance-reports-page">
            <header className="reports-header">
                <button
                    className="reports-back-button"
                    onClick={() => navigate("/teacher")}
                >
                    <ArrowLeft size={18} />
                    Back to Dashboard
                </button>

                <button
                    className="reports-refresh-button"
                    onClick={() => window.location.reload()}
                >
                    <RefreshCw size={17} />
                    Refresh
                </button>
            </header>

            <section className="reports-title">
                <h1>Attendance Reports</h1>
                <p>
                    {subjectName} ({subjectCode})
                </p>
            </section>

            <section className="reports-stats">
                <article className="report-stat-card">
                    <Users size={25} />
                    <h2>{totalStudents}</h2>
                    <p>Total Students</p>
                </article>

                <article className="report-stat-card">
                    <UserCheck size={25} />
                    <h2>{presentCount}</h2>
                    <p>Students Present</p>
                </article>

                <article className="report-stat-card">
                    <UserX size={25} />
                    <h2>{absentCount}</h2>
                    <p>Students With Absences</p>
                </article>

                <article className="report-stat-card">
                    <Percent size={25} />
                    <h2>{attendancePercentage}%</h2>
                    <p>Overall Attendance</p>
                </article>
            </section>

            <section className="reports-export-section">
                <h2>Export Attendance Report</h2>

                <div className="reports-export-buttons">
                    <button
                        className="export-excel-button"
                        onClick={exportExcel}
                    >
                        <FileSpreadsheet size={18} />
                        Download Excel
                    </button>

                    <button
                        className="export-pdf-button"
                        onClick={exportPDF}
                    >
                        <FileText size={18} />
                        Download PDF
                    </button>
                </div>
            </section>

            <section className="reports-table-section">
                <h2>Student-wise Attendance Summary</h2>

                {summary.length === 0 ? (
                    <p>No enrolled students found.</p>
                ) : (
                    <div className="reports-table-wrapper">
                        <table>
                            <thead>
                                <tr>
                                    <th>Student Name</th>
                                    <th>Student ID</th>
                                    <th>Total Sessions</th>
                                    <th>Present</th>
                                    <th>Absent</th>
                                    <th>Attendance %</th>
                                </tr>
                            </thead>

                            <tbody>
                                {summary.map((student) => (
                                    <tr key={student.student_id}>
                                        <td>{student.student_name}</td>
                                        <td>{student.student_id}</td>
                                        <td>{student.total_sessions}</td>
                                        <td>{student.present}</td>
                                        <td>{student.absent}</td>
                                        <td>
                                            <strong>
                                                {student.attendance_percentage}%
                                            </strong>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            <section className="reports-table-section">
                <h2>Detailed Attendance Records</h2>

                {records.length === 0 ? (
                    <p>No attendance records found.</p>
                ) : (
                    <div className="reports-table-wrapper">
                        <table>
                            <thead>
                                <tr>
                                    <th>Student Name</th>
                                    <th>Student ID</th>
                                    <th>Attendance Date</th>
                                    <th>Status</th>
                                </tr>
                            </thead>

                            <tbody>
                                {records.map((record) => (
                                    <tr key={record.id}>
                                        <td>{record.student_name}</td>
                                        <td>{record.student_id}</td>
                                        <td>
                                            {new Date(
                                                record.marked_at
                                            ).toLocaleString()}
                                        </td>
                                        <td>
                                            <span className="present-badge">
                                                Present
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>
        </main>
    );
}
