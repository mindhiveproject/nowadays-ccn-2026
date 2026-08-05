"use client";

import { useEffect, useRef } from "react";
import type p5 from "p5";
import type { PlanetParams } from "@/lib/types/planet";
import { DEFAULT_PARAMS } from "@/lib/types/planet";

type PlanetCanvasProps = {
  params?: PlanetParams;
  className?: string;
  /** When true, canvas fills the container width as a square. */
  fill?: boolean;
  size?: number;
};

type Particle = {
  angle: number;
  radius: number;
  baseRadius: number;
  speed: number;
  offset: number;
  sizeJitter: number;
};

const PARTICLE_COUNT = 900;

export default function PlanetCanvas({
  params = DEFAULT_PARAMS,
  className = "",
  fill = true,
  size,
}: PlanetCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const paramsRef = useRef<PlanetParams>(params);
  const sketchRef = useRef<p5 | null>(null);

  paramsRef.current = params;

  useEffect(() => {
    let cancelled = false;
    let instance: p5 | null = null;

    async function boot() {
      const P5 = (await import("p5")).default;
      if (cancelled || !hostRef.current) return;

      const host = hostRef.current;

      const sketch = (p: p5) => {
        let particles: Particle[] = [];
        let canvasSize = 300;

        function measure() {
          if (size) {
            canvasSize = size;
            return;
          }
          const w = host.clientWidth || 300;
          canvasSize = Math.max(120, Math.floor(w));
        }

        function spawnParticles() {
          particles = [];
          for (let i = 0; i < PARTICLE_COUNT; i++) {
            const t = i / PARTICLE_COUNT;
            const baseRadius = p.lerp(0.12, 0.46, Math.pow(t, 0.7));
            particles.push({
              angle: p.random(p.TWO_PI),
              radius: baseRadius,
              baseRadius,
              speed: p.random(0.002, 0.012),
              offset: p.random(p.TWO_PI),
              sizeJitter: p.random(0.6, 1.4),
            });
          }
        }

        p.setup = () => {
          measure();
          p.createCanvas(canvasSize, canvasSize);
          p.pixelDensity(1);
          p.noStroke();
          spawnParticles();
        };

        p.windowResized = () => {
          if (size) return;
          measure();
          p.resizeCanvas(canvasSize, canvasSize);
        };

        p.draw = () => {
          const {
            params1: movement,
            params2: color,
            params3: particleSize,
            params4: agitation,
          } = paramsRef.current;

          p.background(0);

          const cx = p.width / 2;
          const cy = p.height / 2;
          const maxR = p.width * 0.48;

          // Hue range: cool blue/purple → pink/magenta → warm gold
          const baseHue = p.lerp(210, 45, color);
          const hueSpread = p.lerp(40, 90, color);

          // Ring vs filled cloud: higher movement opens a hollow core
          const innerHole = p.lerp(0.05, 0.55, movement);

          const speedMul = p.lerp(0.3, 2.2, movement);
          const agitate = agitation;
          const baseDot = p.lerp(1.2, 4.5, particleSize);

          for (const particle of particles) {
            particle.angle += particle.speed * speedMul;

            const noiseN = p.noise(
              particle.offset,
              particle.angle * 0.5,
              p.frameCount * 0.008,
            );
            const wobble =
              (noiseN - 0.5) * agitate * 0.35 +
              Math.sin(particle.angle * 3 + particle.offset) * agitate * 0.08;

            const ringRadius = p.lerp(
              particle.baseRadius,
              p.lerp(innerHole, 0.92, particle.baseRadius),
              movement,
            );

            const r = (ringRadius + wobble) * maxR;
            const x = cx + Math.cos(particle.angle) * r;
            const y =
              cy +
              Math.sin(particle.angle) * r * p.lerp(0.92, 1.08, agitate * 0.5);

            const distNorm = p.constrain(r / maxR, 0, 1);
            const hue = (baseHue + distNorm * hueSpread + wobble * 80) % 360;
            const sat = p.lerp(55, 90, color);
            const bri = p.lerp(70, 95, 1 - distNorm * 0.35);
            const alpha = p.lerp(90, 160, 1 - agitate * 0.3);

            p.colorMode(p.HSB, 360, 100, 100, 255);
            p.fill(hue, sat, bri, alpha);
            p.circle(x, y, baseDot * particle.sizeJitter);
          }

          p.colorMode(p.RGB, 255);
        };
      };

      instance = new P5(sketch, host);
      sketchRef.current = instance;
    }

    void boot();

    return () => {
      cancelled = true;
      sketchRef.current?.remove();
      sketchRef.current = null;
      instance?.remove();
    };
  }, [fill, size]);

  return (
    <div
      ref={hostRef}
      className={`overflow-hidden bg-black ${fill ? "w-full aspect-square" : ""} ${className}`}
      style={size ? { width: size, height: size } : undefined}
    />
  );
}
