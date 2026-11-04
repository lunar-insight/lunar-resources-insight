import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Button, ToggleButton, TooltipTrigger } from 'react-aria-components';
import { CATEGORY_COLOR, fullLineName } from 'components/inspector/lineView';
import { ButtonTooltip } from 'components/layout/Tooltip/ButtonTooltip';
import type { Feature } from 'components/navigation/FeaturesSection/types';
import { colormapService } from 'services/ColormapService';
import {
  featureCenter,
  featureKind,
  formatLatitude,
  formatLongitude,
  shapeRing,
  type LonLat,
} from 'services/inspector/featureGeometry';
import type { InspectorLine, LineFile } from 'services/inspector/inspectorLayers';
import { formatValue } from 'services/inspector/inspectorStatistics';
import {
  FRAME,
  PICTURE_HEIGHT,
  PICTURE_WIDTH,
  fromFrame,
  insideMask,
  project,
  scaleBar,
  toFrame,
  unproject,
  viewSizeText,
} from 'services/inspector/pictureGeometry';
import {
  GRAY_TABLE,
  binMask,
  colorize,
  limitMask,
  limitShare,
  readoutDecimals,
  valueOf,
  type ValueRange,
} from 'services/inspector/pictureValues';
import type { LoadedPicture } from 'services/inspector/PictureStore';
import { useInspectorContext } from 'utils/context/InspectorContext';
import { useLayerContext, type MapDisplay } from 'utils/context/LayerContext';
import { ColorButton, tableGradient, type ColorState } from './ColorButton';
import { drawPicture, type FramePoint, type PictureOverlays } from './drawPicture';
import { InfoRow } from './InfoRow';
import { maskToCanvas, pixelsToCanvas, resolveCssColor } from './pictureCanvas';
import { usePicture, type UsedPicture } from './usePicture';
import styles from './MiniViewer.module.scss';

/** Values lit on the picture, from a histogram bar or the Most line. */
export interface PictureHighlight {
  range: ValueRange;
  /** Text of the info row. */
  text: string;
}

/** The clipped limit a point sits at. */
export interface PictureLimit {
  value: number;
  longitudes?: ValueRange;
}

interface MiniViewerProps {
  feature: Feature;
  line: InspectorLine;
  file: LineFile;
  highlight?: PictureHighlight | null;
  limit?: PictureLimit;
}

const LIMIT_COLOR = 'var(--data-coverage)';
const LIT_OPACITY = 0.94;
const SHADE_OPACITY = 0.59;
const LIMIT_OPACITY = 0.96;
const TERRAIN_TEXT = 'Terrain: LROC WAC, 100 m per pixel';

const tableOf = (colormap: string) => (colormap === 'gray' ? GRAY_TABLE : colormapService.getColormapTable(colormap));

/** Whether the map draws a layer otherwise than the picture's own gray and viridis at the whole Moon range. */
function differsFromPicture(display: MapDisplay, moon: ValueRange): boolean {
  const ownColors = display.colormap === 'gray' || display.colormap === 'viridis';
  return !ownColors || display.rescale[0] !== moon[0] || display.rescale[1] !== moon[1] || display.filter !== null;
}

const stateText = (status: 'waiting' | 'loading') =>
  (status === 'waiting' ? 'Waiting for the map to stop moving' : 'Loading the picture');

const PictureState: React.FC<{ used: UsedPicture }> = ({ used }) => {
  const status = used.entry?.status ?? 'loading';
  if (status === 'failed') {
    return (
      <div className={styles.state}>
        The picture could not be loaded.
        <Button className={styles.retry} onPress={used.retry}>Retry</Button>
      </div>
    );
  }
  return (
    <div className={styles.state}>
      <span className={styles.progress}><span /></span>
      {stateText(status === 'waiting' ? 'waiting' : 'loading')}
    </div>
  );
};

const rangeEnd = (value: number, decimals: number) =>
  value.toLocaleString('en-US', { maximumFractionDigits: decimals });

/**
 * A picture of the line's layer around the feature. One gray image holds the
 * values, so colors, the readout, the highlight and the limit tint send no request.
 */
