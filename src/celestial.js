import { ORBIT_VERTEX, ORBIT_FRAGMENT, SOLAR_FRAGMENT } from './shaders.js';

// The same texture materials as the desktop app, inside a small standalone renderer.
// No app code, Tauri API, service credential, or external runtime is required.
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const MAX_PIXELS = 1_400_000;

class Material {
  constructor(host, theme, fragment, source, controller) {
    this.host = host;
    this.theme = theme;
    this.controller = controller;
    this.fragment = fragment;
    this.canvas = document.createElement('canvas');
    this.canvas.setAttribute('aria-hidden', 'true');
    this.canvas.dataset.material = theme;
    host.append(this.canvas);
    this.gl = this.canvas.getContext('webgl', { alpha: false, antialias: false, depth: false, powerPreference: 'low-power', preserveDrawingBuffer: false });
    this.image = new Image();
    this.ready = false;
    this.elapsed = 0;
    this.lastDraw = 0;
    this.uniforms = {};
    this.image.onload = () => this.initialize();
    this.image.src = source;
    this.canvas.addEventListener('webglcontextlost', event => {
      event.preventDefault();
      this.ready = false;
      delete host.dataset.ready;
    });
    this.canvas.addEventListener('webglcontextrestored', () => this.initialize());
  }

  initialize() {
    const gl = this.gl;
    if (!gl || !this.image.complete || !this.image.naturalWidth || gl.isContextLost()) return;
    try {
      const shaders = [[gl.VERTEX_SHADER, ORBIT_VERTEX], [gl.FRAGMENT_SHADER, this.fragment]].map(([kind, source]) => {
        const shader = gl.createShader(kind);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader));
        return shader;
      });
      this.program = gl.createProgram();
      shaders.forEach(shader => gl.attachShader(this.program, shader));
      gl.linkProgram(this.program);
      shaders.forEach(shader => gl.deleteShader(shader));
      if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) throw new Error('Material linking failed');
      gl.useProgram(this.program);
      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1, 1,-1, -1,1, -1,1, 1,-1, 1,1]), gl.STATIC_DRAW);
      const position = gl.getAttribLocation(this.program, 'a_position');
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
      this.texture = gl.createTexture();
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, this.texture);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, this.image);
      if (gl.getError() !== gl.NO_ERROR) throw new Error('Material texture unavailable');
      for (const name of ['image','cover','pointer','time','speed','distortion','glow','arrival','rect','intro','backdrop','low_detail','viewport','subject','destination']) {
        this.uniforms[name] = gl.getUniformLocation(this.program, 'u_' + name);
      }
      this.ready = true;
      this.resize();
      this.draw(0);
      this.host.dataset.ready = 'true';
      this.controller.sync();
    } catch (error) {
      // The original artwork remains visible if WebGL is unavailable.
      this.ready = false;
      console.warn('Astreis: using the static artwork fallback.', error.message);
    }
  }

  resize() {
    if (!this.ready) return;
    const bounds = this.host.getBoundingClientRect();
    const width = Math.max(1, bounds.width), height = Math.max(1, bounds.height);
    const ratio = Math.min(devicePixelRatio || 1, 1.5, Math.sqrt(MAX_PIXELS / (width * height)));
    const nextWidth = Math.round(width * ratio), nextHeight = Math.round(height * ratio);
    // Reassigning a canvas size clears its framebuffer, even for an unchanged size.
    if (this.canvas.width !== nextWidth) this.canvas.width = nextWidth;
    if (this.canvas.height !== nextHeight) this.canvas.height = nextHeight;
    const aspect = width / height;
    const imageAspect = this.image.naturalWidth / this.image.naturalHeight;
    this.cover = aspect > imageAspect ? [1, imageAspect / aspect] : [aspect / imageAspect, 1];
    this.draw(0);
  }

  draw(delta) {
    if (!this.ready) return;
    this.elapsed += Math.min(Math.max(delta, 0), .08);
    const gl = this.gl, u = this.uniforms;
    gl.useProgram(this.program);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, this.texture);
    gl.viewport(0, 0, this.canvas.width, this.canvas.height);
    gl.uniform1i(u.image, 0);
    gl.uniform2f(u.cover, ...this.cover);
    gl.uniform2f(u.pointer, 0, 0);
    gl.uniform1f(u.time, this.elapsed);
    gl.uniform1f(u.speed, 3.8);
    gl.uniform1f(u.distortion, 1);
    gl.uniform1f(u.glow, 1);
    gl.uniform1f(u.arrival, 1);
    gl.uniform4f(u.rect, 0, 0, 1, 1);
    gl.uniform1f(u.intro, 0);
    gl.uniform1f(u.backdrop, 1);
    gl.uniform1f(u.low_detail, innerWidth < 600 ? 1 : 0);
    gl.uniform2f(u.viewport, this.canvas.width, this.canvas.height);
    gl.uniform3f(u.subject, 0, 0, 1);
    gl.uniform4f(u.destination, 0, 0, 1, 1);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
}

export class CelestialScene {
  constructor(host) {
    this.host = host;
    this.theme = document.documentElement.dataset.theme;
    this.visible = true;
    this.frame = 0;
    this.previous = 0;
    this.switchDeadline = 0;
    this.paused = false;
    try { this.paused = localStorage.getItem('astreis-motion') === 'paused'; } catch { /* Storage can be blocked. */ }
    this.materials = [
      new Material(host.querySelector('.scene-light'), 'light', SOLAR_FRAGMENT, 'assets/sun.png', this),
      new Material(host.querySelector('.scene-dark'), 'dark', ORBIT_FRAGMENT, 'assets/black-hole.png', this),
    ];
    this.observer = new IntersectionObserver(entries => { this.visible = entries[0].isIntersecting; this.sync(); });
    this.observer.observe(host);
    this.resizeObserver = new ResizeObserver(() => this.materials.forEach(item => item.resize()));
    this.resizeObserver.observe(host);
    document.addEventListener('visibilitychange', () => this.sync());
    motion.addEventListener('change', () => { this.sync(); this.onStateChange?.(); });
  }
  get reduced() { return motion.matches; }
  get stopped() { return this.paused || this.reduced; }
  setTheme(theme) {
    this.theme = theme;
    this.switchDeadline = performance.now() + 1400;
    this.materials.forEach(material => material.draw(0));
    this.sync();
  }
  toggle() {
    this.paused = !this.paused;
    try { localStorage.setItem('astreis-motion', this.paused ? 'paused' : 'playing'); } catch { /* Optional preference. */ }
    this.sync();
  }
  sync() {
    cancelAnimationFrame(this.frame);
    this.frame = 0;
    this.previous = 0;
    if (!this.stopped && this.visible && !document.hidden && this.materials?.some(item => item.ready)) this.frame = requestAnimationFrame(now => this.tick(now));
  }
  tick(now) {
    if (this.stopped || !this.visible || document.hidden) { this.frame = 0; return; }
    // A 30 fps cap and offscreen/hidden suspension keep decorative work bounded.
    const delta = this.previous ? now - this.previous : 34;
    if (delta >= 1000 / 30 - .5) {
      for (const material of this.materials) {
        if (material.theme === this.theme || now < this.switchDeadline) material.draw(delta / 1000);
      }
      this.previous = now - (delta % (1000 / 30));
    }
    this.frame = requestAnimationFrame(time => this.tick(time));
  }
}
