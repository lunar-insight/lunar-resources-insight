import { useEffect, useState } from 'react';
import { layersConfig } from 'geoConfigExporter';

export interface NomenclatureFeatureLite {
  name: string;
  lon: number;
  lat: number;
  diameter: number;
}

let cachedFeatures: NomenclatureFeatureLite[] | null = null;
let pendingFetch: Promise<NomenclatureFeatureLite[]> | null = null;

const fetchFeatures = (): Promise<NomenclatureFeatureLite[]> => {
  if (cachedFeatures) return Promise.resolve(cachedFeatures);
  if (pendingFetch) return pendingFetch;

  const compactUrl = `/${layersConfig.layers.iau_nomenclature.filename}`;

  pendingFetch = fetch(compactUrl)
    .then((res) => res.json())
    .then((rows: [string, number, number, number][]) => {
      const features = rows.map(([name, lon, lat, diameter]) => ({ name, lon, lat, diameter }));
      cachedFeatures = features;
      return features;
    })
    .finally(() => {
      pendingFetch = null;
    });

  return pendingFetch;
};

/**
 * Shared IAU nomenclature feature list (name/lon/lat/diameter), fetched once
 * and cached across all consumers (e.g. label rendering, feature search).
 */
export const useNomenclatureFeatures = (): { features: NomenclatureFeatureLite[]; isLoading: boolean } => {
  const [features, setFeatures] = useState<NomenclatureFeatureLite[]>(cachedFeatures ?? []);
  const [isLoading, setIsLoading] = useState(!cachedFeatures);

  useEffect(() => {
    if (cachedFeatures) {
      setFeatures(cachedFeatures);
      setIsLoading(false);
      return;
    }

    let cancelled = false;
    setIsLoading(true);

    fetchFeatures()
      .then((result) => {
        if (!cancelled) {
          setFeatures(result);
          setIsLoading(false);
        }
      })
      .catch((err) => {
        console.error('Failed to load nomenclature features:', err);
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { features, isLoading };
};
