import React from "react";
import { Sliders, HelpCircle, Save, CheckCircle2, Navigation } from "lucide-react";

interface WorkspaceCalibratorProps {
  rcxPickOriginXStr: string;
  setRcxPickOriginXStr: (v: string) => void;
  rcxPickOriginYStr: string;
  setRcxPickOriginYStr: (v: string) => void;
  rcxPickOriginZStr: string;
  setRcxPickOriginZStr: (v: string) => void;
  rcxPickOriginRStr: string;
  setRcxPickOriginRStr: (v: string) => void;
  
  rcxPalletOriginXStr: string;
  setRcxPalletOriginXStr: (v: string) => void;
  rcxPalletOriginYStr: string;
  setRcxPalletOriginYStr: (v: string) => void;
  rcxPalletOriginZStr: string;
  setRcxPalletOriginZStr: (v: string) => void;
  rcxPalletOriginRStr: string;
  setRcxPalletOriginRStr: (v: string) => void;

  rcxToolOffsetZStr: string;
  setRcxToolOffsetZStr: (v: string) => void;
  rcxToolOffsetXStr: string;
  setRcxToolOffsetXStr: (v: string) => void;
  rcxToolOffsetYStr: string;
  setRcxToolOffsetYStr: (v: string) => void;

  rcxEndEffectorLStr: string;
  setRcxEndEffectorLStr: (v: string) => void;
  rcxEndEffectorWStr: string;
  setRcxEndEffectorWStr: (v: string) => void;
  rcxEndEffectorHStr: string;
  setRcxEndEffectorHStr: (v: string) => void;

  rcxPickAlignmentMode: "corner" | "center";
  setRcxPickAlignmentMode: (v: "corner" | "center") => void;

  rcxScaleDownStr: string;
  setRcxScaleDownStr: (v: string) => void;

  rcxPickSignX: number; setRcxPickSignX: (v: number) => void;
  rcxPickSignY: number; setRcxPickSignY: (v: number) => void;
  rcxPickSignZ: number; setRcxPickSignZ: (v: number) => void;
  rcxPlaceSignX: number; setRcxPlaceSignX: (v: number) => void;
  rcxPlaceSignY: number; setRcxPlaceSignY: (v: number) => void;
  rcxPlaceSignZ: number; setRcxPlaceSignZ: (v: number) => void;
  rcxSafeZTravelEnabled: boolean; setRcxSafeZTravelEnabled: (v: boolean) => void;

  rcxTravelSpeedStr: string; setRcxTravelSpeedStr: (v: string) => void;
  rcxPlungeSpeedStr: string; setRcxPlungeSpeedStr: (v: string) => void;

  isYamahaConnected: boolean;
  onJogToPickOriginXYR: () => void;
  onJogToPickOriginFull: () => void;
  onJogToPalletOriginXYR: () => void;
  onJogToPalletOriginFull: () => void;
  onSaveConfig: () => void;
  saveSuccess?: boolean;
}

