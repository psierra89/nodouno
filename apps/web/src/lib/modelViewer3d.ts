import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DObject, CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { normalizeBuildingInput } from '@nodouno/calc';
import type { BeamInput, BuildingInput, ColumnInput, SlabInput } from '@nodouno/calc';

const STORY_HEIGHT_M = 3;

const SLAB_COLORS = [0xc8c8d0, 0xb8d4e8, 0xd4c8b8, 0xc8d8c8, 0xe0c8d8, 0xd8e0c8];

function disposeMesh(mesh: THREE.Mesh) {
  mesh.geometry.dispose();
  const mat = mesh.material;
  if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
  else mat.dispose();
}

function makeLabel(text: string): CSS2DObject {
  const div = document.createElement('div');
  div.textContent = text;
  div.style.cssText =
    'padding:4px 10px;border:1px solid #000d10;border-radius:9999px;background:rgba(255,255,255,0.95);font:700 12px/1.2 system-ui,sans-serif;color:#000d10;pointer-events:none;';
  return new CSS2DObject(div);
}

function getModelBounds(model: BuildingInput): {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
} {
  let minX = 0;
  let maxX = 0;
  let minZ = 0;
  let maxZ = 0;
  if (model.slabs.length > 0) {
    minX = Infinity;
    minZ = Infinity;
    maxX = -Infinity;
    maxZ = -Infinity;
    for (const slab of model.slabs) {
      const hx = slab.spanXm / 2;
      const hz = slab.spanYm / 2;
      minX = Math.min(minX, -hx);
      maxX = Math.max(maxX, hx);
      minZ = Math.min(minZ, -hz);
      maxZ = Math.max(maxZ, hz);
    }
  } else if (model.beams.length >= 4) {
    const spanX = model.beams[0]?.spanM ?? 5;
    const spanY = model.beams[2]?.spanM ?? model.beams[1]?.spanM ?? 4;
    minX = -spanX / 2;
    maxX = spanX / 2;
    minZ = -spanY / 2;
    maxZ = spanY / 2;
  } else {
    minX = -2.5;
    maxX = 2.5;
    minZ = -2;
    maxZ = 2;
  }
  return { minX, maxX, minZ, maxZ };
}

export type ModelViewerHandle = {
  dispose: () => void;
  setModel: (model: BuildingInput | Record<string, unknown> | null) => void;
};

/**
 * Vista 3D del modelo estructural: N losas (bbox), vigas y columnas.
 */
