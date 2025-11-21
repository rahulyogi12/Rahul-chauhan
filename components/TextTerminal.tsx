
import React, { useState, useEffect } from 'react';
import { GoogleGenAI, Modality } from '@google/genai';
import { playSystemSound, decodeAudioData } from '../utils/audioUtils';
import { SearchResult } from '../types';

interface TextTerminalProps {
  apiKey: string;
  onLog: (msg: string, type: 'info'|'error'|'action'|'system') => void;
  isAGIMode?: boolean;
}

interface ChatMessage {
  role: 'user' | 'model';
  text: string;
  searchResults?: SearchResult[];
}

const TextTerminal: React.FC<TextTerminalProps> = ({ apiKey, onLog, isAGIMode = false }) => {
  const [tab, setTab] = useState<'CHAT' | 'TTS' | 'TRANSCRIBE'>('CHAT');
  const [chatModel, setChatModel] = useState<'FAST' | 'THINKING'>('FAST');
  const [input, setInput] = useState('');
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [ttsText, setTtsText] = useState('');
  const [transcribedText, setTranscribedText] = useState('');
  
  const client = new GoogleGenAI({ apiKey });

  // Auto-switch to Thinking model if AGI mode is ON
  useEffect(() => {
      if (isAGIMode) setChatModel('THINKING');
  }, [isAGIMode]);

  const handleChat = async () => {
    if (!input.trim()) return;
    setIsLoading(true);
    const userMsg = input;
    setChatHistory(prev => [...prev, { role: 'user', text: userMsg }]);
    setInput('');

    try {
      // If AGI Mode, force high-end model
      const modelName = (isAGIMode || chatModel === 'THINKING') ? 'gemini-3-pro-preview' : 'gemini-flash-lite-latest';
      
      const config: any = {
         tools: [{ googleSearch: {} }] 
      };

      if (chatModel === 'THINKING' || isAGIMode) {
          // Max thinking budget for AGI
          config.thinkingConfig = { thinkingBudget: 32768 }; 
      }

      const response = await client.models.generateContent({
        model: modelName,
        contents: userMsg,
        config: config
      });

      const text = response.text || "No response generated.";
      
      // Grounding Extraction
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      const results: SearchResult[] = [];
      
      if (chunks) {
        chunks.forEach((c: any) => {
            if (c.web) {
                results.push({ title: c.web.title, url: c.web.uri });
            }
        });
      }

      setChatHistory(prev => [...prev, { 
          role: 'model', 
          text: text,
          searchResults: results.length > 0 ? results : undefined 
      }]);

    } catch (e: any) {
      onLog(e.message, 'error');
      setChatHistory(prev => [...prev, { role: 'model', text: `Error: ${e.message}` }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTTS = async () => {
      if (!ttsText) return;
      setIsLoading(true);
      try {
        const response = await client.models.generateContent({
            model: 'gemini-2.5-flash-preview-tts',
            contents: { parts: [{ text: ttsText }] },
            config: {
                responseModalities: [Modality.AUDIO],
                speechConfig: {
                    voiceConfig: { prebuiltVoiceConfig: { voiceName: isAGIMode ? 'Kore' : 'Puck' } }
                }
            }
        });

        const audioData = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        if (audioData) {
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const buffer = await decodeAudioData(
                new Uint8Array(atob(audioData).split('').map(c => c.charCodeAt(0))),
                ctx,
                24000,
                1
            );
            const source = ctx.createBufferSource();
            source.buffer = buffer;
            source.connect(ctx.destination);
            source.start();
            onLog('Audio generated successfully', 'info');
        }
      } catch (e: any) {
          onLog(e.message, 'error');
      } finally {
          setIsLoading(false);
      }
  };

  const handleTranscribe = async () => {
      // Simple microphone capture logic for transcription
      try {
          onLog('Listening for 5 seconds...', 'system');
          setIsLoading(true);
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          const mediaRecorder = new MediaRecorder(stream);
          const chunks: Blob[] = [];
          
          mediaRecorder.ondataavailable = (e) => chunks.push(e.data);
          mediaRecorder.onstop = async () => {
             const blob = new Blob(chunks, { type: 'audio/webm' });
             // Convert blob to base64
             const reader = new FileReader();
             reader.onloadend = async () => {
                 const base64 = (reader.result as string).split(',')[1];
                 try {
                     const response = await client.models.generateContent({
                         model: 'gemini-2.5-flash',
                         contents: {
                             parts: [
                                 { inlineData: { mimeType: 'audio/webm', data: base64 } },
                                 { text: "Transcribe this audio exactly." }
                             ]
                         }
                     });
                     setTranscribedText(response.text || "Transcription failed.");
                 } catch (e: any) {
                     onLog(e.message, 'error');
                 } finally {
                     setIsLoading(false);
                 }
             };
             reader.readAsDataURL(blob);
             stream.getTracks().forEach(t => t.stop());
          };

          mediaRecorder.start();
          setTimeout(() => mediaRecorder.stop(), 5000); // Record for 5s

      } catch (e: any) {
          onLog(e.message, 'error');
          setIsLoading(false);
      }
  };

  // Theme colors
  const primaryColor = isAGIMode ? 'text-amber-500 border-amber-500' : 'text-cyan-400 border-cyan-500';
  const bgActive = isAGIMode ? 'bg-amber-500/20' : 'bg-cyan-500/20';

  return (
    <div className="h-full flex flex-col bg-black/40 p-4 tech-border overflow-hidden">
       <div className="flex space-x-2 mb-4 border-b border-white/10 pb-4">
          {['CHAT', 'TTS', 'TRANSCRIBE'].map((t) => (
              <button 
                key={t}
                onClick={() => setTab(t as any)}
                className={`btn-base px-6 py-2 text-xs font-bold tracking-widest transition-all ${tab === t ? 'btn-tech-primary active' : 'btn-tech-secondary'}`}
              >
                  {t}
              </button>
          ))}
       </div>

       {tab === 'CHAT' && (
           <div className="flex-1 flex flex-col min-h-0">
               <div className="flex items-center justify-end mb-2 space-x-2">
                   <span className={`text-[10px] font-mono uppercase tracking-widest ${isAGIMode ? 'text-amber-600' : 'text-cyan-600'}`}>Processing Unit:</span>
                   {!isAGIMode && <button onClick={() => setChatModel('FAST')} className={`btn-base text-[10px] px-3 py-1 ${chatModel === 'FAST' ? 'text-green-400 border border-green-500 bg-green-900/20' : 'border border-gray-700 text-gray-600'}`}>FLASH LITE</button>}
                   <button onClick={() => setChatModel('THINKING')} className={`btn-base text-[10px] px-3 py-1 ${chatModel === 'THINKING' || isAGIMode ? (isAGIMode ? 'text-amber-400 border border-amber-500 bg-amber-900/20 shadow-[0_0_10px_rgba(245,158,11,0.3)]' : 'text-purple-400 border border-purple-500 bg-purple-900/20 shadow-[0_0_10px_rgba(168,85,247,0.3)]') : 'border border-gray-700 text-gray-600'}`}>
                       {isAGIMode ? 'AGI SUPER-THINKING' : 'PRO THINKING'}
                   </button>
               </div>
               <div className="flex-1 overflow-y-auto mb-4 space-y-3 pr-2 custom-scrollbar bg-black/20 p-2 rounded border border-white/10 shadow-inner">
                   {chatHistory.map((msg, i) => (
                       <div key={i} className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
                           <div className={`max-w-[85%] p-3 rounded text-sm font-mono relative ${msg.role === 'user' ? `${isAGIMode ? 'bg-amber-900/30 text-amber-100 border-amber-500' : 'bg-cyan-900/30 text-cyan-100 border-cyan-400'} border-r-2` : 'bg-slate-800/50 text-slate-300 border-l-2 border-slate-500'}`}>
                               <pre className="whitespace-pre-wrap font-sans text-xs md:text-sm">{msg.text}</pre>
                               
                               {/* SEARCH RESULTS SECTION */}
                               {msg.searchResults && (
                                   <div className="mt-3 pt-3 border-t border-white/10">
                                       <div className="flex items-center gap-2 mb-2">
                                           <span className={`w-1.5 h-1.5 rounded-full ${isAGIMode ? 'bg-amber-500' : 'bg-cyan-500'} animate-pulse`}></span>
                                           <p className="text-[10px] uppercase tracking-widest opacity-70 font-bold">Data Uplink / References</p>
                                       </div>
                                       <div className="grid grid-cols-1 gap-1">
                                           {msg.searchResults.map((res, idx) => (
                                               <a 
                                                 key={idx} 
                                                 href={res.url} 
                                                 target="_blank" 
                                                 rel="noreferrer" 
                                                 className={`block text-xs truncate p-1.5 rounded bg-black/20 hover:bg-white/5 border border-transparent hover:border-white/10 transition-all ${isAGIMode ? 'text-amber-400 hover:text-amber-300' : 'text-cyan-400 hover:text-cyan-300'}`}
                                               >
                                                   <span className="opacity-50 mr-2">[{idx + 1}]</span>
                                                   {res.title}
                                               </a>
                                           ))}
                                       </div>
                                   </div>
                               )}
                           </div>
                       </div>
                   ))}
                   {isLoading && <div className={`${isAGIMode ? 'text-amber-500' : 'text-cyan-500'} animate-pulse text-xs font-mono tracking-widest ml-2`}>AWAITING RESPONSE...</div>}
               </div>
               <div className="flex gap-2">
                   <input 
                     value={input}
                     onChange={e => setInput(e.target.value)}
                     onKeyDown={e => e.key === 'Enter' && handleChat()}
                     placeholder="ENTER COMMAND..."
                     className="input-tech flex-1 p-3 text-sm uppercase"
                   />
                   <button onClick={handleChat} disabled={isLoading} className="btn-base btn-tech-primary px-6 font-bold">SEND</button>
               </div>
           </div>
       )}

       {tab === 'TTS' && (
           <div className="flex-1 flex flex-col items-center justify-center space-y-4">
               <textarea 
                  value={ttsText}
                  onChange={e => setTtsText(e.target.value)}
                  placeholder="ENTER TEXT DATA FOR SYNTHESIS..."
                  className="input-tech w-full h-40 p-4 text-sm"
               />
               <button onClick={handleTTS} disabled={isLoading} className="btn-base btn-tech-primary w-full py-3 font-bold tracking-[0.2em]">
                   {isLoading ? 'SYNTHESIZING...' : 'INITIATE AUDIO GENERATION'}
               </button>
           </div>
       )}

       {tab === 'TRANSCRIBE' && (
           <div className="flex-1 flex flex-col items-center justify-center space-y-6">
               <div className="relative">
                  {isLoading && <div className={`absolute inset-0 rounded-full animate-ping ${isAGIMode ? 'bg-amber-500/30' : 'bg-cyan-500/30'}`}></div>}
                  <button onClick={handleTranscribe} disabled={isLoading} className={`w-32 h-32 rounded-full border-4 flex items-center justify-center transition-all ${isLoading ? 'border-red-500 bg-red-900/20' : `${primaryColor} hover:${bgActive}`}`}>
                      <span className="text-5xl">{isLoading ? '●' : '🎤'}</span>
                  </button>
               </div>
               
               <p className={`text-xs tracking-[0.2em] font-hud ${isAGIMode ? 'text-amber-600' : 'text-cyan-600'}`}>{isLoading ? 'RECORDING IN PROGRESS...' : 'CLICK TO RECORD (5s)'}</p>
               
               {transcribedText && (
                   <div className="w-full p-4 bg-black/30 border border-white/10 text-white mt-4 rounded shadow-[0_0_10px_rgba(0,0,0,0.5)]">
                       <p className={`text-[10px] mb-2 font-mono uppercase border-b border-white/10 pb-1 ${isAGIMode ? 'text-amber-600' : 'text-cyan-600'}`}>Transcript Data</p>
                       {transcribedText}
                   </div>
               )}
           </div>
       )}
    </div>
  );
};

export default TextTerminal;
