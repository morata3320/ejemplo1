# Pruebas y publicación

El workflow `.github/workflows/pages.yml` ejecuta en cada push a main, pull request a main y ejecución manual:

- `node --check` para todos los JS, CJS y MJS del proyecto.
- Pruebas funcionales de navegación, teclado, observabilidad y HTTP local.
- Controles básicos de XSS, scripts externos, HTTPS, privacidad y patrones reconocibles de secretos en los archivos actuales. No constituyen un detector exhaustivo de secretos ni revisan el historial.
- CodeQL con security-extended para JavaScript y GitHub Actions. Cualquier resultado SARIF bloquea la publicación, incluso de nivel informativo; la falta de informes también falla.
- Pruebas de la propia puerta SARIF con casos limpios, hallazgos y análisis fallidos.

Solo se despliega main cuando ambos jobs terminan correctamente. Los pull requests nunca publican. El artefacto incluye únicamente los seis archivos HTML, CSS y JS del sitio. Tras desplegar se compara el contenido HTTPS de los seis archivos con el commit publicado. Un fallo de esta comprobación marca el workflow como fallido, pero no revierte automáticamente una publicación ya realizada.

Las Actions usan commits fijos, permisos mínimos y checkout sin credenciales persistidas. Dependabot propone actualizaciones semanales de Actions. No hay dependencias npm de aplicación o pruebas que requieran npm audit.

## Ejecutar localmente

Requiere Git y Node.js 24 o superior:

```sh
node tools/ci.cjs
```

CodeQL se ejecuta en GitHub Actions; los informes se comprueban antes del despliegue. La salida del analizador y de la puerta queda en los logs de Actions (no se sube a Code Scanning).

## Alcance

Las pruebas de DOM usan simulaciones; no equivalen a pruebas visuales en navegador ni a una auditoría completa de seguridad. Revisar manualmente el sitio y el dashboard con teclado y tamaños móviles. Las imágenes existentes se cargan desde Wikimedia; el recolector no envía información a servicios externos.

GitHub Pages debe usar GitHub Actions como origen de publicación. Flujo basado en la [documentación oficial de Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).