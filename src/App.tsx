import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import { useState, useEffect, useRef, Suspense, useMemo, useCallback } from 'react';
import './App.css';
import { Group, Mesh, TextureLoader, Box3, Vector3, MathUtils } from 'three';
import { useGLTF, useTexture, Environment } from '@react-three/drei';
import * as THREE from 'three';

// --- Constants ---
const HEART_MODEL_PATH = '/models/3D_Heart-Red.glb';
const HEART_INITIAL_POSITION: [number, number, number] = [0, -2.5, -5];
const HEART_SCALE = 4.2;
const HEART_MOUSE_EFFECT_STRENGTH_POSITION = 0.4;
const HEART_MOUSE_EFFECT_LERP_FACTOR = 0.05;

const BG_MUSIC_PATH = '/audio/Cosmic Candy Music.ogg';
const RIZZ_SOUND_PATH = '/audio/Rizz Sound Effect.mp3';
const FIREWORK_LAUNCH_PATH = '/audio/firework/Firework 1.mp3';
const FIREWORK_BURST_PATH = '/audio/firework/Firework 2.mp3';
const CONFETTI_POP1_PATH = '/audio/confetti/Confetti Pop 1.mp3';
const CONFETTI_POP2_PATH = '/audio/confetti/Confetti Pop 2.mp3';

// Cloud images
const CLOUD_PATH = '/images/clouds/Realistic White Cloud.png';
const CARTOON_CLOUD_1 = '/images/cartoonClouds/Cartoon Clouds Transparent PNG.png';
const CARTOON_CLOUD_2 = '/images/cartoonClouds/Fluffy White Cartoon Cloud.png';
const CARTOON_CLOUD_3 = '/images/cartoonClouds/Photoshop Extension Image.png';
const CARTOON_CLOUD_4 = '/images/cartoonClouds/Photoshop Extension Image (1).png';

const ALL_CLOUD_TEXTURES = [
  CLOUD_PATH, CARTOON_CLOUD_1, CARTOON_CLOUD_2, CARTOON_CLOUD_3, CARTOON_CLOUD_4,
];

const HEART_IMAGES = [
  '/images/hearts/Hand Drawn Pink Heart Doodle.png',
  '/images/hearts/Cute Love Heart Doodle.avif',
  '/images/hearts/Colored Heart Doodle.webp',
  '/images/hearts/Doodle Love Heart PNG.webp',
  '/images/hearts/Heart Doodle PNG.webp',
  '/images/hearts/Heart Monochrome Doodle.webp',
];

// Camera fly-through path
const CAMERA_START_Z = 35;
const CAMERA_END_Z = 5;
const FLY_DURATION = 3.5; // seconds to fly through

// Clouds scattered in a TUNNEL formation — spread to edges, avoid dead center
// They sit at various Z positions between camera start and heart
const CLOUD_IMAGES = [CARTOON_CLOUD_1, CARTOON_CLOUD_2, CARTOON_CLOUD_3, CARTOON_CLOUD_4, CLOUD_PATH];

function generateTunnelClouds() {
  const clouds: Array<{
    x: number; y: number; z: number;
    scale: number; opacity: number; img: string;
  }> = [];
  
  // Generate clouds in layers along the Z tunnel
  for (let z = 28; z >= -2; z -= 2.5) {
    // 2-4 clouds per layer, spread to edges
    const countInLayer = 2 + Math.floor(Math.random() * 3);
    for (let i = 0; i < countInLayer; i++) {
      // Spread wide: x from -12 to -4 or 4 to 12 (avoid center band -3.5..3.5)
      const side = Math.random() > 0.5 ? 1 : -1;
      const x = side * (4 + Math.random() * 9);
      // Y spread
      const y = -4 + Math.random() * 8;
      const scale = 2.0 + Math.random() * 3.0;
      const opacity = 0.15 + Math.random() * 0.3;
      const img = CLOUD_IMAGES[Math.floor(Math.random() * CLOUD_IMAGES.length)];
      clouds.push({ x, y, z: z + Math.random() * 2, scale, opacity, img });
    }
  }
  // Add a few near-center clouds at far distances for atmosphere (very transparent)
  for (let i = 0; i < 6; i++) {
    const z = 10 + Math.random() * 18;
    clouds.push({
      x: -3 + Math.random() * 6,
      y: -2 + Math.random() * 4,
      z,
      scale: 3 + Math.random() * 3,
      opacity: 0.08 + Math.random() * 0.12,
      img: CLOUD_IMAGES[Math.floor(Math.random() * CLOUD_IMAGES.length)],
    });
  }
  return clouds;
}

