# Arquitectura de codigo

Este documento define como mantener el proyecto ordenado sin romper la publicacion estatica en GitHub Pages.

## Principio base

El sitio es estatico: cada HTML carga CSS y JS directo desde el repo. Por eso los cambios deben ser incrementales y compatibles con navegadores, sin depender de build steps.

## Capas actuales

| Capa | Carpeta/archivo | Responsabilidad |
|---|---|---|
| Configuracion | `js/config.js` | IDs de Sheets, URL de Apps Script y nombres de pestanas |
| Core compartido | `js/core.js` | Lectura de Sheets, parseo CSV, catalogo de asesores, utilidades y exportacion PNG |
| Panel admin | `js/admin.js`, `js/admin/column-aliases.js`, `js/admin/dashboard-definitions.js`, `js/admin/normalizers.js`, `js/admin/publishers.js` | Validacion de Excel, normalizacion, configuracion de cargas y publicacion a Apps Script |
| Dashboards | `dashboards/*.html` | Visualizacion, filtros, KPIs, graficas y tablas de cada dashboard |
| Estilos | `css/*.css` | Tema visual, layout, tarjetas, filtros y tablas |
| Integracion Sheets | `apps-script/admin-upload.gs` | Escritura de datos desde panel admin a Google Sheets |
| Documentacion | `docs/*.md` | Operacion, soporte y mapa tecnico |

## Regla de configuracion

Toda URL o nombre de pestana debe vivir primero en `js/config.js`.

`js/core.js` mantiene un fallback interno para compatibilidad, pero el archivo que se debe editar normalmente es:

```txt
js/config.js
```

Cuando cambie una URL o pestana importante, actualiza tambien el cache-bust del script en los HTML afectados.

## Como refactorizar sin riesgo

1. Hacer backup local en `outputs/backup-*`.
2. Cambiar una sola capa por commit.
3. Validar que no existan marcas de conflicto.
4. Revisar `git diff --check`.
5. Probar al menos `admin.html`, `dashboard-1.html`, `dashboard-2.html` y `dashboard-3.html`.
6. Subir el cambio solo cuando el flujo principal siga funcionando.

## Siguiente separacion recomendada

El panel admin ya tiene separadas sus piezas principales de configuracion, normalizacion y publicacion:

```txt
js/admin/
  column-aliases.js
  dashboard-definitions.js
  normalizers.js
  publishers.js
```

El siguiente paso deberia ser separar UI/renderizado en `js/admin/ui.js`, porque toca eventos, vista previa y estados visuales. Debe hacerse con pruebas manuales del panel admin antes de publicar.

## Que no mover todavia

Por ahora conviene no mover la logica embebida dentro de cada `dashboard-*.html` hasta tener una prueba visual clara. Es codigo funcional y muy conectado a la UI.