export function createSimplifiedModelViewer(
  container: HTMLElement,
  initialModel: BuildingInput | Record<string, unknown> | null
): ModelViewerHandle {
  container.style.position = 'relative';
  const width = Math.max(1, container.clientWidth);
  const height = Math.max(1, container.clientHeight || 280);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf8f8f8);

  const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 500);
  camera.position.set(12, 10, 12);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height);
  renderer.domElement.className = 'block h-full w-full rounded-3xl';

  const labelRenderer = new CSS2DRenderer();
  labelRenderer.setSize(width, height);
  labelRenderer.domElement.style.position = 'absolute';
  labelRenderer.domElement.style.inset = '0';
  labelRenderer.domElement.style.pointerEvents = 'none';

  container.appendChild(renderer.domElement);
  container.appendChild(labelRenderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.target.set(0, 2, 0);

  scene.add(new THREE.AmbientLight(0xffffff, 0.65));
  const dir = new THREE.DirectionalLight(0xffffff, 0.85);
  dir.position.set(8, 18, 10);
  scene.add(dir);

  const root = new THREE.Group();
  scene.add(root);

  const clearRoot = () => {
    const snapshot = [...root.children];
    for (const obj of snapshot) {
      root.remove(obj);
      if (obj instanceof THREE.Mesh) disposeMesh(obj);
      else if (obj instanceof CSS2DObject) obj.element.remove();
    }
  };

  const buildFromModel = (model: BuildingInput) => {
    clearRoot();
    const bounds = getModelBounds(model);
    const cx = (bounds.minX + bounds.maxX) / 2;
    const cz = (bounds.minZ + bounds.maxZ) / 2;
    const columns = model.columns as ColumnInput[];
    const beams = model.beams as BeamInput[];
    const colH = Math.max(STORY_HEIGHT_M, (columns[0]?.floors ?? 2) * STORY_HEIGHT_M);

    model.slabs.forEach((slab: SlabInput, idx) => {
      const thickness = Math.max(0.05, slab.thicknessM);
      const geom = new THREE.BoxGeometry(slab.spanXm, thickness, slab.spanYm);
      const color = SLAB_COLORS[idx % SLAB_COLORS.length]!;
      const mat = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.75,
        metalness: 0.05,
        transparent: true,
        opacity: 0.92
      });
      const mesh = new THREE.Mesh(geom, mat);
      mesh.position.set(cx, colH + thickness / 2, cz);
      root.add(mesh);

      const tag = makeLabel(`Losa ${slab.id.slice(-4)}`);
      tag.position.set(cx, colH + thickness + 0.35 + idx * 0.15, cz);
      root.add(tag);
    });

    const hx = (bounds.maxX - bounds.minX) / 2;
    const hz = (bounds.maxZ - bounds.minZ) / 2;

    const corners: Array<[number, number]> = [
      [bounds.minX, bounds.minZ],
      [bounds.maxX, bounds.minZ],
      [bounds.maxX, bounds.maxZ],
      [bounds.minX, bounds.maxZ]
    ];

    columns.slice(0, 4).forEach((col, i) => {
      const w = Math.max(0.15, col.widthM);
      const d = Math.max(0.15, col.depthM);
      const geom = new THREE.BoxGeometry(w, colH, d);
      const mat = new THREE.MeshStandardMaterial({ color: 0xbc7155, roughness: 0.7, metalness: 0.05 });
      const mesh = new THREE.Mesh(geom, mat);
      const [px, pz] = corners[i] ?? corners[0]!;
      mesh.position.set(px, colH / 2, pz);
      root.add(mesh);

      const tag = makeLabel(`Col ${i + 1}`);
      tag.position.set(px, colH + 0.35, pz);
      root.add(tag);
    });

    const spanX = bounds.maxX - bounds.minX;
    const spanY = bounds.maxZ - bounds.minZ;
    const beamMat = new THREE.MeshStandardMaterial({ color: 0x1a2528, roughness: 0.65, metalness: 0.08 });

    const beamLayouts: Array<{
      cx: number;
      cz: number;
      label: string;
      build: (b: BeamInput | undefined) => THREE.Mesh;
    }> = [
      {
        cx,
        cz: bounds.minZ,
        label: 'Viga 1',
        build: (b) => {
          const depth = Math.max(0.12, b?.depthM ?? 0.5);
          const zm = Math.max(0.12, b?.widthM ?? 0.25);
          const geom = new THREE.BoxGeometry(spanX, depth, zm);
          const mesh = new THREE.Mesh(geom, beamMat);
          mesh.position.set(cx, colH - depth / 2, bounds.minZ);
          return mesh;
        }
      },
      {
        cx,
        cz: bounds.maxZ,
        label: 'Viga 2',
        build: (b) => {
          const depth = Math.max(0.12, b?.depthM ?? 0.5);
          const zm = Math.max(0.12, b?.widthM ?? 0.25);
          const geom = new THREE.BoxGeometry(spanX, depth, zm);
          const mesh = new THREE.Mesh(geom, beamMat);
          mesh.position.set(cx, colH - depth / 2, bounds.maxZ);
          return mesh;
        }
      },
      {
        cx: bounds.minX,
        cz,
        label: 'Viga 3',
        build: (b) => {
          const depth = Math.max(0.12, b?.depthM ?? 0.5);
          const xm = Math.max(0.12, b?.widthM ?? 0.25);
          const geom = new THREE.BoxGeometry(xm, depth, spanY);
          const mesh = new THREE.Mesh(geom, beamMat);
          mesh.position.set(bounds.minX, colH - depth / 2, cz);
          return mesh;
        }
      },
      {
        cx: bounds.maxX,
        cz,
        label: 'Viga 4',
        build: (b) => {
          const depth = Math.max(0.12, b?.depthM ?? 0.5);
          const xm = Math.max(0.12, b?.widthM ?? 0.25);
          const geom = new THREE.BoxGeometry(xm, depth, spanY);
          const mesh = new THREE.Mesh(geom, beamMat);
          mesh.position.set(bounds.maxX, colH - depth / 2, cz);
          return mesh;
        }
      }
    ];

    beamLayouts.forEach((layout, idx) => {
      const mesh = layout.build(beams[idx]);
      mesh.material = beamMat.clone();
      root.add(mesh);
      const tag = makeLabel(layout.label);
      tag.position.set(layout.cx, colH + 0.25, layout.cz);
      root.add(tag);
    });
    beamMat.dispose();
  };

  const setModel = (model: BuildingInput | Record<string, unknown> | null) => {
    if (!model) {
      clearRoot();
      return;
    }
    const normalized = normalizeBuildingInput(model);
    if (normalized.slabs.length === 0 && normalized.beams.length === 0) {
      clearRoot();
      return;
    }
    buildFromModel(normalized);
  };

  setModel(initialModel);

  let raf = 0;
  const animate = () => {
    raf = window.requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
    labelRenderer.render(scene, camera);
  };
  animate();

  const ro = new ResizeObserver(() => {
    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
    labelRenderer.setSize(w, h);
  });
  ro.observe(container);

  const dispose = () => {
    window.cancelAnimationFrame(raf);
    ro.disconnect();
    controls.dispose();
    renderer.dispose();
    clearRoot();
    renderer.domElement.remove();
    labelRenderer.domElement.remove();
  };

  return { dispose, setModel };
}
