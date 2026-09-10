"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Map, {
  ScaleControl,
  type MapRef,
  type ViewStateChangeEvent,
} from "react-map-gl/mapbox";
import "mapbox-gl/dist/mapbox-gl.css";
import { useReducedMotion } from "motion/react";
import { Compass, FileWarning, LocateFixed, Minus, Plus, Satellite } from "lucide-react";
import { cn } from "@/lib/utils";
import { jetbrainsMono } from "@/lib/fonts";
import { LayerControl } from "@/components/investigation/layer-control";
import { DetectionLayer } from "@/components/map/layers/detection-layer";
import { PipelineLayer } from "@/components/map/layers/infrastructure-layer";
import {
  ForecastLayer,
  HindcastLayer,
} from "@/components/map/layers/drift-layer";
import {
  InvestigationMarkers,
  type MarkerKind,
} from "@/components/map/layers/investigation-markers";
import { PhaseNarrative } from "@/components/map/phase-narrative";
import { PhaseProgress } from "@/components/map/phase-progress";
import { InfrastructureBearing } from "@/components/map/infrastructure-bearing";
import { FeatureInspector } from "@/components/map/feature-inspector";
import {
  boundsOfFeatures,
  forecastFeature,
  hindcastFeature,
  nearestPlatformFeature,
  originFeature,
  padBounds,
  spillCentroidFeature,
  spillPolygonFeature,
  type MapBounds,
} from "@/lib/investigation-geo";
import { PHASE_ORDER, type PhaseId } from "@/lib/investigation-phases";
import type { InvestigationPlayback } from "@/hooks/use-investigation-playback";
import {
  findFeatureById,
  useInfrastructureGeometry,
} from "@/hooks/use-infrastructure-geometry";
import type {
  InvestigationCase,
  InvestigationStage,
  MapLayerId,
  MapLayerToggle,
} from "@/types/investigation";
import { isGeoTiff, useObjectUrl } from "@/hooks/use-object-url";

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;

const DARK_STYLE = "mapbox://styles/mapbox/dark-v11";
const SATELLITE_STYLE = "mapbox://styles/mapbox/satellite-streets-v12";

/** Arabian Sea overview — the region the prepared cases sit in. */
const INITIAL_COORDINATES = { lat: 13.5, lon: 68.5 };
const INITIAL_ZOOM = 5.2;

const MIN_ZOOM = 1.5;
const MAX_ZOOM = 18;

/** Camera framing per phase, in seconds of arc rather than zoom levels. */
const MIN_SPAN_DEGREES: Record<PhaseId, number> = {
  detection: 0.09,
  "rule-out": 0.14,
  "time-travel": 0.14,
  lineup: 0.12,
  verdict: 0.18,
};

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
  /** The ingested scene — a local reference image, never analysed. */
  sarFile?: File | null;
  /** The whole backend result; every drawn feature comes out of this. */
  investigation: InvestigationCase | null;
  investigationStarted: boolean;
  stages: InvestigationStage[];
  playback: InvestigationPlayback;
  layers: MapLayerToggle[];
  onToggleLayer: (id: MapLayerId) => void;
}

