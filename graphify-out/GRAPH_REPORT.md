# Graph Report - la-casa-de-dante  (2026-10-21)

## Corpus Check
- 135 files · ~95,306 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 6 file(s) not represented in the graph (top: .woff 2, .example 1, (none) 1)

## Summary
- 1075 nodes · 2303 edges · 67 communities (57 shown, 10 thin omitted)
- Extraction: 95% EXTRACTED · 5% INFERRED · 0% AMBIGUOUS · INFERRED: 120 edges (avg confidence: 0.91)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `58b1bb59`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- DanteBridgeImpl
- chat-history-state.ts
- credential-service.ts
- index.ts
- connections.ts
- EXPEDIENTE DE CONTEXTO INTEGRAL DEL PROYECTO: DANTE AI
- credential-handlers.ts
- client-session.ts
- provider-dispatch.test.ts
- Session 02: Cierre de Sesión de Rescate y Preservación de Infraestructura
- requireAuthorizedOwner
- EXPEDIENTE TÉCNICO CLÍNICO INTEGRAL DE PRODUCCIÓN
- gemini.ts
- main
- authorizedFetch
- sidebar-nav.tsx
- credential-core-flow.test.ts
- cli.mjs
- package.json
- danteBridge
- compilerOptions
- security-hardening.test.ts
- connections-panel.tsx
- conversation-history.test.ts
- read-checks.mjs
- credential-manager.tsx
- credential-selector.tsx
- dependencies
- scripts
- zod
- credential-runtime.ts
- require-owner.ts
- credential-service.test.ts
- vault.test.mjs
- Bitácora de Sesión 03 — API de Chat Offline
- devDependencies
- system-status-panel.tsx
- Resiliencia
- Continuidad de Proyecto y Estado Activo
- Definición de Subagentes Oficiales
- bitacora-session-04.md
- 3. Pruebas Automatizadas y Validación
- 11. Guía Visual Quirúrgica Paso a Paso: "Lo que Isaac debe hacer"
- crm/page.tsx
- bitacora-session-02.md
- verify-chat-ui.ts
- Session 01: Inspección y Configuración de Subagentes
- chat/route.ts
- vercel.json
- Metodología de Bitácoras
- 4. Inventario Estructural de Repositorios y Archivos Creados
- Políticas de Seguridad (La Casa de Dante)
- contracts/errors.ts
- Bitácora - Session 01: Inicialización Fundacional
- Arquitectura Fundacional: La Casa de Dante
- 3. Diagramas de Arquitectura y Flujos de Integración Cloud
- extends
- huggingface.ts
- next.config.mjs
- postcss.config.mjs
- tailwindcss
- ROADMAP.md

## God Nodes (most connected - your core abstractions)
1. `requireAuthorizedOwner()` - 37 edges
2. `danteBridge` - 37 edges
3. `DanteBridgeImpl` - 35 edges
4. `MockDanteProvider` - 35 edges
5. `authorizedFetch()` - 31 edges
6. `ValidationError` - 30 edges
7. `main()` - 30 edges
8. `next` - 27 edges
9. `CredentialService` - 24 edges
10. `react` - 23 edges

## Surprising Connections (you probably didn't know these)
- `3.3 Experiencia Defensiva sin Sesión en `/`` --references--> `ChatShell()`  [INFERRED]
  docs/informes/INFORME_TECNICO_CLINICO_DANTE_2026-10-21.md → src/components/chat/chat-shell.tsx
- `9.2 La Solución Quirúrgica de Dante: Memoria Volátil Pura` --references--> `signOut()`  [INFERRED]
  docs/informes/INFORME_CONTEXTO_JARVIS_DANTE_2026-10-21.md → src/lib/auth/client-session.ts
- `2. Seguridad en Terminales de Acceso Público` --references--> `signOut()`  [INFERRED]
  PROJECT_CONTINUITY.md → src/lib/auth/client-session.ts
- `Timeout` --references--> `chatWithDante()`  [INFERRED]
  ARCHITECTURE.md → src/lib/dante-bridge/client.ts
- `Objetivo` --references--> `MockDanteProvider`  [INFERRED]
  🤖👨💻☘️💾👀 Bitácora de Sesiones/2026-10-01/03_api-chat-offline/bitacora-session-03.md → src/lib/dante-bridge/mock-provider.ts

