import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { normalizeBuildingInput } from '@nodouno/calc';
import type { BeamInput, BuildingInput, ColumnInput, SlabInput } from '@nodouno/calc';
import type { ElementType } from '@nodouno/calc';

const STORY_HEIGHT_M = 3;
const SLAB_COLORS = [0xc8c8d0, 0xb8d4e8, 0xd4c8b8, 0xc8d8c8, 0xe0c8d8, 0xd8e0c8];
const SELECT_EMISSIVE = 0xbc7155;

export type StructuralSelectHandler = (
  elementId: string,
  elementType: ElementType
) => void;

export type StructuralViewerHandle = {
  dispose: () => void;
  setModel: (model: BuildingInput | Record<string, unknown> | null) => void;
  setResultsVisible: (visible: boolean) => void;
  selectElement: (elementId: string | null, elementType?: ElementType) => void;
  /** Reajusta canvas tras mostrar el contenedor (evita tamaño 0 si se montó oculto). */
  resize: () => void;
};

type SelectableUserData = {
  elementId: string;
  elementType: ElementType;
};

function disposeMesh(mesh: THREE.Mesh) {
  mesh.geometry.dispose();
  const mat = mesh.material;
  if (Array.isArray(mat)) mat.forEach((m) => m.dispose());
  else mat.dispose();
}

function slabPoints(slab: SlabInput): Array<{ x: number; y: number }> {
  if (slab.points && slab.points.length >= 3) return slab.points;
  const hx = slab.spanXm / 2;
  const hy = slab.spanYm / 2;
  return [
    { x: -hx, y: -hy },
    { x: hx, y: -hy },
    { x: hx, y: hy },
    { x: -hx, y: hy }
  ];
}

function modelBounds(model: BuildingInput): {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
} {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  const grow = (x: number, z: number) => {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minZ = Math.min(minZ, z);
    maxZ = Math.max(maxZ, z);
  };

  for (const slab of model.slabs) {
    for (const p of slabPoints(slab)) grow(p.x, p.y);
  }
  for (const beam of model.beams) {
    if (beam.x1 != null && beam.y1 != null && beam.x2 != null && beam.y2 != null) {
      grow(beam.x1, beam.y1);
      grow(beam.x2, beam.y2);
    }
  }
  for (const col of model.columns) {
    if (col.cx != null && col.cy != null) grow(col.cx, col.cy);
  }

  if (!Number.isFinite(minX)) {
    return { minX: -3, maxX: 3, minZ: -2.5, maxZ: 2.5 };
  }
  return { minX, maxX, minZ, maxZ };
}

function columnHeightM(col: ColumnInput): number {
  return Math.max(STORY_HEIGHT_M, col.floors * STORY_HEIGHT_M);
}

function createSlabMesh(slab: SlabInput, slabTopY: number, color: number): THREE.Mesh {
  const pts = slabPoints(slab);
  const thickness = Math.max(0.05, slab.thicknessM);
  const shape = new THREE.Shape();
  pts.forEach((p, i) => {
    // Plano XZ: coordenada Y del dibujo → eje Z de Three (igual que vigas/columnas).
    if (i === 0) shape.moveTo(p.x, -p.y);
    else shape.lineTo(p.x, -p.y);
  });
  shape.closePath();
  const geom = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false });
  geom.rotateX(-Math.PI / 2);
  geom.translate(0, slabTopY - thickness, 0);
  const mat = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.75,
    metalness: 0.05,
    transparent: true,
    opacity: 0.92
  });
  const mesh = new THREE.Mesh(geom, mat);
  mesh.userData = { elementId: slab.id, elementType: 'slab' } satisfies SelectableUserData;
  return mesh;
}