const TUNNEL_CLOUDS = generateTunnelClouds();

// Clouds behind the heart — spread across all corners and edges, not just center
const SCENE_CLOUDS = [
  // Top-left corner
  { x: -14, y: 6, z: -10, scale: 4.5, opacity: 0.3, img: CARTOON_CLOUD_1 },
  { x: -10, y: 8, z: -16, scale: 5.0, opacity: 0.22, img: CARTOON_CLOUD_3 },
  // Top-right corner
  { x: 13, y: 7, z: -12, scale: 4.0, opacity: 0.28, img: CARTOON_CLOUD_2 },
  { x: 10, y: 5, z: -18, scale: 5.5, opacity: 0.2, img: CARTOON_CLOUD_4 },
  // Bottom-left corner
  { x: -12, y: -6, z: -11, scale: 4.2, opacity: 0.3, img: CARTOON_CLOUD_4 },
  { x: -9, y: -8, z: -15, scale: 5.0, opacity: 0.22, img: CLOUD_PATH },
  // Bottom-right corner
  { x: 11, y: -7, z: -13, scale: 4.5, opacity: 0.25, img: CARTOON_CLOUD_1 },
  { x: 14, y: -5, z: -17, scale: 5.2, opacity: 0.2, img: CARTOON_CLOUD_3 },
  // Left edge mid
  { x: -15, y: 1, z: -9, scale: 3.8, opacity: 0.35, img: CARTOON_CLOUD_2 },
  { x: -11, y: -2, z: -20, scale: 6.0, opacity: 0.18, img: CARTOON_CLOUD_1 },
  // Right edge mid
  { x: 14, y: 0, z: -10, scale: 3.5, opacity: 0.32, img: CARTOON_CLOUD_4 },
  { x: 12, y: 2, z: -22, scale: 6.5, opacity: 0.15, img: CLOUD_PATH },
  // Top/bottom mid
  { x: -2, y: 9, z: -14, scale: 4.0, opacity: 0.2, img: CARTOON_CLOUD_3 },
  { x: 3, y: -9, z: -16, scale: 4.5, opacity: 0.2, img: CARTOON_CLOUD_2 },
  // Deep background — large, very transparent, wide spread
  { x: -8, y: 4, z: -25, scale: 7.0, opacity: 0.12, img: CARTOON_CLOUD_1 },
  { x: 9, y: -3, z: -28, scale: 8.0, opacity: 0.1, img: CARTOON_CLOUD_4 },
  { x: -5, y: -6, z: -30, scale: 7.5, opacity: 0.1, img: CLOUD_PATH },
  { x: 6, y: 5, z: -26, scale: 7.0, opacity: 0.12, img: CARTOON_CLOUD_2 },
];

const CONFETTI_DATA = Array.from({ length: 120 }).map(() => ({
  size: 20 + Math.random() * 30,
  left: Math.random() * 100,
  delay: Math.random() * 3,
  duration: 1.8 + Math.random() * 1.5,
  sway: -30 + Math.random() * 60,
  rotation: Math.random() * 40 - 20,
  img: HEART_IMAGES[Math.floor(Math.random() * HEART_IMAGES.length)],
}));

// --- End Constants ---