## Import Cycles
- None detected.

## Communities (67 total, 10 thin omitted)

### Community 0 - "DanteBridgeImpl"
Cohesion: 0.07
Nodes (24): AgentConnectionsResponse, ConnectionsStatusResponse, BridgeStatus, ownerAssertionHeaders(), buildCoreEndpointUrl(), chatWithDante(), chatWithDanteWithRetry(), checkDanteHealth() (+16 more)

### Community 1 - "chat-history-state.ts"
Cohesion: 0.07
Nodes (48): C. Eliminación de Colisiones de Identificadores, 1. Fase A — Checkpoint Local del Bloque Previo (Intacto), 2.1 Coordinación por Roles, 2.2 Defectos Críticos Corregidos (Secciones 5.A–5.E y Cierre Final de Fase B), 2. Fase B — Cierre Endurecido de Historial Real, Concurrencia y Contratos, 3.1 Escenarios Verificados en `tests/conversation-history.test.ts` (13/13 PASS), 3.2 Resultados de Comandos de Verificación, 3. Verificación y Suite de Pruebas (Rol B) (+40 more)

### Community 2 - "credential-service.ts"
Cohesion: 0.06
Nodes (27): cloneRecord(), CredentialRecord, CredentialStore, CredentialStoreError, EncryptedCredentialPayload, InMemoryCredentialStore, BYOK_PROVIDER_IDS, BYOK_PROVIDERS (+19 more)

### Community 3 - "index.ts"
Cohesion: 0.11
Nodes (36): dynamic, DanteAnalyticsSchema, DanteBridgeState, DanteChatResponseSchema, DanteConnectionSchema, DanteConnectionsResponseSchema, DanteConversationsResponseSchema, DanteDocumentIngestionRequestSchema (+28 more)

### Community 4 - "connections.ts"
Cohesion: 0.07
Nodes (37): dynamic, POST(), countByokByProvider(), dynamic, GET(), tally(), AgentConnectionsResponseSchema, CasaConnectionSchema (+29 more)

### Community 5 - "EXPEDIENTE DE CONTEXTO INTEGRAL DEL PROYECTO: DANTE AI"
Cohesion: 0.05
Nodes (37): 10. CATÁLOGO DE CASOS DE USO PRÁCTICOS Y PROTOCOLOS OPERATIVOS, 11. HOJA DE RUTA EVOLUTIVA DE DANTE AI, 12. GLOSARIO ENCICLOPÉDICO DE TÉRMINOS, 1.1 Más Allá del Chatbot Convencional, 1.2 La Misión de Dante AI, 1. MANIFIESTO FUNDACIONAL: LA VISIÓN DE ISAAC (UN JARVIS SOBERANO), 2.1 El Rol de Antigravity (Google DeepMind Team), 2. GÉNESIS Y CO-CREACIÓN: LA ALIANZA CON ANTIGRAVITY (+29 more)

### Community 6 - "credential-handlers.ts"
Cohesion: 0.14
Nodes (34): 1. Contexto y Objetivo, A. Propagación Robusta del `conversationId`, B. Propagación y Visibilidad del Estado de Persistencia, dynamic, GET(), POST(), ALLOWED_ROLES, asRecord() (+26 more)

### Community 7 - "client-session.ts"
Cohesion: 0.15
Nodes (27): AuthCallbackPage(), LoginPage(), browserAuthStorage, buildBrowserAuthOptions(), createSingleFlight(), currentAccessToken(), describeCallbackFailure(), exchangeOAuthCode() (+19 more)

### Community 8 - "provider-dispatch.test.ts"
Cohesion: 0.12
Nodes (17): defaultProviderAdapters, createProviderDispatch(), ProviderAdapter, ProviderAdapters, ProviderDispatchInput, SUPPORTED_PROVIDERS, classifyProviderError(), NETWORK_CODES (+9 more)

