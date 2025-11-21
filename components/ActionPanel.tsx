
import React from 'react';
import { Reminder, PhoneState, SearchResult, WeatherState } from '../types';

interface ActionPanelProps {
  reminders: Reminder[];
  phoneState: PhoneState;
  searchResults?: SearchResult[];
  weatherState?: WeatherState | null;
  generatedImage?: string | null;
  onDeleteReminder: (id: string) => void;
  onEndCall: () => void;
  isAGIMode?: boolean;
}

const PanelHeader: React.FC<{ title: string; count?: number | string; colorClass?: string }> = ({ title, count, colorClass }) => (
    <div className="flex items-center justify-between mb-3 border-b border-white/10 pb-2">
        <h3 className={`${colorClass || 'text-cyan-400'} text-sm font-hud tracking-[0.2em] uppercase font-bold glow-text`}>
            {title}
        </h3>
        {count !== undefined && (
            <span className="text-[10px] bg-white/5 px-2 py-0.5 rounded-sm text-slate-400 font-mono border border-white/10">
                {count}
            </span>
        )}
    </div>
);

const ActionPanel: React.FC<ActionPanelProps> = ({ reminders, phoneState, searchResults, weatherState, generatedImage, onDeleteReminder, onEndCall, isAGIMode = false }) => {
  
  const primaryText = isAGIMode ? 'text-amber-400' : 'text-cyan-400';
  const secondaryText = isAGIMode ? 'text-amber-600' : 'text-cyan-600';
  
  return (
    <div className="grid grid-cols-1 gap-6 p-2 w-full max-w-md mx-auto md:mx-0 font-sans h-full overflow-y-auto custom-scrollbar">
      
      {/* Holographic Projector (Voice Generated Image) */}
      {generatedImage && (
        <div className="tech-border p-4 animate-[pulse-glow_3s_infinite] bg-black/60 group relative overflow-hidden">
            <PanelHeader title="Holographic Projector" count="ACTIVE" colorClass="text-purple-400" />
            <div className="relative aspect-square w-full overflow-hidden border border-purple-500/30 bg-purple-900/10">
                 <div className="absolute inset-0 bg-[linear-gradient(transparent_50%,rgba(168,85,247,0.1)_50%)] bg-[size:100%_4px] pointer-events-none z-10"></div>
                 <img src={generatedImage} alt="Generated" className="w-full h-full object-contain" />
                 {/* Scanning Effect */}
                 <div className="absolute top-0 w-full h-1 bg-purple-500 shadow-[0_0_10px_#a855f7] animate-[scan_2s_linear_infinite] opacity-50 z-20"></div>
            </div>
            <a href={generatedImage} download="jarvis_creation.png" className="block text-center text-[10px] text-purple-300 mt-2 hover:text-white uppercase tracking-widest">Download Schematic</a>
        </div>
      )}

      {/* Weather Module */}
      {weatherState && (
        <div className="tech-border p-4 bg-gradient-to-br from-black to-black border-white/20 relative overflow-hidden group">
            <div className="absolute -right-10 -top-10 w-32 h-32 bg-yellow-500/10 rounded-full blur-2xl group-hover:bg-yellow-500/20 transition-all"></div>
            <PanelHeader title="Atmospheric Data" colorClass="text-yellow-400" />
            
            <div className="flex items-center justify-between relative z-10">
                <div>
                    <h2 className="text-3xl font-bold text-white font-hud tracking-widest">{weatherState.temperature}</h2>
                    <p className="text-yellow-500 text-xs uppercase tracking-[0.2em] font-bold mt-1">{weatherState.location}</p>
                </div>
                <div className="text-right">
                    <p className={`${isAGIMode ? 'text-amber-300' : 'text-cyan-300'} text-sm font-bold uppercase`}>{weatherState.condition}</p>
                    <div className={`flex flex-col text-[10px] ${secondaryText} mt-1 font-mono`}>
                        <span>HUM: {weatherState.humidity || 'N/A'}</span>
                        <span>WIND: {weatherState.wind || 'N/A'}</span>
                    </div>
                </div>
            </div>
            {/* Animated scan line */}
            <div className="absolute top-0 left-0 w-full h-[1px] bg-yellow-500/50 shadow-[0_0_10px_#eab308] animate-[scan_3s_ease-in-out_infinite] opacity-50"></div>
        </div>
      )}

      {/* Phone Module - High Priority */}
      {phoneState.isInCall && (
        <div className={`tech-border p-6 animate-pulse-glow ${isAGIMode ? 'bg-amber-950/60' : 'bg-cyan-950/60'} relative overflow-hidden`}>
          <div className={`absolute top-0 left-0 w-full h-1 ${isAGIMode ? 'bg-amber-400 shadow-[0_0_15px_#f59e0b]' : 'bg-cyan-400 shadow-[0_0_15px_#06b6d4]'}`}></div>
          <div className="flex flex-col items-center justify-center space-y-4 relative z-10">
             <div className={`w-24 h-24 rounded-full border-4 flex items-center justify-center bg-black/40 relative ${isAGIMode ? 'border-amber-500/30 shadow-[0_0_30px_rgba(245,158,11,0.2)]' : 'border-cyan-500/30 shadow-[0_0_30px_rgba(6,182,212,0.2)]'}`}>
                <span className="text-4xl animate-pulse">📞</span>
                <div className={`absolute inset-0 rounded-full border-t-2 animate-spin-slow ${isAGIMode ? 'border-amber-400' : 'border-cyan-400'}`}></div>
             </div>
             <div className="text-center">
               <h3 className={`${isAGIMode ? 'text-amber-100' : 'text-cyan-100'} text-2xl font-hud font-bold tracking-wider uppercase`}>{phoneState.activeContact?.name || 'UNKNOWN'}</h3>
               <p className={`${isAGIMode ? 'text-amber-500' : 'text-cyan-500'} text-lg font-mono tracking-[0.2em] mt-1`}>{phoneState.activeContact?.number}</p>
               <div className="mt-4 flex items-center justify-center gap-2 bg-red-900/20 px-3 py-1 rounded-full border border-red-500/30">
                  <span className="w-2 h-2 bg-red-500 rounded-full animate-ping"></span>
                  <p className="text-red-400 text-[10px] font-bold tracking-widest uppercase">Secure Line Active</p>
               </div>
             </div>
             <button 
               onClick={onEndCall}
               className="btn-base btn-tech-danger w-full py-3 mt-2 font-bold tracking-widest text-xs"
             >
               Terminate Connection
             </button>
          </div>
        </div>
      )}

      {/* Search Results (Holographic List) */}
      {searchResults && searchResults.length > 0 && (
        <div className="tech-border p-4 group relative overflow-hidden">
           <div className="absolute top-0 right-0 w-20 h-20 bg-green-500/5 blur-xl rounded-full pointer-events-none"></div>
           <PanelHeader title="Web Uplink" count="ONLINE" colorClass="text-green-400" />
           <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1 custom-scrollbar">
             {searchResults.map((result, idx) => (
               <a 
                 key={idx} 
                 href={result.url} 
                 target="_blank" 
                 rel="noopener noreferrer"
                 className="block bg-black/40 p-3 border-l-2 border-green-500/30 hover:border-green-400 hover:bg-green-900/20 transition-all group/item relative overflow-hidden"
               >
                 <div className="absolute inset-0 bg-green-400/5 translate-x-[-100%] group-hover/item:translate-x-[100%] transition-transform duration-700"></div>
                 <p className="text-green-100 text-xs font-bold truncate font-hud group-hover/item:text-green-300 relative z-10">{result.title}</p>
                 <p className="text-green-600 text-[10px] truncate font-mono mt-1 relative z-10">{result.url}</p>
               </a>
             ))}
          </div>
        </div>
      )}

      {/* Memory Module (File System) */}
      <div className="tech-border p-4 flex-1 min-h-[200px]">
        <PanelHeader title="Active Memory" count={reminders.length} colorClass={primaryText} />
        
        <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1 custom-scrollbar">
          {reminders.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-slate-600 border border-dashed border-slate-800 rounded bg-black/20">
                <span className="text-3xl opacity-30 mb-2">💾</span>
                <span className="text-[10px] font-mono tracking-widest uppercase">Memory Banks Empty</span>
            </div>
          ) : (
            reminders.map((rem) => (
              <div key={rem.id} className={`flex items-center justify-between p-3 border hover:bg-white/5 transition-all clip-corner group relative ${isAGIMode ? 'bg-amber-900/10 border-amber-900/30 hover:border-amber-500/50' : 'bg-cyan-900/10 border-cyan-900/30 hover:border-cyan-500/50'}`}>
                <div className="flex-1 min-w-0 mr-2">
                  <p className={`${isAGIMode ? 'text-amber-100' : 'text-cyan-100'} text-sm font-bold truncate`}>{rem.task}</p>
                  <div className="flex items-center gap-2 mt-1">
                      <span className={`w-1 h-1 rounded-full ${isAGIMode ? 'bg-amber-500' : 'bg-cyan-500'}`}></span>
                      <p className={`${secondaryText} text-[10px] uppercase font-mono`}>{rem.time}</p>
                  </div>
                </div>
                <button 
                  onClick={() => onDeleteReminder(rem.id)}
                  className="text-slate-500 hover:text-red-400 transition-colors p-2 opacity-60 group-hover:opacity-100"
                  title="Delete Memory"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* System Status Footer */}
      <div className="flex justify-between items-center px-2 py-1 border-t border-white/10 pt-2">
           <div className="flex gap-1">
               {[1,2,3,4,5].map(i => (
                   <div key={i} className={`w-6 h-1 transform skew-x-[-20deg] opacity-70 ${i<5 ? (isAGIMode ? 'bg-amber-600' : 'bg-cyan-600') : 'bg-slate-900'}`}></div>
               ))}
           </div>
           <span className={`text-[10px] font-mono tracking-widest ${isAGIMode ? 'text-amber-700' : 'text-cyan-700'}`}>SYS.PWR: 100%</span>
      </div>

    </div>
  );
};

export default ActionPanel;