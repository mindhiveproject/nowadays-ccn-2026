"use client";

import { useEffect, useRef } from "react";
import type p5 from "p5";
import {
  DEFAULT_STAR_PARAMS,
  SKETCH_DEFAULTS,
  type StarParams,
} from "@/lib/types/star";
import { VOID_COLOR } from "@/lib/theme";

type StarCanvasProps = {
  params?: StarParams;
  className?: string;
  /** Fixed square canvas in px. Omit to fill the host element. */
  size?: number;
};

/** Design resolution — sizes are relative to min(w, h) / REF. */
const REF = 900;
const TAU = Math.PI * 2;

type Particle = {
  a0: number;
  a1: number;
  nx: number;
  ny: number;
  x: number;
  y: number;
  r: number;
  glow: number;
};

const sceneShaderCode = `
precision highp float;
varying vec2 vTexCoord;
uniform vec2 canvasSize;

uniform vec2  uPos;
uniform vec3  uCol, uColB, uBase;
uniform float uRad;
uniform float uTone, uThresh, uFuse, uBlend, uHalo, uGrad, uSoft;

void main() {
  vec2 st = vTexCoord;

  // distances in units of min(width, height) — matches the CPU-side scl
  vec2 unit = canvasSize / min(canvasSize.x, canvasSize.y);
  vec2 d = (st - uPos) * unit;

  float f = (uRad * uRad) / (dot(d, d) + 0.0001);

  float iso  = smoothstep(uThresh - uFuse, uThresh + uFuse, f);
  float halo = (1.0 - exp(-f * uBlend)) * uHalo;
  float b    = pow(max(iso, halo), uSoft);

  vec3 c = mix(uColB, uCol, clamp(sqrt(f) * uGrad, 0.0, 1.0));

  vec3  toneCol = vec3(step(1.0, uTone));   // <1 → black, >=1 → white
  float toneAmt = abs(uTone - 1.0);

  gl_FragColor = vec4(mix(uBase, mix(c, toneCol, iso * toneAmt), b), 1.0);
}
`;

const postShaderCode = `
precision highp float;
varying vec2 vTexCoord;
uniform sampler2D tex0;
uniform vec2 texelSize;
uniform float uCA, uGrainAmt, uGrainDisp, uSeed;

float rand(vec2 st) {
  return fract(sin(dot(st.xy, vec2(12.9898, 78.233))) * 43758.5453123);
}

float softLight(float base, float blend) {
  return (blend < 0.5)
    ? (2.0 * base * blend + base * base * (1.0 - 2.0 * blend))
    : (sqrt(base) * (2.0 * blend - 1.0) + 2.0 * base * (1.0 - blend));
}

void main() {
  vec2 st   = vTexCoord;
  vec2 seed = st + vec2(uSeed, uSeed * 1.7);

  float angle = rand(seed) * 6.28318;
  float dist  = rand(seed + 0.5) * uGrainDisp;
  vec2  p     = st + vec2(cos(angle), sin(angle)) * dist * texelSize;

  vec2 dir = p - 0.5;
  vec2 off = dir * dot(dir, dir) * uCA * 4.0;
  vec3 col = vec3(
    texture2D(tex0, p - off).r,
    texture2D(tex0, p).g,
    texture2D(tex0, p + off).b
  );

  vec3 g = vec3(rand(seed), rand(seed + 0.3), rand(seed + 0.7));
  vec3 lit = vec3(softLight(col.r, g.r), softLight(col.g, g.g), softLight(col.b, g.b));
  gl_FragColor = vec4(mix(col, lit, uGrainAmt), 1.0);
}
`;

