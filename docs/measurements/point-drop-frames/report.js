// Run in the app page after record.js or sweep.js has recorded. Gives the
// number of frames, the first frame, every gap between frames over 40 ms as
// start+length, and every Cesium render over 30 ms as start+length, in
// milliseconds from the start of the recording.
(() => {
  const frames = window.__frames;
  const gaps = [];
  for (let i = 1; i < frames.length; i++) {
    const gap = frames[i] - frames[i - 1];
    if (gap > 40) gaps.push(`${frames[i - 1]}+${gap}`);
  }
  const renders = window.__slowRenders.map(([at, length]) => `${at}+${length}`);
  return `frames ${frames.length} | first frame ${frames[0]} | gaps ${gaps.join(' ') || 'none'} | slow renders ${renders.join(' ') || 'none'}`;
})()
