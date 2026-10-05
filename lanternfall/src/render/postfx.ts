import type { FxParams } from './effects';

/**
 * WebGL2 post-processing over the Canvas2D world (GAME_DESIGN §7.4):
 * gold-only bloom, manga screentone in the mid-dark tones, chromatic
 * aberration, vignette, palette inversion and impact speed lines, finished
 * like a woodblock print (§7.3.1): washi paper grain and fibres instead of
 * film grain, and a slightly misregistered gold plate.
 * "low" skips the bloom blur passes.
 */
const VERT = `#version 300 es
in vec2 pos;
out vec2 uv;
void main() {
  uv = pos * 0.5 + 0.5;
  gl_Position = vec4(pos, 0.0, 1.0);
}`;

/** Keep only warm, bright, saturated pixels: the gold. */
const BRIGHT = `#version 300 es
precision mediump float;
in vec2 uv;
uniform sampler2D src;
out vec4 color;
void main() {
  vec3 c = texture(src, uv).rgb;
  float warm = clamp((c.r - c.b) * 2.2, 0.0, 1.0) * step(c.g, c.r + 0.02);
  float lum = dot(c, vec3(0.299, 0.587, 0.114));
  color = vec4(c * warm * smoothstep(0.25, 0.6, lum), 1.0);
}`;

const BLUR = `#version 300 es
precision mediump float;
in vec2 uv;
uniform sampler2D src;
uniform vec2 dir;
out vec4 color;
void main() {
  vec3 sum = texture(src, uv).rgb * 0.227;
  sum += texture(src, uv + dir * 1.385).rgb * 0.316;
  sum += texture(src, uv - dir * 1.385).rgb * 0.316;
  sum += texture(src, uv + dir * 3.231).rgb * 0.070;
  sum += texture(src, uv - dir * 3.231).rgb * 0.070;
  color = vec4(sum, 1.0);
}`;

