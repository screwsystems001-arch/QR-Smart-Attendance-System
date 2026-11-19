import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
    ArrowLeft,
    MapPin,
    CheckCircle,
    XCircle,
    Loader
} from "lucide-react";

import { supabase } from "../../services/supabase";
import "./MarkAttendance.css";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function MarkAttendance() {
    const navigate = useNavigate();
    const location = useLocation();

    const sessionId = location.state?.sessionId;

    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState("");
    const [status, setStatus] = useState("");

    async function markAttendance() {
        setLoading(true);
        setMessage("");
        setStatus("");

        try {
            if (!sessionId) {
                throw new Error("Attendance session ID is missing. Scan the QR code again.");
            }

            if (!navigator.geolocation) {
                throw new Error("Geolocation is not supported by this browser.");
            }

            // Step 1: Get student GPS coordinates
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

            const studentLat = position.coords.latitude;
            const studentLng = position.coords.longitude;

            // Step 2: Get authentication token
            const {
                data: { session },
                error: sessionError
            } = await supabase.auth.getSession();

            if (sessionError) throw sessionError;

            if (!session) {
                throw new Error("Your login session has expired. Please log in again.");
            }

            // Step 3: Send attendance request to backend
            const response = await fetch(
                `${API_BASE_URL}/attendance/mark`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${session.access_token}`
                    },
                    body: JSON.stringify({
                        session_id: sessionId,
                        student_lat: studentLat,
                        student_lng: studentLng
                    })
                }
            );

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(
                    result.message || "Attendance marking failed."
                );
            }

            setStatus("success");
            setMessage("Your attendance has been marked successfully!");

        } catch (error) {
            setStatus("error");

            if (error.code === 1) {
                setMessage("Location permission denied. Please allow location access.");
            } else if (error.code === 2) {
                setMessage("Unable to determine your location. Try again.");
            } else if (error.code === 3) {
                setMessage("Location request timed out. Try again.");
            } else {
                setMessage(error.message || "Something went wrong.");
            }
        } finally {
            setLoading(false);
        }
    }

    return (
        <main className="mark-attendance-page">
            <section className="mark-attendance-card">

                <button
                    className="attendance-back-button"
                    onClick={() => navigate("/student")}
                >
                    <ArrowLeft size={18} />
                    Back to Dashboard
                </button>

                <div className="attendance-location-icon">
                    <MapPin size={35} />
                </div>

                <h1>Mark Your Attendance</h1>

                <p className="attendance-description">
                    Your current GPS location will be verified against
                    the classroom location.
                </p>

                <div className="attendance-session-info">
                    <strong>Attendance Session</strong>
                    <span>{sessionId || "Session ID unavailable"}</span>
                </div>

                {message && (
                    <div className={`attendance-result ${status}`}>
                        {status === "success"
                            ? <CheckCircle size={22} />
                            : <XCircle size={22} />
                        }
                        <p>{message}</p>
                    </div>
                )}

                <button
                    className="mark-attendance-button"
                    onClick={markAttendance}
                    disabled={loading || status === "success" || !sessionId}
                >
                    {loading ? (
                        <>
                            <Loader size={18} />
                            Verifying Location...
                        </>
                    ) : (
                        <>
                            <MapPin size={18} />
                            Get Location & Mark Attendance
                        </>
                    )}
                </button>

                <p className="attendance-note">
                    Please enable location services before marking attendance.
                </p>

            </section>
        </main>
    );
}