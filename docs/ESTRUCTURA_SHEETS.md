# Estructura de Google Sheets

El sistema usa un Google Sheet como base central. Cada dashboard lee una pestana especifica mediante CSV publicado.

## Configuracion central

La configuracion editable esta en `js/config.js`, dentro de `window.OXXO_CONFIG`. `js/core.js` la consume como `SHEETS_CONFIG` y conserva un fallback interno para compatibilidad.

Campos importantes:

- `SPREADSHEET_ID`: ID del Google Sheet principal.
- `CONFIG_SHEET`: pestana de configuracion de portada.
- `CATALOG_SHEET`: pestana de catalogo de asesores.
- `ADMIN_UPLOAD_URL`: URL del Web App de Apps Script para publicar desde el panel admin.
- `TABS`: nombres exactos de pestanas usadas por cada dashboard.

## Pestanas principales

| Clave | Pestana | Uso |
|---|---|---|
| d1 | Dashboard_1_Diario | Vacantes diarias |
| d2 | Dashboard_2_Diario | Bajas diarias |
| d2otras | Dashboard_2_Otras_Plazas | Bajas de otras plazas |
| d2denom | Denominaciones_Dashboard_2_Diario | Movimientos ABC |
| d2plan | Dashboard_2_Plan_Accion | Plan de accion del analisis de bajas |
| d3 | Dashboard_3_Diario | Aprovechamiento de estructura |
| d3plazas | Dashboard_3_Otras_Plazas | Aprovechamiento por plaza |
| s4 | Dashboard_4_Semanal | Tiempo extra |
| s5 | Dashboard_5_Semanal | Vacaciones |
| s6 | Dashboard_6_Semanal | Ausentismos |
| s7 | Dashboard_7_Semanal | TREO |
| catalog | Catalogo_Asesores | Correccion de asesores por tienda/CR |

## Publicacion desde el panel admin

El panel admin no escribe directamente sobre archivos del repo. El flujo correcto es:

1. El usuario sube un Excel en `admin.html`.
2. `js/admin.js` valida y normaliza la base.
3. El panel envia los datos al Apps Script.
4. `apps-script/admin-upload.gs` reemplaza la pestana completa o solo el periodo correspondiente.
5. Los dashboards leen la informacion publicada.

## Modos de publicacion

- `replaceAll`: reemplaza la pestana completa.
- `replacePeriod`: reemplaza solo los registros del periodo cargado, por ejemplo Mes o Semana.

## Recomendacion operativa

Antes de cambiar nombres de pestanas en Google Sheets, actualiza `SHEETS_CONFIG.TABS` y prueba el panel admin con un archivo pequeno.