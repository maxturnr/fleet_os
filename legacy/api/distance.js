// Vercel Serverless Function for Google Maps Distance Matrix API
// This keeps your API key secure on the server side and avoids CORS issues

export default async function handler(req, res) {
  // Only allow GET requests
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { startLat, startLon, endLat, endLon } = req.query

  // Validate inputs
  if (!startLat || !startLon || !endLat || !endLon) {
    return res.status(400).json({ 
      error: 'Missing required parameters: startLat, startLon, endLat, endLon' 
    })
  }

  // Validate coordinates are numbers
  const coords = [startLat, startLon, endLat, endLon]
  if (coords.some(c => isNaN(parseFloat(c)))) {
    return res.status(400).json({ error: 'Invalid coordinates' })
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY

  if (!apiKey) {
    console.error('GOOGLE_MAPS_API_KEY not configured')
    // Fallback to straight-line distance calculation
    const distance = haversineDistance(
      parseFloat(startLat),
      parseFloat(startLon),
      parseFloat(endLat),
      parseFloat(endLon)
    )
    return res.json({
      status: 'FALLBACK',
      distance_miles: distance,
      method: 'straight_line'
    })
  }

  try {
    const origin = `${startLat},${startLon}`
    const destination = `${endLat},${endLon}`
    
    const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${origin}&destinations=${destination}&units=imperial&key=${apiKey}`
    
    const response = await fetch(url)
    const data = await response.json()

    if (data.status === 'OK' && data.rows[0].elements[0].status === 'OK') {
      const element = data.rows[0].elements[0]
      const distanceMeters = element.distance.value
      const distanceMiles = distanceMeters * 0.000621371
      const durationSeconds = element.duration.value

      return res.json({
        status: 'OK',
        distance_miles: distanceMiles,
        distance_text: element.distance.text,
        duration_text: element.duration.text,
        duration_seconds: durationSeconds,
        method: 'google_maps'
      })
    } else {
      console.error('Google Maps API error:', data)
      // Fallback to straight-line distance
      const distance = haversineDistance(
        parseFloat(startLat),
        parseFloat(startLon),
        parseFloat(endLat),
        parseFloat(endLon)
      )
      return res.json({
        status: 'FALLBACK',
        distance_miles: distance,
        method: 'straight_line',
        error: data.error_message || 'Google Maps API error'
      })
    }
  } catch (error) {
    console.error('Distance calculation error:', error)
    // Fallback to straight-line distance
    const distance = haversineDistance(
      parseFloat(startLat),
      parseFloat(startLon),
      parseFloat(endLat),
      parseFloat(endLon)
    )
    return res.json({
      status: 'FALLBACK',
      distance_miles: distance,
      method: 'straight_line',
      error: error.message
    })
  }
}

// Haversine formula for straight-line distance (fallback)
function haversineDistance(lat1, lon1, lat2, lon2) {
  const R = 3959 // Earth's radius in miles
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLon = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}
