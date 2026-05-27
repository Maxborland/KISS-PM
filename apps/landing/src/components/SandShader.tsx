import { useEffect, useRef } from "react";

/**
 * SandShader — full-bleed WebGL2 canvas, имитирующий хаос пустыни:
 * FBM-noise (4–5 октав), domain warp для дюн, derivative-based fake
 * lighting с тёплыми блика­ми, и radial clear-mask с jitter-границей,
 * благодаря которой по центру остаётся «защищённая» белая зона.
 *
 * Палитра — тёплый бежевый/кремовый. Анимация медитативная (~0.03·t).
 * При prefers-reduced-motion рендерится один статичный кадр.
 * При отсутствии WebGL2 — добавляется fallback-класс, CSS рисует
 * статичный градиент в тех же тонах.
 */

const VERT = `#version 300 es
in vec2 aPos;
void main() {
  gl_Position = vec4(aPos, 0.0, 1.0);
}
`;

const FRAG = `#version 300 es
precision highp float;

uniform vec2  uResolution;
uniform float uTime;
uniform float uClearRadius;   // 0..1 от min(width, height)
uniform float uReducedMotion; // 0.0 норм, 1.0 заморозить

out vec4 fragColor;

float hash21(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash21(i);
  float b = hash21(i + vec2(1.0, 0.0));
  float c = hash21(i + vec2(0.0, 1.0));
  float d = hash21(i + vec2(1.0, 1.0));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbm(vec2 p) {
  float sum = 0.0;
  float amp = 0.55;
  for (int i = 0; i < 5; i++) {
    sum += amp * vnoise(p);
    p = p * 2.07 + vec2(13.1, 7.7);
    amp *= 0.5;
  }
  return sum;
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution.xy;
  float aspect = uResolution.x / uResolution.y;
  vec2 p = (uv - 0.5) * vec2(aspect, 1.0) * 2.4;

  float t = uTime * 0.03 * (1.0 - uReducedMotion);

  // domain warp — даёт «текучесть» дюн и завихрения песка
  vec2 q = vec2(
    fbm(p + vec2(t, -t * 0.5)),
    fbm(p + vec2(-t * 0.7, t) + 5.0)
  );
  vec2 warped = p + q * 0.65;

  float n = fbm(warped * 1.35 + t * 0.5);

  // sand palette: deep warm beige -> cream -> light -> highlight
  vec3 c1 = vec3(0.784, 0.659, 0.471); // #c8a878
  vec3 c2 = vec3(0.902, 0.812, 0.643); // #e6cfa4
  vec3 c3 = vec3(0.961, 0.910, 0.816); // #f5e8d0
  vec3 c4 = vec3(1.0);

  vec3 col = mix(c1, c2, smoothstep(0.18, 0.50, n));
  col = mix(col, c3, smoothstep(0.48, 0.78, n));
  col = mix(col, c4, smoothstep(0.86, 1.02, n));

  // fake-3D lighting через градиент шума
  float e = 0.012;
  float dx = fbm(warped + vec2(e, 0.0)) - fbm(warped - vec2(e, 0.0));
  float dy = fbm(warped + vec2(0.0, e)) - fbm(warped - vec2(0.0, e));
  vec3 normal = normalize(vec3(-dx * 9.0, -dy * 9.0, 1.0));

  vec3 lightDir = normalize(vec3(0.55, 0.65, 0.75));
  float diffuse = clamp(dot(normal, lightDir), 0.0, 1.0);
  col *= 0.72 + 0.55 * diffuse;

  // тёплые блики (specular) — рефлексы на гребнях дюн
  vec3 viewDir = vec3(0.0, 0.0, 1.0);
  vec3 halfDir = normalize(lightDir + viewDir);
  float spec = pow(max(dot(normal, halfDir), 0.0), 28.0);
  col += vec3(1.0, 0.96, 0.88) * spec * 0.55;

  // лёгкое потемнение в глубинах, чтобы дюны читались объёмнее
  float depth = smoothstep(0.0, 0.35, n);
  col *= mix(0.88, 1.0, depth);

  // radial clear mask — «защищённая» белая зона в центре
  vec2 centered = gl_FragCoord.xy - uResolution.xy * 0.5;
  float dist = length(centered) / min(uResolution.x, uResolution.y);

  // jitter границы — песчинки прорываются в чистую зону
  float jitter = (vnoise(centered * 0.018 + t * 1.7) - 0.5) * 0.10
               + (vnoise(centered * 0.06 - t * 1.2) - 0.5) * 0.04;

  float inner = uClearRadius + jitter;
  float outer = uClearRadius * 1.9 + jitter;
  float mask = smoothstep(inner, outer, dist);

  // micro-dust: редкие песчинки даже внутри чистой зоны
  float dust = step(0.985, hash21(floor(gl_FragCoord.xy * 0.5) + t * 6.0));
  float dustAlpha = dust * (1.0 - mask) * 0.35;
  col = mix(col, c1, dustAlpha);
  mask = max(mask, dustAlpha * 0.6);

  fragColor = vec4(col, mask);
}
`;

