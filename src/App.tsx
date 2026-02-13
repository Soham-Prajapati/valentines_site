import { Canvas, useFrame, useLoader, useThree } from '@react-three/fiber';
import { useState, useEffect, useRef, Suspense, useMemo, useCallback } from 'react';
import './App.css';
import { Group, Mesh, TextureLoader, Box3, Vector3, MathUtils } from 'three';
import { useGLTF, useTexture } from '@react-three/drei';
import * as THREE from 'three';

// --- Constants for 3D Scene Configuration ---
// Heart
const HEART_MODEL_PATH = '/models/3D_Heart-Red.glb';
const HEART_INITIAL_POSITION: [number, number, number] = [0, 0.3, -5];
const HEART_SCALE = 3.0;
const HEART_MOUSE_EFFECT_STRENGTH_POSITION = 0.4;
const HEART_MOUSE_EFFECT_LERP_FACTOR = 0.05;

// Background music
const BG_MUSIC_PATH = '/audio/Cosmic Candy Music.ogg';

// Cloud image paths
const CLOUD_PATH = '/images/clouds/Realistic White Cloud.png';
const CARTOON_CLOUD_1 = '/images/cartoonClouds/Cartoon Clouds Transparent PNG.png';
const CARTOON_CLOUD_2 = '/images/cartoonClouds/Fluffy White Cartoon Cloud.png';
const CARTOON_CLOUD_3 = '/images/cartoonClouds/Photoshop Extension Image.png';
const CARTOON_CLOUD_4 = '/images/cartoonClouds/Photoshop Extension Image (1).png';

// All heart images for confetti celebration
const HEART_IMAGES = [
  '/images/hearts/Hand Drawn Pink Heart Doodle.png',
  '/images/hearts/Cute Love Heart Doodle.avif',
  '/images/hearts/Colored Heart Doodle.webp',
  '/images/hearts/Doodle Love Heart PNG.webp',
  '/images/hearts/Heart Doodle PNG.webp',
  '/images/hearts/Heart Monochrome Doodle.webp',
];
const CLOUD_DEFAULT_PLANE_ARGS: [number, number] = [3, 2];

// Background clouds — cartoon + realistic mix
const CLOUD_CONFIGS = [
  // Near background (depth 1)
  { x: -5, y: 2, z: -7, scale: 2.5, opacity: 0.7, depth: 1, img: CARTOON_CLOUD_1 },
  { x: 5.5, y: -1.5, z: -7.5, scale: 2.8, opacity: 0.65, depth: 1, img: CARTOON_CLOUD_2 },
  { x: -3, y: -3, z: -7.2, scale: 2.2, opacity: 0.6, depth: 1, img: CARTOON_CLOUD_3 },
  { x: 6, y: 3, z: -7.8, scale: 2.6, opacity: 0.65, depth: 1, img: CARTOON_CLOUD_4 },
  { x: -7, y: 0, z: -7.4, scale: 2.4, opacity: 0.6, depth: 1, img: CLOUD_PATH },
  
  // Mid background (depth 2)
  { x: -7, y: 1, z: -10, scale: 3.2, opacity: 0.5, depth: 2, img: CARTOON_CLOUD_1 },
  { x: 4, y: 3.5, z: -10.5, scale: 3.0, opacity: 0.45, depth: 2, img: CARTOON_CLOUD_3 },
  { x: -4, y: -3.5, z: -11, scale: 2.8, opacity: 0.4, depth: 2, img: CARTOON_CLOUD_2 },
  { x: 8, y: -1, z: -10.8, scale: 3.4, opacity: 0.45, depth: 2, img: CARTOON_CLOUD_4 },
  { x: -8, y: 3.5, z: -11.2, scale: 3.0, opacity: 0.4, depth: 2, img: CLOUD_PATH },
  
  // Far background (depth 3)
  { x: -3, y: 2, z: -15, scale: 4.0, opacity: 0.35, depth: 3, img: CARTOON_CLOUD_1 },
  { x: 6, y: -2, z: -14, scale: 3.8, opacity: 0.3, depth: 3, img: CLOUD_PATH },
  { x: -9, y: -1, z: -14.5, scale: 4.2, opacity: 0.35, depth: 3, img: CARTOON_CLOUD_3 },
  { x: 3, y: 4, z: -16, scale: 3.5, opacity: 0.28, depth: 3, img: CARTOON_CLOUD_2 },
];

