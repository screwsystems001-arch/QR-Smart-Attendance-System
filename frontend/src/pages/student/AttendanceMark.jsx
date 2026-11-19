import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { MapPin, ArrowLeft, CheckCircle, AlertCircle } from "lucide-react";
import { supabase } from "../../services/supabase";
import "./AttendanceMark.css";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function AttendanceMark() {
    const location = useLocation();
    const navigate = useNavigate();

    const sessionId = location.state?.sessionId;

    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");
    const [success, setSuccess] = useState(false);

    async function markAttendance() {
        if (!sessionId) {
            setMessage("Attendance session ID is missing. Please scan the QR code again.");
            return;
        }

        setLoading(true);
        setMessage("");

        try {
            if (!navigator.geolocation) {
                throw new Error("Geolocation is not supported by this browser.");
            }

            const position = await new Promise((resolve, reject) => {
                navigator.geolocation.getCurrentPosition(
                    resolve,
                    reject,
                    {
                        enableHighAccuracy: true,
                        timeout: 15000,
                        maximumAge: 0
                    }
                );
            });

            const { latitude, longitude } = position.coords;

            const { data: { session }, error: sessionError } =
                await supabase.auth.getSession();

            if (sessionError) throw sessionError;
            if (!session) throw new Error("Your login session has expired. Please log in again.");

            const response = await fetch(`${API_BASE_URL}/attendance/mark`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${session.access_token}`
                },
                body: JSON.stringify({
                    session_id: sessionId,
                    student_lat: latitude,
                    student_lng: longitude
                })
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.message || "Unable to mark attendance.");
            }

            setSuccess(true);
            setMessage(result.message || "Attendance marked successfully.");

        } catch (error) {
            if (error.code === 1) {
                setMessage("Location permission denied. Please allow location access and try again.");
            } else if (error.code === 2) {
                setMessage("Unable to determine your location. Please try again.");
            } else if (error.code === 3) {
                setMessage("Location request timed out. Please try again.");
            } else {
                setMessage(error.message || "Something went wrong.");
            }

            setSuccess(false);
        } finally {
            setLoading(false);
        }
    }

    return (
        <main className="attendance-mark-page">
            <section className="attendance-mark-card">
                <button
                    className="back-button"
                    onClick={() => navigate("/student/scan")}
                >
                    <ArrowLeft size={18} /> Back to Scanner
                </button>

                <MapPin size={42} className="location-icon" />

                <h1>Mark Attendance</h1>

                <p>
                    Your current location will be verified against
                    the classroom location before attendance is marked.
                </p>

                <button
                    className="mark-button"
                    onClick={markAttendance}
                    disabled={loading || success}
                >
                    {loading ? "Verifying Location..." : "Allow Location & Mark Attendance"}
                </button>

                {message && (
                    <div className={success ? "attendance-success" : "attendance-error"}>
                        {success
                            ? <CheckCircle size={20} />
                            : <AlertCircle size={20} />
                        }
                        <span>{message}</span>
                    </div>
                )}

                {success && (
                    <button
                        className="dashboard-button"
                        onClick={() => navigate("/student")}
                    >
                        Back to Dashboard
                    </button>
                )}
            </section>
        </main>
    );
}