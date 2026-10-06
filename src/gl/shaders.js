export const vertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

// Uma única "lente" de cinema por cima de toda a página:
// travelling com desfoque radial, dissolução em néon entre planos,
// feixes de luz de discoteca, foco do rato, aberração cromática pela velocidade e grão.
export const fragment = /* glsl */ `
precision highp float;
#define BLUR_STEPS ${'${BLUR}'}

uniform sampler2D tA;
uniform sampler2D tB;
uniform vec2 uSizeA;
uniform vec2 uSizeB;
uniform vec2 uRes;
uniform vec2 uFocus;
uniform vec2 uMouse;
uniform float uTime;
uniform float uMix;
uniform float uZoom;
uniform float uDim;
uniform float uVel;
uniform float uReveal;
uniform float uPulse;
uniform float uBeams;
uniform float uShock;
uniform vec2 uShockAt;
varying vec2 vUv;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123); }
float noise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1, 0)), u.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0, a = 0.5;
  for (int i = 0; i < 5; i++) { v += a * noise(p); p = p * 2.03 + 17.0; a *= 0.5; }
  return v;
}

vec2 cover(vec2 uv, vec2 size) {
  float rs = uRes.x / uRes.y;
  float ri = size.x / size.y;
  vec2 s = rs < ri ? vec2(rs / ri, 1.0) : vec2(1.0, ri / rs);
  return (uv - 0.5) * s + 0.5;
}

vec3 tap(sampler2D t, vec2 st, float split) {
  vec2 o = (st - 0.5) * split;
  return vec3(texture2D(t, st + o).r, texture2D(t, st).g, texture2D(t, st - o).b);
}

// Lê um plano com zoom em direcção ao foco e rasto radial (efeito "dolly").
vec3 shot(sampler2D t, vec2 size, vec2 uv, float zoom, vec2 focus, float split) {
  vec2 st = cover(uv, size);
  st = focus + (st - focus) / (1.0 + zoom);
  vec3 c = tap(t, st, split);
  if (zoom > 0.02) {
    vec2 dir = (st - focus) * min(zoom, 3.0) * 0.022;
    float tot = 1.0;
    for (int i = 1; i <= BLUR_STEPS; i++) {
      float k = float(i) / float(BLUR_STEPS);
      float w = 1.0 - k * 0.6;
      c += tap(t, st - dir * k, split) * w;
      tot += w;
    }
    c /= tot;
  }
  return c;
}

float beam(vec2 p, vec2 origin, float ang, float width) {
  vec2 d = p - origin;
  float a = atan(d.x, -d.y);
  float k = smoothstep(width, 0.0, abs(a - ang));
  return k * smoothstep(1.6, 0.0, length(d)) * smoothstep(0.0, 0.15, -d.y + 0.02);
}

void main() {
  vec2 uv = vUv;
  float aspect = uRes.x / uRes.y;
  vec2 p = vec2(uv.x * aspect, uv.y);
  vec2 m = vec2(uMouse.x * aspect, uMouse.y);

  // Parallax suave e lente de calor em volta do cursor
  vec2 par = (uMouse - 0.5) * 0.018;
  float md = distance(p, m);
  vec2 lens = (p - m) * exp(-md * 7.0) * 0.018;

  // Onda de choque (clique / batida)
  float sd = distance(p, vec2(uShockAt.x * aspect, uShockAt.y));
  float ring = uShock * smoothstep(0.12, 0.0, abs(sd - (1.0 - uShock) * 1.1));
  vec2 shockOff = normalize(p - vec2(uShockAt.x * aspect, uShockAt.y) + 1e-4) * ring * 0.035;

  vec2 suv = uv - par * 0.5 + lens / vec2(aspect, 1.0) + shockOff / vec2(aspect, 1.0);
  float split = 0.004 + clamp(abs(uVel), 0.0, 1.0) * 0.03 + ring * 0.03;

  vec3 a = shot(tA, uSizeA, suv, uZoom, uFocus, split);

  vec3 col = a;
  if (uMix > 0.001) {
    float zb = (1.0 - uMix) * 0.18;
    vec3 b = shot(tB, uSizeB, suv, zb, vec2(0.5), split);
    float n = fbm(uv * vec2(aspect, 1.0) * 3.4 + vec2(0.0, uTime * 0.05));
    float th = uMix * 1.3 - 0.15;
    float k = 1.0 - smoothstep(th - 0.02, th + 0.02, n);
    float edge = smoothstep(th - 0.05, th, n) - smoothstep(th, th + 0.05, n);
    col = mix(a, b, k);
    col += vec3(1.0, 0.25, 0.28) * edge * 1.8 * step(uMix, 0.999);
  }

  // Luz de discoteca: dois feixes que varrem a sala + foco vermelho do cursor
  float t = uTime;
  float bms = beam(p, vec2(aspect * 0.18, 1.08), sin(t * 0.55) * 0.6, 0.09)
            + beam(p, vec2(aspect * 0.82, 1.08), sin(t * 0.47 + 2.1) * 0.6, 0.08);
  float haze = fbm(p * 3.0 + vec2(t * 0.06, -t * 0.04));
  col += vec3(1.0, 0.12, 0.2) * bms * (0.35 + haze * 0.65) * 0.22 * uBeams;
  col += vec3(1.0, 0.2, 0.25) * exp(-md * 3.2) * 0.1;

  // Grading: realce dos néons, pretos quentes, escurecimento por secção
  float l = dot(col, vec3(0.299, 0.587, 0.114));
  col += vec3(1.0, 0.18, 0.22) * smoothstep(0.55, 1.0, l) * 0.18;
  col = mix(col, col * vec3(1.06, 0.92, 0.92), 0.5);
  col = (col - 0.5) * 1.08 + 0.5;
  col *= 1.0 + uPulse * 0.07;
  col *= 1.0 - uDim * 0.82;

  // Vinheta + grão de película
  vec2 vq = uv - 0.5;
  col *= 1.0 - dot(vq, vq) * 1.15;
  col += (hash(uv * uRes + fract(t * 7.0) * 91.0) - 0.5) * 0.07;

  // Íris da abertura com borda de néon
  float r = length(vec2((uv.x - 0.5) * aspect, uv.y - 0.5));
  float irisN = fbm(vec2(atan(uv.y - 0.5, uv.x - 0.5) * 3.0, t * 0.3)) * 0.12;
  float R = uReveal * (length(vec2(aspect, 1.0)) * 0.6 + 0.2);
  float open = 1.0 - smoothstep(R - 0.04, R, r + irisN);
  float rim = smoothstep(R - 0.06, R, r + irisN) - smoothstep(R, R + 0.03, r + irisN);
  col = col * open + vec3(1.0, 0.12, 0.2) * rim * 1.6 * step(uReveal, 0.999);

  gl_FragColor = vec4(max(col, 0.0), 1.0);
}
`;
