import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Button, Dialog, DialogTrigger, Popover, ToggleButton } from 'react-aria-components';
import styles from './ScannerButton.module.scss';
import { useScannerContext } from 'utils/context/ScannerContext';

interface RadarIconProps {
  active: boolean;
}

const RadarIcon: React.FC<RadarIconProps> = ({ active }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const activeRef = useRef(active);
  const pauseOffsetRef = useRef(0);
  const pausedAtRef = useRef(0);
  const wasPausedRef = useRef(!active);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    const svg = d3.select(svgRef.current);
    if (svg.empty()) return;

    [11, 7, 3.5].forEach((r) => {
      svg.append('circle').attr('cx', 0).attr('cy', 0).attr('r', r)
        .attr('fill', 'none')
        .attr('stroke', 'rgba(91,184,180,0.28)')
        .attr('stroke-width', 0.5);
    });
    svg.append('line').attr('x1', -11).attr('y1', 0).attr('x2', 11).attr('y2', 0)
      .attr('stroke', 'rgba(91,184,180,0.15)').attr('stroke-width', 0.5);
    svg.append('line').attr('x1', 0).attr('y1', -11).attr('x2', 0).attr('y2', 11)
      .attr('stroke', 'rgba(91,184,180,0.15)').attr('stroke-width', 0.5);

    const randomBlipAngle = () => Math.random() * 2 * Math.PI;
    const randomBlipDist = () => 3.5 + Math.random() * 7;

    let blipAngle = randomBlipAngle();
    const blipPhaseRef = { current: blipAngle / (2 * Math.PI) };

    const blip = svg.append('circle')
      .attr('cx', randomBlipDist() * Math.cos(blipAngle))
      .attr('cy', randomBlipDist() * Math.sin(blipAngle))
      .attr('r', 1.5)
      .attr('fill', '#96dbd8').attr('opacity', 0);

    const sweepG = svg.append('g');
    const sweepPath = sweepG.append('path').attr('fill', 'rgba(91,184,180,0.15)');
    sweepG.append('line')
      .attr('x1', 0).attr('y1', 0).attr('x2', 11).attr('y2', 0)
      .attr('stroke', '#5bb8b4').attr('stroke-width', 1.5).attr('opacity', 0.9);

    let prevDist = 1;

    const timer = d3.timer((elapsed) => {
      const isActive = activeRef.current;

      if (!isActive && !wasPausedRef.current) {
        wasPausedRef.current = true;
        pausedAtRef.current = elapsed;
      } else if (isActive && wasPausedRef.current) {
        pauseOffsetRef.current += elapsed - pausedAtRef.current;
        wasPausedRef.current = false;
      }

      if (!isActive) return;

      const effective = elapsed - pauseOffsetRef.current;
      const t = effective / 3500;
      const angle = (t % 1) * 360;
      const phase = t % 1;

      const wedgeRad = Math.PI / 3;
      const r = 11;
      const ax = r * Math.cos(-wedgeRad);
      const ay = r * Math.sin(-wedgeRad);
      sweepPath.attr('d', `M 0,0 L ${ax},${ay} A ${r},${r} 0 0,1 ${r},0 Z`);
      sweepG.attr('transform', `rotate(${angle})`);

      const dist = (phase - blipPhaseRef.current + 1) % 1;

      // Blip just faded out: relocate to a new random position for next rotation
      if (prevDist < 0.18 && dist >= 0.18) {
        blipAngle = randomBlipAngle();
        const d = randomBlipDist();
        blip.attr('cx', d * Math.cos(blipAngle)).attr('cy', d * Math.sin(blipAngle));
        blipPhaseRef.current = blipAngle / (2 * Math.PI);
      }
      prevDist = dist;

      const blipOpacity = dist < 0.18 ? (1 - dist / 0.18) * 0.95 : 0;
      blip.attr('opacity', blipOpacity);
    });

    return () => {
      timer.stop();
      svg.selectAll('*').remove();
    };
  }, []);

  return <svg ref={svgRef} className={styles.radarIcon} viewBox="-12 -12 24 24" />;
};

interface ScannerToggleRowProps {
  icon: string;
  label: string;
  isSelected: boolean;
  onChange: (val: boolean) => void;
}

const ScannerToggleRow: React.FC<ScannerToggleRowProps> = ({ icon, label, isSelected, onChange }) => (
  <ToggleButton
    isSelected={isSelected}
    onChange={onChange}
    className={styles.toggleRow}
    aria-label={label}
  >
    <span className={`material-symbols-outlined ${styles.rowIcon}`}>{icon}</span>
    <span className={styles.rowLabel}>{label}</span>
    {isSelected && (
      <span className={`material-symbols-outlined ${styles.checkmark}`}>check</span>
    )}
  </ToggleButton>
);

const ScannerButton: React.FC = () => {
  const {
    showElementScanner, toggleElementScanner,
    showCompoundScanner, toggleCompoundScanner,
    showDerivedIndexScanner, toggleDerivedIndexScanner,
    anyScannerOpen,
  } = useScannerContext();

  const [isHovered, setIsHovered] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  return (
    <DialogTrigger onOpenChange={setIsMenuOpen}>
      <Button
        aria-label="Scanner"
        className={styles.scannerButton}
        data-selected={anyScannerOpen || undefined}
        onHoverChange={setIsHovered}
      >
        <RadarIcon active={isHovered || isMenuOpen} />
        <span className={styles.label}>Scanner</span>
      </Button>
      <Popover className={styles.popover} placement="bottom start">
        <Dialog className={styles.dialog}>
          <ScannerToggleRow
            icon="scatter_plot"
            label="Chemical Elements"
            isSelected={showElementScanner}
            onChange={toggleElementScanner}
          />
          <ScannerToggleRow
            icon="join"
            label="Compound"
            isSelected={showCompoundScanner}
            onChange={toggleCompoundScanner}
          />
          <ScannerToggleRow
            icon="calculate"
            label="Derived Index"
            isSelected={showDerivedIndexScanner}
            onChange={toggleDerivedIndexScanner}
          />
        </Dialog>
      </Popover>
    </DialogTrigger>
  );
};

export default ScannerButton;
