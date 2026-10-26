import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { ChevronDown, ChevronUp, RotateCcw, Eye, Box } from 'lucide-react';

interface ThreeHamperViewerProps {
  onClose?: () => void;
}

type BoxFinish = 'blush' | 'champagne' | 'burgundy';
type CameraPreset = 'studio' | 'flatlay' | 'macro';

export const ThreeHamperViewer: React.FC<ThreeHamperViewerProps> = ({ onClose }) => {
  const canvasMountRef = useRef<HTMLDivElement | null>(null);
  const [finish, setFinish] = useState<BoxFinish>('blush');
  const [explodedProgress, setExplodedProgress] = useState<number>(0.45);
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('studio');
  const [dockCollapsed, setDockCollapsed] = useState<boolean>(false);

  // Refs for smooth frame-rate independent updates without tearing down WebGL
  const targetExplodedRef = useRef<number>(0.45);
  const targetFinishRef = useRef<BoxFinish>('blush');
  const targetCameraPosRef = useRef<THREE.Vector3 | null>(new THREE.Vector3(0, 3.2, 5.4));
  const targetLookAtRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0.8, 0));
  const triggerRenderRef = useRef<() => void>(() => {});

  useEffect(() => {
    targetExplodedRef.current = explodedProgress;
    triggerRenderRef.current();
  }, [explodedProgress]);

  useEffect(() => {
    targetFinishRef.current = finish;
    triggerRenderRef.current();
  }, [finish]);

  useEffect(() => {
    if (cameraPreset === 'studio') {
      targetCameraPosRef.current = new THREE.Vector3(0, 3.2, 5.4);
      targetLookAtRef.current.set(0, 0.8, 0);
    } else if (cameraPreset === 'flatlay') {
      targetCameraPosRef.current = new THREE.Vector3(0, 6.2, 0.8);
      targetLookAtRef.current.set(0, 0.5, 0);
    } else if (cameraPreset === 'macro') {
      targetCameraPosRef.current = new THREE.Vector3(1.8, 2.2, 2.7);
      targetLookAtRef.current.set(0, 0.85, 0);
    }
    triggerRenderRef.current();
  }, [cameraPreset]);

  useEffect(() => {
    const container = canvasMountRef.current;
    if (!container) return;

    // 1. Software-WebGL detection from GPU renderer string
    const isSoftwareGl = (() => {
      const probeCanvas = document.createElement('canvas');
      const gl = probeCanvas.getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const width = container.clientWidth || window.innerWidth;
    const height = container.clientHeight || window.innerHeight;

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const bgHex = 0xfdf4f6;
    scene.background = new THREE.Color(bgHex);
    scene.fog = new THREE.FogExp2(bgHex, 0.045);

    // 2. Studio PBR Environment Reflections (RoomEnvironment)
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(42, width / height, 0.1, 60);
    camera.position.set(0, 3.2, 5.4);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = !isSoftwareGl;
    controls.dampingFactor = 0.06;
    controls.maxPolarAngle = Math.PI / 2 - 0.04;
    controls.minDistance = 2.2;
    controls.maxDistance = 10;
    controls.target.set(0, 0.8, 0);

    // 3. Balanced 3-Point Studio Lighting Rig (Warm Key + Cool Hemisphere Fill + Rim)
    const hemiLight = new THREE.HemisphereLight(0xfff5f7, 0xd8c3c8, 0.85);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight(0xfff0e5, 1.8);
    keyLight.position.set(4.5, 7.5, 4.0);
    if (!isSoftwareGl) {
      keyLight.castShadow = true;
      keyLight.shadow.mapSize.set(1024, 1024);
      keyLight.shadow.camera.left = -4;
      keyLight.shadow.camera.right = 4;
      keyLight.shadow.camera.top = 4;
      keyLight.shadow.camera.bottom = -4;
      keyLight.shadow.bias = -0.0005;
      keyLight.shadow.normalBias = 0.02;
    }
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight(0xf7dce2, 0.9);
    rimLight.position.set(-4.0, 4.5, -3.5);
    scene.add(rimLight);

    // Procedural CanvasTexture for Travertine Stone Micro-Relief
    const stoneCanvas = document.createElement('canvas');
    stoneCanvas.width = 256;
    stoneCanvas.height = 256;
    const ctx = stoneCanvas.getContext('2d')!;
    ctx.fillStyle = '#f5eee8';
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 600; i++) {
      ctx.fillStyle = i % 2 === 0 ? 'rgba(210,195,185,0.22)' : 'rgba(255,255,255,0.25)';
      ctx.fillRect((i * 37) % 256, (i * 73) % 256, 12, 3);
    }
    const stoneTex = new THREE.CanvasTexture(stoneCanvas);
    stoneTex.colorSpace = THREE.SRGBColorSpace;
    stoneTex.wrapS = THREE.RepeatWrapping;
    stoneTex.wrapT = THREE.RepeatWrapping;
    stoneTex.repeat.set(3, 3);
    stoneTex.anisotropy = renderer.capabilities.getMaxAnisotropy();

    // 4. Composite 10-Part Procedural 3D Subject (THREE.Group)
    const hamperGroup = new THREE.Group();
    scene.add(hamperGroup);

    // Part 1: Travertine Studio Pedestal Base (flush at y=0)
    const pedestalGeo = new THREE.CylinderGeometry(2.6, 2.75, 0.24, 48);
    const pedestalMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: stoneTex,
      roughness: 0.78,
      metalness: 0.05,
    });
    const pedestal = new THREE.Mesh(pedestalGeo, pedestalMat);
    pedestal.position.y = 0.12;
    pedestal.receiveShadow = true;
    hamperGroup.add(pedestal);

    // Part 2: Soft Radial Contact Shadow Disc (offset >= 0.02 on Y to avoid Z-fighting)
    const shadowCanvas = document.createElement('canvas');
    shadowCanvas.width = 128;
    shadowCanvas.height = 128;
    const sctx = shadowCanvas.getContext('2d')!;
    const grad = sctx.createRadialGradient(64, 64, 10, 64, 64, 60);
    grad.addColorStop(0, 'rgba(90, 45, 55, 0.45)');
    grad.addColorStop(1, 'rgba(90, 45, 55, 0)');
    sctx.fillStyle = grad;
    sctx.fillRect(0, 0, 128, 128);
    const shadowTex = new THREE.CanvasTexture(shadowCanvas);
    shadowTex.colorSpace = THREE.SRGBColorSpace;

    const contactShadow = new THREE.Mesh(
      new THREE.CircleGeometry(1.85, 32),
      new THREE.MeshBasicMaterial({
        map: shadowTex,
        transparent: true,
        depthWrite: false,
        opacity: 0.85,
      })
    );
    contactShadow.rotation.x = -Math.PI / 2;
    contactShadow.position.y = 0.255;
    hamperGroup.add(contactShadow);

    // Shared PBR Materials with varied roughness (>= 0.25 difference across adjacent parts)
    const boxOuterMat = new THREE.MeshPhysicalMaterial({
      color: 0xf7dce2,
      roughness: 0.58,
      metalness: 0.08,
      clearcoat: 0.2,
    });
    const roseGoldMat = new THREE.MeshPhysicalMaterial({
      color: 0xd48b95,
      roughness: 0.18,
      metalness: 0.92,
      clearcoat: 0.5,
    });
    const pearlMat = new THREE.MeshPhysicalMaterial({
      color: 0xfffaf5,
      roughness: 0.12,
      metalness: 0.15,
      clearcoat: 0.9,
      iridescence: 0.4,
    });
    const velvetMat = new THREE.MeshStandardMaterial({
      color: 0xfff8f6,
      roughness: 0.88,
      metalness: 0.0,
    });

    // Part 3: Keepsake Box Lower Hull (Beveled Extrude)
    const boxShape = new THREE.Shape();
    const w = 1.15;
    const d = 0.9;
    boxShape.moveTo(-w, -d);
    boxShape.lineTo(w, -d);
    boxShape.lineTo(w, d);
    boxShape.lineTo(-w, d);
    boxShape.closePath();

    const hullGeo = new THREE.ExtrudeGeometry(boxShape, {
      depth: 0.72,
      bevelEnabled: true,
      bevelSegments: 3,
      steps: 1,
      bevelSize: 0.04,
      bevelThickness: 0.04,
    });
    hullGeo.rotateX(Math.PI / 2);
    const boxHull = new THREE.Mesh(hullGeo, boxOuterMat);
    boxHull.position.y = 0.98;
    boxHull.castShadow = true;
    boxHull.receiveShadow = true;
    hamperGroup.add(boxHull);

    // Part 4: Velvet Interior Cushion Insert
    const cushion = new THREE.Mesh(new THREE.BoxGeometry(2.12, 0.16, 1.62), velvetMat);
    cushion.position.y = 0.92;
    hamperGroup.add(cushion);

    // Part 5: Rose-Gold Trim Band around Box Base
    const trimBand = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.07, 1.9), roseGoldMat);
    trimBand.position.y = 0.65;
    hamperGroup.add(trimBand);

    // Part 6: Interior Gift Item 1 — Rose Gold Pearl Hair Claw (Arch + Pearls)
    const clawGroup = new THREE.Group();
    clawGroup.position.set(-0.52, 1.05, 0.12);
    const clawArch = new THREE.Mesh(
      new THREE.TorusGeometry(0.32, 0.035, 16, 32, Math.PI),
      roseGoldMat
    );
    clawGroup.add(clawArch);
    for (let i = 0; i < 5; i++) {
      const angle = (Math.PI / 6) * (i + 1);
      const pearl = new THREE.Mesh(new THREE.SphereGeometry(0.052, 16, 16), pearlMat);
      pearl.position.set(Math.cos(angle) * 0.34, Math.sin(angle) * 0.34, 0);
      clawGroup.add(pearl);
    }
    hamperGroup.add(clawGroup);

    // Part 7: Interior Gift Item 2 — Mulberry Silk Scrunchie
    const scrunchieMat = new THREE.MeshPhysicalMaterial({
      color: 0xe69ca8,
      roughness: 0.35,
      metalness: 0.05,
      sheen: 1.0,
      sheenColor: new THREE.Color(0xfff0f3),
    });
    const scrunchie = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.11, 20, 36), scrunchieMat);
    scrunchie.rotation.x = Math.PI / 2;
    scrunchie.position.set(0.52, 1.08, 0.25);
    hamperGroup.add(scrunchie);

    // Part 8: Interior Gift Item 3 — Pair of 18k Rose Gold Pearl Drop Earrings
    const earringsGroup = new THREE.Group();
    earringsGroup.position.set(0.45, 1.06, -0.35);
    for (const offsetX of [-0.18, 0.18]) {
      const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.09, 0.018, 12, 24), roseGoldMat);
      hoop.position.set(offsetX, 0.1, 0);
      const dropPearl = new THREE.Mesh(new THREE.SphereGeometry(0.065, 16, 16), pearlMat);
      dropPearl.position.set(offsetX, -0.02, 0.05);
      earringsGroup.add(hoop, dropPearl);
    }
    hamperGroup.add(earringsGroup);

    // Part 9 & 10: Detachable Box Lid + Sculpted Satin Rose-Gold Ribbon Bow
    const lidGroup = new THREE.Group();
    lidGroup.position.y = 1.12;
    hamperGroup.add(lidGroup);

    const lidGeo = new THREE.ExtrudeGeometry(boxShape, {
      depth: 0.18,
      bevelEnabled: true,
      bevelSegments: 3,
      steps: 1,
      bevelSize: 0.06,
      bevelThickness: 0.03,
    });
    lidGeo.rotateX(Math.PI / 2);
    const lidMesh = new THREE.Mesh(lidGeo, boxOuterMat);
    lidMesh.castShadow = true;
    lidGroup.add(lidMesh);

    const ribbonX = new THREE.Mesh(new THREE.BoxGeometry(2.44, 0.21, 0.24), roseGoldMat);
    ribbonX.position.y = -0.08;
    const ribbonZ = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.21, 1.94), roseGoldMat);
    ribbonZ.position.y = -0.08;
    lidGroup.add(ribbonX, ribbonZ);

    const bowKnot = new THREE.Mesh(new THREE.TorusKnotGeometry(0.18, 0.048, 48, 12, 2, 3), roseGoldMat);
    bowKnot.position.y = 0.12;
    bowKnot.scale.set(1.2, 0.55, 1.2);
    lidGroup.add(bowKnot);

    // Pre-warm shaders on hardware GPUs
    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    // 5. On-Demand & Software-WebGL Paced Render Loop
    let frameId = 0;
    let renderBusy = false;
    let renderDirty = false;
    let currentExploded = targetExplodedRef.current;

    const finishColors: Record<BoxFinish, number> = {
      blush: 0xf7dce2,
      champagne: 0xfaf0e4,
      burgundy: 0x592531,
    };

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0) : null;
      gl.flush();
      const poll = () => {
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function requestRender() {
      if (renderBusy) {
        renderDirty = true;
        return;
      }
      renderBusy = true;
      frameId = requestAnimationFrame(() => {
        renderDirty = false;

        // Smooth damping of exploded lid height & rotation
        const dt = 0.032;
        const diff = Math.abs(currentExploded - targetExplodedRef.current);
        currentExploded = THREE.MathUtils.damp(
          currentExploded,
          targetExplodedRef.current,
          8,
          dt
        );
        lidGroup.position.y = 1.06 + currentExploded * 1.15;
        lidGroup.position.z = -currentExploded * 0.45;
        lidGroup.rotation.x = -currentExploded * 0.35;
        clawGroup.position.y = 1.05 + currentExploded * 0.22;
        scrunchie.position.y = 1.08 + currentExploded * 0.18;
        earringsGroup.position.y = 1.06 + currentExploded * 0.25;

        // Smooth finish tint update
        boxOuterMat.color.setHex(finishColors[targetFinishRef.current]);

        // Smooth camera preset transition if active
        if (targetCameraPosRef.current) {
          camera.position.lerp(targetCameraPosRef.current, 0.18);
          controls.target.lerp(targetLookAtRef.current, 0.18);
          if (camera.position.distanceTo(targetCameraPosRef.current) < 0.03) {
            targetCameraPosRef.current = null;
          } else {
            renderDirty = true;
          }
        }

        if (diff > 0.005) {
          renderDirty = true;
        }

        controls.update();
        renderer.render(scene, camera);

        const done = () => {
          renderBusy = false;
          if (renderDirty) requestRender();
        };
        if (isSoftwareGl) afterDraw(done);
        else done();
      });
    }

    triggerRenderRef.current = requestRender;

    const onControlStart = () => {
      targetCameraPosRef.current = null;
    };
    const onControlChange = () => {
      requestRender();
    };
    controls.addEventListener('start', onControlStart);
    controls.addEventListener('change', onControlChange);

    const onResize = () => {
      if (!container) return;
      const wNew = container.clientWidth || window.innerWidth;
      const hNew = container.clientHeight || window.innerHeight;
      camera.aspect = wNew / hNew;
      camera.updateProjectionMatrix();
      renderer.setSize(wNew, hNew);
      requestRender();
    };
    window.addEventListener('resize', onResize);

    requestRender();

    return () => {
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('resize', onResize);
      controls.removeEventListener('start', onControlStart);
      controls.removeEventListener('change', onControlChange);
      controls.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div
      className="relative w-full h-[540px] sm:h-[620px] rounded-2xl overflow-hidden border border-[#e4b7c0] bg-[#fdf4f6]"
      data-testid="three-hamper-studio"
    >
      {/* Top-Left Minimal Spec Badge */}
      <div className="absolute top-4 left-4 z-10 flex items-center gap-3 px-3.5 py-2 rounded-xl bg-[#fffdfb]/95 border border-[#e4b7c0] shadow-sm">
        <Box className="w-4 h-4 text-[#9e5461]" />
        <div>
          <p className="text-xs font-semibold text-[#2d1e22]">
            Pretty Charm 3D Keepsake Hamper &amp; Jewellery Studio
          </p>
          <p className="text-[11px] text-[#6e5259]">
            Drag to rotate 360° · Inspect Pearl Hair Claw, Silk Scrunchie &amp; Rose Gold Earrings
          </p>
        </div>
      </div>

      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 z-10 px-3 py-1.5 rounded-xl bg-[#2d1e22] text-white text-xs font-medium hover:bg-[#452f35] transition-colors"
        >
          Back to Store
        </button>
      )}

      {/* Isolated WebGL Canvas Mount Container */}
      <div ref={canvasMountRef} className="w-full h-full" />

      {/* Unified Collapsible Bottom Control Dock (<= 15% viewport footprint, solid rgba surface) */}
      <div
        className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10 w-[94%] max-w-3xl transition-transform duration-200"
        style={{
          transform: dockCollapsed ? 'translate(-50%, calc(100% - 34px))' : 'translate(-50%, 0)',
        }}
      >
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => setDockCollapsed((c) => !c)}
            className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-t-xl bg-[#2d1e22] text-white text-xs font-medium"
          >
            {dockCollapsed ? (
              <>
                <ChevronUp className="w-3.5 h-3.5" />
                <span>Show 3D Controls</span>
              </>
            ) : (
              <>
                <ChevronDown className="w-3.5 h-3.5" />
                <span>Hide Controls</span>
              </>
            )}
          </button>
        </div>

        <div className="rounded-2xl bg-[#fffdfb] border border-[#e4b7c0] px-4 py-3 shadow-lg flex flex-wrap items-center justify-between gap-4">
          {/* Box Finish Swatches */}
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-[#5c4349]">Box Finish:</span>
            {(
              [
                { id: 'blush', label: 'Blush Rose', hex: '#f7dce2' },
                { id: 'champagne', label: 'Champagne Cream', hex: '#faf0e4' },
                { id: 'burgundy', label: 'Velvet Wine', hex: '#592531' },
              ] as const
            ).map((sw) => (
              <button
                key={sw.id}
                type="button"
                onClick={() => setFinish(sw.id)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border transition-colors whitespace-nowrap shrink-0 ${
                  finish === sw.id
                    ? 'border-[#9e5461] bg-[#fce9ee] text-[#2d1e22]'
                    : 'border-[#e8d5d9] bg-white text-[#6e5259] hover:text-[#2d1e22]'
                }`}
              >
                <span
                  className="w-3 h-3 rounded-full border border-black/15"
                  style={{ backgroundColor: sw.hex }}
                />
                <span>{sw.label}</span>
              </button>
            ))}
          </div>

          {/* Exploded Lid Slider */}
          <div className="flex items-center gap-2">
            <label htmlFor="lid-open-slider" className="text-xs font-medium text-[#5c4349] whitespace-nowrap">
              Open Box Reveal:
            </label>
            <input
              id="lid-open-slider"
              type="range"
              min="0"
              max="1"
              step="0.05"
              value={explodedProgress}
              onChange={(e) => setExplodedProgress(parseFloat(e.target.value))}
              className="w-24 accent-[#9e5461]"
            />
          </div>

          {/* Camera Angles */}
          <div className="flex items-center gap-1.5">
            <Eye className="w-3.5 h-3.5 text-[#9e5461]" />
            {(
              [
                { id: 'studio', label: 'Studio' },
                { id: 'flatlay', label: 'Flatlay' },
                { id: 'macro', label: 'Jewellery Close-Up' },
              ] as const
            ).map((cam) => (
              <button
                key={cam.id}
                type="button"
                onClick={() => setCameraPreset(cam.id)}
                className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                  cameraPreset === cam.id
                    ? 'bg-[#9e5461] text-white'
                    : 'bg-[#fdf2f4] text-[#7a3b47] hover:bg-[#fce9ee]'
                }`}
              >
                {cam.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setCameraPreset('studio');
                setExplodedProgress(0.45);
                setFinish('blush');
              }}
              className="p-1.5 rounded-lg bg-[#fdf2f4] text-[#7a3b47] hover:bg-[#fce9ee]"
              aria-label="Reset 3D camera"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
