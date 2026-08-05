/* ==========================================================
   MASCOTA CHAT — asistente flotante "Oxxito"
   Widget autocontenido. Se inyecta solo al cargar la pagina.

   Responde con DATOS EN VIVO reusando los helpers compartidos
   de core.js (metrics*), que ya replican los filtros por
   defecto de cada dashboard. Asi los numeros que dice el
   chat coinciden con los que se ven en pantalla, en vez de
   recalcularse con criterios propios.

   No usa ningun servicio externo ni API key: todo el
   "cerebro" es deterministico y corre en el navegador.
   ========================================================== */
(function () {
  'use strict';

  if (window.__oxxoMascotaChat) return;
  window.__oxxoMascotaChat = true;

  // ── Ruta base del sitio (dashboards/ vs raiz) ──────────
  function basePath() {
    try {
      for (const s of document.getElementsByTagName('script')) {
        const src = s.getAttribute('src') || '';
        if (/(^|\/)js\/mascota-chat\.js(\?|$)/.test(src)) return src.replace(/js\/mascota-chat\.js.*$/, '');
      }
    } catch (e) {}
    return '';
  }
  const BASE = basePath();

  // ── Mascota ───────────────────────────────────────────
  // Perrito labrador con playera OXXO. Se dibuja en SVG para que
  // funcione sin depender de ningun archivo; si existe
  // assets/mascota-chat.png (la ilustracion oficial), se usa esa.
  const MASCOT_SVG = `
<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
  <path d="M11 100c0-19 17-31 39-31s39 12 39 31z" fill="#F71926"/>
  <path d="M50 83c-8 0-14-5-17-12 5-3 11-5 17-5s12 2 17 5c-3 7-9 12-17 12z" fill="#F2A52B"/>
  <ellipse cx="21" cy="45" rx="9" ry="16" fill="#D7A96B" transform="rotate(-14 21 45)"/>
  <ellipse cx="79" cy="45" rx="9" ry="16" fill="#D7A96B" transform="rotate(14 79 45)"/>
  <ellipse cx="50" cy="40" rx="24.5" ry="23" fill="#EFCE96"/>
  <ellipse cx="50" cy="50" rx="14" ry="11" fill="#F9E7C4"/>
  <ellipse cx="41.5" cy="35" rx="3.8" ry="4.4" fill="#4A342A"/>
  <ellipse cx="58.5" cy="35" rx="3.8" ry="4.4" fill="#4A342A"/>
  <circle cx="43" cy="33.5" r="1.4" fill="#fff"/>
  <circle cx="60" cy="33.5" r="1.4" fill="#fff"/>
  <ellipse cx="50" cy="45.5" rx="4.6" ry="3.5" fill="#4A342A"/>
  <path d="M50 49v3M50 52c0 2.4-2.2 3.9-4.5 3.9M50 52c0 2.4 2.2 3.9 4.5 3.9"
        stroke="#4A342A" stroke-width="1.7" stroke-linecap="round" fill="none"/>
</svg>`;

  function mascotMarkup() {
    // El <img> se oculta solo si el PNG no existe, dejando el SVG debajo.
    return `<img src="${BASE}assets/mascota-chat.png" alt=""
                 onerror="this.remove()"
                 style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover">
            ${MASCOT_SVG}`;
  }

  // ── Utilidades ────────────────────────────────────────
  const esc = (s) => String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

  const num = (n) => `<span class="mc-num">${esc(OXXO.formatNum ? OXXO.formatNum(n) : n)}</span>`;

  function norm(s) {
    return String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  }
  const has = (t, ...words) => words.some(w => t.includes(w));

  // Nombre corto para rankings ("Laura Alejandra Moreno Mayoral" -> "Laura Moreno")
  function shortName(full) {
    const raw = String(full || '').trim();
    // "Sin Asesor Asignado" no es una persona: acortarlo daba "Sin Asignado".
    if (norm(raw).includes('sin asesor')) return 'Sin asesor asignado';
    const p = raw.split(/\s+/);
    if (p.length <= 2) return p.join(' ');
    return `${p[0]} ${p[2] || p[1]}`;
  }

  // Etiqueta legible del periodo: "2026-08" -> "agosto 2026"; una fecha de
  // corte ("26/08/2026") se deja tal cual porque no es un mes completo.
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  function labelPeriodo(k) {
    const s = String(k || '').trim();
    const m = s.match(/^(\d{4})-(\d{2})$/);
    return m ? `${MESES[+m[2] - 1] || s} ${m[1]}` : s;
  }
  const esFechaCorte = (k) => /^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(String(k || '').trim());

  function rankBy(rows, nameFn, limit = 3) {
    const counts = new Map();
    rows.forEach(r => {
      const n = String(nameFn(r) || '').trim();
      if (!n) return;
      counts.set(n, (counts.get(n) || 0) + 1);
    });
    return [...counts.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
      .slice(0, limit);
  }

  const listHTML = (items) => `<ul>${items.map(i => `<li>${i}</li>`).join('')}</ul>`;

  // ── Directorio de dashboards ──────────────────────────
  const DASHBOARDS = [
    { file: 'dashboard-1.html', nombre: 'Vacantes Diarias',            kw: ['vacante', 'vacantes', 'posicion abierta', 'posiciones abiertas'] },
    { file: 'dashboard-2.html', nombre: 'Bajas Diarias',               kw: ['baja', 'bajas', 'rotacion', 'renuncia', 'renuncias', 'salida'] },
    { file: 'dashboard-3.html', nombre: 'Aprovechamiento de Estructura', kw: ['aprovechamiento', 'estructura', 'equipo completo', 'cobertura'] },
    { file: 'dashboard-4.html', nombre: 'Tiempo Extra',                kw: ['tiempo extra', 'horas extra', 'te', 'sobretiempo'] },
    { file: 'dashboard-5.html', nombre: 'Vacaciones',                  kw: ['vacacion', 'vacaciones', 'descanso'] },
    { file: 'dashboard-6.html', nombre: 'Ausentismos',                 kw: ['ausentismo', 'ausentismos', 'falta', 'faltas', 'inasistencia'] },
    { file: 'dashboard-7.html', nombre: 'Liberación de Estructuras',   kw: ['treo', 'liberacion', 'liberacion de estructuras', 'estructura p2'] },
  ];
  const linkTo = (d) => `<a href="${BASE}dashboards/${d.file}">${esc(d.nombre)}</a>`;

  // ── Capa de datos ─────────────────────────────────────
  // Cada funcion replica los filtros por defecto del dashboard
  // correspondiente usando los helpers compartidos de core.js.
  const cache = new Map();
  function once(key, fn) {
    if (!cache.has(key)) cache.set(key, fn().catch(() => null));
    return cache.get(key);
  }

  const K = (row, aliases) => OXXO.metricsFindKey(row, aliases);
  const V = (row, key) => OXXO.metricsVal(row, key);

  // Dashboard 1 · Vacantes (mismos defaults que dashboard-1.html)
  async function statsVacantes() {
    const raw = await OXXO.fetchSheetData(OXXO.SHEETS_CONFIG.TABS.d1);
    if (!raw || !raw.length) return null;
    const h = raw[0];
    const mesKey = K(h, ['Mes']), fechaKey = K(h, ['Fecha']);
    const puestoKey = K(h, ['Descripcion de Posicion', 'Puesto']);
    const asesorKey = K(h, ['Asesor']);
    const tiendaKey = K(h, ['Tienda', 'Unidad org']);
    const crKey = K(h, ['CR TIENDA', 'CR']);
    const diasKey = K(h, ['Dias Vacantes', 'Dias_Vacantes']);
    const cat = await OXXO.loadAsesorCatalog();

    let base = raw.filter(r => {
      const t = String(V(r, tiendaKey) || '').trim();
      return t && t !== 'Sin tienda';
    });
    base = base.filter(r => OXXO.isTiendaValid(cat, V(r, tiendaKey), V(r, crKey)))
      .map(r => { const copy={...r}; copy[asesorKey]=OXXO.resolveAsesorD1(cat,{cr:V(copy,crKey),tienda:V(copy,tiendaKey),asesor:V(copy,asesorKey)}); return copy; });
    base = OXXO.metricsApplyD1Defaults(base, { tiendaKey, asesorKey, puestoKey, diasKey });

    const { mes, rows } = OXXO.metricsFilterLatestMonth(base, r => OXXO.metricsRowMonthKeyD1(r, mesKey, fechaKey));
    const byPuesto = { Lider: 0, Encargado: 0, Ayudante: 0, Otro: 0 };
    rows.forEach(r => { byPuesto[OXXO.metricsTipoPuesto(V(r, puestoKey))]++; });
    // El asesor ya quedo resuelto (catalogo o Timoteo) en el paso de arriba;
    // volver a llamar resolveAsesor() aqui podia pisarlo por error si el
    // CR/tienda de la fila coincidia con otra entrada del catalogo.
    const rank = rankBy(rows, r => V(r, asesorKey));
    return { total: rows.length, mes, byPuesto, rank };
  }

  // Dashboard 2 · Bajas (mismos defaults que dashboard-2.html)
  async function statsBajas() {
    const raw = await OXXO.fetchSheetData(OXXO.SHEETS_CONFIG.TABS.d2);
    if (!raw || !raw.length) return null;
    const h = raw[0];
    const mesKey = K(h, ['Mes']), fechaKey = K(h, ['Fecha']);
    const asesorKey = K(h, ['Asesor']);
    const tiendaKey = K(h, ['Tienda']);
    const medidaKey = K(h, ['Denominación Medida', 'Denominacion Medida', 'Medida', 'Med.']);
    const plazaKey = K(h, ['Plaza']);
    const detalleKey = K(h, ['Detalle', 'Detalle de Baja']);
    const motivoKey = K(h, ['Motivo', 'Denominación Motivo', 'Denominacion Motivo']);
    const cat = await OXXO.loadAsesorCatalog();

    let base = raw.filter(r => {
      const a = String(V(r, asesorKey) || '').trim();
      return a && OXXO.metricsNormText(a).replace(/[^A-Z]/g, '') !== 'TIMOTEOANTONIOPEREZ';
    });
    base = OXXO.metricsFilterBajasD2(base, { medidaKey, plazaKey });

    const { mes, rows: rowsMes } = OXXO.metricsFilterLatestMonth(base, r => OXXO.metricsRowMonthKeyD2(r, mesKey, fechaKey));
    // dashboard-2.html arranca con defaultAsesorSelection(), que EXCLUYE
    // 'Sin Asesor Asignado' del total mostrado. Sin replicarlo, el chat
    // contaba esas bajas de mas (27 vs las 23 del KPI real).
    const conAsesor = rowsMes
      .map(r => ({ r, asesor: OXXO.resolveAsesor(cat, { tienda: V(r, tiendaKey), asesor: V(r, asesorKey) }) }))
      .filter(x => !norm(x.asesor).includes('sin asesor'));
    const rows = conAsesor.map(x => x.r);
    const rank = rankBy(conAsesor, x => x.asesor);
    const motivos = rankBy(rows, r => V(r, detalleKey) || V(r, motivoKey));
    return { total: rows.length, mes, rank, motivos };
  }

  // Dashboard 3 · Aprovechamiento (EC% = completas / total, semana vigente)
  async function statsEstructura() {
    const raw = await OXXO.fetchSheetData(OXXO.SHEETS_CONFIG.TABS.d3);
    if (!raw || !raw.length) return null;
    const h = raw[0];
    const estatusKey = K(h, ['Clas Aprov', 'Estatus', 'Estatus Con impacto Ausentismo', 'Estatus con impacto Ausentismo']);
    const semanaKey = K(h, ['Mes Semana', 'Semana', 'Fecha', 'FECHA']);
    const asesorKey = K(h, ['Asesor']);
    const tiendaKey = K(h, ['Tienda']);
    const crKey = K(h, ['CR TIENDA', 'CR']);
    const cat = await OXXO.loadAsesorCatalog();

    // Mismo criterio que dashboard-3.html: se muestra la ultima semana disponible.
    const semanas = [...new Set(raw.map(r => String(V(r, semanaKey) || '').trim()).filter(Boolean))].sort();
    const semana = semanas[semanas.length - 1] || '';
    const rows = semana ? raw.filter(r => String(V(r, semanaKey) || '').trim() === semana) : raw;

    let completas = 0, incompletas = 0, criticas = 0;
    const criticasPorAsesor = [];
    rows.forEach(r => {
      const c = OXXO.metricsClasificaAprovechamiento(V(r, estatusKey));
      if (c === 'completas') completas++;
      else if (c === 'incompletas') incompletas++;
      else if (c === 'criticas') { criticas++; criticasPorAsesor.push(r); }
    });
    const total = rows.length;
    const rankCriticas = rankBy(criticasPorAsesor, r => OXXO.resolveAsesor(cat, {
      cr: V(r, crKey), tienda: V(r, tiendaKey), asesor: V(r, asesorKey),
    }));
    return {
      total, completas, incompletas, criticas, semana,
      pct: total ? (completas / total) * 100 : 0,
      rankCriticas,
    };
  }

  // ── Respuestas ────────────────────────────────────────
  const D = (kw) => DASHBOARDS.find(d => d.kw.includes(kw)) || DASHBOARDS[0];
  const nota = (txt) => ({ note: txt });

  async function answerVacantes() {
    const s = await once('d1', statsVacantes);
    if (!s) return { html: 'No pude leer la base de Vacantes ahorita. Intenta de nuevo en un momento. 🐾' };
    const top = s.rank.map(r => `${esc(shortName(r.name))}: ${num(r.value)}`);
    return {
      html: `Ahorita hay ${num(s.total)} vacantes${s.mes ? (esFechaCorte(s.mes)
                ? ` al corte del <strong>${esc(s.mes)}</strong>`
                : ` en <strong>${esc(labelPeriodo(s.mes))}</strong>`) : ''}.<br>
             Por puesto: Líder ${num(s.byPuesto.Lider)} · Encargado ${num(s.byPuesto.Encargado)} · Ayudante ${num(s.byPuesto.Ayudante)}.
             ${top.length ? `<br>Quienes traen más:${listHTML(top)}` : ''}
             <br>Detalle en ${linkTo(D('vacantes'))} 👉`,
      ...nota('Con los filtros por defecto del dashboard (tiendas operativas, puestos base, +1 día).'),
    };
  }

  async function answerBajas() {
    const s = await once('d2', statsBajas);
    if (!s) return { html: 'No pude leer la base de Bajas ahorita. Intenta de nuevo en un momento. 🐾' };
    const top = s.rank.map(r => `${esc(shortName(r.name))}: ${num(r.value)}`);
    const mot = s.motivos.filter(m => m.name).map(m => `${esc(m.name)}: ${num(m.value)}`);
    return {
      html: `Van ${num(s.total)} bajas${s.mes ? (esFechaCorte(s.mes)
                ? ` al corte del <strong>${esc(s.mes)}</strong>`
                : ` en <strong>${esc(labelPeriodo(s.mes))}</strong>`) : ''}.
             ${top.length ? `<br>Por asesor:${listHTML(top)}` : ''}
             ${mot.length ? `Motivos más frecuentes:${listHTML(mot)}` : ''}
             Detalle en ${linkTo(D('bajas'))} 👉`,
      ...nota('Asesor asignado según el catálogo de tiendas vigente.'),
    };
  }

  async function answerEstructura() {
    const s = await once('d3', statsEstructura);
    if (!s) return { html: 'No pude leer la base de Estructura ahorita. Intenta de nuevo en un momento. 🐾' };
    const top = s.rankCriticas.map(r => `${esc(shortName(r.name))}: ${num(r.value)}`);
    return {
      html: `El aprovechamiento general va en <strong>${esc(s.pct.toFixed(1))}%</strong>${s.semana ? ` (${esc(s.semana)})` : ''}.<br>
             De ${num(s.total)} tiendas: ${num(s.completas)} completas · ${num(s.incompletas)} incompletas · ${num(s.criticas)} críticas.
             ${top.length ? `<br>Críticas por asesor:${listHTML(top)}` : ''}
             <br>Detalle en ${linkTo(D('aprovechamiento'))} 👉`,
      ...nota('EC% = tiendas con equipo completo ÷ total de tiendas.'),
    };
  }

  // ¿Quien lleva tal tienda? — se resuelve con el catalogo oficial
  async function answerTienda(query) {
    const cat = await OXXO.loadAsesorCatalog();
    if (!cat || !cat.rows || !cat.rows.length) return null;
    const q = norm(query).replace(/\b(oxxo|tienda|la|el|de|del|quien|lleva|atiende|asesor|es|cual|que|tiene|a)\b/g, ' ').replace(/\s+/g, ' ').trim();
    if (q.length < 3) return null;
    const hits = cat.rows.filter(r => r.asesor && norm(r.tienda).includes(q)).slice(0, 6);
    if (!hits.length) return null;
    if (hits.length === 1) {
      const h = hits[0];
      return {
        html: `<strong>${esc(h.tienda)}</strong> (CR ${esc(h.cr)}) la lleva <strong>${esc(h.asesor)}</strong>. 🐕`,
        ...nota('Fuente: catálogo de asesores vigente (archivo Estructura).'),
      };
    }
    return {
      html: `Encontré varias tiendas:${listHTML(hits.map(h => `<strong>${esc(h.tienda)}</strong> → ${esc(h.asesor)}`))}`,
      ...nota('Fuente: catálogo de asesores vigente (archivo Estructura).'),
    };
  }

  // ¿Que tiendas tiene tal asesor?
  async function answerAsesor(query) {
    const cat = await OXXO.loadAsesorCatalog();
    if (!cat || !cat.rows || !cat.rows.length) return null;
    const q = norm(query).replace(/\b(que|cuales|cuantas|tiendas|tiene|trae|lleva|asesor|de|del|la|el|a|maneja)\b/g, ' ').replace(/\s+/g, ' ').trim();
    if (q.length < 3) return null;
    const asesores = [...new Set(cat.rows.map(r => r.asesor).filter(Boolean))];
    const match = asesores.find(a => {
      const n = norm(a);
      return q.split(' ').some(tok => tok.length >= 3 && n.includes(tok));
    });
    if (!match) return null;
    const tiendas = cat.rows.filter(r => r.asesor === match);
    return {
      html: `<strong>${esc(match)}</strong> tiene ${num(tiendas.length)} tiendas asignadas.<br>
             Algunas:${listHTML(tiendas.slice(0, 5).map(t => esc(t.tienda)))}`,
      ...nota('Fuente: catálogo de asesores vigente (archivo Estructura).'),
    };
  }

  const AYUDA = {
    html: `¡Claro! Te puedo ayudar con:${listHTML([
      'Números en vivo de <strong>vacantes</strong>, <strong>bajas</strong> y <strong>aprovechamiento</strong>',
      'Quién es el <strong>asesor de una tienda</strong> (ej. «¿quién lleva Puerto Escondido?»)',
      'Qué <strong>tiendas trae un asesor</strong>',
      'Llevarte al dashboard que necesites',
    ])}`,
  };

  const CHIPS = ['¿Cuántas vacantes hay?', '¿Cómo van las bajas?', 'Aprovechamiento', '¿Qué puedes hacer?'];

  // ── Router de intenciones ─────────────────────────────
  async function responder(textoUsuario) {
    const t = norm(textoUsuario);
    if (!t) return { html: '¿Me repites? 🐾' };

    if (has(t, 'gracias', 'gracias')) return { html: '¡Con gusto! Aquí ando si necesitas otra cosa. 🐾' };
    if (/^(hola|buenas|buenos dias|buen dia|hey|que onda|holi)\b/.test(t) && t.length < 25) {
      return { html: '¡Hola! 👋 Soy Oxxito. Pregúntame por vacantes, bajas, aprovechamiento o por el asesor de alguna tienda.' };
    }
    if (has(t, 'que puedes hacer', 'que haces', 'ayuda', 'ayudame', 'opciones', 'menu')) return AYUDA;

    // Consultas de catalogo (tienda / asesor) antes que las metricas,
    // porque son mas especificas.
    if (has(t, 'quien lleva', 'quien atiende', 'asesor de', 'de quien es', 'quien tiene')) {
      const r = await answerTienda(textoUsuario);
      if (r) return r;
    }
    if (has(t, 'tiendas') && has(t, 'tiene', 'trae', 'lleva', 'maneja', 'cuantas', 'cuales')) {
      const r = await answerAsesor(textoUsuario);
      if (r) return r;
    }

    // Metricas
    if (has(t, 'vacante', 'vacantes', 'posicion abierta', 'posiciones abiertas')) return answerVacantes();
    if (has(t, 'baja', 'bajas', 'rotacion', 'renuncia')) return answerBajas();
    if (has(t, 'aprovechamiento', 'estructura', 'equipo completo', 'ec ', 'cobertura')) return answerEstructura();

    // Navegacion
    const dash = DASHBOARDS.find(d => d.kw.some(k => t.includes(k)));
    if (dash) return { html: `Eso lo ves en ${linkTo(dash)} 👉` };
    if (has(t, 'dashboard', 'donde veo', 'llevame', 'abrir', 'link', 'liga')) {
      return { html: `Estos son los dashboards:${listHTML(DASHBOARDS.map(linkTo))}` };
    }

    // Ultimo intento: quiza menciono una tienda o un asesor sin frase clave
    const rt = await answerTienda(textoUsuario);
    if (rt) return rt;
    const ra = await answerAsesor(textoUsuario);
    if (ra) return ra;

    return {
      html: `Uy, esa no me la sé todavía. 🐶 Prueba con «cuántas vacantes hay», «cómo van las bajas», «aprovechamiento» o «quién lleva <em>tal tienda</em>».`,
    };
  }

  // ── UI ────────────────────────────────────────────────
  const PEEK_KEY = 'oxxo-mascota-visto';
  let abierto = false, ocupado = false;

  const root = document.createElement('div');
  root.className = 'mc-root';
  root.innerHTML = `
    <div class="mc-panel" id="mc-panel" role="dialog" aria-modal="false" aria-label="Asistente Oxxito" hidden>
      <div class="mc-header">
        <div class="mc-header__avatar" style="position:relative">${mascotMarkup()}</div>
        <div class="mc-header__meta">
          <div class="mc-header__name">Oxxito</div>
          <div class="mc-header__status">Aquí para ayudarte</div>
        </div>
        <button class="mc-header__close" id="mc-close" type="button" aria-label="Cerrar chat">✕</button>
      </div>
      <div class="mc-log" id="mc-log" role="log" aria-live="polite"></div>
      <div class="mc-chips" id="mc-chips"></div>
      <form class="mc-form" id="mc-form">
        <input class="mc-input" id="mc-input" type="text" autocomplete="off"
               placeholder="Pregúntame algo..." aria-label="Escribe tu pregunta">
        <button class="mc-send" id="mc-send" type="submit" aria-label="Enviar">
          <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor" aria-hidden="true">
            <path d="M2.5 21 23 12 2.5 3 2.5 10l14 2-14 2z"/>
          </svg>
        </button>
      </form>
    </div>
    <div class="mc-launcher-wrap">
      <div class="mc-peek" id="mc-peek" hidden>
        ¡Hola! Soy <strong>Oxxito</strong> 🐶 ¿Te ayudo con los números de hoy?
        <button class="mc-peek__close" id="mc-peek-close" type="button" aria-label="Cerrar aviso">✕</button>
      </div>
      <button class="mc-launcher" id="mc-launcher" type="button"
              aria-label="Abrir asistente Oxxito" aria-expanded="false" aria-controls="mc-panel"
              style="position:relative">${mascotMarkup()}</button>
    </div>
  `;

  function mount() {
    document.body.appendChild(root);

    const panel = root.querySelector('#mc-panel');
    const log = root.querySelector('#mc-log');
    const chips = root.querySelector('#mc-chips');
    const form = root.querySelector('#mc-form');
    const input = root.querySelector('#mc-input');
    const send = root.querySelector('#mc-send');
    const launcher = root.querySelector('#mc-launcher');
    const peek = root.querySelector('#mc-peek');

    function scroll() { log.scrollTop = log.scrollHeight; }

    function addBot(html, note) {
      const wrap = document.createElement('div');
      const msg = document.createElement('div');
      msg.className = 'mc-msg';
      msg.innerHTML = `<div class="mc-msg__avatar" style="position:relative">${mascotMarkup()}</div>
                       <div class="mc-msg__bubble">${html}</div>`;
      wrap.appendChild(msg);
      if (note) {
        const n = document.createElement('div');
        n.className = 'mc-note';
        n.textContent = note;
        wrap.appendChild(n);
      }
      log.appendChild(wrap);
      scroll();
    }

    function addUser(text) {
      const msg = document.createElement('div');
      msg.className = 'mc-msg mc-msg--user';
      const bubble = document.createElement('div');
      bubble.className = 'mc-msg__bubble';
      bubble.textContent = text;           // texto del usuario: nunca como HTML
      msg.appendChild(bubble);
      log.appendChild(msg);
      scroll();
    }

    function showTyping() {
      const msg = document.createElement('div');
      msg.className = 'mc-msg';
      msg.id = 'mc-typing';
      msg.innerHTML = `<div class="mc-msg__avatar" style="position:relative">${mascotMarkup()}</div>
                       <div class="mc-msg__bubble"><div class="mc-typing"><span></span><span></span><span></span></div></div>`;
      log.appendChild(msg);
      scroll();
    }
    const hideTyping = () => root.querySelector('#mc-typing')?.remove();

    function renderChips() {
      chips.innerHTML = '';
      CHIPS.forEach(c => {
        const b = document.createElement('button');
        b.className = 'mc-chip';
        b.type = 'button';
        b.textContent = c;
        b.addEventListener('click', () => enviar(c));
        chips.appendChild(b);
      });
    }

    async function enviar(texto) {
      const t = String(texto || '').trim();
      if (!t || ocupado) return;
      ocupado = true;
      send.disabled = true;
      addUser(t);
      input.value = '';
      showTyping();
      let res;
      try {
        res = await responder(t);
      } catch (e) {
        console.warn('[Oxxito]', e);
        res = { html: 'Se me atravesó un error consultando los datos. ¿Lo intentamos otra vez? 🐾' };
      }
      // Pequena pausa para que se alcance a ver el "escribiendo..."
      await new Promise(r => setTimeout(r, 260));
      hideTyping();
      addBot(res.html, res.note);
      ocupado = false;
      send.disabled = false;
      if (abierto) input.focus();
    }

    function abrir() {
      abierto = true;
      panel.hidden = false;
      launcher.setAttribute('aria-expanded', 'true');
      peek.hidden = true;
      try { localStorage.setItem(PEEK_KEY, '1'); } catch (e) {}
      if (!log.childElementCount) {
        addBot('¡Hola! 👋 Soy <strong>Oxxito</strong>, tu asistente de los dashboards.<br>Puedo darte los números de hoy o decirte quién lleva una tienda.');
        renderChips();
      }
      setTimeout(() => input.focus(), 60);
    }

    function cerrar() {
      abierto = false;
      panel.hidden = true;
      launcher.setAttribute('aria-expanded', 'false');
      launcher.focus();
    }

    launcher.addEventListener('click', () => (abierto ? cerrar() : abrir()));
    root.querySelector('#mc-close').addEventListener('click', cerrar);
    root.querySelector('#mc-peek-close').addEventListener('click', (e) => {
      e.stopPropagation();
      peek.hidden = true;
      try { localStorage.setItem(PEEK_KEY, '1'); } catch (e2) {}
    });
    form.addEventListener('submit', (e) => { e.preventDefault(); enviar(input.value); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && abierto) cerrar(); });

    // Saludo inicial solo la primera vez que se visita el sitio
    let visto = '1';
    try { visto = localStorage.getItem(PEEK_KEY); } catch (e) {}
    if (!visto) setTimeout(() => { if (!abierto) peek.hidden = false; }, 1400);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mount, { once: true });
  } else {
    mount();
  }
})();