export function InvestigationMap({
  sarFile = null,
  investigation,
  investigationStarted,
  stages,
  playback,
  layers,
  onToggleLayer,
}: InvestigationMapProps) {
  const mapRef = useRef<MapRef | null>(null);
  const reducedMotion = useReducedMotion() ?? false;
  const sceneUrl = useObjectUrl(sarFile);
  const sceneIsGeoTiff = isGeoTiff(sarFile);
  const showScene = investigationStarted && sarFile !== null;
  const [viewState, setViewState] = useState<ViewState>(INITIAL_VIEW_STATE);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [inspected, setInspected] = useState<MarkerKind | null>(null);
  const hasToken = Boolean(MAPBOX_TOKEN);

  const infrastructure = useInfrastructureGeometry();
  // A plain record, not a `Map` — `Map` is the react-map-gl component here.
  const layerActive = useMemo(() => {
    const active: Partial<Record<MapLayerId, boolean>> = {};
    for (const layer of layers) active[layer.id] = layer.active;
    return active;
  }, [layers]);
  const isLayerOn = useCallback(
    (id: MapLayerId) => layerActive[id] ?? false,
    [layerActive]
  );

  /* -------------------------------------------------------------- */
  /* Features — straight from the backend response                   */
  /* -------------------------------------------------------------- */

  const detection = investigation?.detection ?? null;
  const triage = investigation?.triage ?? null;
  const drift = investigation?.drift ?? null;

  const spill = useMemo(() => spillPolygonFeature(detection), [detection]);
  const centroid = useMemo(() => spillCentroidFeature(detection), [detection]);
  const origin = useMemo(() => originFeature(drift), [drift]);
  const hindcast = useMemo(() => hindcastFeature(drift), [drift]);
  const forecast = useMemo(() => forecastFeature(drift), [drift]);
  const platform = useMemo(() => nearestPlatformFeature(triage), [triage]);

  // Only the route the triage engine actually named is drawn.
  const pipeline = useMemo(
    () => findFeatureById(infrastructure.pipelines, triage?.evidence.pipeline.id),
    [infrastructure.pipelines, triage]
  );

  const platformNearby = triage?.evidence.platform.nearby ?? false;
  const pipelineNearby = triage?.evidence.pipeline.nearby ?? false;

  /* -------------------------------------------------------------- */
  /* Phase-driven visibility                                         */
  /* -------------------------------------------------------------- */

  const phaseIndex = PHASE_ORDER.indexOf(playback.activePhase);
  const reached = useCallback(
    (phase: PhaseId) => investigationStarted && phaseIndex >= PHASE_ORDER.indexOf(phase),
    [investigationStarted, phaseIndex]
  );

  const showDetection = reached("detection") && isLayerOn("detection");
  const showInfrastructure = reached("rule-out") && isLayerOn("infrastructure");
  const showDrift = reached("time-travel") && isLayerOn("drift");
  const showForecast = reached("verdict") && isLayerOn("forecast");

  /* -------------------------------------------------------------- */
  /* Camera                                                          */
  /* -------------------------------------------------------------- */

  const phaseBounds = useMemo((): MapBounds | null => {
    if (!investigationStarted) return null;

    // Infrastructure is only framed when the backend called it nearby —
    // pulling a 478 km-distant platform into frame would lose the slick.
    const framedPlatform = platformNearby ? platform : null;
    const framedPipeline = pipelineNearby ? pipeline : null;

    switch (playback.activePhase) {
      case "detection":
        return boundsOfFeatures([spill, centroid]);
      case "rule-out":
        return boundsOfFeatures([spill, centroid, framedPlatform, framedPipeline]);
      case "time-travel":
        return boundsOfFeatures([spill, hindcast, origin]);
      case "lineup":
        return boundsOfFeatures([spill, origin, hindcast]);
      case "verdict":
        return boundsOfFeatures([
          spill,
          hindcast,
          forecast,
          origin,
          framedPlatform,
          framedPipeline,
        ]);
    }
  }, [
    investigationStarted,
    playback.activePhase,
    spill,
    centroid,
    hindcast,
    forecast,
    origin,
    platform,
    pipeline,
    platformNearby,
    pipelineNearby,
  ]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapLoaded || !phaseBounds) return;

    map.fitBounds(padBounds(phaseBounds, MIN_SPAN_DEGREES[playback.activePhase]), {
      padding: { top: 80, bottom: 205, left: 120, right: 205 },
      duration: reducedMotion ? 0 : 1500,
      maxZoom: 12.5,
      essential: true,
    });
  }, [phaseBounds, playback.activePhase, mapLoaded, reducedMotion]);

  /* -------------------------------------------------------------- */

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
    const map = mapRef.current;
    if (map && phaseBounds) {
      map.fitBounds(padBounds(phaseBounds, MIN_SPAN_DEGREES[playback.activePhase]), {
        padding: { top: 80, bottom: 205, left: 120, right: 205 },
        duration: reducedMotion ? 0 : 900,
        maxZoom: 12.5,
      });
      return;
    }
    setViewState((current) => ({
      ...current,
      longitude: INITIAL_COORDINATES.lon,
      latitude: INITIAL_COORDINATES.lat,
      zoom: INITIAL_ZOOM,
    }));
  }, [phaseBounds, playback.activePhase, reducedMotion]);

  const narrative = playback.narratives?.[playback.activePhase] ?? null;

  return (
    <div
      className={cn(
        "relative h-full w-full overflow-hidden bg-[#04060a]",
        jetbrainsMono.variable
      )}
    >
      {hasToken ? (
        <Map
          ref={mapRef}
          {...viewState}
          onMove={(event: ViewStateChangeEvent) => setViewState(event.viewState)}
          onLoad={() => setMapLoaded(true)}
          onClick={() => setInspected(null)}
          mapboxAccessToken={MAPBOX_TOKEN}
          mapStyle={isLayerOn("basemap") ? SATELLITE_STYLE : DARK_STYLE}
          style={{ width: "100%", height: "100%" }}
          minZoom={MIN_ZOOM}
          maxZoom={MAX_ZOOM}
        >
          <ScaleControl position="bottom-right" unit="metric" />

          <DetectionLayer
            feature={spill}
            visible={showDetection}
            instant={reducedMotion}
          />

          <PipelineLayer
            feature={pipeline}
            nearby={pipelineNearby}
            visible={showInfrastructure}
            instant={reducedMotion}
          />

          <ForecastLayer
            feature={forecast}
            visible={showForecast}
            instant={reducedMotion}
          />

          <HindcastLayer
            feature={hindcast}
            visible={showDrift}
            instant={reducedMotion}
          />

          <InvestigationMarkers
            centroid={centroid}
            origin={origin}
            platform={platform}
            showCentroid={showDetection}
            showOrigin={showDrift}
            showPlatform={showInfrastructure}
            emphasiseOrigin={playback.activePhase === "lineup"}
            platformNearby={platformNearby}
            platformLabel={triage?.evidence.platform.id ?? null}
            reducedMotion={reducedMotion}
            onSelect={setInspected}
          />
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
            "radial-gradient(ellipse at 50% 42%, rgba(0,0,0,0) 45%, rgba(2,4,7,0.55) 100%)",
        }}
      />

      {showScene && (
        <SceneOverlay url={sceneUrl} name={sarFile.name} geoTiff={sceneIsGeoTiff} />
      )}

      {!investigationStarted && <EmptyStateOverlay />}
      {!hasToken && <DevModeBadge />}

      <div className="pointer-events-none absolute inset-0">
        {investigationStarted && (
          <div className="pointer-events-auto absolute left-4 top-4">
            <PhaseProgress
              stages={stages}
              activePhase={playback.activePhase}
              revealedPhases={playback.revealedPhases}
              isPlaying={playback.isPlaying}
              isComplete={playback.isComplete}
              onSelectPhase={playback.selectPhase}
              onPause={playback.pause}
              onResume={playback.resume}
              onReplay={playback.replay}
              onSkipToEnd={playback.skipToEnd}
            />
          </div>
        )}

        {investigationStarted && (
          <div className="pointer-events-auto absolute bottom-4 left-4 flex flex-col items-start gap-2.5">
            <FeatureInspector
              kind={inspected}
              investigation={investigation}
              onClose={() => setInspected(null)}
              reducedMotion={reducedMotion}
            />

            {/* Ruled-out infrastructure that is too distant to draw. */}
            <InfrastructureBearing
              origin={origin}
              platform={platform}
              distanceKm={triage?.evidence.platform.distance_km ?? null}
              name={triage?.evidence.platform.id ?? null}
              visible={
                playback.activePhase === "rule-out" &&
                showInfrastructure &&
                !platformNearby
              }
              reducedMotion={reducedMotion}
            />

            <PhaseNarrative narrative={narrative} reducedMotion={reducedMotion} />
          </div>
        )}

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
    <div
      className="pointer-events-none absolute left-4 bottom-4 flex items-center gap-1.5 rounded-sm border border-white/10 bg-[#0b0f16]/75 px-2 py-1 text-[9px] uppercase tracking-[0.08em] text-white/45"
      title="Set NEXT_PUBLIC_MAPBOX_TOKEN in .env.local to enable the basemap"
    >
      <Satellite className="size-3" aria-hidden />
      Basemap not configured
    </div>
  );
}

