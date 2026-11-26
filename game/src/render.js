// The look of CALDERA RUN: a dusk sea, the terraced archipelago, a smoking stratovolcano, the
// glowing ring course and a low chase camera with a smooth bank follow. Background is held
// desaturated slate-teal; only the plane, the rings and the HUD carry real saturation.
import { COLORS, VOLCANO, RUNWAY, WORLD_SIZE } from './config.js';
import { buildField, runwayFrame, resolveCourse } from './terrain.js';
import { createAircraft } from './aircraft.js';

const DEG = Math.PI / 180;

export function createRenderer(canvas, seed) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.98;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(COLORS.skyHorizon);
  scene.fog = new THREE.Fog(COLORS.haze, 2400, 9200);

  const camera = new THREE.PerspectiveCamera(58, 16 / 9, 0.8, 14000);
  camera.position.set(0, 300, 0);

  const course = resolveCourse(seed);
  return finishSetup(renderer, scene, camera, seed, course);
}

/** Sky dome, sunlight, sea and fog: the fixed lighting rig for every frame. */
function buildSky(scene) {
  const skyGeo = new THREE.SphereGeometry(9000, 32, 20);
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      top: { value: new THREE.Color(COLORS.skyTop) },
      horizon: { value: new THREE.Color(COLORS.skyHorizon) },
      sea: { value: new THREE.Color(COLORS.haze) },
    },
    vertexShader: `
      varying vec3 vPos;
      void main() {
        vPos = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform vec3 top; uniform vec3 horizon; uniform vec3 sea;
      varying vec3 vPos;
      void main() {
        float h = normalize(vPos).y;
        float up = smoothstep(0.0, 0.55, h);
        vec3 c = mix(horizon, top, up);
        c = mix(sea, c, smoothstep(-0.16, 0.02, h));
        gl_FragColor = vec4(c, 1.0);
      }`,
  });
  scene.add(new THREE.Mesh(skyGeo, skyMat));

  const hemi = new THREE.HemisphereLight(0x8fb6d6, 0x18272a, 0.5);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight(0xffc98c, 1.15);
  sun.position.set(-2200, 1700, 2400);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.near = 400;
  sun.shadow.camera.far = 8000;
  const span = 2200;
  sun.shadow.camera.left = -span;
  sun.shadow.camera.right = span;
  sun.shadow.camera.top = span;
  sun.shadow.camera.bottom = -span;
  sun.shadow.bias = -0.0012;
  scene.add(sun);
  scene.add(sun.target);
  return sun;
}

/** Sea: a big low-poly plane with gentle vertex swell, deep teal under a warm dusk. */
function buildSea(scene) {
  const geo = new THREE.PlaneGeometry(WORLD_SIZE * 3, WORLD_SIZE * 3, 90, 90);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    pos.setY(i, Math.sin(x * 0.004) * 1.4 + Math.cos(z * 0.0033) * 1.1);
  }
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({
    color: COLORS.sea, roughness: 0.22, metalness: 0.55, flatShading: true,
  });
  const sea = new THREE.Mesh(geo, mat);
  sea.position.y = -2;
  sea.receiveShadow = true;
  scene.add(sea);
  return sea;
}

/** A chunky sea stack or two, to break up the flat water and give the eye scale. */
function buildSeaStacks(scene, seed) {
  const rock = new THREE.MeshStandardMaterial({ color: COLORS.rock, roughness: 0.9, flatShading: true });
  const spots = [[2480, 1900, 54], [2740, 1540, 32], [-2540, 2100, 46], [1900, -2620, 40]];
  for (const [x, z, h] of spots) {
    const geo = new THREE.ConeGeometry(h * 0.6, h, 7);
    const mesh = new THREE.Mesh(geo, rock);
    mesh.position.set(x, h * 0.32 - 6, z);
    mesh.rotation.y = seed * 0.7;
    scene.add(mesh);
  }
}

