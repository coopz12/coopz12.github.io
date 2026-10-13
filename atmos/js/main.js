/* STRATA v2 — a scroll-flown glider exhibit.
   One CatmullRom curve is the whole world. A virtual scroller turns wheel
   and pan deltas into a target progress; a lerped progress chases it and
   carries the camera along the curve. Facts are HTML overlays projected
   from anchors on the curve, and the flight slows down near them. */

(function () {
  "use strict";

  var reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------------- Progress state ---------------- */

  var params = new URLSearchParams(window.location.search);
  var pinned = null;
  if (params.has("p")) pinned = parseFloat(params.get("p"));
  else if (window.location.hash.indexOf("p=") > -1) {
    pinned = parseFloat(window.location.hash.split("p=")[1]);
  }
  if (pinned !== null && isFinite(pinned)) {
    pinned = Math.min(1, Math.max(0, pinned));
  } else {
    pinned = null;
  }

  var target = pinned !== null ? pinned : 0;
  var progress = target;
  var prevProgress = progress;

  /* ---------------- Facts (original copy) ---------------- */

  var FACTS = [
    {
      title: "Taste at Altitude",
      body: "Cabin air is dry and cabin pressure is low, and both dull the tongue. Sweet and salty flavours can register a third weaker in flight, which is why airline food is seasoned harder than anything you would cook at home.",
      ref: "How altitude and dry cabin air change taste perception"
    },
    {
      title: "Why Pilots Say Mayday",
      body: "The distress call comes from the French m'aider, meaning help me. It is always spoken three times in a row, so nobody on a noisy radio channel can mistake it for ordinary chatter.",
      ref: "The French origin of the Mayday distress call"
    },
    {
      title: "Faster Than the Sunset",
      body: "Concorde cruised at Mach 2, twice the speed of sound, and crossed the Atlantic in about three and a half hours. Friction heated its skin so much that the whole airframe stretched by roughly 25 centimetres in flight.",
      ref: "Concorde, Mach 2 cruise and thermal expansion of its airframe"
    },
    {
      title: "Built for Lightning",
      body: "A commercial jet is struck by lightning about once a year on average. The metal skin carries the charge around the cabin and lets it leave again, and passengers usually notice nothing more than a flash.",
      ref: "Lightning strikes on commercial aircraft and how the charge is shed"
    },
    {
      title: "Why the Lights Go Down",
      body: "Cabin lights are dimmed for takeoff and landing so that your eyes are already used to the dark. If anything went wrong and you had to get out in a hurry, you would be able to see where you were going.",
      ref: "Dimming cabin lights so eyes adjust before a possible evacuation"
    },
    {
      title: "Shades Up, on Purpose",
      body: "Window shades go up for landing so the crew can see conditions outside, fire or debris, and so daylight floods the cabin if it ever has to be emptied fast. The view is a safety instrument.",
      ref: "Why window shades stay open for takeoff and landing"
    },
    {
      title: "Who Is Flying, Really",
      body: "On a typical flight the autopilot handles most of the journey, following a route the pilots programmed and watching every system. The humans hand fly the takeoff and the landing and manage everything in between.",
      ref: "The autopilot's share of a typical commercial flight"
    },
    {
      title: "The Black Box Is Orange",
      body: "Flight recorders are painted bright orange, not black. Black box is old slang. The colour is deliberate, so investigators can spot the recorders quickly among wreckage.",
      ref: "Why flight recorders are painted bright orange"
    },
    {
      title: "Thirty Years Young",
      body: "Plenty of airliners stay in service for 25 to 30 years. An aircraft's life is counted in flight cycles and inspections rather than birthdays, and with constant maintenance an old airframe can be a very safe one.",
      ref: "Airliner service lives measured in cycles and maintenance"
    },
    {
      title: "The Safest Seat Myth",
      body: "Studies of accident records have found that seats toward the rear of the cabin have historically come out slightly ahead on survival. But every accident is different, and no seat on the plane comes with a guarantee.",
      ref: "What accident studies say, and do not say, about seat position"
    }
  ];

  /* ---------------- DOM ---------------- */

  var factsWrap = document.getElementById("facts");
  var introEl = document.getElementById("intro");
  var aboutEl = document.getElementById("about");
  var endEl = document.getElementById("end");
  var wipeEl = document.getElementById("wipe");
  var thumbEl = document.getElementById("scroll-thumb");
  var refsEl = document.getElementById("refs");

  FACTS.forEach(function (f, i) {
    var li = document.createElement("li");
    li.textContent = f.ref;
    refsEl.appendChild(li);
  });

  function showOverlay(el) {
    el.hidden = false;
    el.classList.add("fading");
    void el.offsetWidth;
    el.classList.remove("fading");
  }
  function hideOverlay(el) {
    el.classList.add("fading");
    window.setTimeout(function () {
      el.hidden = true;
      el.classList.remove("fading");
    }, reduced ? 60 : 320);
  }

  var overlayOpen = false;
  document.getElementById("about-btn").addEventListener("click", function () {
    overlayOpen = true;
    showOverlay(aboutEl);
  });
  document.getElementById("about-close").addEventListener("click", function () {
    overlayOpen = false;
    hideOverlay(aboutEl);
  });

  /* ---------------- Virtual scroller ---------------- */

  var started = pinned !== null && pinned > 0.004;

  function addTarget(delta) {
    if (pinned !== null || overlayOpen) return;
    target = Math.min(1, Math.max(0, target + delta));
    if (target > 0.0015) started = true;
  }

  window.addEventListener("wheel", function (e) {
    var d = e.deltaY;
    if (e.deltaMode === 1) d *= 16;
    else if (e.deltaMode === 2) d *= window.innerHeight;
    addTarget(d * 0.00042);
  }, { passive: true });

  var dragging = false, lastY = 0;
  window.addEventListener("pointerdown", function (e) {
    if (e.target.closest("button") || e.target.closest(".overlay")) return;
    dragging = true;
    lastY = e.clientY;
  });
  window.addEventListener("pointermove", function (e) {
    if (!dragging) return;
    var dy = lastY - e.clientY;
    lastY = e.clientY;
    addTarget(dy * 0.0011);
  });
  window.addEventListener("pointerup", function () { dragging = false; });
  window.addEventListener("pointercancel", function () { dragging = false; });

  window.addEventListener("keydown", function (e) {
    if (e.key === "ArrowDown" || e.key === "PageDown") { addTarget(0.02); e.preventDefault(); }
    if (e.key === "ArrowUp" || e.key === "PageUp") { addTarget(-0.02); e.preventDefault(); }
  });

  document.getElementById("again-btn").addEventListener("click", function () {
    if (pinned !== null) return;
    hideOverlay(endEl);
    endShown = false;
    wipeEl.classList.add("on");
    window.setTimeout(function () {
      target = 0;
      progress = 0;
      prevProgress = 0;
      started = false;
      introEl.classList.remove("gone");
      wipeEl.classList.remove("on");
    }, reduced ? 60 : 400);
  });

  /* ---------------- Three setup ---------------- */

  var container = document.getElementById("scene");
  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
  } catch (err) {
    document.getElementById("gl-fallback").hidden = false;
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.06;
  container.appendChild(renderer.domElement);

  var scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xc9d6ff, 30, 150);

  var camera = new THREE.PerspectiveCamera(58, window.innerWidth / window.innerHeight, 0.1, 1400);

  var hemi = new THREE.HemisphereLight(0xdfe8ff, 0x0825c6, 0.9);
  scene.add(hemi);
  var sun = new THREE.DirectionalLight(0xfff1dd, 0.55);
  scene.add(sun);
  scene.add(sun.target);

  /* ---------------- The curve ---------------- */

  var curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(4, 1.5, -45),
    new THREE.Vector3(-6, 4, -95),
    new THREE.Vector3(-14, 9, -150),
    new THREE.Vector3(-4, 16, -205),
    new THREE.Vector3(10, 22, -260),
    new THREE.Vector3(16, 30, -315),
    new THREE.Vector3(6, 40, -370),
    new THREE.Vector3(-8, 48, -425),
    new THREE.Vector3(-2, 56, -480),
    new THREE.Vector3(0, 60, -540)
  ], false, "centripetal", 0.5);

  var UP = new THREE.Vector3(0, 1, 0);
  function frameAt(t) {
    var p = curve.getPointAt(t);
    var tan = curve.getTangentAt(t);
    var right = new THREE.Vector3().crossVectors(tan, UP).normalize();
    return { p: p, tan: tan, right: right };
  }

  /* ---------------- Sky dome ---------------- */

  var skyUniforms = {
    topColor: { value: new THREE.Color(0x061da8) },
    bottomColor: { value: new THREE.Color(0xc9d6ff) }
  };
  var sky = new THREE.Mesh(
    new THREE.SphereGeometry(520, 32, 20),
    new THREE.ShaderMaterial({
      uniforms: skyUniforms,
      side: THREE.BackSide,
      depthWrite: false,
      vertexShader: [
        "varying vec3 vPos;",
        "void main() {",
        "  vPos = position;",
        "  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);",
        "}"
      ].join("\n"),
      fragmentShader: [
        "uniform vec3 topColor;",
        "uniform vec3 bottomColor;",
        "varying vec3 vPos;",
        "void main() {",
        "  float h = normalize(vPos).y * 0.5 + 0.5;",
        "  float t = pow(clamp(h, 0.0, 1.0), 0.72);",
        "  gl_FragColor = vec4(mix(bottomColor, topColor, t), 1.0);",
        "}"
      ].join("\n")
    })
  );
  scene.add(sky);

  /* Journey palette: sky stops over the mixer, ground colours per step. */
  var SKY_STOPS = [
    { m: 0.00, top: new THREE.Color(0x061da8), bottom: new THREE.Color(0xc9d6ff) },
    { m: 0.30, top: new THREE.Color(0x0a27c0), bottom: new THREE.Color(0xd3ddff) },
    { m: 0.44, top: new THREE.Color(0x1b36b4), bottom: new THREE.Color(0xffd9ae) },
    { m: 0.60, top: new THREE.Color(0x0d28b8), bottom: new THREE.Color(0xccd9ff) },
    { m: 0.76, top: new THREE.Color(0x12298f), bottom: new THREE.Color(0xffd2a0) },
    { m: 1.00, top: new THREE.Color(0x030b36), bottom: new THREE.Color(0x8ea6f2) }
  ];
  var STEP_GROUND = [
    [8, 37, 198], [8, 37, 198], [116, 136, 234], [255, 192, 148], [136, 162, 247],
    [136, 162, 247], [253, 175, 120], [253, 175, 120], [90, 108, 216], [90, 108, 216]
  ].map(function (c) { return new THREE.Color(c[0] / 255, c[1] / 255, c[2] / 255); });

  var tmpColorA = new THREE.Color(), tmpColorB = new THREE.Color();
  function skyAt(m, outTop, outBottom) {
    var i = 0;
    while (i < SKY_STOPS.length - 2 && m > SKY_STOPS[i + 1].m) i++;
    var a = SKY_STOPS[i], b = SKY_STOPS[i + 1];
    var f = Math.min(1, Math.max(0, (m - a.m) / (b.m - a.m)));
    outTop.copy(a.top).lerp(b.top, f);
    outBottom.copy(a.bottom).lerp(b.bottom, f);
  }
  function groundAt(p, out) {
    var x = Math.min(0.9999, Math.max(0, p)) * (STEP_GROUND.length - 1);
    var i = Math.floor(x);
    out.copy(STEP_GROUND[i]).lerp(STEP_GROUND[i + 1], x - i);
  }

  /* ---------------- Geometry merge helper ---------------- */

  function mergeGeoms(geos) {
    var vTotal = 0, iTotal = 0;
    geos.forEach(function (g) {
      vTotal += g.attributes.position.count;
      iTotal += g.index ? g.index.count : g.attributes.position.count;
    });
    var pos = new Float32Array(vTotal * 3);
    var nor = new Float32Array(vTotal * 3);
    var idx = new (vTotal > 65535 ? Uint32Array : Uint16Array)(iTotal);
    var vo = 0, io = 0;
    geos.forEach(function (g) {
      pos.set(g.attributes.position.array, vo * 3);
      nor.set(g.attributes.normal.array, vo * 3);
      var gi = g.index.array;
      for (var k = 0; k < gi.length; k++) idx[io + k] = gi[k] + vo;
      vo += g.attributes.position.count;
      io += gi.length;
    });
    var out = new THREE.BufferGeometry();
    out.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    out.setAttribute("normal", new THREE.BufferAttribute(nor, 3));
    out.setIndex(new THREE.BufferAttribute(idx, 1));
    return out;
  }

  function rng(seed) {
    var s = seed >>> 0;
    return function () {
      s = (s + 0x6D2B79F5) >>> 0;
      var t = s;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------------- Clouds ---------------- */

  var cloudMatBase = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    vertexColors: true,
    roughness: 1.0,
    metalness: 0.0,
    transparent: false,
    depthWrite: true,
    side: THREE.FrontSide
  });
  var CLOUD_LIT = new THREE.Color(0xe8ecfa);

  /* Deterministic 3D value noise: hash lattice + trilinear smoothstep.
     A function of direction only, so a displaced sphere has no UV seam
     and every cloud proto is identical on every load. */
  function ihash(x, y, z) {
    var n = Math.imul(x, 374761393) + Math.imul(y, 668265263) + Math.imul(z, 1440662683);
    n = Math.imul(n ^ (n >>> 13), 1103515245);
    return ((n ^ (n >>> 16)) >>> 0) / 4294967296;
  }
  function smoother(t) { return t * t * t * (t * (t * 6 - 15) + 10); }
  function vnoise(x, y, z) {
    var xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
    var xf = x - xi, yf = y - yi, zf = z - zi;
    /* Quintic interpolation: C2 continuous, so the displaced surface has
       no crease lines where lattice cells meet. */
    var u = smoother(xf);
    var v = smoother(yf);
    var w = smoother(zf);
    var c000 = ihash(xi, yi, zi),         c100 = ihash(xi + 1, yi, zi);
    var c010 = ihash(xi, yi + 1, zi),     c110 = ihash(xi + 1, yi + 1, zi);
    var c001 = ihash(xi, yi, zi + 1),     c101 = ihash(xi + 1, yi, zi + 1);
    var c011 = ihash(xi, yi + 1, zi + 1), c111 = ihash(xi + 1, yi + 1, zi + 1);
    var x00 = c000 + (c100 - c000) * u, x10 = c010 + (c110 - c010) * u;
    var x01 = c001 + (c101 - c001) * u, x11 = c011 + (c111 - c011) * u;
    var y0 = x00 + (x10 - x00) * v,     y1 = x01 + (x11 - x01) * v;
    return (y0 + (y1 - y0) * w) * 2 - 1; /* -1..1 */
  }
  function fbm(x, y, z) {
    return vnoise(x, y, z) * 0.65 +
      vnoise(x * 2.13 + 5.2, y * 2.13 + 1.3, z * 2.13 + 2.8) * 0.35;
  }

  /* computeVertexNormals leaves the sphere's duplicated seam and pole
     vertices with one-sided normals. Average the normals of coincident
     vertices so the shading is continuous across the seam. */
  function weldNormals(geo) {
    var posA = geo.attributes.position;
    var norA = geo.attributes.normal;
    var map = {};
    var i, key, e;
    for (i = 0; i < posA.count; i++) {
      key = Math.round(posA.getX(i) * 4000) + "," +
        Math.round(posA.getY(i) * 4000) + "," +
        Math.round(posA.getZ(i) * 4000);
      e = map[key];
      if (!e) { e = map[key] = { x: 0, y: 0, z: 0, idx: [] }; }
      e.x += norA.getX(i); e.y += norA.getY(i); e.z += norA.getZ(i);
      e.idx.push(i);
    }
    Object.keys(map).forEach(function (k) {
      var g = map[k];
      var len = Math.sqrt(g.x * g.x + g.y * g.y + g.z * g.z) || 1;
      for (var j = 0; j < g.idx.length; j++) {
        norA.setXYZ(g.idx[j], g.x / len, g.y / len, g.z / len);
      }
    });
    norA.needsUpdate = true;
  }

  /* One lumpy mass: a sphere pushed in and out along its own normals by
     low frequency noise, gently squashed, with a softened flat base. */
  function makeLump(r, seedOff, rand, wSeg, hSeg) {
    var g = new THREE.SphereGeometry(r, wSeg, hSeg);
    var posA = g.attributes.position;
    var v = new THREE.Vector3();
    var freq = 1.35 + rand() * 0.5;
    for (var i = 0; i < posA.count; i++) {
      v.fromBufferAttribute(posA, i).normalize();
      var n = fbm(v.x * freq + seedOff, v.y * freq + seedOff * 1.7, v.z * freq - seedOff);
      var bump = 1 + n * 0.22;
      posA.setXYZ(i, v.x * r * bump, v.y * r * bump, v.z * r * bump);
    }
    var squashY = 0.78 + rand() * 0.1;
    g.applyMatrix4(new THREE.Matrix4().makeScale(1.12, squashY, 1.0));
    posA = g.attributes.position;
    var flatY = -r * squashY * 0.52;
    for (var j = 0; j < posA.count; j++) {
      var y = posA.getY(j);
      if (y < flatY) posA.setY(j, flatY + (y - flatY) * 0.32);
    }
    g.computeVertexNormals();
    weldNormals(g);
    return g;
  }

  /* Soft internal modelling baked in: pale tops, deeper blue undersides,
     so a cloud reads as a lit mass even where the lights are frontal. */
  var CLOUD_TOP = new THREE.Color(0x6d86e8);
  var CLOUD_MID = new THREE.Color(0x556fdd);
  var CLOUD_BOT = new THREE.Color(0x445cc4);
  function bakeCloudColors(geo) {
    geo.computeBoundingBox();
    var bb = geo.boundingBox;
    var posA = geo.attributes.position;
    var colors = new Float32Array(posA.count * 3);
    var span = Math.max(0.001, bb.max.y - bb.min.y);
    var c = new THREE.Color();
    for (var i = 0; i < posA.count; i++) {
      var t = (posA.getY(i) - bb.min.y) / span;
      t = t * t * (3 - 2 * t);
      if (t < 0.38) c.copy(CLOUD_BOT).lerp(CLOUD_MID, t / 0.38);
      else c.copy(CLOUD_MID).lerp(CLOUD_TOP, (t - 0.38) / 0.62);
      colors[i * 3] = c.r;
      colors[i * 3 + 1] = c.g;
      colors[i * 3 + 2] = c.b;
    }
    geo.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  }

  function makeCloudGeo(seed) {
    var rand = rng(seed);
    var geos = [];
    var main = makeLump(1.75 + rand() * 0.3, seed * 0.37, rand, 36, 24);
    main.applyMatrix4(new THREE.Matrix4().makeTranslation(0, 0.15, 0));
    geos.push(main);
    var lobes = 2 + Math.floor(rand() * 2); /* 3 to 4 masses per cloud */
    for (var i = 0; i < lobes; i++) {
      /* Satellites must commit: at least a third of each one stands proud
         of the main mass. A lobe that only just breaks the surface reads
         as a bright crescent sliver where the two surfaces graze. */
      var g = makeLump(1.2 + rand() * 0.6, seed * 0.37 + 11.3 * (i + 1), rand, 30, 20);
      var side = i % 2 === 0 ? 1 : -1;
      g.applyMatrix4(new THREE.Matrix4().makeTranslation(
        side * (1.5 + rand() * 0.8),
        -0.3 + rand() * 0.85,
        (rand() - 0.5) * 1.6
      ));
      geos.push(g);
    }
    var merged = mergeGeoms(geos);
    bakeCloudColors(merged);
    return merged;
  }

  /* Placement table: [progress, lateral, vertical, scale] */
  var CLOUD_TABLE = [
    [0.015, -11, 3, 3.2], [0.03, 12, -2, 2.8], [0.05, -16, 7, 3.6], [0.07, 9, 10, 2.2],
    [0.10, 15, 2, 3.0], [0.13, -10, -5, 2.6], [0.16, 18, 6, 3.4], [0.19, -15, -3, 2.4],
    [0.22, 11, 9, 2.9], [0.26, -18, 1, 3.5], [0.30, 14, -6, 2.5], [0.34, -9, 8, 2.7],
    [0.38, 17, 3, 3.3], [0.42, -14, -4, 2.3], [0.46, 10, 7, 3.0], [0.50, -17, 0, 3.6],
    [0.54, 13, 10, 2.4], [0.58, -11, -6, 2.8], [0.62, 16, 4, 3.1], [0.66, -15, 8, 2.6],
    [0.70, 9, -3, 3.4], [0.74, -18, 2, 2.9], [0.78, 12, 9, 2.2], [0.82, -10, -5, 3.2],
    [0.86, 15, 5, 2.7], [0.90, -14, 0, 3.5], [0.94, 10, -4, 2.5], [0.97, -12, 6, 3.0],
    [0.06, 20, -8, 4.0], [0.55, -22, 12, 4.2],
    [0.33, -16, -6, 3.0], [0.44, 13, 9, 2.6], [0.57, 18, -2, 3.3],
    [0.68, -12, -8, 2.8], [0.80, 17, 6, 3.0], [0.92, -18, 10, 3.4]
  ];

  var cloudProtos = [];
  for (var cp = 0; cp < 5; cp++) cloudProtos.push(makeCloudGeo(1000 + cp * 77));

  var clouds = [];
  CLOUD_TABLE.forEach(function (row, i) {
    var f = frameAt(row[0]);
    var pos = f.p.clone()
      .addScaledVector(f.right, row[1])
      .add(new THREE.Vector3(0, row[2], 0));
    var mat = cloudMatBase.clone();
    var mesh = new THREE.Mesh(cloudProtos[i % cloudProtos.length], mat);
    mesh.position.copy(pos);
    mesh.scale.set(row[3] * (i % 3 === 0 ? -1 : 1), row[3], row[3]); /* some mirrored */
    mesh.rotation.y = (i * 1.7) % Math.PI;
    mesh.renderOrder = 1;
    scene.add(mesh);
    clouds.push({ mesh: mesh, mat: mat, pos: pos });
  });

  function distFade(dist, range) {
    var x = 1 - dist / range;
    x = Math.min(1, Math.max(0, x));
    return Math.min(1, 2 * x * x);
  }

  /* ---------------- Glider ---------------- */

  var glider = new THREE.Group();
  var gliderMat = new THREE.MeshStandardMaterial({ color: 0xe9efff, roughness: 0.55, metalness: 0.05 });
  var canopyMat = new THREE.MeshStandardMaterial({ color: 0x8fa9ec, roughness: 0.22, metalness: 0.15 });

  var profile = [
    [0.012, -1.05], [0.10, -0.82], [0.155, -0.38], [0.185, 0.0],
    [0.165, 0.36], [0.105, 0.70], [0.028, 0.96], [0.001, 1.04]
  ].map(function (p) { return new THREE.Vector2(p[0], p[1]); });
  var fuselage = new THREE.Mesh(new THREE.LatheGeometry(profile, 22), gliderMat);
  fuselage.geometry.rotateX(Math.PI / 2); /* lathe axis to +Z, nose forward */
  glider.add(fuselage);

  var canopy = new THREE.Mesh(new THREE.SphereGeometry(0.145, 18, 12), canopyMat);
  canopy.scale.set(0.85, 0.62, 1.9);
  canopy.position.set(0, 0.115, 0.22);
  glider.add(canopy);

  var wing = new THREE.Mesh(new THREE.BoxGeometry(2.8, 0.045, 0.36), gliderMat);
  wing.position.set(0, 0.01, 0.12);
  glider.add(wing);
  [-1.42, 1.42].forEach(function (x) {
    var tip = new THREE.Mesh(new THREE.SphereGeometry(0.18, 14, 10), gliderMat);
    tip.scale.set(1.1, 0.14, 1.0);
    tip.position.set(x, 0.01, 0.12);
    glider.add(tip);
  });

  var stab = new THREE.Mesh(new THREE.BoxGeometry(0.98, 0.04, 0.27), gliderMat);
  stab.position.set(0, 0.05, -0.95);
  glider.add(stab);
  var fin = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.44, 0.32), gliderMat);
  fin.position.set(0, 0.24, -0.95);
  glider.add(fin);

  glider.scale.setScalar(1.18);
  scene.add(glider);

  /* ---------------- Contrail ---------------- */

  var TRAIL_N = 42;
  var trailPos = new Float32Array((TRAIL_N + 1) * 2 * 3);
  var trailAlpha = new Float32Array((TRAIL_N + 1) * 2);
  var trailIdx = [];
  for (var ti = 0; ti < TRAIL_N; ti++) {
    var a = ti * 2, b = ti * 2 + 1, c = ti * 2 + 2, d = ti * 2 + 3;
    trailIdx.push(a, b, c, b, d, c);
    var fade = 1 - ti / TRAIL_N;
    trailAlpha[ti * 2] = trailAlpha[ti * 2 + 1] = fade * fade;
  }
  trailAlpha[TRAIL_N * 2] = trailAlpha[TRAIL_N * 2 + 1] = 0;
  var trailGeo = new THREE.BufferGeometry();
  trailGeo.setAttribute("position", new THREE.BufferAttribute(trailPos, 3));
  trailGeo.setAttribute("aAlpha", new THREE.BufferAttribute(trailAlpha, 1));
  trailGeo.setIndex(trailIdx);
  var trail = new THREE.Mesh(trailGeo, new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    vertexShader: [
      "attribute float aAlpha;",
      "varying float vA;",
      "void main() {",
      "  vA = aAlpha;",
      "  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);",
      "}"
    ].join("\n"),
    fragmentShader: [
      "varying float vA;",
      "void main() { gl_FragColor = vec4(1.0, 1.0, 1.0, vA * 0.5); }"
    ].join("\n")
  }));
  trail.renderOrder = 2;
  trail.frustumCulled = false;
  scene.add(trail);

  var _tp = new THREE.Vector3(), _tt = new THREE.Vector3(), _tr = new THREE.Vector3();
  function updateTrail(gliderT) {
    /* The ribbon must stop short of the camera: geometry at or behind the
       camera projects into a huge fan across the frame. */
    var endT = Math.max(gliderT - 0.06, progress + 0.005);
    if (endT > gliderT) endT = gliderT;
    var step = (gliderT - endT) / TRAIL_N;
    for (var k = 0; k <= TRAIL_N; k++) {
      var s = k / TRAIL_N;
      var t = gliderT - k * step;
      curve.getPointAt(t, _tp);
      curve.getTangentAt(t, _tt);
      _tr.crossVectors(_tt, UP).normalize();
      var wdt = 0.02 + 0.15 * (1 - s);
      var o = k * 6;
      trailPos[o]     = _tp.x - _tr.x * wdt;
      trailPos[o + 1] = _tp.y - 0.06 - _tr.y * wdt;
      trailPos[o + 2] = _tp.z - _tr.z * wdt;
      trailPos[o + 3] = _tp.x + _tr.x * wdt;
      trailPos[o + 4] = _tp.y - 0.06 + _tr.y * wdt;
      trailPos[o + 5] = _tp.z + _tr.z * wdt;
      var tailFade = 1 - Math.min(1, Math.max(0, (s - 0.78) / 0.22));
      var av = (1 - s) * (1 - s) * tailFade;
      trailAlpha[k * 2] = trailAlpha[k * 2 + 1] = av;
    }
    trailGeo.attributes.position.needsUpdate = true;
    trailGeo.attributes.aAlpha.needsUpdate = true;
  }

  /* ---------------- Balloon (the surprise guest) ---------------- */

  var BALLOON_T = 0.6;
  var balloon = new THREE.Group();
  (function buildBalloon() {
    var cv = document.createElement("canvas");
    cv.width = 512; cv.height = 256;
    var cx = cv.getContext("2d");
    var stripes = ["#eef3ff", "#6f8ef2", "#eef3ff", "#f2b183", "#eef3ff", "#3f63d8", "#eef3ff", "#f2b183"];
    stripes.forEach(function (c, i) {
      cx.fillStyle = c;
      cx.fillRect(i * 64, 0, 64, 256);
    });
    var tex = new THREE.CanvasTexture(cv);
    tex.encoding = THREE.sRGBEncoding;
    var envMat = new THREE.MeshStandardMaterial({
      map: tex, roughness: 0.75, metalness: 0.0, transparent: true, depthWrite: true
    });
    var env = new THREE.Mesh(new THREE.SphereGeometry(1.55, 26, 19), envMat);
    env.scale.set(1, 1.12, 1);
    balloon.add(env);
    var coneMat = new THREE.MeshStandardMaterial({
      color: 0x2c49a8, roughness: 0.9, transparent: true, depthWrite: true
    });
    var cone = new THREE.Mesh(new THREE.CylinderGeometry(0.24, 0.62, 0.62, 14, 1, true), coneMat);
    cone.position.y = -1.95;
    balloon.add(cone);
    var basketMat = new THREE.MeshStandardMaterial({
      color: 0xa06a42, roughness: 1.0, transparent: true, depthWrite: true
    });
    var basket = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.38, 0.46), basketMat);
    basket.position.y = -2.42;
    balloon.add(basket);
    balloon.userData.mats = [envMat, coneMat, basketMat];
  })();
  var bf = frameAt(BALLOON_T);
  var balloonBase = bf.p.clone()
    .addScaledVector(bf.right, -13)
    .add(new THREE.Vector3(0, 6.5, 0));
  balloon.position.copy(balloonBase);
  balloon.renderOrder = 1;
  scene.add(balloon);

  /* ---------------- Wind particles ---------------- */

  function streakTexture() {
    var cv = document.createElement("canvas");
    cv.width = 128; cv.height = 128;
    var cx = cv.getContext("2d");
    var g = cx.createLinearGradient(0, 0, 128, 0);
    g.addColorStop(0, "rgba(255,255,255,0)");
    g.addColorStop(0.5, "rgba(255,255,255,0.95)");
    g.addColorStop(1, "rgba(255,255,255,0)");
    cx.fillStyle = g;
    cx.fillRect(0, 0, 128, 128);
    cx.globalCompositeOperation = "destination-in";
    var v = cx.createLinearGradient(0, 54, 0, 74);
    v.addColorStop(0, "rgba(255,255,255,0)");
    v.addColorStop(0.5, "rgba(255,255,255,1)");
    v.addColorStop(1, "rgba(255,255,255,0)");
    cx.fillStyle = v;
    cx.fillRect(0, 0, 128, 128);
    return new THREE.CanvasTexture(cv);
  }

  var P_COUNT = 200;
  var pPos = new Float32Array(P_COUNT * 3);
  var pSpeed = new Float32Array(P_COUNT);
  var pRand = rng(4242);
  for (var pi = 0; pi < P_COUNT; pi++) {
    pPos[pi * 3] = (pRand() - 0.5) * 36;
    pPos[pi * 3 + 1] = (pRand() - 0.5) * 22;
    pPos[pi * 3 + 2] = -14 - pRand() * 42;
    pSpeed[pi] = 0.7 + pRand() * 0.6;
  }
  var pGeo = new THREE.BufferGeometry();
  pGeo.setAttribute("position", new THREE.BufferAttribute(pPos, 3));
  var particles = new THREE.Points(pGeo, new THREE.PointsMaterial({
    size: 0.8,
    map: streakTexture(),
    transparent: true,
    opacity: 0.2,
    depthWrite: false,
    sizeAttenuation: true
  }));
  particles.frustumCulled = false;
  scene.add(particles);

  /* ---------------- Fact anchors ---------------- */

  var anchors = FACTS.map(function (f, i) {
    var t = 0.1 * (i + 1);
    var side = i % 2 === 0 ? 1 : -1;
    var fr = frameAt(t);
    var pos = fr.p.clone()
      .addScaledVector(fr.right, side * 5.5)
      .add(new THREE.Vector3(0, 1.3, 0));
    var el = document.createElement("div");
    el.className = "fact" + (side > 0 ? " align-r" : "");
    el.innerHTML =
      '<span class="fact-sup">Fact #' + (i + 1) + "</span>" +
      '<h3 class="fact-title"></h3><p class="fact-body"></p>';
    el.querySelector(".fact-title").textContent = f.title;
    el.querySelector(".fact-body").textContent = f.body;
    factsWrap.appendChild(el);
    return { t: t, side: side, pos: pos, el: el };
  });

  /* ---------------- Resize ---------------- */

  function applySize() {
    var w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.fov = camera.aspect < 0.75 ? 82 : camera.aspect < 1.15 ? 70 : 58;
    camera.updateProjectionMatrix();
  }
  window.addEventListener("resize", applySize);
  applySize();

  /* ---------------- Main loop ---------------- */

  var clock = new THREE.Clock();
  var endShown = false;
  var _v = new THREE.Vector3();
  var _camPos = new THREE.Vector3();
  var _look = new THREE.Vector3();
  var _gliderPos = new THREE.Vector3();
  var _gliderLook = new THREE.Vector3();
  var _prevGliderPos = new THREE.Vector3();
  var _right = new THREE.Vector3();
  var bank = 0, bankInit = false;
  var thumbH = thumbEl.offsetHeight || 64;

  function smooth01(x) {
    x = Math.min(1, Math.max(0, x));
    return x * x * (3 - 2 * x);
  }

  function frame() {
    requestAnimationFrame(frame);
    var dt = Math.min(clock.getDelta(), 0.05);
    var tNow = clock.elapsedTime;
    var frameScale = Math.min(2, Math.max(0.4, dt * 60));

    /* Slow down near facts: amplitude collapses as the camera nears one. */
    var nearDist = Infinity, nearAnchor = null;
    for (var i = 0; i < anchors.length; i++) {
      var d = Math.abs(progress - anchors[i].t);
      if (d < nearDist) { nearDist = d; nearAnchor = anchors[i]; }
    }
    var prox = smooth01(1 - nearDist / 0.055);
    var amp = 1 - 0.97 * prox; /* toward ~0.03x at the fact itself */

    progress += (target - progress) * Math.min(1, 0.025 * amp * frameScale);
    if (Math.abs(target - progress) < 0.0004) progress = target;
    progress = Math.min(1, Math.max(0, progress));

    var vel = dt > 0 ? (progress - prevProgress) / dt : 0;
    prevProgress = progress;

    /* Camera on the curve, looking down its tangent. */
    var camF = frameAt(progress);
    _camPos.copy(camF.p);
    if (nearAnchor && prox > 0) {
      _camPos.addScaledVector(camF.right, nearAnchor.side * prox * 1.1);
    }
    camera.position.copy(_camPos);
    curve.getPointAt(Math.min(1, progress + 0.045), _look);
    camera.lookAt(_look);
    sky.position.copy(_camPos);

    sun.position.set(_camPos.x + 14, _camPos.y + 22, _camPos.z + 8);
    sun.target.position.copy(_camPos);

    /* Palette follows the journey. */
    var mixer = Math.min(1, progress / 0.95);
    skyAt(mixer, tmpColorA, tmpColorB);
    skyUniforms.topColor.value.copy(tmpColorA);
    skyUniforms.bottomColor.value.copy(tmpColorB);
    scene.fog.color.copy(tmpColorB);
    groundAt(progress, tmpColorA);
    hemi.groundColor.copy(tmpColorA);

    /* Glider ahead of the camera. */
    var gliderT = Math.min(1, progress + 0.02);
    var gF = frameAt(gliderT);
    var bobY = reduced ? Math.sin(tNow * 1.2) * 0.05 : Math.sin(tNow * 1.25) * 0.2;
    var swayX = reduced ? 0 : Math.sin(tNow * 0.66) * 0.09;
    _gliderPos.copy(gF.p)
      .addScaledVector(gF.right, swayX)
      .add(_v.set(0, bobY, 0));
    glider.position.copy(_gliderPos);
    curve.getPointAt(Math.min(1, gliderT + 0.02), _gliderLook);
    glider.lookAt(_gliderLook);
    if (bankInit && dt > 0) {
      _right.setFromMatrixColumn(camera.matrix, 0);
      var latVel = _gliderPos.clone().sub(_prevGliderPos).divideScalar(dt).dot(_right);
      var bankTarget = Math.max(-0.42, Math.min(0.42, -latVel * 0.16));
      bank += (bankTarget - bank) * Math.min(1, dt * 3.2);
    }
    glider.rotateZ(bank);
    _prevGliderPos.copy(_gliderPos);
    bankInit = true;

    updateTrail(gliderT);

    /* Clouds melt in by distance, the same rule as the facts, but as a
       tint toward the fog colour rather than alpha: a semi-transparent
       clay mass lets the bright rims of whatever is behind it ghost
       through as slivers. Opaque geometry tinted to the sky reads as
       the same fade and cannot ghost. */
    for (var ci = 0; ci < clouds.length; ci++) {
      var c = clouds[ci];
      var cd = c.pos.distanceTo(_camPos);
      var co = distFade(cd, 44);
      c.mesh.visible = co > 0.02;
      c.mat.color.copy(scene.fog.color).lerp(CLOUD_LIT, Math.min(1, co * 2.2));
    }

    /* Balloon bobs, turns, and fades like the original guest. */
    balloon.position.y = balloonBase.y + (reduced ? 0 : Math.sin(tNow * 0.5) * 0.45);
    balloon.rotation.y += dt * 0.12;
    var bOp = distFade(balloon.position.distanceTo(_camPos), 48);
    balloon.userData.mats.forEach(function (m) { m.opacity = bOp; });
    balloon.visible = bOp > 0.012;

    /* Wind particles ride with the camera. */
    particles.position.copy(_camPos);
    particles.quaternion.copy(camera.quaternion);
    var pSpeedBase = 2.4 + Math.min(22, Math.abs(vel) * 150);
    for (var pj = 0; pj < P_COUNT; pj++) {
      pPos[pj * 3 + 2] += pSpeedBase * pSpeed[pj] * dt;
      if (pPos[pj * 3 + 2] > -8) {
        pPos[pj * 3 + 2] = -56;
        pPos[pj * 3] = (pRand() - 0.5) * 36;
        pPos[pj * 3 + 1] = (pRand() - 0.5) * 22;
      }
    }
    pGeo.attributes.position.needsUpdate = true;

    /* Facts: project anchors, fade by distance, fade again as you pass. */
    var w = window.innerWidth, h = window.innerHeight;
    var halfBlock = Math.min(340, w * 0.78) / 2;
    var sxMin = halfBlock + 12, sxMax = w - halfBlock - 12;
    if (sxMax < sxMin) { sxMin = sxMax = w / 2; }
    for (var fi = 0; fi < anchors.length; fi++) {
      var an = anchors[fi];
      var dist = an.pos.distanceTo(_camPos);
      var op = distFade(dist, 30);
      var pass = Math.min(1, Math.max(0, (dist - 3.4) / 0.9));
      op *= pass * pass;
      if (op < 0.015) { an.el.style.opacity = "0"; continue; }
      _v.copy(an.pos).project(camera);
      if (_v.z > 1 || _v.z < -1) { an.el.style.opacity = "0"; continue; }
      var sx = (_v.x * 0.5 + 0.5) * w;
      var sy = (-_v.y * 0.5 + 0.5) * h;
      sx = Math.min(sxMax, Math.max(sxMin, sx));
      sy = Math.min(h * 0.84, Math.max(h * 0.21, sy));
      an.el.style.opacity = op.toFixed(3);
      an.el.style.transform =
        "translate(-50%, -50%) translate(" + sx.toFixed(1) + "px, " + sy.toFixed(1) + "px)";
    }

    /* Scrollbar + intro + end states. */
    thumbEl.style.transform =
      "translateY(" + (progress * Math.max(0, window.innerHeight - thumbH)).toFixed(1) + "px)";
    if (started && progress > 0.002) introEl.classList.add("gone");
    if (progress >= 0.95 && !endShown) { endShown = true; showOverlay(endEl); }
    else if (progress < 0.93 && endShown) { endShown = false; hideOverlay(endEl); }

    renderer.render(scene, camera);
  }

  if (pinned !== null) {
    /* Pinned stills skip the fade so screenshots are deterministic. */
    introEl.classList.add("instant");
    introEl.classList.toggle("gone", pinned > 0.004);
  }
  frame();
})();
