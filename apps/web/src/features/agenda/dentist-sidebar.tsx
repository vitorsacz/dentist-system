import { useState } from "react";
import { LOCATION_COLOR_HEX, LOCATION_COLOR_TOKENS, type LocationColorToken } from "./location-colors";
import type { MockDentist } from "./mock-data";

interface DentistSidebarProps {
  dentists: MockDentist[];
  hiddenDentistIds: Set<string>;
  onToggle: (dentistId: string) => void;
  onChangeColor: (dentistId: string, colorToken: LocationColorToken) => void;
}

// Cadastro de dentista não vive mais aqui — é um fluxo mais pesado (convite,
// CRO) que já tem tela própria em Usuários; esta sidebar só lê o roster
// real (GET organization/dentists) e deixa editar a cor de identidade.
export function DentistSidebar({ dentists, hiddenDentistIds, onToggle, onChangeColor }: DentistSidebarProps) {
  const [colorPickerFor, setColorPickerFor] = useState<string | null>(null);

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
                  <span className="min-w-0 truncate">{dentist.name}</span>
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

      <p className="mt-4 text-xs text-muted">Pra cadastrar um novo dentista, use a tela de Usuários.</p>
    </aside>
  );
}
