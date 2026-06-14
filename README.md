# OXXO Dashboards

Dashboard OXXO migrado a Next.js y publicado tambien como salida estatica para GitHub Pages.

GitHub Pages sirve la version estatica desde la raiz del repositorio:

- `index.html`
- `dashboards/*.html`
- `assets/`, `css/`, `js/`

La app Next conserva la misma interfaz en `legacy/` y expone rutas desde `app/`.

## Ejecutar

```bash
npm install
npm run dev
```

Luego abre:

```text
http://localhost:3000
```

## Rutas

- `/`
- `/dashboards/dashboard-1.html`
- `/dashboards/dashboard-2.html`
- `/dashboards/dashboard-3.html`
- `/dashboards/dashboard-4.html`
- `/dashboards/dashboard-5.html`
- `/dashboards/dashboard-6.html`

## Estructura

- `legacy/`: HTML migrado del proyecto original.
- `public/assets`: imagenes y recursos.
- `public/css`: estilos globales heredados.
- `public/js`: logica compartida heredada.
- `app/`: rutas Next que sirven el HTML legado.

Esta estrategia mantiene el comportamiento actual de Google Sheets, Chart.js y los scripts imperativos mientras deja el proyecto listo para migrar componentes a React gradualmente.
