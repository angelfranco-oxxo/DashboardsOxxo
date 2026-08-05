# OXXO Dashboards

Sistema estatico de dashboards operativos para Plaza Oaxaca. El sitio se publica en GitHub Pages y consume datos desde Google Sheets mediante archivos CSV publicados por pestana.

## Que incluye

- Portada ejecutiva con estado general de los dashboards.
- Panel admin para validar Excel, normalizar columnas y publicar datos en Google Sheets.
- 7 dashboards operativos:
  - Dashboard 1: Vacantes diarias.
  - Dashboard 2: Bajas diarias y analisis de bajas.
  - Dashboard 3: Aprovechamiento de estructura.
  - Dashboard 4: Tiempo extra.
  - Dashboard 5: Vacaciones.
  - Dashboard 6: Ausentismos.
  - Dashboard 7: TREO.
- Catalogo de asesores para corregir responsables por tienda/CR.
- Exportacion de secciones a PNG y generacion de presentaciones/archivos auxiliares desde el panel admin.

## Estructura actual

```txt
DashboardsOxxo/
  admin.html              Panel para carga, validacion y publicacion de bases
  index.html              Portada ejecutiva
  dashboards/             Paginas HTML de cada dashboard
  js/                     Logica compartida, dashboards y panel admin
  css/                    Estilos globales y tema visual
  assets/                 Imagenes, plantillas, favicons y datos estaticos
  apps-script/            Codigo del Web App de Google Apps Script
  docs/                   Documentacion operativa y tecnica
```

## Archivos principales

- `js/config.js`: configuracion central de Sheets y Apps Script.
- `js/core.js`: lectura de Sheets, utilidades compartidas, catalogo de asesores y exportacion PNG.
- `js/admin.js`: validacion de Excel y publicacion al Apps Script.
- `apps-script/admin-upload.gs`: Web App que recibe datos del panel admin y actualiza Google Sheets.
- `css/dashboard-skin.css`: tema visual principal de dashboards.
- `css/floating-filter-layout.css`: layout de filtros flotantes.

## Flujo de datos

1. Una persona descarga o recibe una base Excel.
2. Entra al panel admin.
3. Selecciona el dashboard destino.
4. Sube el Excel.
5. El panel valida columnas, filtra Plaza Oaxaca y normaliza los datos.
6. Publica al Google Sheet mediante Apps Script.
7. Los dashboards leen automaticamente la pestana correspondiente desde Google Sheets.

## Documentacion

- [Guia de actualizacion](docs/GUIA_ACTUALIZACION.md)
- [Estructura de Google Sheets](docs/ESTRUCTURA_SHEETS.md)
- [Mapa de dashboards](docs/DASHBOARDS.md)
- [Soporte y problemas comunes](docs/SOPORTE.md)
- [Arquitectura de codigo](docs/ARQUITECTURA_CODIGO.md)

## Desarrollo local

Este proyecto es estatico. Para revisarlo localmente puedes abrir `index.html` directamente o levantar un servidor simple:

```powershell
python -m http.server 4177
```

Luego abre:

```txt
http://127.0.0.1:4177/
```

## Publicacion

GitHub Pages sirve la version estatica desde la raiz del repositorio:

- `index.html`
- `admin.html`
- `dashboards/*.html`
- `assets/`
- `css/`
- `js/`

Para subir cambios:

```powershell
git status
git add .
git commit -m "Descripcion del cambio"
git pull --rebase origin main
git push origin main
```

## Nota de mantenimiento

La carpeta `outputs/` se usa solo para respaldos, capturas y archivos generados durante pruebas locales. No debe publicarse en el repo.