export const MiniViewer: React.FC<MiniViewerProps> = ({ feature, line, file, highlight, limit }) => {
  const { pictureColor, setPictureColor } = useInspectorContext();
  const { getMapDisplay } = useLayerContext();
  const [terrain, setTerrain] = useState(false);
  const [asOnMap, setAsOnMap] = useState(false);
  const [pointer, setPointer] = useState<FramePoint | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const dataPicture = usePicture(feature, file, 'data');
  const terrainPicture = usePicture(feature, file, 'terrain', terrain);
  const data: LoadedPicture | undefined = dataPicture.entry?.picture;
  const ground: LoadedPicture | undefined = terrainPicture.entry?.picture;

  const isPoint = featureKind(feature.type) === 'point';
  const categoryColor = CATEGORY_COLOR[line.category];

  // The map's colors are offered when they differ, and only while the layer is on the map
  const display = getMapDisplay(file.layerId);
  const mapTable = display ? tableOf(display.colormap) : undefined;
  const mapAvailable = !!(data && display && mapTable && differsFromPicture(display, data.range));
  const viridisTable = tableOf('viridis');

  useEffect(() => {
    if (asOnMap && data && !mapAvailable) {
      setAsOnMap(false);
      setPictureColor('gray');
    }
  }, [asOnMap, data, mapAvailable, setPictureColor]);

  const color: ColorState = asOnMap && mapAvailable ? 'map'
    : pictureColor === 'viridis' && viridisTable ? 'viridis'
    : 'gray';
  const colorTable = color === 'map' ? mapTable! : color === 'viridis' ? viridisTable! : GRAY_TABLE;
  const colorOrder: ColorState[] = ['gray', ...(viridisTable ? ['viridis' as const] : []), ...(mapAvailable ? ['map' as const] : [])];
  const mapDisplayKey = color === 'map' ? JSON.stringify(display) : '';

  const changeColor = (next: ColorState) => {
    setAsOnMap(next === 'map');
    if (next !== 'map') setPictureColor(next);
  };

  const shown = terrain ? ground : data;

  const base = useMemo(() => {
    if (!shown) return null;
    return pixelsToCanvas(terrain
      ? colorize(shown.gray, shown.alpha, shown.range, GRAY_TABLE)
      : colorize(shown.gray, shown.alpha, shown.range, colorTable, color === 'map' ? display : undefined));
    // mapDisplayKey stands for the display, a new object on every read
  }, [shown, terrain, colorTable, color, mapDisplayKey]);

  const ring = useMemo(() => (isPoint ? null : shapeRing(feature)), [isPoint, feature]);

  const inside = useMemo(
    () => (data && ring ? insideMask(ring, data.view, PICTURE_WIDTH, PICTURE_HEIGHT) : null),
    [data, ring],
  );

  const limitValue = limit?.value;
  const limitLongitudes = limit?.longitudes;
  const limitPixels = useMemo(
    () => (data && limitValue !== undefined
      ? limitMask(data.gray, data.alpha, data.range, limitValue, limitLongitudes, data.view)
      : null),
    [data, limitValue, limitLongitudes],
  );

  const lit = useMemo(
    () => (data && inside && highlight ? binMask(data.gray, data.alpha, inside, data.range, highlight.range) : null),
    [data, inside, highlight],
  );

  useEffect(() => {
    // The canvas exists only with a base and a picture to show
    const canvas = canvasRef.current;
    if (!canvas) return;
    const { view } = shown!;
    const tints: CanvasImageSource[] = [];
    if (lit) {
      const shade = inside!.map((value, i) => (value && data!.alpha[i] && !lit[i] ? 1 : 0));
      tints.push(maskToCanvas(shade, '#000', SHADE_OPACITY));
      tints.push(maskToCanvas(lit, resolveCssColor(canvas, categoryColor), LIT_OPACITY));
    }
    if (limitPixels) tints.push(maskToCanvas(limitPixels, resolveCssColor(canvas, LIMIT_COLOR), LIMIT_OPACITY));

    const toPoint = (p: LonLat) => {
      const { x, y } = project(p, view.center);
      return toFrame(x, y, view);
    };
    const overlays: PictureOverlays = ring
      ? { tints, color: feature.color, outline: ring.map(toPoint) }
      : { tints, color: feature.color, mark: toPoint(featureCenter(feature)!) };
    drawPicture(canvas.getContext('2d')!, base!, overlays);
  }, [base, shown, data, feature, ring, inside, lit, limitPixels, categoryColor]);

  const readPointer = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setPointer({ px: event.clientX - rect.left, py: event.clientY - rect.top });
  };

  const readout = (picture: LoadedPicture, { px, py }: FramePoint) => {
    const column = Math.min(PICTURE_WIDTH - 1, Math.max(0, Math.floor(px * FRAME.scale)));
    const row = Math.min(PICTURE_HEIGHT - 1, Math.max(0, Math.floor(py * FRAME.scale)));
    const index = row * PICTURE_WIDTH + column;
    const place = unproject(fromFrame(px, py, picture.view), picture.view.center);
    const value = picture.alpha[index] === 0
      ? 'No data'
      : [
        formatValue(valueOf(picture.gray[index], picture.range), readoutDecimals(picture.range, line.decimals)),
        line.unit,
      ].filter(Boolean).join(' ');
    return <><b>{value}</b> · {formatLatitude(place.lat, 3)}, {formatLongitude(place.lon, 3)}</>;
  };

  let info: React.ReactNode = <InfoRow />;
  if (data) {
    if (pointer) {
      info = <InfoRow>{readout(data, pointer)}</InfoRow>;
    } else if (highlight && lit) {
      info = <InfoRow swatch={categoryColor}>{highlight.text}</InfoRow>;
    } else if (limitPixels) {
      const share = Math.round(limitShare(limitPixels, data.alpha) * 100);
      info = <InfoRow swatch={LIMIT_COLOR}>{share}% at the limit, {viewSizeText(data.view)}</InfoRow>;
    } else if (isPoint) {
      info = <InfoRow>{viewSizeText(data.view)}</InfoRow>;
    } else {
      info = <InfoRow>Point at the picture to read a value</InfoRow>;
    }
  }

  let ramp: React.ReactNode = null;
  if (data) {
    if (terrain) {
      ramp = TERRAIN_TEXT;
    } else {
      const [low, high] = color === 'map' ? display!.rescale : data.range;
      ramp = (
        <>
          <span>{rangeEnd(low, line.decimals)}</span>
          <span className={styles.rampBar} style={{ background: tableGradient(colorTable, 'to right') }} />
          <span>
            {rangeEnd(high, line.decimals)}
            {line.unit && ` ${line.unit}`}
            {color === 'map' && ', as on the map'}
          </span>
        </>
      );
    }
  }

  const bar = shown ? scaleBar(shown.view) : null;

  return (
    <figure className={styles.viewer}>
      <div className={styles.frame}>
        {base && shown ? (
          <>
            <canvas
              ref={canvasRef}
              className={styles.canvas}
              width={PICTURE_WIDTH}
              height={PICTURE_HEIGHT}
              role="img"
              aria-label={`Map of ${fullLineName(line)} around ${feature.name}`}
              onPointerMove={readPointer}
              onPointerLeave={() => setPointer(null)}
            />
            <div className={styles.scale}>
              {bar!.label}
              <i style={{ width: `${bar!.widthPx}px` }} />
            </div>
            {!terrain && <ColorButton current={color} order={colorOrder} table={colorTable} onChange={changeColor} />}
          </>
        ) : (
          <PictureState used={terrain ? terrainPicture : dataPicture} />
        )}
        {data && (
          <TooltipTrigger delay={400}>
            <ToggleButton
              aria-label="Terrain"
              isSelected={terrain}
              onChange={setTerrain}
              className={`${styles.tool} ${styles.terrainTool}`}
            >
              <span className="material-symbols-outlined" aria-hidden="true">landscape</span>
            </ToggleButton>
            <ButtonTooltip placement="top">{terrain ? 'Show the values' : 'Show the terrain (LROC WAC)'}</ButtonTooltip>
          </TooltipTrigger>
        )}
      </div>
      <div className={styles.ramp}>{ramp}</div>
      {info}
    </figure>
  );
};
