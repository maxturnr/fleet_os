// Google Places Autocomplete API
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { input } = req.query

  if (!input || input.trim().length < 3) {
    return res.status(400).json({ error: 'Input must be at least 3 characters' })
  }

  const apiKey = process.env.GOOGLE_MAPS_API_KEY

  if (!apiKey) {
    return res.status(500).json({ error: 'API key not configured' })
  }

  try {
    const url = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}&components=country:gb&key=${apiKey}`
    
    const response = await fetch(url)
    const data = await response.json()

    if (data.status === 'OK' || data.status === 'ZERO_RESULTS') {
      return res.json(data)
    } else {
      console.error('Google Places Autocomplete error:', data)
      return res.status(500).json({ 
        error: 'Autocomplete failed',
        details: data.error_message 
      })
    }
  } catch (error) {
    console.error('Autocomplete error:', error)
    return res.status(500).json({ error: error.message })
  }
}
