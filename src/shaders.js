// Original Astreis materials, copied without modifying the application.
// Orbit artwork motion, blue bloom, softened ring light, and foreground flow.
export const ORBIT_VERTEX = `
    attribute vec2 a_position;
    varying vec2 v_uv;
    void main() {
      v_uv = vec2((a_position.x + 1.0) * 0.5, (1.0 - a_position.y) * 0.5);
      gl_Position = vec4(a_position, 0.0, 1.0);
    }
  `
export const ORBIT_FRAGMENT = `
    #ifdef GL_FRAGMENT_PRECISION_HIGH
      precision highp float;
    #else
      precision mediump float;
    #endif
    varying vec2 v_uv;
    uniform sampler2D u_image;
    uniform vec2 u_cover;
    uniform vec2 u_pointer;
    uniform float u_time;
    uniform float u_speed;
    uniform float u_distortion;
    uniform float u_glow;
    uniform float u_arrival;
    uniform vec4 u_rect;
    uniform float u_intro;
    uniform float u_backdrop;
    uniform float u_low_detail;
    uniform vec2 u_viewport;
    uniform vec3 u_subject;
    uniform vec4 u_destination;
    const float aspect = 1.776833;
    float foregroundFlow(float along, float across, float phase) {
      // Both filament scales travel in the same direction at the same speed.
      // No phase reset, vertical displacement, or whole-band exposure pulse.
      float traveling = along - phase * 0.01;
      return 0.5 + 0.325 * sin(traveling * 125.0 + across * 240.0)
        + 0.175 * sin(traveling * 211.0 - across * 170.0 + 1.7);
    }
    void main() {
      float t = u_time;
      float spin = t * u_speed;
      vec2 sceneUV = (v_uv - u_rect.xy) / u_rect.zw;
      if (sceneUV.x < 0.0 || sceneUV.x > 1.0 || sceneUV.y < 0.0 || sceneUV.y > 1.0) {
        gl_FragColor = vec4(0.0);
        return;
      }
      // Preserve the photograph's proportions while gently drifting through space.
      float zoom = mix(1.65, 1.035 + sin(t * 0.13) * 0.008, u_arrival);
      vec2 aim = mix(vec2(0.665, 0.495), vec2(0.5, 0.488), u_arrival);
      vec2 uv = (sceneUV - 0.5) * u_cover / zoom + aim;
      uv += (vec2(sin(t * 0.10) * 0.004, sin(t * 0.14) * 0.003) + u_pointer) * u_arrival;
      vec2 center = vec2(0.665, 0.495);
      if (u_intro > 0.5) {
        // Independent subject translation/scale, not a shrinking photograph.
        uv = center + (v_uv * u_viewport - u_subject.xy)
          / max(u_subject.z, 1.0) / vec2(aspect, 1.0);
      }
      vec2 p = (uv - center) * vec2(aspect, 1.0);
      float r = length(p);
      float angle = atan(p.y, p.x);
      float diskY = p.y + p.x * 0.205;
      float alpha = 1.0;
      if (u_intro > 0.5) {
        // Evaluate coverage before any of the eight texture reads. Most of the
        // opening stage is transparent space, not material that needs shading.
        float core = 1.0 - smoothstep(0.26, 0.39, r);
        float wings = (1.0 - smoothstep(0.022, 0.095, abs(diskY - 0.009)))
          * (1.0 - smoothstep(0.35, 0.66, abs(p.x)));
        vec2 sourceUV = center + p / vec2(aspect, 1.0);
        float edgeFade = smoothstep(0.0, 0.02, sourceUV.x) * (1.0 - smoothstep(0.98, 1.0, sourceUV.x))
          * smoothstep(0.0, 0.02, sourceUV.y) * (1.0 - smoothstep(0.98, 1.0, sourceUV.y));
        float subjectMask = max(core, wings) * edgeFade;
        vec2 destinationUV = (v_uv - u_destination.xy) / u_destination.zw;
        float inside = step(0.0, destinationUV.x) * step(destinationUV.x, 1.0)
          * step(0.0, destinationUV.y) * step(destinationUV.y, 1.0);
        alpha = mix(subjectMask, inside, u_backdrop);
        if (alpha <= 0.0) { gl_FragColor = vec4(0.0); return; }
      }
      float ring = smoothstep(0.135, 0.173, r) * (1.0 - smoothstep(0.26, 0.39, r));
      // Traveling tangential ripples make the original plasma flow around the horizon.
      float twist = ring * u_distortion * (0.048 * sin(angle * 3.0 - spin * 0.42 + r * 22.0)
                          + 0.014 * sin(angle * 8.0 - spin * 0.29 - r * 43.0));
      float c = cos(twist), s = sin(twist);
      vec2 warped = mat2(c, -s, s, c) * p;
      uv = center + warped / vec2(aspect, 1.0);
      // Faster plasma flows through the disk while the horizon stays stable.
      float disk = (1.0 - smoothstep(0.018, 0.075, abs(diskY))) * smoothstep(0.13, 0.25, r);
      uv.y += sin(p.x * 42.0 - spin * 0.7) * 0.0023 * disk * u_distortion;
      vec3 color = texture2D(u_image, uv).rgb;
      float luminance = dot(color, vec3(0.299, 0.587, 0.114));
      // The photograph's near-black sky has only a few usable colour levels.
      // Replace that distant, unlit field with a continuous deep-blue sky;
      // leave the horizon, disk, luminous dust and photographed stars intact.
      float distantSky = smoothstep(0.36, 0.52, r)
        * smoothstep(0.075, 0.16, abs(diskY))
        * (1.0 - smoothstep(0.040, 0.090, luminance));
      // Match --app-background exactly. A slightly different almost-black
      // gradient would collapse into vertical colour steps under the CSS veil.
      vec3 cleanSky = vec3(5.0, 9.0, 18.0) / 255.0;
      color = mix(color, cleanSky, distantSky);
      // Advect texture detail continuously around the ring, preserving its silhouette.
      float orbit = spin * 0.19 / sqrt(max(r * 4.0, 0.5));
      float oc = cos(orbit), os = sin(orbit);
      vec2 orbitUV = center + (mat2(oc, -os, os, oc) * p) / vec2(aspect, 1.0);
      // Filter only the secondary light mask. The photograph's thin disk
      // otherwise becomes a sharp moving spoke when sampled around the ring.
      vec2 tangent = vec2(-p.y, p.x) / max(r, 0.001);
      vec2 detailOffset = (mat2(oc, -os, os, oc) * tangent)
        / vec2(aspect, 1.0) * 0.008;
      vec3 orbitDetail = texture2D(u_image, orbitUV).rgb;
      if (u_low_detail < 0.5) {
        orbitDetail = orbitDetail * 0.5
          + texture2D(u_image, orbitUV - detailOffset).rgb * 0.25
          + texture2D(u_image, orbitUV + detailOffset).rgb * 0.25;
      }
      float detailLight = dot(orbitDetail, vec3(0.299, 0.587, 0.114));
      float litRing = ring * smoothstep(0.055, 0.5, luminance);
      // Bound this supporting layer to +/-3.6%: no bright slashes or dark cuts.
      float softDetail = clamp(detailLight - 0.3, -0.2, 0.2);
      color *= 1.0 + softDetail * 0.18 * litRing;
      float flow = sin(angle * 5.0 - spin * 0.62 + r * 39.0) * 0.085
                 + sin(angle * 11.0 - spin * 0.38 - r * 19.0) * 0.032;
      color *= 1.0 + flow * max(ring, disk) * smoothstep(0.08, 0.6, luminance);
      // Soft blue bloom follows the photograph's existing highlights.
      vec3 bloom = vec3(0.0);
      if (u_low_detail < 0.5) {
        vec2 bloomOffset = vec2(0.0028, 0.0048);
        bloom = texture2D(u_image, uv + vec2(bloomOffset.x, 0.0)).rgb
              + texture2D(u_image, uv - vec2(bloomOffset.x, 0.0)).rgb
              + texture2D(u_image, uv + vec2(0.0, bloomOffset.y)).rgb
              + texture2D(u_image, uv - vec2(0.0, bloomOffset.y)).rgb;
        bloom = max(bloom * 0.25 - 0.45, 0.0);
      }
      color += bloom * vec3(0.075, 0.16, 0.27) * u_glow;
      float ember = pow(0.5 + 0.5 * sin(angle * 3.0 - spin * 0.6 + r * 27.0), 5.0);
      color += vec3(0.24, 0.56, 1.0) * ember * litRing * 0.065 * u_glow;
      // The reference's radial masks exclude the strip crossing the center.
      // Its photographed ridge sits at diskY ~= 0.009, not on the horizon's
      // centerline. Animate brightness within that existing ridge only;
      // multiplication cannot paint new light into the surrounding black core.
      float foreground = (1.0 - smoothstep(0.006, 0.026, abs(diskY - 0.009)))
        * (1.0 - smoothstep(0.14, 0.25, r))
        * smoothstep(0.12, 0.5, luminance);
      float foregroundGain = 0.78 + 0.22 * foregroundFlow(p.x, diskY - 0.009, spin);
      color *= mix(1.0, foregroundGain, foreground * clamp(u_distortion, 0.0, 1.0));
      // Sparse, slow-moving distant stars, limited to the image side of the header.
      if (u_low_detail < 0.5) {
        vec2 starSceneUV = u_intro > 0.5 ? (v_uv - u_destination.xy) / u_destination.zw : sceneUV;
        // Distant stars follow at one quarter of the artwork's depth response.
        vec2 starParallax = u_pointer * zoom / u_cover * 0.25;
        vec2 starUV = (starSceneUV + starParallax) * vec2(110.0, 43.0) + vec2(t * 0.018, t * 0.007);
        vec2 cell = floor(starUV);
        float seed = fract(sin(dot(cell, vec2(127.1, 311.7))) * 43758.5453);
        float star = (1.0 - smoothstep(0.01, 0.085, length(fract(starUV) - 0.5))) * step(0.993, seed);
        float twinkle = 0.5 + sin(t * 0.45 + seed * 71.0) * 0.2;
        color += vec3(0.51, 0.61, 0.67) * star * twinkle * smoothstep(0.4, 0.75, starSceneUV.x) * (1.0 - ring) * smoothstep(0.15, 0.18, r);
      }
      // Stable sub-code-value dithering prevents the smooth sky quantizing into
      // contours in the 8-bit canvas. No time component: it never sparkles.
      float skyNoise = fract(52.9829189 * fract(dot(gl_FragCoord.xy, vec2(0.06711056, 0.00583715))));
      color += vec3((skyNoise - 0.5) / 255.0) * distantSky;
      gl_FragColor = vec4(color * alpha, alpha);
    }
  `

