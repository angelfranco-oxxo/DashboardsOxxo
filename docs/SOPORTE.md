# Soporte y problemas comunes

## El panel admin muestra "Failed to fetch"

Posibles causas:

- El navegador esta usando una URL vieja de Apps Script guardada en cache.
- Brave bloqueo la respuesta del Web App.
- Se creo una implementacion NUEVA del Apps Script (en vez de publicar una version nueva sobre la existente) y la URL cambio.
- El Apps Script no tiene permisos correctos.

Soluciones:

1. Presiona `Ctrl + F5` en el panel admin.
2. Revisa que `js/config.js` tenga la URL correcta en `ADMIN_UPLOAD_URL`.
3. Si el campo de URL del panel muestra una URL vieja, reemplazala con la nueva y presiona `Guardar URL`.
4. Verifica que el Web App de Apps Script este publicado como:
   - Ejecutar como: propietario.
   - Acceso: cualquiera con el enlace, segun la politica permitida.
5. Si Brave sigue bloqueando, prueba el modo compatible del panel o usa Chrome para validar.

Para evitar que la URL vuelva a cambiar, redespliega siempre editando la
implementacion existente (`Administrar implementaciones` > lapiz > Version:
"Nueva version"), nunca con `Nueva implementacion`. Ver la seccion
"Redesplegar el Apps Script sin romper la URL" en `docs/GUIA_ACTUALIZACION.md`.

## El dashboard no actualiza datos

Revisa:

- Que la publicacion en Sheets haya terminado.
- Que la pestana correcta del Sheet tenga datos.
- Que la pestana este publicada/accesible como CSV.
- Que `SHEETS_CONFIG.TABS` apunte al nombre exacto.
- Que el navegador no este mostrando cache viejo.

## El panel marca columnas faltantes

Revisa:

- Si el Excel trae encabezados en una fila distinta.
- Si el nombre de columna cambio.
- Si el archivo fue exportado con caracteres raros.
- Si la hoja seleccionada no es la correcta.

## Los asesores salen incorrectos

Revisa:

- Que `Catalogo_Asesores` este actualizado.
- Que exista `CR TIENDA` para la tienda.
- Que el CR no tenga espacios o caracteres extra.
- Que la tienda exista en el catalogo.

## GitHub Pages tarda en mostrar cambios

GitHub Pages puede tardar unos minutos en reflejar cambios. Tambien puede quedarse cacheado el navegador.

Acciones:

- Espera de 1 a 5 minutos.
- Usa `Ctrl + F5`.
- Verifica que `admin.html` o el dashboard tenga version nueva en los scripts, por ejemplo `core.js?v=...`.

## Recomendacion antes de cambios grandes

Antes de una refactorizacion grande:

1. Ejecuta `git status`.
2. Crea un commit con el estado estable.
3. Haz cambios en partes pequenas.
4. Prueba panel admin y dashboards clave.
5. Sube solo cuando el flujo principal siga funcionando.