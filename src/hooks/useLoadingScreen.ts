import { useEffect } from 'react';
import * as Cesium from 'cesium';

const useLoadingScreen = (viewer: Cesium.Viewer | null): void => {
  useEffect(() => {
    if (!viewer) return;

    const loadingBar     = document.getElementById('progress-bar') as HTMLElement | null;
    const loadingPct     = document.getElementById('loading-pct');
    const loadingStatus  = document.getElementById('loading-status');
    const loadingOverlay = document.getElementById('loading-overlay');
    const loadingStage   = document.getElementById('loading-stage');
    const loadingUi      = document.getElementById('loading-ui');
    const loadingFlash   = document.getElementById('loading-flash');

    const phases = [
      'Initializing',
      'Loading lunar data',
      'Rendering surface map',
      'Charting resources',
      'Finalizing',
    ];

    const setLoadingProgress = (pct: number) => {
      if (loadingBar) loadingBar.style.width = pct + '%';
      if (loadingPct) loadingPct.textContent = Math.round(pct) + '%';
    };

    const setLoadingLabel = (pct: number) => {
      if (!loadingStatus) return;
      if (pct >= 100) {
        loadingStatus.textContent = 'Entering explorer';
      } else {
        const idx = Math.min(phases.length - 1, Math.floor((pct / 100) * phases.length));
        loadingStatus.textContent = phases[idx];
      }
    };

    let canvasRaf = 0;
    const enterApp = () => {
      setLoadingProgress(100);
      setLoadingLabel(100);
      (window as any).__loadingSetFloodStart?.(performance.now());

      if (loadingStage) {
        loadingStage.style.transition = 'transform 1.5s cubic-bezier(.5,0,.18,1), opacity 1.5s ease';
        loadingStage.style.transform  = 'scale(1.18)';
        loadingStage.style.opacity    = '0';
      }
      if (loadingUi) {
        loadingUi.style.transition    = 'opacity .5s ease, transform .7s cubic-bezier(.62,0,.2,1)';
        loadingUi.style.opacity       = '0';
        loadingUi.style.transform     = 'scale(1.04)';
        loadingUi.style.pointerEvents = 'none';
      }
      if (loadingFlash) {
        loadingFlash.style.transition = 'opacity .3s ease';
        loadingFlash.style.opacity    = '0.85';
        setTimeout(() => {
          loadingFlash.style.transition = 'opacity .9s ease';
          loadingFlash.style.opacity    = '0';
        }, 220);
      }
      if (loadingOverlay) {
        loadingOverlay.style.transition = 'opacity 1.5s ease';
        requestAnimationFrame(() => { loadingOverlay.style.opacity = '0'; });
        loadingOverlay.addEventListener('transitionend', (e) => {
          if (e.target !== loadingOverlay) return;
          cancelAnimationFrame(canvasRaf);
          (window as any).__loadingCancelCanvas?.();
          loadingOverlay.remove();
        });
      }
    };

    // Stop the inline Phase 1 animation and pick up from its current position.
    const stopInlinePhase1 = (window as any).__loadingPhase1Stop as (() => number) | undefined;
    const startPct = stopInlinePhase1 ? stopInlinePhase1() : 0;
    setLoadingProgress(startPct);
    setLoadingLabel(startPct);

    const hookStart  = performance.now();
    let targetPct    = startPct;
    let displayPct   = startPct;
    let maxTiles     = 0;
    let loadingComplete = false;

    const safetyTimeout = setTimeout(() => {
      loadingComplete = true;
      targetPct = 100;
      document.fonts.load('400 24px "Material Symbols Outlined"').then(() => enterApp());
    }, 30000);

    // Tile events map 0 → 100% directly. The synthetic floor in the lerp loop
    // keeps the bar moving while waiting for the first tile event.
    const removeTileListener = viewer.scene.globe.tileLoadProgressEvent.addEventListener(
      (remaining: number) => {
        if (loadingComplete) return;
        if (remaining > maxTiles) maxTiles = remaining;
        if (maxTiles === 0) return;
        const tilePct = (1 - remaining / maxTiles) * 100;
        targetPct = Math.max(targetPct, tilePct);
        setLoadingLabel(targetPct);
        if (remaining === 0) {
          loadingComplete = true;
          targetPct = 100;
          removeTileListener();
          clearTimeout(safetyTimeout);
          document.fonts.load('400 24px "Material Symbols Outlined"').then(() => setTimeout(enterApp, 300));
        }
      }
    );

    // Lerp loop: runs at 30 fps.
    // Synthetic floor creeps at 1 %/s from startPct, capped at 80%, so the bar
    // always moves even before the first tile event. Tile progress takes over
    // naturally once it overtakes the floor.
    let lastFrameTime = 0;
    const canvasLoop = (now: number) => {
      canvasRaf = requestAnimationFrame(canvasLoop);
      if (now - lastFrameTime < 33) return;
      lastFrameTime = now;

      if (!loadingComplete) {
        const syntheticFloor = Math.min(80, startPct + (now - hookStart) * 0.001);
        targetPct = Math.max(targetPct, syntheticFloor);
      }
      if (displayPct < targetPct) {
        displayPct = Math.min(targetPct, displayPct + Math.min(Math.max((targetPct - displayPct) * 0.08, 0.5), 1.5));
        setLoadingProgress(displayPct);
      }
    };
    canvasRaf = requestAnimationFrame(canvasLoop);

    return () => {
      cancelAnimationFrame(canvasRaf);
      (window as any).__loadingCancelCanvas?.();
      removeTileListener();
      clearTimeout(safetyTimeout);
    };
  }, [viewer]);
};

export default useLoadingScreen;
