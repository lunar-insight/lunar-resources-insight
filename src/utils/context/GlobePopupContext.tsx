import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import * as Cesium from 'cesium';
import { pointValueService } from 'services/PointValueService';

/** The globe menu, opened by a right click on the ground. */
export interface GlobeMenuPopup {
  kind: 'menu';
  /** Canvas pixels of the click. */
  screen: { x: number; y: number };
  position: Cesium.Cartesian3;
  lon: number;
  lat: number;
  holdToken: number;
}

/** A saved feature's box. */
export interface FeatureBoxPopup {
  kind: 'feature';
  featureId: string;
}

export type GlobePopup = GlobeMenuPopup | FeatureBoxPopup;

interface GlobePopupContextValue {
  popup: GlobePopup | null;
  openMenu: (screen: { x: number; y: number }, position: Cesium.Cartesian3) => void;
  openFeatureBox: (featureId: string) => void;
  closePopup: () => void;
  /** Closes the menu and hands over its scanner hold, for a caller that releases it later. */
  closeMenuKeepingHold: () => number | null;
}

const GlobePopupContext = createContext<GlobePopupContextValue | undefined>(undefined);

/** Marks an element as part of a popup, so a press on it does not close the popup. */
export const GLOBE_POPUP_ATTRIBUTE = 'data-globe-popup';
/** Marks a point marker, so a press on the marker of the open box is left to the marker. */
export const FEATURE_MARKER_ATTRIBUTE = 'data-feature-marker';

const isInsidePopup = (target: EventTarget | null, popup: GlobePopup): boolean => {
  if (!(target instanceof Element)) return false;
  if (target.closest(`[${GLOBE_POPUP_ATTRIBUTE}]`)) return true;
  return popup.kind === 'feature' && target.closest(`[${FEATURE_MARKER_ATTRIBUTE}="${popup.featureId}"]`) !== null;
};

/**
 * One popup over the globe at a time: the globe menu or one feature's box.
 * Opening one closes the other. Escape and a press anywhere outside close it.
 * While the menu is open, the scanner holds on the clicked spot.
 */
export const GlobePopupProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [popup, setPopup] = useState<GlobePopup | null>(null);
  const popupRef = useRef<GlobePopup | null>(null);

  const replacePopup = useCallback((next: GlobePopup | null, releaseHold: boolean = true) => {
    const current = popupRef.current;
    if (releaseHold && current?.kind === 'menu') pointValueService.releaseHold(current.holdToken);
    popupRef.current = next;
    setPopup(next);
  }, []);

  const openMenu = useCallback((screen: { x: number; y: number }, position: Cesium.Cartesian3) => {
    const cartographic = Cesium.Cartographic.fromCartesian(position, Cesium.Ellipsoid.MOON);
    // The previous menu's hold is released before the new one starts.
    replacePopup(null);
    const holdToken = pointValueService.holdAt(position);
    replacePopup({
      kind: 'menu',
      screen,
      position,
      lon: Cesium.Math.toDegrees(cartographic.longitude),
      lat: Cesium.Math.toDegrees(cartographic.latitude),
      holdToken,
    });
  }, [replacePopup]);

  const openFeatureBox = useCallback((featureId: string) => {
    replacePopup({ kind: 'feature', featureId });
  }, [replacePopup]);

  const closePopup = useCallback(() => replacePopup(null), [replacePopup]);

  const closeMenuKeepingHold = useCallback((): number | null => {
    const current = popupRef.current;
    if (current?.kind !== 'menu') return null;
    replacePopup(null, false);
    return current.holdToken;
  }, [replacePopup]);

  useEffect(() => {
    if (!popup) return;

    // Capture phase, so the popup closes before the press reaches the globe,
    // whose right click may open the next menu.
    const onPointerDown = (event: PointerEvent) => {
      if (!isInsidePopup(event.target, popup)) closePopup();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closePopup();
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    document.addEventListener('keydown', onKeyDown, true);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      document.removeEventListener('keydown', onKeyDown, true);
    };
  }, [popup, closePopup]);

  const value = useMemo(
    () => ({ popup, openMenu, openFeatureBox, closePopup, closeMenuKeepingHold }),
    [popup, openMenu, openFeatureBox, closePopup, closeMenuKeepingHold]
  );

  return <GlobePopupContext.Provider value={value}>{children}</GlobePopupContext.Provider>;
};

export const useGlobePopup = (): GlobePopupContextValue => {
  const context = useContext(GlobePopupContext);
  if (!context) {
    throw new Error('useGlobePopup must be used within a GlobePopupProvider');
  }
  return context;
};
