# DriveScene Studio

This fork keeps [interactive driving](./index.html?scene=20&view=driver&speed=90&trees=1) at the root, with manual or WebSocket speed, Driver camera, suspension and Highway controls. The latest upstream [Studio workbench](./studio/ui-draft/) is also included, with its own Assist playback, traffic, vehicles and export tools. The fork's speed feed and suspension controls belong to the root application.

### 3D Backgrounds for Cockpit UI Design

An open-source workbench for designing intelligent-driving SR visualizations and automotive cockpit interfaces. Choose a driving or parking scenario, adjust its appearance, vehicle and camera, and export a 1920 × 1080 or 3840 × 2160 PNG to use in your layout.

[Open the live tool](https://paxton0209.github.io/DriveScene-Studio/studio/ui-draft/) · Created by Peixin

[![XERJ Corpus Hub contributor](https://hub.xerj.org/contributors/Paxton0209/badge.svg)](https://hub.xerj.org/contributors/Paxton0209)

![Current DriveScene background used in a cockpit interface concept, shown inside a vehicle](docs/cockpit-in-context.png)

## Why this project exists

A driver's view is shaped by the vehicle around them. A-, B- and C-pillars, and D-pillars where present, can obscure parts of the surroundings when turning, changing lanes or manoeuvring. Exterior cameras and other sensors observe the environment from different positions. When their inputs are combined, a vehicle can build an environmental model that supplements the driver's direct view. SR visualizations bring selected parts of that model into the cockpit interface, showing the road layout and detected objects around the vehicle. What they can show depends on sensor coverage and detection quality; a visualization cannot guarantee a complete view of every hazard.

For an interface designer, building an SR concept often means working with a 3D designer on road geometry, vehicle placement, camera framing, materials and lighting. Each new scenario or layout can require another round of modelling and colour adjustment. At the same time, the SR scene shares attention with speed, navigation, alerts and controls. Detailed scenery, strong colours and dense geometry can make those UI elements harder to distinguish.

This project provides a reusable starting point for that work: simplified environments with restrained colours and adjustable scene elements. Designers can compare common driving and parking contexts, choose the amount of environmental detail they need, and bring a consistent background into a cockpit layout without rebuilding the scene for every iteration. It supports early exploration of composition and visual hierarchy; it does not evaluate driving safety or connect to a vehicle's perception system.

## From background to cockpit interface

![Cockpit interface concept with an SR junction, speed display, turn guidance, map controls and arrival information](docs/cockpit-navigation-dark.png)

This example comes from the project's Figma design workspace. The SR scene sits alongside navigation, with speed and other UI information layered over a quiet environment. Its geometry remains readable while the interface retains its hierarchy. The complete cockpit screen illustrates how an exported background can be used in interface design; the website exports the scene itself, without speed labels, navigation or app controls.

Start with the closest driving or parking scenario, adjust the camera and visual density, then download the PNG and place it in Figma or another design tool. Add your interface elements and check how they read over the scene. When the layout changes, return to the tool to compare another viewpoint or reduce environmental detail.

## What you can configure

| Control | Available choices |
| --- | --- |
| Driving scenario | Road, elevated road, junction and ramp |
| Parking scenario | Indoor and outdoor parking |
| Appearance | Light and dark modes for day/night interface exploration |
| Road layout | Road with 2, 4 or 6 lanes; Highway with two travel lanes each way, central divider and 3 m outer safety lanes |
| Junction and ramp | Crossroads or T-junction; exit or merge |
| Camera | Low/high road and ramp views; Driver on Road and Elevated road; scenario-specific parking viewpoints, including bird's-eye views |
| Continuous driving | Live speed input from 0–300 km/h, Play/Pause, Reset and distance travelled on Road and Elevated road, including Highway |
| Suspension stiffness | 0–100%, default 50%; higher values reduce acceleration/braking pitch, 100% keeps the body rigid |
| Simulator speed input | WebSocket endpoint with Connect/Disconnect; plain numeric or JSON speed samples in km/h |
| Vehicle | BMW X6, Tesla Model 3, BMW iX or Volvo XC90 |
| Scene elements | Vehicle, buildings, trees, waterfront and roadworks, where supported by the selected scenario |
| Export | 1080p PNG, camera JSON, depth PNG and perspective kit; the new workbench also supports 4K and video |

Camera changes animate through the 3D scene; other options use short transitions. Reduced-motion preferences are respected. Elevated roads and ramp mainlines have separated opposing carriageways; the elevated deck sits 8.5 m above ground with ground-level side streets and bridge supports.

Options follow the selected scenario. Light and dark modes provide visual themes for design exploration, rather than a physical simulation of changing daylight. The workbench adapts to desktop and mobile screens; scene and vehicle selectors sit above the canvas on mobile, with controls grouped below it. Use Assist to preview a driving path or a parking manoeuvre. Traffic can be enabled separately.

Use the vehicle selector to choose a model without changing the scene or camera. It supports arrow keys, Home and End, reuses recently prepared models within a bounded resource budget, and preserves the current vehicle if a new model cannot load. Indoor and outdoor parking share the same bay dimensions and spacing. Model attribution follows the selected vehicle in perspective-kit exports; additional sources and preparation notices are in [vehicle-library/CREDITS.md](vehicle-library/CREDITS.md).

## Camera, depth and Figma alignment

Choose **Format** and **Size** in the Export section, use **Preview** to check the framing, then click **Export**. PNG is selected by default. If the browser does not offer a Save As dialog, choose **Download** once the export is ready. **Perspective kit**, **Camera settings** and **Depth map** support scene alignment; driving scenes also offer video export. The kit contains the matching scene PNG, camera JSON, depth PNG and a transparent perspective SVG. The instructions below explain how to use the files. Active scene and camera animations settle to the selected endpoint before still capture; all files in a kit describe that same final frame.

Place `scene.png` and `perspective.svg` at (0, 0) in a Figma frame matching the selected export size, without cropping: 1920 × 1080 or 3840 × 2160. The SVG grid uses 1 m columns and 5 m rows on a horizontal plane at the ego vehicle's road height. A 2 m × 3.5 m reference arrow starts 18 m ahead. Use it to align navigation artwork, then hide the reference layer. The guide does not follow branch/ramp geometry or account for occlusion. Figma does not import the JSON as a 3D camera or automatically perspective-warp artwork.

The camera JSON includes the full projection and view matrices, orientation, FOV, clipping planes and view offset. Matrices are column-major; world units are meters with Y up, and the camera faces local -Z. The image origin is top-left. Preserve the projection matrix, including the view offset, when recreating the camera.

Depth PNG is 16-bit linear grayscale camera-space Z distance: `meters = uint16 / 65535 * 200`. Near geometry is dark; sky and distances at or beyond 200 m are white. Depth edges are not antialiased, and decorative transparency, glow and contact shadows are excluded. Water is represented by its surface. These depths support compositing and geometry workflows; use the SVG for manual Figma alignment. The package includes environment and vehicle attribution.

## Continuous driving in this fork

Choose Road or Elevated road, set the speed with the number field or slider under the preview, then press Play. Speed, Play/Pause and Reset share one row when space permits; on narrow previews, the slider spans a second row. Status and distance sit below. Changing speed while playing immediately changes the rate of travel; 0 km/h stops travel while any suspension response settles. Lane markings and roadside scenery move according to distance in metres. A fixed, seeded pool varies building dimensions, roadside setbacks and tree placement as sites recycle. Reset returns the distance and scenery sequence to their start and levels the body while keeping the current speed and playback selection. Junctions, ramps and parking keep their finite compositions and existing camera controls.

Speed increases briefly tip the body and Driver camera nose up, while speed reductions tip them nose down. A progressive spring adds resistance as dive grows, with a smooth bump-stop region near the travel limit and stronger rebound damping for a controlled return to level; wheels stay planted. **Suspension stiffness**, in scene settings alongside the WebSocket feed controls, controls the amount: 0% is softest, 50% is the default and 100% is rigid. This is a restrained visual response, not calibrated vehicle physics. Pausing or exporting freezes the pose; Reset levels it. The URL restores stiffness without restoring a transient pitch.

Within Road, choose Layout → Highway for four travel lanes total: two in each direction, separated by a central divider, with a 3 m safety lane on each outer side. Lane dividers are dashed white and edges are solid white. The Highway lane count is fixed. Driver places the camera in a left-hand driver's seat inside a closed cabin shell, with solid door panels, a floor and body enclosure around intentionally clear window openings. Slim tapered A pillars connect to the roof and window belts; seals and a shaped bonnet frame the road view. The cabin has no steering wheel, dashboard or instrument cluster. It hides the exterior vehicle and its switch; Low and High restore the switch and the saved vehicle setting.

Playback suspends while the tab is hidden, Credits is open or a scene export is being captured, and resumes when the scene becomes active again if Play remains selected. Export captures a frozen 1920 × 1080 frame. URL state preserves speed and playback selection; reduced-motion preferences block URL autoplay, while explicit Play remains available.

For a simulator or native application, enter its WebSocket endpoint under **WebSocket speed feed** and press Connect. Send text such as `90` or `{"speedKmh":90}`. Incoming samples update speed without starting playback; press Play to begin travel. The manual speed controls are disabled while connecting or connected. Unexpected connection loss pauses driving and restores manual input; Disconnect keeps the latest speed and playback selection.

An optional local relay is included. After `npm install`, run `npm run speed-feed -- 90` in a second terminal alongside `npm run dev`. Connect both the simulator and the browser to `ws://127.0.0.1:9001`; the simulator sends speed samples and the relay forwards them to the scene. The relay starts at 90 km/h and sends the latest speed to newly connected clients. A native application can also host its own WebSocket endpoint. UDP/OSC sources can use a native bridge that forwards their speed as WebSocket text.

Use the locally served HTTP app for the local relay. Access from a remote HTTPS page to a local endpoint depends on browser local-network permissions; secure hosted endpoints should use `wss://`. External sources running in the page can also call `window.driveScene.setSpeedKmh(value)`, alongside `setSuspensionStiffness(value)`, `play()`, `pause()`, `reset()`, `connectSpeedFeed(url)`, `disconnectSpeedFeed()` and `getState()`. No connection is configured automatically. See [the implementation and verification notes](docs/DRIVING.md) for protocol, relay configuration and the API.

## Scene preview

![Current DriveScene Studio desktop workbench with scene and vehicle selection, a live canvas and grouped controls](docs/studio-workbench.png)

![Road, elevated road, junction, ramp, indoor parking and outdoor parking in matching light and dark themes](docs/scene-families.jpg)

## SR colour specification

The scenes use a restrained, cool palette so that speed, navigation and alerts stay on top. Saturated orange is reserved for roadwork elements. The [SR colour specification](docs/SR-COLOR.md) lists the base scene colours in light and dark themes, lighting values and workbench-specific finish adjustments.

<p><img src="docs/sr-color-paired-light.png" alt="SR colour specification in light mode, with cockpit context and scene families" width="1200"><br><img src="docs/sr-color-paired-dark.png" alt="The matching SR colour specification in dark mode" width="1200"></p>

## Run

The checked-in bundles are ready to use. Serve the repository root with any static web server. For example, run `python3 -m http.server 8000` and open [interactive driving](http://localhost:8000/) or [the upstream workbench](http://localhost:8000/studio/ui-draft/). Use an HTTP URL so the renderer can load its modules, models and other assets.

## Develop

Open `DriveScene-Studio.code-workspace` in VS Code. After running `npm install` once, choose **Run DriveScene Studio** in Run and Debug and press **F5** (or the green play button). This starts a local development server and opens Chrome on the Highway Driver view. Press Play in the app to start driving. Source maps support breakpoints in the original JavaScript modules. Stop the **Run DriveScene Studio** server debug session to stop the server and its browser debug session.

You can also run `npm run dev` and open http://127.0.0.1:8000. Development builds stay in memory, leaving the checked-in production bundle untouched. Source edits rebuild automatically; refresh the browser to see them. Set `DRIVESCENE_PORT` to use another port. The **Build production bundle** task (Ctrl/Cmd+Shift+B) runs `npm run build` for the distributable bundle.

Install Node.js and run `npm install`. Build the current workbench with `node studio/ui-draft/build.mjs`; `npm run build` builds the original root application. Source modules are included beside the prebuilt bundles. Prepared vehicle assets, cached framing geometry and asynchronous shader preparation reduce initialization work. A scene-matched poster covers the canvas while the renderer initializes, and recently prepared vehicles and scenes are reused within bounded caches. Previews adapt their resolution to the display size. Still-image exports use a 4K render, with high-quality downsampling when 1080p is selected. See [the preparation recipe](scripts/README.md) and [vehicle attribution](vehicle-library/CREDITS.md) for the source and delivery assets.

## Hosting

Deploy this folder to a static HTTPS host. All runtime assets are relative to this folder, so it can run in a GitHub Pages project subdirectory. No API, backend or secret is needed.

## Contents and attribution

This repository contains the DriveScene Studio website, its runtime assets and rendered cockpit examples used in this README. Editable Figma files, internal review pages, feedback and comparison screenshots are excluded. The cockpit examples are illustrative UI compositions; their third-party app icons, vehicle-interior photography and other third-party elements are not relicensed as original project assets. See CREDITS.md and THREE-LICENSE.txt for runtime attribution. The vehicle declares CC BY 4.0 in embedded metadata; keep its attribution. The Visual key reference section and its reference images are excluded from this website package.


## License

Original application code is licensed under [MIT](LICENSE), copyright (c) 2026 Peixin. Original environments and rendered backgrounds are [CC BY 4.0](ASSET-LICENSE.md). The bundled vehicle and third-party code retain their own notices in [CREDITS.md](CREDITS.md) and [THREE-LICENSE.txt](THREE-LICENSE.txt). The Meshopt decoder license is in [MESHOPT-LICENSE.txt](MESHOPT-LICENSE.txt). Include both environment and vehicle attribution when sharing an exported image that contains the vehicle.

## Background reading

[Tesla's driving visualization documentation](https://www.tesla.com/ownersmanual/model3/en_us/GUID-2CB60804-9CEA-4F4B-8B04-09B991368DC5.html) illustrates how detected roads and objects can be represented on a cockpit display. [Volvo's camera limitations documentation](https://www.volvocars.com/en-sa/support/car/v90/16w46/article/dcc0393b8976b065c0a80151160585ff/) describes gaps in camera coverage. These references provide context for SR interface exploration and do not indicate an affiliation with either manufacturer.


## Download additional vehicle models

The [vehicle library](vehicle-library/README.md) contains complete original BMW iX, Volvo XC90, Tesla Model 3 (2024), Tesla Model Y and Porsche Taycan assets, plus four prepared delivery variants. It includes attribution, checksums and a standard-library Python downloader for use on another computer. Run `python3 vehicle-library/download.py --output vehicle-models` after cloning.