function hexToRGB(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h;
  const n = parseInt(full, 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
}

export default function StarCanvas({
  params = DEFAULT_STAR_PARAMS,
  className = "",
  size,
}: StarCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const paramsRef = useRef<StarParams>(params);
  const sketchRef = useRef<p5 | null>(null);
  /** Bumped whenever params change, so the sketch knows to re-push uniforms. */
  const versionRef = useRef(0);

  // Hand new params to the running sketch without tearing it down. The version
  // bump is what tells draw() to re-push uniforms.
  useEffect(() => {
    paramsRef.current = params;
    versionRef.current += 1;
  }, [params]);

  useEffect(() => {
    let cancelled = false;

    async function boot() {
      const P5 = (await import("p5")).default;
      if (cancelled || !hostRef.current) return;

      const host = hostRef.current;

      const sketch = (p: p5) => {
        const S = SKETCH_DEFAULTS;
        let scl = 1;
        let w = 0;
        let h = 0;
        let particles: Particle[] = [];
        let starX = 0;
        let starY = 0;
        let sceneShader: p5.Shader;
        let postShader: p5.Shader;
        let appliedVersion = -1;

        function measure() {
          if (size) {
            w = size;
            h = size;
            return;
          }
          w = Math.max(1, host.clientWidth || window.innerWidth);
          h = Math.max(1, host.clientHeight || window.innerHeight);
        }

        function rescale() {
          scl = Math.min(w, h) / REF;
        }

        function makeParticle(): Particle {
          return {
            a0: p.random(TAU),
            a1: p.random(TAU),
            nx: p.random(1000),
            ny: p.random(1000),
            x: starX,
            y: starY,
            r: 0,
            glow: 0,
          };
        }

        function spawnParticles() {
          particles = Array.from({ length: S.particles.num }, makeParticle);
        }

        /** HSB hue (0–255) → normalized RGB, at the glow's sat/bri. */
        function hueToRGB(hue: number): [number, number, number] {
          const c = p.color(hue, S.glow.sat * 255, S.glow.bri * 255);
          return [p.red(c) / 255, p.green(c) / 255, p.blue(c) / 255];
        }

        /** Only runs when params actually changed — not every frame. */
        function pushUniforms() {
          const u = paramsRef.current;

          sceneShader.setUniform("uPos", [S.star.x, S.star.y]);
          sceneShader.setUniform("uCol", hueToRGB(u.hue));
          sceneShader.setUniform("uColB", hueToRGB(u.hue2));
          sceneShader.setUniform(
            "uRad",
            (u.size / REF) *
              (S.glow.radBase + (u.core / 100) * S.glow.radCore),
          );
          sceneShader.setUniform("uBase", hexToRGB(S.glow.base));
          sceneShader.setUniform("uTone", S.glow.tone);
          sceneShader.setUniform("uThresh", S.glow.thresh);
          sceneShader.setUniform("uFuse", S.glow.fuse);
          sceneShader.setUniform("uBlend", S.glow.blend);
          sceneShader.setUniform("uHalo", S.glow.halo);
          sceneShader.setUniform("uGrad", S.glow.grad);
          sceneShader.setUniform("uSoft", S.glow.soft);

          postShader.setUniform("uCA", S.post.ca);
          postShader.setUniform("uGrainAmt", S.post.grain);
          postShader.setUniform("uGrainDisp", S.post.grainDisplace);

          appliedVersion = versionRef.current;
        }

        function updateParticles(t: number) {
          const u = paramsRef.current;
          const P = S.particles;
          const starSize = u.size * scl;
          // slow orbit shrinks as core rises; fast wobble runs at u.freq
          const ampSlow = starSize * 0.5 * (1 - u.core / 100);
          const ampFast = starSize;
          const jitter = P.noiseGain * u.noise * scl;
          const nt = t * P.noiseSpeed;
          const coronaR = Math.max(P.coronaR * scl, 0.0001);
          const twoWsq = 2 * P.coronaW ** 2;

          for (const particle of particles) {
            const s0 = t + particle.a0;
            const s1 = u.freq * t + particle.a1;
            const tx =
              starX +
              ampSlow * Math.cos(s0) +
              ampFast * Math.cos(s1) +
              (p.noise(particle.nx + nt) - 0.5) * jitter;
            const ty =
              starY +
              ampSlow * Math.sin(s0) +
              ampFast * Math.sin(s1) +
              (p.noise(particle.ny + nt) - 0.5) * jitter;

            particle.x += (tx - particle.x) * P.follow;
            particle.y += (ty - particle.y) * P.follow;
            particle.r =
              Math.hypot(particle.x - starX, particle.y - starY) / coronaR;
            particle.glow = Math.exp(-((particle.r - 1) ** 2) / twoWsq);
          }
        }

        function renderParticles() {
          const u = paramsRef.current;
          const P = S.particles;
          const dot = P.size * scl;
          const invSpread = 1 / P.hueSpread;

          for (const particle of particles) {
            if (particle.glow < 0.004) continue; // below 1/255, nothing to draw
            const g = 255 * particle.glow;
            p.fill(
              p.lerp(u.hue, u.hue2, Math.min(1, particle.r * invSpread)),
              P.sat,
              g,
              g,
            );
            p.ellipse(particle.x, particle.y, dot, dot, P.detail);
          }
        }

        p.setup = () => {
          measure();
          p.createCanvas(w, h, p.WEBGL);
          p.pixelDensity(1);
          p.colorMode(p.HSB, 255);
          p.noStroke();
          p.noiseDetail(S.particles.noiseOctaves, 0.5);
          rescale();

          sceneShader = p.createFilterShader(sceneShaderCode);
          postShader = p.createFilterShader(postShaderCode);

          spawnParticles();
        };

        p.windowResized = () => {
          if (size) return;
          measure();
          p.resizeCanvas(w, h);
          rescale();
        };

        p.draw = () => {
          const t = p.millis() / 1000;

          // color is irrelevant (pass 1 overwrites it) — this clears the depth buffer
          p.background(0);

          if (appliedVersion !== versionRef.current) pushUniforms();
          p.filter(sceneShader);

          p.translate(-p.width / 2, -p.height / 2, 0);
          starX = S.star.x * p.width;
          starY = S.star.y * p.height;
          updateParticles(t);
          renderParticles();

          if (S.post.grainAnimate) {
            postShader.setUniform("uSeed", (p.frameCount * 0.618034) % 1);
          }
          p.filter(postShader);
        };
      };

      sketchRef.current = new P5(sketch, host);
    }

    void boot();

    return () => {
      cancelled = true;
      sketchRef.current?.remove();
      sketchRef.current = null;
    };
  }, [size]);

  return (
    <div
      ref={hostRef}
      className={`overflow-hidden ${size ? "" : "h-full w-full"} ${className}`}
      style={
        size
          ? { width: size, height: size, backgroundColor: VOID_COLOR }
          : { backgroundColor: VOID_COLOR }
      }
    />
  );
}
