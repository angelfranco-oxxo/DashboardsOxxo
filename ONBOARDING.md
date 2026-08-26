# Onboarding de un cliente nuevo

Este repo hoy es **mono-cliente**: sirve a OXXO Plaza Oaxaca. Este documento
es el inventario honesto de qué se puede reconfigurar sin tocar código y
qué está cableado en la lógica y requeriría cambios de código reales para
atender a un cliente/plaza distinta. No implementa nada — es la base para
decidir cuánto se invierte antes de vender el sistema a alguien más.

## 1. Lo que ya es configuración (no requiere tocar código)

Todo vive en `js/config.js` (`window.OXXO_CONFIG`), cargado antes que
`js/core.js` en las 15 páginas del sitio:

- `SPREADSHEET_ID` — el Google Sheet que alimenta todos los dashboards.
- `CONFIG_SHEET`, `CATALOG_SHEET`, `REASIGNACIONES_SHEET` — nombres de pestañas.
- `ADMIN_UPLOAD_URL` — el Web App de Apps Script que usa el panel admin para
  publicar y para leer el catálogo directo (`action=readSheet`, ver más abajo).
- `TABS` — nombres exactos de las 20 pestañas de datos (`Dashboard_1_Diario`, etc).

Para un cliente nuevo, técnicamente bastaría con: crear su propio Google
Sheet con esas mismas pestañas y columnas (tabla en la sección 3), desplegar
su propio Apps Script, y actualizar estos valores. **Pero eso no alcanza**
porque el nombre "Oaxaca" está además cableado en la lógica, no solo en el
Sheet — ver sección 2.

## 2. Lo que está cableado en el código (requeriría cambios reales)

### a) Filtro de ingesta en el panel admin — decide qué filas se publican

- `js/admin.js:4` — `const PLAZA_TARGET='OAXACA';` (solo para textos de
  estado en pantalla, pero documenta la intención del filtro).
- `js/admin/normalizers.js:11` — `containsOaxaca(value)` compara contra el
  literal `'oaxaca'`. Se usa como filtro (`filter:`) en **8 de los 9**
  dashboards definidos en `js/admin/dashboard-definitions.js` (d1, d2,
  d2denom, d3, s4, s5, s6, s7, d8). Sin cambiar esto, el admin **descarta
  toda fila que no diga Oaxaca en la columna Plaza**, sin importar qué
  Sheet de destino se configure.
- `js/admin/dashboard-definitions.js:28,36` — `PEER_PLAZAS_D2OTRAS` y
  `PEER_PLAZAS_D3`: listas fijas de plazas comparativas (Chontalpa,
  Villahermosa, Costa Istmo, Tuxtla / Tuxtla, Istmo, Villahermosa,
  Chontalpa) para los rankings de Dashboard 2 y 3. Específicas del negocio
  de esta plaza, no de un cliente genérico.

### b) Resolución de tiendas/asesores en los dashboards

- `js/core.js:1723` — filtra filas de Dashboard 2 comparando la columna
  Plaza contra `'OAXACA'` literal.
- `js/core.js:1735-1736` — dos regex que reconocen nombres de estructura
  tipo `ENTRENAMIENTO OAXACA...` / `OPERACIONES N OAXACA` para excluirlas
  del conteo de tiendas reales.

### c) Textos de marca en la UI

- `js/mi-dashboard.js:655` y `js/mi-tienda.js:651` — badge fijo
  `"⟳ Datos en vivo · Plaza Oaxaca"`.
- Títulos y textos "Plaza Oaxaca" repartidos en las 12 páginas de
  `dashboards/*.html` e `index.html` (solo texto, sin lógica detrás).

### d) Generadores de PPTX (exportar presentación desde el admin)

- `js/admin-pptx.js`, `js/admin-pptx-asesor.js`, `js/admin-pptx-rae.js` —
  decenas de literales `'Plaza Oaxaca'` / `'OAXACA'` en labels de slides,
  nombre de archivo exportado (`Presentacion-RAE-Oaxaca-...pptx`), y un
  ranking que asume una sola plaza propia + 4 comparativas fijas.

**Resumen**: parametrizar esto de verdad significa introducir algo como
`CONFIG.PLAZA_NAME` y `CONFIG.PEER_PLAZAS` en `js/config.js`, y reemplazar
cada uno de los puntos de arriba por una referencia a esa config, además de
revisar cómo cada dashboard calcula sus rankings comparativos (hoy asumen
exactamente 4 plazas vecinas fijas). Es un cambio transversal a ~10
archivos, no una tarea de una sola sesión corta.

## 3. Estructura de Google Sheet requerida por dashboard

Columnas tomadas de `js/admin/dashboard-definitions.js` (`output`/`required`
de cada definición) — son las que el admin espera poder mapear desde el
Excel de origen antes de publicar:

