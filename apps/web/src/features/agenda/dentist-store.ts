import { locationColorForIndex, type LocationColorToken } from "./location-colors";

// Mock de "cadastro de dentistas" — não existe tabela real pra isso ainda
// (Prisma não tem Dentist/cor/CRO), então persiste em localStorage só pra
// sobreviver a reload durante a fase de maquete. Quando o backend ganhar
// esse conceito, isso vira um GET/POST real.
export interface MockDentist {
  id: string;
  name: string;
  croUf: string;
  email: string;
  colorToken: LocationColorToken;
}

const STORAGE_KEY = "agenda-mock-dentists";

const SEED_DENTISTS: MockDentist[] = [
  { id: "dentist-seed-1", name: "Dr. Rafael Lima", croUf: "CRO-SP 45210", email: "rafael.lima@example.com", colorToken: locationColorForIndex(0) },
  { id: "dentist-seed-2", name: "Dra. Carla Nunes", croUf: "CRO-SP 38122", email: "carla.nunes@example.com", colorToken: locationColorForIndex(1) },
  { id: "dentist-seed-3", name: "Dr. Bruno Alves", croUf: "CRO-RJ 29874", email: "bruno.alves@example.com", colorToken: locationColorForIndex(2) },
];

function persist(dentists: MockDentist[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(dentists));
}

export function loadDentists(): MockDentist[] {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    persist(SEED_DENTISTS);
    return SEED_DENTISTS;
  }
  try {
    const parsed = JSON.parse(raw) as MockDentist[];
    if (Array.isArray(parsed) && parsed.length > 0) return parsed;
  } catch {
    // JSON inválido — recria a semente
  }
  persist(SEED_DENTISTS);
  return SEED_DENTISTS;
}

export function addDentist(input: { name: string; croUf: string; email: string }): MockDentist[] {
  const current = loadDentists();
  const dentist: MockDentist = {
    id: `dentist-${Date.now()}`,
    name: input.name,
    croUf: input.croUf,
    email: input.email,
    colorToken: locationColorForIndex(current.length),
  };
  const next = [...current, dentist];
  persist(next);
  return next;
}

export function updateDentistColor(dentistId: string, colorToken: LocationColorToken): MockDentist[] {
  const next = loadDentists().map((d) => (d.id === dentistId ? { ...d, colorToken } : d));
  persist(next);
  return next;
}
