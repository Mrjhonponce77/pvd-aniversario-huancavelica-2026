# Publicacion gratuita en GitHub Pages + Google Sheets

Este sitio esta preparado para funcionar gratis con:

- GitHub Pages: publica los archivos `index.html`, `styles.css`, `data.js` y `app.js`.
- Google Sheets + Apps Script: guarda los datos vivos del campeonato.
- Panel admin: permite editar desde celular y publicar cambios usando un token privado.

## 1. Crear Google Sheet

1. Crea una hoja en Google Drive con este nombre sugerido:
   `PVD Aniversario Huancavelica 2026 - Datos`
2. Copia el ID de la hoja desde la URL.
   Ejemplo:
   `https://docs.google.com/spreadsheets/d/ESTE_ES_EL_ID/edit`

## 2. Crear Apps Script

1. En la hoja, entra a `Extensiones > Apps Script`.
2. Borra el contenido inicial.
3. Pega el contenido completo de `google-apps-script.gs`.
4. Cambia estos valores:
   - `SPREADSHEET_ID`: pega el ID de tu Google Sheet.
   - `SECRET_TOKEN`: usa una clave larga, por ejemplo `PVD-HVCA-2026-UNA-CLAVE-LARGA`.
5. Guarda el proyecto.
6. Ejecuta manualmente la funcion `setup` una vez y acepta permisos.

## 3. Publicar Apps Script como Web App

1. En Apps Script pulsa `Implementar > Nueva implementacion`.
2. Tipo: `Aplicacion web`.
3. Ejecutar como: `Yo`.
4. Quien tiene acceso: `Cualquier persona`.
5. Copia la URL final que termina en `/exec`.

Esa URL sera usada dos veces en el panel:

- `URL publica de lectura (Apps Script /exec)`
- `URL privada de escritura (Apps Script /exec)`

El token no se guarda en el sitio. Se ingresa solo cuando se quiere publicar desde el panel admin.

## 4. Cargar datos iniciales

1. Abre el sitio local.
2. Entra al panel admin.
3. Abre `Respaldo y sincronizacion`.
4. Pega la URL `/exec` en lectura y escritura.
5. Pulsa `Guardar URLs`.
6. Ingresa el token privado.
7. Pulsa `Publicar en Google Sheets`.
8. Pulsa `Sincronizar ahora` para comprobar lectura.

## 5. Publicar en GitHub Pages

1. Crea un repositorio nuevo en GitHub.
2. Sube todos los archivos de esta carpeta:
   - `index.html`
   - `styles.css`
   - `data.js`
   - `app.js`
   - `.nojekyll`
   - `google-apps-script.gs`
   - `README-PUBLICACION.md`
3. En GitHub entra a `Settings > Pages`.
4. Source: `Deploy from a branch`.
5. Branch: `main`, carpeta `/root`.
6. Guarda y espera la URL de GitHub Pages.

## 6. Uso el dia del evento

1. Abre la web publicada desde el celular.
2. Entra al panel admin.
3. Edita equipos, fixture, resultados o fase final.
4. Abre `Respaldo y sincronizacion`.
5. Ingresa el token privado.
6. Pulsa `Publicar en Google Sheets`.

La pagina publica intentara refrescar datos remotos cada 30 segundos.

## Recomendacion de seguridad

Esta solucion es gratuita y suficiente para un evento institucional pequeno. No publiques el token en GitHub, WhatsApp ni capturas. Si el token se filtra, cambia `SECRET_TOKEN` en Apps Script y vuelve a implementar.
