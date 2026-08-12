/* ==========================================================
   OXXO SITE LOCK — candado de acceso para todo el sitio publico
   (index + los 8 dashboards + Mi Dashboard + Mi Tienda; admin.html
   ya tiene su propio candado independiente, no usa este archivo).

   No es un login por persona ni seguridad real de servidor -- el
   sitio sigue siendo estatico y de solo lectura contra Google
   Sheets, asi que cualquiera con suficiente empeño (F12 + editar
   localStorage, o revisar este archivo) puede saltarselo. Es un
   filtro para que alguien que solo tiene el link NO vea de entrada
   los datos, no una barrera a prueba de un atacante decidido.

   Cada pagina protegida trae, ANTES de este script, un snippet
   inline que agrega la clase "oxxo-locked" a <html> si el
   navegador no tiene la bandera de desbloqueo guardada -- eso
   oculta el contenido real desde el primer render (sin flash de
   datos) mientras este archivo carga y decide si mostrar el
   candado o quitar la clase.
   ========================================================== */
(function () {
  'use strict';

  // SHA-256 de la contrasena compartida (no se guarda en texto plano
  // aqui). Cambiar la contrasena = recalcular este hash y reemplazarlo;
  // no hace falta tocar ninguna otra pagina, todas cargan este mismo
  // archivo.
  const PASSWORD_HASH = '605f8268258e5ce442f36be1e588960a3a11a38aa7aad44b87476e17810c3b74';
  const FLAG_KEY = 'oxxo_site_unlocked';

  async function sha256Hex(text) {
    const buffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  function unlock() {
    try { localStorage.setItem(FLAG_KEY, '1'); } catch (_) {}
    document.documentElement.classList.remove('oxxo-locked');
    const overlay = document.getElementById('oxxo-lock-overlay');
    if (overlay) overlay.remove();
  }

  function isUnlocked() {
    try { return localStorage.getItem(FLAG_KEY) === '1'; } catch (_) { return false; }
  }

  function buildOverlay() {
    const style = document.createElement('style');
    style.textContent = `
      #oxxo-lock-overlay{position:fixed;inset:0;z-index:99999;display:grid;place-items:center;padding:24px;background:linear-gradient(135deg,#2D0B0C,#4A1416);}
      #oxxo-lock-overlay .oxxo-lock__card{width:min(420px,100%);border:1px solid rgba(255,255,255,.14);border-radius:24px;background:rgba(255,255,255,.97);box-shadow:0 28px 80px rgba(0,0,0,.4);padding:28px}
      #oxxo-lock-overlay .oxxo-lock__brand{display:flex;align-items:center;gap:12px;margin-bottom:20px}
      #oxxo-lock-overlay .oxxo-lock__logo{width:56px;height:42px;border-radius:10px;overflow:hidden;background:#fff;box-shadow:0 10px 20px rgba(0,0,0,.08);display:flex;align-items:center;justify-content:center}
      #oxxo-lock-overlay .oxxo-lock__logo img{width:100%;height:100%;object-fit:contain}
      #oxxo-lock-overlay .oxxo-lock__eyebrow{font-size:11px;font-weight:900;letter-spacing:.14em;text-transform:uppercase;color:#D91F2D}
      #oxxo-lock-overlay .oxxo-lock__title{font-family:var(--font-display,inherit);font-size:1.6rem;line-height:1.15;margin:4px 0 0;color:#211312;font-weight:800}
      #oxxo-lock-overlay .oxxo-lock__text{color:#7a4a42;font-size:13px;font-weight:650;margin:0 0 16px}
      #oxxo-lock-overlay .oxxo-lock__form{display:grid;gap:12px}
      #oxxo-lock-overlay .oxxo-lock__input{border:1px solid #e6d3ce;border-radius:12px;padding:12px 14px;font-size:14px;font-family:inherit;background:#fff;color:#211312}
      #oxxo-lock-overlay .oxxo-lock__input:focus{outline:2px solid #D91F2D;outline-offset:1px}
      #oxxo-lock-overlay .oxxo-lock__error{min-height:18px;color:#D91F2D;font-size:12px;font-weight:900}
      #oxxo-lock-overlay .oxxo-lock__button{border:0;border-radius:14px;background:#D91F2D;color:#fff;padding:12px 16px;font-weight:900;cursor:pointer;box-shadow:0 14px 28px rgba(217,31,45,.28)}
      #oxxo-lock-overlay .oxxo-lock__button:active{transform:translateY(1px)}
    `;
    document.head.appendChild(style);

    const overlay = document.createElement('div');
    overlay.id = 'oxxo-lock-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.innerHTML = `
      <div class="oxxo-lock__card">
        <div class="oxxo-lock__brand">
          <div class="oxxo-lock__logo"><img src="${assetPath('assets/oxxo-logo-original.png')}" alt="OXXO"></div>
          <div>
            <div class="oxxo-lock__eyebrow">Acceso restringido</div>
            <div class="oxxo-lock__title">Dashboards Ats</div>
          </div>
        </div>
        <p class="oxxo-lock__text">Ingresa la contraseña del equipo para entrar.</p>
        <form class="oxxo-lock__form" id="oxxo-lock-form">
          <input class="oxxo-lock__input" id="oxxo-lock-password" type="password" autocomplete="current-password" placeholder="Contraseña" />
          <div class="oxxo-lock__error" id="oxxo-lock-error"></div>
          <button class="oxxo-lock__button" type="submit">Entrar</button>
        </form>
      </div>
    `;
    document.body.appendChild(overlay);

    const form = document.getElementById('oxxo-lock-form');
    const input = document.getElementById('oxxo-lock-password');
    const error = document.getElementById('oxxo-lock-error');
    setTimeout(() => input.focus(), 80);

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      error.textContent = 'Validando...';
      const hash = await sha256Hex(input.value);
      if (hash === PASSWORD_HASH) {
        unlock();
      } else {
        error.textContent = 'Contraseña incorrecta. Intenta de nuevo.';
        input.value = '';
        input.focus();
      }
    });
  }

  // Este script se usa tanto en la raiz (index.html) como en dashboards/*.html:
  // se detecta la profundidad por la URL de la pagina actual para armar rutas
  // de assets que funcionen en ambos casos.
  function assetPath(relativeToRoot) {
    const isNested = /\/dashboards\//.test(location.pathname);
    return (isNested ? '../' : '') + relativeToRoot;
  }

  function init() {
    if (isUnlocked()) {
      document.documentElement.classList.remove('oxxo-locked');
      return;
    }
    buildOverlay();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
