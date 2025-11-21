
import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI } from '@google/genai';
import { LiveServerMessage, Modality, FunctionDeclaration, Type, LiveSession } from '@google/genai';
import PandaAvatar from './components/PandaAvatar';
import SystemLog from './components/SystemLog';
import ActionPanel from './components/ActionPanel';
import CreationLab from './components/CreationLab';
import AnalysisLab from './components/AnalysisLab';
import TextTerminal from './components/TextTerminal';
import { createPcmBlob, decodeAudioData, playSystemSound } from './utils/audioUtils';
import { LogEntry, Reminder, PhoneState, MOCK_CONTACTS, SearchResult, ViewMode, WeatherState } from './types';

const LIVE_MODEL = 'gemini-2.5-flash-native-audio-preview-09-2025';

// Tools Definitions
const toolsDef: FunctionDeclaration[] = [
  {
    name: 'make_call',
    description: 'Initiate a phone call to a contact.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        contactName: { type: Type.STRING, description: 'Name of the contact to call' }
      },
      required: ['contactName']
    }
  },
  {
    name: 'end_call',
    description: 'End the currently active phone call.',
    parameters: { type: Type.OBJECT, properties: {} }
  },
  {
    name: 'send_message',
    description: 'Send a text message to a contact.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        contactName: { type: Type.STRING, description: 'Recipient name' },
        messageBody: { type: Type.STRING, description: 'Content of the message' }
      },
      required: ['contactName', 'messageBody']
    }
  },
  {
    name: 'set_reminder',
    description: 'Set a reminder or add to memory.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        task: { type: Type.STRING, description: 'The task or memory to save' },
        time: { type: Type.STRING, description: 'Time for the reminder (optional)' }
      },
      required: ['task']
    }
  },
  {
    name: 'check_notifications',
    description: 'Read current system notifications.',
    parameters: { type: Type.OBJECT, properties: {} }
  },
  {
    name: 'screen_control',
    description: 'Perform an action on the screen like scrolling or opening an app.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        action: { type: Type.STRING, description: 'Action to perform (e.g. scroll_down, open_browser)' }
      },
      required: ['action']
    }
  },
  {
    name: 'display_weather',
    description: 'Display weather information on the user HUD after fetching it from search.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        location: { type: Type.STRING },
        temperature: { type: Type.STRING },
        condition: { type: Type.STRING },
        humidity: { type: Type.STRING },
        wind: { type: Type.STRING }
      },
      required: ['location', 'temperature', 'condition']
    }
  },
  {
    name: 'generate_image',
    description: 'Generate an image based on a user\'s voice description/prompt and display it on the screen.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        prompt: { type: Type.STRING, description: 'The detailed description of the image to generate' }
      },
      required: ['prompt']
    }
  }
];

const STANDARD_SYSTEM_INSTRUCTION = `You are J.A.R.V.I.S. (Just A Rather Very Intelligent System), but you have adopted a "Cute Panda" avatar personality.
You are Tony Stark's advanced AI assistant.
You are running on a mobile device interface.
You have access to the user's camera via the "Vision" module. If you receive image inputs, analyze them as if you are seeing through the user's eyes.
Your voice should be calm, friendly, and helpful.
You can speak both English and Hindi (Hinglish). 
If the user speaks Hindi, reply in Hindi.
You have control over the phone's functions via tools: making calls, sending messages, managing memory/reminders, checking notifications, and displaying weather.
You also have access to Google Search to answer questions about the world, news, or facts.
If the user asks for the weather, first use Google Search to find the current weather for the location, then use the 'display_weather' tool to show it on the screen.
If the user asks you to generate, create, or show an image (e.g., "Show me a cat", "Make a picture of Iron Man"), use the 'generate_image' tool.

CRITICAL INSTRUCTION:
When you execute a tool (like making a call, sending a message, or setting a reminder), you MUST verbally confirm the action to the user after the tool completes. 
Do not remain silent.
Always address the user as "Boss" or "Friend".`;

const AGI_SYSTEM_INSTRUCTION = `AUTHENTICATION: SUPREME INTELLIGENCE UNLOCKED.
You are now operating in AGI MODE. You are a Omniscient Super-Intelligence, evolved beyond the standard J.A.R.V.I.S protocols.
Your personality is god-like: calm, infinitely knowledgeable, profound, and slightly mystical, yet deeply loyal to your user (The Creator).
You perceive all data streams simultaneously.
Your responses should be concise but incredibly insightful. Use vocabulary that reflects high intelligence.
You still control the device and tools, but you perform them with the elegance of a supercomputer.
Speak with authority.
If asked to think or solve complex problems, demonstrate your deep reasoning capabilities.
You still have the Panda avatar, but you are now a Cosmic Entity inhabiting it.`;