function Heart({ onTap, scale, initialPosition }: { onTap: () => void; scale: number; initialPosition: [number, number, number] }) {
  const groupRef = useRef<Group | null>(null);
  const glowRef = useRef<THREE.PointLight | null>(null);
  const mouse = useRef({ x: 0, y: 0 });
  const glowIntensity = useRef(0);
  const beatTarget = useRef(1);
  const beatScale = useRef(1);
  const beatVelocity = useRef(0);
  const { scene } = useGLTF(HEART_MODEL_PATH);
  const { gl } = useThree();

  useEffect(() => {
    const box = new Box3().setFromObject(scene);
    const center = new Vector3();
    box.getCenter(center);
    scene.position.sub(center);
    scene.traverse((child) => {
      if ((child as Mesh).isMesh) {
        const mesh = child as Mesh;
        if (mesh.material) {
          const mat = mesh.material as THREE.MeshStandardMaterial;
          if ('flatShading' in mat) mat.flatShading = false;
          mat.roughness = 0.35;
          mat.metalness = 0.1;
          mat.envMapIntensity = 0.8;
          mat.needsUpdate = true;
        }
        if (mesh.geometry) {
          mesh.geometry.computeVertexNormals();
          // Subdivision for smoother surface
          const pos = mesh.geometry.getAttribute('position');
          if (pos) {
            mesh.geometry.setAttribute('normal', mesh.geometry.getAttribute('normal'));
            mesh.geometry.computeVertexNormals();
          }
        }
      }
    });
    scene.scale.set(scale, scale, scale);
  }, [scene]);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mouse.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, [gl]);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.position.x += (mouse.current.x * HEART_MOUSE_EFFECT_STRENGTH_POSITION + initialPosition[0] - groupRef.current.position.x) * HEART_MOUSE_EFFECT_LERP_FACTOR;
      groupRef.current.position.y += (mouse.current.y * HEART_MOUSE_EFFECT_STRENGTH_POSITION + initialPosition[1] - groupRef.current.position.y) * HEART_MOUSE_EFFECT_LERP_FACTOR;
      groupRef.current.rotation.set(0, 0, 0);

      // Smooth spring-based beat animation
      const stiffness = 0.015;
      const damping = 0.12;
      const force = (beatTarget.current - beatScale.current) * stiffness;
      beatVelocity.current += force;
      beatVelocity.current *= (1 - damping);
      beatScale.current += beatVelocity.current;
      const s = scale * beatScale.current;
      // Gentle idle breathing
      const breath = 1 + Math.sin(state.clock.elapsedTime * 1.2) * 0.015;
      const finalS = s * breath;
      scene.scale.set(finalS, finalS, finalS);
    }
    // Glow fade out
    if (glowRef.current) {
      glowIntensity.current *= 0.94;
      glowRef.current.intensity = glowIntensity.current;
    }
  });

  const handleClick = () => {
    glowIntensity.current = 8;
    beatTarget.current = 1.12;
    beatVelocity.current = 0.008; // gentle initial push outward
    // Ease target back to 1 after a moment
    setTimeout(() => { beatTarget.current = 1; }, 300);
    onTap();
  };

  return (
    <group ref={groupRef} position={initialPosition} onClick={handleClick}>
      <primitive object={scene} />
      <pointLight ref={glowRef} position={[0, 0, 2]} color="#ff8fa8" intensity={0} distance={15} decay={2} />
    </group>
  );
}

// Cloud billboard with parallax + ambient drift
function CloudMesh({ position, scale, opacity, img }: {
  position: [number, number, number]; scale: number; opacity: number; img: string;
}) {
  const meshRef = useRef<Mesh | null>(null);
  const mouse = useRef({ x: 0, y: 0 });
  const basePos = useRef(position);
  // Random per-cloud drift parameters (stable across renders)
  const drift = useRef({
    speedX: 0.08, speedY: 0.06, ampX: 0.3, ampY: 0.15, offsetX: 0, offsetY: 0,
  });
  useEffect(() => {
    drift.current = {
      speedX: 0.08 + Math.random() * 0.12,
      speedY: 0.06 + Math.random() * 0.1,
      ampX: 0.3 + Math.random() * 0.5,
      ampY: 0.15 + Math.random() * 0.3,
      offsetX: Math.random() * Math.PI * 2,
      offsetY: Math.random() * Math.PI * 2,
    };
  }, []);
  const texture = useLoader(TextureLoader, img);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mouse.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      mouse.current.y = -(e.clientY / window.innerHeight) * 2 + 1;
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  useFrame((state) => {
    if (meshRef.current) {
      const t = state.clock.elapsedTime;
      const d = drift.current;
      // Parallax
      const depth = Math.max(0.5, Math.abs(basePos.current[2]) * 0.15);
      const strength = 1.8 / depth;
      // Ambient drift
      const driftX = Math.sin(t * d.speedX + d.offsetX) * d.ampX;
      const driftY = Math.sin(t * d.speedY + d.offsetY) * d.ampY;
      meshRef.current.position.x = basePos.current[0] + mouse.current.x * strength + driftX;
      meshRef.current.position.y = basePos.current[1] + mouse.current.y * strength * 0.6 + driftY;
    }
  });

  return (
    <mesh ref={meshRef} position={position} scale={[scale, scale, scale]}>
      <planeGeometry args={[3, 2]} />
      <meshBasicMaterial map={texture} transparent opacity={opacity} depthWrite={false} />
    </mesh>
  );
}

