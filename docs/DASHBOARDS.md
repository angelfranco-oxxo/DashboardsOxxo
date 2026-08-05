# Mapa de dashboards

## Portada

Archivo: `index.html`

Uso:

- Vista ejecutiva de estado general.
- Accesos a dashboards.
- Lectura de ultimas actualizaciones desde Google Sheets.

## Panel admin

Archivo: `admin.html`

Scripts principales:

- `js/admin.js`
- `js/admin-pptx.js`
- `js/admin-pptx-rae.js`
- `js/admin-indicadores.js`
- `js/admin-pptx-asesor.js`

Uso:

- Cargar bases Excel.
- Validar columnas obligatorias.
- Publicar a Sheets.
- Generar presentaciones y archivos auxiliares.

## Dashboard 1 - Vacantes diarias

Archivo: `dashboards/dashboard-1.html`

Enfoque:

- Vacantes por asesor, tienda, puesto, antiguedad y mes.
- KPIs accionables y detalle por tienda.

## Dashboard 2 - Bajas diarias

Archivos:

- `dashboards/dashboard-2.html`
- `dashboards/dashboard-2-analisis.html`

Enfoque:

- Bajas por mes, asesor, puesto, temporalidad y rotacion temprana.
- Comparativo por plaza.
- Analisis de bajas y plan de accion.

## Dashboard 3 - Aprovechamiento de estructura

Archivo: `dashboards/dashboard-3.html`

Enfoque:

- Equipo completo/incompleto.
- Tiendas criticas.
- Aprovechamiento por AT y por plaza.

## Dashboard 4 - Tiempo extra

Archivo: `dashboards/dashboard-4.html`

Enfoque:

- Gasto y horas de tiempo extra.
- Ranking por asesor.
- Detalle por empleado y tipo de TE.

## Dashboard 5 - Vacaciones

Archivos:

- `dashboards/dashboard-5.html`
- `js/dashboard-5-vacaciones.js`

Enfoque:

- Dias restantes por colaborador.
- Rangos de vacaciones.
- Tiendas y puestos con pendientes.

## Dashboard 6 - Ausentismos

Archivo: `dashboards/dashboard-6.html`

Enfoque:

- Ausentismos por semana.
- Tipo de ausencia.
- Afectacion por asesor, tienda y empleado.

## Dashboard 7 - TREO

Archivo: `dashboards/dashboard-7.html`

Enfoque:

- Alineacion TREO vs SAP.
- Movimiento de estructura.
- Vacantes y activos por tienda.

## Dependencias externas

Los dashboards usan librerias cargadas por CDN o scripts locales, entre ellas:

- Chart.js para graficas.
- XLSX.js para lectura de Excel en panel admin.
- html2canvas para exportacion PNG.