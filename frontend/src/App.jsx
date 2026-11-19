import AttendanceReports from "./pages/teacher/AttendanceReports";
import StudentAnalytics from "./pages/teacher/StudentAnalytics";
import { Navigate, Route, Routes } from "react-router-dom";

import Login from "./pages/auth/Login";
import Register from "./pages/auth/Register";

import TeacherDashboard from "./pages/teacher/TeacherDashboard";
import CreateSession from "./pages/teacher/CreateSession";
import SessionQR from "./pages/teacher/SessionQR";

import StudentDashboard from "./pages/student/StudentDashboard";
import QRScanner from "./pages/student/QRScanner";
import MarkAttendance from "./pages/student/MarkAttendance";
import AttendanceHistory from "./pages/student/AttendanceHistory";

import { useAuth } from "./context/AuthContext";

function ProtectedRoute({ allowedRole, children }) {
    const { user, profile, loading } = useAuth();

    if (loading) {
        return <div className="loading-screen">Loading...</div>;
    }

    if (!user || !profile) {
        return <Navigate to="/login" replace />;
    }

    if (profile.role !== allowedRole) {
        return (
            <Navigate
                to={profile.role === "teacher" ? "/teacher" : "/student"}
                replace
            />
        );
    }

    return children;
}

function App() {
    const { user, profile, loading } = useAuth();

    if (loading) {
        return <div className="loading-screen">Loading...</div>;
    }

    return (
        <Routes>
            {/* Default Route */}
            <Route
                path="/"
                element={
                    <Navigate
                        to={
                            !user
                                ? "/login"
                                : profile?.role === "teacher"
                                    ? "/teacher"
                                    : "/student"
                        }
                        replace
                    />
                }
            />

            {/* Authentication Routes */}
            <Route
                path="/login"
                element={
                    user ? (
                        <Navigate
                            to={
                                profile?.role === "teacher"
                                    ? "/teacher"
                                    : "/student"
                            }
                            replace
                        />
                    ) : (
                        <Login />
                    )
                }
            />

            <Route
                path="/register"
                element={
                    user ? (
                        <Navigate to="/student" replace />
                    ) : (
                        <Register />
                    )
                }
            />

            {/* Teacher Routes */}
            <Route
                path="/teacher"
                element={
                    <ProtectedRoute allowedRole="teacher">
                        <TeacherDashboard />
                    </ProtectedRoute>
                }
            />

            <Route
                path="/teacher/create-session"
                element={
                    <ProtectedRoute allowedRole="teacher">
                        <CreateSession />
                    </ProtectedRoute>
                }
            />

            <Route
                path="/teacher/session/:sessionId"
                element={
                    <ProtectedRoute allowedRole="teacher">
                        <SessionQR />
                    </ProtectedRoute>
                }
            />

            {/* Student Routes */}
            <Route
                path="/student"
                element={
                    <ProtectedRoute allowedRole="student">
                        <StudentDashboard />
                    </ProtectedRoute>
                }
            />

            <Route
                path="/teacher/reports/:subjectId"
                element={
                    <ProtectedRoute allowedRole="teacher">
                        <AttendanceReports />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/teacher/analytics/:subjectId"
                element={
                    <ProtectedRoute allowedRole="teacher">
                        <StudentAnalytics />
                    </ProtectedRoute>
                }
            />

            <Route
                path="/student/scan"
                element={
                    <ProtectedRoute allowedRole="student">
                        <QRScanner />
                    </ProtectedRoute>
                }
            />

            <Route
                path="/student/attendance/mark"
                element={
                    <ProtectedRoute allowedRole="student">
                        <MarkAttendance />
                    </ProtectedRoute>
                }
            />
            <Route
                path="/student/history"
                element={
                    <ProtectedRoute allowedRole="student">
                        <AttendanceHistory />
                    </ProtectedRoute>
                }
            />

            {/* Unknown Routes */}
            <Route
                path="*"
                element={<Navigate to="/" replace />}
            />
        </Routes>
    );
}

export default App;