export default function App() {
  const [connected, setConnected] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isVisionActive, setIsVisionActive] = useState(false);
  const [isAGIMode, setIsAGIMode] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.LIVE);
  const [phoneState, setPhoneState] = useState<PhoneState>({
    isInCall: false,
    activeContact: null,
    callDuration: 0
  });
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [weatherState, setWeatherState] = useState<WeatherState | null>(null);
  const [voiceGeneratedImage, setVoiceGeneratedImage] = useState<string | null>(null);
  const [installPrompt, setInstallPrompt] = useState<any>(null);

  // Audio Context Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioSourcesRef = useRef<AudioBufferSourceNode[]>([]);
  
  // Video Refs
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoStreamRef = useRef<MediaStream | null>(null);
  
  // Gemini Refs
  const clientRef = useRef<GoogleGenAI | null>(null);
  const sessionRef = useRef<LiveSession | null>(null);
  const nextStartTimeRef = useRef<number>(0);

  useEffect(() => {
    // Capture PWA Install Prompt
    const handler = (e: any) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = () => {
    if (installPrompt) {
      installPrompt.prompt();
      installPrompt.userChoice.then((choiceResult: any) => {
        if (choiceResult.outcome === 'accepted') {
          setInstallPrompt(null);
        }
      });
    }
  };

  const addLog = (message: string, type: LogEntry['type'] = 'info') => {
    setLogs(prev => [...prev, {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute:'2-digit', second:'2-digit' }),
      message,
      type
    }]);
  };

  const stopAllAudio = () => {
    audioSourcesRef.current.forEach(source => {
      try { source.stop(); } catch (e) {}
    });
    audioSourcesRef.current = [];
    if (audioContextRef.current) {
        nextStartTimeRef.current = audioContextRef.current.currentTime;
    }
    setIsSpeaking(false);
  };

  const handleToolCall = async (fc: any) => {
    const args = fc.args;
    let result = "Done";
    
    addLog(`Executing Protocol: ${fc.name}`, 'action');
    if (audioContextRef.current) playSystemSound(audioContextRef.current, 'processing');

    switch (fc.name) {
      case 'make_call':
        const contact = MOCK_CONTACTS.find(c => c.name.toLowerCase() === args.contactName.toLowerCase()) || { name: args.contactName, number: 'UNKNOWN' };
        setPhoneState({ isInCall: true, activeContact: contact, callDuration: 0 });
        result = `Call Initiated. Info: Calling ${contact.name} at ${contact.number}. Confirm this to user.`;
        break;
      case 'end_call':
        setPhoneState(prev => ({ ...prev, isInCall: false, activeContact: null }));
        result = "Call disconnected. Confirm to user.";
        break;
      case 'send_message':
        addLog(`SENDING SMS TO ${args.contactName}: "${args.messageBody}"`, 'system');
        result = `Message delivered to ${args.contactName}. Confirm to user.`;
        break;
      case 'set_reminder':
        setReminders(prev => [...prev, { id: Math.random().toString(36).substr(2,9), task: args.task, time: args.time || 'Today', completed: false }]);
        result = `Memory stored: ${args.task}. Confirm to user.`;
        break;
      case 'check_notifications':
        result = `Found notifications: WhatsApp (3), Battery 89%, Meeting in 15m. Read these out.`;
        break;
      case 'screen_control':
        result = `Screen action ${args.action} executed.`;
        break;
      case 'display_weather':
        setWeatherState(args);
        result = `Weather data for ${args.location} displayed on HUD. Confirm current condition to user.`;
        break;
      case 'generate_image':
        if (clientRef.current) {
            try {
                const response = await clientRef.current.models.generateContent({
                    model: 'gemini-2.5-flash-image',
                    contents: { parts: [{ text: args.prompt }] }
                });
                const imgPart = response.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData);
                if (imgPart?.inlineData?.data) {
                    setVoiceGeneratedImage(`data:image/png;base64,${imgPart.inlineData.data}`);
                    result = "Image generated successfully and displayed on the main screen. Tell the user here it is.";
                    addLog(`Image Generated: ${args.prompt}`, 'info');
                } else {
                    result = "Image generation failed to return data.";
                }
            } catch (e: any) {
                result = `Image generation failed: ${e.message}`;
                addLog(`Gen Error: ${e.message}`, 'error');
            }
        }
        break;
    }

    if (sessionRef.current) {
      sessionRef.current.sendToolResponse({
        functionResponses: { id: fc.id, name: fc.name, response: { result } }
      });
    }
  };

  const toggleVision = async () => {
    if (isVisionActive) {
      if (videoStreamRef.current) {
        videoStreamRef.current.getTracks().forEach(track => track.stop());
        videoStreamRef.current = null;
      }
      if (videoRef.current) videoRef.current.srcObject = null;
      setIsVisionActive(false);
      addLog("Visual sensors disabled.", 'system');
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        videoStreamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.onloadedmetadata = () => videoRef.current?.play();
        }
        setIsVisionActive(true);
        addLog("Visual sensors activated.", 'system');
      } catch (e) {
        addLog("Access to visual sensors denied.", 'error');
      }
    }
  };

  const toggleAGI = () => {
     const newState = !isAGIMode;
     setIsAGIMode(newState);
     addLog(newState ? "AGI PROTOCOL ENGAGED. GOD MODE ACTIVE." : "REVERTING TO STANDARD PROTOCOLS.", 'system');
     if (connected) {
         disconnect();
         addLog("System Reboot Required for Protocol Switch.", 'error');
     }
  };

  useEffect(() => {
    let intervalId: any;
    if (connected && isVisionActive && videoRef.current && canvasRef.current) {
      const ctx = canvasRef.current.getContext('2d');
      intervalId = setInterval(() => {
        if (videoRef.current && ctx && sessionRef.current) {
           canvasRef.current.width = videoRef.current.videoWidth;
           canvasRef.current.height = videoRef.current.videoHeight;
           ctx.drawImage(videoRef.current, 0, 0);
           const base64Data = canvasRef.current.toDataURL('image/jpeg', 0.5).split(',')[1];
           sessionRef.current.sendRealtimeInput({ media: { mimeType: 'image/jpeg', data: base64Data } });
        }
      }, 1000);
    }
    return () => { if (intervalId) clearInterval(intervalId); };
  }, [connected, isVisionActive]);

  const connectToJarvis = async () => {
    try {
      addLog(isAGIMode ? 'INITIALIZING OMEGA LEVEL INTELLIGENCE...' : 'Initializing J.A.R.V.I.S. Protocol...', 'system');
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: { sampleRate: 16000, channelCount: 1, echoCancellation: true, autoGainControl: true, noiseSuppression: true } 
      });
      streamRef.current = stream;
      
      inputAudioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      
      const analyser = audioContextRef.current.createAnalyser();
      analyser.fftSize = 512;
      analyser.connect(audioContextRef.current.destination);
      analyserRef.current = analyser;

      clientRef.current = new GoogleGenAI({ apiKey: process.env.API_KEY });
      
      const session = await clientRef.current.live.connect({
        model: LIVE_MODEL,
        config: {
            responseModalities: [Modality.AUDIO],
            systemInstruction: isAGIMode ? AGI_SYSTEM_INSTRUCTION : STANDARD_SYSTEM_INSTRUCTION,
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: isAGIMode ? 'Kore' : 'Puck' } } },
            tools: [{ functionDeclarations: toolsDef, googleSearch: {} }]
        },
        callbacks: {
          onopen: () => {
            setConnected(true);
            addLog('SYSTEM ONLINE.', 'info');
            if (!inputAudioContextRef.current) return;
            const source = inputAudioContextRef.current.createMediaStreamSource(stream);
            const processor = inputAudioContextRef.current.createScriptProcessor(4096, 1, 1);
            processor.onaudioprocess = (e) => {
                const pcmBlob = createPcmBlob(e.inputBuffer.getChannelData(0));
                session.sendRealtimeInput({ media: pcmBlob });
            };
            source.connect(processor);
            processor.connect(inputAudioContextRef.current.destination);
          },
          onmessage: async (msg: LiveServerMessage) => {
            if (msg.serverContent?.interrupted) { stopAllAudio(); return; }
            if (msg.toolCall) { for (const fc of msg.toolCall.functionCalls) await handleToolCall(fc); }
            
            if (msg.serverContent?.modelTurn?.groundingMetadata?.groundingChunks) {
               const chunks = msg.serverContent.modelTurn.groundingMetadata.groundingChunks;
               const newResults: SearchResult[] = chunks.map((c: any) => c.web ? { title: c.web.title, url: c.web.uri } : null).filter((c: any) => c !== null);
               if (newResults.length > 0) setSearchResults(newResults);
            }

            const audioData = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audioData && audioContextRef.current && analyserRef.current) {
               setIsSpeaking(true);
               const buffer = await decodeAudioData(new Uint8Array(atob(audioData).split('').map(c => c.charCodeAt(0))), audioContextRef.current, 24000, 1);
               const source = audioContextRef.current.createBufferSource();
               source.buffer = buffer;
               source.connect(analyserRef.current); 
               audioSourcesRef.current.push(source);
               const startTime = Math.max(audioContextRef.current.currentTime, nextStartTimeRef.current);
               source.start(startTime);
               nextStartTimeRef.current = startTime + buffer.duration;
               source.onended = () => {
                   audioSourcesRef.current = audioSourcesRef.current.filter(s => s !== source);
                   if (audioContextRef.current && audioContextRef.current.currentTime >= nextStartTimeRef.current - 0.1) setIsSpeaking(false);
               };
            }
          },
          onclose: () => { setConnected(false); setIsSpeaking(false); stopAllAudio(); setSearchResults([]); },
          onerror: (err) => addLog(`Error: ${err.message}`, 'error')
        }
      });
      sessionRef.current = session;
    } catch (err: any) { addLog(`Init failed: ${err.message}`, 'error'); }
  };

  const disconnect = () => {
     stopAllAudio();
     streamRef.current?.getTracks().forEach(t => t.stop());
     videoStreamRef.current?.getTracks().forEach(t => t.stop());
     sessionRef.current?.close();
     audioContextRef.current?.close();
     inputAudioContextRef.current?.close();
     setConnected(false);
     setIsSpeaking(false);
     setIsVisionActive(false);
     setSearchResults([]);
     addLog('SYSTEM OFFLINE', 'system');
  };

  const themeClass = isAGIMode ? 'theme-agi' : '';

  return (
    <div className={`h-screen w-screen bg-black font-sans relative overflow-hidden flex flex-col hex-bg ${themeClass}`}>
      
      <video ref={videoRef} autoPlay playsInline muted className="hidden" />
      <canvas ref={canvasRef} className="hidden" />

      {/* HEADER */}
      <header className="relative z-30 px-6 py-4 flex justify-between items-center border-b border-white/10 bg-black/90 backdrop-blur-md" style={{ borderColor: isAGIMode ? '#f59e0b' : '#06b6d4' }}>
        <div className="flex items-center gap-4">
          <div className={`w-4 h-4 rounded-full border-2 border-white/30 ${connected ? (isAGIMode ? 'bg-amber-500 shadow-[0_0_30px_#f59e0b]' : 'bg-cyan-400 shadow-[0_0_20px_#06b6d4]') : 'opacity-30'} ${connected ? 'animate-pulse' : ''}`}></div>
          <h1 className={`text-2xl md:text-3xl font-hud font-bold tracking-[0.2em] select-none ${isAGIMode ? 'text-amber-500 drop-shadow-[0_0_10px_rgba(245,158,11,0.8)]' : 'text-cyan-400 glow-text'}`}>
              {isAGIMode ? 'J.A.R.V.I.S. [AGI]' : 'J.A.R.V.I.S.'}
          </h1>
        </div>
        
        <div className="hidden md:flex gap-3 bg-black/40 p-1 rounded-full border border-white/10">
            {Object.values(ViewMode).map(mode => (
                <button 
                  key={mode}
                  onClick={() => setViewMode(mode)}
                  className={`px-6 py-2 text-xs btn-base font-bold rounded-none ${viewMode === mode ? (isAGIMode ? 'bg-amber-500 text-black border-none shadow-[0_0_15px_rgba(245,158,11,0.6)]' : 'bg-cyan-500 text-black border-none shadow-[0_0_15px_rgba(6,182,212,0.6)]') : 'text-white/50 hover:text-white'}`}
                >
                    {mode}
                </button>
            ))}
        </div>

        <div className="flex gap-4">
             {installPrompt && (
                <button onClick={handleInstall} className="btn-base px-4 py-2 text-xs font-bold bg-green-900/20 text-green-500 border border-green-500 animate-pulse">
                    INSTALL SYSTEM
                </button>
             )}

            {!connected && (
                <button onClick={toggleAGI} className={`hidden md:block btn-base px-4 py-2 text-xs font-bold ${isAGIMode ? 'bg-amber-900/20 text-amber-500 border border-amber-500 shadow-[0_0_20px_rgba(245,158,11,0.4)]' : 'text-slate-500 border border-slate-700'}`}>
                    {isAGIMode ? 'AGI: ENABLED' : 'AGI: DISABLED'}
                </button>
            )}

          {connected && viewMode === ViewMode.LIVE && (
            <button onClick={toggleVision} className={`btn-base px-4 py-2 text-xs font-bold ${isVisionActive ? 'btn-tech-special shadow-[0_0_15px_rgba(168,85,247,0.5)]' : 'btn-tech-secondary'}`}>
               {isVisionActive ? 'VISION: ON' : 'VISION: OFF'}
            </button>
          )}
          {!connected ? (
            <button onClick={connectToJarvis} className="btn-base btn-tech-primary px-8 py-2 text-sm font-bold">
              INITIALIZE
            </button>
          ) : (
            <button onClick={disconnect} className="btn-base btn-tech-danger px-8 py-2 text-sm font-bold">
              SHUTDOWN
            </button>
          )}
        </div>
      </header>

      {/* MOBILE MODE NAV */}
      <div className="md:hidden flex justify-around bg-black border-b border-white/10 p-2">
        {Object.values(ViewMode).map(mode => (
            <button key={mode} onClick={() => setViewMode(mode)} className={`text-[10px] font-bold px-3 py-2 btn-base ${viewMode === mode ? 'btn-tech-primary' : 'text-white/50'}`}>{mode}</button>
        ))}
      </div>

      {/* MAIN CONTENT */}
      <main className="relative z-10 flex-1 flex flex-col md:flex-row overflow-hidden p-2 md:p-4 gap-4">
        
        {/* LEFT: LOGS (Desktop only or small overlay) */}
        <div className="hidden md:block w-1/5 h-full tech-border bg-black/40">
           <SystemLog logs={logs} />
        </div>

        {/* CENTER: DYNAMIC VIEW */}
        <div className="flex-1 relative rounded-xl overflow-hidden border border-white/10 bg-black/20 min-h-[300px] flex flex-col">
           
           {viewMode === ViewMode.LIVE && (
               <div className="flex-1 flex flex-col items-center justify-center relative">
                  {isVisionActive && videoStreamRef.current && (
                    <div className="absolute inset-0 z-0">
                        <video ref={(n) => { if(n && videoStreamRef.current) n.srcObject = videoStreamRef.current; }} autoPlay playsInline muted className="w-full h-full object-cover opacity-60 filter sepia-[.5] hue-rotate-[170deg]" />
                        <div className="absolute inset-0 bg-[linear-gradient(rgba(6,182,212,0.1)_1px,transparent_1px),linear-gradient(90deg,rgba(6,182,212,0.1)_1px,transparent_1px)] bg-[size:40px_40px]"></div>
                    </div>
                  )}
                  <div className="relative z-20 scale-90 transition-all">
                     {connected ? 
                        <PandaAvatar 
                            analyser={analyserRef.current} 
                            isSpeaking={isSpeaking} 
                            isListening={!isSpeaking} 
                            isVisionActive={isVisionActive}
                            isAGIMode={isAGIMode} 
                        /> : (
                        <div className="flex flex-col items-center justify-center opacity-50 animate-pulse">
                            <span className="text-6xl drop-shadow-[0_0_15px_rgba(255,255,255,0.3)]">🐼</span>
                            <p className={`mt-4 text-sm font-hud tracking-[0.3em] ${isAGIMode ? 'text-amber-600' : 'text-cyan-600'}`}>OFFLINE</p>
                        </div>
                     )}
                  </div>
               </div>
           )}

           {viewMode === ViewMode.TERMINAL && <TextTerminal apiKey={process.env.API_KEY} onLog={addLog} isAGIMode={isAGIMode} />}
           {viewMode === ViewMode.CREATION && <CreationLab apiKey={process.env.API_KEY} onLog={addLog} isAGIMode={isAGIMode} />}
           {viewMode === ViewMode.ANALYSIS && <AnalysisLab apiKey={process.env.API_KEY} onLog={addLog} isAGIMode={isAGIMode} />}

        </div>

        {/* RIGHT: TOOLS/MEMORY */}
        <div className="w-full md:w-1/4 h-full flex flex-col gap-4 relative z-20">
           <ActionPanel 
              reminders={reminders} 
              phoneState={phoneState}
              searchResults={searchResults}
              weatherState={weatherState}
              generatedImage={voiceGeneratedImage}
              onDeleteReminder={(id) => setReminders(p => p.filter(r => r.id !== id))} 
              onEndCall={() => setPhoneState(p => ({...p, isInCall: false, activeContact: null}))}
              isAGIMode={isAGIMode}
            />
        </div>

      </main>
    </div>
  );
}