// Opening clouds — cartoon clouds that part from center to reveal heart
const OPENING_CLOUDS = [
  { direction: 'left' as const, y: 0.8, z: -3, img: CARTOON_CLOUD_1 },
  { direction: 'right' as const, y: -0.3, z: -3, img: CARTOON_CLOUD_3 },
  { direction: 'left' as const, y: -0.5, z: -3.5, img: CARTOON_CLOUD_2 },
  { direction: 'right' as const, y: 0.5, z: -3.5, img: CARTOON_CLOUD_4 },
  { direction: 'left' as const, y: 1.5, z: -2.5, img: CARTOON_CLOUD_1 },
  { direction: 'right' as const, y: -1.2, z: -2.5, img: CARTOON_CLOUD_2 },
];

// All cloud texture paths for preloading
const ALL_CLOUD_TEXTURES = [
  CLOUD_PATH, CARTOON_CLOUD_1, CARTOON_CLOUD_2, CARTOON_CLOUD_3, CARTOON_CLOUD_4,
];

// Scene Lighting and Camera
const CAMERA_INITIAL_POSITION: [number, number, number] = [0, 0, 5];

// Pre-generate confetti heart data
const CONFETTI_DATA = Array.from({ length: 120 }).map(() => ({
  size: 20 + Math.random() * 30,
  left: Math.random() * 100,
  delay: Math.random() * 3,
  duration: 1.8 + Math.random() * 1.5,
  sway: -30 + Math.random() * 60,
  rotation: Math.random() * 40 - 20,
  img: HEART_IMAGES[Math.floor(Math.random() * HEART_IMAGES.length)],
}));

const AMBIENT_LIGHT_INTENSITY = 1.5;
const DIRECTIONAL_LIGHT_POSITION: [number, number, number] = [5, 5, 5];
const DIRECTIONAL_LIGHT_INTENSITY = 2.0;
const POINT_LIGHT_POSITION: [number, number, number] = [0, 0, 3];
const POINT_LIGHT_INTENSITY = 1.5;
const RIM_LIGHT_1_POSITION: [number, number, number] = [-5, 2, -3];
const RIM_LIGHT_2_POSITION: [number, number, number] = [5, -2, -3];
const RIM_LIGHT_INTENSITY = 1.2;
// --- End Constants ---

interface HeartProps {
  showSketchEffect: boolean;
}