### Community 9 - "Session 02: Cierre de Sesión de Rescate y Preservación de Infraestructura"
Cohesion: 0.06
Nodes (28): 1. Contexto / Objetivo, 2. Decisiones Arquitectónicas, 3. Acciones Realizadas, 4. Continuidad de Secretos y Pendientes, 5. Incidentes y Desviaciones Registradas, 6. Estado de Dispositivos y Accesos Locales, 7. Validación, 8. Siguiente Paso Inmediato en Laptop de Isaac (+20 more)

### Community 10 - "requireAuthorizedOwner"
Cohesion: 0.15
Nodes (24): next, createAuthorizedRequest(), createUnauthenticatedRequest(), runTests(), dynamic, GET(), POST(), GET() (+16 more)

### Community 11 - "EXPEDIENTE TÉCNICO CLÍNICO INTEGRAL DE PRODUCCIÓN"
Cohesion: 0.07
Nodes (29): 10. LO QUE ISAAC DEBE HACER (GUÍA PASO A PASO), 1. RESUMEN EJECUTIVO Y DECLARACIÓN DE ESTADO, 2.1 El Síntoma Observado, 2.2 Diagnóstico Causal y Causa Raíz, 2. DIAGNÓSTICO CLÍNICO DEL PROBLEMA REPORTADO, 3.1 Almacenamiento en Memoria Volátil (`browserAuthStorage`), 3.3 Experiencia Defensiva sin Sesión en `/`, 3. ARQUITECTURA DE SEGURIDAD PARA TERMINALES PÚBLICAS (+21 more)

### Community 12 - "gemini.ts"
Cohesion: 0.11
Nodes (17): 1. Evidencia Oficial de Selección de Modelo (Google Gemini API), 2. Cambios Aplicados en `la-casa-de-dante`, Bitácora de Sesión 05 — Paso 2: Alineación de Modelo Gemini Vigente, Coherente y de Costo Cero, ProviderOption, ProviderSelectorProps, DanteChatMessageSchema, Message, ALLOWED_GEMINI_MODELS (+9 more)

### Community 13 - "main"
Cohesion: 0.09
Nodes (25): 1. Resumen de Objetivos Cumplidos, Bitácora de Sesión 06 — Integración Cloud en Preview, Blindaje de Seguridad y Expediente Maestro, 1. Resumen de Objetivos Cumplidos, Bitácora de Sesión 07 — Promoción Oficial a Producción (main), Hardening en Terminales Públicas, Matriz de 37 Neuronas y Expedientes Maestros Jarvis, 10. Hoja de Ruta y Prerrequisitos para Producción, 12. Certificación Formal de Cierre, 1. Resumen Ejecutivo y Declaración de Estado, 2. Desglose Quirúrgico de Tareas por Agente y Mediciones (+17 more)

### Community 14 - "authorizedFetch"
Cohesion: 0.11
Nodes (18): lucide-react, react, recharts, Analytics, Conversation, Dashboard(), NeuronItem, ProviderStatus (+10 more)

### Community 15 - "sidebar-nav.tsx"
Cohesion: 0.14
Nodes (20): 3.2 Destrucción Determinista de Sesión (`signOut`), En `la-casa-de-dante`:, geistMono, geistSans, metadata, RootLayout(), MainLayout(), ConnStatus (+12 more)

### Community 16 - "credential-core-flow.test.ts"
Cohesion: 0.11
Nodes (11): CredentialMetadata, CredentialStorage, OwnerResolution, CoreCredentialPort, CredentialHandlerDeps, ProviderDispatch, CapturedCoreChatCall, createTestDeps() (+3 more)

### Community 17 - "cli.mjs"
Cohesion: 0.16
Nodes (16): __dirname, __filename, parseArgs(), printHelp(), promptHidden(), createVaultServer(), DEFAULT_HOST, DEFAULT_PORT (+8 more)

### Community 18 - "package.json"
Cohesion: 0.11
Nodes (17): name, private, version, clsx, eslint, eslint-config-next, @google/generative-ai, groq-sdk (+9 more)

### Community 19 - "danteBridge"
Cohesion: 0.11
Nodes (3): dynamic, GET(), danteBridge

### Community 20 - "compilerOptions"
Cohesion: 0.11
Nodes (17): compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib, module (+9 more)

