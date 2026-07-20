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

    // The inline Phase 1 RAF is still running when the hook fires, its exponential
    // decay has no stop condition and naturally fills the gap between hook mount and
    // the first tile event. We leave it running and take over lazily: the first tile
    // event (or the safety timeout) calls takeOverFromPhase1(), which stops the
    // inline RAF, reads the bar's exact current position, and hands control to the
    // lerp loop below. Until then the lerp loop idles and the inline script owns
    // the bar.
    let phase1Handed = false;
    let startPct     = 0;
    let targetPct    = 0;
    let displayPct   = 0;

    const takeOverFromPhase1 = () => {
      if (phase1Handed) return;
      phase1Handed = true;
      const fn = (window as any).__loadingPhase1Stop as (() => number) | undefined;
      startPct   = fn ? fn() : 0;
      displayPct = startPct;
      targetPct  = startPct;
    };

    let maxTiles        = 0;
    let loadingComplete = false;

    const safetyTimeout = setTimeout(() => {
      takeOverFromPhase1();
      loadingComplete = true;
      targetPct = 100;
      document.fonts.load('400 24px "Material Symbols Outlined"').then(() => enterApp());
    }, 30000);

    const removeTileListener = viewer.scene.globe.tileLoadProgressEvent.addEventListener(
      (remaining: number) => {
        if (loadingComplete) return;
        if (remaining > maxTiles) maxTiles = remaining;

        // Warm-cache edge case: only event is remaining=0 before any non-zero event.
        if (maxTiles === 0 && remaining === 0) {
          takeOverFromPhase1();
          loadingComplete = true;
          targetPct = 100;
          removeTileListener();
          clearTimeout(safetyTimeout);
          document.fonts.load('400 24px "Material Symbols Outlined"').then(() => setTimeout(enterApp, 300));
          return;
        }
        if (maxTiles === 0) return;

        const tileProgress = 1 - remaining / maxTiles;

        // Delay the handoff until the first tile has actually completed
        // (remaining < maxTiles). While the queue is still filling, the inline
        // Phase 1 animation keeps the bar moving.
        if (!phase1Handed && tileProgress > 0) takeOverFromPhase1();
        if (!phase1Handed) return;

        const tilePct = startPct + tileProgress * (100 - startPct);
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

    // Lerp loop: idles until the inline Phase 1 has been handed off, then drives
    // displayPct toward targetPct at 30 fps.
    let lastFrameTime = 0;
    const canvasLoop = (now: number) => {
      canvasRaf = requestAnimationFrame(canvasLoop);
      if (!phase1Handed) return;
      if (now - lastFrameTime < 33) return;
      lastFrameTime = now;
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
