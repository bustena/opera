/* =================== Estado =================== */
let indice = 0;
let datos = [];
let solucionMostrada = [];
let audioGlobal = new Audio();
let modoJuego = "";            // 'solitario' | 'mesa'
let puntos = 0, racha = 0, rachaMax = 0;

/* =================== CSV URLs =================== */
const OBRAS_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQrioQKwGSHMHsy9dQr37uk1xCFZC8vhIKDXepOtNEM_efmPwpe5ROmksO0fu_ZmHlxPUskuXu4rmCw/pub?gid=0&single=true&output=csv";

const PERIODOS_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQrioQKwGSHMHsy9dQr37uk1xCFZC8vhIKDXepOtNEM_efmPwpe5ROmksO0fu_ZmHlxPUskuXu4rmCw/pub?gid=7579083&single=true&output=csv";

/* ===== Fallback PERIODOS (si P_sacra fallase) ===== */
let PERIODOS = [
  { hex: "#5ca8d6", label: "Edad Media y Renacimiento (-1500)", desc: "Canto llano, polifonías primitivas, ars antiqua, ars nova y escuela flamenca.", orden: 1 },
  { hex: "#f9c623", label: "Renacimiento y Barroco temprano (1500-1640)", desc: "Edad de Oro de la polifonía. Desde Josquin hasta la escuela policoral de Venecia", orden: 2 },
  { hex: "#e06464", label: "Barroco tardío (1640-1750)", desc: "La era del bajo continuo y de los primeros desarrollos de la música orquestal.", orden: 3 },
  { hex: "#26b98f", label: "Periodo clásico-romántico (1750-1920)", desc: "Desde Mozart hasta Lili Boulanger. Edad de Oro de la música orquestal. La música sacra como música de concierto.", orden: 4 },
  { hex: "#c87ab0", label: "Siglos XX y XXI (1920-)", desc: "Desde Francis Poulenc hasta nuestros días. Amplio rango estilístico, desde la inspiración popular a la vanguardia.", orden: 5 }
];

/* =================== Boot =================== */
window.onload = async () => {
  try {
    // OBRAS
    const csvObras = await fetchText(OBRAS_CSV_URL);
    const pObras = Papa.parse(csvObras, { header: true, skipEmptyLines: true, delimiter: ",", quoteChar: '"' });

    datos = pObras.data.map(f => ({
      año:   f["año"],
      autor: f["autor"],
      obra:  f["obra"],
      audio: f["audio"],
      color: (f["color"] || "").toLowerCase().trim(),
      imagen:f["imagen"],
      texto: f["texto"]
    })).filter(x => x && (x.audio || x.imagen || x.autor || x.obra));

    if (!datos.length) throw new Error("No hay filas válidas en 'obras'.");

    // Barajar y guardar copia base (antes de limitar por modo)
    datos.sort(() => Math.random() - 0.5);
    solucionMostrada = new Array(datos.length).fill(false);
    window._datosBase = datos.slice();

    // PERIODOS (P_sacra)
    try {
      const csvPer = await fetchText(PERIODOS_CSV_URL);
      const pPer = Papa.parse(csvPer, { header: true, skipEmptyLines: true, delimiter: ",", quoteChar: '"' });
      const arr = pPer.data
        .map(r => ({
          hex:   (r["color"] || "").toLowerCase().trim(),
          label: (r["etiqueta"] || "").trim(),
          desc:  (r["descripcion"] || "").trim(),
          orden: Number(r["orden"] || 0)
        }))
        .filter(x => x.hex && x.label);

      if (arr.length >= 5) PERIODOS = arr.sort((a,b) => (a.orden||0) - (b.orden||0));
    } catch (e) {
      console.warn("No se pudo cargar 'P_sacra'; usando PERIODOS por defecto.", e);
    }

    inicializarLeyendaDesdePeriodos();
  } catch (err) {
    console.error("Error inicializando:", err);
    const carg = document.getElementById("cargando");
    if (carg) {
      carg.innerHTML = `<p><strong>Error cargando datos</strong></p>
        <p style="max-width:700px;margin:0 auto;">${err?.message || "Revisa la consola para más detalles."}</p>`;
    }
  } finally {
    document.getElementById("cargando")?.classList.add("hidden");
    document.getElementById("menuModos")?.classList.remove("hidden");
    window.focus();
    document.addEventListener("keydown", onKey);
  }
};

