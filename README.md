# OXXO Dashboards Next

Migracion conservadora del proyecto HTML original a Next.js.

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
