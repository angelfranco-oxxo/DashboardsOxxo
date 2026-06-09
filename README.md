# 📊 OXXO Dashboards Ejecutivos — Guía de Configuración

Sistema de 6 dashboards conectados a Google Sheets.  
Diseño ejecutivo con paleta OXXO · Responsive · Solo lectura para visitantes.

---

## 🗂️ Estructura del Proyecto

```
oxxo-dashboards/
│
├── index.html                  ← Página principal (hub de dashboards)
│
├── css/
│   └── global.css              ← Sistema de diseño completo (no editar)
│
├── js/
│   └── core.js                 ← Módulo de conexión a Sheets + utilidades
│
├── dashboards/
│   ├── dashboard-1.html        ← Diario · Ejemplo completo funcional
│   ├── dashboard-2.html        ← Diario · Template listo para configurar
│   ├── dashboard-3.html        ← Diario · Template listo para configurar
│   ├── dashboard-4.html        ← Semanal · Template listo para configurar
│   ├── dashboard-5.html        ← Semanal · Template listo para configurar
│   └── dashboard-6.html        ← Semanal · Template listo para configurar
│
└── README.md
```

---

## ⚙️ PASO 1 — Configurar Google Sheets

### 1.1 Crear el archivo en Google Sheets

Crea un nuevo Google Sheets con estas 7 pestañas (nombre exacto):

| Pestaña               | Descripción                  |
|-----------------------|------------------------------|
| `Dashboard_1_Diario`  | Datos del dashboard diario 1 |
| `Dashboard_2_Diario`  | Datos del dashboard diario 2 |
| `Dashboard_3_Diario`  | Datos del dashboard diario 3 |
| `Dashboard_4_Semanal` | Datos del dashboard semanal 4|
| `Dashboard_5_Semanal` | Datos del dashboard semanal 5|
| `Dashboard_6_Semanal` | Datos del dashboard semanal 6|
| `Configuracion`       | Metadatos del sistema        |

### 1.2 Estructura de la pestaña `Configuracion`

Esta pestaña alimenta las fechas y nombres que aparecen en el índice principal.

| dashboard_id | nombre               | frecuencia | ultima_actualizacion | responsable | activo |
|--------------|----------------------|------------|----------------------|-------------|--------|
| d1           | Nombre Dashboard 1   | Diario     | 08/Jun/2025          | Angel       | SI     |
| d2           | Nombre Dashboard 2   | Diario     | 08/Jun/2025          | Angel       | SI     |
| d3           | Nombre Dashboard 3   | Diario     | 08/Jun/2025          | Angel       | SI     |
| s4           | Nombre Dashboard 4   | Semanal    | 05/Jun/2025          | Angel       | SI     |
| s5           | Nombre Dashboard 5   | Semanal    | 05/Jun/2025          | Angel       | SI     |
| s6           | Nombre Dashboard 6   | Semanal    | 05/Jun/2025          | Angel       | SI     |

> ⚠️ La columna `dashboard_id` debe tener exactamente: `d1`, `d2`, `d3`, `s4`, `s5`, `s6`

### 1.3 Estructura recomendada para cada pestaña de datos

Cada pestaña puede tener las columnas que necesites, pero una estructura típica es:

```
| plaza | periodo | indicador | meta | resultado | variacion |
```

Ejemplo para vacantes:
```
| plaza | periodo  | vacantes | meta | porcentaje_cobertura | variacion |
| B378  | Jun-2025 | 3        | 5    | 94.2                 | -1.8      |
| B350  | Jun-2025 | 7        | 5    | 88.1                 | +2.1      |
```

---

## ⚙️ PASO 2 — Publicar Google Sheets como CSV

Para que los dashboards puedan leer los datos:

1. Abre tu Google Sheets
2. Ve a **Archivo → Compartir → Publicar en la web**
3. Selecciona: **Hoja completa** → **Valores separados por comas (.csv)**
4. Haz clic en **Publicar** y confirma
5. Cierra el modal (no necesitas la URL que te da ahí)

> ✅ Con esto, cualquier pestaña será accesible vía URL pública.

---

## ⚙️ PASO 3 — Agregar tu Spreadsheet ID

Abre el archivo `js/core.js` y busca esta línea (aproximadamente línea 20):

```javascript
SPREADSHEET_ID: "1MORN0KOO54i_-f2TS31g1u69BZ_7OaMx",
```

Reemplaza `1MORN0KOO54i_-f2TS31g1u69BZ_7OaMx` con el ID de tu Google Sheets.

**¿Cómo encontrar el ID?**  
Es la parte de la URL entre `/d/` y `/edit`:

```
https://docs.google.com/spreadsheets/d/ESTE_ES_EL_ID/edit#gid=0
```

Ejemplo:
```javascript
SPREADSHEET_ID: "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms",
```

---

## ⚙️ PASO 4 — Configurar cada Dashboard

Abre cada archivo en `dashboards/` y modifica las secciones marcadas con `► EDITAR`:

