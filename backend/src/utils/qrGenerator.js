
import QRCode from "qrcode";

export async function generateSessionQR(sessionId) {
    const payload = JSON.stringify({
        session_id: sessionId,
    });

    return QRCode.toDataURL(payload, {
        errorCorrectionLevel: "M",
        width: 320,
        margin: 2,
    });
}
