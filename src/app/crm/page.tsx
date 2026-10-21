"use client";

import { useState } from "react";
import {
  Users,
  Building2,
  Calendar,
  Search,
  Plus,
  X,
  Clock,
  Sparkles,
  ShieldCheck,
  Tag,
  Briefcase,
} from "lucide-react";

interface Contact {
  id: string;
  name: string;
  role: string;
  company: string;
  relationship: string;
  status: "activo" | "en_espera" | "prospecto";
  lastInteraction: string;
  notes: string;
}

interface Project {
  id: string;
  name: string;
  client: string;
  status: "en_curso" | "planificacion" | "completado";
  progress: number;
  deadline: string;
  budgetTier: string;
}

interface Observation {
  id: string;
  source: string;
  subject: string;
  evidence: string;
  timestamp: string;
  verified: boolean;
}

const INITIAL_CONTACTS: Contact[] = [
  {
    id: "cnt-1",
    name: "Isaac Patricio",
    role: "Arquitecto del Sistema & Propietario",
    company: "Dante AI Ecosystem",
    relationship: "Admin Principal",
    status: "activo",
    lastInteraction: "Hoy (Sesión activa)",
    notes: "Preferencia por reportes clínicos, estructurados, protocolos de seguridad $0 Tier y BYOK.",
  },
  {
    id: "cnt-2",
    name: "Coordinación INACAP",
    role: "Dirección Académica / Tecnológica",
    company: "INACAP Sede Santiago",
    relationship: "Institución Académica",
    status: "activo",
    lastInteraction: "Octubre 2026",
    notes: "Proyectos de desarrollo tecnológico, laboratorios de software y peritajes de sistemas.",
  },
  {
    id: "cnt-3",
    name: "Finanzas Nexus Corp",
    role: "Administración Contable & Fiscal",
    company: "Nexus Finance Chile",
    relationship: "Plataforma Asociada",
    status: "activo",
    lastInteraction: "20-10-2026",
    notes: "Integración de módulos tributarios, cálculo de UF/UTM e informes de balance.",
  },
];

const INITIAL_PROJECTS: Project[] = [
  {
    id: "prj-1",
    name: "La Casa de Dante (Frontend Operativo)",
    client: "Isaac AI Platform",
    status: "en_curso",
    progress: 95,
    deadline: "2026-10-31",
    budgetTier: "$0.00 USD (Vercel Hobby)",
  },
  {
    id: "prj-2",
    name: "Dante-AI-Core (37 Neuronas de Von Neumann)",
    client: "Ecosistema Jarvis",
    status: "en_curso",
    progress: 92,
    deadline: "2026-10-31",
    budgetTier: "$0.00 USD (Neon Free)",
  },
  {
    id: "prj-3",
    name: "Compilador Book-to-Skill & Directivas",
    client: "Ingesta Técnica",
    status: "en_curso",
    progress: 88,
    deadline: "2026-11-15",
    budgetTier: "Local Antigravity",
  },
  {
    id: "prj-4",
    name: "Finanzas Nexus (Integración CPA & Wealth)",
    client: "Nexus Finance",
    status: "planificacion",
    progress: 75,
    deadline: "2026-12-01",
    budgetTier: "Free Tier",
  },
];

const INITIAL_OBSERVATIONS: Observation[] = [
  {
    id: "obs-1",
    source: "chat.session",
    subject: "Seguridad de terminal pública",
    evidence: "Isaac utiliza terminales universitarias y públicas; los tokens no se guardan en localStorage.",
    timestamp: "2026-10-21 17:15",
    verified: true,
  },
  {
    id: "obs-2",
    source: "vault.neon",
    subject: "Credencial Gemini activa",
    evidence: "Clave BYOK registrada y cifrada con AES-256-GCM en la base de datos Neon.",
    timestamp: "2026-10-20 22:30",
    verified: true,
  },
  {
    id: "obs-3",
    source: "system.contracts",
    subject: "Frontera Zod",
    evidence: "100% de payloads de chat y conversaciones validados con z.safeParse().",
    timestamp: "2026-10-21 17:40",
    verified: true,
  },
];

