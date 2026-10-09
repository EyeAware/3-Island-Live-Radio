# Island Radio

A minimal web app for streaming live Caribbean radio stations from Martinique, Saint Lucia, and Trinidad & Tobago.

## Features

- 60+ live radio stations across three Caribbean nations
- Filter and search stations by name, frequency, or country
- Play, pause, skip, and refresh live streams
- HLS stream support via [hls.js](https://github.com/video-dev/hls.js)
- Responsive dark UI with slide-out station drawer
- Keyboard accessible (Escape closes the drawer)

## Running locally

A web server is required because the app fetches `stations.json` via `fetch()`.

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000 in your browser.

## Deployment

The app is static and can be hosted on GitHub Pages, Netlify, or any static hosting provider.

## Project structure

| File | Description |
|---|---|
| `index.html` | Markup and layout |
| `styles.css` | Styling |
| `app.js` | Player logic, station rendering, HLS playback |
| `stations.json` | Station data (name, country, frequency, stream URL) |

## License

Station streams are provided by their respective broadcasters. This project is for educational purposes.
