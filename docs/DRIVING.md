# Driving implementation

## Implementation plan — completed

1. Add a speed controller that integrates physical distance and supports Play/Pause, Reset and lifecycle suspension.
2. Generate continuous road surfaces and recycle a bounded, seeded pool of roadside buildings, trees and lawns.
3. Add the divided Highway layout with four travel lanes, two outer safety lanes and white markings.
4. Add a driver's-seat camera and procedural cabin without a steering wheel or instrument cluster.
5. Integrate editor controls, the external speed API, URL restore, scene changes and frozen PNG export.
6. Rebuild the shipped bundle; verify geometry, distance, recycling, camera views, desktop/mobile controls, regressions and GPU performance.

## Delivered scope

Road, Elevated road and the Highway layout support continuous straight travel controlled by live speed in km/h. Junction approaches, ramps and parking retain their finite compositions. Continuous driving has no steering, collision simulation, traffic behaviour or built-in telemetry connection.

- **Layout:** Road retains 2, 4 and 6 lane choices. Highway fixes four travel lanes total, two per direction, each 3.7 m wide. A 3 m central divider separates the carriageways; each outer side has a 3 m safety lane. Lane dividers are dashed white and edges are solid white.
- **Camera:** Low and High retain exterior viewpoints. Driver is available on Road and Elevated road, including Highway, with a left-hand driver's-seat position, open windshield, A pillars, roof trim and bonnet. It contains no steering wheel, dashboard or instrument cluster. Driver hides the exterior vehicle and its switch; Low/High restore the switch and saved vehicle setting.
- **Transport:** a number field and keyboard-operable slider accept 0–200 km/h. Play/Pause controls continuous travel; zero speed stops distance accumulation. Reset restores the initial seeded scenery and zero distance without changing speed or the Play/Pause selection.
- **Scenery:** 40 fixed roadside slots, 20 per side, recycle behind the viewpoint. A deterministic seed varies building width, depth, height, setback, longitudinal jitter, tree scale and tree offset. Scene changes preserve travelled distance.

The added controls reuse the editor's existing light/dark surfaces, typography, rounded choices and spacing. Desktop and mobile screenshots were checked against that incumbent system. No shipping raster assets or new visual identity files were introduced.

## Architecture

- `driving.js`: speed validation, playback, suspension and distance integration. Distance advances by `speedKmh / 3.6 × elapsedSeconds`; each frame's elapsed time is capped at 0.1 seconds to prevent large catch-up jumps. Speed is in km/h, distance in metres.
- `driving-road.js`: continuous road surfaces, periodic lane markings and a fixed pool of seeded roadside sites. Uniform asphalt and rails remain stationary because their translation would look identical. Markings, roadside scenery and bridge supports move towards positive Z as the car travels forwards.
- `driver-view.js`: a separate procedural cabin. The supplied vehicle's opaque windows make it unsuitable for an interior camera.
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

`setSpeedKmh(value)` returns the accepted speed, clamped to 0–200; non-finite values become zero. `getState()` returns `{ speedKmh, playing, running, distanceMetres, supported }`. `playing` records the requested playback state; `running` also requires nonzero speed, a supported scene and no suspension. Speed samples do not implicitly press Play. The API configures the local preview; callers supply their own speed source.

## Verification

The implementation passed:

```sh
npm run build
npm test
npm run test:browser
```

The browser verification loads the built bundle and exercises real scene controls, with a test-only inspection hook served in memory that does not alter the shipped bundle. Set `CHROMIUM_PATH` to a local Chrome executable when needed. Screenshots and results are written to `/private/tmp/drivescene-verification`.

The verified run covered speed changes, zero speed, pause/reset, deterministic scenery, Highway geometry, Driver camera, both themes, URL restore, reduced motion, tab visibility and export. Parking, junction, ramp, Elevated road and coast regression checks passed. The keyboard slider and 390 × 844 mobile viewport passed; no page errors or missing assets were reported. The recycling check advanced the scene to 100,000 m and retained all 40 roadside slots, with the renderer geometry count unchanged at 437 before and after. The downloaded PNG decoded to 1920 × 1080.

Hardware-accelerated headless Chrome reported ANGLE Metal on an Apple M2 Pro. Five-second windows measured about 60 fps for Road, Highway and Elevated road at 1440 × 810. Highway Driver at 1920 × 1080 also measured about 60 fps, with mean GPU time 6.44 ms and p95 8.31 ms. These are short desktop measurements; mobile viewport checks do not establish mobile hardware performance or sustained thermal behaviour. The recycling check is a direct distance advance, not a real-time 100 km endurance run.
