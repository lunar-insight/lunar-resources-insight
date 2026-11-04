export type ShowOnMapAction = 'add' | 'show' | 'remove' | 'hide' | 'swap';

export interface ShowOnMapInput {
  /** In Layer Management. */
  selected: boolean;
  visible: boolean;
  /** Added by this button and not adjusted since. */
  fromInspector: boolean;
  /** Index of the variant on the map. An Inspector line reads variant 0. */
  activeVariant: number;
  /** Variant labels of the layer, empty without variants. */
  variantLabels: string[];
}

export interface ShowOnMapState {
  pressed: boolean;
  action: ShowOnMapAction;
  /** Text of the popover button. */
  label: string;
  tooltip: string;
}

const SHOW = 'Show on the map';
const ON_MAP = 'On the map';

/**
 * What a press does. It never destroys the user's work: a layer from the menus or
 * adjusted is hidden, since removing it drops its opacity, range, colors and variant.
 */
export function showOnMapState(input: ShowOnMapInput): ShowOnMapState {
  const { selected, visible, fromInspector, activeVariant, variantLabels } = input;

  if (!selected) return { pressed: false, action: 'add', label: SHOW, tooltip: SHOW };

  if (activeVariant !== 0) {
    const read = variantLabels[0];
    return {
      pressed: false,
      action: 'swap',
      label: `Show ${read} on the map`,
      tooltip: `The map shows the ${variantLabels[activeVariant]} variant. This value is read from ${read}.`,
    };
  }

  if (!visible) return { pressed: false, action: 'show', label: SHOW, tooltip: SHOW };

  return fromInspector
    ? { pressed: true, action: 'remove', label: ON_MAP, tooltip: 'Remove from the map' }
    : { pressed: true, action: 'hide', label: ON_MAP, tooltip: 'Hide it (stays in Layer Management)' };
}
