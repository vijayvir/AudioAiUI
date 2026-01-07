import React, { useState, useEffect, useRef } from "react";

const Waveform = ({ analyser }) => {
  const [levels, setLevels] = useState(new Array(12).fill(0));
  const animationFrameRef = useRef();

  useEffect(() => {
    const updateWaveform = () => {
      if (!analyser) return;
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(dataArray);
      const barCount = 12;
      const step = Math.floor(dataArray.length / barCount);
      const newLevels = [];
      for (let i = 0; i < barCount; i++) {
        newLevels.push((dataArray[i * step] / 255) * 100);
      }
      setLevels(newLevels);
      animationFrameRef.current = requestAnimationFrame(updateWaveform);
    };
    updateWaveform();
    return () => cancelAnimationFrame(animationFrameRef.current);
  }, [analyser]);

  return (
    <div className="audio-waveform">
      {levels.map((level, i) => (
        <div key={i} className="waveform-bar" style={{ height: `${Math.max(20, level)}%` }}></div>
      ))}
    </div>
  );
};

export default React.memo(Waveform);