/**
 * Bóveda de Configuración Portátil de Dante - Esquema y Modelo de Datos
 *
 * Separa de manera estricta:
 * 1. Infraestructura (Core, base de datos Neon, tokens de comunicación)
 * 2. Autenticación (Supabase Auth, listas de propietarios autorizados)
 * 3. Proveedores de IA (Claves BYOK / servidores que se gestionan desde La Casa)
 *
 * Provee:
 * - Descripciones claras en lenguaje sencillo para cada variable.
 * - Validación estricta y segura (sin eval, sin inyecciones).
 * - Cálculo de completitud sin exponer secretos.
 * - Generación de archivos de entorno (.env.local) específicos por componente y entorno.
 */

export const FIELD_DEFINITIONS = [
  // --- INFRAESTRUCTURA ---
  {
    key: 'DANTE_CORE_TOKEN',
    label: 'Token de Enlace Core <-> Casa',
    category: 'infrastructure',
    description: 'Token secreto compartido para autorizar peticiones entre La Casa y el Core, y firmar aserciones criptográficas HMAC.',
    requiredFor: ['core-development', 'core-production', 'casa-development', 'casa-production'],
    sensitive: true,
    placeholder: 'Cadena aleatoria de 32+ caracteres',
  },
  {
    key: 'CREDENTIAL_MASTER_SECRET',
    label: 'Secreto Maestro de Bóveda BYOK',
    category: 'infrastructure',
    description: 'Clave maestra existente para derivar el cifrado AES-256-GCM de las credenciales de proveedores guardadas en el Core.',
    requiredFor: ['core-development', 'core-production', 'casa-development', 'casa-production'],
    sensitive: true,
    placeholder: 'Cadena secreta existente de 32+ caracteres',
  },
  {
    key: 'DATABASE_URL',
    label: 'Conexión a Base de Datos (Neon)',
    category: 'infrastructure',
    description: 'Cadena de conexión PostgreSQL de Neon para persistir conversaciones y configuraciones de Dante Core.',
    requiredFor: ['core-production'],
    optionalFor: ['core-development'],
    sensitive: true,
    placeholder: 'postgresql://usuario:password@ep-xyz.region.neon.tech/neondb?sslmode=require',
  },
  {
    key: 'USE_DATABASE',
    label: 'Activar Persistencia en Base de Datos',
    category: 'infrastructure',
    description: 'Indica si el Core debe usar la base de datos Neon (true) o operar con almacenamiento en memoria temporal (false).',
    requiredFor: ['core-production'],
    defaultValue: 'true',
    sensitive: false,
    placeholder: 'true o false',
  },
  {
    key: 'DANTE_CORE_URL',
    label: 'URL de Dante-AI-Core',
    category: 'infrastructure',
    description: 'Dirección donde responde el backend del Core. En desarrollo suele ser http://localhost:3001.',
    requiredFor: ['casa-development', 'casa-production'],
    sensitive: false,
    placeholder: 'http://localhost:3001 o https://tu-core.vercel.app',
  },
  {
    key: 'DANTE_MODE',
    label: 'Modo de Conexión de La Casa',
    category: 'infrastructure',
    description: 'Establece el modo del puente (local-core para desarrollo o remote-core para despliegue remoto).',
    requiredFor: ['casa-development', 'casa-production'],
    defaultValue: 'local-core',
    sensitive: false,
    placeholder: 'local-core o remote-core',
  },

  // --- AUTENTICACIÓN ---
  {
    key: 'NEXT_PUBLIC_SUPABASE_URL',
    label: 'URL del Proyecto Supabase',
    category: 'authentication',
    description: 'Dirección de tu proyecto en Supabase (ej: https://xyz.supabase.co) para la autenticación de usuarios.',
    requiredFor: ['casa-development', 'casa-production'],
    sensitive: false,
    placeholder: 'https://xyz.supabase.co',
  },
  {
    key: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
    label: 'Clave Pública Anónima de Supabase',
    category: 'authentication',
    description: 'Clave anon/public de Supabase requerida para inicializar el cliente en el navegador de La Casa.',
    requiredFor: ['casa-development', 'casa-production'],
    sensitive: true,
    placeholder: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  },
  {
    key: 'DANTE_AUTHORIZED_OWNER_IDS',
    label: 'UUID de Propietario Autorizado (Isaac)',
    category: 'authentication',
    description: 'Identificador único (UUID) de tu usuario en Supabase. Bloquea el acceso para cualquier otra persona.',
    requiredFor: ['casa-development', 'casa-production'],
    sensitive: false,
    placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
  },
  {
    key: 'DANTE_ADMIN_OWNER_IDS',
    label: 'UUIDs de Administradores Técnicos',
    category: 'authentication',
    description: 'UUIDs autorizados para cambiar estados de proveedores y funciones administrativas en el Core.',
    requiredFor: ['core-development', 'core-production'],
    optionalFor: ['casa-development', 'casa-production'],
    sensitive: false,
    placeholder: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx',
  },

  // --- PROVEEDORES DE IA (BYOK) ---
  {
    key: 'GOOGLE_AI_API_KEY',
    label: 'Clave de Google Gemini (Google AI Studio)',
    category: 'providers',
    description: 'API key de Gemini para el orquestador principal de Dante o respaldo del servidor.',
    requiredFor: ['core-development', 'core-production'],
    optionalFor: ['casa-development', 'casa-production'],
    sensitive: true,
    placeholder: 'AIzaSy...',
  },
  {
    key: 'DEFAULT_GEMINI_MODEL',
    label: 'Modelo por Defecto de Gemini',
    category: 'providers',
    description: 'Modelo de Gemini activo para razonamiento y respuestas generales.',
    defaultValue: 'gemini-2.0-flash',
    sensitive: false,
    placeholder: 'gemini-2.0-flash',
  },
  {
    key: 'GROQ_API_KEY',
    label: 'Clave de Groq (Opcional)',
    category: 'providers',
    description: 'API key para inferencia de ultra-baja latencia con modelos Llama en Groq.',
    optionalFor: ['core-development', 'core-production', 'casa-development', 'casa-production'],
    sensitive: true,
    placeholder: 'gsk_...',
  },
  {
    key: 'OLLAMA_BASE_URL',
    label: 'URL de Ollama Local (Opcional)',
    category: 'providers',
    description: 'Dirección de tu servidor local Ollama para inferencia local offline $0.',
    defaultValue: 'http://localhost:11434',
    optionalFor: ['core-development', 'core-production', 'casa-development', 'casa-production'],
    sensitive: false,
    placeholder: 'http://localhost:11434',
  },
  {
    key: 'HUGGING_FACE_API_KEY',
    label: 'Clave de Hugging Face (Opcional)',
    category: 'providers',
    description: 'Token de acceso para modelos especializados o endpoints de Hugging Face.',
    optionalFor: ['core-development', 'core-production', 'casa-development', 'casa-production'],
    sensitive: true,
    placeholder: 'hf_...',
  },
];