### Community 21 - "security-hardening.test.ts"
Cohesion: 0.17
Nodes (9): OWNER_ASSERTION_HEADER, OWNER_ASSERTION_TTL_MS, OwnerAssertionConfigurationError, OwnerAssertionPayload, signOwnerAssertion(), toBase64Url(), buildCoreChatHeaders(), CoreChatHeaderInput (+1 more)

### Community 22 - "connections-panel.tsx"
Cohesion: 0.15
Nodes (15): Connection, ConnectionsPage(), ConnectionStatus, ICONS, IngestedDocument, LABEL, STATUS_COLORS, byokHref() (+7 more)

### Community 23 - "conversation-history.test.ts"
Cohesion: 0.14
Nodes (8): RFC-4122, dynamic, DanteConversationMessageSchema, DanteConversationMessagesResponseSchema, DanteConversationSchema, DanteTimestampSchema, parseAndNormalizeTimestamp(), DeferredResponse

### Community 24 - "read-checks.mjs"
Cohesion: 0.21
Nodes (11): analyzeProvidersCatalog(), buildPgClientOptions(), checkNeonReadOnly(), checkServicesHealth(), checkSupabaseReadOnly(), __dirname, executeAllReadOnlyChecks(), __filename (+3 more)

### Community 25 - "credential-manager.tsx"
Cohesion: 0.21
Nodes (13): Provider, ProvidersPanel(), CredentialManager(), CredentialMetadata, ERROR_MESSAGES, formatDate(), messageFor(), readCredentials() (+5 more)

### Community 26 - "credential-selector.tsx"
Cohesion: 0.23
Nodes (11): ChatComposer(), ChatComposerProps, CredentialOption, CredentialSelector(), CredentialSelectorProps, formatDate(), labelFor(), LoadState (+3 more)

### Community 27 - "dependencies"
Cohesion: 0.17
Nodes (12): dependencies, clsx, @google/generative-ai, groq-sdk, lucide-react, next, react, react-dom (+4 more)

### Community 28 - "scripts"
Cohesion: 0.17
Nodes (12): scripts, build, dev, lint, start, test, typecheck, vault (+4 more)

### Community 29 - "zod"
Cohesion: 0.29
Nodes (6): zod, AuditEvent, AuditEventSchema, DanteLogEntry, AuditLogPort, InMemoryAuditLogAdapter

### Community 30 - "credential-runtime.ts"
Cohesion: 0.20
Nodes (9): dynamic, POST(), DELETE(), dynamic, corePort, credentialHandlerDeps, dispatch, globalStore (+1 more)

### Community 31 - "require-owner.ts"
Cohesion: 0.27
Nodes (6): dynamic, GET(), AUTHORIZED_OWNERS_ENV, isAuthorizedOwner(), readAuthorizedOwners(), baseEnv

### Community 32 - "credential-service.test.ts"
Cohesion: 0.21
Nodes (9): NOT_CONFIGURED, readBearerToken(), readServerAuthConfig(), ResolveOwnerDeps, resolveOwnerFromRequest(), ServerAuthConfig, UNAUTHORIZED, CREDENTIAL_ALGORITHM (+1 more)

### Community 33 - "vault.test.mjs"
Cohesion: 0.26
Nodes (10): __dirname, FAKE_CONFIG, __filename, deriveKey(), KDF_PARAMS, packVault(), unlockVault(), VAULT_AAD (+2 more)

### Community 34 - "Bitácora de Sesión 03 — API de Chat Offline"
Cohesion: 0.20
Nodes (9): Bitácora de Sesión 03 — API de Chat Offline, Contrato HTTP Establecido, Incidencias y Resoluciones, Objetivo, Próximo paso propuesto, Regla operativa post-incidente: rutas Unicode, Resultado, Riesgos reales pendientes (+1 more)

### Community 35 - "devDependencies"
Cohesion: 0.20
Nodes (10): devDependencies, eslint, eslint-config-next, postcss, tailwindcss, tsx, @types/node, @types/react (+2 more)

### Community 36 - "system-status-panel.tsx"
Cohesion: 0.20
Nodes (9): Analytics, COGNITIVE_LOBES, Connection, ConnStatus, DOT, LABEL, NeuronInfo, ProviderInfo (+1 more)

