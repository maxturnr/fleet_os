# Fleet iOS App

Separate iOS wrapper project for Fleet OS.

This app intentionally lives in its own folder so the iOS files do not mix with the web app files.

## What It Is

- Native SwiftUI iPhone shell
- Loads the live Fleet app in a `WKWebView`
- Keeps the current product behavior identical to the web version

## Open It

Open:

- `fleet ios app/FleetIOSApp.xcodeproj`

## Current App URL

The wrapper currently loads:

- `https://www.pierfront.co`

If you want a staging / preview build later, update `AppConfig.baseURL` in:

- `fleet ios app/FleetIOSApp/AppConfig.swift`

## Notes

- This is the fastest path to an iOS app that matches the existing product.
- A full native SwiftUI rebuild would be a separate, much larger project.
- I could not run a real iOS build in this environment because the active developer directory is set to Command Line Tools instead of the full Xcode app.

## If Xcode Won't Build Immediately

Run this on the Mac once full Xcode is installed:

```bash
sudo xcode-select -s /Applications/Xcode.app/Contents/Developer
```
