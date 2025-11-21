
import React, { useState, useRef } from 'react';
import { GoogleGenAI } from '@google/genai';

interface CreationLabProps {
  apiKey: string;
  onLog: (msg: string, type: 'info'|'error'|'action'|'system') => void;
  isAGIMode?: boolean;
}

const CreationLab: React.FC<CreationLabProps> = ({ apiKey, onLog, isAGIMode = false }) => {
  const [mode, setMode] = useState<'IMAGE_GEN' | 'IMAGE_EDIT' | 'VIDEO_GEN'>('IMAGE_GEN');
  const [prompt, setPrompt] = useState('');
  const [aspectRatio, setAspectRatio] = useState('1:1');
  const [isLoading, setIsLoading] = useState(false);
  const [generatedMedia, setGeneratedMedia] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<'image'|'video'>('image');
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const client = new GoogleGenAI({ apiKey });

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
     const file = e.target.files?.[0];
     if (file) {
         const reader = new FileReader();
         reader.onloadend = () => {
             setSelectedImage(reader.result as string);
         };
         reader.readAsDataURL(file);
     }
  };

  const handleGenerate = async () => {
      if (!prompt) return;
      setIsLoading(true);
      setGeneratedMedia(null);

      try {
          if (mode === 'IMAGE_GEN') {
              const response = await client.models.generateContent({
                  model: 'gemini-3-pro-image-preview',
                  contents: { parts: [{ text: prompt }] },
                  config: {
                      imageConfig: { aspectRatio: aspectRatio as any }
                  }
              });
              
              const imgPart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
              if (imgPart?.inlineData?.data) {
                  setGeneratedMedia(`data:image/png;base64,${imgPart.inlineData.data}`);
                  setMediaType('image');
                  onLog('Image generation complete.', 'info');
              } else {
                  onLog('No image returned.', 'error');
              }

          } else if (mode === 'IMAGE_EDIT') {
              if (!selectedImage) {
                  onLog('Please upload a base image first.', 'error');
                  setIsLoading(false);
                  return;
              }
              const base64Data = selectedImage.split(',')[1];
              const response = await client.models.generateContent({
                  model: 'gemini-2.5-flash-image',
                  contents: {
                      parts: [
                          { inlineData: { mimeType: 'image/png', data: base64Data } },
                          { text: prompt }
                      ]
                  }
              });
              // Note: Flash Image Edit returns image in parts
              const imgPart = response.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
              if (imgPart?.inlineData?.data) {
                  setGeneratedMedia(`data:image/png;base64,${imgPart.inlineData.data}`);
                  setMediaType('image');
                  onLog('Image edit complete.', 'info');
              }

          } else if (mode === 'VIDEO_GEN') {
              // VEO Check
              if (!(window as any).aistudio?.hasSelectedApiKey()) {
                 try {
                    await (window as any).aistudio.openSelectKey();
                    // Need to re-init client with new key ideally, but env key should update
                 } catch(e) {
                     onLog('API Key selection required for Veo.', 'error');
                     setIsLoading(false);
                     return;
                 }
              }

              // Re-instantiate to ensure key is fresh
              const veoClient = new GoogleGenAI({ apiKey: process.env.API_KEY });

              const config: any = {
                  numberOfVideos: 1,
                  resolution: '720p', // Fast preview supports 720/1080
                  aspectRatio: aspectRatio === '9:16' ? '9:16' : '16:9' // Veo strictly 16:9 or 9:16
              };

              let operation;
              
              if (selectedImage) {
                  // Image to Video
                  const base64Data = selectedImage.split(',')[1];
                  operation = await veoClient.models.generateVideos({
                      model: 'veo-3.1-fast-generate-preview',
                      prompt: prompt,
                      image: { imageBytes: base64Data, mimeType: 'image/png' },
                      config
                  });
              } else {
                  // Text to Video
                  operation = await veoClient.models.generateVideos({
                      model: 'veo-3.1-fast-generate-preview',
                      prompt: prompt,
                      config
                  });
              }

              onLog('Veo generation started... please wait.', 'system');
              
              // Polling
              while (!operation.done) {
                  await new Promise(r => setTimeout(r, 5000));
                  operation = await veoClient.operations.getVideosOperation({ operation });
              }

              const videoUri = operation.response?.generatedVideos?.[0]?.video?.uri;
              if (videoUri) {
                  const fetchRes = await fetch(`${videoUri}&key=${process.env.API_KEY}`);
                  const blob = await fetchRes.blob();
                  const url = URL.createObjectURL(blob);
                  setGeneratedMedia(url);
                  setMediaType('video');
                  onLog('Video generation complete.', 'info');
              }
          }
      } catch (e: any) {
          onLog(`Generation failed: ${e.message}`, 'error');
      } finally {
          setIsLoading(false);
      }
  };

  return (
    <div className="h-full flex flex-col bg-black/40 p-4 tech-border overflow-hidden">
        <div className="flex space-x-2 mb-6 border-b border-white/10 pb-4">
            <button onClick={() => setMode('IMAGE_GEN')} className={`btn-base px-4 py-2 text-[10px] font-bold ${mode==='IMAGE_GEN' ? 'btn-tech-primary' : 'btn-tech-secondary'}`}>GENERATE IMG</button>
            <button onClick={() => setMode('IMAGE_EDIT')} className={`btn-base px-4 py-2 text-[10px] font-bold ${mode==='IMAGE_EDIT' ? 'btn-tech-primary' : 'btn-tech-secondary'}`}>EDIT IMG</button>
            <button onClick={() => setMode('VIDEO_GEN')} className={`btn-base px-4 py-2 text-[10px] font-bold ${mode==='VIDEO_GEN' ? 'btn-tech-special' : 'text-purple-400 border border-purple-900/50'}`}>GENERATE VIDEO</button>
        </div>

        <div className="flex-1 flex flex-col space-y-6 overflow-y-auto custom-scrollbar px-1">
            
            {(mode === 'IMAGE_EDIT' || mode === 'VIDEO_GEN') && (
                <div className="relative group cursor-pointer">
                    <div className={`absolute inset-0 blur group-hover:bg-opacity-20 transition-all ${isAGIMode ? 'bg-amber-500/5' : 'bg-cyan-500/5'}`}></div>
                    <div className={`border-2 border-dashed rounded p-6 text-center transition-all relative z-10 ${isAGIMode ? 'border-amber-800 hover:border-amber-400' : 'border-cyan-800 hover:border-cyan-400'}`} onClick={() => fileInputRef.current?.click()}>
                        <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageUpload} className="hidden" />
                        <span className="text-2xl block mb-2">📂</span>
                        <span className={`text-xs font-bold tracking-[0.2em] ${isAGIMode ? 'text-amber-400' : 'text-cyan-400'}`}>
                            {selectedImage ? 'IMAGE LOADED - CLICK TO CHANGE' : 'UPLOAD REFERENCE IMAGE'}
                        </span>
                        {selectedImage && <img src={selectedImage} alt="Ref" className="h-32 mx-auto mt-4 border border-white/10 shadow-lg" />}
                    </div>
                </div>
            )}

            <div className="space-y-2">
                <p className={`text-[10px] uppercase tracking-widest font-bold ${isAGIMode ? 'text-amber-600' : 'text-cyan-600'}`}>Prompt Directive</p>
                <textarea 
                    value={prompt}
                    onChange={e => setPrompt(e.target.value)}
                    placeholder={mode === 'IMAGE_EDIT' ? "e.g. Add a retro filter..." : "Describe the output..."}
                    className="input-tech w-full h-24 p-3 text-xs"
                />
            </div>

            {mode !== 'IMAGE_EDIT' && (
                <div className="space-y-2">
                    <p className={`text-[10px] uppercase tracking-widest font-bold ${isAGIMode ? 'text-amber-600' : 'text-cyan-600'}`}>Aspect Ratio</p>
                    <div className="relative">
                        <select 
                            value={aspectRatio} 
                            onChange={e => setAspectRatio(e.target.value)}
                            className="input-tech w-full p-2 text-xs appearance-none"
                        >
                            {mode === 'VIDEO_GEN' ? (
                                <>
                                    <option value="16:9">16:9 (Landscape)</option>
                                    <option value="9:16">9:16 (Portrait)</option>
                                </>
                            ) : (
                                <>
                                    <option value="1:1">1:1 (Square)</option>
                                    <option value="16:9">16:9 (Landscape)</option>
                                    <option value="9:16">9:16 (Portrait)</option>
                                    <option value="4:3">4:3</option>
                                    <option value="3:4">3:4</option>
                                </>
                            )}
                        </select>
                        <div className={`absolute right-3 top-2 pointer-events-none ${isAGIMode ? 'text-amber-600' : 'text-cyan-600'}`}>▼</div>
                    </div>
                </div>
            )}

            <button 
                onClick={handleGenerate} 
                disabled={isLoading}
                className={`btn-base w-full py-4 font-bold tracking-[0.2em] text-sm ${mode === 'VIDEO_GEN' ? 'btn-tech-special' : 'btn-tech-primary'}`}
            >
                {isLoading ? 'PROCESSING...' : 'EXECUTE'}
            </button>

            {generatedMedia && (
                <div className="mt-6 tech-border p-4 bg-black/60">
                    <div className="flex justify-between items-center mb-2 border-b border-white/10 pb-1">
                        <span className={`text-[10px] uppercase tracking-widest ${isAGIMode ? 'text-amber-600' : 'text-cyan-600'}`}>Output Render</span>
                    </div>
                    {mediaType === 'image' ? (
                        <img src={generatedMedia} alt="Generated" className="w-full border border-white/10" />
                    ) : (
                        <video src={generatedMedia} controls autoPlay loop className="w-full border border-purple-900/50" />
                    )}
                    <a href={generatedMedia} download={`jarvis_gen.${mediaType === 'image' ? 'png' : 'mp4'}`} className="btn-base btn-tech-secondary block text-center text-xs mt-4 py-2">DOWNLOAD FILE</a>
                </div>
            )}
        </div>
    </div>
  );
};

export default CreationLab;