### Community 37 - "Resiliencia"
Cohesion: 0.22
Nodes (8): Arquitectura del Sistema (La Casa de Dante), Estados del bridge, Flujo de Datos por Capas, Fronteras Inmutables, Headers HTTP, Reintentos, Resiliencia, Timeout

### Community 38 - "Continuidad de Proyecto y Estado Activo"
Cohesion: 0.22
Nodes (8): Archivos de Session 04, Continuidad de Proyecto y Estado Activo, Entorno Local, Estado Actual, Estado de Session 04, Estado técnico confirmado, Próximo hito previsto, Riesgos Pendientes

### Community 39 - "Definición de Subagentes Oficiales"
Cohesion: 0.25
Nodes (7): 1. `dante-bridge` (El Guardián del Núcleo), 2. `security-auditor` (El Guardián del Tesoro), 3. `ui-designer` (El Guardián Visual), Definición de Subagentes Oficiales, Guía para Agentes y MCPs (La Casa de Dante), Protocolo Obligatorio Zod, Reglas Maestras

### Community 40 - "bitacora-session-04.md"
Cohesion: 0.25
Nodes (6): Archivos creados y modificados, Estado al cierre documental, Flujo Implementado, Incidencias Operativas y Correcciones, Objetivo, Restricciones y Decisiones Técnicas

### Community 41 - "3. Pruebas Automatizadas y Validación"
Cohesion: 0.25
Nodes (7): 2. Acciones y Correcciones Implementadas, 3. Pruebas Automatizadas y Validación, Actualización de Scripts Verificadores (`verify:*`), Aislamiento de Entorno en Pruebas, Resolución Definitiva de Formato y Finales de Línea (`git diff --check`), Resultados de Ejecución, Session 03: Corrección de Continuidad y Estado de Persistencia del Chat BYOK

### Community 42 - "11. Guía Visual Quirúrgica Paso a Paso: "Lo que Isaac debe hacer""
Cohesion: 0.25
Nodes (8): 11. Guía Visual Quirúrgica Paso a Paso: "Lo que Isaac debe hacer", Paso 1: Configurar Variables Obligatorias en Vercel Preview, Paso 2: Ejecutar Redeploy sin Caché (*Redeploy without Cache*), Paso 3: Iniciar Sesión en La Casa Preview y Obtener tu UUID Real, Paso 4: Cargar tu UUID en las Variables de Lista Blanca en Vercel, Paso 5: Registrar tu Clave BYOK de Google Gemini (Gratuita), Paso 6: Prueba de Chat en Vivo y Validación de Continuidad, Paso 7: Comprobación de Persistencia en Neon PostgreSQL (Opcional pero Recomendado)

### Community 43 - "crm/page.tsx"
Cohesion: 0.25
Nodes (6): Contact, INITIAL_CONTACTS, INITIAL_OBSERVATIONS, INITIAL_PROJECTS, Observation, Project

### Community 44 - "bitacora-session-02.md"
Cohesion: 0.29
Nodes (6): Estado de Git previo al commit, Incidencias Resueltas, Próximo paso propuesto, Resultado, Riesgos pendientes, Validaciones

### Community 45 - "verify-chat-ui.ts"
Cohesion: 0.33
Nodes (4): DISALLOWED_PATTERNS, UI_DIR, verifyFile(), verifyUiFiles()

### Community 46 - "Session 01: Inspección y Configuración de Subagentes"
Cohesion: 0.33
Nodes (5): 1. Contexto / Objetivo, 2. Acciones Realizadas, 3. Decisiones Arquitectónicas, 4. Siguiente Paso, Session 01: Inspección y Configuración de Subagentes

### Community 47 - "chat/route.ts"
Cohesion: 0.40
Nodes (3): dynamic, DanteChatRequestSchema, DanteBridgeError

### Community 48 - "vercel.json"
Cohesion: 0.33
Nodes (5): buildCommand, devCommand, env, NODE_ENV, framework

### Community 49 - "Metodología de Bitácoras"
Cohesion: 0.40
Nodes (4): Estructura de una Bitácora, Metodología de Bitácoras, Propósito, Reglas de la Bitácora