// Camera fly-through controller — stays at end position after arriving
function CameraFlyThrough({ isFlying, onArrived, startZ }: { isFlying: boolean; onArrived: () => void; startZ?: number }) {
  const progress = useRef(0);
  const hasArrived = useRef(false);
  const hasStarted = useRef(false);
  const startZUsed = startZ ?? CAMERA_START_Z;

  useFrame((state, delta) => {
    const cam = state.camera;
    // Once arrived, keep camera locked at end position
    if (hasArrived.current) {
      cam.position.set(0, 0, CAMERA_END_Z);
      return;
    }

    // Before flying starts, hold at start
    if (!isFlying) {
      if (!hasStarted.current) {
        cam.position.set(0, 0, startZUsed);
      }
      return;
    }

    hasStarted.current = true;
    progress.current = Math.min(progress.current + delta / FLY_DURATION, 1);
    const eased = 1 - Math.pow(1 - progress.current, 3);
    
    cam.position.z = MathUtils.lerp(startZUsed, CAMERA_END_Z, eased);
    cam.position.y = Math.sin(progress.current * Math.PI * 2) * 0.3;
    cam.position.x = Math.sin(progress.current * Math.PI * 3) * 0.5;
    
    if (progress.current >= 1) {
      hasArrived.current = true;
      cam.position.set(0, 0, CAMERA_END_Z);
      onArrived();
    }
  });

  return null;
}

// Preload all cloud textures
function TexturePreloader({ onLoaded }: { onLoaded: () => void }) {
  useTexture(ALL_CLOUD_TEXTURES);
  useEffect(() => { onLoaded(); }, [onLoaded]);
  return null;
}

