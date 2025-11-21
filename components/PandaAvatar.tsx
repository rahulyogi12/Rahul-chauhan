
import React, { useEffect, useRef } from 'react';

interface PandaAvatarProps {
  analyser: AnalyserNode | null;
  isSpeaking: boolean;
  isListening: boolean;
  isVisionActive: boolean;
  isAGIMode?: boolean;
}

const PandaAvatar: React.FC<PandaAvatarProps> = ({ analyser, isSpeaking, isListening, isVisionActive, isAGIMode = false }) => {
  // Refs for direct DOM manipulation (Critical for performance/smoothness)
  const mouthRef = useRef<SVGPathElement>(null);
  const leftPupilRef = useRef<SVGCircleElement>(null);
  const rightPupilRef = useRef<SVGCircleElement>(null);
  const headRef = useRef<SVGGElement>(null);
  const chestRef = useRef<SVGGElement>(null);
  const reactorRef = useRef<SVGCircleElement>(null);
  const leftEarRef = useRef<SVGGElement>(null);
  const rightEarRef = useRef<SVGGElement>(null);
  const eyelidsRef = useRef<SVGGElement>(null);
  
  // Mutable state for animation loop to avoid React renders and GC
  const mouseRef = useRef({ x: 0, y: 0 });
  const targetMouseRef = useRef({ x: 0, y: 0 });
  const blinkRef = useRef({ isBlinking: false, startTime: 0, duration: 200 });
  const earTwitchRef = useRef({ isTwitching: false, startTime: 0, side: 'left' as 'left'|'right' });
  const mouthStateRef = useRef({ current: 0 }); // For smoothing
  const dataArrayRef = useRef<Uint8Array | null>(null); // Reuse buffer
  const animationRef = useRef<number>();

  // Mouse tracking without re-renders
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // Normalize -1 to 1
      targetMouseRef.current.x = (e.clientX / window.innerWidth) * 2 - 1;
      targetMouseRef.current.y = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Main Animation Loop (60fps)
  useEffect(() => {
    // Initialize buffer once to avoid Garbage Collection during animation
    if (analyser && !dataArrayRef.current) {
        dataArrayRef.current = new Uint8Array(analyser.frequencyBinCount);
    }

    const animate = () => {
      const now = Date.now();
      const t = now / 1000; // Time in seconds for sine waves

      // 1. SMOOTH MOUSE LERPING
      // Friction factor: 0.15 (Higher = Snappier)
      mouseRef.current.x += (targetMouseRef.current.x - mouseRef.current.x) * 0.15;
      mouseRef.current.y += (targetMouseRef.current.y - mouseRef.current.y) * 0.15;

      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;

      // 2. IDLE ANIMATION & HEAD MOVEMENT
      // Add subtle continuous drift (figure-8 pattern) so it doesn't look dead when mouse stops
      const idleX = Math.sin(t * 0.8) * 3; 
      const idleY = Math.cos(t * 0.5) * 3;
      const idleRot = Math.sin(t * 0.4) * 1.5;

      const totalHeadX = (mx * 12) + idleX;
      const totalHeadY = (my * 12) + idleY;
      const totalRot = (mx * 6) + idleRot;

      if (headRef.current) {
        headRef.current.style.transform = `translate(${totalHeadX}px, ${totalHeadY}px) rotate(${totalRot}deg)`;
      }
      
      // Ears move opposite to head (drag/physics simulation) + specific tracking
      if (leftEarRef.current) leftEarRef.current.style.transform = `translate(${mx * -3}px, ${my * -3}px)`;
      if (rightEarRef.current) rightEarRef.current.style.transform = `translate(${mx * -3}px, ${my * -3}px)`;

      // 3. EYE TRACKING
      // Eyes track mouse sharply + slight idle wander
      const pupilIdleX = Math.sin(t * 0.3) * 1;
      const pupilX = (mx * 9) + pupilIdleX;
      const pupilY = (my * 9) + (isListening ? -6 : 0);
      
      if (leftPupilRef.current) leftPupilRef.current.style.transform = `translate(${pupilX}px, ${pupilY}px)`;
      if (rightPupilRef.current) rightPupilRef.current.style.transform = `translate(${pupilX}px, ${pupilY}px)`;

      // 4. LIP SYNC (Optimized & Smoothed)
      if (mouthRef.current) {
        let targetOpen = 0;
        
        if (isSpeaking && analyser && dataArrayRef.current) {
          analyser.getByteFrequencyData(dataArrayRef.current);
          
          let sum = 0;
          // Focus on vocal frequencies (approx range bins 2-20)
          const start = 2; 
          const end = 20; 
          for (let i = start; i < end; i++) sum += dataArrayRef.current[i];
          const avg = sum / (end - start);
          
          // Sensitivity adjustment
          targetOpen = Math.min(30, avg * 0.6); 
        }

        // Apply interpolation for smoothness (Spring/Damper effect)
        mouthStateRef.current.current += (targetOpen - mouthStateRef.current.current) * 0.3;
        
        // Idle breath when not speaking
        const idle = Math.sin(now / 800) * 1.5;
        const finalOpen = Math.max(0, isSpeaking ? mouthStateRef.current.current : idle);

        // Dynamic path morphing
        const curveY = 138 + finalOpen;
        // Widen slightly when mouth opens wide for realism
        const widthDelta = finalOpen * 0.15; 
        
        mouthRef.current.setAttribute('d', `M ${85 - widthDelta},138 Q 100,${curveY} ${115 + widthDelta},138`);
        // Change inside color when open
        mouthRef.current.setAttribute('fill', finalOpen > 4 ? '#6a1b1b' : '#333'); 
      }

      // 5. CHEST BREATHING (Scale + Vertical Translate)
      if (chestRef.current) {
        const breathScale = Math.sin(now / 1500) * 0.015 + 1; // Slower, deeper breath
        const breathY = Math.sin(now / 1500) * -1.5; // Chest rises slightly on inhale
        chestRef.current.style.transform = `translate(0px, ${breathY}px) scale(${breathScale})`;
      }

      // 6. BLINKING LOGIC (Natural randomness)
      if (eyelidsRef.current) {
        if (!blinkRef.current.isBlinking && Math.random() < 0.008) { // Random blink chance
           blinkRef.current.isBlinking = true;
           blinkRef.current.startTime = now;
           blinkRef.current.duration = 150 + Math.random() * 100; // Variable duration (150ms - 250ms)
        }

        if (blinkRef.current.isBlinking) {
           const progress = (now - blinkRef.current.startTime) / blinkRef.current.duration;
           if (progress >= 1) {
             blinkRef.current.isBlinking = false;
             eyelidsRef.current.style.opacity = '0';
             eyelidsRef.current.style.transform = 'scaleY(0)';
           } else {
             // Smooth sine curve for blink (0 -> 1 -> 0)
             const scale = Math.sin(progress * Math.PI); 
             eyelidsRef.current.style.opacity = '1';
             eyelidsRef.current.style.transform = `scaleY(${scale})`;
           }
        }
      }

      // 7. EAR TWITCHING (Random idle behavior)
      if (!earTwitchRef.current.isTwitching && Math.random() < 0.005) {
         earTwitchRef.current.isTwitching = true;
         earTwitchRef.current.startTime = now;
         earTwitchRef.current.side = Math.random() > 0.5 ? 'left' : 'right';
      }
      if (earTwitchRef.current.isTwitching) {
         const twitchDuration = 150;
         const progress = (now - earTwitchRef.current.startTime) / twitchDuration;
         if (progress >= 1) {
            earTwitchRef.current.isTwitching = false;
            if (leftEarRef.current) leftEarRef.current.style.transform = `translate(${mx * -3}px, ${my * -3}px)`;
            if (rightEarRef.current) rightEarRef.current.style.transform = `translate(${mx * -3}px, ${my * -3}px)`;
         } else {
             const twitchRot = Math.sin(progress * Math.PI * 2) * 15; // Quick wiggle
             const targetEar = earTwitchRef.current.side === 'left' ? leftEarRef.current : rightEarRef.current;
             if (targetEar) {
                // Combine with existing parallax translation
                targetEar.style.transform = `translate(${mx * -3}px, ${my * -3}px) rotate(${twitchRot}deg)`;
             }
         }
      }

      // 8. ARC REACTOR PULSE
      if (reactorRef.current) {
         const pulseSpeed = isSpeaking ? 100 : 1000; // Pulse fast when talking
         const pulse = (Math.sin(now / pulseSpeed) * 0.15) + 0.85;
         reactorRef.current.style.opacity = pulse.toString();
         
         let reactorColor = '#06b6d4';
         if (isAGIMode) reactorColor = '#f59e0b';
         if (isVisionActive) reactorColor = '#ef4444';
         
         reactorRef.current.setAttribute('fill', reactorColor);
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);
    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
    };
  }, [analyser, isSpeaking, isListening, isVisionActive, isAGIMode]);

  return (
    <div className="relative w-[320px] h-[380px] flex items-center justify-center select-none">
      
      {/* AGI Aura (Cosmic Effect) */}
      {isAGIMode && (
          <div className="absolute inset-0 bg-amber-500/20 blur-3xl rounded-full animate-[cosmic-pulse_3s_infinite_ease-in-out] z-0"></div>
      )}

      {/* Holographic Platform */}
      <div className={`absolute bottom-0 w-48 h-12 blur-xl rounded-[100%] animate-pulse ${isAGIMode ? 'bg-amber-500/40' : 'bg-cyan-500/20'}`}></div>

      <svg viewBox="0 0 200 240" className="w-full h-full drop-shadow-2xl overflow-visible relative z-10">
        
        {/* --- BODY LAYER --- */}
        <g ref={chestRef} transform-origin="100 180">
           {/* Main Body */}
           <path d="M 60,180 C 50,240 150,240 140,180 L 130,140 L 70,140 Z" fill="url(#bodyGradient)" />
           {/* White Belly */}
           <ellipse cx="100" cy="190" rx="30" ry="25" fill="#f8f9fa" opacity="0.9" />
           
           {/* Arms */}
           <ellipse cx="55" cy="160" rx="12" ry="20" fill="#1a1a1a" transform="rotate(20 55 160)" />
           <ellipse cx="145" cy="160" rx="12" ry="20" fill="#1a1a1a" transform="rotate(-20 145 160)" />

           {/* Legs */}
           <circle cx="70" cy="220" r="18" fill="#1a1a1a" />
           <circle cx="130" cy="220" r="18" fill="#1a1a1a" />
           {/* Paws */}
           <circle cx="70" cy="222" r="8" fill="#333" />
           <circle cx="130" cy="222" r="8" fill="#333" />

           {/* ARC REACTOR (Tony Stark Style) */}
           <circle cx="100" cy="170" r="12" fill="#111" stroke="#333" strokeWidth="2" />
           <circle ref={reactorRef} cx="100" cy="170" r="8" fill="#06b6d4" className={`filter ${isAGIMode ? 'drop-shadow-[0_0_10px_#f59e0b]' : 'drop-shadow-[0_0_5px_rgba(6,182,212,0.8)]'}`} />
           <path d="M 100,160 L 100,180 M 90,170 L 110,170" stroke="rgba(0,0,0,0.5)" strokeWidth="1" />
        </g>

        {/* --- HEAD LAYER --- */}
        <g ref={headRef} transform-origin="100 100">
            
            {/* EARS */}
            <g ref={leftEarRef} transform-origin="45 55"><circle cx="45" cy="55" r="22" fill="#1a1a1a" /></g>
            <g ref={rightEarRef} transform-origin="155 55"><circle cx="155" cy="55" r="22" fill="#1a1a1a" /></g>

            {/* FACE SHAPE */}
            <circle cx="100" cy="100" r="75" fill="url(#faceGradient)" stroke={isAGIMode ? 'rgba(245, 158, 11, 0.5)' : 'rgba(255,255,255,0.5)'} strokeWidth="2" />
            
            {/* EYE PATCHES */}
            <ellipse cx="65" cy="95" rx="22" ry="28" fill="#1a1a1a" transform="rotate(-15 65 95)" />
            <ellipse cx="135" cy="95" rx="22" ry="28" fill="#1a1a1a" transform="rotate(15 135 95)" />

            {/* EYES (With highlight) */}
            <circle cx="68" cy="92" r="8" fill={isAGIMode ? '#fbbf24' : 'white'} className={isAGIMode ? 'animate-[pulse_2s_infinite]' : ''} />
            <circle cx="132" cy="92" r="8" fill={isAGIMode ? '#fbbf24' : 'white'} className={isAGIMode ? 'animate-[pulse_2s_infinite]' : ''} />
            
            {/* PUPILS */}
            <circle ref={leftPupilRef} cx="68" cy="92" r="4" fill="#000" />
            <circle ref={rightPupilRef} cx="132" cy="92" r="4" fill="#000" />
            
            {/* Eye Reflections */}
            <circle cx="70" cy="90" r="2" fill="white" opacity="0.8" />
            <circle cx="134" cy="90" r="2" fill="white" opacity="0.8" />

            {/* BLINKING LIDS */}
            <g ref={eyelidsRef} style={{ transformOrigin: '95px center' }}>
               <ellipse cx="65" cy="95" rx="23" ry="29" fill="#1a1a1a" transform="rotate(-15 65 95)" />
               <ellipse cx="135" cy="95" rx="23" ry="29" fill="#1a1a1a" transform="rotate(15 135 95)" />
            </g>

            {/* NOSE */}
            <path d="M 92,115 Q 100,122 108,115 Q 100,108 92,115" fill="#222" />
            
            {/* MOUTH (Animated via ref) */}
            <path ref={mouthRef} d="M 85,138 Q 100,140 115,138" fill="transparent" stroke="#222" strokeWidth="3" strokeLinecap="round" />

            {/* CHEEKS */}
            <ellipse cx="50" cy="120" rx="8" ry="5" fill="#ff9999" opacity="0.4" filter="blur(4px)" />
            <ellipse cx="150" cy="120" rx="8" ry="5" fill="#ff9999" opacity="0.4" filter="blur(4px)" />
        
            {/* VISION GOGGLES (HUD) */}
            <g style={{ opacity: isVisionActive ? 1 : 0, transition: 'opacity 0.5s' }}>
               <path d="M 35,85 Q 100,65 165,85 L 165,105 Q 100,85 35,105 Z" fill="rgba(6, 182, 212, 0.2)" stroke="#06b6d4" strokeWidth="2" />
               <line x1="35" y1="95" x2="165" y2="95" stroke="rgba(6, 182, 212, 0.5)" strokeWidth="1" />
               <circle cx="160" cy="85" r="3" fill="red" className="animate-ping" />
               
               {/* HUD Data */}
               <rect x="40" y="88" width="10" height="2" fill="#06b6d4" className="animate-pulse" />
               <rect x="40" y="92" width="20" height="2" fill="#06b6d4" className="animate-pulse" style={{ animationDelay: '0.1s' }}/>
               <rect x="140" y="88" width="15" height="2" fill="#06b6d4" className="animate-pulse" style={{ animationDelay: '0.2s' }}/>
            </g>

        </g>

        {/* DEFS for Gradients */}
        <defs>
          <radialGradient id="faceGradient" cx="30%" cy="30%" r="70%">
            <stop offset="0%" stopColor="#ffffff" />
            <stop offset="100%" stopColor="#e2e8f0" />
          </radialGradient>
          <radialGradient id="bodyGradient" cx="50%" cy="0%" r="100%">
             <stop offset="0%" stopColor="#333" />
             <stop offset="100%" stopColor="#000" />
          </radialGradient>
        </defs>

      </svg>
    </div>
  );
};

export default PandaAvatar;