/* =================== Utils =================== */
async function fetchText(url) {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`HTTP ${r.status} en ${url}`);
  return r.text();
}

function onKey(e) {
  if (document.activeElement && ["INPUT","TEXTAREA","BUTTON"].includes(document.activeElement.tagName)) return;
  const key = e.key;
  if (key === "ArrowRight") {
    const btnNext = document.getElementById("btnSiguiente");
    if (btnNext && btnNext.offsetParent !== null) siguiente();
  } else if (key === "ArrowLeft") {
    const btnPrev = document.getElementById("btnAnterior");
    if (btnPrev && btnPrev.offsetParent !== null) anterior();
  } else if (key === "Enter" && modoJuego === "mesa") {
    const btnSol = document.getElementById("btnSolucion");
    if (btnSol && btnSol.offsetParent !== null) mostrarSolucion();
  } else if (key === " ") {
    e.preventDefault();
    if (!audioGlobal) return;
    if (audioGlobal.paused) audioGlobal.play(); else audioGlobal.pause();
  } else if (modoJuego === "solitario" && ["1","2","3","4","5"].includes(key)) {
    const idx = parseInt(key) - 1;
    const opciones = getLeyendaBotones();
    if (opciones[idx] && opciones[idx].disabled === false) opciones[idx].click();
  }
}

function abrirReglas() {
  const URL_REGLAS = "https://bustena.wordpress.com/historia-de-la-musica-apps-para-aprender-jugando/";
  window.open(URL_REGLAS, "_blank");
}

/* =================== Modos =================== */
function seleccionarModo(modo) {
  modoJuego = modo;
  document.getElementById("menuModos").classList.add("hidden");
  document.getElementById("contenido").classList.remove("hidden");

  // Limitar número de audiciones según modo
  const limite = (modoJuego === "solitario") ? 10 : 30;
  if (!window._datosBase) window._datosBase = datos.slice();
  datos = window._datosBase.slice(0, limite);
  solucionMostrada = new Array(datos.length).fill(false);
  indice = 0;

  if (modoJuego === "solitario") {
    puntos = 0; racha = 0; rachaMax = 0; pintarMarcadores();
    document.getElementById("marcadores").style.display = "block";
    document.getElementById("botonSolucion").classList.add("hidden");
  } else {
    document.getElementById("marcadores").style.display = "none";
    document.getElementById("botonSolucion").classList.remove("hidden");
  }

  // En ambos modos, botón de pista siempre visible
  const pw = document.getElementById("pista-wrap");
  if (pw) {
    pw.classList.remove("hidden");
    pw.style.display = ""; // deja que el CSS (display:flex) actúe
  }

  mostrar();
}

/* =================== Leyenda (filas + info) =================== */
function getLeyendaRows() {
  return Array.from(document.querySelectorAll("#leyenda .leyenda-row"));
}
function getLeyendaBotones() {
  return Array.from(document.querySelectorAll("#leyenda .leyenda-item"));
}
function closeAllInfoPanels() {
  getLeyendaRows().forEach((row) => {
    const panel = row.querySelector(".info-panel");
    const infoBtn = row.querySelector(".info-btn");
    if (panel) panel.classList.add("hidden");
    if (infoBtn) infoBtn.setAttribute("aria-expanded", "false");
  });
}

