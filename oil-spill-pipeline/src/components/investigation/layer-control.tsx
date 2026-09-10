"use client";

import {
  Building2,
  Circle,
  CircleCheck,
  CloudSun,
  RadioTower,
  Satellite,
  Waves,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { MapLayerId, MapLayerToggle } from "@/types/investigation";

const LAYER_ICONS: Record<MapLayerId, LucideIcon> = {
  satellite: Satellite,
  oceanographic: Waves,
  ais: RadioTower,
  infrastructure: Building2,
  weather: CloudSun,
};

interface LayerControlProps {
  layers: MapLayerToggle[];
  onToggle: (id: MapLayerId) => void;
}

/**
 * Floating map layer toggle (oil-spill-pipeline/CLAUDE.md §13). Layers track
 * state only — no real data sources are wired up in Phase 2.
 */
export function LayerControl({ layers, onToggle }: LayerControlProps) {
  return (
    <div className="w-40 overflow-hidden rounded-sm border border-white/[0.08] bg-[#0b0f16]/75">
      <p className="border-b border-white/[0.08] px-2.5 py-1.5 text-[9px] font-medium uppercase tracking-[0.14em] text-white/35">
        Layers
      </p>
      <ul>
        {layers.map((layer) => {
          const Icon = LAYER_ICONS[layer.id];
          const StatusIcon = layer.active ? CircleCheck : Circle;
          return (
            <li key={layer.id}>
              <button
                type="button"
                aria-pressed={layer.active}
                onClick={() => onToggle(layer.id)}
                className={cn(
                  "flex w-full items-center justify-between gap-2 px-2.5 py-1.5 text-left text-[10.5px] transition-colors hover:bg-white/[0.05] focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#4FB8D9]",
                  layer.active ? "text-white/80" : "text-white/35"
                )}
              >
                <span className="flex items-center gap-2">
                  <Icon
                    className={cn(
                      "size-3",
                      layer.active ? "text-[#4FB8D9]" : "text-white/30"
                    )}
                    aria-hidden
                  />
                  {layer.label}
                </span>
                <StatusIcon
                  className={cn(
                    "size-3 shrink-0",
                    layer.active ? "text-[#4FB8D9]" : "text-white/20"
                  )}
                  aria-hidden
                />
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
