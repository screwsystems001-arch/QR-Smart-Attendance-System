import "./QRScanner.css";
import { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";
import { ArrowLeft, Camera } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function QRScanner() {
    const scannerRef = useRef(null);
    const scannedRef = useRef(false);
    const navigate = useNavigate();

    const [error, setError] = useState("");

    useEffect(() => {
        let isMounted = true;
        let scanner;
        let isStarted = false;

        async function startScanner() {
            try {
                scanner = new Html5Qrcode("qr-reader");
                scannerRef.current = scanner;

                await scanner.start(
                    { facingMode: "environment" },
                    {
                        fps: 10,
                        qrbox: { width: 250, height: 250 },
                    },
                    async (decodedText) => {
                        if (!isMounted || scannedRef.current) return;

                        let qrData;

                        try {
                            qrData = JSON.parse(decodedText);

                            if (
                                !qrData.session_id ||
                                typeof qrData.session_id !== "string"
                            ) {
                                throw new Error("Invalid attendance QR code.");
                            }
                        } catch (parseError) {
                            setError(parseError.message || "Invalid QR code.");
                            return;
                        }

                        scannedRef.current = true;

                        try {
                            if (scanner.isScanning) {
                                await scanner.stop();
                            }

                            if (isMounted) {
                                navigate("/student/attendance/mark", {
                                    state: {
                                        sessionId: qrData.session_id,
                                    },
                                });
                            }
                        } catch (stopError) {
                            console.error("Scanner stop failed:", stopError);

                            if (isMounted) {
                                setError("Unable to stop the camera. Please try again.");
                                scannedRef.current = false;
                            }
                        }
                    },
                    () => { }
                );

                isStarted = true;
            } catch (err) {
                if (isMounted) {
                    setError(err.message || "Unable to access the camera.");
                }
            }
        }

        startScanner();

        return () => {
            isMounted = false;

            const cleanupScanner = async () => {
                if (!scanner) return;

                try {
                    if (isStarted && scanner.isScanning) {
                        await scanner.stop();
                    }

                    await scanner.clear();
                } catch (err) {
                    console.error("Scanner cleanup failed:", err);
                }

                if (scannerRef.current === scanner) {
                    scannerRef.current = null;
                }
            };

            cleanupScanner();
        };
    }, [navigate]);

    return (
        <main className="scanner-page">
            <header className="scanner-header">
                <button onClick={() => navigate("/student")}>
                    <ArrowLeft size={18} />
                    Back
                </button>

                <h2>Scan Attendance QR</h2>
            </header>

            <section className="scanner-card">
                <Camera size={30} />

                <h1>Scan QR Code</h1>

                <p>
                    Position the teacher's attendance QR code
                    inside the scanning frame.
                </p>

                <div id="qr-reader" />

                {error && (
                    <p className="scanner-error">{error}</p>
                )}

                <p className="scanner-hint">
                    Allow camera permission when your browser asks.
                </p>
            </section>
        </main>
    );
}