export default function WorkspaceCalibrator({
  rcxPickOriginXStr, setRcxPickOriginXStr,
  rcxPickOriginYStr, setRcxPickOriginYStr,
  rcxPickOriginZStr, setRcxPickOriginZStr,
  rcxPickOriginRStr, setRcxPickOriginRStr,
  
  rcxPalletOriginXStr, setRcxPalletOriginXStr,
  rcxPalletOriginYStr, setRcxPalletOriginYStr,
  rcxPalletOriginZStr, setRcxPalletOriginZStr,
  rcxPalletOriginRStr, setRcxPalletOriginRStr,
  
  rcxToolOffsetZStr, setRcxToolOffsetZStr,
  rcxToolOffsetXStr, setRcxToolOffsetXStr,
  rcxToolOffsetYStr, setRcxToolOffsetYStr,
  rcxEndEffectorLStr, setRcxEndEffectorLStr,
  rcxEndEffectorWStr, setRcxEndEffectorWStr,
  rcxEndEffectorHStr, setRcxEndEffectorHStr,
  rcxPickAlignmentMode, setRcxPickAlignmentMode,
  rcxScaleDownStr, setRcxScaleDownStr,

  rcxPickSignX, setRcxPickSignX,
  rcxPickSignY, setRcxPickSignY,
  rcxPickSignZ, setRcxPickSignZ,
  rcxPlaceSignX, setRcxPlaceSignX,
  rcxPlaceSignY, setRcxPlaceSignY,
  rcxPlaceSignZ, setRcxPlaceSignZ,
  rcxSafeZTravelEnabled, setRcxSafeZTravelEnabled,

  rcxTravelSpeedStr, setRcxTravelSpeedStr,
  rcxPlungeSpeedStr, setRcxPlungeSpeedStr,

  isYamahaConnected,
  onJogToPickOriginXYR,
  onJogToPickOriginFull,
  onJogToPalletOriginXYR,
  onJogToPalletOriginFull,
  onSaveConfig,
  saveSuccess
}: WorkspaceCalibratorProps) {
  return (
    <div id="workspace-calibrator-container" className="bg-slate-900/40 border border-slate-800 rounded-lg p-4 space-y-4">
      <div className="flex items-center justify-between border-b border-slate-800 pb-2">
        <div className="flex items-center gap-1.5">
          <Sliders className="w-4 h-4 text-sky-400" />
          <span className="text-[11px] font-bold text-slate-200 tracking-wider uppercase font-mono">
            Workspace Hardware Origin Calibrations (mm)
          </span>
        </div>
        <span className={`px-1.5 py-0.5 rounded text-[8.5px] font-mono font-bold uppercase transition ${isYamahaConnected ? "bg-teal-500/10 text-teal-400 border border-teal-500/20" : "bg-slate-800 text-slate-500"}`}>
          {isYamahaConnected ? "Robot Online" : "Robot Offline"}
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Conveyor Pickup Point Offset */}
        <div className="space-y-2 bg-slate-950/20 p-2.5 rounded border border-slate-900/50">
          <div className="text-[10px] uppercase tracking-wider font-bold text-sky-400 font-mono flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-sky-400 rounded-full"></span>
            Conveyor Pickup Origin (Ref Point)
          </div>
          
          <div className="grid grid-cols-4 gap-1.5">
            <div>
              <label className="block text-[8px] text-slate-500 font-mono uppercase mb-0.5 text-center">X (mm)</label>
              <input
                type="text"
                value={rcxPickOriginXStr}
                onChange={(e) => setRcxPickOriginXStr(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 px-1 py-1 font-mono text-center text-[11px] text-sky-400 rounded focus:border-sky-500/55 hover:border-slate-800 transition"
              />
            </div>
            <div>
              <label className="block text-[8px] text-slate-500 font-mono uppercase mb-0.5 text-center">Y (mm)</label>
              <input
                type="text"
                value={rcxPickOriginYStr}
                onChange={(e) => setRcxPickOriginYStr(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 px-1 py-1 font-mono text-center text-[11px] text-sky-400 rounded focus:border-sky-500/55 hover:border-slate-800 transition"
              />
            </div>
            <div>
              <label className="block text-[8px] text-slate-500 font-mono uppercase mb-0.5 text-center">Z (mm)</label>
              <input
                type="text"
                value={rcxPickOriginZStr}
                onChange={(e) => setRcxPickOriginZStr(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 px-1 py-1 font-mono text-center text-[11px] text-sky-400 rounded focus:border-sky-500/55 hover:border-slate-800 transition"
              />
            </div>
            <div>
              <label className="block text-[8px] text-slate-500 font-mono uppercase mb-0.5 text-center">R (deg)</label>
              <input
                type="text"
                value={rcxPickOriginRStr}
                onChange={(e) => setRcxPickOriginRStr(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 px-1 py-1 font-mono text-center text-[11px] text-sky-400 rounded focus:border-sky-500/55 hover:border-slate-800 transition"
              />
            </div>
          </div>
          
          {/* Axis Offset Directions for Pick */}
          <div className="grid grid-cols-4 gap-1.5 mt-1 border-t border-slate-800/50 pt-1.5">
            <div className="flex flex-col gap-0.5">
                <span className="text-[7.5px] text-slate-500 text-center uppercase tracking-widest font-mono">X Dir</span>
                <button type="button" onClick={() => setRcxPickSignX(rcxPickSignX === 1 ? -1 : 1)} className={`py-0.5 text-[9px] rounded font-mono ${rcxPickSignX === 1 ? 'bg-sky-500/20 text-sky-300 border border-sky-500/50' : 'bg-slate-800/50 text-slate-400 border border-slate-700'}`}>{rcxPickSignX === 1 ? '+X' : '-X'}</button>
            </div>
            <div className="flex flex-col gap-0.5">
                <span className="text-[7.5px] text-slate-500 text-center uppercase tracking-widest font-mono">Y Dir</span>
                <button type="button" onClick={() => setRcxPickSignY(rcxPickSignY === 1 ? -1 : 1)} className={`py-0.5 text-[9px] rounded font-mono ${rcxPickSignY === 1 ? 'bg-sky-500/20 text-sky-300 border border-sky-500/50' : 'bg-slate-800/50 text-slate-400 border border-slate-700'}`}>{rcxPickSignY === 1 ? '+Y' : '-Y'}</button>
            </div>
            <div className="flex flex-col gap-0.5">
                <span className="text-[7.5px] text-slate-500 text-center uppercase tracking-widest font-mono">Z Dir</span>
                <button type="button" onClick={() => setRcxPickSignZ(rcxPickSignZ === 1 ? -1 : 1)} className={`py-0.5 text-[9px] rounded font-mono ${rcxPickSignZ === 1 ? 'bg-sky-500/20 text-sky-300 border border-sky-500/50' : 'bg-slate-800/50 text-slate-400 border border-slate-700'}`}>{rcxPickSignZ === 1 ? '+Z' : '-Z'}</button>
            </div>
            <div className="col-span-1"></div>
          </div>

          {/* Safe 2-Step Jog Actions */}
          <div className="pt-2 border-t border-slate-900/80 flex gap-1.5">
            <button
              type="button"
              disabled={!isYamahaConnected}
              onClick={onJogToPickOriginXYR}
              title="Align XYR first at safe top height (Z=0)"
              className="flex-1 py-1.5 px-1 text-[9px] font-mono font-bold rounded border transition bg-sky-500/5 hover:bg-sky-500/15 text-sky-400/80 border-sky-500/20 hover:border-sky-500/40 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-1 active:scale-[0.98]"
            >
              <Navigation className="w-2.5 h-2.5 rotate-45" /> 1. Align XYR
            </button>
            <button
              type="button"
              disabled={!isYamahaConnected}
              onClick={onJogToPickOriginFull}
              title="Carefully plunges downward in Z to the Pick Origin"
              className="flex-1 py-1.5 px-1 text-[9px] font-mono font-bold rounded border transition bg-sky-500/20 hover:bg-sky-500/35 text-sky-300 border-sky-500/40 hover:border-sky-500/60 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-1 active:scale-[0.98]"
            >
              🚀 2. Plunge Z
            </button>
          </div>
        </div>

        {/* Physical Pallet Origin Offset */}
        <div className="space-y-2 bg-slate-950/20 p-2.5 rounded border border-slate-900/50">
          <div className="text-[10px] uppercase tracking-wider font-bold text-teal-400 font-mono flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-teal-400 rounded-full"></span>
            Physical Pallet Corner (Ref Point)
          </div>

          <div className="grid grid-cols-4 gap-1.5">
            <div>
              <label className="block text-[8px] text-slate-500 font-mono uppercase mb-0.5 text-center">X (mm)</label>
              <input
                type="text"
                value={rcxPalletOriginXStr}
                onChange={(e) => setRcxPalletOriginXStr(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 px-1 py-1 font-mono text-center text-[11px] text-teal-400 rounded focus:border-teal-500/55 hover:border-slate-800 transition"
              />
            </div>
            <div>
              <label className="block text-[8px] text-slate-500 font-mono uppercase mb-0.5 text-center">Y (mm)</label>
              <input
                type="text"
                value={rcxPalletOriginYStr}
                onChange={(e) => setRcxPalletOriginYStr(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 px-1 py-1 font-mono text-center text-[11px] text-teal-400 rounded focus:border-teal-500/55 hover:border-slate-800 transition"
              />
            </div>
            <div>
              <label className="block text-[8px] text-slate-500 font-mono uppercase mb-0.5 text-center">Z (mm)</label>
              <input
                type="text"
                value={rcxPalletOriginZStr}
                onChange={(e) => setRcxPalletOriginZStr(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 px-1 py-1 font-mono text-center text-[11px] text-teal-400 rounded focus:border-teal-500/55 hover:border-slate-800 transition"
              />
            </div>
            <div>
              <label className="block text-[8px] text-slate-500 font-mono uppercase mb-0.5 text-center">R (deg)</label>
              <input
                type="text"
                value={rcxPalletOriginRStr}
                onChange={(e) => setRcxPalletOriginRStr(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 px-1 py-1 font-mono text-center text-[11px] text-teal-400 rounded focus:border-teal-500/55 hover:border-slate-800 transition"
              />
            </div>
          </div>

          {/* Axis Offset Directions for Place */}
          <div className="grid grid-cols-4 gap-1.5 mt-1 border-t border-slate-800/50 pt-1.5">
            <div className="flex flex-col gap-0.5">
                <span className="text-[7.5px] text-slate-500 text-center uppercase tracking-widest font-mono">X Dir</span>
                <button type="button" onClick={() => setRcxPlaceSignX(rcxPlaceSignX === 1 ? -1 : 1)} className={`py-0.5 text-[9px] rounded font-mono ${rcxPlaceSignX === 1 ? 'bg-teal-500/20 text-teal-300 border border-teal-500/50' : 'bg-slate-800/50 text-slate-400 border border-slate-700'}`}>{rcxPlaceSignX === 1 ? '+X' : '-X'}</button>
            </div>
            <div className="flex flex-col gap-0.5">
                <span className="text-[7.5px] text-slate-500 text-center uppercase tracking-widest font-mono">Y Dir</span>
                <button type="button" onClick={() => setRcxPlaceSignY(rcxPlaceSignY === 1 ? -1 : 1)} className={`py-0.5 text-[9px] rounded font-mono ${rcxPlaceSignY === 1 ? 'bg-teal-500/20 text-teal-300 border border-teal-500/50' : 'bg-slate-800/50 text-slate-400 border border-slate-700'}`}>{rcxPlaceSignY === 1 ? '+Y' : '-Y'}</button>
            </div>
            <div className="flex flex-col gap-0.5">
                <span className="text-[7.5px] text-slate-500 text-center uppercase tracking-widest font-mono">Z Dir</span>
                <button type="button" onClick={() => setRcxPlaceSignZ(rcxPlaceSignZ === 1 ? -1 : 1)} className={`py-0.5 text-[9px] rounded font-mono ${rcxPlaceSignZ === 1 ? 'bg-teal-500/20 text-teal-300 border border-teal-500/50' : 'bg-slate-800/50 text-slate-400 border border-slate-700'}`}>{rcxPlaceSignZ === 1 ? '+Z' : '-Z'}</button>
            </div>
            <div className="col-span-1"></div>
          </div>

          {/* Safe 2-Step Jog Actions */}
          <div className="pt-2 border-t border-slate-900/80 flex gap-1.5">
            <button
              type="button"
              disabled={!isYamahaConnected}
              onClick={onJogToPalletOriginXYR}
              title="Align XYR first at safe top height (Z=0)"
              className="flex-1 py-1.5 px-1 text-[9px] font-mono font-bold rounded border transition bg-teal-500/5 hover:bg-teal-500/15 text-teal-400/80 border-teal-500/20 hover:border-teal-500/40 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-1 active:scale-[0.98]"
            >
              <Navigation className="w-2.5 h-2.5 rotate-45" /> 1. Align XYR
            </button>
            <button
              type="button"
              disabled={!isYamahaConnected}
              onClick={onJogToPalletOriginFull}
              title="Carefully plunges downward in Z to the Pallet Origin"
              className="flex-1 py-1.5 px-1 text-[9px] font-mono font-bold rounded border transition bg-teal-500/20 hover:bg-teal-500/35 text-teal-300 border-teal-500/40 hover:border-teal-500/60 disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-1 active:scale-[0.98]"
            >
              🚀 2. Plunge Z
            </button>
          </div>
        </div>
      </div>

      <div className="pt-4 border-t border-slate-800 grid grid-cols-1 md:grid-cols-6 gap-3">
        <div className="col-span-1">
          <label className="block text-[9.5px] font-bold text-slate-400 font-mono uppercase mb-1">
            Pick Z-Offset (mm)
          </label>
          <input
            type="text"
            value={rcxToolOffsetZStr}
            onChange={(e) => setRcxToolOffsetZStr(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 px-2 py-1.5 text-xs text-slate-300 font-mono rounded focus:border-sky-500/50 hover:border-slate-700 transition"
            placeholder="e.g. 50.0"
          />
        </div>

        <div className="col-span-1">
           <label className="block text-[9.5px] font-bold text-slate-400 font-mono uppercase mb-1">
            Safe Z Movement
           </label>
           <button 
             type="button" 
             onClick={() => setRcxSafeZTravelEnabled(!rcxSafeZTravelEnabled)}
             className={`w-full text-xs font-mono py-1.5 px-2 rounded border transition-colors border-slate-700 ${rcxSafeZTravelEnabled ? "bg-amber-500/20 text-amber-400 border-amber-500/40" : "bg-slate-800/40 text-slate-500"}`}
           >
             {rcxSafeZTravelEnabled ? "Enabled (Z=20)" : "Disabled"}
           </button>
        </div>

        <div className="col-span-1">
          <label className="block text-[9.5px] font-bold text-orange-400 font-mono uppercase mb-1">
            Travel Speed %
          </label>
          <input
            type="number"
            value={rcxTravelSpeedStr}
            onChange={(e) => setRcxTravelSpeedStr(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 px-2 py-1.5 text-xs text-orange-300 font-mono rounded focus:border-orange-500/50 hover:border-slate-700 transition"
            placeholder="e.g. 80"
          />
        </div>

        <div className="col-span-1">
          <label className="block text-[9.5px] font-bold text-rose-400 font-mono uppercase mb-1">
            Plunge Speed %
          </label>
          <input
            type="number"
            value={rcxPlungeSpeedStr}
            onChange={(e) => setRcxPlungeSpeedStr(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 px-2 py-1.5 text-xs text-rose-300 font-mono rounded focus:border-rose-500/50 hover:border-slate-700 transition"
            placeholder="e.g. 20"
          />
        </div>

        <div className="col-span-2">
          <label className="block text-[9.5px] font-bold text-teal-400 font-mono uppercase mb-1">
            Mockup Scale Factor
          </label>
          <input
            type="text"
            value={rcxScaleDownStr}
            onChange={(e) => setRcxScaleDownStr(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 px-2 py-1.5 text-xs text-slate-300 font-mono rounded focus:border-teal-500/50 hover:border-slate-700 transition"
            placeholder="e.g. 0.2"
          />
        </div>

        <div>
          <label className="block text-[9.5px] font-bold text-slate-400 font-mono uppercase mb-1 text-center">
            Conveyor Pick Alignment Target
          </label>
          <div className="flex gap-1.5">
            <button
              type="button"
              onClick={() => setRcxPickAlignmentMode("corner")}
              className={`flex-1 py-1.5 text-[10px] font-mono font-bold rounded border transition ${
                rcxPickAlignmentMode === "corner"
                  ? "bg-sky-500/15 text-sky-450 border-sky-500/40 shadow-sm shadow-sky-950/20"
                  : "bg-slate-950 text-slate-500 border-slate-800/80 hover:text-slate-400"
              }`}
            >
              BOX CORNER
            </button>
            <button
              type="button"
              onClick={() => setRcxPickAlignmentMode("center")}
              className={`flex-1 py-1.5 text-[10px] font-mono font-bold rounded border transition ${
                rcxPickAlignmentMode === "center"
                  ? "bg-sky-500/15 text-sky-450 border-sky-500/40 shadow-sm shadow-sky-950/20"
                  : "bg-slate-950 text-slate-500 border-slate-800/80 hover:text-slate-400"
              }`}
            >
              CENTER COAX
            </button>
          </div>
        </div>
      </div>

      {/* SCARA TCP Rotation Offset & End Effector Collision Simulation */}
      <div className="pt-3 border-t border-slate-800/80 grid grid-cols-1 md:grid-cols-5 gap-3">
        {/* SCARA TCP Tool Rotation Offsets */}
        <div className="col-span-2 bg-slate-950/20 p-2.5 rounded border border-slate-850/50 space-y-2">
          <div className="text-[10px] uppercase tracking-wider font-bold text-orange-400 font-mono flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-orange-400 rounded-full"></span>
            SCARA TCP Offset
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[8px] text-slate-500 font-mono uppercase mb-0.5">X Offset (mm)</label>
              <input
                type="text"
                value={rcxToolOffsetXStr}
                onChange={(e) => setRcxToolOffsetXStr(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 px-2 py-1 text-xs text-orange-300 font-mono rounded focus:border-orange-500/50 hover:border-slate-700 transition"
                placeholder="e.g. 0.0"
              />
            </div>
            <div>
              <label className="block text-[8px] text-slate-500 font-mono uppercase mb-0.5">Y Offset (mm)</label>
              <input
                type="text"
                value={rcxToolOffsetYStr}
                onChange={(e) => setRcxToolOffsetYStr(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 px-2 py-1 text-xs text-orange-300 font-mono rounded focus:border-orange-500/50 hover:border-slate-700 transition"
                placeholder="e.g. 0.0"
              />
            </div>
          </div>
        </div>

        {/* End Effector Dimensions */}
        <div className="col-span-3 bg-slate-950/20 p-2.5 rounded border border-slate-850/50 space-y-2">
          <div className="text-[10px] uppercase tracking-wider font-bold text-amber-450 font-mono flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 bg-amber-450 rounded-full"></span>
            End Effector Dimensions (Collision Sim)
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <label className="block text-[8px] text-slate-500 font-mono uppercase mb-0.5">Length (L, mm)</label>
              <input
                type="text"
                value={rcxEndEffectorLStr}
                onChange={(e) => setRcxEndEffectorLStr(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 px-2 py-1 text-xs text-amber-300 font-mono rounded focus:border-amber-500/50 hover:border-slate-700 transition"
                placeholder="e.g. 80.0"
              />
            </div>
            <div>
              <label className="block text-[8px] text-slate-500 font-mono uppercase mb-0.5">Width (W, mm)</label>
              <input
                type="text"
                value={rcxEndEffectorWStr}
                onChange={(e) => setRcxEndEffectorWStr(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 px-2 py-1 text-xs text-amber-300 font-mono rounded focus:border-amber-500/50 hover:border-slate-700 transition"
                placeholder="e.g. 80.0"
              />
            </div>
            <div>
              <label className="block text-[8px] text-slate-500 font-mono uppercase mb-0.5">Height (H, mm)</label>
              <input
                type="text"
                value={rcxEndEffectorHStr}
                onChange={(e) => setRcxEndEffectorHStr(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 px-2 py-1 text-xs text-amber-300 font-mono rounded focus:border-amber-500/50 hover:border-slate-700 transition"
                placeholder="e.g. 150.0"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="pt-1 flex justify-end">
        <button
          type="button"
          onClick={onSaveConfig}
          className={`px-4 py-2 text-xs font-mono font-bold rounded-lg border transition duration-200 flex items-center gap-2 shadow-md ${
            saveSuccess
              ? "bg-emerald-600/25 hover:bg-emerald-600/35 text-emerald-400 border-emerald-500"
              : "bg-teal-600 hover:bg-teal-500 text-white border-teal-500 hover:scale-[1.01] active:scale-[0.99]"
          }`}
        >
          {saveSuccess ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              SETTINGS SAVED PHYSICALLY!
            </>
          ) : (
            <>
              <Save className="w-3.5 h-3.5" />
              SAVE ROBOT CONFIGURATION
            </>
          )}
        </button>
      </div>
    </div>
  );
}
