/** Great-circle distance in kilometers (WGS84). */
export function haversineDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Coarse area key (~1.1 km) so multiple OSM “area” drops batch together.
 */
export function areaBatchKey(latitude: number, longitude: number): string {
  return `${latitude.toFixed(2)}_${longitude.toFixed(2)}`;
}

export type ProximityBand = 'near' | 'moderate' | 'far' | 'distant';

export function proximityBand(distanceKm: number): ProximityBand {
  if (distanceKm <= 5) return 'near';
  if (distanceKm <= 20) return 'moderate';
  if (distanceKm <= 60) return 'far';
  return 'distant';
}

/** Card border + background for order proximity to rider. */
export const proximityCardClass: Record<ProximityBand, string> = {
  near: 'border-emerald-500 bg-emerald-50/80',
  moderate: 'border-amber-500 bg-amber-50/80',
  far: 'border-orange-500 bg-orange-50/70',
  distant: 'border-rose-400 bg-rose-50/70',
};

export const proximityLabel: Record<ProximityBand, string> = {
  near: 'Very close (≤ 5 km)',
  moderate: 'Nearby (5–20 km)',
  far: 'Far (20–60 km)',
  distant: 'Distant (> 60 km)',
};
