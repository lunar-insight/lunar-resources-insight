import React, { useState, useEffect, useRef } from 'react';
import styles from './GeographicalLayersSection.module.scss';
import { Button, GridList, GridListItem } from 'react-aria-components';
import { useLayerContext } from '../../../utils/context/LayerContext';
import { layersConfig } from '../../../geoConfigExporter';
import { buildLayerPreviewUrl } from '../../../geoConfigExporter';
import { layerPreviewCache } from '../../../services/LayerPreviewCache';

interface GeographicalLayer {
  id: string;
  displayName: string;
  filename: string;
  previewUrl: string;
  metadata?: {
    source?: string;
    resolution?: string;
    [key: string]: any;
  };
}

interface LayerButtonProps {
  layer: GeographicalLayer;
  isSelected: boolean;
  onToggle: () => void;
}

const LayerButton: React.FC<LayerButtonProps> = ({ layer, isSelected, onToggle }) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [cachedImageUrl, setCachedImageUrl] = useState<string | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    // Intersection Observer for lazy loading
    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !imageLoaded) {
            loadImage();
          }
        });
      },
      {
        rootMargin: '50px', // Start loading 50px before entering viewport
        threshold: 0.01
      }
    );

    if (buttonRef.current) {
      observerRef.current.observe(buttonRef.current);
    }

    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
      }
      // Cleanup object URL
      if (cachedImageUrl) {
        URL.revokeObjectURL(cachedImageUrl);
      }
    };
  }, []);

  const loadImage = async () => {
    try {
      const url = await layerPreviewCache.fetchAndCache(layer.previewUrl);
      if (url) {
        setCachedImageUrl(url);
        setImageLoaded(true);
      }
    } catch (error) {
      console.error('Failed to load preview image:', error);
      // Fallback to direct URL
      setCachedImageUrl(layer.previewUrl);
      setImageLoaded(true);
    }
  };

  return (
    <Button
      ref={buttonRef}
      className={`${styles.layerButton} ${isSelected ? styles.selected : ''}`}
      onPress={onToggle}
      data-loaded={imageLoaded}
      style={{
        backgroundImage: cachedImageUrl ? `url(${cachedImageUrl})` : 'none'
      }}
    >
      <div className={styles.layerOverlay}>
        <div className={styles.layerInfo}>
          <h4 className={styles.layerTitle}>
            {layer.displayName}
          </h4>
          {layer.metadata && (
            <div className={styles.layerMetadata}>
              {layer.metadata.source && (
                <span className={styles.metadataItem}>
                  {layer.metadata.source}
                </span>
              )}
              {layer.metadata.resolution && (
                <span className={styles.metadataItem}>
                  {layer.metadata.resolution}
                </span>
              )}
            </div>
          )}
        </div>

        <div className={styles.layerCheckbox}>
          <input
            type="checkbox"
            checked={isSelected}
            readOnly
            aria-label={`Toggle ${layer.displayName}`}
          />
        </div>
      </div>
    </Button>
  );
};

const GeographicalLayersSection: React.FC = () => {
  const { addLayer, removeLayer, selectedLayers } = useLayerContext();

  // Get all geographical layers from config
  const geographicalLayers: GeographicalLayer[] = Object.entries(layersConfig.layers)
    .filter(([_, config]) => config.category === 'geographical')
    .map(([layerId, config]) => ({
      id: layerId,
      displayName: config.displayName || layerId,
      filename: config.filename,
      previewUrl: buildLayerPreviewUrl(config.filename, 256, 128), // Reduced size for performance
      metadata: config.metadata
    }));

  const handleLayerToggle = (layerId: string) => {
    const isSelected = selectedLayers.includes(layerId);

    if (isSelected) {
      removeLayer(layerId);
    } else {
      addLayer(layerId);
    }
  };

  const isLayerSelected = (layerId: string) => selectedLayers.includes(layerId);

  return (
    <div className={styles.section}>
      <div className={styles.info}>
        <p className={styles.description}>
          Select geographical layers to display.
        </p>
      </div>

      <div className={styles.layersListContainer}>
        {geographicalLayers.length === 0 ? (
          <div className={styles.empty}>
            No geographical layers available.
          </div>
        ) : (
          <GridList
            aria-label="Geographical Layers"
            className={styles.layersList}
            selectionMode="none"
          >
            {geographicalLayers.map((layer) => (
              <GridListItem
                key={layer.id}
                textValue={layer.displayName}
                className={styles.layerItem}
              >
                <LayerButton
                  layer={layer}
                  isSelected={isLayerSelected(layer.id)}
                  onToggle={() => handleLayerToggle(layer.id)}
                />
              </GridListItem>
            ))}
          </GridList>
        )}
      </div>
    </div>
  );
};

export default GeographicalLayersSection;
