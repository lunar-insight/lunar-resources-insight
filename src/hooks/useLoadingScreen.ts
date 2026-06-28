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

    // Phase 1: continue from wherever the inline script left off, animate to 40%
    const stopInlinePhase1 = (window as any).__loadingPhase1Stop as (() => number) | undefined;
    const phase1StartPct = stopInlinePhase1 ? stopInlinePhase1() : 0;
    setLoadingLabel(phase1StartPct);
    const phase1Begin = performance.now();
    const phase1Duration = Math.max(500, ((40 - phase1StartPct) / 40) * 2000);
    let startBridge = () => {};
    let phase1Raf = 0;
    let phase1CurrentPct = phase1StartPct;
    const animatePhase1 = (now: number) => {
      const progress = Math.min(1, (now - phase1Begin) / phase1Duration);
      phase1CurrentPct = Math.min(40, phase1StartPct + (40 - phase1StartPct) * progress);
      setLoadingProgress(phase1CurrentPct);
      setLoadingLabel(phase1CurrentPct);
      if (phase1CurrentPct < 40) { phase1Raf = requestAnimationFrame(animatePhase1); } else { startBridge(); }
    };
    phase1Raf = requestAnimationFrame(animatePhase1);

    // Phase 2: 40 → 100% driven by Cesium tile load events
    // targetPct is the real computed value; displayPct lerps toward it each RAF frame
    // so the visual bar moves smoothly even when tile events arrive in a rapid burst.
    let maxTiles = 0;
    let loadingComplete = false;
    let phase2Started = false;
    let targetPct = 0;
    let displayPct = 0;
    let bridgeRaf = 0;
    startBridge = () => {
      displayPct = 40;
      targetPct = 40;
      const bridgeStart = performance.now();
      const tick = (now: number) => {
        if (phase2Started || loadingComplete) { bridgeRaf = 0; return; }
        const newPct = Math.min(44, 40 + (now - bridgeStart) * 0.002); // 2%/s, ceiling 44%
        targetPct = newPct;
        displayPct = newPct;
        setLoadingProgress(displayPct);
        bridgeRaf = requestAnimationFrame(tick);
      };
      bridgeRaf = requestAnimationFrame(tick);
    };

    const safetyTimeout = setTimeout(() => {
      loadingComplete = true;
      targetPct = 100;
      document.fonts.load('400 24px "Material Symbols Outlined"').then(() => enterApp());
    }, 30000);

    const removeTileListener = viewer.scene.globe.tileLoadProgressEvent.addEventListener(
      (remaining: number) => {
        if (loadingComplete) return;
        if (remaining > maxTiles) maxTiles = remaining;
        if (maxTiles === 0) return;
        const pct = Math.max(40, 40 + (1 - remaining / maxTiles) * 60);
        if (!phase2Started) { phase2Started = true; cancelAnimationFrame(phase1Raf); phase1Raf = 0; cancelAnimationFrame(bridgeRaf); bridgeRaf = 0; displayPct = Math.max(phase1CurrentPct, displayPct); }
        targetPct = Math.max(targetPct, pct);
        setLoadingLabel(pct);
        if (remaining === 0) {
          loadingComplete = true;
          targetPct = 100;
          removeTileListener();
          clearTimeout(safetyTimeout);
          document.fonts.load('400 24px "Material Symbols Outlined"').then(() => setTimeout(enterApp, 300));
        }
      }
    );

    // Lerp loop: drives displayPct toward targetPct at 30fps
    let lastFrameTime = 0;
    const canvasLoop = (now: number) => {
      canvasRaf = requestAnimationFrame(canvasLoop);
      if (now - lastFrameTime < 33) return;
      lastFrameTime = now;
      if (displayPct < targetPct) {
        displayPct = Math.min(targetPct, displayPct + Math.min(Math.max((targetPct - displayPct) * 0.08, 0.5), 1.5));
        setLoadingProgress(displayPct);
      }
    };
    canvasRaf = requestAnimationFrame(canvasLoop);

    return () => {
      cancelAnimationFrame(phase1Raf);
      cancelAnimationFrame(bridgeRaf);
      cancelAnimationFrame(canvasRaf);
      (window as any).__loadingCancelCanvas?.();
      removeTileListener();
      clearTimeout(safetyTimeout);
    };
  }, [viewer]);
};

export default useLoadingScreen;