const COMPOSITE = `#version 300 es
precision mediump float;
in vec2 uv;
uniform sampler2D src;
uniform sampler2D bloom;
uniform float useBloom;
uniform vec2 res;
uniform float dotPx;
uniform float time;
uniform float invert;
uniform float fade;
uniform float ca;
uniform float impact;
uniform float frenzy;
out vec4 color;

const vec3 INK = vec3(0.027, 0.027, 0.039);
const vec3 ASH = vec3(0.431, 0.431, 0.471);
const vec3 BONE = vec3(0.949, 0.941, 0.918);

float hash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}

float vnoise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
    f.y
  );
}

/** Washi: soft cloudy pulp plus long thin kozo fibres. Fixed to the screen,
 *  like the paper a print sits on. Returns roughly -1..1. */
float washi(vec2 px) {
  float pulp = vnoise(px / 90.0) * 0.6 + vnoise(px / 23.0) * 0.4;
  vec2 q = mat2(0.94, -0.34, 0.34, 0.94) * px;
  float fibre = smoothstep(0.82, 0.97, vnoise(vec2(q.x / 140.0, q.y / 2.2)));
  fibre += smoothstep(0.86, 0.98, vnoise(vec2(q.y / 120.0, q.x / 2.6) + 17.0)) * 0.7;
  return (pulp - 0.5) * 1.2 + fibre;
}

/** How "gold plate" a colour is (warm, bright). */
float goldness(vec3 c) {
  // Bone is very slightly warm; only clearly gold pixels count.
  return clamp((c.r - c.b - 0.15) * 4.0, 0.0, 1.0) * step(c.g, c.r + 0.02) *
    smoothstep(0.2, 0.5, dot(c, vec3(0.299, 0.587, 0.114)));
}

void main() {
  vec2 d = uv - 0.5;
  float aspect = res.x / res.y;
  // Chromatic aberration only as a brief spike on damage/impacts, so the
  // palette stays black, white and gold the rest of the time.
  float k = ca * 0.0035;
  vec3 c;
  c.r = texture(src, uv + d * k).r;
  c.g = texture(src, uv).g;
  c.b = texture(src, uv - d * k).b;

  // Screentone: mid-dark tones become halftone dots (manga shading).
  float lum = dot(c, vec3(0.299, 0.587, 0.114));
  // Starts above the ink-wash ground (ink-2 ≈ 0.07) so only light falloff,
  // decals and other mid tones get toned.
  float band = smoothstep(0.085, 0.11, lum) * (1.0 - smoothstep(0.24, 0.36, lum));
  if (band > 0.0) {
    vec2 p = gl_FragCoord.xy / dotPx;
    p = mat2(0.7071, -0.7071, 0.7071, 0.7071) * p;
    float r = sqrt(clamp((lum - 0.06) / 0.3, 0.0, 1.0)) * 0.62;
    float dist = length(fract(p) - 0.5);
    float dotMask = 1.0 - smoothstep(r - 0.06, r + 0.06, dist);
    vec3 toned = mix(INK, c / max(lum, 0.001) * 0.42, dotMask);
    c = mix(c, toned, band);
  }

  // Misregistered gold plate: a faint offset ghost of every gold shape.
  vec3 shifted = texture(src, uv + vec2(1.6, -1.2) / res).rgb;
  float ghost = goldness(shifted) * (1.0 - goldness(c));
  c = mix(c, shifted * vec3(1.0, 0.86, 0.6), ghost * 0.28);

  if (useBloom > 0.5) c += texture(bloom, uv).rgb * 1.05;

  // Impact speed lines radiating from the centre.
  if (impact > 0.0) {
    float a = atan(d.y, d.x * aspect);
    float ray = hash(vec2(floor(a * 48.0), floor(time * 24.0)));
    float line = step(0.78, ray);
    float radial = smoothstep(0.18, 0.62, length(d * vec2(aspect, 1.0)));
    c = mix(c, BONE, line * radial * impact * 0.85);
  }

  // Frenzy: Festival Night turns bright tones to gold on black.
  if (frenzy > 0.0) {
    float fl = dot(c, vec3(0.299, 0.587, 0.114));
    vec3 GOLD = vec3(0.961, 0.722, 0.239);
    c = mix(c, GOLD * (0.35 + fl * 0.9), frenzy * 0.8 * smoothstep(0.18, 0.55, fl));
  }

  // Vignette.
  float v = smoothstep(0.45, 1.05, length(d * vec2(aspect, 1.0)) * 1.25);
  c = mix(c, INK, v * 0.45);

  // Paper: light tones take the washi texture (bone becomes paper), dark
  // tones get a faint indigo-ink cast and pulp, plus a little live grain.
  float paper = washi(gl_FragCoord.xy / max(dotPx / 3.0, 1.0));
  float l2 = dot(c, vec3(0.299, 0.587, 0.114));
  c *= 1.0 + paper * 0.05 * smoothstep(0.3, 0.9, l2);
  c += vec3(0.010, 0.012, 0.024) * (0.6 + paper) * (1.0 - smoothstep(0.0, 0.25, l2));
  c += (hash(gl_FragCoord.xy + fract(time * 7.13) * 100.0) - 0.5) * 0.02;

  // Reduced-flashing substitute: a soft ash wash.
  c = mix(c, ASH, fade * 0.3);
  // Palette inversion: bone <-> ink.
  c = mix(c, BONE + INK - c, invert);

  color = vec4(clamp(c, 0.0, 1.0), 1.0);
}`;

interface Target {
  fbo: WebGLFramebuffer;
  tex: WebGLTexture;
  w: number;
  h: number;
}

export class PostFx {
  private readonly gl: WebGL2RenderingContext;
  private readonly bright: WebGLProgram;
  private readonly blur: WebGLProgram;
  private readonly composite: WebGLProgram;
  private readonly srcTex: WebGLTexture;
  private a: Target | null = null;
  private b: Target | null = null;
  private width = 0;
  private height = 0;

  constructor(
    readonly canvas: HTMLCanvasElement,
    private readonly bloom: boolean,
  ) {
    const gl = canvas.getContext('webgl2', {
      alpha: false,
      antialias: false,
      depth: false,
      stencil: false,
      premultipliedAlpha: false,
      preserveDrawingBuffer: false,
    });
    if (!gl) throw new Error('WebGL2 unavailable');
    this.gl = gl;
    this.bright = program(gl, VERT, BRIGHT);
    this.blur = program(gl, VERT, BLUR);
    this.composite = program(gl, VERT, COMPOSITE);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    // One oversized triangle covers the screen.
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    for (const p of [this.bright, this.blur, this.composite]) {
      const loc = gl.getAttribLocation(p, 'pos');
      gl.enableVertexAttribArray(loc);
      gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    }
    this.srcTex = texture(gl);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
  }

  get lost(): boolean {
    return this.gl.isContextLost();
  }

