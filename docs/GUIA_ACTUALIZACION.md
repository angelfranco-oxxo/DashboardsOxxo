# Guia de actualizacion de bases

Esta guia explica como actualizar los dashboards sin tocar codigo.

## Pasos generales

1. Abre `admin.html`.
2. Ingresa la contrasena del panel.
3. Selecciona el dashboard destino.
4. Selecciona la hoja correcta del Excel si el archivo trae varias hojas.
5. Sube el Excel.
6. Revisa la validacion:
   - Archivo leido.
   - Columnas obligatorias.
   - Filtro Oaxaca.
   - Regla aplicada.
7. Si todo esta en verde, publica en Sheets.
8. Abre el dashboard y usa `Ctrl + F5` si el navegador conserva cache.

## Reglas generales

- Todos los dashboards trabajan con Plaza Oaxaca.
- El panel ignora columnas extra cuando no son necesarias.
- El catalogo de asesores corrige el asesor por CR/Tienda cuando existe coincidencia.
- Si una columna cambia de nombre, primero intenta cargar el archivo: el panel tiene alias comunes.
- Si el panel marca columnas faltantes, revisa si el archivo trae encabezados distintos o filas de titulo antes de los encabezados.

## Administrativo - Inventarios

1. Selecciona `Administrativo - Inventarios`.
2. Sube el archivo `.xlsm` de Resultados de Inventario.
3. El panel selecciona automaticamente la hoja `Resultado de Inventario`.
4. Confirma que la validacion muestre el periodo `AAAA-MM` y las filas utiles.
5. Presiona `Publicar en Sheets`.

El periodo se obtiene del mes y ano escritos en el nombre del archivo, por ejemplo `Julio 2026`. La publicacion reemplaza solamente ese periodo y conserva los meses anteriores.

## Dashboard 1 - Vacantes diarias

Base esperada: estructura/vacantes.

Columnas clave:

- Plaza
- Asesor
- Unidad org
- CR TIENDA
- ID posiciones
- Descripcion de Posicion
- Status ocupacion
- Fecha
- Dias Vacantes
- Mes

Reglas:

- Solo toma registros de Plaza Oaxaca.
- Solo toma posiciones vacantes/no ocupadas.
- El mes se toma del nombre del archivo cuando el archivo trae fecha en el titulo.
- Si no existe Dias Vacantes, lo intenta derivar del texto de status ocupacion.
- Mas de 500 dias vacantes se considera Tienda nueva.

## Dashboard 2 - Bajas diarias

Bases relacionadas:

- Bajas diarias.
- Movimientos ABC.
- Bajas de otras plazas.
- Plan de accion.

Columnas clave de bajas:

- Plaza
- Asesor
- Nombre del empleado
- No Personal
- Fecha
- Mes
- Semana
- Temporalidad
- Rot_Temp
- Puesto
- Tienda

Reglas:

- Solo toma Plaza Oaxaca para la base principal.
- El mes puede derivarse del titulo del archivo si viene con fecha, por ejemplo `ABC 10.07.2026`.
- El ranking de otras plazas se puede capturar manualmente desde el panel.

## Dashboard 3 - Aprovechamiento de estructura

Base esperada: medicion de estructura.

Columnas clave:

- Plaza
- CR TIENDA
- Asesor
- Tienda
- Estructura Diaria
- Aprovechamiento Estructura
- Estatus Con impacto Ausentismo
- FECHA

Reglas:

- Solo toma Plaza Oaxaca.
- Aprovechamiento Estructura menor a 95% cuenta como 0%.
- Aprovechamiento Estructura mayor o igual a 95% cuenta como 100%.
- El catalogo de asesores corrige responsables por CR/Tienda.

## Dashboard 4 - Tiempo extra

Base esperada: tiempo extra semanal.

Columnas clave:

- Plaza
- Asesor
- Numero de personal
- Nombre del empleado o candidato
- Textos homologados
- Texto breve de unidad organizativa
- Cantidad
- Importe
- Semana

Reglas:

- Cantidad se usa como horas.
- Importe se usa como gasto.
- El filtro de semana permite analizar una o varias semanas cargadas.

## Dashboard 5 - Vacaciones

Base esperada: vacaciones operativas.

Columnas clave:

- Plaza
- Asesor
- Tienda
- Puesto
- No. De Empleado
- Nombre
- Dias_Restantes

Reglas:

- Total dias restantes es la metrica principal.
- Permite revisar colaboradores con saldo y priorizar por rangos.

