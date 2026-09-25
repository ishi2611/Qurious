"use client";

import { RefObject, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Line, OrbitControls } from "@react-three/drei";
import { Vector3 } from "three";
import type { BlochVector } from "@/lib/quantum";
import { useThemeColors } from "@/lib/useThemeColors";

/**
 * The 3D part of the Bloch sphere, loaded lazily (three.js is large).
 * Bloch axes → three.js axes: x → +z (toward the viewer), y → +x (right), z → +y (up).
 */
const toScene = (v: BlochVector): [number, number, number] => [v.y, v.z, v.x];

function Circle({ axis, color }: { axis: "xy" | "yz" | "xz"; color: string }) {
  const points: [number, number, number][] = [];
  for (let i = 0; i <= 64; i++) {
    const t = (i / 64) * Math.PI * 2;
    const [a, b] = [Math.cos(t), Math.sin(t)];
    points.push(
      axis === "xy" ? [a, 0, b] : axis === "yz" ? [a, b, 0] : [0, a, b],
    );
  }
  return (
    <Line
      points={points}
      color={color}
      lineWidth={1}
      transparent
      opacity={0.6}
    />
  );
}

const LABELS: {
  position: [number, number, number];
  text: string;
  color: "zero" | "one" | "inkMuted";
}[] = [
  { position: [0, 1.3, 0], text: "|0⟩", color: "zero" },
  { position: [0, -1.3, 0], text: "|1⟩", color: "one" },
  { position: [0, 0, 1.35], text: "|+⟩", color: "inkMuted" },
  { position: [1.38, 0, 0], text: "|+i⟩", color: "inkMuted" },
];

/**
 * Keeps the axis labels (plain DOM spans over the canvas) positioned as the view rotates, by
 * projecting each label's 3D point through the camera every frame. We use this instead of
 * drei's <Html>, which can leave the first label empty when its container mounts late.
 */
function LabelProjector({
  refs,
}: {
  refs: RefObject<(HTMLSpanElement | null)[]>;
}) {
  const { camera, size } = useThree();
  const v = useRef(new Vector3());
  useFrame(() => {
    LABELS.forEach((label, i) => {
      const el = refs.current?.[i];
      if (!el) return;
      v.current.set(...label.position).project(camera);
      const x = ((v.current.x + 1) / 2) * size.width;
      const y = ((1 - v.current.y) / 2) * size.height;
      el.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px)`;
    });
  });
  return null;
}

export default function BlochScene({ vector }: { vector: BlochVector }) {
  const c = useThemeColors();
  const tip = toScene(vector);
  const labelRefs = useRef<(HTMLSpanElement | null)[]>([]);
  return (
    <div className="relative h-full w-full">
      <Canvas
        camera={{ position: [2.5, 0.9, 3.4], fov: 45 }}
        dpr={[1, 2]}
        aria-hidden="true"
      >
        <ambientLight intensity={0.8} />
        <mesh>
          <sphereGeometry args={[1, 48, 32]} />
          <meshBasicMaterial
            color={c.accent}
            transparent
            opacity={0.06}
            depthWrite={false}
          />
        </mesh>
        <Circle axis="xy" color={c.border} />
        <Circle axis="yz" color={c.border} />
        <Circle axis="xz" color={c.border} />
        <Line
          points={[
            [0, -1.15, 0],
            [0, 1.15, 0],
          ]}
          color={c.inkMuted}
          lineWidth={1}
          dashed
          dashSize={0.05}
          gapSize={0.05}
        />
        <Line
          points={[
            [-1.15, 0, 0],
            [1.15, 0, 0],
          ]}
          color={c.inkMuted}
          lineWidth={1}
          dashed
          dashSize={0.05}
          gapSize={0.05}
        />
        <Line
          points={[
            [0, 0, -1.15],
            [0, 0, 1.15],
          ]}
          color={c.inkMuted}
          lineWidth={1}
          dashed
          dashSize={0.05}
          gapSize={0.05}
        />
        <LabelProjector refs={labelRefs} />
        <Line points={[[0, 0, 0], tip]} color={c.accent} lineWidth={4} />
        <mesh position={tip}>
          <sphereGeometry args={[0.06, 16, 16]} />
          <meshBasicMaterial color={c.accent} />
        </mesh>
        <OrbitControls enablePan={false} enableZoom={false} rotateSpeed={0.6} />
      </Canvas>
      {LABELS.map((label, i) => (
        <span
          key={label.text}
          ref={(el) => {
            labelRefs.current[i] = el;
          }}
          aria-hidden="true"
          className="pointer-events-none absolute top-0 left-0 font-mono text-[13px] font-semibold whitespace-nowrap"
          style={{ color: c[label.color] }}
        >
          {label.text}
        </span>
      ))}
    </div>
  );
}