/** Active surface and prominence flow; stable solar limb and surrounding sky. */
export const SOLAR_FRAGMENT = `
  #ifdef GL_FRAGMENT_PRECISION_HIGH
    precision highp float;
  #else
    precision mediump float;
  #endif
  varying vec2 v_uv;
  uniform sampler2D u_image;
  uniform vec2 u_cover;
  uniform vec2 u_pointer;
  uniform float u_time;
  uniform float u_low_detail;
  uniform float u_arrival;
  uniform vec4 u_rect;
  uniform float u_intro;
  uniform float u_backdrop;
  uniform vec2 u_viewport;
  uniform vec3 u_subject;
  uniform vec4 u_destination;
  const float aspect = 1.776833;
  void main() {
    float t = u_time;
    vec2 center = vec2(0.663, 0.460);
    vec2 sceneUV = (v_uv - u_rect.xy) / u_rect.zw;
    if (sceneUV.x < 0.0 || sceneUV.x > 1.0 || sceneUV.y < 0.0 || sceneUV.y > 1.0) {
      gl_FragColor = vec4(0.0);
      return;
    }
    // The solar subject opens in the center, then docks into the exact same
    // camera mapping used by the idle scene. The texture never shrinks as one
    // rectangular wallpaper.
    float zoom = mix(1.58, 1.035 + sin(t * 0.13) * 0.008, u_arrival);
    vec2 aim = mix(center, vec2(0.5, 0.488), u_arrival);
    vec2 uv = (sceneUV - 0.5) * u_cover / zoom + aim;
    uv += (vec2(sin(t * 0.10) * 0.004, sin(t * 0.14) * 0.003) + u_pointer) * u_arrival;
    if (u_intro > 0.5) {
      uv = center + (v_uv * u_viewport - u_subject.xy)
        / max(u_subject.z, 1.0) / vec2(aspect, 1.0);
    }
    vec2 p = (uv - center) * vec2(aspect, 1.0);
    float r = length(p);
    float angle = atan(p.y, p.x);
    float alpha = 1.0;
    if (u_intro > 0.5) {
      float solarBody = 1.0 - smoothstep(0.25, 0.45, r);
      vec2 sourceUV = center + p / vec2(aspect, 1.0);
      float edgeFade = smoothstep(0.0, 0.02, sourceUV.x) * (1.0 - smoothstep(0.98, 1.0, sourceUV.x))
        * smoothstep(0.0, 0.02, sourceUV.y) * (1.0 - smoothstep(0.98, 1.0, sourceUV.y));
      float subjectMask = solarBody * edgeFade;
      vec2 destinationUV = (v_uv - u_destination.xy) / u_destination.zw;
      float inside = step(0.0, destinationUV.x) * step(destinationUV.x, 1.0)
        * step(0.0, destinationUV.y) * step(destinationUV.y, 1.0);
      alpha = mix(subjectMask, inside, u_backdrop);
      if (alpha <= 0.0) { gl_FragColor = vec4(0.0); return; }
    }
    float surface = 1.0 - smoothstep(0.215, 0.262, r);
    float corona = smoothstep(0.263, 0.291, r) * (1.0 - smoothstep(0.355, 0.40, r));
    // Bounded traveling waves circulate the photographed granules without a
    // wrapping phase seam or accumulated twist. Motion tapers to zero at the limb.
    float twist = surface * (0.052 * sin(angle * 3.0 - t * 0.98 + r * 20.0)
                          + 0.016 * sin(angle * 7.0 - t * 0.70 - r * 13.0));
    // Let the prominence arches lean and breathe, with anchored feet at the
    // limb. Both waves travel continuously; no phase reset or full-image spin.
    twist += corona * (0.040 * sin(angle * 3.0 - t * 0.95 + r * 18.0)
                     + 0.013 * sin(angle * 7.0 - t * 0.63 - r * 11.0));
    float c = cos(twist), s = sin(twist);
    vec2 flow = mat2(c, -s, s, c) * p;
    float lift = corona * (0.006 * sin(angle * 5.0 - t * 1.20 + r * 12.0)
                         + 0.002 * sin(angle * 9.0 - t * 0.80));
    flow *= 1.0 + lift / max(r, 0.001);
    vec2 sampleUV = center + flow / vec2(aspect, 1.0);
    sampleUV += vec2(sin(p.y * 36.0 - t * 0.85), cos(p.x * 32.0 - t * 0.72)) * 0.002 * surface;
    vec3 color = texture2D(u_image, sampleUV).rgb;
    // A moving intensity pattern follows existing gold strands only. It never
    // adds light: retain 91–100% of source intensity, avoiding glitter or flares.
    float warmPlasma = smoothstep(0.035, 0.17, color.r - color.b);
    float stream = corona * warmPlasma * (0.5 + 0.5 * sin(angle * 12.0 - r * 65.0 - t * 1.65));
    color *= 1.0 - 0.09 * stream;
    // Relax the photographic corona rather than adding an artificial bloom or
    // flashing highlights. The texture itself retains its delicate gold detail.
    color = mix(color, vec3(0.94, 0.96, 0.98), corona * 0.12);
    gl_FragColor = vec4(color * alpha, alpha);
  }
`