| Pestaña (`TABS`) | Dashboard | Columnas obligatorias |
|---|---|---|
| `Dashboard_1_Diario` | 1 — Vacantes | Plaza, Asesor, Unidad org, ID posiciones, Descripcion de Posicion, Status ocupacion |
| `Dashboard_2_Diario` | 2 — Bajas | Plaza, Asesor, Nombre del empleado, Fecha, Semana, Temporalidad, Rot_Temp, Puesto, Tienda |
| `Dashboard_2_Otras_Plazas` | 2 — Bajas comparativo | Plazas, Bajas Plaza |
| `Denominaciones_Dashboard_2_Diario` | 2 — Movimientos ABC | Plaza, Asesor, Denominacion Medida, Nombre del empleado, F.Crea, Denominacion Funcion Anterior/Actual |
| `Dashboard_2_Plan_Accion` | 2 — Plan de acción | Hallazgo, Accion (captura manual) |
| `Dashboard_3_Diario` | 3 — Estructura | Plaza, CR TIENDA, Asesor, Tienda, Estructura Diaria, Aprovechamiento Estructura, Estatus Con impacto Ausentismo, FECHA |
| `Dashboard_3_Otras_Plazas` | 3 — Aprovechamiento comparativo | PLAZAS, Aprovechamiento de estructura a hoy |
| `Dashboard_4_Semanal` | 4 — Tiempo extra | Plaza, Asesor, Nombre del empleado o candidato, Textos homologados, Texto breve de unidad organizativa, Cantidad, Importe, Semana |
| `Dashboard_5_Semanal` | 5 — Vacaciones | Plaza, Asesor, Tienda, Puesto, No. De Empleado, Nombre, Dias_Restantes |
| `Dashboard_6_Semanal` | 6 — Ausentismos | Plaza, Asesor, N de personal, Nombre del empleado o candidato, Tienda, Tipo_Ausentismo, Denominacion, Absentismos solo en la semana, Semana |
| `Dashboard_7_Semanal` | 7 — TREO | Plaza, CR, Tienda, Asesor, Estructura Propuesta TREO, Estructura SAP, Empleados Activos, Vacantes, Movimiento Inicial |
| `Dashboard_8_Diario` | 8 — Capacidades | Plaza, Asesor_Correcto, Puesto_Correcto, Empleados |
| `Dashboard_9_Semanal` | 9 — Faltantes y sobrantes | CR, Importe, Fecha, Semana |
| `Dashboard_10_FLEX` | 10 — Personal FLEX | Tienda, Asesor, Fecha |
| `Dashboard_11_Semanal` | 11 — Registro y Apego a Horario | Tienda, Asesor, Fecha |
| `Dashboard_12_Mensual` | 12 — Enfoque del Líder | Mes, Plaza, CR Tienda, Tienda, Asesor, Clas Final |
| `Dashboard_13_Ausentismo` | 13 — Control de Ausentismo | Nombre, Clasificacion, Tienda, Asesor |
| `Dashboard_14_Comercial` | 14 — Avance Comercial | Tienda, Asesor, Spin, Premia, Cruzada Andatti, Venta Sugerida, Banner |
| `Inventarios` | Administrativo — Resultados de Inventario | CR, Tienda, Plaza, Asesor Comercial, Fecha de Inventario, Resultado de Inventario, Ventas sin TAE del mes |
| `Promociones` | Comercial — PromosD100 | (se edita directo en Sheets, no pasa por el panel admin; ver `admin-commercial-panel` en `admin.html`) |
| `Catalogo_Asesores` | Catálogo compartido | ASESOR, TIENDA, CR TIENDA |
| `Reasignaciones` | Reasignación de asesores salientes | (ver `js/admin-reasignaciones.js`) |
| `Configuracion` | Fecha de corte global | (ver panel admin) |

## 4. Apps Script

El Web App que publica datos y sirve el catálogo en vivo (`readSheet`) está
versionado en `apps-script/admin-upload.gs`. **Ese archivo es solo un
espejo**: cada vez que se edita hay que copiarlo a mano al editor de
script.google.com y volver a desplegarlo — git no lo publica solo. Cada
redeploy genera una URL `/exec` nueva si se usa "Nueva implementación" (la
anterior queda congelada, no falla, simplemente deja de reflejar cambios;
pasó varias veces en este proyecto) o conserva la misma URL si se usa
"Nueva versión" sobre la implementación existente (ver
`docs/GUIA_ACTUALIZACION.md`, sección "Redesplegar el Apps Script sin
romper la URL"). Para un cliente nuevo: copiar `apps-script/admin-upload.gs`
al proyecto de Apps Script de su propio Sheet, ajustar `SPREADSHEET_ID` /
`ALLOWED_SHEETS` si aplica, y desplegarlo como Web App.

## 5. Checklist manual para un cliente nuevo (estado actual, sin refactor)

1. Crear un Google Sheet nuevo con las pestañas y columnas de la sección 3.
2. Copiar el Apps Script (ver sección 4) al proyecto de Apps Script del
   Sheet nuevo, ajustar `SPREADSHEET_ID`/`ALLOWED_SHEETS` si aplica, y
   desplegarlo como Web App.
3. Actualizar `js/config.js` con el `SPREADSHEET_ID` y `ADMIN_UPLOAD_URL`
   nuevos (probablemente en un fork o rama separada del repo, ya que hoy es
   mono-cliente).
4. Aplicar a mano todos los cambios de la sección 2 (nombre de plaza y
   plazas comparativas) en los ~10 archivos listados, con el nombre real
   del cliente.
5. Revisar y ajustar los textos de marca (sección 2c) y los generadores de
   PPTX (sección 2d).

Los pasos 1-3 son mecánicos. El paso 4 es el verdadero costo de vender el
sistema a alguien más — vale la pena parametrizarlo (`PLAZA_NAME` +
`PEER_PLAZAS` en config) el día que haya un cliente real en la mira, en vez
de mantenerlo como checklist manual permanente.
