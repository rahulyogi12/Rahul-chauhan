import React, { useEffect, useRef } from 'react';
import { LogEntry } from '../types';

interface SystemLogProps {
  logs: LogEntry[];
}

const SystemLog: React.FC<SystemLogProps> = ({ logs }) => {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div className="h-full flex flex-col font-mono text-xs md:text-sm p-1">
      {/* Terminal Header */}
      <div className="flex items-center justify-between bg-cyan-950/30 border-b border-cyan-500/30 p-2 mb-2">
          <span className="text-cyan-400 font-bold tracking-widest text-[10px] uppercase">Term.Log.01</span>
          <div className="flex gap-1">
              <div className="w-2 h-2 rounded-full bg-red-500/20 border border-red-500/50"></div>
              <div className="w-2 h-2 rounded-full bg-yellow-500/20 border border-yellow-500/50"></div>
              <div className="w-2 h-2 rounded-full bg-green-500/20 border border-green-500/50"></div>
          </div>
      </div>

      {/* Scrollable Area */}
      <div className="flex-1 overflow-y-auto space-y-1 pr-2 custom-scrollbar relative">
        {/* Faint background lines */}
        <div className="absolute inset-0 pointer-events-none bg-[linear-gradient(0deg,transparent_24%,rgba(6,182,212,0.05)_25%,rgba(6,182,212,0.05)_26%,transparent_27%,transparent_74%,rgba(6,182,212,0.05)_75%,rgba(6,182,212,0.05)_76%,transparent_77%,transparent)] bg-[size:100%_30px]"></div>

        {logs.length === 0 && (
            <div className="p-4 text-slate-600 italic opacity-50">
                Initializing protocols...<br/>
                Waiting for voice input...
            </div>
        )}
        
        {logs.map((log) => (
          <div key={log.id} className="flex gap-3 items-start hover:bg-white/5 p-1 rounded transition-colors">
            <span className="text-slate-600 text-[10px] min-w-[50px] pt-0.5 opacity-70">{log.timestamp}</span>
            <span className={`break-words leading-tight ${
              log.type === 'error' ? 'text-red-400 font-bold' :
              log.type === 'action' ? 'text-yellow-300' :
              log.type === 'system' ? 'text-cyan-600' :
              'text-cyan-300'
            }`}>
              {log.type === 'action' && <span className="text-yellow-500 mr-1">➜</span>}
              {log.type === 'error' && <span className="text-red-500 mr-1">⚠</span>}
              {log.message}
            </span>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
};

export default SystemLog;