function Heart({ showSketchEffect }: HeartProps) {
  const groupRef = useRef<Group | null>(null);
  const mouse = useRef({ x: 0, y: 0 });
  const isDragging = useRef(false);
  const previousMouse = useRef({ x: 0, y: 0 });
  const rotation = useRef({ x: 0, y: 0 });
  const { scene } = useGLTF(HEART_MODEL_PATH);
  const { gl } = useThree();

  // Improve heart rendering quality and center its pivot by volume
  useEffect(() => {
    // Center pivot to bounding box center
    const box = new Box3().setFromObject(scene);
    const center = new Vector3();
    box.getCenter(center);
    scene.position.sub(center); // move so pivot is at geometric center

    scene.traverse((child) => {
      if ((child as Mesh).isMesh) {
        const mesh = child as Mesh;
        
        if (mesh.material) {
          const material = mesh.material as THREE.MeshStandardMaterial;
          if ('flatShading' in material) {
            material.flatShading = false;
          }
          mesh.material.needsUpdate = true;
        }
        if (mesh.geometry) {
          mesh.geometry.computeVertexNormals();
        }
      }
    });
    scene.scale.set(HEART_SCALE, HEART_SCALE, HEART_SCALE);
  }, [scene, showSketchEffect]);

  useEffect(() => {
    const canvas = gl.domElement;
    
    const handleMouseMove = (event: MouseEvent) => {
      const newX = (event.clientX / window.innerWidth) * 2 - 1;
      const newY = -(event.clientY / window.innerHeight) * 2 + 1;
      
      // Handle rotation on drag
      if (isDragging.current) {
        const deltaX = newX - previousMouse.current.x;
        const deltaY = newY - previousMouse.current.y;
        rotation.current.y += deltaX * 2; // Rotate around Y axis
        rotation.current.x += deltaY * 2; // Rotate around X axis
      }
      
      previousMouse.current = { x: newX, y: newY };
      mouse.current = { x: newX, y: newY };
    };

    const handleMouseDown = (event: MouseEvent) => {
      isDragging.current = true;
      previousMouse.current.x = (event.clientX / window.innerWidth) * 2 - 1;
      previousMouse.current.y = -(event.clientY / window.innerHeight) * 2 + 1;
      document.body.style.cursor = 'grabbing';
    };

    const handleMouseUp = () => {
      isDragging.current = false;
      document.body.style.cursor = 'grab';
    };

    document.body.style.cursor = 'grab';
    window.addEventListener('mousemove', handleMouseMove);
    canvas.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    
    return () => {
      document.body.style.cursor = 'default';
      window.removeEventListener('mousemove', handleMouseMove);
      canvas.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [gl]);

  useFrame(() => {
    if (groupRef.current) {
      // Parallax effect - follow mouse
      groupRef.current.position.x += (mouse.current.x * HEART_MOUSE_EFFECT_STRENGTH_POSITION - groupRef.current.position.x) * HEART_MOUSE_EFFECT_LERP_FACTOR;
      groupRef.current.position.y += (mouse.current.y * HEART_MOUSE_EFFECT_STRENGTH_POSITION - groupRef.current.position.y) * HEART_MOUSE_EFFECT_LERP_FACTOR;
      // Keep rotation static (no spin)
      groupRef.current.rotation.set(0, 0, 0);
    }
  });

  return (
    <group ref={groupRef} position={HEART_INITIAL_POSITION}>
      <primitive object={scene} />
    </group>
  );
}

interface CloudProps {
  position: [number, number, number];
  scale: number;
  opacity: number;
  depth: number;
  imgPath?: string;
}

function Cloud({ position, scale, opacity, depth, imgPath = CLOUD_PATH }: CloudProps) {
  const meshRef = useRef<Mesh | null>(null);
  const mouse = useRef({ x: 0, y: 0 });
  const initialPosition = useRef(position);
  const texture = useLoader(TextureLoader, imgPath);

  useEffect(() => {
    const handleMouseMove = (event: MouseEvent) => {
      mouse.current.x = (event.clientX / window.innerWidth) * 2 - 1;
      mouse.current.y = -(event.clientY / window.innerHeight) * 2 + 1;
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  useFrame(() => {
    if (meshRef.current) {
      const parallaxStrength = 1.0 / (depth * 0.7 + 0.05);
      meshRef.current.position.x = initialPosition.current[0] + mouse.current.x * parallaxStrength;
      meshRef.current.position.y = initialPosition.current[1] + mouse.current.y * parallaxStrength * 0.5;
    }
  });

  return (
    <mesh ref={meshRef} position={position} scale={[scale, scale, scale]} renderOrder={depth < 1 ? 10 : 0}>
      <planeGeometry args={CLOUD_DEFAULT_PLANE_ARGS} />
      <meshBasicMaterial 
        map={texture} 
        transparent={true} 
        opacity={opacity}
        depthWrite={false}
        depthTest={depth >= 1}
      />
    </mesh>
  );
}

function OpeningCloud({ direction, y, z, img, isActive }: { direction: 'left' | 'right'; y: number; z: number; img: string; isActive: boolean }) {
  const meshRef = useRef<Mesh | null>(null);
  const progress = useRef(0);
  const texture = useLoader(TextureLoader, img);

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    if (!isActive) {
      // Clouds cover the center before animation starts
      meshRef.current.position.x = direction === 'left' ? -1 : 1;
      meshRef.current.position.y = y;
      meshRef.current.position.z = z;
      meshRef.current.scale.setScalar(5.0);
      meshRef.current.visible = true;
      return;
    }
    progress.current = Math.min(progress.current + delta / 2.0, 1);
    const startX = direction === 'left' ? -1 : 1;
    const endX = direction === 'left' ? -16 : 16;
    const eased = MathUtils.smoothstep(progress.current, 0, 1);
    meshRef.current.position.x = MathUtils.lerp(startX, endX, eased);
    meshRef.current.position.y = y;
    meshRef.current.position.z = z;
    meshRef.current.scale.setScalar(5.0);
    meshRef.current.visible = progress.current < 0.95;
  });

  return (
    <mesh ref={meshRef} visible={true}>
      <planeGeometry args={[5, 3.5]} />
      <meshBasicMaterial map={texture} transparent opacity={0.85} depthWrite={false} />
    </mesh>
  );
}

// Preload all textures so Suspense resolves before enter
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
  const [showContent, setShowContent] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [noPos, setNoPos] = useState({ x: 0, y: 0 });
  const [noMoves, setNoMoves] = useState(0);
  const [hideNo, setHideNo] = useState(false);
  const [openingActive, setOpeningActive] = useState(false);
  const [showYesModal, setShowYesModal] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  const hasWebGL = useMemo(() => {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl') || canvas.getContext('webgl2'));
  }, []);

  // Create audio element once
  useEffect(() => {
    const audio = new Audio(BG_MUSIC_PATH);
    audio.loop = true;
    audio.volume = 0.4;
    audioRef.current = audio;
    return () => { audio.pause(); audio.src = ''; };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => setAssetsLoaded(true), 300);
    return () => clearTimeout(timer);
  }, []);

  const handleTexturesLoaded = useCallback(() => {
    setTexturesReady(true);
  }, []);

  const canEnter = assetsLoaded && texturesReady;

  const handleEnter = () => {
    // Start bg music
    if (audioRef.current) {
      audioRef.current.play().catch(() => {});
    }
    // Fade out loading screen
    setIsFading(true);
    
    // After fade (~600ms), remove loading and start cloud parting
    setTimeout(() => {
      setHasEntered(true);
      // Immediately start cloud parting animation
      setOpeningActive(true);
      // Show heart + question once clouds have parted enough
      setTimeout(() => {
        setShowContent(true);
      }, 800);
    }, 600);
  };

  const handleYes = () => {
    setShowConfetti(true);
    setShowYesModal(true);
    setTimeout(() => setShowConfetti(false), 5000);
  };

  const handleNo = () => {
    const nextMoves = noMoves + 1;
    setNoMoves(nextMoves);
    // move to random spot; gradually move out by increasing distance
    const offset = 80 + nextMoves * 30;
    const angle = Math.random() * Math.PI * 2;
    setNoPos({ x: Math.cos(angle) * offset, y: Math.sin(angle) * offset });
    if (nextMoves >= 6) {
      setHideNo(true);
    }
  };

  if (!hasWebGL) {
    return (
      <div className="App-container">
        <div className="loading-screen"> {/* Reusing loading-screen styles for fallback message */}
          <p>Your browser does not support WebGL. Please try a different browser.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="App-container">
      {/* Pink clouds background overlay — very subtle */}
      <div className="pink-overlay" />
      {!hasEntered && (
        <div className={`loading-screen ${isFading ? 'loading-fade-out' : ''}`}>
          <img src="/gif/Heart Arrow Sticker.gif" alt="Loading Animation" width="200" />
          {!canEnter ? (
            <p style={{ marginTop: '20px' }}>Loading...</p>
          ) : (
            <button className="enter-button" onClick={handleEnter}>
              Enter
            </button>
          )}
        </div>
      )}
      <Canvas 
        style={{ visibility: 'visible' }}
        camera={{ position: CAMERA_INITIAL_POSITION, fov: 75 }}
        gl={{ 
          antialias: true, 
          alpha: true,
          powerPreference: 'high-performance' 
        }}
        dpr={[1, 2]}
      >
        <Suspense fallback={null}>
          {/* Preload all cloud textures so enter is instant */}
          <TexturePreloader onLoaded={handleTexturesLoaded} />
          <fog attach="fog" args={[0x87ceeb, 10, 40]} />
          <ambientLight intensity={AMBIENT_LIGHT_INTENSITY} />
          <directionalLight position={DIRECTIONAL_LIGHT_POSITION} intensity={DIRECTIONAL_LIGHT_INTENSITY} castShadow />
          <pointLight position={POINT_LIGHT_POSITION} intensity={POINT_LIGHT_INTENSITY} />
          <pointLight position={RIM_LIGHT_1_POSITION} intensity={RIM_LIGHT_INTENSITY} color="#ff69b4" />
          <pointLight position={RIM_LIGHT_2_POSITION} intensity={RIM_LIGHT_INTENSITY} color="#ff1493" />

          {/* Heart — always in scene, revealed by clouds parting */}
          {showContent && <Heart showSketchEffect={true} />}
          
          {/* Background parallax clouds */}
          {CLOUD_CONFIGS.map((config, index) => (
            <Cloud 
              key={index}
              position={[config.x, config.y, config.z]}
              scale={config.scale}
              opacity={config.opacity}
              depth={config.depth}
              imgPath={config.img}
            />
          ))}
          {/* Opening clouds that cover center then part to reveal heart */}
          {OPENING_CLOUDS.map((c, i) => (
            <OpeningCloud key={`open-${i}`} direction={c.direction} y={c.y} z={c.z} img={c.img} isActive={openingActive} />
          ))}
        </Suspense>
      </Canvas>
      {showContent && (
        <>
          <div className="valentine-question">
            <h1>Will you be my valentine?</h1>
          </div>
          <div className="valentine-buttons">
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
                <button className="yes-modal-close" onClick={() => setShowYesModal(false)}>&times;</button>
                <h2>Yayyyy! 💖</h2>
                <p>I knew you'd say yes!</p>
                <p className="yes-modal-message">
                  You mean the world to me. Every moment with you feels like a dream I never want to wake up from. 
                  Happy Valentine's Day, my love! 🌹
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
