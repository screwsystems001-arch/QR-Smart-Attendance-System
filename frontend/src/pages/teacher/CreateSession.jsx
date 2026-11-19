
import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, MapPin, QrCode } from "lucide-react";
import { supabase } from "../../services/supabase";
import "./CreateSession.css";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

export default function CreateSession() {
    const navigate = useNavigate();
    const location = useLocation();

    const selectedSubjectId = location.state?.subjectId || "";

    const [subjects, setSubjects] = useState([]);
    const [subjectId, setSubjectId] = useState(selectedSubjectId);
    const [latitude, setLatitude] = useState("");
    const [longitude, setLongitude] = useState("");
    const [radius, setRadius] = useState(100);
    const [duration, setDuration] = useState(30);

    const [loading, setLoading] = useState(false);
    const [fetchingSubjects, setFetchingSubjects] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        async function fetchSubjects() {
            try {
                const { data: { session }, error: sessionError } =
                    await supabase.auth.getSession();

                if (sessionError) throw sessionError;
                if (!session) throw new Error("Please log in again.");

                const response = await fetch(`${API_BASE_URL}/subjects`, {
                    headers: {
                        Authorization: `Bearer ${session.access_token}`
                    }
                });

                const result = await response.json();

                if (!response.ok || !result.success) {
                    throw new Error(result.message || "Unable to load subjects.");
                }

                setSubjects(result.subjects || []);
            } catch (err) {
                setError(err.message || "Unable to load subjects.");
            } finally {
                setFetchingSubjects(false);
            }
        }

        fetchSubjects();
    }, []);

    async function getCurrentLocation() {
        setError("");

        if (!navigator.geolocation) {
            setError("Geolocation is not supported by this browser.");
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                setLatitude(String(position.coords.latitude));
                setLongitude(String(position.coords.longitude));
            },
            (err) => {
                setError(err.message || "Unable to get your location.");
            },
            {
                enableHighAccuracy: true,
                timeout: 15000,
                maximumAge: 0
            }
        );
    }

    async function handleCreateSession(event) {
        event.preventDefault();
        setError("");

        const lat = Number(latitude);
        const lng = Number(longitude);
        const radiusValue = Number(radius);
        const durationValue = Number(duration);

        if (!subjectId) {
            setError("Please select a subject.");
            return;
        }

        if (
            latitude.trim() === "" ||
            longitude.trim() === "" ||
            !Number.isFinite(lat) ||
            !Number.isFinite(lng) ||
            lat < -90 || lat > 90 ||
            lng < -180 || lng > 180
        ) {
            setError("Enter valid classroom latitude and longitude.");
            return;
        }

        if (!Number.isFinite(radiusValue) || radiusValue <= 0) {
            setError("Enter a valid attendance radius.");
            return;
        }

        if (!Number.isInteger(durationValue) || durationValue <= 0) {
            setError("Session duration must be a positive whole number of minutes.");
            return;
        }

        setLoading(true);

        try {
            const { data: { session }, error: sessionError } =
                await supabase.auth.getSession();

            if (sessionError) throw sessionError;
            if (!session) throw new Error("Your login session has expired.");

            const response = await fetch(`${API_BASE_URL}/attendance/sessions`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${session.access_token}`
                },
                body: JSON.stringify({
                    subject_id: subjectId,
                    classroom_lat: lat,
                    classroom_lng: lng,
                    radius_meters: radiusValue,
                    duration_minutes: durationValue
                })
            });

            const result = await response.json();

            if (!response.ok || !result.success) {
                throw new Error(result.message || "Unable to create attendance session.");
            }

            navigate(`/teacher/session/${result.session.id}`, {
                state: { sessionId: result.session.id }
            });
        } catch (err) {
            setError(err.message || "Something went wrong.");
        } finally {
            setLoading(false);
        }
    }

    return (
        <main className="create-session-page">
            <section className="create-session-card">
                <button
                    type="button"
                    className="session-back-button"
                    onClick={() => navigate("/teacher")}
                >
                    <ArrowLeft size={18} />
                    Back to Dashboard
                </button>

                <div className="session-title-icon">
                    <QrCode size={30} />
                </div>

                <h1>Create Attendance Session</h1>
                <p className="session-description">
                    Configure your classroom location and attendance duration.
                </p>

                <form onSubmit={handleCreateSession}>
                    <label htmlFor="subject">Select Subject</label>

                    <select
                        id="subject"
                        value={subjectId}
                        onChange={(e) => setSubjectId(e.target.value)}
                        disabled={fetchingSubjects}
                        required
                    >
                        <option value="">
                            {fetchingSubjects ? "Loading subjects..." : "Choose a subject"}
                        </option>

                        {subjects.map((subject) => (
                            <option key={subject.id} value={subject.id}>
                                {subject.name} ({subject.subject_code})
                            </option>
                        ))}
                    </select>

                    <div className="location-heading">
                        <label>Classroom Location</label>

                        <button
                            type="button"
                            className="location-button"
                            onClick={getCurrentLocation}
                        >
                            <MapPin size={16} />
                            Use Current Location
                        </button>
                    </div>

                    <label htmlFor="latitude">Latitude</label>
                    <input
                        id="latitude"
                        type="number"
                        step="any"
                        value={latitude}
                        onChange={(e) => setLatitude(e.target.value)}
                        placeholder="Example: 16.705"
                        required
                    />

                    <label htmlFor="longitude">Longitude</label>
                    <input
                        id="longitude"
                        type="number"
                        step="any"
                        value={longitude}
                        onChange={(e) => setLongitude(e.target.value)}
                        placeholder="Example: 74.2433"
                        required
                    />

                    <label htmlFor="radius">Attendance Radius (metres)</label>
                    <input
                        id="radius"
                        type="number"
                        min="1"
                        value={radius}
                        onChange={(e) => setRadius(e.target.value)}
                        required
                    />

                    <label htmlFor="duration">Session Duration (minutes)</label>
                    <input
                        id="duration"
                        type="number"
                        min="1"
                        step="1"
                        value={duration}
                        onChange={(e) => setDuration(e.target.value)}
                        required
                    />

                    {error && (
                        <p className="session-error">{error}</p>
                    )}

                    <button
                        type="submit"
                        className="create-session-button"
                        disabled={loading || fetchingSubjects}
                    >
                        {loading ? "Creating Session..." : "Create Attendance Session"}
                    </button>
                </form>
            </section>
        </main>
    );
}
