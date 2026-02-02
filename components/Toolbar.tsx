import React from 'react';
import { MousePointer2, PlusCircle, gitCommit, Trash2, PenTool } from 'lucide-react';
import { ToolMode } from '../types';

interface ToolbarProps {
  activeTool: ToolMode;
  setTool: (tool: ToolMode) => void;
}

export const Toolbar: React.FC<ToolbarProps> = ({ activeTool, setTool }) => {
  const tools = [
    { id: ToolMode.Select, icon: MousePointer2, label: 'Select' },
    { id: ToolMode.AddStation, icon: PlusCircle, label: 'Station' },
    { id: ToolMode.AddLine, icon: PenTool, label: 'Line' },
    { id: ToolMode.Delete, icon: Trash2, label: 'Delete' },
  ];

  return (
    <div className="flex flex-col gap-2 bg-slate-800 p-2 rounded-lg shadow-lg border border-slate-700">
      {tools.map((tool) => (
        <button
          key={tool.id}
          onClick={() => setTool(tool.id)}
          className={`p-3 rounded-md transition-all duration-200 flex flex-col items-center justify-center group relative
            ${activeTool === tool.id 
              ? 'bg-blue-600 text-white shadow-md shadow-blue-900/50' 
              : 'text-slate-400 hover:bg-slate-700 hover:text-white'
            }`}
          title={tool.label}
        >
          <tool.icon size={20} />
          <span className="text-[10px] mt-1 font-medium">{tool.label}</span>
          
          {/* Tooltip */}
          <div className="absolute left-14 bg-slate-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 pointer-events-none whitespace-nowrap z-50 transition-opacity">
            {tool.label}
          </div>
        </button>
      ))}
    </div>
  );
};
