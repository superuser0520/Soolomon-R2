import React from 'react';
import { Play, Power, PowerOff, AlertCircle, RefreshCw, Hand, Lock, Camera, Wand2, Crosshair, ArrowDownToLine, Box } from 'lucide-react';
import { PackingResult } from '../types';

interface TouchHMIProps {
  isYamahaConnected: boolean;
  onSendCmd: (cmd: string) => void;
  onInterrupt: () => void;
  onTriggerScan: () => void;
  onSimulateScan: () => void;
  onJogToPickOriginXYR: () => void;
  onJogToPickOriginFull: () => void;
  onJogToPlaceOriginXYR: () => void;
  onJogToPlaceOriginFull: () => void;
  activePalletIndex: number;
  simulationResults: PackingResult[];
}

export default function TouchHMI({ 
  isYamahaConnected, 
  onSendCmd, 
  onInterrupt, 
  onTriggerScan, 
  onSimulateScan,
  onJogToPickOriginXYR,
  onJogToPickOriginFull,
  onJogToPlaceOriginXYR,
  onJogToPlaceOriginFull,
  activePalletIndex,
  simulationResults
}: TouchHMIProps) {
  const activePallet = simulationResults[activePalletIndex];
  const totalBoxes = activePallet?.placedBoxes.length || 0;

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-[#1A1A1D] p-6 lg:p-12 text-white overflow-y-auto">
      <div className="flex items-center justify-between border-b border-slate-800 pb-6 mb-8 shrink-0">
        <div>
          <h1 className="text-3xl font-bold text-slate-100 flex items-center gap-3">
            <Hand className="w-8 h-8 text-sky-400" /> Operator HMI
          </h1>
          <p className="text-slate-500 mt-2 text-lg">Machine Control Panel</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          {activePallet && (
             <div className="bg-slate-800 border border-slate-700 px-4 py-2 rounded-lg flex items-center gap-3 text-sm font-mono text-slate-300 shadow-md">
               <Box className="w-4 h-4 text-sky-400" />
               <span>Pallet <span className="text-white font-bold">{activePalletIndex + 1}</span></span>
               <span className="text-slate-500">/</span>
               <span>Boxes: <span className="text-teal-400 font-bold">{totalBoxes}</span></span>
             </div>
          )}
          <div className={`px-4 py-2 rounded-full font-bold text-sm tracking-wide border flex items-center gap-2 ${isYamahaConnected ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30" : "bg-red-500/10 text-red-500 border-red-500/30"}`}>
            <span className={`w-3 h-3 rounded-full ${isYamahaConnected ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]' : 'bg-red-500'}`} />
            {isYamahaConnected ? "ROBOT ONLINE" : "ROBOT OFFLINE"}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-5xl mx-auto w-full pb-12">
        <button
          onClick={() => {
            onTriggerScan();
            setTimeout(() => onSendCmd("@RUN"), 1500);
          }}
          className="col-span-1 md:col-span-2 bg-gradient-to-br from-indigo-600 to-indigo-800 hover:from-indigo-500 hover:to-indigo-700 text-white font-bold text-3xl py-14 rounded-2xl shadow-lg border-2 border-indigo-400/30 hover:scale-[1.02] active:scale-[0.98] transition-transform flex flex-col items-center justify-center gap-4 animate-pulse relative overflow-hidden"
        >
          <Camera className="w-20 h-20" />
          AUTO: SCAN && START JOB
          {activePallet && (
            <div className="absolute bottom-4 text-indigo-200 text-base font-mono bg-black/20 px-4 py-1.5 rounded-full border border-indigo-300/20">
              Ready to pack {totalBoxes} items on Pallet {activePalletIndex + 1}
            </div>
          )}
        </button>

        <button
          onClick={onTriggerScan}
          className="bg-slate-800 hover:bg-slate-700 text-white font-bold text-xl py-10 rounded-2xl shadow-lg border border-slate-700/50 hover:scale-[1.02] active:scale-[0.98] transition-transform flex flex-col items-center justify-center gap-3"
        >
          <Camera className="w-12 h-12 text-indigo-400" />
          TRIGGER CAMERA SCAN
        </button>

        <button
          onClick={onSimulateScan}
          className="bg-slate-800 hover:bg-slate-700 text-white font-bold text-xl py-10 rounded-2xl shadow-lg border border-slate-700/50 hover:scale-[1.02] active:scale-[0.98] transition-transform flex flex-col items-center justify-center gap-3"
        >
          <Wand2 className="w-12 h-12 text-teal-400" />
          SIMULATE BOX SCAN (MOCK)
        </button>

        {/* --- Robotic Setup & Jogging area --- */}
        <div className="col-span-1 md:col-span-2 bg-slate-800/50 border border-slate-700 rounded-2xl p-6 shadow-inner my-2">
          <h2 className="text-xl font-bold text-slate-300 flex items-center gap-2 mb-4 border-b border-slate-700/50 pb-3">
            <Crosshair className="w-5 h-5" /> Manual Jog & Alignment Setup
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <h3 className="text-sm font-bold text-slate-400 mb-3 text-center">PICK ORIGIN</h3>
              <div className="flex flex-col gap-3">
                <button
                  onClick={onJogToPickOriginXYR}
                  className="bg-[#1C1C1E] hover:bg-[#2C2C2E] border border-slate-700 text-slate-300 font-bold py-4 rounded-lg transition-transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  <Crosshair className="w-5 h-5 text-orange-400" /> ALIGN XYR
                </button>
                <button
                  onClick={onJogToPickOriginFull}
                  className="bg-[#1C1C1E] hover:bg-[#2C2C2E] border border-slate-700 text-slate-300 font-bold py-4 rounded-lg transition-transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  <ArrowDownToLine className="w-5 h-5 text-red-400" /> PLUNGE Z FULL
                </button>
              </div>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <h3 className="text-sm font-bold text-slate-400 mb-3 text-center">PLACE ORIGIN</h3>
              <div className="flex flex-col gap-3">
                <button
                  onClick={onJogToPlaceOriginXYR}
                  className="bg-[#1C1C1E] hover:bg-[#2C2C2E] border border-slate-700 text-slate-300 font-bold py-4 rounded-lg transition-transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  <Crosshair className="w-5 h-5 text-sky-400" /> ALIGN XYR
                </button>
                <button
                  onClick={onJogToPlaceOriginFull}
                  className="bg-[#1C1C1E] hover:bg-[#2C2C2E] border border-slate-700 text-slate-300 font-bold py-4 rounded-lg transition-transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
                >
                  <ArrowDownToLine className="w-5 h-5 text-red-500" /> PLUNGE Z FULL
                </button>
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={() => onSendCmd("@SERVO ON")}
          className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-2xl py-14 rounded-2xl shadow-lg border-2 border-emerald-400/20 hover:scale-[1.02] active:scale-[0.98] transition-transform flex flex-col items-center justify-center gap-4"
        >
          <Power className="w-16 h-16" />
          SERVO ON
        </button>

        <button
          onClick={() => onSendCmd("@SERVO OFF")}
          className="bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-2xl py-14 rounded-2xl shadow-lg border-2 border-slate-700/50 hover:scale-[1.02] active:scale-[0.98] transition-transform flex flex-col items-center justify-center gap-4"
        >
          <PowerOff className="w-16 h-16 text-slate-400" />
          SERVO OFF
        </button>

        <button
          onClick={() => onSendCmd("@RUN")}
          className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-2xl py-14 rounded-2xl shadow-lg border-2 border-blue-400/20 hover:scale-[1.02] active:scale-[0.98] transition-transform flex flex-col items-center justify-center gap-4"
        >
          <Play className="w-16 h-16" />
          START PROGRAM (RUN)
        </button>

        <button
          onClick={() => onSendCmd("@STOP")}
          className="bg-orange-600 hover:bg-orange-500 text-white font-bold text-2xl py-14 rounded-2xl shadow-lg border-2 border-orange-400/20 hover:scale-[1.02] active:scale-[0.98] transition-transform flex flex-col items-center justify-center gap-4"
        >
          <Hand className="w-16 h-16" />
          PAUSE (STOP)
        </button>

        <button
          onClick={() => onSendCmd("@RESET")}
          className="bg-slate-700 hover:bg-slate-600 text-white font-bold text-xl py-10 rounded-2xl shadow-lg border-2 border-slate-600/50 hover:scale-[1.02] active:scale-[0.98] transition-transform flex flex-col items-center justify-center gap-3"
        >
          <RefreshCw className="w-10 h-10" />
          RESET PROGRAM POINTER
        </button>

        <button
          onClick={() => onSendCmd("@ALMRST")}
          className="bg-purple-600 hover:bg-purple-500 text-white font-bold text-xl py-10 rounded-2xl shadow-lg border-2 border-purple-400/20 hover:scale-[1.02] active:scale-[0.98] transition-transform flex flex-col items-center justify-center gap-3"
        >
          <AlertCircle className="w-10 h-10" />
          CLEAR ALARMS
        </button>

        <button
          onClick={onInterrupt}
          className="col-span-1 md:col-span-2 bg-red-600 hover:bg-red-500 text-white font-bold text-3xl py-16 rounded-2xl shadow-lg border-2 border-red-500/50 hover:scale-[1.02] active:scale-[0.98] transition-transform flex items-center justify-center gap-6 mt-4"
        >
          <Lock className="w-16 h-16" />
          EMERGENCY HALT (^C)
        </button>
      </div>
    </div>
  );
}

