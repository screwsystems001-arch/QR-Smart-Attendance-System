
import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, QrCode, XCircle, RefreshCw } from "lucide-react";
import { supabase } from "../../services/supabase";
import "./SessionQR.css";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function SessionQR() {
    const { sessionId: paramSessionId } = useParams();
    const location = useLocation();
    const navigate = useNavigate();

    const sessionId = paramSessionId || location.state?.sessionId;

    const [qrCode, setQrCode] = useState("");
    const [loading, setLoading] = useState(true);
    const [closing, setClosing] = useState(false);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");

    async function getAuthHeaders() {
        const { data: { session }, error } =
            await supabase.auth.getSession();

        if (error) throw error;
        if (!session) throw new Error("Please log in again.");

        return {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json"
        };
    }

    async function fetchQRCode() {
        setLoading(true);
        setError("");

        try {
            if (!sessionId) {
                throw new Error("Attendance session ID is missing.");
            }

            const headers = await getAuthHeaders();

            const response = await fetch(
                `${API_BASE_URL}/attendance/sessions/${sessionId}/qr`,
                { headers }
            );

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.message || "Unable to generate QR code.");
            }

            setQrCode(result.qr_code);
        } catch (err) {
            setError(err.message || "Unable to load QR code.");
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        fetchQRCode();
    }, [sessionId]);

    async function closeSession() {
        const confirmed = window.confirm(
            "Are you sure you want to close this attendance session?"
        );

        if (!confirmed) return;

        setClosing(true);
        setError("");
        setMessage("");

        try {
            const headers = await getAuthHeaders();

            const response = await fetch(
                `${API_BASE_URL}/attendance/sessions/${sessionId}/close`,
                {
                    method: "PATCH",
                    headers
                }
            );

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.message || "Unable to close session.");
            }

            setMessage("Attendance session closed successfully.");
            setQrCode("");
        } catch (err) {
            setError(err.message || "Unable to close session.");
        } finally {
            setClosing(false);
        }
    }

    return (
        <main className="session-qr-page">
            <section className="session-qr-card">
                <button
                    className="session-qr-back"
                    onClick={() => navigate("/teacher")}
                >
                    <ArrowLeft size={18} />
                    Back to Dashboard
                </button>

                <div className="session-qr-icon">
                    <QrCode size={32} />
                </div>

                <h1>Attendance QR Code</h1>

                <p className="session-qr-description">
                    Ask students to scan this QR code to mark their attendance.
                </p>

                {loading && (
                    <p className="session-qr-loading">
                        <RefreshCw size={18} />
                        Generating QR code...
                    </p>
                )}

                {error && (
                    <p className="session-qr-error">{error}</p>
                )}

                {!loading && qrCode && (
                    <div className="session-qr-image-container">
                        <img src={qrCode} alt="Attendance QR Code" />
                        <p>Scan this code using the student application.</p>
                    </div>
                )}

                <div className="session-id-container">
                    <strong>Session ID</strong>
                    <span>{sessionId || "Not available"}</span>
                </div>

                {message && (
                    <p className="session-qr-success">{message}</p>
                )}

                {!loading && !error && qrCode && (
                    <button
                        className="close-session-button"
                        onClick={closeSession}
                        disabled={closing}
                    >
                        <XCircle size={18} />
                        {closing ? "Closing Session..." : "Close Attendance Session"}
                    </button>
                )}

                {error && (
                    <button
                        className="retry-qr-button"
                        onClick={fetchQRCode}
                        disabled={loading}
                    >
                        <RefreshCw size={17} />
                        Retry
                    </button>
                )}
            </section>
        </main>
    );
}