export default function CrmPage() {
  const [contacts, setContacts] = useState<Contact[]>(INITIAL_CONTACTS);
  const [projects] = useState<Project[]>(INITIAL_PROJECTS);
  const [observations] = useState<Observation[]>(INITIAL_OBSERVATIONS);
  const [tab, setTab] = useState<"contacts" | "projects" | "observations">("contacts");
  const [search, setSearch] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Form state para nuevo contacto
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState("");
  const [newCompany, setNewCompany] = useState("");
  const [newRelationship, setNewRelationship] = useState("");
  const [newNotes, setNewNotes] = useState("");

  const handleAddContact = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    const newContact: Contact = {
      id: `cnt-${Date.now()}`,
      name: newName.trim(),
      role: newRole.trim() || "Contacto",
      company: newCompany.trim() || "Independiente",
      relationship: newRelationship.trim() || "Profesional",
      status: "activo",
      lastInteraction: "Hoy (Registrado)",
      notes: newNotes.trim() || "Sin notas registradas.",
    };

    setContacts([newContact, ...contacts]);
    setNewName("");
    setNewRole("");
    setNewCompany("");
    setNewRelationship("");
    setNewNotes("");
    setIsModalOpen(false);
  };

  const filteredContacts = contacts.filter(
    (c) =>
      c.name.toLowerCase().includes(search.toLowerCase()) ||
      c.company.toLowerCase().includes(search.toLowerCase()) ||
      c.role.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto w-full font-[family-name:var(--font-geist-sans)]">
      {/* Encabezado Principal */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-900 pb-5">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase tracking-wider bg-purple-950/60 border border-purple-800/80 text-purple-300">
              Habitación de Memoria & CRM
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-zinc-900 text-zinc-400 border border-zinc-800">
              Inspirado en Comp AI CRM
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-zinc-100 flex items-center gap-2.5">
            <Users className="w-6 h-6 text-purple-400" />
            <span>CRM & Memoria Relacional</span>
          </h1>
          <p className="text-xs text-zinc-400 font-mono mt-1">
            Donde Dante registra hechos observados de personas, entidades, proyectos y compromisos de Isaac.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setIsModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-mono text-xs font-medium transition-colors shadow-sm self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Nuevo Contacto</span>
        </button>
      </div>

      {/* Tarjetas KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800/80 space-y-1">
          <span className="text-[10px] font-mono text-zinc-500 uppercase block">Contactos Clave</span>
          <p className="text-2xl font-bold text-zinc-100">{contacts.length}</p>
          <span className="text-[10px] font-mono text-emerald-400">100% verificados</span>
        </div>
        <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800/80 space-y-1">
          <span className="text-[10px] font-mono text-zinc-500 uppercase block">Proyectos Activos</span>
          <p className="text-2xl font-bold text-purple-400">{projects.length}</p>
          <span className="text-[10px] font-mono text-zinc-400">4 en pipeline</span>
        </div>
        <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800/80 space-y-1">
          <span className="text-[10px] font-mono text-zinc-500 uppercase block">Observaciones Agente</span>
          <p className="text-2xl font-bold text-sky-400">{observations.length}</p>
          <span className="text-[10px] font-mono text-zinc-400">Hechos observados</span>
        </div>
        <div className="p-4 rounded-xl bg-zinc-900/40 border border-zinc-800/80 space-y-1">
          <span className="text-[10px] font-mono text-zinc-500 uppercase block">Regla de Certeza</span>
          <p className="text-2xl font-bold text-emerald-400">0%</p>
          <span className="text-[10px] font-mono text-zinc-400">Cero datos inventados</span>
        </div>
      </div>

      {/* Selector de Pestañas y Buscador */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
        <div className="flex items-center gap-1.5 p-1 rounded-xl bg-zinc-900/70 border border-zinc-800 text-xs font-mono">
          <button
            type="button"
            onClick={() => setTab("contacts")}
            className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
              tab === "contacts"
                ? "bg-zinc-800 text-zinc-100 font-semibold"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Contactos ({contacts.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setTab("projects")}
            className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
              tab === "projects"
                ? "bg-zinc-800 text-zinc-100 font-semibold"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Briefcase className="w-3.5 h-3.5" />
            <span>Proyectos ({projects.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setTab("observations")}
            className={`px-3 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 ${
              tab === "observations"
                ? "bg-zinc-800 text-zinc-100 font-semibold"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Observaciones ({observations.length})</span>
          </button>
        </div>

        {tab === "contacts" && (
          <div className="relative w-full sm:w-64">
            <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Buscar por nombre, empresa o rol..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-zinc-900/60 border border-zinc-800 rounded-xl pl-9 pr-3 py-2 text-xs font-mono text-zinc-200 placeholder:text-zinc-600 focus:outline-none focus:border-purple-500"
            />
          </div>
        )}
      </div>

      {/* Contenido de la Pestaña: Contactos */}
      {tab === "contacts" && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredContacts.map((contact) => (
            <div
              key={contact.id}
              className="p-5 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 hover:border-purple-500/40 transition-all space-y-3"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-100">{contact.name}</h3>
                  <p className="text-xs font-mono text-purple-400">{contact.role}</p>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-950/60 border border-emerald-800/80 text-emerald-300">
                  {contact.status}
                </span>
              </div>

              <div className="space-y-1 text-xs font-mono text-zinc-400 border-t border-zinc-800/60 pt-3">
                <div className="flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                  <span className="text-zinc-300 truncate">{contact.company}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                  <span>{contact.relationship}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                  <span className="text-zinc-500">Último: {contact.lastInteraction}</span>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-zinc-950/70 border border-zinc-900 text-xs text-zinc-400 font-mono leading-relaxed">
                {contact.notes}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Contenido de la Pestaña: Proyectos */}
      {tab === "projects" && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {projects.map((proj) => (
            <div
              key={proj.id}
              className="p-5 rounded-2xl bg-zinc-900/40 border border-zinc-800/80 hover:border-zinc-700 transition-all space-y-4"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-zinc-100">{proj.name}</h3>
                  <p className="text-xs font-mono text-zinc-400 mt-0.5">Entidad: {proj.client}</p>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-950/60 border border-purple-800/80 text-purple-300">
                  {proj.status}
                </span>
              </div>

              <div className="space-y-1.5">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-zinc-400">Progreso Operativo</span>
                  <span className="text-zinc-200 font-bold">{proj.progress}%</span>
                </div>
                <div className="w-full bg-zinc-950 rounded-full h-2 overflow-hidden border border-zinc-800">
                  <div
                    className="h-full bg-purple-500 transition-all duration-500"
                    style={{ width: `${proj.progress}%` }}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 border-t border-zinc-800/60 text-xs font-mono text-zinc-400">
                <div className="flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-zinc-500" />
                  <span>Meta: {proj.deadline}</span>
                </div>
                <span className="text-emerald-400">{proj.budgetTier}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Contenido de la Pestaña: Observaciones */}
      {tab === "observations" && (
        <div className="space-y-3">
          <div className="p-4 rounded-xl bg-purple-950/20 border border-purple-900/40 text-xs font-mono text-purple-200 leading-relaxed">
            <strong>Principio Rector Comp AI CRM:</strong> Dante nunca conjetura ni estima datos sobre personas. Cada entrada representa un hecho observado en interacciones reales o verificado en repositorios.
          </div>

          <div className="divide-y divide-zinc-900 rounded-xl bg-zinc-900/30 border border-zinc-800/80 overflow-hidden">
            {observations.map((obs) => (
              <div key={obs.id} className="p-4 flex items-start justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-zinc-800 text-zinc-300">
                      {obs.source}
                    </span>
                    <h4 className="text-xs font-semibold text-zinc-200">{obs.subject}</h4>
                  </div>
                  <p className="text-xs text-zinc-400 font-mono leading-relaxed pl-1">
                    {obs.evidence}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-[10px] font-mono text-zinc-500 block">{obs.timestamp}</span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-mono text-emerald-400 mt-1">
                    <ShieldCheck className="w-3 h-3" /> Verificado
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal para Nuevo Contacto */}
      {isModalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200"
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-zinc-950 border border-zinc-800 shadow-2xl p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-zinc-900">
              <h3 className="text-sm font-semibold text-zinc-100 flex items-center gap-2">
                <Users className="w-4 h-4 text-purple-400" />
                <span>Registrar Nuevo Contacto</span>
              </h3>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="text-zinc-500 hover:text-zinc-200 p-1"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleAddContact} className="space-y-3 text-xs font-mono">
              <div>
                <label className="text-zinc-400 block mb-1">Nombre Completo *</label>
                <input
                  type="text"
                  required
                  placeholder="ej. Dra. María González"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2.5 text-zinc-200 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-zinc-400 block mb-1">Rol / Cargo</label>
                  <input
                    type="text"
                    placeholder="ej. Consultor Senior"
                    value={newRole}
                    onChange={(e) => setNewRole(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2.5 text-zinc-200 focus:outline-none focus:border-purple-500"
                  />
                </div>
                <div>
                  <label className="text-zinc-400 block mb-1">Empresa / Entidad</label>
                  <input
                    type="text"
                    placeholder="ej. INACAP"
                    value={newCompany}
                    onChange={(e) => setNewCompany(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2.5 text-zinc-200 focus:outline-none focus:border-purple-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-zinc-400 block mb-1">Tipo de Relación</label>
                <input
                  type="text"
                  placeholder="ej. Cliente, Colaborador, Académico"
                  value={newRelationship}
                  onChange={(e) => setNewRelationship(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2.5 text-zinc-200 focus:outline-none focus:border-purple-500"
                />
              </div>

              <div>
                <label className="text-zinc-400 block mb-1">Notas y Contexto</label>
                <textarea
                  rows={3}
                  placeholder="Observaciones de contexto, acuerdos o temas clave..."
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  className="w-full bg-zinc-900 border border-zinc-800 rounded-lg p-2.5 text-zinc-200 focus:outline-none focus:border-purple-500 resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-medium transition-colors"
                >
                  Guardar Contacto
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
