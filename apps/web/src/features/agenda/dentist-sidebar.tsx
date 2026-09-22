import { useState } from "react";
import { Plus } from "lucide-react";
import { LOCATION_COLOR_HEX, LOCATION_COLOR_TOKENS, type LocationColorToken } from "./location-colors";
import type { MockDentist } from "./dentist-store";

interface DentistSidebarProps {
  dentists: MockDentist[];
  hiddenDentistIds: Set<string>;
  onToggle: (dentistId: string) => void;
  onAddDentist: (input: { name: string; croUf: string; email: string }) => void;
  onChangeColor: (dentistId: string, colorToken: LocationColorToken) => void;
}

export function DentistSidebar({
  dentists,
  hiddenDentistIds,
  onToggle,
  onAddDentist,
  onChangeColor,
}: DentistSidebarProps) {
  const [colorPickerFor, setColorPickerFor] = useState<string | null>(null);
  const [addFormOpen, setAddFormOpen] = useState(false);
  const [name, setName] = useState("");
  const [croUf, setCroUf] = useState("");
  const [email, setEmail] = useState("");

  function handleAddSubmit() {
    if (!name.trim() || !croUf.trim()) return;
    onAddDentist({ name: name.trim(), croUf: croUf.trim(), email: email.trim() });
    setName("");
    setCroUf("");
    setEmail("");
    setAddFormOpen(false);
  }

  return (
    <aside className="w-64 shrink-0 rounded-2xl border border-line bg-surface p-4">
      <p className="mb-3 text-sm font-medium text-ink">Dentistas</p>
      <ul className="space-y-2">
        {dentists.map((dentist) => {
          const checked = !hiddenDentistIds.has(dentist.id);
          const color = LOCATION_COLOR_HEX[dentist.colorToken];
          return (
            <li key={dentist.id} className="relative">
              <div className="flex items-center gap-2.5 text-sm text-ink">
                <label className="flex flex-1 cursor-pointer items-center gap-2.5 min-w-0">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggle(dentist.id)}
                    className="h-4 w-4 shrink-0 rounded"
                    style={{ accentColor: color.solid }}
                  />
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      setColorPickerFor((prev) => (prev === dentist.id ? null : dentist.id));
                    }}
                    className="h-2.5 w-2.5 shrink-0 rounded-sm"
                    style={{ backgroundColor: color.solid }}
                    aria-label={`Trocar cor de ${dentist.name}`}
                  />
                  <span className="min-w-0 truncate">
                    <span className="block truncate">{dentist.name}</span>
                    <span className="block truncate text-xs text-muted">{dentist.croUf}</span>
                  </span>
                </label>
              </div>
              {colorPickerFor === dentist.id && (
                <div className="absolute left-0 top-full z-10 mt-1 flex gap-1.5 rounded-lg border border-line bg-surface p-2 shadow-lg">
                  {LOCATION_COLOR_TOKENS.map((token) => (
                    <button
                      key={token}
                      type="button"
                      onClick={() => {
                        onChangeColor(dentist.id, token);
                        setColorPickerFor(null);
                      }}
                      className="h-5 w-5 rounded-full ring-offset-1 hover:ring-2 hover:ring-gray-300"
                      style={{ backgroundColor: LOCATION_COLOR_HEX[token].solid }}
                      aria-label={`Cor ${token}`}
                    />
                  ))}
                </div>
              )}
            </li>
          );
        })}
        {dentists.length === 0 && <p className="text-sm text-muted">Nenhum dentista cadastrado.</p>}
      </ul>

      {addFormOpen ? (
        <div className="mt-4 space-y-2 rounded-lg border border-line p-3">
          <input
            type="text"
            placeholder="Nome"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-md border border-line px-2 py-1.5 text-sm"
          />
          <input
            type="text"
            placeholder="CRO + UF (ex: CRO-SP 12345)"
            value={croUf}
            onChange={(e) => setCroUf(e.target.value)}
            className="w-full rounded-md border border-line px-2 py-1.5 text-sm"
          />
          <input
            type="email"
            placeholder="E-mail (opcional)"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-md border border-line px-2 py-1.5 text-sm"
          />
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => setAddFormOpen(false)}
              className="rounded-md px-2 py-1 text-xs text-muted"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleAddSubmit}
              disabled={!name.trim() || !croUf.trim()}
              className="rounded-md bg-accent px-2 py-1 text-xs font-medium text-white disabled:opacity-60"
            >
              Salvar
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAddFormOpen(true)}
          className="mt-4 flex w-full items-center justify-center gap-1.5 rounded-lg border border-dashed border-line px-3 py-1.5 text-xs font-medium text-muted hover:bg-gray-100"
        >
          <Plus className="h-3.5 w-3.5" />
          Novo dentista
        </button>
      )}
    </aside>
  );
}