### En el `<head>`:
```html
<title>Dashboard 1 · NOMBRE REAL · OXXO</title>
```

### En el `<nav>` (topbar):
```html
<div class="topbar__title">Dashboard 1 · NOMBRE REAL</div>
<div class="topbar__subtitle">Actualización diaria · Plaza Oaxaca</div>
```

### En el `<script>` (configuración de datos):
```javascript
// ► EDITAR: Pestaña de Sheets
const TAB_NAME = OXXO.SHEETS_CONFIG.TABS.d1;

// ► EDITAR: Nombres de columnas (deben coincidir con tu hoja)
const COLS = {
  plaza:     "plaza",
  periodo:   "periodo",
  resultado: "resultado",
  // ...
};

// ► EDITAR: Umbrales semáforo
const UMBRAL = {
  verde: 95,
  rojo: 80,
  invertido: false, // true si valores bajos son BUENOS
};
```

---

## 🚀 PASO 5 — Publicar en GitHub Pages

### 5.1 Subir a GitHub

```bash
git init
git add .
git commit -m "Initial commit: OXXO Dashboards"
git remote add origin https://github.com/TU_USUARIO/oxxo-dashboards.git
git push -u origin main
```

### 5.2 Activar GitHub Pages

1. Ve a tu repositorio en GitHub
2. **Settings → Pages**
3. Source: **Deploy from a branch**
4. Branch: `main` → `/root` (o `/docs` si lo prefieres)
5. Guarda. En ~2 minutos tendrás tu URL:  
   `https://TU_USUARIO.github.io/oxxo-dashboards/`

### Alternativa: Netlify (drag & drop)
1. Ve a [netlify.com](https://netlify.com)
2. Arrastra la carpeta `oxxo-dashboards` al área de deploy
3. ¡Listo! Obtienes un URL en segundos.

---

## 🎨 PASO 6 — Personalizar diseño

### Cambiar colores de las tarjetas en `index.html`

Cada tarjeta tiene variables CSS inline:
```html
<a href="..." class="db-card"
   style="--card-accent:#FFD200;
          --card-icon-bg:rgba(255,210,0,0.1);
          --card-freq-bg:rgba(255,210,0,0.12);
          --card-freq-color:#B8960C">
```

### Cambiar íconos
Modifica el emoji dentro de `.db-card__icon`:
```html
<div class="db-card__icon">📊</div>
```

### Cambiar nombre de Plaza
Busca "Plaza Oaxaca" en todos los archivos y reemplaza.

---

## 🔄 Actualización de Datos

**Proceso diario:**
1. Abre Google Sheets
2. Actualiza los datos en la pestaña correspondiente
3. Actualiza la fecha en la pestaña `Configuracion` (columna `ultima_actualizacion`)
4. Los dashboards se actualizan automáticamente al recargar la página

**No necesitas tocar código nunca más** — solo edita el Google Sheets.

---

## 🧩 Componentes disponibles en `core.js`

| Función | Descripción |
|---------|-------------|
| `OXXO.fetchSheetData(tabName)` | Descarga y parsea una pestaña |
| `OXXO.renderTable(id, data, cols)` | Tabla con semáforos |
| `OXXO.renderRanking(id, data, keyN, keyV)` | Ranking con barras animadas |
| `OXXO.renderBarChart(canvasId, labels, vals)` | Gráfica de barras |
| `OXXO.renderLineChart(canvasId, labels, ds)` | Gráfica de línea |
| `OXXO.renderDonutChart(canvasId, labels, vals)` | Gráfica de dona |
| `OXXO.renderKPI(id, valor, delta)` | Actualizar tarjeta KPI |
| `OXXO.getSemaforo(val, verde, rojo, inv)` | Retorna 'verde'/'amarillo'/'rojo' |
| `OXXO.semaforoHTML(texto, color)` | HTML del semáforo con punto |
| `OXXO.formatNum(n, decimals)` | Formato de número |
| `OXXO.formatPct(n, decimals)` | Formato de porcentaje |
| `OXXO.showLoading(id)` | Estado de carga |
| `OXXO.showError(id, msg)` | Estado de error |
| `OXXO.showEmpty(id)` | Estado vacío |

---

## ❓ Solución de Problemas

**"No se pudo conectar con Google Sheets"**
→ Verifica que el SPREADSHEET_ID sea correcto  
→ Verifica que la hoja esté publicada en la web (Paso 2)  
→ Verifica que el nombre de la pestaña coincida exactamente

**"La tabla aparece vacía"**
→ Verifica que la primera fila de tu hoja tenga los encabezados  
→ Verifica que los nombres de columnas en COLS coincidan exactamente  
→ Revisa mayúsculas/minúsculas y espacios

**El índice muestra "—" en fecha de actualización**
→ Verifica que la pestaña `Configuracion` exista y tenga datos  
→ Verifica que la columna `dashboard_id` tenga los valores correctos (d1, d2... s4, s5, s6)

---

_Sistema desarrollado para Plaza Oaxaca · OXXO_