export const CATEGORIES = [
  { id: 'infrastructure', name: 'Infraestructura y Conexiones', description: 'Tokens internos, base de datos Neon y enlace entre sistemas.' },
  { id: 'authentication', name: 'Autenticación y Seguridad', description: 'Credenciales de Supabase y lista blanca de propietarios autorizados.' },
  { id: 'providers', name: 'Proveedores de Inteligencia Artificial', description: 'Claves de API y modelos (Google Gemini, Groq, Ollama, etc.).' },
];

export const TARGET_ENVIRONMENTS = [
  { id: 'core-development', name: 'Dante-AI-Core (Desarrollo Local)', component: 'Core', env: 'development', targetFile: 'Dante-AI-Core/.env.local' },
  { id: 'core-production', name: 'Dante-AI-Core (Vercel Producción)', component: 'Core', env: 'production', targetFile: 'Vercel Environment Variables' },
  { id: 'casa-development', name: 'La Casa de Dante (Desarrollo Local)', component: 'Casa', env: 'development', targetFile: 'la-casa-de-dante/.env.local' },
  { id: 'casa-production', name: 'La Casa de Dante (Vercel Producción)', component: 'Casa', env: 'production', targetFile: 'Vercel Environment Variables' },
];

/**
 * Valida y sanea el objeto antes de guardarlo en la bóveda.
 * Rechaza cualquier código ejecutable o inyecciones de prototipo.
 */
export function sanitizeVaultPayload(raw) {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new Error('PAYLOAD_INVALID: El payload debe ser un objeto.');
  }

  const sanitized = {
    meta: {
      client: 'dante-config-vault',
      schemaVersion: 1,
      updatedAt: new Date().toISOString(),
      label: typeof raw.meta?.label === 'string' ? raw.meta.label.slice(0, 100) : 'Bóveda Personal de Dante',
    },
    values: {},
  };

  const rawValues = raw.values && typeof raw.values === 'object' ? raw.values : raw;

  for (const def of FIELD_DEFINITIONS) {
    const val = rawValues[def.key];
    if (typeof val === 'string') {
      const trimmed = val.trim();
      if (trimmed.length > 0) {
        sanitized.values[def.key] = trimmed;
      }
    } else if (val !== undefined && val !== null) {
      sanitized.values[def.key] = String(val).trim();
    }
  }

  return sanitized;
}

