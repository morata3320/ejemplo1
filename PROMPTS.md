# Registro de Prompts

Herramienta utilizada: **OpenCode**

---

## Prompt 1

Realiza una auditoría no destructiva de index.html, styles.css y script.js según WCAG 2.2 AA, UX y diseño responsive.

Revisa como mínimo: estructura semántica, jerarquía de encabezados, nombres accesibles, textos alternativos, contraste, navegación con teclado, foco visible, uso correcto de botones y enlaces, ARIA, objetivos táctiles, navegación móvil, overflow horizontal, imágenes, errores JavaScript y comportamiento en 320px, 390px, 768px y escritorio.

No modifiques ningún archivo. Devuelve un informe Markdown llamado AUDITORIA.md con esta estructura:

1. Resumen ejecutivo.
2. Hallazgos críticos, altos, medios y bajos.
3. Evidencia concreta indicando archivo y elemento afectado.
4. Recomendación de corrección para cada hallazgo.
5. Pruebas que deberían repetirse después de corregir.

Si un criterio cumple, indícalo también. No inventes problemas que no puedas justificar con el código; indica exactamente qué verificaste y qué quedó pendiente de probar manualmente en el navegador.

Además, guarda este prompt en un archivo Markdown llamado PROMPTS.md dentro del proyecto. Si el archivo ya existe, añade este prompt al final sin borrar ni modificar los prompts anteriores. Indica la herramienta utilizada, en este caso OpenCode, y numera el prompt de forma consecutiva. Esta es la única excepción a la instrucción de no modificar archivos.

---

## Prompt 2

Herramienta utilizada: **Codex**

Lee AUDITORIA.md y aplica las correcciones necesarias en index.html, styles.css y script.js.

Prioriza los hallazgos críticos, altos y medios. Conserva la identidad visual y el contenido existente. No uses frameworks ni reescribas archivos sin necesidad. Mejora semántica, accesibilidad, teclado, foco, contraste, responsive, imágenes y errores de JavaScript según corresponda.

Después valida la sintaxis JavaScript, revisa las rutas de recursos y resume cada corrección. No marques una recomendación como resuelta si no puedes relacionarla con un cambio concreto o una prueba plenamente en el navegador.

Además, guarda este prompt en el archivo PROMPTS.md dentro del proyecto. Si el archivo ya existe, añade este prompt al final sin borrar ni modificar los anteriores. Identifica la herramienta utilizada como Codex y numera el prompt de forma consecutiva.
---

## Prompt 3

Herramienta utilizada: **Codex**

Añade observabilidad local al sitio existente sin backend, servicios externos ni envío de datos.

Crea o actualiza estos archivos dentro de paginaCristianoRonaldo:
- observabilidad.html
- observabilidad.css
- observabilidad.js
- script.js, si es necesario para instrumentar la página principal

Registra en localStorage, usando una clave con el prefijo cr7-observability:
- tiempo de navegación y carga mediante Performance API cuando esté disponible;
- errores JavaScript y promesas rechazadas;
- errores de carga de recursos;
- clics en enlaces, botones y controles;
- cambios de visibilidad de la pestaña;
- viewport, conexión y soporte de APIs.

Expón window.CR7Observability.getSnapshot(). El dashboard debe permitir actualizar los datos, generar un evento de demostración, limpiar el almacenamiento y descargar un snapshot JSON. Usa HTML semántico, estados accesibles y diseño responsive. Mantén compatibilidad si alguna API del navegador no existe.

Al terminar, valida node --check para todos los archivos JavaScript y explica cómo probar el dashboard manualmente.

Además, guarda este prompt en el archivo PROMPTS.md dentro del proyecto. Si el archivo ya existe, añade este prompt al final sin borrar ni modificar los anteriores. Identifica la herramienta utilizada como Codex y numera el prompt de forma consecutiva.