"use client";

import { useCallback, useState } from "react";
import Map, { ScaleControl, type ViewStateChangeEvent } from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import { Compass, LocateFixed, Minus, Plus, Satellite } from "lucide-react";
import { cn } from "@/lib/utils";
import { jetbrainsMono } from "@/lib/fonts";
import { LayerControl } from "@/components/investigation/layer-control";
import type { MapLayerId, MapLayerToggle } from "@/types/investigation";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

/** Fictional initial investigation location (oil-spill-pipeline CLAUDE.md §6). */
const INITIAL_COORDINATES = { lat: 18.5421, lon: 72.8234 };
const INITIAL_ZOOM = 6.4;

const MIN_ZOOM = 1.5;
const MAX_ZOOM = 18;

interface ViewState {
  longitude: number;
  latitude: number;
  zoom: number;
  bearing: number;
  pitch: number;
}

const INITIAL_VIEW_STATE: ViewState = {
  longitude: INITIAL_COORDINATES.lon,
  latitude: INITIAL_COORDINATES.lat,
  zoom: INITIAL_ZOOM,
  bearing: 0,
  pitch: 0,
};

interface InvestigationMapProps {
  investigationStarted: boolean;
  layers: MapLayerToggle[];
  onToggleLayer: (id: MapLayerId) => void;
}