function inicializarLeyendaDesdePeriodos() {
  const rows = getLeyendaRows();
  const n = Math.min(rows.length, PERIODOS.length);
  for (let i = 0; i < n; i++) {
    const row   = rows[i];
    const p     = PERIODOS[i];
    const btn   = row.querySelector(".leyenda-item");
    const punto = row.querySelector(".punto");
    const txt   = row.querySelector(".leyenda-txt");
    const info  = row.querySelector(".info-btn");
    const panel = row.querySelector(".info-panel");

    if (!btn || !p) continue;
    btn.dataset.hex = (p.hex || "").toLowerCase().trim();
    if (punto) punto.style.background = p.hex;
    if (txt)   txt.textContent = p.label;
    if (panel) panel.textContent = ""; // cerrado al inicio

    if (info) {
      info.onclick = (ev) => {
        ev.stopPropagation(); // no responder
        toggleInfoPanel(row, p.desc || "");
      };
      info.onkeydown = (ev) => {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          toggleInfoPanel(row, p.desc || "");
        }
      };
      info.setAttribute("title", "Información del periodo");
      info.setAttribute("aria-expanded", "false");
      if (panel && panel.id) info.setAttribute("aria-controls", panel.id);
    }
  }

  // Pista
  const btnPista = document.getElementById("btnPista");
  if (btnPista) btnPista.onclick = togglePista;
}

function toggleInfoPanel(rowEl, text) {
  const panel = rowEl.querySelector(".info-panel");
  const infoBtn = rowEl.querySelector(".info-btn");
  if (!panel || !infoBtn) return;

  const isOpen = !panel.classList.contains("hidden");
  // cerrar todas
  closeAllInfoPanels();

  if (!isOpen) {
    panel.textContent = text || "—";
    panel.classList.remove("hidden");
    infoBtn.setAttribute("aria-expanded", "true");
  } else {
    panel.classList.add("hidden");
    infoBtn.setAttribute("aria-expanded", "false");
  }
}

/* =================== Pista =================== */
function togglePista(e) {
  if (e) e.stopPropagation();
  const wrap = document.getElementById("pista-wrap");
  const box  = document.getElementById("pistaBox");
  if (!datos.length || !wrap || !box) return;

  const txt = (datos[indice].texto || "").trim();

  if (box.classList.contains("hidden")) {
    // Mostrar pista
    box.textContent = txt || "—";
    wrap.classList.remove("hidden");
    // Fuerza layout centrado aunque algún estilo lo pise
    wrap.style.display = "flex";
    wrap.style.alignItems = "center";
    wrap.style.justifyContent = "center";

    box.classList.remove("hidden");
    box.style.display = ""; // deja que el CSS gobierne
  } else {
    // Ocultar pista
    box.classList.add("hidden");
    box.style.display = "none";
    box.textContent = "";
    // Mantén el contenedor visible y centrado para el botón
    wrap.classList.remove("hidden");
    wrap.style.display = "flex";
    wrap.style.alignItems = "center";
    wrap.style.justifyContent = "center";
  }
}

/* =================== Render por obra =================== */
function mostrar() {
  if (!datos.length) return;

  const item = datos[indice];
  const titulo   = document.getElementById("titulo");
  const detalles = document.getElementById("detalles");
  const leyenda  = document.getElementById("leyenda");
  const botones  = document.getElementById("botones");
  const feedback = document.getElementById("feedback");
  const img      = document.getElementById("imagen");
  const textoExtra = document.getElementById("texto-extra");

  // >>> contador N / TOTAL
  const total = datos.length;
  titulo.textContent = `Audición ${indice + 1} / ${total}`;

  feedback.textContent = "";
  feedback.style.color = "#000";
  feedback.style.fontWeight = "700";

  botones.style.display = "none";
  document.body.style.backgroundColor = "#dcdcdc";

  // Cerrar pista
  const pistaBox = document.getElementById("pistaBox");
  if (pistaBox) { pistaBox.classList.add("hidden"); pistaBox.style.display = "none"; pistaBox.textContent = ""; }

  // Mostrar leyenda / ocultar ficha
  leyenda.style.display = "flex";
  if (modoJuego === "mesa") leyenda.classList.add("modo-mesa"); else leyenda.classList.remove("modo-mesa");
  detalles.style.display = "none";
  detalles.classList.add("invisible");

  // Cerrar todas las infos
  closeAllInfoPanels();

  // Preparar leyenda según modo
  prepararLeyendaParaModo();

  // Limpiar ficha
  document.getElementById("anio").textContent = "";
  document.getElementById("descripcion").textContent = "";
  img.classList.add("hidden"); img.removeAttribute("src"); img.alt = "";
  textoExtra.textContent = ""; textoExtra.classList.add("hidden");

  // Audio
  prepararAudio(item.audio);

  // Si ya estaba la solución (al volver atrás)
  if (solucionMostrada[indice]) {
    rellenarFicha(item);
    if (modoJuego === "solitario") leyenda.style.display = "none";
    detalles.style.display = "flex";
    detalles.classList.remove("invisible");
    if (item.color) document.body.style.backgroundColor = item.color;
    botones.style.display = "flex";
  }
}

