/* STRATA - scroll-piloted climb, 0 to 100 km.
   Scroll position sets a target altitude. The render loop eases the actual
   altitude toward it (inertia), so the glider banks, pitches and settles
   like it has weight instead of snapping to the scrollbar. */

(function () {
  "use strict";

  var MAX_ALT = 100;
  var REDUCED = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* Pin mode for screenshots and sharing: ?alt=55 or #alt=55 freezes the
     flight at that altitude. Harmless in normal use. */
  var pinned = null;
  var fromQuery = new URLSearchParams(window.location.search).get("alt");
  var fromHash = (window.location.hash.match(/alt=([\d.]+)/) || [])[1];
  var pinRaw = fromQuery !== null ? fromQuery : fromHash;
  if (pinRaw != null && !isNaN(parseFloat(pinRaw))) {
    pinned = Math.min(MAX_ALT, Math.max(0, parseFloat(pinRaw)));
  }

  /* ---------------- Scene setup ---------------- */

  var canvas = document.getElementById("scene");
  var renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, powerPreference: "high-performance" });
  } catch (e) {
    document.getElementById("gl-fallback").hidden = false;
    return;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);

  var scene = new THREE.Scene();
  var camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 1200);

  var SKY_STOPS = [
    [0,   new THREE.Color(0x7ea9c9)],
    [8,   new THREE.Color(0x6797c2)],
    [12,  new THREE.Color(0x5486ba)],
    [25,  new THREE.Color(0x3c6aa5)],
    [40,  new THREE.Color(0x2a4f88)],
    [55,  new THREE.Color(0x1d3868)],
    [70,  new THREE.Color(0x14264e)],
    [85,  new THREE.Color(0x0b1734)],
    [95,  new THREE.Color(0x060b1e)],
    [100, new THREE.Color(0x03050d)]
  ];
  function skyColorAt(alt, out) {
    for (var i = 1; i < SKY_STOPS.length; i++) {
      if (alt <= SKY_STOPS[i][0]) {
        var a = SKY_STOPS[i - 1], b = SKY_STOPS[i];
        var t = (alt - a[0]) / (b[0] - a[0]);
        return out.copy(a[1]).lerp(b[1], t);
      }
    }
    return out.copy(SKY_STOPS[SKY_STOPS.length - 1][1]);
  }

  var skyNow = skyColorAt(0, new THREE.Color());
  scene.background = skyNow;
  scene.fog = new THREE.Fog(skyNow.getHex(), 30, 260);
  scene.fog.color.copy(skyNow);

  var hemi = new THREE.HemisphereLight(0xbcd6ee, 0x51604a, 0.95);
  scene.add(hemi);
  var sun = new THREE.DirectionalLight(0xfff1da, 1.05);
  sun.position.set(40, 60, -30);
  scene.add(sun);
  var fill = new THREE.DirectionalLight(0xdfeaf5, 0.3);
  fill.position.set(0, 12, 80);
  scene.add(fill);

  /* ---------------- Ground: patchwork fields seen from above ---------------- */

  function groundTexture() {
    var c = document.createElement("canvas");
    c.width = c.height = 512;
    var g = c.getContext("2d");
    var tones = ["#5d7340", "#687c46", "#526a39", "#7d8655", "#93835a", "#61763f", "#71804b"];
    g.fillStyle = tones[0];
    g.fillRect(0, 0, 512, 512);
    for (var i = 0; i < 90; i++) {
      g.fillStyle = tones[(Math.random() * tones.length) | 0];
      var w = 30 + Math.random() * 120, h = 30 + Math.random() * 120;
      g.fillRect(Math.random() * 512, Math.random() * 512, w, h);
    }
    g.fillStyle = "rgba(38,48,28,0.20)";
    for (var j = 0; j < 900; j++) {
      g.fillRect(Math.random() * 512, Math.random() * 512, 2, 2);
    }
    var tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(20, 20);
    return tex;
  }

  var ground = new THREE.Mesh(
    new THREE.CircleGeometry(700, 48),
    new THREE.MeshLambertMaterial({ map: groundTexture(), color: 0xc3cec0 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = 0;
  scene.add(ground);

  /* ---------------- Clouds: soft sprites, clustered ---------------- */

  function cloudTexture() {
    var c = document.createElement("canvas");
    c.width = 256; c.height = 256;
    var g = c.getContext("2d");
    for (var i = 0; i < 16; i++) {
      var x = 48 + Math.random() * 160, y = 96 + Math.random() * 64;
      var r = 26 + Math.random() * 52;
      var grad = g.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, "rgba(255,255,255,0.20)");
      grad.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = grad;
      g.fillRect(0, 0, 256, 256);
    }
    return new THREE.CanvasTexture(c);
  }
  var cloudTex = cloudTexture();

  function cloudCluster(count, yMin, yMax, spreadX, spreadZ, scaleMin, scaleMax, opacity, tint) {
    var group = new THREE.Group();
    for (var i = 0; i < count; i++) {
      var mat = new THREE.SpriteMaterial({
        map: cloudTex, transparent: true, opacity: opacity,
        color: tint, depthWrite: false, fog: true
      });
      var cx = (Math.random() * 2 - 1) * spreadX;
      if (Math.abs(cx) < 12) cx = (cx < 0 ? -1 : 1) * (12 + Math.random() * 10);
      var cy = yMin + Math.random() * (yMax - yMin);
      var cz = -8 - Math.random() * spreadZ;
      var puffs = 5 + (Math.random() * 4 | 0);
      for (var p = 0; p < puffs; p++) {
        var s = new THREE.Sprite(mat);
        var sc = scaleMin + Math.random() * (scaleMax - scaleMin);
        s.scale.set(sc, sc * 0.42, 1);
        s.position.set(
          cx + (Math.random() * 2 - 1) * sc * 0.45,
          cy + (Math.random() * 2 - 1) * sc * 0.10,
          cz + (Math.random() * 2 - 1) * sc * 0.3
        );
        group.add(s);
      }
    }
    scene.add(group);
    return group;
  }

  cloudCluster(22, 1.5, 13, 58, 42, 7, 15, 0.85, 0xffffff);   /* troposphere deck */
  cloudCluster(7, 17, 32, 62, 46, 12, 22, 0.34, 0xf4f7fa);   /* stratosphere wisps */
  cloudCluster(4, 79, 84, 66, 46, 18, 30, 0.16, 0xa9c2e8);   /* noctilucent veils */

  /* ---------------- Stars ---------------- */

  var starGeo = new THREE.BufferGeometry();
  var starPos = [];
  for (var s2 = 0; s2 < 1000; s2++) {
    var theta = Math.random() * Math.PI * 2;
    var up = Math.random() * 0.95 + 0.03;
    var r = 420 + Math.random() * 120;
    var horiz = Math.sqrt(Math.max(0, 1 - up * up)) * r;
    starPos.push(Math.cos(theta) * horiz, up * r + 30, Math.sin(theta) * horiz - 60);
  }
  starGeo.setAttribute("position", new THREE.Float32BufferAttribute(starPos, 3));
  var starMat = new THREE.PointsMaterial({
    color: 0xdfe9f5, size: 1.6, sizeAttenuation: false,
    transparent: true, opacity: 0, fog: false, depthWrite: false
  });
  scene.add(new THREE.Points(starGeo, starMat));

  /* ---------------- The glider, built from primitives ---------------- */

  var ACCENT = 0xe06036;
  var glider = new THREE.Group();
  var bodyMat = new THREE.MeshStandardMaterial({ color: 0xeef2f4, roughness: 0.55, metalness: 0.08 });
  var accentMat = new THREE.MeshStandardMaterial({ color: ACCENT, roughness: 0.5, metalness: 0.08, emissive: ACCENT, emissiveIntensity: 0.22 });
  var glassMat = new THREE.MeshStandardMaterial({ color: 0x141e28, roughness: 0.15, metalness: 0.45 });

  function addPart(geo, mat, x, y, z, sx, sy, sz, rx) {
    var m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    if (sx !== undefined) m.scale.set(sx, sy, sz);
    if (rx) m.rotation.x = rx;
    glider.add(m);
    return m;
  }

  /* Fuselage: nose at -z (direction of flight), tail at +z. */
  addPart(new THREE.CylinderGeometry(0.085, 0.17, 1.9, 14), bodyMat, 0, 0, 0.15, 1, 1, 1, Math.PI / 2);
  addPart(new THREE.SphereGeometry(0.17, 16, 12), bodyMat, 0, 0, -0.82, 1, 0.92, 1.5);
  addPart(new THREE.CylinderGeometry(0.02, 0.085, 1.0, 10), bodyMat, 0, 0.03, 1.55, 1, 1, 1, Math.PI / 2);
  addPart(new THREE.SphereGeometry(0.155, 16, 12), glassMat, 0, 0.115, -0.28, 0.82, 0.55, 1.9);
  /* Main wing: white centre, orange tips. */
  addPart(new THREE.BoxGeometry(2.35, 0.045, 0.52), bodyMat, 0, 0.02, -0.05);
  addPart(new THREE.BoxGeometry(0.55, 0.045, 0.52), accentMat, -1.45, 0.02, -0.05);
  addPart(new THREE.BoxGeometry(0.55, 0.045, 0.52), accentMat, 1.45, 0.02, -0.05);
  /* Tail: stabiliser and fin. */
  addPart(new THREE.BoxGeometry(1.15, 0.04, 0.34), bodyMat, 0, 0.06, 2.0);
  addPart(new THREE.BoxGeometry(0.035, 0.30, 0.36), bodyMat, 0, 0.19, 1.98);
  addPart(new THREE.BoxGeometry(0.037, 0.10, 0.36), accentMat, 0, 0.36, 1.98);
  glider.scale.setScalar(1.18);
  scene.add(glider);

  /* ---------------- Flight state ---------------- */

  var targetAlt = pinned !== null ? pinned : 0;
  var currentAlt = targetAlt;
  var prevAlt = currentAlt;
  var vsSmooth = 0;
  function camZ() {
    var a = window.innerWidth / window.innerHeight;
    return a >= 1 ? 6.2 : 6.2 + (1 - a) * 5.4;
  }
  var camPos = new THREE.Vector3(0, currentAlt + 1.15, camZ());
  var lookPt = new THREE.Vector3(0, currentAlt + 0.85, -8);
  var flightStarted = false, flightStartT = 0, finalTime = null;

  if (pinned === null && window.gsap && window.ScrollTrigger) {
    gsap.registerPlugin(ScrollTrigger);
    ScrollTrigger.create({
      start: 0,
      end: "max",
      onUpdate: function (self) { targetAlt = self.progress * MAX_ALT; }
    });
  }

  /* ---------------- HUD wiring ---------------- */

  var altEl = document.getElementById("alt-value");
  var vsEl = document.getElementById("vs-value");
  var layerEl = document.getElementById("layer-value");
  var railMarker = document.getElementById("rail-marker");
  var railAlt = document.getElementById("rail-alt");
  var bands = document.querySelectorAll("#rail .band");
  var cards = [
    { el: document.getElementById("card-tropo"),  from: 2.5,  to: 11 },
    { el: document.getElementById("card-strato"), from: 12.6, to: 48.5 },
    { el: document.getElementById("card-meso"),   from: 50.6, to: 83.5 },
    { el: document.getElementById("card-thermo"), from: 85.6, to: 97.5 }
  ];
  var intro = document.getElementById("intro");
  var endpanel = document.getElementById("endpanel");
  var summaryTime = document.getElementById("summary-time");
  var lastAltTxt = "", lastVsTxt = "", lastLayerTxt = "", lastCard = -2, lastBand = -2, endShown = false;

  function layerIndex(alt) { return alt < 12 ? 0 : alt < 50 ? 1 : alt < 85 ? 2 : 3; }
  function layerName(alt) {
    if (alt >= 99.3) return "KARMAN LINE";
    return ["TROPOSPHERE", "STRATOSPHERE", "MESOSPHERE", "THERMOSPHERE"][layerIndex(alt)];
  }
  function fmtTime(ms) {
    var sec = Math.floor(ms / 1000);
    var m = String(Math.floor(sec / 60)).padStart(2, "0");
    var s = String(sec % 60).padStart(2, "0");
    return m + ":" + s;
  }

  document.getElementById("fly-again").addEventListener("click", function () {
    flightStarted = false;
    finalTime = null;
    window.scrollTo({ top: 0, behavior: REDUCED ? "auto" : "smooth" });
    if (pinned !== null) { targetAlt = 0; }
  });

  window.addEventListener("resize", function () {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  /* ---------------- Render loop ---------------- */

  var clock = new THREE.Clock();
  var elapsed = 0;

  function frame() {
    requestAnimationFrame(frame);
    var dt = Math.min(clock.getDelta(), 0.05);
    elapsed += dt;

    /* Fallback scroll read if ScrollTrigger failed to load. */
    if (pinned === null && !(window.gsap && window.ScrollTrigger)) {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      targetAlt = max > 0 ? (window.scrollY / max) * MAX_ALT : 0;
    }

    /* Inertia: exponential approach to the target altitude. */
    var k = 1 - Math.exp(-dt * (REDUCED ? 6 : 2.8));
    prevAlt = currentAlt;
    currentAlt += (targetAlt - currentAlt) * k;
    if (Math.abs(targetAlt - currentAlt) < 0.005) currentAlt = targetAlt;
    var vs = dt > 0 ? (currentAlt - prevAlt) / dt : 0; /* km per second */
    vsSmooth += (vs - vsSmooth) * (1 - Math.exp(-dt * 5));

    /* Flight timer. */
    if (!flightStarted && targetAlt > 0.3) {
      flightStarted = true;
      flightStartT = performance.now();
    }

    /* Sky, fog, light, stars follow altitude. */
    skyColorAt(currentAlt, skyNow);
    scene.fog.color.copy(skyNow);
    var starT = Math.min(1, Math.max(0, (currentAlt - 45) / 35));
    starMat.opacity = starT * starT * 0.95;
    hemi.intensity = 0.95 - 0.55 * (currentAlt / MAX_ALT);
    sun.intensity = 1.05 - 0.2 * (currentAlt / MAX_ALT);

    /* Glider pose: climb pitch, velocity bank, gentle float. */
    var floatAmp = REDUCED ? 0.25 : 1;
    glider.position.set(
      Math.sin(elapsed * 0.23) * 0.4,
      currentAlt + 0.4 + Math.sin(elapsed * 0.9) * 0.05 * floatAmp,
      0
    );
    var bank = Math.max(-0.32, Math.min(0.32, -vsSmooth * 0.09)) * (REDUCED ? 0.3 : 1);
    glider.rotation.z += (bank + Math.sin(elapsed * 0.6) * 0.02 * floatAmp - glider.rotation.z) * (1 - Math.exp(-dt * 4));
    glider.rotation.x = Math.max(-0.05, Math.min(0.2, vsSmooth * 0.045)) * (REDUCED ? 0.4 : 1);
    glider.rotation.y = Math.sin(elapsed * 0.4) * 0.03 * floatAmp;

    /* Camera rides behind and above, with a little lag. */
    var want = new THREE.Vector3(glider.position.x * 0.55, glider.position.y + 0.72, camZ());
    camPos.lerp(want, 1 - Math.exp(-dt * 4.5));
    camera.position.copy(camPos);
    var wantLook = new THREE.Vector3(glider.position.x * 0.8, glider.position.y + 0.45, -8);
    lookPt.lerp(wantLook, 1 - Math.exp(-dt * 4.5));
    camera.lookAt(lookPt);

    /* HUD numbers, written only when they change. */
    var altTxt = currentAlt.toFixed(1);
    if (altTxt !== lastAltTxt) {
      lastAltTxt = altTxt;
      altEl.textContent = altTxt;
      railAlt.textContent = altTxt;
      railMarker.style.bottom = (currentAlt / MAX_ALT * 100) + "%";
    }
    var vsTxt = (vsSmooth * 60).toFixed(1);
    if (vsTxt !== lastVsTxt) { lastVsTxt = vsTxt; vsEl.textContent = vsTxt; }
    var ln = layerName(currentAlt);
    if (ln !== lastLayerTxt) { lastLayerTxt = ln; layerEl.textContent = ln; }

    var bi = layerIndex(currentAlt);
    if (bi !== lastBand) {
      lastBand = bi;
      for (var b = 0; b < bands.length; b++) {
        bands[b].classList.toggle("active", (bands.length - 1 - b) === bi);
      }
    }

    var activeCard = -1;
    for (var ci = 0; ci < cards.length; ci++) {
      if (currentAlt >= cards[ci].from && currentAlt < cards[ci].to) activeCard = ci;
    }
    if (activeCard !== lastCard) {
      lastCard = activeCard;
      for (var cj = 0; cj < cards.length; cj++) {
        cards[cj].el.classList.toggle("on", cj === activeCard);
      }
    }

    /* Intro fades as the flight begins. */
    var introO = Math.max(0, 1 - currentAlt / 3.5);
    intro.style.opacity = introO.toFixed(3);
    intro.style.visibility = introO <= 0 ? "hidden" : "visible";

    /* End panel at the Karman line. */
    var showEnd = currentAlt >= 99.3;
    if (showEnd !== endShown) {
      endShown = showEnd;
      endpanel.classList.toggle("show", showEnd);
      endpanel.setAttribute("aria-hidden", showEnd ? "false" : "true");
      if (showEnd) {
        if (finalTime === null) {
          finalTime = flightStarted ? performance.now() - flightStartT : 0;
        }
        summaryTime.textContent = fmtTime(finalTime);
      }
    }

    renderer.render(scene, camera);
  }

  frame();
})();
