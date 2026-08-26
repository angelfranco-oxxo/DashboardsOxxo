# Uso de Inteligencia Artificial en este repositorio

Este documento deja constancia de cómo se usa Inteligencia Artificial (IA) en el
desarrollo de Dashboards Ats, en cumplimiento de la Norma Corporativa FEMSA
**02.05.09.6 · Seguridad en Inteligencia Artificial (IA)** (aprobada 14/08/2026).

No sustituye ningún proceso formal de autorización de TI. Es un registro
interno del proyecto para dejar rastro de qué herramienta se usa, bajo qué
autorización y qué cambios ha producido.

## Herramienta de IA utilizada

- **Herramienta:** Claude Code (Anthropic), un asistente de IA para desarrollo
  de software que edita archivos, ejecuta comandos y gestiona Git/GitHub
  directamente en este repositorio.
- **Quién la opera:** Angel Gijón (angel.gijon@icloud.com), como colaborador
  responsable de este proyecto.
- **Para qué se usa:** desarrollo y mantenimiento del código del sitio
  (HTML/CSS/JS del panel admin y los dashboards), diagnóstico de bugs,
  refactors, y documentación técnica del repositorio.

## Registro de autorización de TI

> Punto B.1 y B.7 de la Norma 02.05.09.6: el uso de herramientas de IA con
> información corporativa requiere autorización previa del área de TI de la
> Unidad de Negocio, y estar incluida en su listado oficial.

| Campo | Valor |
|---|---|
| Herramienta | Claude Code / Claude (Anthropic) |
| Autorizado por (nombre y puesto) | _[pendiente de completar]_ |
| Fecha de autorización | _[pendiente de completar]_ |
| Medio de confirmación (correo, ticket, etc.) | _[pendiente de completar]_ |
| Alcance autorizado | Repositorio `humanresources-oxxo/DashboardsOxxo` |

**Nota:** hasta que estos campos se completen con un respaldo por escrito, esta
tabla documenta que la confirmación verbal de TI existe, pero no reemplaza el
registro formal que pide la Norma. Se recomienda cerrarlo cuanto antes.

## Manejo de datos

- El código de este repositorio trabaja con la **estructura y lógica** de los
  dashboards (HTML, CSS, JavaScript, Apps Script). No almacena datos reales de
  colaboradores dentro del repositorio ni en el historial de Git.
- Los datos reales (vacantes, bajas, ausentismos, faltantes/sobrantes, etc.)
  viven en Google Sheets y se cargan **del lado del navegador de quien visita
  el sitio**, no a través del asistente de IA.
- Durante el desarrollo, ocasionalmente se comparten con el asistente
  capturas de pantalla o mensajes de consola para diagnosticar bugs
  puntuales; esas capturas pueden incluir fragmentos de datos reales (nombres
  de tienda, cifras) visibles en ese momento en el dashboard. Es inherente a
  depurar bugs de una aplicación con datos reales y debe tratarse con el mismo
  cuidado que cualquier otra Información Confidencial de FEMSA.
- No se han compartido con el asistente credenciales, contraseñas del sitio,
  ni URLs privadas de Apps Script fuera de lo estrictamente necesario para que
  el código funcione (y esas URLs no son secretas: dependen del acceso ya
  restringido por Google).

## Responsabilidad sobre los resultados

Conforme al punto 5 de la Norma, cada resultado generado con ayuda de esta
herramienta debe ser validado por un colaborador antes de darlo por bueno:
exactitud, coherencia y que efectivamente resuelva lo pedido. En este
proyecto eso se hace por dos vías:

1. **Revisión funcional:** cada cambio se prueba en el sitio (o se documenta
   explícitamente cuando no fue posible probarlo visualmente) antes de
   mergear.