### Community 50 - "4. Inventario Estructural de Repositorios y Archivos Creados"
Cohesion: 0.40
Nodes (5): 4.1 Repositorio `Dante-AI-Core`, 4.2 Repositorio `la-casa-de-dante`, 4.3 Repositorio `Dante-Private-Config` y Bóveda Física Offline, 4.4 Catálogo Exhaustivo de Archivos Creados y Modificados en esta Intervención, 4. Inventario Estructural de Repositorios y Archivos Creados

### Community 51 - "Políticas de Seguridad (La Casa de Dante)"
Cohesion: 0.40
Nodes (4): 1. Zero Secrets en Git, 2. Costo Cero ($0) y Rate-Limiting, 3. Sanitización de Inputs y Validación, Políticas de Seguridad (La Casa de Dante)

### Community 52 - "contracts/errors.ts"
Cohesion: 0.40
Nodes (4): PublicError, PublicErrorCode, PublicErrorCodeSchema, PublicErrorSchema

### Community 53 - "Bitácora - Session 01: Inicialización Fundacional"
Cohesion: 0.50
Nodes (3): Bitácora - Session 01: Inicialización Fundacional, Evaluaciones de Agentes, Resumen de la Sesión

### Community 54 - "Arquitectura Fundacional: La Casa de Dante"
Cohesion: 0.50
Nodes (3): Arquitectura Fundacional: La Casa de Dante, Identidad, Reglas Innegociables de Arquitectura

### Community 55 - "3. Diagramas de Arquitectura y Flujos de Integración Cloud"
Cohesion: 0.50
Nodes (4): 3.1 Flujo Integral de Autenticación y Control de Acceso (Supabase -> Vercel Edge), 3.2 Flujo de Chat, Inferencia BYOK y Persistencia en Neon, 3.3 Aislamiento Criptográfico y Modelo de Datos Multi-Inquilino, 3. Diagramas de Arquitectura y Flujos de Integración Cloud

### Community 56 - "extends"
Cohesion: 0.50
Nodes (3): extends, next/core-web-vitals, next/typescript

## Knowledge Gaps
- **15 isolated node(s):** `next/core-web-vitals`, `next/typescript`, `clsx`, `groq-sdk`, `react-dom` (+10 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 462 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **10 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `main()` connect `main` to `vault.test.mjs`, `EXPEDIENTE DE CONTEXTO INTEGRAL DEL PROYECTO: DANTE AI`, `Session 02: Cierre de Sesión de Rescate y Preservación de Infraestructura`, `EXPEDIENTE TÉCNICO CLÍNICO INTEGRAL DE PRODUCCIÓN`, `Session 01: Inspección y Configuración de Subagentes`, `cli.mjs`, `4. Inventario Estructural de Repositorios y Archivos Creados`, `read-checks.mjs`?**
  _High betweenness centrality (0.104) - this node is a cross-community bridge._
- **Are the 4 inferred relationships involving `requireAuthorizedOwner()` (e.g. with `Actualización de Scripts Verificadores (`verify:*`)` and `2.1 Coordinación por Roles`) actually correct?**
  _`requireAuthorizedOwner()` has 4 INFERRED edges - model-reasoned connections that need verification._
- **What connects `next/core-web-vitals`, `next/typescript`, `clsx` to the rest of the system?**
  _15 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `DanteBridgeImpl` be split into smaller, more focused modules?**
  _Cohesion score 0.06645569620253164 - nodes in this community are weakly interconnected._
- **Why does `next` connect `requireAuthorizedOwner` to `chat-history-state.ts`, `index.ts`, `connections.ts`, `system-status-panel.tsx`, `credential-handlers.ts`, `client-session.ts`, `authorizedFetch`, `chat/route.ts`, `sidebar-nav.tsx`, `package.json`, `danteBridge`, `connections-panel.tsx`, `conversation-history.test.ts`, `credential-runtime.ts`, `require-owner.ts`?**
  _High betweenness centrality (0.096) - this node is a cross-community bridge._
- **Are the 5 inferred relationships involving `MockDanteProvider` (e.g. with `Objetivo` and `Resultado`) actually correct?**
  _`MockDanteProvider` has 5 INFERRED edges - model-reasoned connections that need verification._
- **Should `chat-history-state.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0707070707070707 - nodes in this community are weakly interconnected._