function compile(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader | null {
  const sh = gl.createShader(type);
  if (!sh) return null;
  gl.shaderSource(sh, source);
  gl.compileShader(sh);
  if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) {
    console.warn("[SandShader] compile error:", gl.getShaderInfoLog(sh));
    gl.deleteShader(sh);
    return null;
  }
  return sh;
}

function link(gl: WebGL2RenderingContext, vs: WebGLShader, fs: WebGLShader): WebGLProgram | null {
  const prog = gl.createProgram();
  if (!prog) return null;
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    console.warn("[SandShader] link error:", gl.getProgramInfoLog(prog));
    gl.deleteProgram(prog);
    return null;
  }
  return prog;
}

export default function SandShader() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const wrap = wrapRef.current;
    if (!canvas || !wrap) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const isMobile = window.matchMedia("(max-width: 720px)").matches;

    const gl = canvas.getContext("webgl2", {
      alpha: true,
      antialias: false,
      premultipliedAlpha: false,
      powerPreference: "low-power",
    });

    if (!gl) {
      wrap.classList.add("sand-shader--fallback");
      return;
    }

    const vs = compile(gl, gl.VERTEX_SHADER, VERT);
    const fs = compile(gl, gl.FRAGMENT_SHADER, FRAG);
    if (!vs || !fs) {
      wrap.classList.add("sand-shader--fallback");
      return;
    }

    const program = link(gl, vs, fs);
    if (!program) {
      wrap.classList.add("sand-shader--fallback");
      return;
    }

    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);

    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(
      gl.ARRAY_BUFFER,
      new Float32Array([-1, -1, 3, -1, -1, 3]),
      gl.STATIC_DRAW,
    );
    const aPos = gl.getAttribLocation(program, "aPos");
    gl.enableVertexAttribArray(aPos);
    gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

    const uResolution = gl.getUniformLocation(program, "uResolution");
    const uTime = gl.getUniformLocation(program, "uTime");
    const uClearRadius = gl.getUniformLocation(program, "uClearRadius");
    const uReducedMotion = gl.getUniformLocation(program, "uReducedMotion");

    gl.useProgram(program);
    gl.enable(gl.BLEND);
    gl.blendFuncSeparate(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA, gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

    const dprCap = isMobile ? 1.5 : 2;
    let width = 0;
    let height = 0;

    function resize() {
      if (!gl || !canvas) return;
      const dpr = Math.min(window.devicePixelRatio || 1, dprCap);
      const cssW = canvas.clientWidth || window.innerWidth;
      const cssH = canvas.clientHeight || window.innerHeight;
      width = Math.max(1, Math.floor(cssW * dpr));
      height = Math.max(1, Math.floor(cssH * dpr));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      gl.viewport(0, 0, width, height);
      gl.uniform2f(uResolution, width, height);
      gl.uniform1f(uClearRadius, isMobile ? 0.28 : 0.34);
    }

    let visible = true;
    let docHidden = false;
    let rafId = 0;
    const startedAt = performance.now();
    const frozenT = reducedMotion ? 8.0 : 0;

    function render(now: number) {
      if (!gl) return;
      const t = reducedMotion ? frozenT : (now - startedAt) / 1000;
      gl.uniform1f(uTime, t);
      gl.uniform1f(uReducedMotion, reducedMotion ? 1 : 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (reducedMotion) return;
      if (!visible || docHidden) return;
      rafId = requestAnimationFrame(render);
    }

    function loop() {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(render);
    }

    resize();
    loop();

    const onResize = () => {
      resize();
      if (reducedMotion) {
        render(performance.now());
      }
    };
    window.addEventListener("resize", onResize, { passive: true });

    const onVisibility = () => {
      docHidden = document.hidden;
      if (!docHidden && visible && !reducedMotion) loop();
    };
    document.addEventListener("visibilitychange", onVisibility);

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          visible = e.isIntersecting;
        }
        if (visible && !docHidden && !reducedMotion) loop();
      },
      { threshold: 0.01 },
    );
    io.observe(canvas);

    return () => {
      io.disconnect();
      window.removeEventListener("resize", onResize);
      document.removeEventListener("visibilitychange", onVisibility);
      if (rafId) cancelAnimationFrame(rafId);
      gl.deleteBuffer(buf);
      gl.deleteVertexArray(vao);
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
    };
  }, []);

  return (
    <div ref={wrapRef} className="sand-shader" aria-hidden="true">
      <canvas ref={canvasRef} className="sand-shader__canvas" />
    </div>
  );
}
