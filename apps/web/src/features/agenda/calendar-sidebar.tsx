import type { MockLocation } from "./mock-data";
import { LOCATION_COLOR_HEX } from "./location-colors";

interface CalendarSidebarProps {
  locations: MockLocation[];
  hiddenLocationIds: Set<string>;
  onToggle: (locationId: string) => void;
}

export function CalendarSidebar({ locations, hiddenLocationIds, onToggle }: CalendarSidebarProps) {
  return (
    <aside className="w-64 shrink-0 rounded-2xl border border-line bg-surface p-4">
      <p className="mb-3 text-sm font-medium text-ink">Consultórios</p>
      <ul className="space-y-2">
        {locations.map((location) => {
          const checked = !hiddenLocationIds.has(location.id);
          const color = LOCATION_COLOR_HEX[location.colorToken];
          return (
            <li key={location.id}>
              <label className="flex cursor-pointer items-center gap-2.5 text-sm text-ink">
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={() => onToggle(location.id)}
                  className="h-4 w-4 rounded"
                  style={{ accentColor: color.solid }}
                />
                <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: color.solid }} />
                {location.name}
              </label>
            </li>
          );
        })}
        {locations.length === 0 && <p className="text-sm text-muted">Nenhum consultório cadastrado.</p>}
      </ul>
    </aside>
  );
}
