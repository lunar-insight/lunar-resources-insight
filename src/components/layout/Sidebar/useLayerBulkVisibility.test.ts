import { renderHook, act } from '@testing-library/react';
import { useLayerBulkVisibility } from './useLayerBulkVisibility';

const LAYERS = ['iron', 'silicon', 'titanium'];

function setup(selectedLayers: string[], visibleLayers: Set<string>) {
  const setBulkLayerVisibility = vi.fn();
  const { result, rerender } = renderHook(
    ({ sel, vis }: { sel: string[]; vis: Set<string> }) =>
      useLayerBulkVisibility(sel, vis, setBulkLayerVisibility),
    { initialProps: { sel: selectedLayers, vis: visibleLayers } },
  );
  return { result, rerender, setBulkLayerVisibility };
}

// ── hideAll ───────────────────────────────────────────────────────────────────

describe('useLayerBulkVisibility — hideAll', () => {
  it('saves snapshot and hides all when layers are mixed', () => {
    const visible = new Set(['iron', 'titanium']); // silicon hidden
    const { result, setBulkLayerVisibility } = setup(LAYERS, visible);

    act(() => result.current.hideAll());

    expect(setBulkLayerVisibility).toHaveBeenCalledWith(new Set());
  });

  it('restores snapshot when all visible + snapshot exists (undo Show All)', () => {
    const allVisible = new Set(LAYERS);
    const { result, rerender, setBulkLayerVisibility } = setup(LAYERS, allVisible);

    // Show All from mixed first to plant a snapshot
    const mixed = new Set(['iron', 'titanium']);
    rerender({ sel: LAYERS, vis: mixed });
    act(() => result.current.showAll()); // snapshot = {iron, titanium}, now all visible
    setBulkLayerVisibility.mockClear();

    // Simulate the state after showAll: all layers now visible
    rerender({ sel: LAYERS, vis: allVisible });
    act(() => result.current.hideAll()); // should restore {iron, titanium}

    expect(setBulkLayerVisibility).toHaveBeenCalledWith(new Set(['iron', 'titanium']));
  });

  it('no-op when nothing is visible and no snapshot', () => {
    const { result, setBulkLayerVisibility } = setup(LAYERS, new Set());

    act(() => result.current.hideAll());

    expect(setBulkLayerVisibility).not.toHaveBeenCalled();
  });
});

// ── showAll ───────────────────────────────────────────────────────────────────

describe('useLayerBulkVisibility — showAll', () => {
  it('saves snapshot and shows all when layers are mixed', () => {
    const visible = new Set(['iron', 'titanium']); // silicon hidden
    const { result, setBulkLayerVisibility } = setup(LAYERS, visible);

    act(() => result.current.showAll());

    expect(setBulkLayerVisibility).toHaveBeenCalledWith(new Set(LAYERS));
  });

  it('restores snapshot when all hidden + snapshot exists (undo Hide All)', () => {
    const mixed = new Set(['iron', 'titanium']);
    const { result, rerender, setBulkLayerVisibility } = setup(LAYERS, mixed);

    // Hide All from mixed to plant a snapshot
    act(() => result.current.hideAll()); // snapshot = {iron, titanium}, now all hidden
    setBulkLayerVisibility.mockClear();

    // Simulate the state after hideAll: nothing visible
    rerender({ sel: LAYERS, vis: new Set() });
    act(() => result.current.showAll()); // should restore {iron, titanium}

    expect(setBulkLayerVisibility).toHaveBeenCalledWith(new Set(['iron', 'titanium']));
  });

  it('no-op when all layers are already visible and no snapshot', () => {
    const { result, setBulkLayerVisibility } = setup(LAYERS, new Set(LAYERS));

    act(() => result.current.showAll());

    expect(setBulkLayerVisibility).not.toHaveBeenCalled();
  });
});

// ── snapshot restore ──────────────────────────────────────────────────────────

describe('useLayerBulkVisibility — snapshot restore', () => {
  it('filters stale IDs from snapshot when a layer was removed before restore', () => {
    const mixed = new Set(['iron', 'titanium']);
    const { result, rerender, setBulkLayerVisibility } = setup(LAYERS, mixed);

    // Hide All plants snapshot {iron, titanium}
    act(() => result.current.hideAll());
    setBulkLayerVisibility.mockClear();

    // User removes 'titanium' from selected layers
    const remainingLayers = ['iron', 'silicon'];
    rerender({ sel: remainingLayers, vis: new Set() });
    act(() => result.current.showAll()); // restore should only include 'iron'

    expect(setBulkLayerVisibility).toHaveBeenCalledWith(new Set(['iron']));
  });
});