/** Terrain mesh from the shared heightfield, plus the volcanic plume, lava lake and ash cone. */
function buildTerrain(scene, seed) {
  const field = buildField(seed);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(field.positions, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(field.colors, 3));
  geo.setIndex(new THREE.BufferAttribute(field.indices, 1));
  geo.computeVertexNormals();
  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.92, metalness: 0.02, flatShading: true,
  });
  const terrain = new THREE.Mesh(geo, mat);
  terrain.receiveShadow = true;
  terrain.castShadow = true;
  scene.add(terrain);

  const lava = new THREE.Mesh(
    new THREE.CircleGeometry(VOLCANO.crater * 0.86, 26),
    new THREE.MeshBasicMaterial({ color: COLORS.lavaHot }),
  );
  lava.rotation.x = -Math.PI / 2;
  lava.position.set(VOLCANO.x, VOLCANO.lavaY - 24, VOLCANO.z);
  scene.add(lava);

  const glow = new THREE.PointLight(COLORS.lava, 1.2, 1500, 2);
  glow.position.set(VOLCANO.x, VOLCANO.lavaY + 40, VOLCANO.z);
  scene.add(glow);

  // Ash plume: stacked translucent puffs, warm near the crater and grey as it rises.
  const plume = new THREE.Group();
  for (let i = 0; i < 16; i += 1) {
    const t = i / 15;
    const radius = 120 + t * 340;
    const mat2 = new THREE.MeshStandardMaterial({
      color: new THREE.Color(COLORS.ash).lerp(new THREE.Color(0x2b2f36), t),
      transparent: true,
      opacity: 0.3 - t * 0.18,
      roughness: 1,
      depthWrite: false,
    });
    const puff = new THREE.Mesh(new THREE.IcosahedronGeometry(radius, 1), mat2);
    puff.position.set(
      VOLCANO.x + Math.sin(i * 1.7) * (30 + t * 260),
      VOLCANO.lavaY + 60 + t * 1250,
      VOLCANO.z + Math.cos(i * 1.3) * (30 + t * 180),
    );
    puff.scale.y = 0.6;
    plume.add(puff);
  }
  scene.add(plume);

  return { terrain, plume, lava };
}

/** Runway: asphalt strip on the pad, threshold bars, edge lights and a chevron aiming point. */
function buildRunway(scene, course) {
  const group = new THREE.Group();
  const rad = RUNWAY.heading * DEG;
  const centre = new THREE.Vector3(RUNWAY.x, course.runwayY + 0.4, RUNWAY.z);
  group.position.copy(centre);
  group.rotation.y = -rad;

  const asphalt = new THREE.Mesh(
    new THREE.PlaneGeometry(RUNWAY.width, RUNWAY.length),
    new THREE.MeshStandardMaterial({ color: 0x24272c, roughness: 0.95 }),
  );
  asphalt.rotation.x = -Math.PI / 2;
  asphalt.position.y = 0.25;
  asphalt.receiveShadow = true;
  group.add(asphalt);

  const stripe = new THREE.Mesh(
    new THREE.PlaneGeometry(2.4, RUNWAY.length * 0.92),
    new THREE.MeshBasicMaterial({ color: 0xd8d2c4 }),
  );
  stripe.rotation.x = -Math.PI / 2;
  stripe.position.y = 0.32;
  group.add(stripe);

  // Threshold piano keys and touchdown-zone blocks, both ends.
  for (const end of [-1, 1]) {
    for (let i = -3; i <= 3; i += 1) {
      if (i === 0) continue;
      const key = new THREE.Mesh(
        new THREE.PlaneGeometry(3.6, 18),
        new THREE.MeshBasicMaterial({ color: 0xe8e2d4 }),
      );
      key.rotation.x = -Math.PI / 2;
      key.position.set(i * 6.4, 0.34, end * (RUNWAY.length / 2 - 24));
      group.add(key);
    }
    for (let i = 0; i < 3; i += 1) {
      for (const side of [-1, 1]) {
        const block = new THREE.Mesh(
          new THREE.PlaneGeometry(3, 16),
          new THREE.MeshBasicMaterial({ color: 0xcfc8b8 }),
        );
        block.rotation.x = -Math.PI / 2;
        block.position.set(side * 8, 0.34, end * (RUNWAY.length / 2 - 90 - i * 60));
        group.add(block);
      }
    }
  }

  // Edge lights: chevrons of amber, bright enough to read from the air.
  const lightGeo = new THREE.SphereGeometry(1.5, 6, 5);
  const amber = new THREE.MeshBasicMaterial({ color: 0xffb43c });
  const white = new THREE.MeshBasicMaterial({ color: 0xeaf4ff });
  for (let i = 0; i <= 22; i += 1) {
    const z = -RUNWAY.length / 2 + (i / 22) * RUNWAY.length;
    for (const side of [-1, 1]) {
      const lamp = new THREE.Mesh(lightGeo, i > 20 ? white : amber);
      lamp.position.set(side * (RUNWAY.width / 2 + 2), 1.2, z);
      group.add(lamp);
    }
  }

  // Windsock and a small control hut, a human-scale anchor beside the strip.
  const hut = new THREE.Mesh(
    new THREE.BoxGeometry(16, 9, 12),
    new THREE.MeshStandardMaterial({ color: 0xb8b2a4, roughness: 0.8, flatShading: true }),
  );
  hut.position.set(-RUNWAY.width / 2 - 26, 4.5, -RUNWAY.length / 2 + 70);
  hut.castShadow = true;
  hut.receiveShadow = true;
  group.add(hut);
  const roof = new THREE.Mesh(
    new THREE.ConeGeometry(15, 6, 4),
    new THREE.MeshStandardMaterial({ color: COLORS.orange, roughness: 0.6, flatShading: true }),
  );
  roof.position.set(-RUNWAY.width / 2 - 26, 11.5, -RUNWAY.length / 2 + 70);
  roof.rotation.y = Math.PI / 4;
  group.add(roof);

  scene.add(group);
  return group;
}