/**
 * The ingested SAR scene. Presented as an uploaded image, NOT as a
 * georeferenced layer — nothing here has been geolocated or analysed, and
 * the labelling has to keep that honest.
 */
function SceneOverlay({
  url,
  name,
  geoTiff,
}: {
  url: string | null;
  name: string;
  geoTiff: boolean;
}) {
  return (
    // Left column, below the phase strip — the right edge belongs to the
    // layer control, the zoom rail and the scale bar.
    <div className="pointer-events-none absolute left-4 top-[58px] w-[172px] overflow-hidden rounded-sm border border-white/[0.08] bg-[#0b0f16]/85">
      <div className="relative flex h-[120px] items-center justify-center bg-[#05070a]">
        {url ? (
          // Local object URL for a user-selected file; next/image cannot
          // optimise a blob.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={`Ingested SAR scene: ${name}`}
            className="max-h-full max-w-full object-contain opacity-85"
          />
        ) : (
          <div className="px-3 text-center">
            <FileWarning className="mx-auto size-4 text-[#D8A34E]/70" aria-hidden />
            <p className="mt-2 text-[9.5px] leading-snug text-white/40">
              {geoTiff
                ? "GeoTIFF has no browser decoder."
                : "This file type can't be displayed."}
            </p>
          </div>
        )}
      </div>

      <div
        className={cn(
          "space-y-0.5 border-t border-white/[0.08] px-2 py-1.5 text-[8.5px] text-white/40",
          jetbrainsMono.className
        )}
      >
        <p className="truncate">{name}</p>
        <p className="text-white/25">Uploaded scene · not georeferenced</p>
      </div>
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
      <p className="mt-1.5 max-w-[240px] text-[12px] leading-relaxed text-white/40">
        Select a prepared case and start the investigation to reveal the
        evidence in sequence.
      </p>

      <div className="mt-5 h-px w-10 bg-white/10" aria-hidden />

      <div
        className={cn(
          "mt-5 space-y-1 text-[10.5px] tracking-wide text-white/30",
          jetbrainsMono.className
        )}
      >
        <p>ARABIAN SEA</p>
        <p>13.5000° N  68.5000° E</p>
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
        label="Reframe on the current phase"
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