function mostrarSolucion() { // Modo MESA
  if (!datos.length) return;
  const item = datos[indice];
  solucionMostrada[indice] = true;

  const detalles = document.getElementById("detalles");
  rellenarFicha(item);

  detalles.style.display = "flex";
  detalles.classList.remove("invisible");

  if (item.color) document.body.style.backgroundColor = item.color;
  document.getElementById("botones").style.display = "flex";

  if (modoJuego === "mesa") {
    document.getElementById("botonSolucion").classList.add("hidden");
    document.getElementById("leyenda").style.display = "none";
  }
}

function siguiente() {
  if (indice < datos.length - 1) {
    indice++;
    if (modoJuego === "mesa") document.getElementById("botonSolucion").classList.remove("hidden");
    mostrar();
  } else {
    document.getElementById("botones").style.display = "none";
    document.getElementById("reinicio").classList.remove("hidden");
  }
}

function anterior() {
  if (indice > 0) {
    indice--;
    if (modoJuego === "mesa") document.getElementById("botonSolucion").classList.add("hidden");
    mostrar();
  }
}

/* =================== Solitario (respuesta) =================== */
function onElegirColorSolitario(e) {
  const btn = e.currentTarget;
  if (btn.disabled) return;
  if (solucionMostrada[indice]) return;

  const elegido  = (btn.dataset.hex || "").toLowerCase().trim();
  const correcto = (datos[indice].color || "").toLowerCase().trim();
  const ok = (elegido === correcto);

  if (ok) { puntos++; racha++; if (racha > rachaMax) rachaMax = racha; }
  else { racha = 0; }
  pintarMarcadores();

  marcarLeyendaTrasRespuesta(correcto, elegido, ok);

  const fb = document.getElementById("feedback");
  fb.textContent = ok ? "✔ ¡Correcto!" : "✖ Incorrecto";
  fb.style.color = "#000";
  fb.style.fontWeight = "700";

  solucionMostrada[indice] = true;
  rellenarFicha(datos[indice]);
  document.getElementById("leyenda").style.display = "none";
  const detalles = document.getElementById("detalles");
  detalles.style.display = "flex";
  detalles.classList.remove("invisible");
  if (datos[indice].color) document.body.style.backgroundColor = datos[indice].color;
  document.getElementById("botones").style.display = "flex";
}

function prepararLeyendaParaModo() {
  const leyendaBox = document.getElementById("leyenda");
  const botones = getLeyendaBotones();

  // reset
  botones.forEach((b) => {
    b.disabled = false;
    b.classList.remove("is-correct", "is-wrong");
    b.style.boxShadow = "none";
    b.onclick = null;
    b.setAttribute("title", b.querySelector(".leyenda-txt")?.textContent || "");
  });

  if (modoJuego === "solitario") {
    leyendaBox.classList.remove("modo-mesa");
    botones.forEach((b) => { b.onclick = onElegirColorSolitario; });
    document.getElementById("marcadores").style.display = "block";
  } else {
    leyendaBox.classList.add("modo-mesa");
    botones.forEach((b) => { b.onclick = null; });
    document.getElementById("marcadores").style.display = "none";
  }

  // Botón de pista visible en ambos modos (deja que el CSS aplique display:flex)
  const pw = document.getElementById("pista-wrap");
  if (pw) {
    pw.classList.remove("hidden");
    pw.style.display = ""; // no pisar el display:flex del CSS
  }
}