/** The glowing caldera rings: a torus, a halo and a numbered pylon marking each scan point. */
function buildRings(scene, course) {
  const rings = [];
  const ringMat = new THREE.MeshStandardMaterial({
    color: 0xffb04a, emissive: 0xff8a1e, emissiveIntensity: 1.5, roughness: 0.3, metalness: 0.1,
  });
  const gateMat = new THREE.MeshStandardMaterial({
    color: 0x6ff0ff, emissive: 0x2fd8ff, emissiveIntensity: 1.3, roughness: 0.3, metalness: 0.1,
  });
  course.rings.forEach((ring, index) => {
    const group = new THREE.Group();
    group.position.set(ring.x, ring.y, ring.z);
    const isGate = ring.kind === 'gate';
    const mat = isGate ? gateMat : ringMat;
    const torus = new THREE.Mesh(new THREE.TorusGeometry(ring.r, ring.r * 0.085, 10, 40), mat);
    torus.castShadow = true;
    group.add(torus);
    // Halo: a thin bloom just behind the solid torus. Kept deliberately tight (thin tube, low
    // opacity) so the ring reads as a clean hoop, not a bloated disc; the main torus is untouched.
    const halo = new THREE.Mesh(
      new THREE.TorusGeometry(ring.r * 0.98, ring.r * 0.017, 6, 28),
      new THREE.MeshBasicMaterial({
        color: isGate ? 0x7ff4ff : 0xffa03a, transparent: true, opacity: 0.1, depthWrite: false,
      }),
    );
    group.add(halo);
    // A pylon under the ring so the hoop reads as a placed marker, not floating noise.
    const pylon = new THREE.Mesh(
      new THREE.CylinderGeometry(1.6, 4.2, ring.r * 1.3, 6),
      new THREE.MeshStandardMaterial({ color: 0x2f3a44, roughness: 0.9, flatShading: true }),
    );
    pylon.position.y = -ring.r - ring.r * 0.5;
    group.add(pylon);
    const beacon = new THREE.Mesh(
      new THREE.CylinderGeometry(ring.r * 0.16, ring.r * 0.24, 12, 8),
      new THREE.MeshBasicMaterial({ color: isGate ? 0x7ff4ff : 0xffb44a }),
    );
    beacon.position.y = -ring.r - 5;
    group.add(beacon);
    scene.add(group);
    rings.push({ group, torus, halo, spec: ring, index, isGate });
  });
  return rings;
}

/** The low chase camera: behind and above, 12 degrees down, banking with the plane but lagging. */
function createChase() {
  return { heading: 0, y: 0, initialised: false };
}

/**
 * Camera framing presets. `chase` is the flight camera; `vista` is a lower, pulled-back approach
 * used only for the staged vista shot, aiming a little above the nose so the coastal terrain and
 * the volcano fill the frame behind the plane instead of looking straight down on it.
 */
const CAMERA_MODES = {
  chase: { back: 21, up: 7.2, ahead: 34, lookUp: -2.4, lag: true },
  vista: { back: 26, up: 4.5, ahead: 55, lookUp: 11, lag: false },
};