function createBeamMesh(beam: BeamInput, index: number, slabTopY: number): THREE.Mesh | null {
  const depth = Math.max(0.12, beam.depthM);
  const width = Math.max(0.12, beam.widthM);
  const beamId = beam.id ?? `beam-${index + 1}`;
  const mat = new THREE.MeshStandardMaterial({ color: 0x1a2528, roughness: 0.65, metalness: 0.08 });

  if (beam.x1 != null && beam.y1 != null && beam.x2 != null && beam.y2 != null) {
    const dx = beam.x2 - beam.x1;
    const dz = beam.y2 - beam.y1;
    const len = Math.hypot(dx, dz);
    if (len < 0.1) return null;
    const geom = new THREE.BoxGeometry(len, depth, width);
    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.set((beam.x1 + beam.x2) / 2, slabTopY - depth / 2, (beam.y1 + beam.y2) / 2);
    mesh.rotation.y = -Math.atan2(dz, dx);
    mesh.userData = { elementId: beamId, elementType: 'beam' } satisfies SelectableUserData;
    return mesh;
  }
  return null;
}

function createColumnMesh(
  col: ColumnInput,
  index: number,
  position: [number, number],
  slabTopY: number
): THREE.Mesh {
  const w = Math.max(0.15, col.widthM);
  const d = Math.max(0.15, col.depthM);
  const h = columnHeightM(col);
  const geom = new THREE.BoxGeometry(w, h, d);
  const mat = new THREE.MeshStandardMaterial({ color: 0xbc7155, roughness: 0.7, metalness: 0.05 });
  const mesh = new THREE.Mesh(geom, mat);
  const columnId = col.id ?? `column-${index + 1}`;
  mesh.position.set(position[0], h / 2, position[1]);
  mesh.userData = { elementId: columnId, elementType: 'column' } satisfies SelectableUserData;
  return mesh;
}

/**
 * Visor 3D con geometría real del dibujo (vigas, columnas, losas) y selección por raycasting.
 */
