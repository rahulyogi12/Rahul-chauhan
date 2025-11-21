import React, { useEffect, useRef } from 'react';

interface VisualizerProps {
  audioContext: AudioContext | null;
  analyser: AnalyserNode | null;
  isActive: boolean;
}

const Visualizer: React.FC<VisualizerProps> = ({ audioContext, analyser, isActive }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const rotationRef = useRef(0);

  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Resize logic
    canvas.width = 400;
    canvas.height = 400;
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;

    const draw = () => {
      if (!ctx) return;
      
      // Clear
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      rotationRef.current += 0.005;

      // Get Data
      let dataArray = new Uint8Array(0);
      if (isActive && analyser) {
        const bufferLength = analyser.frequencyBinCount;
        dataArray = new Uint8Array(bufferLength);
        analyser.getByteFrequencyData(dataArray);
      }

      const baseColor = isActive ? '6, 182, 212' : '30, 41, 59'; // Cyan vs Slate
      const glowColor = isActive ? 'rgba(6, 182, 212, 0.5)' : 'rgba(30, 41, 59, 0.2)';

      // --- LAYER 1: Static Outer Ring Geometry ---
      ctx.beginPath();
      ctx.arc(centerX, centerY, 140, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${baseColor}, 0.2)`;
      ctx.lineWidth = 1;
      ctx.stroke();

      // Rotating Outer Dashed Ring
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(rotationRef.current);
      ctx.beginPath();
      ctx.arc(0, 0, 130, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${baseColor}, 0.5)`;
      ctx.lineWidth = 2;
      ctx.setLineDash([20, 30]);
      ctx.stroke();
      ctx.restore();

      // Counter-Rotating Inner Ring
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.rotate(-rotationRef.current * 1.5);
      ctx.beginPath();
      ctx.arc(0, 0, 110, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${baseColor}, 0.3)`;
      ctx.lineWidth = 4;
      ctx.setLineDash([5, 15]);
      ctx.stroke();
      ctx.restore();

      // --- LAYER 2: Frequency Reactor Core ---
      const bars = 30;
      const step = (Math.PI * 2) / bars;
      
      for (let i = 0; i < bars; i++) {
        // Calculate bar height based on frequency
        let value = 0;
        if (isActive && dataArray.length > 0) {
           // Average a few bins
           const binIdx = Math.floor((i / bars) * (dataArray.length / 2));
           value = dataArray[binIdx];
        }
        const intensity = value / 255;
        
        const rInner = 60;
        const rOuter = 60 + (intensity * 40) + 10; // Base length 10 + freq

        const angle = i * step;
        const x1 = centerX + Math.cos(angle) * rInner;
        const y1 = centerY + Math.sin(angle) * rInner;
        const x2 = centerX + Math.cos(angle) * rOuter;
        const y2 = centerY + Math.sin(angle) * rOuter;

        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x2, y2);
        ctx.strokeStyle = `rgba(${baseColor}, ${0.3 + intensity})`;
        ctx.lineWidth = 4;
        ctx.lineCap = 'butt';
        
        // Glow effect for loud sounds
        if (intensity > 0.5) {
           ctx.shadowBlur = 15;
           ctx.shadowColor = `rgba(${baseColor}, 1)`;
        } else {
           ctx.shadowBlur = 0;
        }
        
        ctx.stroke();
        ctx.shadowBlur = 0; // reset
      }

      // --- LAYER 3: Central Core ---
      // Inner Glow
      const pulse = isActive ? (Math.sin(Date.now() / 200) * 5) + 50 : 40;
      
      const gradient = ctx.createRadialGradient(centerX, centerY, 10, centerX, centerY, pulse);
      gradient.addColorStop(0, `rgba(${baseColor}, 0.8)`);
      gradient.addColorStop(0.5, `rgba(${baseColor}, 0.2)`);
      gradient.addColorStop(1, 'transparent');
      
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(centerX, centerY, pulse, 0, Math.PI * 2);
      ctx.fill();

      // Solid center triangle styling
      ctx.save();
      ctx.translate(centerX, centerY);
      ctx.beginPath();
      // Draw a triangle
      for (let i = 0; i < 3; i++) {
          ctx.rotate(Math.PI * 2 / 3);
          ctx.lineTo(0, -20);
      }
      ctx.closePath();
      ctx.strokeStyle = `rgba(${baseColor}, 0.8)`;
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();

      animationRef.current = requestAnimationFrame(draw);
    };

    draw();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [analyser, isActive]);

  return (
    <div className="relative flex items-center justify-center w-[300px] h-[300px] md:w-[400px] md:h-[400px]">
       {/* CSS overlay for extra detail that is hard to draw on canvas */}
       <div className="absolute inset-0 rounded-full border border-cyan-900/30 animate-pulse"></div>
      <canvas ref={canvasRef} className="z-10 w-full h-full" />
    </div>
  );
};

export default Visualizer;