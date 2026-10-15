# Driving implementation

## Implementation plan — completed

1. Add a speed controller that integrates physical distance and supports Play/Pause, Reset and lifecycle suspension.
2. Generate continuous road surfaces and recycle a bounded, seeded pool of roadside buildings, trees and lawns.
3. Add the divided Highway layout with four travel lanes, two outer safety lanes and white markings.
4. Add a driver's-seat camera and procedural cabin without a steering wheel or instrument cluster.
5. Integrate editor controls, the external speed API, URL restore, scene changes and frozen PNG export.
6. Rebuild the shipped bundle; verify geometry, distance, recycling, camera views, desktop/mobile controls, regressions and GPU performance.

## Delivered scope

Road, Elevated road and the Highway layout support continuous straight travel controlled by live speed in km/h. Junction approaches, ramps and parking retain their finite compositions. Continuous driving has no steering, collision simulation or traffic behaviour. An optional WebSocket input accepts speed from a simulator or native application; no feed is connected automatically.

- **Layout:** Road retains 2, 4 and 6 lane choices. Highway fixes four travel lanes total, two per direction, each 3.7 m wide. A 3 m central divider separates the carriageways; each outer side has a 3 m safety lane. Lane dividers are dashed white and edges are solid white.
- **Camera:** Low and High retain exterior viewpoints. Driver is available on Road and Elevated road, including Highway, with a left-hand driver's-seat position inside a closed cabin shell around intentionally clear windshield and side-window apertures. Solid door panels, insets and window belts meet a floor pan, inclined front bulkhead and rear enclosure. Slim beveled, tapered A pillars connect to the roof trim and body; seals, low mirror sails and a crowned, tapered bonnet complete the frame. The repair keeps the same eye position and 75° field of view, with restrained trim materials readable in light and dark themes. It contains no steering wheel, dashboard or instrument cluster. Driver hides the exterior vehicle and its switch; Low/High restore the switch and saved vehicle setting.
- **Transport:** a number field and keyboard-operable slider accept 0–300 km/h. Play/Pause controls continuous travel; zero speed stops distance accumulation. Reset restores the initial seeded scenery and zero distance without changing speed or the Play/Pause selection.
- **Speed source:** WebSocket Connect/Disconnect accepts a native endpoint or the included local relay. Manual number/slider input is disabled during connection setup and while connected. New samples change speed without selecting Play.
- **Scenery:** 40 fixed roadside slots, 20 per side, recycle behind the viewpoint. A deterministic seed varies building width, depth, height, setback, longitudinal jitter, tree scale and tree offset. Scene changes preserve travelled distance.

The added controls reuse the editor's existing light/dark surfaces, typography, rounded choices and spacing. Desktop and mobile screenshots were checked against that incumbent system. No shipping raster assets or new visual identity files were introduced.

## Architecture

- `driving.js`: speed validation, playback, suspension and distance integration. Distance advances by `speedKmh / 3.6 × elapsedSeconds`; each frame's elapsed time is capped at 0.1 seconds to prevent large catch-up jumps. Speed is in km/h, distance in metres.
- `speed-feed.js`: native browser WebSocket client, payload validation, connection state and newest-sample coalescing once per animation frame.
- `scripts/speed-feed-server.mjs`: optional Node WebSocket relay. It broadcasts the latest valid speed to connected peers and sends that speed immediately to each newly connected client.
- `driving-road.js`: continuous road surfaces, periodic lane markings and a fixed pool of seeded roadside sites. Uniform asphalt and rails remain stationary because their translation would look identical. Markings, roadside scenery and bridge supports move towards positive Z as the car travels forwards.
- `driver-view.js`: a separate procedural cabin, because the supplied vehicle's opaque windows make it unsuitable for an interior camera. Rounded and extruded body panels overlap around the pillar feet, window belts and front enclosure to close street sightlines below the windows. The bonnet has a crowned top, tapered outline, closed sides and underside; window apertures remain intentionally clear.
- `world.js`: integrates road generation, camera selection and moving shadow/reflection cache keys.
- `app.js`, `index.html`, `workspace.css`: controls, URL state, the public API and lifecycle integration.

Continuous travel suspends while the tab is hidden, Credits is open, a scene is initializing or PNG export is capturing a frame. It resumes when the suspension ends if Play is still selected. No hidden-tab time is added to the distance. PNG export freezes the distance and restores the preview resolution afterward. URL parameters `speed` and `drive=1` restore speed and requested playback; distance starts at zero on reload. Reduced-motion preferences prevent URL autoplay, and switching that preference on pauses travel. Explicit Play remains available.

## Public speed interface

After the application initializes, an external source can update speed without rebuilding the scene:

```js
window.driveScene.setSpeedKmh(90);
window.driveScene.play();

// Call again whenever a new speed sample arrives.
window.driveScene.setSpeedKmh(45);
const state = window.driveScene.getState();

window.driveScene.pause();
window.driveScene.reset();
```

`setSpeedKmh(value)` returns the accepted speed, clamped to 0–300; non-finite values become zero. `getState()` returns `{ speedKmh, playing, running, distanceMetres, supported, speedInput, speedFeed }`. `playing` records the requested playback state; `running` also requires nonzero speed, a supported scene and no suspension. `speedInput` is `"websocket"` when connected and `"manual"` otherwise; manual controls remain disabled while connecting. `speedFeed` contains `{ status, url, received, error }`, with `received` counting valid messages for the current connection. Speed samples do not implicitly press Play.

The same API manages an external feed:

```js
window.driveScene.connectSpeedFeed('ws://127.0.0.1:9001');
// Press Play in the editor when ready, or call play() explicitly.
window.driveScene.disconnectSpeedFeed();
```

`connectSpeedFeed(url)` accepts `ws://` or `wss://` and returns whether connection setup was started; it does not promise an established connection. Read `getState().speedFeed` for connection status. An unexpected close after connecting pauses playback and restores manual input. An intentional Disconnect leaves the latest speed and Play/Pause selection unchanged. Reload does not reconnect automatically.

## Simulator and native input

Send WebSocket **text frames**, each containing either a finite JSON number such as `90`, or an object such as `{"speedKmh":90}`. Values are km/h and clamp to 0–300. Invalid payloads leave the current speed unchanged and show a format message; binary frames are not accepted. Browser messages over 4096 characters are rejected, and the relay limits payloads to 4096 bytes. If several samples arrive between rendered frames, the browser applies only the newest sample. A feed controls speed, not playback.

The browser can connect directly to a WebSocket server hosted by the native application. Alternatively, start the included relay after installing the project's dependencies:

```sh
npm run speed-feed -- 90
```

The default address is `ws://127.0.0.1:9001`, with initial speed 90 km/h. Run the application separately with `npm run dev`, then use the speed-feed control to connect. Connect the simulator to the same relay address and send its current speed in the text format above. Each valid sample is broadcast to all connected clients, including the sender; newly connected clients receive the latest speed. Set `DRIVESCENE_SPEED_PORT` and `DRIVESCENE_SPEED_HOST` to change the relay's port and bind address. The default bind is loopback; the relay has no authentication or TLS.

A native sender's loop can be as simple as this pseudocode:

```text
socket = connectWebSocket("ws://127.0.0.1:9001")
on each simulator speed sample:
    socket.sendText(JSON.stringify({speedKmh: currentSpeedKmh}))
```

For an existing UDP/OSC source, put the protocol conversion in the native sender or a local bridge and forward speed through WebSocket. Use the locally served HTTP app for the loopback relay. Remote HTTPS pages connecting to local endpoints are subject to browser local-network permissions and connection policies; use `wss://` for secure hosted feeds. The included relay serves `ws://` only.

## Verification

The current implementation passed:

```sh
npm run build
npm test
npm run test:browser
npm run test:feed
```

The browser verification loads the built bundle and exercises real scene controls, with a test-only inspection hook served in memory that does not alter the shipped bundle. Set `CHROMIUM_PATH` to a local Chrome executable when needed. Screenshots and results are written to `/private/tmp/drivescene-verification`.

The browser rerun after the cabin repair covered speed changes, zero speed, pause/reset, deterministic scenery, Highway geometry, Driver camera, both themes, URL restore, reduced motion, tab visibility and export. Parking, junction, ramp, Elevated road and coast regression checks passed. Continuous slider updates rendered 59 frames with zero stalls; the keyboard slider and 390 × 844 mobile viewport passed. No page errors or missing assets were reported. The recycling check advanced the exterior-view baseline to 100,000 m and retained all 40 roadside slots, with the renderer geometry count unchanged at 437 before and after. The downloaded PNG decoded to 1920 × 1080.

The WebSocket integration test serves the built app on real local HTTP and connects Chrome to a real WebSocket server. It checks 81 received samples, including 80 during playback, latest-sample delivery, zero speed, 300 km/h clamping, invalid messages, connection loss, intentional disconnect and restored manual controls. A separate native-style WebSocket client also sends updates through the included relay to Chrome, including latest-speed delivery on connection and malformed-message rejection. Desktop and 390 × 844 mobile captures are written to `/private/tmp/drivescene-speed-feed`; the mobile view had no horizontal overflow and no page errors were reported. These tests simulate a native sender; an actual simulator integration still depends on its WebSocket support.

The cabin repair completed two geometry and independent visual-review passes. The final five-view matrix covers Highway in light/dark desktop themes, the two-lane Road, Elevated road and a 390 px mobile view; the second review found no visible body holes in those captures. Before and after images are in `/private/tmp/drivescene-cabin`. `tests/driver-view.test.mjs` checks 56 side-body rays, 15 front-body rays and 255 lower-camera rays against opaque geometry, while nine forward-window and two side-window rays remain clear. All nine unit tests passed with the repair. These sampled sightlines and rendered views verify the repaired shell; they do not establish exhaustive geometry coverage or hardware performance.

With the repaired cabin, a five-second Highway Driver run at 300 km/h measured 59.99 fps and 416.65 m of travel in hardware-accelerated Chrome on an Apple M2 Pro. The preview rendered at 880 × 495 within a 1440 × 1000 desktop viewport. Mean CPU submission time was 1.78 ms, p95 2.5 ms; these are CPU submission measurements, not GPU timings. Results are in `/private/tmp/drivescene-cabin/performance/results.json`. This short run does not establish sustained or mobile hardware performance.

Earlier measurements, before the cabin shell repair, used hardware-accelerated headless Chrome reporting ANGLE Metal on an Apple M2 Pro. Five-second windows measured about 60 fps for Road, Highway and Elevated road at 1440 × 810. Highway Driver at 1920 × 1080 also measured about 60 fps, with mean GPU time 6.44 ms and p95 8.31 ms. These are short desktop measurements of the earlier geometry; mobile viewport checks do not establish mobile hardware performance or sustained thermal behaviour. The recycling check is a direct distance advance, not a real-time 100 km endurance run.
