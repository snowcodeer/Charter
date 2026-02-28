import * as THREE from 'three'

/** Convert lat/lng (degrees) to a point on a sphere of given radius */
export function latLngToVector3(lat: number, lng: number, radius: number): THREE.Vector3 {
  const phi = (90 - lat) * (Math.PI / 180)
  const theta = (lng + 180) * (Math.PI / 180)
  return new THREE.Vector3(
    -radius * Math.sin(phi) * Math.cos(theta),
    radius * Math.cos(phi),
    radius * Math.sin(phi) * Math.sin(theta)
  )
}

/** Convert a 3D point on a sphere back to lat/lng (degrees) */
export function vector3ToLatLng(point: THREE.Vector3, radius: number): { lat: number; lng: number } {
  const normalized = point.clone().normalize()
  const lat = 90 - Math.acos(normalized.y) * (180 / Math.PI)
  const lng = -(Math.atan2(normalized.z, -normalized.x) * (180 / Math.PI)) - 180
  // Normalize longitude to [-180, 180]
  const normalizedLng = ((lng + 540) % 360) - 180
  return { lat, lng: normalizedLng }
}

/** Create a curved arc between two points on a sphere */
export function createArcCurve(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
  radius: number,
  arcHeight = 0.3
): THREE.QuadraticBezierCurve3 {
  const start = latLngToVector3(from.lat, from.lng, radius)
  const end = latLngToVector3(to.lat, to.lng, radius)

  // Control point: midpoint elevated above the sphere surface
  const mid = start.clone().add(end).multiplyScalar(0.5)
  const dist = start.distanceTo(end)
  const elevation = radius + dist * arcHeight
  mid.normalize().multiplyScalar(elevation)

  return new THREE.QuadraticBezierCurve3(start, mid, end)
}
