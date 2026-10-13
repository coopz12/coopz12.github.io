(function () {
  function fail() { var f = document.getElementById("gl-fallback"); if (f) { f.hidden = false; } }
  try {
    var b64 = (window.__T3 || []).join("");
    if (!b64 || typeof DecompressionStream !== "function") { fail(); return; }
    var bin = atob(b64);
    var bytes = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) { bytes[i] = bin.charCodeAt(i); }
    var stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
    new Response(stream).text().then(function (code) {
      (0, eval)(code);
      var s = document.createElement("script");
      s.src = "js/main.js";
      document.body.appendChild(s);
    }).catch(fail);
  } catch (e) { fail(); }
})();
