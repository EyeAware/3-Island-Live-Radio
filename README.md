# Island Radio

A responsive static web app for streaming Caribbean radio stations from Martinique, Saint Lucia, and Trinidad & Tobago.

## Features

- 60 live radio stations across three Caribbean countries
- Search by station name, country, frequency, or country code
- Country filters and a favorites-only filter
- Play/pause, next/previous station, and stream refresh
- HLS playback through hls.js where native HLS is unavailable
- Persistent favorites and last-selected station (local browser storage)
- Responsive player layout, accessible station drawer, keyboard Escape support, and reduced-motion support

## Run locally

A web server is required because the app fetches `stations.json`.

```bash
python3 -m http.server 8000
```

Open <http://localhost:8000>.

## Deployment

This is a static site and can be hosted on GitHub Pages, Netlify, or another static hosting provider. Streams are hosted by third parties; a station may be offline, geo-restricted, or blocked by a browser due to mixed-content/CORS/provider policies.

## Project files

| File | Purpose |
|---|---|
| `index.html` | Accessible page structure |
| `styles.css` | Responsive design and components |
| `app.js` | Station rendering, audio playback, HLS handling, favorites, and filters |
| `stations.json` | Station names, countries, frequencies, and stream URLs |

## Notes

- The app does not autoplay audio on page load; users must press Play.
- Favorites and the last selected station are saved in the current browser using `localStorage`.
- HLS.js is loaded from jsDelivr. Native HLS playback is used when the browser supports it.
- Stream URLs are supplied by their broadcasters and can change without notice.
