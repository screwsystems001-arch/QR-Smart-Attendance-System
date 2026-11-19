
const EARTH_RADIUS_METERS = 6371000;

export function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
    const toRadians = (degrees) => (degrees * Math.PI) / 180;

    const latitudeDifference = toRadians(lat2 - lat1);
    const longitudeDifference = toRadians(lon2 - lon1);

    const a =
        Math.sin(latitudeDifference / 2) ** 2 +
        Math.cos(toRadians(lat1)) *
        Math.cos(toRadians(lat2)) *
        Math.sin(longitudeDifference / 2) ** 2;

    const safeA = Math.min(1, Math.max(0, a));

    return (
        2 *
        EARTH_RADIUS_METERS *
        Math.atan2(Math.sqrt(safeA), Math.sqrt(1 - safeA))
    );
}
