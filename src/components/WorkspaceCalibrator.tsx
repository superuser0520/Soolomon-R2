import React from "react";
import { Sliders, HelpCircle } from "lucide-react";

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
  rcxPickAlignmentMode: "corner" | "center";
  setRcxPickAlignmentMode: (v: "corner" | "center") => void;

  rcxScaleDownStr: string;
  setRcxScaleDownStr: (v: string) => void;
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
  rcxPickAlignmentMode, setRcxPickAlignmentMode,
  rcxScaleDownStr, setRcxScaleDownStr
}: WorkspaceCalibratorProps) {
  return (
    <div id="workspace-calibrator-container" className="bg-slate-900/40 border border-slate-800 rounded-lg p-4">
      <div className="flex items-center gap-1.5 mb-3 border-b border-slate-800 pb-2">
        <Sliders className="w-4 h-4 text-sky-400" />
        <span className="text-[11px] font-bold text-slate-200 tracking-wider uppercase font-mono">
          Workspace Hardware Origin Calibrations (mm)
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Conveyor Pickup Point Offset */}
        <div className="space-y-3">
          <div className="text-[10px] uppercase tracking-wider font-bold text-sky-400 font-mono">
            Conveyor Pickup Frame Origin (Ref Point)
          </div>
          <div className="grid grid-cols-4 gap-2">
            <div>
              <label className="block text-[9px] text-slate-500 font-mono uppercase mb-1">X (mm)</label>
              <input
                type="text"
                value={rcxPickOriginXStr}
                onChange={(e) => setRcxPickOriginXStr(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 px-2 py-1 text-xs text-slate-350 rounded focus:border-sky-500/50 hover:border-slate-700 transition"
              />
            </div>
            <div>
              <label className="block text-[9px] text-slate-500 font-mono uppercase mb-1">Y (mm)</label>
              <input
                type="text"
                value={rcxPickOriginYStr}
                onChange={(e) => setRcxPickOriginYStr(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 px-2 py-1 text-xs text-slate-350 rounded focus:border-sky-500/50 hover:border-slate-700 transition"
              />
            </div>
            <div>
              <label className="block text-[9px] text-slate-500 font-mono uppercase mb-1">Z (mm)</label>
              <input
                type="text"
                value={rcxPickOriginZStr}
                onChange={(e) => setRcxPickOriginZStr(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 px-2 py-1 text-xs text-slate-350 rounded focus:border-sky-500/50 hover:border-slate-700 transition"
              />
            </div>
            <div>
              <label className="block text-[9px] text-slate-500 font-mono uppercase mb-1">r (deg)</label>
              <input
                type="text"
                value={rcxPickOriginRStr}
                onChange={(e) => setRcxPickOriginRStr(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 px-2 py-1 text-xs text-slate-350 rounded focus:border-sky-500/50 hover:border-slate-700 transition"
              />
            </div>
          </div>
        </div>

        {/* Physical Pallet Origin Offset */}
        <div className="space-y-3">
          <div className="text-[10px] uppercase tracking-wider font-bold text-teal-400 font-mono">
            Physical Pallet Corner Base Origin (Ref Point)
          </div>
          <div className="grid grid-cols-4 gap-2">
            <div>
              <label className="block text-[9px] text-slate-500 font-mono uppercase mb-1">X (mm)</label>
              <input
                type="text"
                value={rcxPalletOriginXStr}
                onChange={(e) => setRcxPalletOriginXStr(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 px-2 py-1 text-xs text-slate-350 rounded focus:border-teal-500/50 hover:border-slate-700 transition"
              />
            </div>
            <div>
              <label className="block text-[9px] text-slate-500 font-mono uppercase mb-1">Y (mm)</label>
              <input
                type="text"
                value={rcxPalletOriginYStr}
                onChange={(e) => setRcxPalletOriginYStr(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 px-2 py-1 text-xs text-slate-350 rounded focus:border-teal-500/50 hover:border-slate-700 transition"
              />
            </div>
            <div>
              <label className="block text-[9px] text-slate-500 font-mono uppercase mb-1">Z (mm)</label>
              <input
                type="text"
                value={rcxPalletOriginZStr}
                onChange={(e) => setRcxPalletOriginZStr(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 px-2 py-1 text-xs text-slate-350 rounded focus:border-teal-500/50 hover:border-slate-700 transition"
              />
            </div>
            <div>
              <label className="block text-[9px] text-slate-500 font-mono uppercase mb-1">r (deg)</label>
              <input
                type="text"
                value={rcxPalletOriginRStr}
                onChange={(e) => setRcxPalletOriginRStr(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 px-2 py-1 text-xs text-slate-350 rounded focus:border-teal-500/50 hover:border-slate-700 transition"
              />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-slate-800 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-[10px] font-bold text-slate-400 font-mono uppercase mb-1">
            Pick Tool Z-Offset Extension (mm)
          </label>
          <input
            type="text"
            value={rcxToolOffsetZStr}
            onChange={(e) => setRcxToolOffsetZStr(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 px-2 py-1.5 text-xs text-slate-350 rounded focus:border-sky-500/50 hover:border-slate-700 transition"
            placeholder="e.g. 50.0"
          />
          <p className="text-[9px] text-slate-500 mt-1 font-mono">
            Safety vertical safety margins of tool end-effector logic.
          </p>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-teal-400 font-mono uppercase mb-1">
            Mockup Scale Factor
          </label>
          <input
            type="text"
            value={rcxScaleDownStr}
            onChange={(e) => setRcxScaleDownStr(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 px-2 py-1.5 text-xs text-slate-350 rounded focus:border-teal-500/50 hover:border-slate-700 transition"
            placeholder="e.g. 0.2"
          />
          <p className="text-[9px] text-slate-500 mt-1 font-mono">
            Downscales carton sizes & layout coordinates for testing. E.g. 0.2 is 1:5 scale. Keep 1.0 for 1:1.
          </p>
        </div>

        <div>
          <label className="block text-[10px] font-bold text-slate-400 font-mono uppercase mb-1">
            Conveyor Pick Alignment Target Plane
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setRcxPickAlignmentMode("corner")}
              className={`flex-1 py-1.5 text-xs font-mono font-bold rounded border transition ${
                rcxPickAlignmentMode === "corner"
                  ? "bg-sky-500/20 text-sky-400 border-sky-500/50"
                  : "bg-slate-950 text-slate-500 border-slate-800 hover:text-slate-400"
              }`}
            >
              BOX CORNER
            </button>
            <button
              type="button"
              onClick={() => setRcxPickAlignmentMode("center")}
              className={`flex-1 py-1.5 text-xs font-mono font-bold rounded border transition ${
                rcxPickAlignmentMode === "center"
                  ? "bg-sky-500/20 text-sky-400 border-sky-500/50"
                  : "bg-slate-950 text-slate-500 border-slate-800 hover:text-slate-400"
              }`}
            >
              CENTER COAX
            </button>
          </div>
          <p className="text-[9px] text-slate-500 mt-1 font-mono">
            Dictates whether pickup gripper offsets coordinates to carton edges or geometric centroid.
          </p>
        </div>
      </div>
    </div>
  );
}
