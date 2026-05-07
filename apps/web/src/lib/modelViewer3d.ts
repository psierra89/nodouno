import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { CSS2DObject, CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import type { BeamInput, BuildingInput, ColumnInput, SlabInput } from '@nodouno/calc';

const STORY_HEIGHT_M = 3;

function isBuildingShape(model: unknown): model is BuildingInput {
  if (!model || typeof model !== 'object') return false;
  const m = model as Record<string, unknown>;
  return (
    m.slab != null &&
    Array.isArray(m.beams) &&
    Array.isArray(m.columns) &&
    m.materials != null
  );
}

function getSpansFromModel(model: BuildingInput): { spanX: number; spanY: number } {
  const beams = model.beams;
  const slabSpan = model.slab.spanM;
  if (beams.length >= 4) {
    return {
      spanX: beams[0]?.spanM ?? slabSpan,
      spanY: beams[2]?.spanM ?? beams[1]?.spanM ?? slabSpan
    };
  }
  const maxBeam = beams.length ? Math.max(...beams.map((b) => b.spanM)) : 0;
  const s = Math.max(maxBeam, slabSpan, 1);
  return { spanX: s, spanY: s };
}

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

export type ModelViewerHandle = {
  dispose: () => void;
  setModel: (model: BuildingInput | Record<string, unknown> | null) => void;
};

/**
 * Vista 3D MVP del `simplified_model` fijo: losa, vigas perimetrales y columnas esquineras.
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
    const { spanX, spanY } = getSpansFromModel(model);
    const slab = model.slab as SlabInput;
    const columns = model.columns as ColumnInput[];
    const beams = model.beams as BeamInput[];

    const thickness = Math.max(0.05, slab.thicknessM);
    const colH = Math.max(STORY_HEIGHT_M, (columns[0]?.floors ?? 2) * STORY_HEIGHT_M);

    const hx = spanX / 2;
    const hz = spanY / 2;

    const slabGeom = new THREE.BoxGeometry(spanX, thickness, spanY);
    const slabMat = new THREE.MeshStandardMaterial({ color: 0xc8c8d0, roughness: 0.75, metalness: 0.05 });
    const slabMesh = new THREE.Mesh(slabGeom, slabMat);
    slabMesh.position.set(0, colH + thickness / 2, 0);
    root.add(slabMesh);

    const slabTag = makeLabel('Losa');
    slabTag.position.set(0, colH + thickness + 0.4, 0);
    root.add(slabTag);

    const corners: Array<[number, number]> = [
      [-hx, -hz],
      [hx, -hz],
      [hx, hz],
      [-hx, hz]
    ];

    columns.slice(0, 4).forEach((col, i) => {
      const w = Math.max(0.15, col.widthM);
      const d = Math.max(0.15, col.depthM);
      const geom = new THREE.BoxGeometry(w, colH, d);
      const mat = new THREE.MeshStandardMaterial({ color: 0xbc7155, roughness: 0.7, metalness: 0.05 });
      const mesh = new THREE.Mesh(geom, mat);
      const [cx, cz] = corners[i] ?? corners[0];
      mesh.position.set(cx, colH / 2, cz);
      root.add(mesh);

      const tag = makeLabel(`Col ${i + 1}`);
      tag.position.set(cx, colH + 0.35, cz);
      root.add(tag);
    });

    const beamMat = new THREE.MeshStandardMaterial({ color: 0x1a2528, roughness: 0.65, metalness: 0.08 });
    /** Vigas perimetrales: dos horizontales en X (z fijo) y dos en Z (x fijo). */
    const beamLayouts: Array<{
      cx: number;
      cz: number;
      label: string;
      build: (b: BeamInput | undefined) => THREE.Mesh;
    }> = [
      {
        cx: 0,
        cz: -hz,
        label: 'Viga 1',
        build: (b) => {
          const depth = Math.max(0.12, b?.depthM ?? 0.5);
          const zm = Math.max(0.12, b?.widthM ?? 0.25);
          const geom = new THREE.BoxGeometry(spanX, depth, zm);
          const mesh = new THREE.Mesh(geom, beamMat);
          mesh.position.set(0, colH - depth / 2, -hz);
          return mesh;
        }
      },
      {
        cx: 0,
        cz: hz,
        label: 'Viga 2',
        build: (b) => {
          const depth = Math.max(0.12, b?.depthM ?? 0.5);
          const zm = Math.max(0.12, b?.widthM ?? 0.25);
          const geom = new THREE.BoxGeometry(spanX, depth, zm);
          const mesh = new THREE.Mesh(geom, beamMat);
          mesh.position.set(0, colH - depth / 2, hz);
          return mesh;
        }
      },
      {
        cx: -hx,
        cz: 0,
        label: 'Viga 3',
        build: (b) => {
          const depth = Math.max(0.12, b?.depthM ?? 0.5);
          const xm = Math.max(0.12, b?.widthM ?? 0.25);
          const geom = new THREE.BoxGeometry(xm, depth, spanY);
          const mesh = new THREE.Mesh(geom, beamMat);
          mesh.position.set(-hx, colH - depth / 2, 0);
          return mesh;
        }
      },
      {
        cx: hx,
        cz: 0,
        label: 'Viga 4',
        build: (b) => {
          const depth = Math.max(0.12, b?.depthM ?? 0.5);
          const xm = Math.max(0.12, b?.widthM ?? 0.25);
          const geom = new THREE.BoxGeometry(xm, depth, spanY);
          const mesh = new THREE.Mesh(geom, beamMat);
          mesh.position.set(hx, colH - depth / 2, 0);
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
    if (!model || !isBuildingShape(model)) {
      clearRoot();
      return;
    }
    buildFromModel(model);
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
