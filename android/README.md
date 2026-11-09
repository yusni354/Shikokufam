# Shikoku Family Android app

This Android project packages the existing web app in a local WebView. Supabase
and the CDN-hosted Supabase client and fonts still require an internet connection.

Build a debug APK with Android SDK Platform 36 and Java 17:

```sh
cd android
./gradlew assembleDebug
```

The APK is written to `app/build/outputs/apk/debug/app-debug.apk`. The build
copies `index.html` and `assets/` from the repository root into the APK, so the
web app has a single source of truth.
