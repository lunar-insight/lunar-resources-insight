import React, { useEffect, useState } from 'react';
import { ToggleButton, Link } from 'react-aria-components';
import InfoButton from 'components/layout/Button/InfoButton/InfoButton';
import { useLayerContext } from 'utils/context/LayerContext';
import { layersConfig } from 'geoConfigExporter';
import styles from './VariantSelector.module.scss';

interface VariantStacInfo {
  units?: string;
  gridSizeDeg?: number;
  gridSizeKm?: number;
  qualityNoteShort?: string;
}

function formatResolution(info: VariantStacInfo): string {
  const deg = info.gridSizeDeg != null ? `${info.gridSizeDeg}°` : null;
  const km = info.gridSizeKm != null ? `~${info.gridSizeKm} km/px` : null;
  return [deg, km].filter(Boolean).join(' · ') || '—';
}

export const VariantSelector: React.FC<{ layerId: string }> = ({ layerId }) => {
  const { activeVariants, swappingLayers, swapLayerVariant } = useLayerContext();
  const variants = layersConfig.layers[layerId]?.variants;
  const activeIndex = activeVariants.get(layerId) ?? 0;
  const active = variants?.[activeIndex];
  const isSwapping = swappingLayers.has(layerId);
  const [stacInfo, setStacInfo] = useState<VariantStacInfo | null>(null);

  useEffect(() => {
    if (!active?.stac) return;
    setStacInfo(null);
    const controller = new AbortController();
    fetch(`/stac/${active.stac}`, { signal: controller.signal })
      .then(r => r.json())
      .then(data => {
        const p = data.properties ?? {};
        setStacInfo({
          units: p.units,
          gridSizeDeg: p.grid_size_deg,
          gridSizeKm: p.grid_size_km ?? p.spatial_resolution_km,
          qualityNoteShort: p['lri:quality_note_short'],
        });
      })
      .catch(err => { if (err.name !== 'AbortError') setStacInfo({}); });
    return () => controller.abort();
  }, [active?.stac]);

  if (!variants || variants.length === 0) return null;

  return (
    <div>
      <div className={styles.pillGroup}>
        {variants.map((v, i) => (
          <ToggleButton
            key={v.label}
            className={({ isSelected }) => `${styles.pill}${isSelected ? ` ${styles.active}` : ''}`}
            isSelected={i === activeIndex}
            isDisabled={isSwapping}
            onChange={() => { if (i !== activeIndex) swapLayerVariant(layerId, i); }}
            aria-label={v.label}
          >
            {v.label}
          </ToggleButton>
        ))}
      </div>

      <div className={styles.infoRow}>
        <div className={styles.infoItem}>
          <span className={styles.infoLabel}>Units</span>
          <span className={styles.infoValue}>{stacInfo?.units ?? '—'}</span>
        </div>
        <div className={styles.divider} />
        <div className={styles.infoItem}>
          <span className={styles.infoLabel}>Resolution</span>
          <span className={styles.infoValue}>{stacInfo ? formatResolution(stacInfo) : '—'}</span>
        </div>
        <div className={styles.spacer} />

        {stacInfo?.qualityNoteShort && (
          <InfoButton
            tooltipText='Quality note'
            popoverTitle='Quality note'
            popoverBody={stacInfo.qualityNoteShort}
          />
        )}

        {active?.stac && (
          <Link
            href={`/stac/${active.stac}`}
            target="_blank"
            rel="noreferrer"
            aria-label="View full STAC record"
            className={styles.stacLink}
          >
            <span className="material-symbols-outlined">open_in_new</span>
          </Link>
        )}
      </div>
    </div>
  )
}