export function InvestigationMap({
  investigationStarted,
  layers,
  onToggleLayer,
}: InvestigationMapProps) {
  const [viewState, setViewState] = useState<ViewState>(INITIAL_VIEW_STATE);
  const hasToken = Boolean(MAPBOX_TOKEN);

  const zoomBy = useCallback((delta: number) => {
    setViewState((current) => ({
      ...current,
      zoom: Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, current.zoom + delta)),
    }));
  }, []);

  const resetBearing = useCallback(() => {
    setViewState((current) => ({ ...current, bearing: 0, pitch: 0 }));
  }, []);

  const recenter = useCallback(() => {
    setViewState((current) => ({
      ...current,
      longitude: INITIAL_COORDINATES.lon,
      latitude: INITIAL_COORDINATES.lat,
      zoom: INITIAL_ZOOM,
    }));
  }, []);

  return (
    <div
      className={cn(
        "relative h-full w-full overflow-hidden bg-[#04060a]",
        jetbrainsMono.variable
      )}
    >
      {hasToken ? (
        <Map
          {...viewState}
          onMove={(event: ViewStateChangeEvent) => setViewState(event.viewState)}
          mapboxAccessToken={MAPBOX_TOKEN}
          mapStyle="mapbox://styles/mapbox/dark-v11"
          style={{ width: "100%", height: "100%" }}
          minZoom={MIN_ZOOM}
          maxZoom={MAX_ZOOM}
        >
          <ScaleControl position="bottom-right" unit="metric" />
        </Map>
      ) : (
        <FallbackOceanBackdrop />
      )}

      {/* Atmospheric depth framing — subtle, present in both real-map and
          fallback states. Not geography, just cinematic vignette chrome. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse at 50% 42%, rgba(0,0,0,0) 45%, rgba(2,4,7,0.5) 100%)",
        }}
      />

      {!investigationStarted && <EmptyStateOverlay />}
      {!hasToken && <DevModeBadge />}

      <div className="pointer-events-none absolute inset-0">
        <div className="pointer-events-auto absolute right-4 top-4">
          <LayerControl layers={layers} onToggle={onToggleLayer} />
        </div>

        <MapControlRail
          disabled={!hasToken}
          bearing={viewState.bearing}
          onZoomIn={() => zoomBy(1)}
          onZoomOut={() => zoomBy(-1)}
          onResetBearing={resetBearing}
          onRecenter={recenter}
        />
      </div>

      <style jsx global>{`
        .mapboxgl-ctrl-scale {
          background: rgba(11, 15, 22, 0.85) !important;
          border-color: rgba(255, 255, 255, 0.2) !important;
          color: rgba(255, 255, 255, 0.5) !important;
          font-family: var(--font-jetbrains-mono), ui-monospace, monospace !important;
          font-size: 9px !important;
          padding: 1px 4px !important;
        }
        .mapboxgl-ctrl-attrib {
          background: transparent !important;
          font-size: 9px !important;
        }
        .mapboxgl-ctrl-attrib a {
          color: rgba(255, 255, 255, 0.35) !important;
        }
        .mapboxgl-ctrl-bottom-right {
          display: flex;
          align-items: center;
          gap: 4px;
        }
      `}</style>
    </div>
  );
}

/**
 * Deep-ocean backdrop shown only when Mapbox is unavailable. A faint tonal
 * gradient plus a two-tier coordinate graticule — deliberately technical,
 * not a stand-in for real geography.
 */
function FallbackOceanBackdrop() {
  return (
    <div
      aria-hidden
      className="absolute inset-0"
      style={{
        backgroundColor: "#04060a",
        backgroundImage: [
          "linear-gradient(180deg, rgba(22,36,52,0.4) 0%, rgba(4,6,10,0) 45%)",
          "linear-gradient(rgba(148,163,184,0.045) 1px, transparent 1px)",
          "linear-gradient(90deg, rgba(148,163,184,0.045) 1px, transparent 1px)",
          "linear-gradient(rgba(148,163,184,0.09) 1px, transparent 1px)",
          "linear-gradient(90deg, rgba(148,163,184,0.09) 1px, transparent 1px)",
        ].join(", "),
        backgroundSize:
          "100% 100%, 48px 48px, 48px 48px, 240px 240px, 240px 240px",
      }}
    />
  );
}

/**
 * Small secondary indicator that Mapbox isn't configured. Deliberately
 * corner-anchored and low-key so it never competes with the primary
 * "No Active Case" messaging (oil-spill-pipeline/CLAUDE.md visual review).
 */
function DevModeBadge() {
  return (
    <div className="pointer-events-none absolute left-4 top-4 flex items-center gap-1.5 rounded-sm border border-[#D8A34E]/25 bg-[#0b0f16]/75 px-2 py-1 text-[9px] uppercase tracking-[0.08em] text-[#D8A34E]/85">
      <Satellite className="size-3" aria-hidden />
      Map Offline — Development Mode
    </div>
  );
}

function EmptyStateOverlay() {
  return (
    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
      <div className="mb-4 flex size-11 items-center justify-center rounded-full border border-white/12">
        <div className="size-1.5 rounded-full bg-white/40" />
      </div>

      <p className="text-[13px] font-medium tracking-[0.04em] text-white/75">
        No Active Case
      </p>
      <p className="mt-1.5 max-w-[220px] text-[12px] leading-relaxed text-white/40">
        Upload SAR imagery to begin investigation
      </p>

      <div className="mt-5 h-px w-10 bg-white/10" aria-hidden />

      <div
        className={cn(
          "mt-5 space-y-1 text-[10.5px] tracking-wide text-white/30",
          jetbrainsMono.className
        )}
      >
        <p>LAT 18.5421° N</p>
        <p>LON 72.8234° E</p>
      </div>
    </div>
  );
}

function MapControlRail({
  disabled,
  bearing,
  onZoomIn,
  onZoomOut,
  onResetBearing,
  onRecenter,
}: {
  disabled: boolean;
  bearing: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetBearing: () => void;
  onRecenter: () => void;
}) {
  return (
    <div className="pointer-events-auto absolute right-4 top-1/2 flex -translate-y-1/2 flex-col overflow-hidden rounded-sm border border-white/[0.08] bg-[#0b0f16]/75">
      <ControlButton label="Zoom in" onClick={onZoomIn} disabled={disabled}>
        <Plus className="size-3.5" />
      </ControlButton>
      <ControlButton
        label="Zoom out"
        onClick={onZoomOut}
        disabled={disabled}
        className="border-t border-white/[0.08]"
      >
        <Minus className="size-3.5" />
      </ControlButton>
      <ControlButton
        label="Reset bearing to north"
        onClick={onResetBearing}
        disabled={disabled}
        className="border-t border-white/[0.08]"
      >
        <Compass
          className="size-3.5 transition-transform"
          style={{ transform: `rotate(${-bearing}deg)` }}
        />
      </ControlButton>
      <ControlButton
        label="Recenter on investigation origin"
        onClick={onRecenter}
        disabled={disabled}
        className="border-t border-white/[0.08]"
      >
        <LocateFixed className="size-3.5" />
      </ControlButton>
    </div>
  );
}

function ControlButton({
  label,
  onClick,
  disabled,
  className,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex size-8 items-center justify-center text-white/60 transition-colors hover:bg-white/10 hover:text-white/90 disabled:pointer-events-none disabled:opacity-30 focus-visible:outline focus-visible:outline-1 focus-visible:outline-[#4FB8D9]",
        className
      )}
    >
      {children}
    </button>
  );
}
