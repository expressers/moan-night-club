import {
  WebGLRenderer, Scene, OrthographicCamera, Mesh, PlaneGeometry, ShaderMaterial,
  TextureLoader, Vector2, LinearFilter, NoColorSpace, LinearSRGBColorSpace,
} from 'three';
import { vertex, fragment } from './shaders.js';

const lerp = (a, b, t) => a + (b - a) * t;

export class Cinema {
  constructor(canvas, { mobile = false } = {}) {
    this.canvas = canvas;
    this.mobile = mobile;
    this.renderer = new WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
    this.renderer.outputColorSpace = LinearSRGBColorSpace;
    this.renderer.setClearColor(0x0b0708, 1);
    this.dprCap = mobile ? 1.5 : 1.75;
    this.scene = new Scene();
    this.camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.textures = {};
    this.state = { a: null, b: null };

    this.u = {
      tA: { value: null }, tB: { value: null },
      uSizeA: { value: new Vector2(1, 1) }, uSizeB: { value: new Vector2(1, 1) },
      uRes: { value: new Vector2(1, 1) },
      uFocus: { value: new Vector2(0.5, 0.5) },
      uMouse: { value: new Vector2(0.5, 0.5) },
      uTime: { value: 0 }, uMix: { value: 0 }, uZoom: { value: 0 },
      uDim: { value: 0.2 }, uVel: { value: 0 }, uReveal: { value: 0 },
      uPulse: { value: 0 }, uBeams: { value: 1 },
      uShock: { value: 0 }, uShockAt: { value: new Vector2(0.5, 0.5) },
    };

    const material = new ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: fragment.replace('${BLUR}', mobile ? '6' : '12'),
      uniforms: this.u,
      depthTest: false,
      depthWrite: false,
    });
    this.scene.add(new Mesh(new PlaneGeometry(2, 2), material));

    // valores-alvo suavizados a cada frame
    this.target = { dim: 0.2, mouse: new Vector2(0.5, 0.5), vel: 0 };
    this.resize();
  }

  async load(map) {
    const loader = new TextureLoader();
    const entries = await Promise.all(Object.entries(map).map(([key, url]) =>
      loader.loadAsync(url).then((tex) => {
        tex.colorSpace = NoColorSpace;
        tex.minFilter = LinearFilter;
        tex.magFilter = LinearFilter;
        tex.generateMipmaps = false;
        tex.userData.size = new Vector2(tex.image.width, tex.image.height);
        return [key, tex];
      })));
    entries.forEach(([k, t]) => { this.textures[k] = t; });
    entries.forEach(([, t]) => this.renderer.initTexture(t));
  }

  setShot(a, b = a) {
    if (this.state.a !== a) {
      this.state.a = a;
      const t = this.textures[a];
      this.u.tA.value = t; this.u.uSizeA.value.copy(t.userData.size);
    }
    if (this.state.b !== b) {
      this.state.b = b;
      const t = this.textures[b];
      this.u.tB.value = t; this.u.uSizeB.value.copy(t.userData.size);
    }
  }

  shock(x, y) {
    this.u.uShockAt.value.set(x, y);
    this.u.uShock.value = 1;
  }

  resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, this.dprCap);
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setPixelRatio(dpr);
    this.renderer.setSize(w, h, false);
    this.u.uRes.value.set(w * dpr, h * dpr);
    // a proporção do ecrã é o que conta para o "cover", não os píxeis
    this.u.uRes.value.set(w, h);
  }

  tick(time, dt) {
    const u = this.u;
    const k = 1 - Math.pow(0.001, dt); // suavização independente do frame-rate
    u.uTime.value = time;
    u.uDim.value = lerp(u.uDim.value, this.target.dim, k * 0.6);
    u.uMouse.value.lerp(this.target.mouse, k * 0.5);
    u.uVel.value = lerp(u.uVel.value, this.target.vel, k);
    u.uShock.value = Math.max(0, u.uShock.value - dt * 0.9);
    // batida a 124 bpm, quase subliminar
    const beat = (time * 124) / 60;
    u.uPulse.value = Math.pow(1 - (beat % 1), 6);
    this.renderer.render(this.scene, this.camera);
  }
}
