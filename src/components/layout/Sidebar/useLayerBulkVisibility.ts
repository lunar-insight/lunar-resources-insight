import { useState } from 'react';

export function useLayerBulkVisibility(
  selectedLayers: string[],
  visibleLayers: Set<string>,
  setBulkLayerVisibility: (ids: Set<string>) => void,
) {
  const [snapshot, setSnapshot] = useState<Set<string> | null>(null);

  const showAll = () => {
    const allHidden = selectedLayers.length > 0 &&
      selectedLayers.every(id => !visibleLayers.has(id));

    if (allHidden && snapshot !== null) {
      const restored = new Set([...snapshot].filter(id => selectedLayers.includes(id)));
      setBulkLayerVisibility(restored);
      setSnapshot(null);
      return;
    }

    const anyHidden = selectedLayers.some(id => !visibleLayers.has(id));
    if (!anyHidden) return;

    setSnapshot(new Set(visibleLayers));
    setBulkLayerVisibility(new Set(selectedLayers));
  };

  const hideAll = () => {
    const allVisible = selectedLayers.length > 0 &&
      selectedLayers.every(id => visibleLayers.has(id));

    if (allVisible && snapshot !== null) {
      const restored = new Set([...snapshot].filter(id => selectedLayers.includes(id)));
      setBulkLayerVisibility(restored);
      setSnapshot(null);
      return;
    }

    const anyVisible = selectedLayers.some(id => visibleLayers.has(id));
    if (!anyVisible) return;

    setSnapshot(new Set(visibleLayers));
    setBulkLayerVisibility(new Set());
  };

  return { showAll, hideAll };
}