/**
 * Inspecciona los datos de una bóveda descifrada produciendo un reporte
 * de preparación de entorno sin revelar ningún valor sensible.
 */
export function inspectVault(payload) {
  const values = payload?.values || {};

  const fieldStatuses = FIELD_DEFINITIONS.map((def) => {
    const rawVal = values[def.key];
    const isConfigured = typeof rawVal === 'string' && rawVal.length > 0;
    let hint = 'No configurado';
    if (isConfigured) {
      if (def.sensitive) {
        hint = `Configurado (${rawVal.length} caracteres: ••••••••${rawVal.slice(-3)})`;
      } else {
        hint = rawVal.length > 40 ? `${rawVal.slice(0, 20)}...${rawVal.slice(-15)}` : rawVal;
      }
    } else if (def.defaultValue) {
      hint = `Valor por defecto sugerido: ${def.defaultValue}`;
    }

    return {
      key: def.key,
      label: def.label,
      category: def.category,
      description: def.description,
      sensitive: def.sensitive,
      isConfigured,
      hint,
      requiredFor: def.requiredFor || [],
      optionalFor: def.optionalFor || [],
    };
  });

  const configuredCount = fieldStatuses.filter((f) => f.isConfigured).length;
  const totalCount = FIELD_DEFINITIONS.length;

  // Evaluar completitud por cada entorno objetivo
  const environments = TARGET_ENVIRONMENTS.map((target) => {
    const required = FIELD_DEFINITIONS.filter((d) => d.requiredFor?.includes(target.id));
    const missing = required.filter((d) => !values[d.key] || values[d.key].length === 0);
    const optionalPending = FIELD_DEFINITIONS.filter(
      (d) => d.optionalFor?.includes(target.id) && (!values[d.key] || values[d.key].length === 0)
    );

    return {
      id: target.id,
      name: target.name,
      component: target.component,
      env: target.env,
      ready: missing.length === 0,
      missingRequired: missing.map((m) => ({ key: m.key, label: m.label })),
      optionalPending: optionalPending.map((o) => ({ key: o.key, label: o.label })),
    };
  });

  return {
    meta: payload.meta || {},
    counts: {
      configured: configuredCount,
      pending: totalCount - configuredCount,
      total: totalCount,
    },
    fields: fieldStatuses,
    environments,
  };
}

/**
 * Genera el archivo .env adecuado para un entorno específico.
 */
export function generateEnv(payload, targetId) {
  const target = TARGET_ENVIRONMENTS.find((t) => t.id === targetId);
  if (!target) {
    throw new Error(`TARGET_NOT_FOUND: Entorno objetivo no reconocido: ${targetId}`);
  }

  const values = payload?.values || {};
  const lines = [
    `# ==============================================================================`,
    `# Archivo de Entorno Generado por Dante Config Vault`,
    `# Objetivo: ${target.name}`,
    `# Generado: ${new Date().toISOString()}`,
    `# ATENCIÓN: Archivo privado. Nunca cometer a Git ni compartir.`,
    `# ==============================================================================`,
    '',
  ];

  const relevantCategories = CATEGORIES.map((cat) => {
    const fields = FIELD_DEFINITIONS.filter(
      (d) => d.category === cat.id && (d.requiredFor?.includes(target.id) || d.optionalFor?.includes(target.id) || d.defaultValue)
    );
    return { ...cat, fields };
  }).filter((c) => c.fields.length > 0);

  for (const cat of relevantCategories) {
    lines.push(`# --- ${cat.name.toUpperCase()} ---`);
    for (const field of cat.fields) {
      let val = values[field.key];
      if (!val || val.length === 0) {
        if (field.defaultValue) {
          val = field.defaultValue;
        } else {
          lines.push(`# ${field.key}="" # PENDIENTE: ${field.description}`);
          continue;
        }
      }
      lines.push(`${field.key}="${val.replace(/"/g, '\\"')}"`);
    }
    lines.push('');
  }

  // Compatibilidad Supabase server-side en La Casa si no se especificaron variantes sin NEXT_PUBLIC_
  if (target.component === 'Casa') {
    if (values.NEXT_PUBLIC_SUPABASE_URL && !values.SUPABASE_URL) {
      lines.push(`SUPABASE_URL="${values.NEXT_PUBLIC_SUPABASE_URL}"`);
    }
    if (values.NEXT_PUBLIC_SUPABASE_ANON_KEY && !values.SUPABASE_ANON_KEY) {
      lines.push(`SUPABASE_ANON_KEY="${values.NEXT_PUBLIC_SUPABASE_ANON_KEY}"`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