## Dashboard 6 - Ausentismos

Base esperada: absentismos y presencias.

Columnas clave:

- Plaza
- Asesor
- N de personal
- Nombre del empleado o candidato
- Tienda
- Tipo_Ausentismo
- Denominacion
- Absentismos solo en la semana
- Semana

Reglas:

- La metrica principal es Absentismos solo en la semana.
- Semana se usa como filtro principal.

## Dashboard 7 - TREO

Base esperada: liberacion de estructura/TREO.

Columnas clave:

- Plaza
- CR
- Tienda
- Asesor
- Estructura Propuesta TREO P2 Jun - Ago
- Estructura SAP
- Empleados Activos
- Vacantes
- Movimiento Inicial

Reglas:

- TREO, SAP, activos y vacantes alimentan la tabla principal.
- El catalogo de asesores puede corregir asesor por CR/Tienda.

## Dashboard 12 - Enfoque del Lider

Base esperada: `Reporte Enfoque del Lider` (una fila por tienda por mes).

Columnas clave:

- Mes
- CR TIENDA / TIENDA / ASESOR
- LIDER / RFC-NO. EMP / EP O LC
- INGRESO / EQUIPO / CLIENTE (los tres semaforos)
- CLAS FINAL (la etapa del mes)

Reglas:

- **Este es el unico dashboard que NO reemplaza toda la pestana.** Se publica
  por periodo sobre la columna `Mes`: subir el reporte de un mes reemplaza
  solo ese mes y conserva los anteriores. El historico de 12 meses es lo que
  alimenta las dos graficas de tendencia, asi que no se debe borrar la
  pestana a mano.
- Sube el archivo completo tal como sale del reporte; el panel se queda con
  Plaza Oaxaca y normaliza las columnas.
- El Excel de origen trae `MEP P.P.` y `EVALUACION OPERATIVA` repetidas dos
  veces cada una (primero el valor numerico, despues su OK / NO OK). El panel
  ya resuelve la segunda por posicion; no hay que renombrar nada en el Excel.
- La letra A+/A/B/C/N no se publica: es un recodificado 1 a 1 de `CLAS FINAL`
  y el dashboard la deriva sola.
- La etapa se toma tal cual del reporte. El reporte la arrastra un mes cuando
  el lider ya la habia cerrado, asi que en algunos renglones la etapa no
  coincide al pie de la letra con los tres semaforos. Es el comportamiento
  esperado, no un error de carga.

## Redesplegar el Apps Script sin romper la URL

Solo hace falta cuando se cambia `apps-script/admin-upload.gs` (por ejemplo,
al agregar una pestana nueva a `ALLOWED_SHEETS`).

**Camino correcto** (conserva la URL, no se toca ningun archivo del repo):

1. Abre el proyecto de Apps Script y pega el `.gs` actualizado.
2. `Implementar` > `Administrar implementaciones`.
3. Selecciona la implementacion que ya esta activa.
4. Clic en el **icono de lapiz (Editar)**, arriba a la derecha.
5. En `Version` elige **"Nueva version"**, escribe una descripcion.
6. `Implementar`.

La URL `/exec` es la misma de siempre. Cada implementacion tiene su propio ID
y su propia direccion estable; lo que cambia con cada version es el codigo que
sirve, no la direccion.

**Camino que cuesta caro:** el boton `Nueva implementacion` crea una
implementacion DISTINTA con URL nueva, y deja la anterior viva pero congelada
con el codigo de ese momento. Si se usa ese camino hay que copiar la URL nueva
a `ADMIN_UPLOAD_URL` en `js/config.js` y publicar el cambio, o el panel seguira
hablando con la version vieja.

Sintoma tipico de haber caido ahi: publicas un cambio en el `.gs`, la
implementacion aparece como exitosa, pero el panel admin sigue comportandose
como antes (por ejemplo, sigue rechazando una pestana que ya agregaste a
`ALLOWED_SHEETS`).

Despues de redesplegar, verifica en el panel admin que la pestana nueva ya
acepte una publicacion de prueba.

## Catalogo de asesores

Base esperada: catalogo actualizado de tiendas y responsables.

Columnas clave:

- ASESOR
- TIENDA
- CR TIENDA

Uso:

- Se carga desde el panel admin como `Catalogo de asesores`.
- Sirve como fuente compartida para corregir asesores en los dashboards.
- Si una tienda cambia de asesor, actualiza primero este catalogo.
