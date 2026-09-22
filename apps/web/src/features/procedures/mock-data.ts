import { useQuery } from "@tanstack/react-query";

export type ProcedureStatus = "active" | "inactive";

export interface ProcedureCategory {
  id: string;
  name: string;
}

export interface CatalogProcedure {
  // Id estável de propósito — é o identificador que uma futura tabela
  // PROCEDURE_LOG (execuções reais: procedure_id, patient_id,
  // dentist_user_id, performed_at, charged_price, appointment_id) vai
  // referenciar por FK. Não é regenerado em edições, só em criação.
  id: string;
  name: string;
  categoryId: string;
  estimatedDurationMinutes: number;
  basePrice: number;
  description?: string;
  status: ProcedureStatus;
  createdAt: string;
}

export const DEFAULT_CATEGORIES: ProcedureCategory[] = [
  { id: "preventivo", name: "Preventivo" },
  { id: "restaurador", name: "Restaurador" },
  { id: "cirurgico", name: "Cirúrgico" },
  { id: "endodontia", name: "Endodontia" },
  { id: "estetico", name: "Estético" },
  { id: "ortodontia", name: "Ortodontia" },
];

const MOCK_PROCEDURES: CatalogProcedure[] = [
  {
    id: "proc-1",
    name: "Consulta / avaliação",
    categoryId: "preventivo",
    estimatedDurationMinutes: 30,
    basePrice: 150,
    description: "Avaliação inicial do paciente, sem procedimento associado.",
    status: "active",
    createdAt: "2026-04-10T00:00:00.000Z",
  },
  {
    id: "proc-2",
    name: "Limpeza (profilaxia)",
    categoryId: "preventivo",
    estimatedDurationMinutes: 40,
    basePrice: 180,
    status: "active",
    createdAt: "2026-04-10T00:00:00.000Z",
  },
  {
    id: "proc-3",
    name: "Aplicação de flúor",
    categoryId: "preventivo",
    estimatedDurationMinutes: 20,
    basePrice: 90,
    status: "active",
    createdAt: "2026-04-12T00:00:00.000Z",
  },
  {
    id: "proc-4",
    name: "Restauração (resina)",
    categoryId: "restaurador",
    estimatedDurationMinutes: 50,
    basePrice: 250,
    status: "active",
    createdAt: "2026-04-15T00:00:00.000Z",
  },
  {
    id: "proc-5",
    name: "Restauração em porcelana",
    categoryId: "restaurador",
    estimatedDurationMinutes: 90,
    basePrice: 900,
    status: "inactive",
    description: "Descontinuado — substituído por facetas cerâmicas.",
    createdAt: "2026-05-02T00:00:00.000Z",
  },
  {
    id: "proc-6",
    name: "Extração simples",
    categoryId: "cirurgico",
    estimatedDurationMinutes: 45,
    basePrice: 300,
    status: "active",
    createdAt: "2026-05-10T00:00:00.000Z",
  },
  {
    id: "proc-7",
    name: "Extração de siso",
    categoryId: "cirurgico",
    estimatedDurationMinutes: 60,
    basePrice: 550,
    status: "active",
    createdAt: "2026-05-10T00:00:00.000Z",
  },
  {
    id: "proc-8",
    name: "Canal (endodontia)",
    categoryId: "endodontia",
    estimatedDurationMinutes: 90,
    basePrice: 900,
    status: "active",
    createdAt: "2026-05-18T00:00:00.000Z",
  },
  {
    id: "proc-9",
    name: "Retratamento de canal",
    categoryId: "endodontia",
    estimatedDurationMinutes: 100,
    basePrice: 1100,
    status: "active",
    createdAt: "2026-05-20T00:00:00.000Z",
  },
  {
    id: "proc-10",
    name: "Clareamento dental",
    categoryId: "estetico",
    estimatedDurationMinutes: 60,
    basePrice: 700,
    status: "active",
    createdAt: "2026-06-01T00:00:00.000Z",
  },
  {
    id: "proc-11",
    name: "Faceta de resina",
    categoryId: "estetico",
    estimatedDurationMinutes: 75,
    basePrice: 850,
    status: "active",
    createdAt: "2026-06-05T00:00:00.000Z",
  },
  {
    id: "proc-12",
    name: "Manutenção de aparelho",
    categoryId: "ortodontia",
    estimatedDurationMinutes: 30,
    basePrice: 200,
    status: "active",
    createdAt: "2026-06-10T00:00:00.000Z",
  },
  {
    id: "proc-13",
    name: "Instalação de aparelho fixo",
    categoryId: "ortodontia",
    estimatedDurationMinutes: 120,
    basePrice: 1800,
    status: "inactive",
    description: "Pausado enquanto renegociamos fornecedor de bráquetes.",
    createdAt: "2026-06-15T00:00:00.000Z",
  },
];

export function useMockProcedureCatalog() {
  return useQuery({
    queryKey: ["procedures", "catalog", "mock"],
    queryFn: () =>
      new Promise<{ categories: ProcedureCategory[]; procedures: CatalogProcedure[] }>((resolve) =>
        setTimeout(() => resolve({ categories: DEFAULT_CATEGORIES, procedures: MOCK_PROCEDURES }), 500),
      ),
  });
}
