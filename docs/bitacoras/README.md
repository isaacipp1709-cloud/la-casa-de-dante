# Metodología de Bitácoras

## Propósito
Las bitácoras documentan de manera secuencial e inmutable cada sesión de trabajo, decisión técnica, configuración y fase de desarrollo de **La Casa de Dante**.

## Estructura de una Bitácora
Cada bitácora se almacenará en `docs/bitacoras/session-XX.md` y debe contener:
1. **Contexto / Objetivo:** Qué se busca lograr en la sesión.
2. **Decisiones Arquitectónicas:** Elecciones tomadas y su justificación.
3. **Acciones Realizadas:** Cambios en el código, configuraciones, creación de subagentes.
4. **Validación:** Comprobación del estado tras la sesión (ej. chequeos de seguridad, aislamientos).
5. **Siguiente Paso:** Qué queda pendiente para la próxima sesión.

## Reglas de la Bitácora
- No se modifican bitácoras anteriores (son *append-only* mentalmente).
- Todo cambio de paradigma o refactorización masiva requiere su propia bitácora que referencie el motivo del cambio.