export function createStructuralViewer3d(
  container: HTMLElement,
  initialModel: BuildingInput | Record<string, unknown> | null,
  onSelect?: StructuralSelectHandler
): StructuralViewerHandle {
  container.style.position = 'relative';
  const width = Math.max(1, container.clientWidth);
  const height = Math.max(1, container.clientHeight || 360);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf8f8f8);

  const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 500);
  const bounds0 = { minX: -5, maxX: 5, minZ: -4, maxZ: 4 };
  const cx0 = (bounds0.minX + bounds0.maxX) / 2;
  const cz0 = (bounds0.minZ + bounds0.maxZ) / 2;
  camera.position.set(cx0 + 10, 12, cz0 + 10);

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height);
  renderer.domElement.className = 'absolute inset-0 block h-full w-full rounded-3xl';
  renderer.domElement.style.touchAction = 'none';
  container.appendChild(renderer.domElement);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.target.set(cx0, 3, cz0);

  scene.add(new THREE.AmbientLight(0xffffff, 0.65));
  const dir = new THREE.DirectionalLight(0xffffff, 0.85);
  dir.position.set(8, 18, 10);
  scene.add(dir);

  const root = new THREE.Group();
  scene.add(root);

  const selectableMeshes: THREE.Mesh[] = [];
  let selectedMesh: THREE.Mesh | null = null;
  let selectedId: string | null = null;
  let selectedType: ElementType | undefined;

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  const clearRoot = () => {
    for (const mesh of selectableMeshes) {
      const mat = mesh.material as THREE.MeshStandardMaterial;
      mat.emissive.setHex(0x000000);
    }
    selectableMeshes.length = 0;
    selectedMesh = null;
    const snapshot = [...root.children];
    for (const obj of snapshot) {
      root.remove(obj);
      if (obj instanceof THREE.Mesh) disposeMesh(obj);
    }
  };

  const fitCamera = (model: BuildingInput) => {
    const b = modelBounds(model);
    const cx = (b.minX + b.maxX) / 2;
    const cz = (b.minZ + b.maxZ) / 2;
    const span = Math.max(b.maxX - b.minX, b.maxZ - b.minZ, 4);
    controls.target.set(cx, 3, cz);
    camera.position.set(cx + span * 0.9, span * 0.75 + 4, cz + span * 0.9);
    controls.update();
  };

  const buildFromModel = (model: BuildingInput) => {
    clearRoot();
    if (model.slabs.length === 0 && model.beams.length === 0) return;

    const maxColH = model.columns.reduce((m, c) => Math.max(m, columnHeightM(c)), STORY_HEIGHT_M * 2);
    const slabTopY = maxColH;

    model.slabs.forEach((slab, idx) => {
      const mesh = createSlabMesh(slab, slabTopY, SLAB_COLORS[idx % SLAB_COLORS.length]!);
      root.add(mesh);
      selectableMeshes.push(mesh);
    });

    model.beams.forEach((beam, idx) => {
      const mesh = createBeamMesh(beam, idx, slabTopY);
      if (mesh) {
        root.add(mesh);
        selectableMeshes.push(mesh);
      }
    });

    const b = modelBounds(model);
    const corners: Array<[number, number]> = [
      [b.minX, b.minZ],
      [b.maxX, b.minZ],
      [b.maxX, b.maxZ],
      [b.minX, b.maxZ]
    ];

    model.columns.forEach((col, idx) => {
      let px = col.cx;
      let pz = col.cy;
      if (px == null || pz == null) {
        const corner = corners[idx] ?? corners[0]!;
        px = corner[0];
        pz = corner[1];
      }
      const mesh = createColumnMesh(col, idx, [px, pz], slabTopY);
      root.add(mesh);
      selectableMeshes.push(mesh);
    });

    fitCamera(model);
  };

  const highlight = (mesh: THREE.Mesh | null) => {
    if (selectedMesh && selectedMesh !== mesh) {
      (selectedMesh.material as THREE.MeshStandardMaterial).emissive.setHex(0x000000);
    }
    selectedMesh = mesh;
    if (mesh) {
      (mesh.material as THREE.MeshStandardMaterial).emissive.setHex(SELECT_EMISSIVE);
    }
  };

  const selectElement = (elementId: string | null, elementType?: ElementType) => {
    selectedId = elementId;
    selectedType = elementType;
    if (!elementId) {
      highlight(null);
      return;
    }
    const mesh =
      selectableMeshes.find((m) => {
        const ud = m.userData as SelectableUserData;
        return ud.elementId === elementId && (!elementType || ud.elementType === elementType);
      }) ?? null;
    highlight(mesh);
  };

  const onPointerDown = (event: PointerEvent) => {
    if (!onSelect || selectableMeshes.length === 0) return;
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObjects(selectableMeshes, false);
    if (hits.length === 0) {
      selectElement(null);
      return;
    }
    const hit = hits[0]!.object as THREE.Mesh;
    const ud = hit.userData as SelectableUserData;
    selectElement(ud.elementId, ud.elementType);
    onSelect(ud.elementId, ud.elementType);
  };

  renderer.domElement.addEventListener('pointerdown', onPointerDown);

  const setModel = (model: BuildingInput | Record<string, unknown> | null) => {
    if (!model) {
      clearRoot();
      return;
    }
    const normalized = normalizeBuildingInput(model);
    buildFromModel(normalized);
    if (selectedId) selectElement(selectedId, selectedType);
  };

  const setResultsVisible = (_visible: boolean) => {
    /* reservado para overlays futuros */
  };

  setModel(initialModel);

  let raf = 0;
  const animate = () => {
    raf = window.requestAnimationFrame(animate);
    controls.update();
    renderer.render(scene, camera);
  };
  animate();

  const resize = () => {
    const w = Math.max(1, container.clientWidth);
    const h = Math.max(1, container.clientHeight || 360);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    renderer.setSize(w, h);
  };

  const ro = new ResizeObserver(() => resize());
  ro.observe(container);

  const dispose = () => {
    window.cancelAnimationFrame(raf);
    ro.disconnect();
    renderer.domElement.removeEventListener('pointerdown', onPointerDown);
    controls.dispose();
    renderer.dispose();
    clearRoot();
    renderer.domElement.remove();
  };

  return { dispose, setModel, setResultsVisible, selectElement, resize };
}
