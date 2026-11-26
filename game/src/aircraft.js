// CALDERA RUN's seaplane, built entirely from three.js primitives: a high-wing twin-boom
// amphibian with a cobalt hull, safety-orange wingtips and boom tails, a glass canopy and two
// floats. One colour scheme, no textures, so it reads at a glance in a screenshot.
import { COLORS } from './config.js';

const DEG = Math.PI / 180;

function paint(color, roughness = 0.42, metalness = 0.25, emissive = 0x000000, emissiveIntensity = 0) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness, emissive, emissiveIntensity });
}

export function createAircraft() {
  const group = new THREE.Group();
  const body = paint(COLORS.plane, 0.38, 0.35);
  const dark = paint(COLORS.plane2, 0.5, 0.3);
  const accent = paint(COLORS.orange, 0.35, 0.15, COLORS.orange, 0.18);
  const metal = paint(0x9aa4b0, 0.3, 0.8);
  const glass = new THREE.MeshStandardMaterial({
    color: COLORS.glass, roughness: 0.08, metalness: 0.5, transparent: true, opacity: 0.72,
  });

  const add = (geometry, material, x, y, z, rx = 0, ry = 0, rz = 0) => {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(x, y, z);
    mesh.rotation.set(rx, ry, rz);
    group.add(mesh);
    return mesh;
  };

  // Fuselage: nose cone, barrel, tapered tail, all along local -z (forward).
  add(new THREE.ConeGeometry(0.95, 2.6, 14), body, 0, 0, -3.1, -Math.PI / 2, 0, 0);
  add(new THREE.CylinderGeometry(1.05, 0.95, 4.6, 16), body, 0, 0, -0.1, Math.PI / 2, 0, 0);
  add(new THREE.CylinderGeometry(0.34, 0.92, 2.8, 14), dark, 0, 0.18, 3.5, Math.PI / 2, 0, 0);

  // Canopy and cockpit glass.
  add(new THREE.SphereGeometry(0.82, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), glass, 0, 0.72, -0.4);
  add(new THREE.BoxGeometry(1.5, 0.5, 1.5), glass, 0, 0.68, -1.5, 0, 0, 0);

  // High wing across the fuselage, with orange tips.
  add(new THREE.BoxGeometry(11.4, 0.24, 2.05), body, 0, 1.06, -0.55);
  add(new THREE.BoxGeometry(1.15, 0.26, 2.08), accent, -5.5, 1.07, -0.55);
  add(new THREE.BoxGeometry(1.15, 0.26, 2.08), accent, 5.5, 1.07, -0.55);
  add(new THREE.BoxGeometry(0.5, 0.9, 0.35), metal, -3.4, 1.35, -0.9);
  add(new THREE.BoxGeometry(0.5, 0.9, 0.35), metal, 3.4, 1.35, -0.9);

  // Twin tail booms out to the tailplane, with orange fins and a shared high tail.
  for (const side of [-1, 1]) {
    add(new THREE.CylinderGeometry(0.16, 0.2, 5.4, 8), body, side * 2.5, 0.1, 3.3, Math.PI / 2, 0, 0);
    add(new THREE.BoxGeometry(0.14, 1.7, 1.5), accent, side * 2.5, 1.0, 5.9);
    add(new THREE.BoxGeometry(0.28, 0.16, 1.1), metal, side * 2.5, 0.06, 6.6);
    // Struts from floats up to the wing roots.
    add(new THREE.CylinderGeometry(0.06, 0.06, 1.5, 6), metal, side * 1.5, -0.7, 0.5, 0, 0, side * 0.28);
    add(new THREE.CylinderGeometry(0.06, 0.06, 1.5, 6), metal, side * 1.5, -0.7, 1.9, 0, 0, side * 0.28);
  }
  add(new THREE.BoxGeometry(5.6, 0.16, 1.15), body, 0, 1.52, 5.75);

  // Amphibian floats: two long hulls under the belly, orange noses.
  for (const side of [-1, 1]) {
    const float = new THREE.Mesh(new THREE.CapsuleGeometry(0.46, 3.2, 6, 10), body);
    float.rotation.x = Math.PI / 2;
    float.position.set(side * 1.9, -1.5, 0.2);
    float.scale.set(1, 1, 0.75);
    group.add(float);
    add(new THREE.ConeGeometry(0.42, 1.0, 10), accent, side * 1.9, -1.5, -2.1, -Math.PI / 2, 0, 0);
  }

  // Nose-mounted prop disc, geared off the engine.
  const hub = add(new THREE.CylinderGeometry(0.3, 0.3, 0.4, 12), metal, 0, 0, -4.5, Math.PI / 2, 0, 0);
  const prop = new THREE.Group();
  prop.position.set(0, 0, -4.72);
  for (let i = 0; i < 3; i += 1) {
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.16, 2.5, 0.08), dark);
    blade.rotation.z = (i * Math.PI * 2) / 3;
    blade.position.set(0, Math.cos((i * Math.PI * 2) / 3) * 1.2, 0);
    prop.add(blade);
  }
  const disc = new THREE.Mesh(
    new THREE.CircleGeometry(2.5, 24),
    new THREE.MeshBasicMaterial({ color: 0xdfe8f2, transparent: true, opacity: 0.12, side: THREE.DoubleSide }),
  );
  prop.add(disc);
  group.add(prop);

  // Navigation lights: red port, green starboard, so the bank is readable at dusk.
  add(new THREE.SphereGeometry(0.13, 8, 6), new THREE.MeshBasicMaterial({ color: 0xff4038 }), -5.9, 1.1, -0.6);
  add(new THREE.SphereGeometry(0.13, 8, 6), new THREE.MeshBasicMaterial({ color: 0x40ff8a }), 5.9, 1.1, -0.6);

  group.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });

  return { group, prop, hub };
}