  resize(width: number, height: number): void {
    if (width === this.width && height === this.height) return;
    this.width = width;
    this.height = height;
    this.canvas.width = width;
    this.canvas.height = height;
    if (this.bloom) {
      const hw = Math.max(1, width >> 2);
      const hh = Math.max(1, height >> 2);
      this.a = target(this.gl, hw, hh, this.a);
      this.b = target(this.gl, hw, hh, this.b);
    }
  }

  /** Upload the 2D frame and run the passes onto the visible canvas. */
  render(src: HTMLCanvasElement, fx: FxParams, dotPx: number): void {
    const gl = this.gl;
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.srcTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);

    const useBloom = this.bloom && this.a && this.b;
    if (useBloom && this.a && this.b) {
      gl.bindFramebuffer(gl.FRAMEBUFFER, this.a.fbo);
      gl.viewport(0, 0, this.a.w, this.a.h);
      gl.useProgram(this.bright);
      gl.uniform1i(gl.getUniformLocation(this.bright, 'src'), 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      for (let i = 0; i < 2; i++) {
        this.blurPass(this.a, this.b, 1, 0);
        this.blurPass(this.b, this.a, 0, 1);
      }
    }

    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.viewport(0, 0, this.width, this.height);
    const p = this.composite;
    gl.useProgram(p);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.srcTex);
    gl.uniform1i(gl.getUniformLocation(p, 'src'), 0);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, useBloom && this.a ? this.a.tex : this.srcTex);
    gl.uniform1i(gl.getUniformLocation(p, 'bloom'), 1);
    gl.uniform1f(gl.getUniformLocation(p, 'useBloom'), useBloom ? 1 : 0);
    gl.uniform2f(gl.getUniformLocation(p, 'res'), this.width, this.height);
    gl.uniform1f(gl.getUniformLocation(p, 'dotPx'), dotPx);
    gl.uniform1f(gl.getUniformLocation(p, 'time'), fx.time);
    gl.uniform1f(gl.getUniformLocation(p, 'invert'), fx.invert);
    gl.uniform1f(gl.getUniformLocation(p, 'fade'), fx.fade);
    gl.uniform1f(gl.getUniformLocation(p, 'ca'), fx.ca);
    gl.uniform1f(gl.getUniformLocation(p, 'impact'), fx.impact);
    gl.uniform1f(gl.getUniformLocation(p, 'frenzy'), fx.frenzy);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  private blurPass(from: Target, to: Target, dx: number, dy: number): void {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, to.fbo);
    gl.viewport(0, 0, to.w, to.h);
    gl.useProgram(this.blur);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, from.tex);
    gl.uniform1i(gl.getUniformLocation(this.blur, 'src'), 0);
    gl.uniform2f(gl.getUniformLocation(this.blur, 'dir'), dx / from.w, dy / from.h);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
}

function shader(gl: WebGL2RenderingContext, type: number, source: string): WebGLShader {
  const s = gl.createShader(type);
  if (!s) throw new Error('createShader failed');
  gl.shaderSource(s, source);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    throw new Error(`shader compile failed: ${gl.getShaderInfoLog(s) ?? ''}`);
  }
  return s;
}

function program(gl: WebGL2RenderingContext, vs: string, fs: string): WebGLProgram {
  const p = gl.createProgram();
  if (!p) throw new Error('createProgram failed');
  gl.attachShader(p, shader(gl, gl.VERTEX_SHADER, vs));
  gl.attachShader(p, shader(gl, gl.FRAGMENT_SHADER, fs));
  gl.bindAttribLocation(p, 0, 'pos');
  gl.linkProgram(p);
  if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
    throw new Error(`program link failed: ${gl.getProgramInfoLog(p) ?? ''}`);
  }
  return p;
}

function texture(gl: WebGL2RenderingContext): WebGLTexture {
  const t = gl.createTexture();
  if (!t) throw new Error('createTexture failed');
  gl.bindTexture(gl.TEXTURE_2D, t);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  return t;
}

function target(gl: WebGL2RenderingContext, w: number, h: number, old: Target | null): Target {
  if (old) {
    gl.deleteFramebuffer(old.fbo);
    gl.deleteTexture(old.tex);
  }
  const tex = texture(gl);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  const fbo = gl.createFramebuffer();
  if (!fbo) throw new Error('createFramebuffer failed');
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  return { fbo, tex, w, h };
}
