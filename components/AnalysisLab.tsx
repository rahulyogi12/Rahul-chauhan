
import React, { useState, useRef } from 'react';
import { GoogleGenAI } from '@google/genai';

interface AnalysisLabProps {
  apiKey: string;
  onLog: (msg: string, type: 'info'|'error'|'action'|'system') => void;
  isAGIMode?: boolean;
}

const AnalysisLab: React.FC<AnalysisLabProps> = ({ apiKey, onLog, isAGIMode = false }) => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [prompt, setPrompt] = useState('');
  const [result, setResult] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const client = new GoogleGenAI({ apiKey });

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
          setSelectedFile(file);
          const reader = new FileReader();
          reader.onloadend = () => setPreview(reader.result as string);
          reader.readAsDataURL(file);
      }
  };

  const handleAnalyze = async () => {
      if (!selectedFile || !prompt) return;
      setIsLoading(true);
      setResult('');

      try {
          // Prepare part
          const base64Data = (preview as string).split(',')[1];
          const mimeType = selectedFile.type;
          
          const response = await client.models.generateContent({
              model: 'gemini-3-pro-preview',
              contents: {
                  parts: [
                      { inlineData: { mimeType, data: base64Data } },
                      { text: prompt }
                  ]
              }
          });

          setResult(response.text || 'Analysis complete, no text returned.');
          onLog('Analysis complete.', 'info');

      } catch (e: any) {
          onLog(`Analysis failed: ${e.message}`, 'error');
          setResult(`Error: ${e.message}`);
      } finally {
          setIsLoading(false);
      }
  };

  return (
    <div className="h-full flex flex-col bg-black/40 p-4 tech-border overflow-hidden">
        <div className="mb-6 border-b border-white/10 pb-2">
            <h3 className={`text-sm font-hud font-bold tracking-[0.3em] glow-text uppercase ${isAGIMode ? 'text-amber-400' : 'text-cyan-400'}`}>Visual Intel Analysis</h3>
        </div>

        <div className="flex-1 flex flex-col space-y-6 overflow-y-auto custom-scrollbar px-1">
            <div className="relative group cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                <div className={`absolute inset-0 blur group-hover:bg-opacity-20 transition-all ${isAGIMode ? 'bg-amber-500/5' : 'bg-cyan-500/5'}`}></div>
                <div className={`border-2 border-dashed rounded p-8 text-center transition-all relative z-10 ${isAGIMode ? 'border-amber-800 hover:border-amber-400' : 'border-cyan-800 hover:border-cyan-400'}`}>
                    <input type="file" accept="image/*,video/*" ref={fileInputRef} onChange={handleFile} className="hidden" />
                    <span className="text-3xl block mb-2">📡</span>
                    <p className={`text-xs font-bold tracking-[0.2em] ${isAGIMode ? 'text-amber-400' : 'text-cyan-400'}`}>{selectedFile ? selectedFile.name : 'UPLOAD DATA FOR SCAN'}</p>
                    <p className={`text-[8px] mt-1 uppercase ${isAGIMode ? 'text-amber-700' : 'text-cyan-700'}`}>Supports Image & Video Formats</p>
                </div>
            </div>

            {preview && (
                <div className="h-48 bg-black/80 flex items-center justify-center overflow-hidden tech-border relative">
                     <div className={`absolute top-2 left-2 text-[10px] px-2 py-0.5 font-mono ${isAGIMode ? 'bg-amber-900/80 text-amber-300' : 'bg-cyan-900/80 text-cyan-300'}`}>PREVIEW.DAT</div>
                    {selectedFile?.type.startsWith('video') ? (
                        <video src={preview} className="h-full w-full object-contain" controls />
                    ) : (
                        <img src={preview} alt="Preview" className="h-full object-contain" />
                    )}
                </div>
            )}

            <div className="space-y-2">
                <p className={`text-[10px] uppercase tracking-widest font-bold ${isAGIMode ? 'text-amber-600' : 'text-cyan-600'}`}>Analysis Query</p>
                <textarea 
                    value={prompt}
                    onChange={e => setPrompt(e.target.value)}
                    placeholder="e.g. What details can you find in this image?"
                    className="input-tech w-full h-24 p-3 text-xs"
                />
            </div>

            <button 
                onClick={handleAnalyze} 
                disabled={isLoading || !selectedFile}
                className="btn-base btn-tech-primary w-full py-4 font-bold tracking-[0.2em] text-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
                {isLoading ? 'SCANNING...' : 'INITIATE ANALYSIS'}
            </button>

            {result && (
                <div className="tech-border p-4 bg-slate-900/80 shadow-[0_0_20px_rgba(0,0,0,0.5)]">
                    <div className="flex items-center mb-2 space-x-2 border-b border-white/10 pb-2">
                        <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                        <span className={`text-[10px] font-mono uppercase ${isAGIMode ? 'text-amber-500' : 'text-cyan-500'}`}>Result.log</span>
                    </div>
                    <div className={`text-sm leading-relaxed whitespace-pre-wrap font-sans ${isAGIMode ? 'text-amber-100' : 'text-cyan-100'}`}>
                        {result}
                    </div>
                </div>
            )}
        </div>
    </div>
  );
};

export default AnalysisLab;