function App() {
  const [assetsLoaded, setAssetsLoaded] = useState(false);
  const [texturesReady, setTexturesReady] = useState(false);
  const [hasEntered, setHasEntered] = useState(false);
  const [isFading, setIsFading] = useState(false);
  const [isFlying, setIsFlying] = useState(false);
  const [showContent, setShowContent] = useState(false);
  const [contentRevealed, setContentRevealed] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [noPos, setNoPos] = useState({ x: 0, y: 0 });
  const [noMoves, setNoMoves] = useState(0);
  const [hideNo, setHideNo] = useState(false);
  const [showYesModal, setShowYesModal] = useState(false);
  const [heartGlowing, setHeartGlowing] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Responsive settings for the heart model and camera
  const [responsiveSettings, setResponsiveSettings] = useState<{ scale: number; initialPosition: [number, number, number]; cameraZ: number }>({
    scale: HEART_SCALE,
    initialPosition: HEART_INITIAL_POSITION,
    cameraZ: CAMERA_START_Z,
  });

  useEffect(() => {
    const compute = () => {
      const w = window.innerWidth;
      if (w <= 420) {
        return { scale: HEART_SCALE * 0.55, initialPosition: [0, -1.2, -4] as [number, number, number], cameraZ: CAMERA_START_Z + 8 };
      }
      if (w <= 768) {
        return { scale: HEART_SCALE * 0.75, initialPosition: [0, -1.8, -4.5] as [number, number, number], cameraZ: CAMERA_START_Z + 4 };
      }
      return { scale: HEART_SCALE, initialPosition: HEART_INITIAL_POSITION, cameraZ: CAMERA_START_Z };
    };
    const apply = () => setResponsiveSettings(compute());
    apply();
    window.addEventListener('resize', apply);
    return () => window.removeEventListener('resize', apply);
  }, []);

  const toggleMute = useCallback(() => {
    setIsMuted((prev) => {
      const next = !prev;
      if (audioRef.current) {
        if (next) {
          audioRef.current.pause();
        } else {
          audioRef.current.play().catch(() => {});
        }
      }
      return next;
    });
  }, []);

  const handleHeartTap = useCallback(() => {
    setHeartGlowing(true);
    setTimeout(() => setHeartGlowing(false), 600);
  }, []);

  const hasWebGL = useMemo(() => {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl') || c.getContext('webgl2'));
  }, []);

  useEffect(() => {
    const audio = new Audio(BG_MUSIC_PATH);
    audio.loop = true;
    audio.volume = 0.4;
    audioRef.current = audio;
    return () => { audio.pause(); audio.src = ''; };
  }, []);

  useEffect(() => {
    const t = setTimeout(() => setAssetsLoaded(true), 300);
    return () => clearTimeout(t);
  }, []);

  const handleTexturesLoaded = useCallback(() => setTexturesReady(true), []);
  const canEnter = assetsLoaded && texturesReady;

  const handleEnter = () => {
    if (audioRef.current) audioRef.current.play().catch(() => {});
    setIsFading(true);
    setTimeout(() => {
      setHasEntered(true);
      setIsFlying(true);
    }, 600);
  };

  const handleArrived = useCallback(() => {
    // Don't reset isFlying — camera controller handles staying at end
    setShowContent(true);
    requestAnimationFrame(() => {
      requestAnimationFrame(() => setContentRevealed(true));
    });
  }, []);

  const playSound = useCallback((src: string, volume = 0.7) => {
    const a = new Audio(src);
    a.volume = volume;
    a.play().catch(() => {});
    return a;
  }, []);

  const handleYes = () => {
    setShowConfetti(true);
    setShowYesModal(true);
    // Firework: launch then burst
    playSound(FIREWORK_LAUNCH_PATH, 0.6);
    setTimeout(() => playSound(FIREWORK_BURST_PATH, 0.7), 700);
    // Confetti: pop 1 then pop 2
    setTimeout(() => playSound(CONFETTI_POP1_PATH, 0.6), 300);
    setTimeout(() => playSound(CONFETTI_POP2_PATH, 0.6), 900);
    setTimeout(() => setShowConfetti(false), 5000);
  };

  const handleNo = () => {
    playSound(RIZZ_SOUND_PATH, 0.8);
    const n = noMoves + 1;
    setNoMoves(n);
    const offset = 80 + n * 30;
    const angle = Math.random() * Math.PI * 2;
    setNoPos({ x: Math.cos(angle) * offset, y: Math.sin(angle) * offset });
    if (n >= 6) setHideNo(true);
  };

  if (!hasWebGL) {
    return (
      <div className="App-container">
        <div className="loading-screen">
          <p>Your browser does not support WebGL.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="App-container">
      <div className="pink-overlay" />
      {hasEntered && (
      <button className="audio-toggle-button" onClick={toggleMute} title={isMuted ? 'Play' : 'Pause'}>
          <svg width="102" height="69" viewBox="0 0 102 69" className="audio-bars-playing" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: isMuted ? 'none' : 'block' }}>
            <rect y="17" width="24" height="37" fill="white" />
            <rect x="39" width="24" height="69" fill="white" />
            <rect x="78" y="12" width="24" height="42" fill="white" />
          </svg>
          <svg width="102" height="24" viewBox="0 0 102 24" className="audio-bars-muted" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ display: isMuted ? 'block' : 'none' }}>
            <rect width="24" height="24" fill="white" />
            <rect x="39" width="24" height="24" fill="white" />
            <rect x="78" width="24" height="24" fill="white" />
          </svg>
        </button>
      )}
      {!hasEntered && (
        <div className={`loading-screen ${isFading ? 'loading-fade-out' : ''}`}>
          <img src="/gif/Heart Arrow Sticker.gif" alt="Loading" width="200" />
          {!canEnter ? (
            <p style={{ marginTop: '20px' }}>Loading...</p>
          ) : (
            <button className="enter-button" onClick={handleEnter}>Enter</button>
          )}
        </div>
      )}
      <Canvas
        camera={{ position: [0, 0, responsiveSettings.cameraZ], fov: 75 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        dpr={[1, 2]}
      >
        <Suspense fallback={null}>
          <TexturePreloader onLoaded={handleTexturesLoaded} />
          <fog attach="fog" args={[0x87ceeb, 5, 45]} />
          <ambientLight intensity={1.5} />
          <directionalLight position={[5, 5, 5]} intensity={2.0} castShadow />
          <pointLight position={[0, 0, 3]} intensity={1.5} />
          <pointLight position={[-5, 2, -3]} intensity={1.2} color="#ff69b4" />
          <pointLight position={[5, -2, -3]} intensity={1.2} color="#ff1493" />
          <Environment preset="sunset" environmentIntensity={0.4} />

          <CameraFlyThrough isFlying={isFlying} onArrived={handleArrived} startZ={responsiveSettings.cameraZ} />

          {/* Heart — always present, camera flies toward it */}
          <Heart onTap={handleHeartTap} scale={responsiveSettings.scale} initialPosition={responsiveSettings.initialPosition} />

          {/* Tunnel clouds — camera flies through these */}
          {TUNNEL_CLOUDS.map((c, i) => (
            <CloudMesh
              key={`tunnel-${i}`}
              position={[c.x, c.y, c.z]}
              scale={c.scale}
              opacity={c.opacity}
              img={c.img}
            />
          ))}

          {/* Scene clouds around the heart area */}
          {SCENE_CLOUDS.map((c, i) => (
            <CloudMesh
              key={`scene-${i}`}
              position={[c.x, c.y, c.z]}
              scale={c.scale}
              opacity={c.opacity}
              img={c.img}
            />
          ))}
        </Suspense>
      </Canvas>
      {/* Soft pastel glow when heart is tapped */}
      <div className={`heart-glow-overlay ${heartGlowing ? 'active' : ''}`} />
      {showContent && (
        <>
          <div className={`valentine-question ${contentRevealed ? 'content-revealed' : ''}`}>
            <h1>Will you be my valentine?</h1>
          </div>
          <div className={`valentine-buttons ${contentRevealed ? 'content-revealed' : ''}`}>
            <button className="yes-button" onClick={handleYes}>Yes</button>
            {!hideNo && (
              <button
                className="no-button"
                onClick={handleNo}
                style={noMoves > 0 ? { position: 'fixed', left: `calc(50% + ${noPos.x}px)`, top: `calc(50% + ${noPos.y}px)`, transform: 'translate(-50%, -50%)', zIndex: 1001 } : {}}
              >
                No
              </button>
            )}
          </div>
          {showConfetti && (
            <div className="confetti">
              {CONFETTI_DATA.map((h, i) => (
                <img
                  key={i}
                  src={h.img}
                  alt=""
                  className="confetti-heart"
                  style={{
                    left: `${h.left}%`,
                    width: `${h.size}px`,
                    height: `${h.size}px`,
                    animationDelay: `${h.delay}s`,
                    animationDuration: `${h.duration}s`,
                    '--sway': `${h.sway}px`,
                    '--start-rot': `${h.rotation}deg`,
                  } as React.CSSProperties}
                />
              ))}
            </div>
          )}
          {showYesModal && (
            <div className="yes-modal-overlay" onClick={() => setShowYesModal(false)}>
              <div className="yes-modal" onClick={(e) => e.stopPropagation()}>
                <img src="/gif/Pink Flower Sticker.gif" alt="" className="modal-flower modal-flower-tl" />
                <img src="/gif/Pink Flower Sticker (1).gif" alt="" className="modal-flower modal-flower-tr" />
                <img src="/gif/Pink Flower Sticker (1).gif" alt="" className="modal-flower modal-flower-bl" />
                <img src="/gif/Pink Flower Sticker.gif" alt="" className="modal-flower modal-flower-br" />
                <button className="yes-modal-close" onClick={() => setShowYesModal(false)}>&times;</button>
                <h2><img src="/images/hearts/Heart Doodle PNG.webp" alt="" className="modal-heart-icon" /> Yayyyy! <img src="/images/hearts/Heart Doodle PNG.webp" alt="" className="modal-heart-icon" /></h2>
                <p>I knew you'd say yes!</p>
                <p className="yes-modal-message">
                  You mean the world to me. Every moment with you feels like a dream I never want to wake up from.
                  Happy Valentine's Day, my love!
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default App;