2. **Historial en GitHub:** cada cambio pasa por un Pull Request individual,
   con su propia descripción del problema y la solución, revisable en
   cualquier momento en
   [github.com/humanresources-oxxo/DashboardsOxxo/pulls](https://github.com/humanresources-oxxo/DashboardsOxxo/pulls).

## Bitácora de cambios

Generada a partir del historial real de Git (`git log`), no de memoria. Cada
fila es un commit en `main`; los commits de sincronización de rama
(`Merge remote-tracking branch...`) se omiten por no representar cambios de
contenido. Para regenerarla:

```bash
git log origin/main --reverse --pretty=format:'%ad|%s' --date=format:'%Y-%m-%d %H:%M' \
  | grep -v 'Merge remote-tracking branch'
```

<!-- BITACORA_START -->
| Fecha | Cambio | PR |
|---|---|---|
| 2026-08-05 08:45 | Actualizar URL del Apps Script del panel admin | — |
| 2026-08-05 08:48 | Dashboard 2 Bajas: corregir asesor por catalogo/tienda | [#239](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/239) |
| 2026-08-05 08:54 | Documentar estructura y flujo del sistema | — |
| 2026-08-05 09:04 | Separar configuracion central del sistema | — |
| 2026-08-05 09:34 | Separar alias de columnas del panel admin | — |
| 2026-08-05 09:39 | Separar definiciones de dashboards del panel admin | — |
| 2026-08-05 09:54 | Separar normalizadores del panel admin | — |
| 2026-08-05 10:03 | Separar publicacion del panel admin | — |
| 2026-08-05 10:10 | Separar UI basica del panel admin | — |
| 2026-08-05 10:39 | Agregar mascota-chatbot "Oxxito" en index y dashboards | [#240](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/240) |
| 2026-08-05 10:42 | Recalcular TREO desde estructura diaria | — |
| 2026-08-05 10:53 | Proteger recalculo TREO con estructura valida | — |
| 2026-08-05 11:04 | Evitar Dashboard 1 vacio con estructura completa | — |
| 2026-08-05 11:07 | Revert "Evitar Dashboard 1 vacio con estructura completa" | — |
| 2026-08-05 11:07 | Revert "Proteger recalculo TREO con estructura valida" | — |
| 2026-08-05 11:07 | Revert "Recalcular TREO desde estructura diaria" | — |
| 2026-08-05 11:16 | Evitar Dashboard 1 vacio al cargar estructura | — |
| 2026-08-05 11:21 | Limpiar dias vacantes invalidos en Dashboard 1 | — |
| 2026-08-05 11:24 | Revert "Limpiar dias vacantes invalidos en Dashboard 1" | — |
| 2026-08-05 11:24 | Revert "Evitar Dashboard 1 vacio al cargar estructura" | — |
| 2026-08-05 11:34 | Interpretar dias vacantes con formato fecha | — |
| 2026-08-05 11:40 | Normalizar fechas en filtro de mes D1 | — |
| 2026-08-05 11:45 | Evitar anios invalidos en meses D1 | — |
| 2026-08-05 12:12 | Asignar sin asesor a Timoteo en D1 | — |
| 2026-08-05 12:21 | Usar nombre completo de Timoteo en D1 | — |
| 2026-08-05 13:28 | Corregir mascota-chat.png, bug de Dias Vacantes y ranking duplicado | [#241](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/241) |
| 2026-08-06 08:46 | Corregir bug de coma decimal es-MX: Dashboard 1 mostraba 29 en vez de 60 | [#242](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/242) |
| 2026-08-06 14:54 | Retrigger GitHub Pages deploy (el intento anterior se quedo atorado in_progress ~7min) | — |
| 2026-08-06 15:00 | Retrigger GitHub Pages deploy #2 (el intento anterior tambien se atoro y se cancelo manualmente) | — |
| 2026-08-06 09:40 | Recalcular TREO desde estructura diaria (Dashboard 1) | [#243](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/243) |
| 2026-08-06 15:46 | Cache-bust core.js/dashboard-definitions.js/column-aliases.js/admin-pptx-rae.js | — |
| 2026-08-06 15:53 | Retrigger GitHub Pages deploy (cache-bust d718b8c se atoro de nuevo) | — |
| 2026-08-06 16:08 | Retrigger deploy: incidente de GitHub Actions/Pages ya mitigado | — |
| 2026-08-06 16:28 | Agregar tabla 'Vacantes por Asesor · Dias' a Dashboard 1 | — |
| 2026-08-06 17:12 | Agregar detalle clicable a la tabla 'Vacantes por Asesor - Dias' | — |
| 2026-08-06 17:20 | Resaltar fila completa por semaforo de antiguedad en Detalle por Tienda | — |
| 2026-08-06 17:24 | Unificar colores del badge de dias con el semaforo de fila y renombrar columna a 'Dias Vacantes' | — |
| 2026-08-06 17:42 | Agregar orden por columna (clic en encabezado) a la tabla Detalle por Tienda | — |
| 2026-08-06 19:41 | Retrigger deploy (usuario solicito intentar pese al Major Outage de GitHub) | — |
| 2026-08-07 11:27 | Agregar Dashboard 8 (Capacidades 2026): certificaciones por asesor | [#244](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/244) |
| 2026-08-07 11:58 | Fix Dashboard 8 publish: allow Dashboard_8_Diario + update Apps Script URL | [#245](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/245) |
| 2026-08-07 12:03 | Corregir bug de coma decimal es-MX en Dashboard 3 | [#246](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/246) |
| 2026-08-10 08:23 | Corregir filtro de Asesor: clic en uno solo ya no requiere deseleccionar los demas | [#247](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/247) |
| 2026-08-10 08:43 | Agregar boton de descarga Excel completo por dashboard (una hoja por tabla) | [#248](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/248) |
| 2026-08-10 08:54 | Apagar backdrop-filter al exportar PNG (html2canvas no lo soporta) | [#249](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/249) |
| 2026-08-10 09:08 | Atribuir "Sin Asesor Asignado" a Timoteo en Dashboard 2 (igual que D1) | [#250](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/250) |
| 2026-08-10 09:19 | Quitar 4 certificaciones sin uso del Dashboard 8 (Capacidades 2026) | [#251](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/251) |
| 2026-08-10 09:28 | Corregir checkmark del filtro de Asesor en Dashboard 3 | [#252](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/252) |
| 2026-08-10 19:11 | Corregir falso match de keywords cortas en Oxxito (chatbot) | — |
| 2026-08-11 14:26 | Reconocer a Timoteo en la tabla Compromiso vs Resultado (Dashboard 2) | — |
| 2026-08-11 08:30 | (merge de PR #253) | [#253](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/253) |
| 2026-08-11 14:35 | Excluir tiendas de Entrenamiento/Operaciones en Dashboard 2 (Bajas) | — |
| 2026-08-11 08:37 | (merge de PR #254) | [#254](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/254) |
| 2026-08-11 09:11 | Dashboard 2: bajas de Entrenamiento/Operaciones a Timoteo + tabla Vacantes por Asesor sin scroll | [#255](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/255) |
| 2026-08-11 09:25 | Dashboard 2: corregir atribución de Entrenamiento/Operaciones a Sin Asesor Asignado | [#256](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/256) |
| 2026-08-11 16:07 | Dashboard 7 (TREO): excluir posiciones de Incapacidad de SAP/Activos | — |
| 2026-08-11 10:09 | Dashboard 7 (TREO): excluir posiciones de Incapacidad de SAP/Activos | [#257](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/257) |
| 2026-08-11 10:12 | (merge de PR #258) | [#258](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/258) |
| 2026-08-11 12:59 | Dashboard 3: fusionar Sin Asesor Asignado en Timoteo | [#259](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/259) |
| 2026-08-11 13:14 | Centralizar regla Sin Asesor Asignado = Timoteo en todos los dashboards | [#260](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/260) |
| 2026-08-11 13:44 | Agregar Mi Dashboard: vista personal por asesor de los 8 dashboards | [#261](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/261) |
| 2026-08-11 13:52 | Corregir Mi Dashboard: el selector de asesor no desplegaba la lista | [#262](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/262) |
| 2026-08-12 08:27 | Sacar Mi Dashboard de la grilla y darle su propia sección destacada | [#263](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/263) |
| 2026-08-12 08:53 | Mover Mi Dashboard hasta el final y usar el gradiente rojo OXXO | [#264](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/264) |
| 2026-08-12 09:14 | Panel admin: auto-calcular Bajas otras plazas al subir el Excel ABC | [#265](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/265) |
| 2026-08-12 09:23 | Panel admin: fusionar Bajas otras plazas dentro de Bajas diarias | [#266](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/266) |
| 2026-08-12 09:31 | Panel admin: fusionar también Movimientos ABC dentro de Bajas diarias | [#267](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/267) |
| 2026-08-12 09:59 | Panel admin: fusionar Aprovechamiento otras plazas dentro de Estructura | [#268](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/268) |
| 2026-08-12 10:13 | Agregar Mi Tienda: vista por tienda con buscador | [#269](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/269) |
| 2026-08-12 11:34 | Arreglar overflow horizontal en celular; desactivar candado por ahora | [#270](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/270) |
| 2026-08-12 11:44 | Panel admin: arreglar Aprovechamiento otras plazas publicando 0% | [#271](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/271) |
| 2026-08-12 11:50 | Panel admin: arreglar Aprovechamiento otras plazas publicando >9000% | [#272](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/272) |
| 2026-08-12 12:04 | Dashboard 3: arreglar parseo de Aprovechamiento por Plaza con coma decimal | [#273](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/273) |
| 2026-08-12 13:27 | Mi Tienda: agregar Ficha Tecnica TREO por tienda | [#274](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/274) |
| 2026-08-12 13:40 | Mi Tienda: convertir las 8 secciones en ficha visual con graficas | [#275](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/275) |
| 2026-08-12 13:48 | Mi Tienda: una sola ficha compacta en vez de 8 secciones largas | [#276](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/276) |
| 2026-08-12 13:57 | Corregir texto mal codificado (mojibake) que llega desde el origen de datos | [#277](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/277) |
| 2026-08-13 11:28 | Dashboard 7: separar Timoteo (hereda a Anadelia) de tiendas sin dato | [#278](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/278) |
| 2026-08-13 11:58 | Optimiza panel admin: cachea el parseo de hojas Excel | [#279](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/279) |
| 2026-08-13 12:29 | Rediseña Mi Tienda: resumen, alertas y jerarquia visual | [#280](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/280) |
| 2026-08-13 12:48 | Dashboard 1: permite filtrar por una sola tienda | [#281](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/281) |
| 2026-08-13 13:16 | Mi Tienda: aprovechamiento sin ausentismo y unión por CR de tiendas con nombre distinto | [#282](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/282) |
| 2026-08-13 13:40 | Mi Dashboard: misma ficha que Mi Tienda | [#283](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/283) |
| 2026-08-14 09:00 | resolveAsesorD1: snapshot fijo de tiendas de Anadelia, no texto por archivo | [#284](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/284) |
| 2026-08-14 09:43 | Reasignaciones: el proximo "caso Anadelia" ya no necesita tocar codigo | [#285](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/285) |
| 2026-08-14 09:58 | Reasignaciones: corrige aviso de error y actualiza URL de Apps Script | [#286](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/286) |
| 2026-08-14 10:09 | Reasignaciones: asignacion masiva para no escribir tienda por tienda | [#287](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/287) |
| 2026-08-14 11:00 | Corrige corrupcion de gviz en Catalogo_Asesores con lectura directa | [#288](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/288) |
| 2026-08-14 11:28 | Limpieza de fallback muerto + documentacion de onboarding | [#289](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/289) |
| 2026-08-14 12:04 | Agrega panel de Faltantes y Sobrantes a Mi Tienda | [#290](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/290) |
| 2026-08-14 12:17 | Actualiza URL de Apps Script (Dashboard_9_Semanal en whitelist) | [#291](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/291) |
| 2026-08-14 12:21 | Rellena Semana vacia en Faltantes y Sobrantes para no perder filas | [#292](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/292) |
| 2026-08-14 12:25 | Ancla el respaldo de Semana al mes de la hoja, no a la Fecha | [#293](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/293) |
| 2026-08-14 12:38 | Agrupa el detalle de Faltantes y Sobrantes por mes | [#294](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/294) |
| 2026-08-14 13:40 | Agrega acordeon mensual a Vacantes, Bajas, Tiempo Extra y Ausentismos | [#295](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/295) |
| 2026-08-14 13:43 | Actualiza los ?v= de cache-busting tras los cambios de esta sesion | [#296](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/296) |
| 2026-08-14 13:59 | Cambia "Ver detalle" a un modal en vez de expandir en linea | [#297](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/297) |
| 2026-08-17 08:32 | Los acordeones mensuales tambien abren el modal | [#298](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/298) |
| 2026-08-17 09:05 | Agrega dashboard-9.html: Faltantes y Sobrantes (dashboard semanal) | [#299](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/299) |
| 2026-08-17 10:29 | Balance de Caja: análisis exploratorio de Faltantes y Sobrantes | [#300](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/300) |
| 2026-08-17 10:41 | Corregir colores del ranking y la dona en Faltantes y Sobrantes | [#301](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/301) |
| 2026-08-17 10:49 | Cambiar Ranking de Asesores a barras verticales descendentes | [#302](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/302) |
| 2026-08-17 10:54 | Quitar gráfica de Asesores duplicada en Faltantes y Sobrantes | [#303](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/303) |
| 2026-08-17 11:03 | Reactivar el candado de acceso al sitio | [#304](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/304) |
| 2026-08-17 11:06 | Actualizar contraseña del candado de acceso al sitio | [#305](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/305) |
| 2026-08-17 11:17 | Subir cache-busting de site-lock.js en las 14 páginas públicas | [#306](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/306) |
| 2026-08-17 11:26 | Unificar el rojo de marca en un solo token (#F71926) | [#307](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/307) |
| 2026-08-17 11:35 | Corregir colisiones de dashboard-skin.css en D4 y D6 (mismo bug que D9) | [#308](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/308) |
| 2026-08-17 11:45 | Escapar HTML de campos de Sheets en D1, D5, D6, D7, D8 y core.js | [#309](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/309) |
| 2026-08-17 11:48 | Escapar HTML del motivo de baja en Mi Dashboard y Mi Tienda | [#310](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/310) |
| 2026-08-17 12:20 | Forzar nuevo deploy de Pages | [#311](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/311) |
| 2026-08-17 12:31 | Unificar el &lt;title&gt; de todos los dashboards a "Dashboards Ats" | [#312](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/312) |
| 2026-08-17 12:36 | Hacer accesibles por teclado las tarjetas KPI clicables de D4 y D9 | [#313](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/313) |
| 2026-08-17 12:38 | Agregar cierre con Escape a 3 modales que no lo tenían | [#314](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/314) |
| 2026-08-17 12:40 | Quitar console.log de debug y assets sin usar | [#315](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/315) |
| 2026-08-17 12:46 | Corregir 2 colisiones de breakpoints entre dashboard-skin.css y D6/D9 | [#316](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/316) |
| 2026-08-17 12:51 | Quitar fecha de las tarjetas de TREO, Capacidades y Faltantes/Sobrantes | [#317](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/317) |
| 2026-08-17 12:58 | Desactivar el chatbot Oxxito (sin quitarlo) | [#318](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/318) |
| 2026-08-17 13:50 | Agregar panel de Personal FLEX en Mi Tienda (Dashboard 10) | [#319](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/319) |
| 2026-08-18 08:11 | Enriquecer los modales "Ver detalle" de Mi Tienda | [#320](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/320) |
| 2026-08-18 08:23 | Agregar panel de Registro y Apego a Horario en Mi Tienda (Dashboard 11) | [#321](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/321) |
| 2026-08-18 08:30 | Actualizar URL del Apps Script tras redeploy con Dashboard 11 | [#322](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/322) |
| 2026-08-18 08:49 | Restaurar action=readSheet en doGet (Apps Script) | [#323](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/323) |
| 2026-08-18 08:55 | Actualizar URL del Apps Script tras restaurar action=readSheet | [#324](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/324) |
| 2026-08-18 08:58 | Agregar 'Reasignaciones' a ALLOWED_SHEETS | [#325](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/325) |
| 2026-08-18 09:49 | Corregir loadReasignaciones: gviz devolvia Dashboard 1 en vez de error | [#326](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/326) |
| 2026-08-18 09:59 | Actualizar URL del Apps Script tras redeploy con Reasignaciones | [#327](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/327) |
| 2026-08-18 10:18 | Volver a leer Reasignaciones por gviz, con coincidencia exacta | [#328](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/328) |
| 2026-08-18 10:34 | Corregir columna de Tienda en D10/D11 de Mi Tienda: colisionaba con CR | [#329](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/329) |
| 2026-08-18 11:11 | Quitar el modo oscuro: codigo muerto, el boton nunca existio | [#330](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/330) |
| 2026-08-18 11:16 | Arreglar el sistema de color semaforo: verde/azul colapsaban a dorado/rojo | [#331](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/331) |
| 2026-08-18 11:52 | Corregir paleta fuera de marca en .compromiso-table | [#332](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/332) |
| 2026-08-18 12:00 | Evitar colision del hero de Mi Tienda/Mi Dashboard con dashboard-skin.css | [#333](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/333) |
| 2026-08-18 12:10 | Reemplaza emojis decorativos de KPI por iconos SVG | [#334](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/334) |
| 2026-08-18 12:29 | Consolida colores de admin.html a variables de marca | [#335](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/335) |
| 2026-08-18 12:44 | Extiende reemplazo de emojis a títulos, pestañas e íconos de sección | [#336](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/336) |
| 2026-08-18 13:03 | Corrige porcentajes x100 inflados en Registro y Apego a Horario | [#337](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/337) |
| 2026-08-18 19:27 | Agrega registro de uso de IA (Norma FEMSA 02.05.09.6) | [#338](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/338) |
| 2026-08-18 19:31 | Quitar unidades de Entrenamiento/Operaciones del buscador de Mi Tienda | [#339](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/339) |
| 2026-08-18 19:50 | Descartar filas basura con Tienda puramente numérica | [#340](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/340) |
| 2026-08-19 13:59 | Corregir hueco vacío en KPIs de Dashboard 9 (Balance de Caja) | [#341](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/341) |
| 2026-08-19 15:06 | Corregir 2 bugs encontrados al auditar los generadores de presentaciones | [#342](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/342) |
| 2026-08-19 15:41 | Corregir 'Sin Asesor Asignado' en ranking de Aprovechamiento de presentaciones | [#343](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/343) |
| 2026-08-19 16:17 | Agrega pestañas tipo carpeta (RH / Comercial) arriba de Dashboards Diarios | [#344](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/344) |
| 2026-08-19 16:52 | Ocultar Mi Dashboard/Mi Tienda en Comercial; renombrar hero a "Torre de Control" | [#345](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/345) |
| 2026-08-19 17:17 | Ampliar el modal de detalle para que quepan tablas anchas | [#346](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/346) |
| 2026-08-21 15:48 | Validar la contraseña del panel admin contra el servidor | [#347](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/347) |
| 2026-08-21 16:22 | Filtrar el Detalle por Empleado al hacer clic en un asesor (D8) | [#348](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/348) |
| 2026-08-21 16:30 | Abrir la ficha del empleado al hacer clic en el Detalle por Empleado (D8) | [#349](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/349) |
| 2026-08-21 17:24 | Dashboard 12 - Enfoque del Líder (mensual, con histórico de 12 meses) | [#350](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/350) |
| 2026-08-21 17:32 | Documentar el redespliegue del Apps Script sin cambiar la URL | [#351](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/351) |
| 2026-08-21 17:42 | Apuntar ADMIN_UPLOAD_URL a la implementación con Dashboard_12_Mensual | [#352](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/352) |
| 2026-08-21 19:45 | Dashboard 13 - Control de Ausentismo | [#353](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/353) |
| 2026-08-21 19:50 | Aceptar los dos formatos de fecha en el Dashboard 13 | [#354](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/354) |
| 2026-08-24 16:17 | Seguridad: quitar datos innecesarios, frenar la fuerza bruta y sacar el sitio de los buscadores | [#355](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/355) |
| 2026-08-24 19:20 | Dashboard 13: semáforo de seguimiento y mapa de calor por asesor y mes | [#356](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/356) |
| 2026-08-25 16:37 | Dashboard 13: rediseño del ranking de días perdidos por asesor y mes | [#357](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/357) |
| 2026-08-25 17:23 | Dashboard 13: clic en una clasificación filtra el dashboard | [#358](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/358) |
| 2026-08-25 18:05 | Dashboard 13: barras verticales ascendentes en el ranking mensual de asesores | [#359](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/359) |
| 2026-08-25 18:29 | Dashboard 13: icono de estetoscopio en la tarjeta de inicio | [#360](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/360) |
| 2026-08-25 18:57 | Agrega Dashboard 14: Avance Comercial | [#361](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/361) |
| 2026-08-25 19:06 | Actualiza ADMIN_UPLOAD_URL a la nueva implementacion de Apps Script | [#362](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/362) |
| 2026-08-25 19:15 | Panel admin: Dashboard 14 era inalcanzable desde la pestaña Comercial | [#363](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/363) |
| 2026-08-26 17:11 | Dashboard 14: la barra de avance del KPI ahora anima de verdad al filtrar | [#364](https://github.com/humanresources-oxxo/DashboardsOxxo/pull/364) |
<!-- BITACORA_END -->

## Referencias

- Norma Corporativa FEMSA 02.05.09.6 · Seguridad en Inteligencia Artificial (IA).
- [docs/SOPORTE.md](./SOPORTE.md), [docs/ARQUITECTURA_CODIGO.md](./ARQUITECTURA_CODIGO.md) — documentación técnica del proyecto.