function marcarLeyendaTrasRespuesta(hexCorrecto, hexElegido, acierto) {
  const botones = getLeyendaBotones();
  botones.forEach(b => b.disabled = true);

  const elegidoBtn = botones.find(b => (b.dataset.hex || "").toLowerCase().trim() === hexElegido);
  if (elegidoBtn) {
    elegidoBtn.classList.add(acierto ? "is-correct" : "is-wrong");
    elegidoBtn.style.boxShadow = acierto ? "0 0 0 3px rgba(26,127,55,.4)" : "0 0 0 3px rgba(180,35,45,.4)";
  }
  if (!acierto) {
    const correctoBtn = botones.find(b => (b.dataset.hex || "").toLowerCase().trim() === hexCorrecto);
    if (correctoBtn) {
      correctoBtn.classList.add("is-correct");
      correctoBtn.style.boxShadow = "0 0 0 3px rgba(26,127,55,.4)";
    }
  }
}

/* =================== Audio =================== */
function prepararAudio(url) {
  const contc = document.getElementById("audio-container");
  contc.innerHTML = "";
  audioGlobal.src = url || "";
  audioGlobal.currentTime = 0;
  audioGlobal.play().catch(() => {});

  const cont = document.createElement("div");
  cont.className = "custom-audio-controls";
  cont.innerHTML = `
    <button id="btnRew" class="audio-btn" title="⟲ -5s"><i data-lucide="rewind"></i></button>
    <button id="btnPlayPause" class="audio-btn" title="Play/Pause"><i data-lucide="pause"></i></button>
    <button id="btnFf" class="audio-btn" title="⟳ +5s"><i data-lucide="fast-forward"></i></button>
  `;
  contc.appendChild(cont);
  if (window.lucide) lucide.createIcons();

  document.getElementById("btnRew").onclick = () => { audioGlobal.currentTime = Math.max(0, audioGlobal.currentTime - 5); };
  document.getElementById("btnFf").onclick = () => { audioGlobal.currentTime = Math.min(audioGlobal.duration || 0, audioGlobal.currentTime + 5); };
  document.getElementById("btnPlayPause").onclick = () => {
    const boton = document.getElementById("btnPlayPause");
    if (audioGlobal.paused) {
      audioGlobal.play().then(() => { boton.innerHTML = '<i data-lucide="pause"></i>'; if (window.lucide) lucide.createIcons(); });
    } else {
      audioGlobal.pause();
      boton.innerHTML = '<i data-lucide="play"></i>'; if (window.lucide) lucide.createIcons();
    }
  };
  audioGlobal.onpause = () => { const b = document.getElementById("btnPlayPause"); if (b) { b.innerHTML = '<i data-lucide="play"></i>'; if (window.lucide) lucide.createIcons(); } };
  audioGlobal.onplay  = () => { const b = document.getElementById("btnPlayPause"); if (b) { b.innerHTML = '<i data-lucide="pause"></i>'; if (window.lucide) lucide.createIcons(); } };
}

/* =================== Ficha =================== */
function rellenarFicha(item) {
  document.getElementById("anio").textContent = item.año || "";
  document.getElementById("descripcion").innerHTML = `<strong>${item.autor || ""}</strong><br>${item.obra || ""}`;

  const img = document.getElementById("imagen");
  img.classList.add("hidden");
  img.removeAttribute("src"); img.alt = "";
  img.onload = () => img.classList.remove("hidden");
  if (item.imagen && item.imagen.trim() !== "") { img.src = item.imagen; img.alt = item.obra || ""; }

  const textoExtra = document.getElementById("texto-extra");
  if (item.texto && item.texto.trim() !== "") { textoExtra.textContent = item.texto; textoExtra.classList.remove("hidden"); }
  else { textoExtra.textContent = ""; textoExtra.classList.add("hidden"); }

  document.getElementById("botones").style.display = "flex";
}

function pintarMarcadores() {
  document.getElementById("puntos").textContent = puntos;
  document.getElementById("racha").textContent = racha;
  document.getElementById("rachaMax").textContent = rachaMax;
}
