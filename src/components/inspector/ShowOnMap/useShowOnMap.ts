import { layersConfig } from 'geoConfigExporter';
import { useInspectorContext } from 'utils/context/InspectorContext';
import { useLayerContext } from 'utils/context/LayerContext';
import type { LineFile } from 'services/inspector/inspectorLayers';
import { showOnMapState, type ShowOnMapState } from 'services/inspector/showOnMap';

/** The state and the press of a line's "Show on the map" buttons, computed from the layer list. */
export function useShowOnMap(file: LineFile): ShowOnMapState & { press: () => void } {
  const {
    selectedLayers, visibleLayers, activeVariants, isInspectorLayer,
    addLayer, removeLayer, toggleLayerVisibility, reorderLayers, swapLayerVariant,
  } = useLayerContext();
  const { pictureColor } = useInspectorContext();
  const { layerId } = file;
  const visible = visibleLayers.has(layerId);

  const state = showOnMapState({
    selected: selectedLayers.includes(layerId),
    visible,
    fromInspector: isInspectorLayer(layerId),
    activeVariant: activeVariants.get(layerId) ?? 0,
    variantLabels: (layersConfig.layers[layerId]?.variants ?? []).map(variant => variant.label),
  });

  const showOnTop = () => {
    toggleLayerVisibility(layerId);
    reorderLayers([layerId, ...selectedLayers.filter(id => id !== layerId)]);
  };

  const press = () => {
    switch (state.action) {
      case 'add':
        addLayer(layerId, undefined, { colormap: pictureColor, fromInspector: true });
        break;
      case 'show':
        showOnTop();
        break;
      case 'remove':
        removeLayer(layerId);
        break;
      case 'hide':
        toggleLayerVisibility(layerId);
        break;
      case 'swap':
        if (!visible) showOnTop();
        void swapLayerVariant(layerId, 0);
        break;
    }
  };

  return { ...state, press };
}
