# Google Maps API Setup for Accurate Mileage Calculation

## Why Google Maps?
The current system uses **straight-line distance** (as the crow flies), which underestimates actual driving distance by 20-40%. Google Maps provides **real driving routes** for accurate mileage tracking.

## Cost Breakdown

### Free Tier
- **$200 free credit per month** from Google Cloud
- Distance Matrix API: **$5 per 1,000 requests**
- **Free allowance: ~40,000 distance calculations/month**

### Your Expected Usage
- **100 trips/month**: FREE (uses ~$0.50 of credit)
- **500 trips/month**: FREE (uses ~$2.50 of credit)
- **1,000 trips/month**: FREE (uses ~$5 of credit)
- **5,000 trips/month**: FREE (uses ~$25 of credit)

**Bottom line**: Unless you're logging 40,000+ trips per month, you'll stay within the free tier.

## Setup Instructions

### Step 1: Create Google Cloud Account
1. Go to https://console.cloud.google.com
2. Sign in with your Google account
3. Accept terms and conditions

### Step 2: Create a New Project
1. Click "Select a project" dropdown (top left)
2. Click "New Project"
3. Name it: "FleetOS Mileage Tracker"
4. Click "Create"

### Step 3: Enable Distance Matrix API
1. In the search bar, type "Distance Matrix API"
2. Click on "Distance Matrix API"
3. Click "Enable"
4. Wait for it to activate (~30 seconds)

### Step 4: Enable Billing (Required for Free Tier)
1. Go to "Billing" in the left menu
2. Click "Link a billing account"
3. Add your credit card details
   - **Don't worry**: You won't be charged unless you exceed $200/month
   - You can set spending limits to prevent unexpected charges

### Step 5: Create API Key
1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "API Key"
3. Copy the API key (looks like: `AIzaSyD...`)

### Step 6: Restrict API Key (Security)
1. Click on your new API key
2. Under "API restrictions":
   - Select "Restrict key"
   - Check only: "Distance Matrix API"
3. Under "Application restrictions":
   - Select "HTTP referrers (web sites)"
   - Add: `https://www.pierfront.co/*`
   - Add: `https://*.vercel.app/*` (for testing)
4. Click "Save"

### Step 7: Add API Key to Vercel (Recommended - Most Secure)

**The API key is stored as an environment variable in Vercel, NOT in the code.**

1. Go to https://vercel.com/maxturnrs-projects/fleet-os/settings/environment-variables
2. Click "Add New"
3. Enter:
   - **Key**: `GOOGLE_MAPS_API_KEY`
   - **Value**: Your API key (e.g., `AIzaSyD...`)
   - **Environments**: Check all three (Production, Preview, Development)
4. Click "Save"
5. Redeploy your app:
   ```bash
   vercel --prod
   ```

**Why this way?**
- ✅ API key stays secure (not visible in code)
- ✅ No risk of accidentally committing it to git
- ✅ Easy to rotate/update without code changes
- ✅ Works with the serverless function at `/api/distance.js`

## Set Spending Limits (Optional but Recommended)

### Prevent Unexpected Charges:
1. Go to "Billing" → "Budgets & alerts"
2. Click "Create Budget"
3. Set budget to: **$10/month**
4. Set alert at: **50%** ($5)
5. Add your email for notifications

This way, you'll be notified if usage spikes unexpectedly.

## Testing

After setup, test the mileage tracker:
1. Add a new trip
2. Enter start postcode (e.g., "SW1A 1AA")
3. Enter end postcode (e.g., "EC1A 1BB")
4. Distance should show "Calculating..." then update with **driving distance**

## Fallback Behavior

If Google Maps API fails (no key, quota exceeded, network error):
- System automatically falls back to straight-line distance
- Shows console warning
- Trip still saves successfully
- You can manually adjust the distance if needed

## Monitoring Usage

Check your API usage:
1. Go to Google Cloud Console
2. Navigate to "APIs & Services" → "Dashboard"
3. Click "Distance Matrix API"
4. View usage graphs and statistics

## Cost Optimization Tips

1. **Cache common routes**: If you frequently travel the same routes, the system could cache distances
2. **Batch requests**: Not applicable for single trips
3. **Use straight-line for estimates**: Only use Google Maps for final saved trips

## Troubleshooting

### "API key not valid"
- Check API key is copied correctly
- Verify Distance Matrix API is enabled
- Check API key restrictions match your domain

### "CORS error"
- API calls from browser may have CORS issues
- Consider using a serverless function proxy (see below)

### "Over quota"
- Check usage in Google Cloud Console
- Verify billing is enabled
- Check if spending limit was reached

## Advanced: Serverless Proxy (Recommended)

For better security and to avoid CORS issues, create a Vercel serverless function:

**File**: `api/distance.js`
```javascript
export default async function handler(req, res) {
  const { startLat, startLon, endLat, endLon } = req.query
  
  const url = `https://maps.googleapis.com/maps/api/distancematrix/json?origins=${startLat},${startLon}&destinations=${endLat},${endLon}&units=imperial&key=${process.env.GOOGLE_MAPS_API_KEY}`
  
  const response = await fetch(url)
  const data = await response.json()
  
  res.json(data)
}
```

Then update FleetOS to call: `/api/distance?startLat=...&startLon=...&endLat=...&endLon=...`

This keeps your API key server-side and avoids CORS issues.

## Summary

- ✅ **Free for typical usage** (under 40k trips/month)
- ✅ **Accurate driving distances** instead of straight-line
- ✅ **Easy to set up** (15 minutes)
- ✅ **Safe with spending limits** and alerts
- ✅ **Automatic fallback** if API fails

**Recommended**: Set it up! The accuracy improvement is worth the 15-minute setup, and it's completely free for your usage level.