function placeCamera(camera, state, chase, dt, snap = false, mode = 'chase') {
  const preset = CAMERA_MODES[mode] ?? CAMERA_MODES.chase;
  if (!chase.initialised) {
    chase.heading = state.heading;
    chase.pitch = 0;
    chase.initialised = true;
  }
  // The vista shot snaps straight to its framing so one staged frame carries no follow lag.
  const follow = preset.lag ? Math.min(1, dt * 3.2) : 1;
  chase.heading = ((chase.heading + ((((state.heading - chase.heading + 540) % 360) - 180)) * follow) + 360) % 360;
  chase.pitch += (state.pitch * 0.5 - chase.pitch) * (preset.lag ? Math.min(1, dt * 2.5) : 1);

  const { back, up, ahead, lookUp } = preset;
  const rad = chase.heading * DEG;
  const px = state.pos.x - Math.sin(rad) * back;
  const pz = state.pos.z + Math.cos(rad) * back;
  const py = state.pos.y + up + Math.sin(chase.pitch) * 4;
  const kx = snap || !preset.lag ? 1 : Math.min(1, dt * 9);
  const ky = snap || !preset.lag ? 1 : Math.min(1, dt * 7);
  const kz = snap || !preset.lag ? 1 : Math.min(1, dt * 9);
  camera.position.x += (px - camera.position.x) * kx;
  camera.position.y += (py - camera.position.y) * ky;
  camera.position.z += (pz - camera.position.z) * kz;

  camera.up.set(0, 1, 0);
  camera.lookAt(
    state.pos.x + Math.sin(state.heading * DEG) * ahead,
    state.pos.y + Math.sin(state.pitch) * 18 + lookUp,
    state.pos.z - Math.cos(state.heading * DEG) * ahead,
  );
  camera.rotateZ(-state.roll * 0.42);
  camera.fov = 56 + Math.min(14, Math.abs(state.speed - 40) * 0.5);
  camera.updateProjectionMatrix();
}

/** Assemble the whole scene and return the render API the game loop and shots use. */
function finishSetup(renderer, scene, camera, seed, course) {
  buildSky(scene);
  const sea = buildSea(scene);
  buildSeaStacks(scene, seed);
  const terrain = buildTerrain(scene, seed);
  const runway = buildRunway(scene, course);
  const rings = buildRings(scene, course);
  const plane = createAircraft();
  scene.add(plane.group);

  const chase = createChase();
  let clock = 0;

  function resize(width, height) {
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  /** Move everything to match one world state and draw a frame. */
  function draw(state, dt = 1 / 60, snap = false, cameraMode = 'chase') {
    clock += dt;
    const rad = state.heading * DEG;
    plane.group.position.set(state.pos.x, state.pos.y, state.pos.z);
    plane.group.rotation.set(0, 0, 0);
    plane.group.rotateY(-rad);
    plane.group.rotateX(state.pitch * 0.9);
    plane.group.rotateZ(-state.roll);
    plane.prop.rotation.z += dt * (8 + state.throttle * 46);

    // Rings: the next target pulses, cleared ones dim; a passed ring flares on the flash.
    rings.forEach((ring) => {
      const cleared = ring.index < state.ringIndex;
      const isNext = ring.index === state.ringIndex;
      const pulse = 1 + Math.sin(clock * 3 + ring.index) * 0.05;
      ring.group.scale.setScalar(isNext ? pulse : 1);
      ring.torus.material.opacity = cleared ? 0.32 : 1;
      ring.torus.material.transparent = cleared;
      ring.halo.material.opacity = cleared ? 0.02 : isNext ? 0.09 + Math.sin(clock * 4) * 0.03 : 0.045;
    });

    const flash = state.ringFlash;
    if (flash > 0 && state.lastRing) {
      const spec = state.lastRing;
      rings.forEach((ring) => {
        if (ring.spec.x === spec.x && ring.spec.z === spec.z) {
          ring.group.scale.setScalar(1 + flash * 0.22);
          ring.halo.material.opacity = 0.08 + flash * 0.17;
        }
      });
    }

    sea.position.x = state.pos.x * 0.92;
    sea.position.z = state.pos.z * 0.92;
    placeCamera(camera, state, chase, dt, snap, cameraMode);
    renderer.render(scene, camera);
  }

  return { renderer, scene, camera, draw, resize, rings, plane };
}
