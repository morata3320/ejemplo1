# Pruebas y publicación

El workflow `.github/workflows/pages.yml` ejecuta en cada push a main, pull request a main y ejecución manual:

- `node --check` para todos los JS, CJS y MJS del proyecto.
- Pruebas funcionales de navegación, teclado, observabilidad y HTTP local.
- Controles básicos de XSS, scripts externos, HTTPS, privacidad y patrones reconocibles de secretos en los archivos actuales. No constituyen un detector exhaustivo de secretos ni revisan el historial.
- CodeQL con security-extended para JavaScript y GitHub Actions. Cualquier resultado SARIF bloquea la publicación, incluso de nivel informativo; la falta de cualquiera de los informes obligatorios (actions.sarif y javascript.sarif) también falla.
- Pruebas de la propia puerta SARIF con casos limpios, hallazgos y análisis fallidos.

Solo se despliega main cuando ambos jobs terminan correctamente. Los pull requests nunca publican. El artefacto incluye únicamente los seis archivos HTML, CSS y JS del sitio. Tras desplegar se comparan por bytes los seis archivos HTTPS con el artefacto .site. Se reintentan hasta 12 veces los errores de red, timeout, lectura, HTTP y contenido divergente, con 15 segundos de timeout y 5 segundos entre intentos. Los archivos se verifican en paralelo; el presupuesto de red por archivo es de hasta 235 segundos. Un fallo de esta comprobación marca el workflow como fallido, pero no revierte automáticamente una publicación ya realizada.

Las Actions usan commits fijos, permisos mínimos y checkout sin credenciales persistidas. Dependabot propone actualizaciones semanales de Actions. No hay dependencias npm de aplicación o pruebas que requieran npm audit.

## Ejecutar localmente

Requiere Git y Node.js 24 o superior:

```sh
node tools/ci.cjs
```

CodeQL se ejecuta en GitHub Actions; los informes se comprueban antes del despliegue. Los hallazgos se publican en Security > Code scanning y la puerta muestra regla, archivo y línea en los logs de Actions.

## Alcance

Las pruebas de DOM usan simulaciones; no equivalen a pruebas visuales en navegador ni a una auditoría completa de seguridad. Revisar manualmente el sitio y el dashboard con teclado y tamaños móviles. Las imágenes existentes se cargan desde Wikimedia; el recolector no envía información a servicios externos.

GitHub Pages debe usar GitHub Actions como origen de publicación. Flujo basado en la [documentación oficial de Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).
Las regresiones de despliegue se ejecutan sin red en tests/despliegue.cjs antes de publicar. El verificador exige HTTPS, rechaza redirecciones y registra archivo, intento y causa de fallo.
