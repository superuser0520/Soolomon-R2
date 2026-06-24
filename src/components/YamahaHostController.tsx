import React, { useState, useEffect, useRef } from "react";
import { Activity, Power, PowerOff, ShieldAlert, Cpu, CheckCircle2, Play, CircleStop, RefreshCw, Send, Terminal, LogOut, PackageOpen, LayoutGrid, CheckSquare } from "lucide-react";
import { PackingResult, CartonType } from "../types";

interface YamahaHostControllerProps {
  executionMode: "production" | "mockup";
  simulationResult?: PackingResult;
  selectedYamahaStepIndex?: number;
  setSelectedYamahaStepIndex?: (index: number) => void;
  cartons?: CartonType[];
  
  rcxPickOriginX?: number;
  rcxPickOriginY?: number;
  rcxPickOriginZ?: number;
  rcxPickOriginR?: number;
  
  rcxPalletOriginX?: number;
  rcxPalletOriginY?: number;
  rcxPalletOriginZ?: number;
  rcxPalletOriginR?: number;
  
  rcxToolOffsetZ?: number;
  rcxPickAlignmentMode?: "corner" | "center";
  rcxScaleDown?: number;

  rcxPickSignX?: number;
  rcxPickSignY?: number;
  rcxPickSignZ?: number;
  rcxPlaceSignX?: number;
  rcxPlaceSignY?: number;
  rcxPlaceSignZ?: number;
  rcxSafeZTravelEnabled?: boolean;

  rcxToolOffsetX?: number;
  rcxToolOffsetY?: number;

  isYamahaConnected: boolean;
  setIsYamahaConnected: (v: boolean) => void;
}

export default function YamahaHostController({ 
  executionMode,
  simulationResult,
  selectedYamahaStepIndex,
  setSelectedYamahaStepIndex,
  cartons,
  rcxPickOriginX,
  rcxPickOriginY,
  rcxPickOriginZ,
  rcxPickOriginR,
  rcxPalletOriginX,
  rcxPalletOriginY,
  rcxPalletOriginZ,
  rcxPalletOriginR,
  rcxToolOffsetZ,
  rcxPickAlignmentMode,
  rcxScaleDown,
  rcxPickSignX = -1,
  rcxPickSignY = 1,
  rcxPickSignZ = -1,
  rcxPlaceSignX = -1,
  rcxPlaceSignY = -1,
  rcxPlaceSignZ = -1,
  rcxSafeZTravelEnabled = true,
  rcxToolOffsetX = 0,
  rcxToolOffsetY = 0,
  isYamahaConnected,
  setIsYamahaConnected
}: YamahaHostControllerProps) {
  const [robotIp, setRobotIp] = useState(() => localStorage.getItem("yamaha_robotIp") || "192.168.0.2");
  const [robotPort, setRobotPort] = useState(() => localStorage.getItem("yamaha_robotPort") || "23");
  const [pollIntervalMs, setPollIntervalMs] = useState(() => localStorage.getItem("yamaha_pollIntervalMs") || "1000");
  const [robotNumber, setRobotNumber] = useState(() => localStorage.getItem("yamaha_robotNumber") || "1");
  
  // Status states
  const [modeText, setModeText] = useState("Unknown");
  const [servoStatus, setServoStatus] = useState("Unknown");
  const [originStatus, setOriginStatus] = useState("Unknown");
  const [emergencyStatus, setEmergencyStatus] = useState("Unknown");
  const [alarmCode, setAlarmCode] = useState("No Alarm");
  const [currentPosition, setCurrentPosition] = useState("X:0 Y:0 Z:0 R:0");
  
  // Logs
  const [logs, setLogs] = useState<{ time: string; msg: string; type: string }[]>([]);

  // Coordinate form
  const [moveX, setMoveX] = useState("0");
  const [moveY, setMoveY] = useState("0");
  const [moveZ, setMoveZ] = useState("0");
  const [moveR, setMoveR] = useState("0");
  const [moveSpeed, setMoveSpeed] = useState("20");

  const [rawCommand, setRawCommand] = useState("");

  const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchStatusLogs = async () => {
    try {
      const res = await fetch("/api/yamaha/status");
      const json = await res.json();
      setIsYamahaConnected(json.isConnected);
      setLogs(json.logs || []);
    } catch (e) {}
  };

  useEffect(() => {
    const int = setInterval(fetchStatusLogs, 1000);
    return () => clearInterval(int);
  }, []);

  const startPolling = () => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    pollIntervalRef.current = setInterval(async () => {
       await sendCmd("@?MODE", false, true);
       await sendCmd("@?ALM", false, true);
       await sendCmd("@?EMG", false, true);
       await sendCmd(`@?SERVO[${robotNumber}]`, false, true);
       await sendCmd("@?WHRXY", false, true);
       await sendCmd(`@?ORIGIN ${robotNumber}`, false, true);
    }, parseInt(pollIntervalMs) || 1000);
  };

  const stopPolling = () => {
    if (pollIntervalRef.current) clearInterval(pollIntervalRef.current);
    pollIntervalRef.current = null;
  };

  useEffect(() => {
    if (isYamahaConnected) {
      startPolling();
    } else {
      stopPolling();
    }
    return () => stopPolling();
  }, [isYamahaConnected, pollIntervalMs, robotNumber]);

  const connect = async () => {
    await fetch("/api/yamaha/connect", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ host: robotIp, port: robotPort, mockMode: executionMode === "mockup" })
    });
    fetchStatusLogs();
  };

  const disconnect = async () => {
    await fetch("/api/yamaha/disconnect", { method: "POST" });
    fetchStatusLogs();
  };

  const sendCmd = async (cmd: string, isCtrlC = false, quiet = false) => {
    try {
      const res = await fetch("/api/yamaha/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cmd, isCtrlC })
      });
      const data = await res.json();
      if (data.status === "success" && !quiet) {
         // handle manually if needed
      }

      // Quick parse response
      if (data.response) {
         const lines = data.response.split("\\n").map((l: string) => l.trim()).filter((l: string) => l);
         const resVal = lines.length > 1 ? lines[0] : "";
         
         if (cmd.startsWith("@?MODE")) {
            if (resVal === "1") setModeText("Manual mode");
            else if (resVal === "2") setModeText("Ready for external control");
            else if (resVal === "3") setModeText("Pendant has control");
         } else if (cmd.startsWith("@?ALM")) {
            if (resVal === "0" || resVal === "") setAlarmCode("No alarm");
            else setAlarmCode(`Alarm code: ${resVal}`);
         } else if (cmd.startsWith("@?EMG")) {
            setEmergencyStatus(resVal === "1" ? "Emergency stop active" : "Normal");
         } else if (cmd.startsWith("@?SERVO")) {
            setServoStatus(resVal === "1" ? "Robot power on" : "Servo off");
         } else if (cmd.startsWith("@?WHRXY")) {
            const parts = resVal.split(/\s+/);
            if (parts.length >= 4) {
               setCurrentPosition(`X:${parts[0]} Y:${parts[1]} Z:${parts[2]} R:${parts[3]}`);
            }
         } else if (cmd.startsWith("@?ORIGIN")) {
            setOriginStatus(resVal === "1" ? "Home completed" : "Needs homing");
         }
      }
      return data;
    } catch (e) {
      console.error(e);
    }
  };

  const [pendingCommand, setPendingCommand] = useState<{msg: string, cmd: string, isCtrlC: boolean} | null>(null);

  const confirmAndSend = async (msg: string, cmd: string, isCtrlC = false) => {
    setPendingCommand({ msg, cmd, isCtrlC });
  };

  const executePendingCommand = async () => {
    if (pendingCommand) {
      await sendCmd(pendingCommand.cmd, pendingCommand.isCtrlC);
      setPendingCommand(null);
    }
  };

  const [formError, setFormError] = useState<string | null>(null);

  const sendCoordinateMove = () => {
    setFormError(null);
    const s = parseInt(moveSpeed);
    if (s < 1 || s > 100) return setFormError("Speed must be 1 to 100.");
    if (isNaN(parseFloat(moveX)) || isNaN(parseFloat(moveY)) || isNaN(parseFloat(moveZ)) || isNaN(parseFloat(moveR))) {
      return setFormError("Coordinates must be valid numbers.");
    }
    const cmd = `@MOVE[${robotNumber}] P, ${parseFloat(moveX).toFixed(3)} ${parseFloat(moveY).toFixed(3)} ${parseFloat(moveZ).toFixed(3)} ${parseFloat(moveR).toFixed(3)} 0.000 0.000, S=${s}`;
    confirmAndSend(`Are you sure you want to move the robot to X:${moveX} Y:${moveY} Z:${moveZ} R:${moveR} at Speed:${s}?`, cmd);
  };

  return (
    <div className="flex flex-col gap-4 text-sm text-slate-300 font-sans relative">
      {pendingCommand && (
        <div className="absolute inset-0 bg-black/60 z-50 flex items-center justify-center p-4 rounded-xl backdrop-blur-sm">
          <div className="bg-[#1C1C1E] border border-red-500/50 p-6 rounded-xl shadow-2xl max-w-md w-full">
             <div className="flex items-center gap-3 text-red-400 mb-4">
               <ShieldAlert className="w-8 h-8" />
               <h3 className="font-bold text-lg">Confirm Action</h3>
             </div>
             <p className="text-white mb-2">{pendingCommand.msg}</p>
             <p className="text-sm text-slate-400 mb-6 bg-black/30 p-2 rounded border border-slate-800 font-mono break-all pb-3">
               Command: <span className="text-amber-400">{pendingCommand.isCtrlC ? "^C" : pendingCommand.cmd}</span>
             </p>
             <p className="text-red-400 font-bold text-sm mb-6 bg-red-400/10 p-2 rounded">
               Verify that the robot area is clear before proceeding!
             </p>
             <div className="flex gap-3 justify-end mt-4">
               <button onClick={() => setPendingCommand(null)} className="px-4 py-2 rounded font-bold bg-slate-800 text-slate-300 hover:bg-slate-700 transition">Cancel</button>
               <button onClick={executePendingCommand} className="px-4 py-2 rounded font-bold bg-red-600 text-white hover:bg-red-500 transition shadow-[0_0_15px_rgba(220,38,38,0.5)]">Execute Action</button>
             </div>
          </div>
        </div>
      )}

      <div className="bg-red-500/10 border border-red-500/30 p-3 rounded-lg text-red-400 flex items-start gap-3">
         <ShieldAlert className="w-5 h-5 flex-shrink-0 mt-0.5" />
         <div>
            <h4 className="font-bold text-red-400">WARNING: Operator Aids Only</h4>
            <p className="text-xs leading-relaxed mt-1 text-red-300/80">
              Software controls do not replace the physical emergency stop.
              The physical emergency stop and safety circuit must remain hard-wired and validated.
              Coordinate moves must require operator confirmation that the robot area is clear.
            </p>
         </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Connection Panel */}
        <div className="bg-[#121212] border border-[#2A2A2E] rounded-xl p-4">
          <div className="flex items-center justify-between mb-4">
             <h3 className="text-white font-semibold flex items-center gap-2"><Activity className="w-4 h-4 text-teal-400"/> Connection Settings</h3>
             <span className={`px-2 py-0.5 rounded text-xs font-bold ${isYamahaConnected ? "bg-teal-500/20 text-teal-400" : "bg-slate-800 text-slate-500"}`}>
               {isYamahaConnected ? "App connected to robot" : "Not connected"}
             </span>
          </div>
          <div className="grid grid-cols-2 gap-3 mb-4">
             <div>
               <label className="block text-xs text-slate-500 mb-1">Controller IP</label>
               <input disabled={isYamahaConnected} value={robotIp} onChange={(e) => { const v = e.target.value; setRobotIp(v); localStorage.setItem("yamaha_robotIp", v); }} type="text" className="w-full bg-[#1A1A1D] border border-slate-700/50 rounded px-2 py-1 text-white font-mono text-xs" />
             </div>
             <div>
               <label className="block text-xs text-slate-500 mb-1">TCP Port</label>
               <input disabled={isYamahaConnected} value={robotPort} onChange={(e) => { const v = e.target.value; setRobotPort(v); localStorage.setItem("yamaha_robotPort", v); }} type="text" className="w-full bg-[#1A1A1D] border border-slate-700/50 rounded px-2 py-1 text-white font-mono text-xs" />
             </div>
             <div>
               <label className="block text-xs text-slate-500 mb-1">Robot Number</label>
               <input disabled={isYamahaConnected} value={robotNumber} onChange={(e) => { const v = e.target.value; setRobotNumber(v); localStorage.setItem("yamaha_robotNumber", v); }} type="number" min="1" max="4" className="w-full bg-[#1A1A1D] border border-slate-700/50 rounded px-2 py-1 text-white font-mono text-xs" />
             </div>
             <div>
               <label className="block text-xs text-slate-500 mb-1">Poll Interval (ms)</label>
               <input value={pollIntervalMs} onChange={(e) => { const v = e.target.value; setPollIntervalMs(v); localStorage.setItem("yamaha_pollIntervalMs", v); }} type="number" min="100" className="w-full bg-[#1A1A1D] border border-slate-700/50 rounded px-2 py-1 text-white font-mono text-xs" />
             </div>
          </div>
          {isYamahaConnected ? (
             <button onClick={disconnect} className="w-full bg-red-600/20 hover:bg-red-600/30 text-red-500 border border-red-600/30 font-semibold py-1.5 rounded transition">Disconnect Controller</button>
          ) : (
             <button onClick={connect} className="w-full bg-teal-600 hover:bg-teal-500 text-white font-semibold py-1.5 rounded transition shadow-lg shadow-teal-900/50">Connect to RCX340</button>
          )}
        </div>

        {/* Live Status */}
        <div className="bg-[#121212] border border-[#2A2A2E] rounded-xl p-4">
          <h3 className="text-white font-semibold flex items-center gap-2 mb-4"><Cpu className="w-4 h-4 text-purple-400"/> Live Status Monitor</h3>
          <div className="grid grid-cols-2 gap-x-4 gap-y-3 text-xs">
             <div><span className="text-slate-500 block">Mode</span><span className="text-white font-mono">{modeText}</span></div>
             <div><span className="text-slate-500 block">Servo</span><span className="text-white font-mono">{servoStatus}</span></div>
             <div><span className="text-slate-500 block">Origin</span><span className="text-white font-mono">{originStatus}</span></div>
             <div><span className="text-slate-500 block">Emergency</span><span className={emergencyStatus === "Normal" ? "text-teal-400 font-mono" : "text-red-400 font-bold font-mono"}>{emergencyStatus}</span></div>
             <div><span className="text-slate-500 block">Alarm</span><span className={alarmCode === "No alarm" ? "text-teal-400 font-mono" : "text-red-400 font-bold font-mono"}>{alarmCode}</span></div>
             <div className="col-span-2 mt-1"><span className="text-slate-500 block">Position (WHRXY)</span><span className="text-teal-300 font-mono text-sm bg-teal-900/20 px-2 py-1 rounded inline-block mt-1">{currentPosition}</span></div>
          </div>
        </div>
      </div>

      {isYamahaConnected && (
         <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            
            {/* Safety Commands */}
            <div className="bg-[#121212] border border-[#2A2A2E] rounded-xl p-4">
               <h3 className="text-white font-semibold mb-4 text-sm flex items-center gap-2">Operator Safety & Run Controls</h3>
               
               <div className="grid grid-cols-2 gap-3 mb-4">
                 <button onClick={() => confirmAndSend("Interrupt ACTIVE ongoing motion?", "", true)} className="bg-red-500/20 hover:bg-red-500/30 text-red-500 border border-red-500/50 py-2 rounded font-bold text-xs flex items-center justify-center gap-2">
                    ^C (Break Motion)
                 </button>
                 <button onClick={() => confirmAndSend("Pause running program?", "@STOP")} className="bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 border border-orange-500/50 py-2 rounded font-bold text-xs flex items-center justify-center gap-2">
                    <CircleStop className="w-3.5 h-3.5"/> @STOP Program
                 </button>
               </div>

               <div className="grid grid-cols-2 gap-3 mb-4">
                 <button onClick={() => confirmAndSend("Turn Servo ON?", "@SERVO ON")} className="bg-teal-500/20 hover:bg-teal-500/30 text-teal-400 border border-teal-500/50 py-1.5 rounded font-bold text-xs flex items-center justify-center gap-2">
                    <Power className="w-3.5 h-3.5"/> @SERVO ON
                 </button>
                 <button onClick={() => confirmAndSend("Turn Servo OFF?", "@SERVO OFF")} className="bg-slate-700/50 hover:bg-slate-700 text-slate-300 border border-slate-600 py-1.5 rounded font-bold text-xs flex items-center justify-center gap-2">
                    <PowerOff className="w-3.5 h-3.5"/> @SERVO OFF
                 </button>

                 <button onClick={() => confirmAndSend("Run current robot program?", "@RUN")} className="bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border border-blue-500/50 py-1.5 rounded font-bold text-xs flex items-center justify-center gap-2">
                    <Play className="w-3.5 h-3.5"/> @RUN
                 </button>
                 <button onClick={() => confirmAndSend("Reset running program to line 1?", "@RESET")} className="bg-slate-700/50 hover:bg-slate-700 text-slate-300 border border-slate-600 py-1.5 rounded font-bold text-xs flex items-center justify-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5"/> @RESET
                 </button>

                 <button onClick={() => confirmAndSend("Return to mechanical origin?", `@ORGRTN[${robotNumber}]`)} className="bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 border border-purple-500/50 py-1.5 rounded font-bold text-xs flex items-center justify-center gap-2 col-span-2">
                    @ORGRTN (Home Robot)
                 </button>
               </div>

               <div className="pt-3 border-t border-[#2A2A2E]">
                  <button onClick={() => confirmAndSend("Clear alarm state?", "@ALMRST")} className="w-full bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 border border-emerald-500/50 py-1.5 rounded font-bold text-xs flex items-center justify-center gap-2">
                     <CheckCircle2 className="w-3.5 h-3.5"/> @ALMRST (Clear Alarm)
                  </button>
               </div>
            </div>

            <div className="flex flex-col gap-4">
              {/* Coordinate Movement */}
              <div className="bg-[#121212] border border-[#2A2A2E] rounded-xl p-4">
                <h3 className="text-white font-semibold mb-3 text-sm flex items-center gap-2">PTP Coordinate Move</h3>
                {formError && <div className="text-red-400 text-xs mb-2 bg-red-400/10 p-2 rounded">{formError}</div>}
                <div className="grid grid-cols-5 gap-2 mb-3">
                  <div>
                    <label className="text-[10px] uppercase text-slate-500 font-bold">X</label>
                    <input type="number" value={moveX} onChange={e => setMoveX(e.target.value)} className="w-full bg-[#1A1A1D] border border-slate-700/50 rounded px-1.5 py-1 text-white font-mono text-xs" />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase text-slate-500 font-bold">Y</label>
                    <input type="number" value={moveY} onChange={e => setMoveY(e.target.value)} className="w-full bg-[#1A1A1D] border border-slate-700/50 rounded px-1.5 py-1 text-white font-mono text-xs" />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase text-slate-500 font-bold">Z</label>
                    <input type="number" value={moveZ} onChange={e => setMoveZ(e.target.value)} className="w-full bg-[#1A1A1D] border border-slate-700/50 rounded px-1.5 py-1 text-white font-mono text-xs" />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase text-slate-500 font-bold">R</label>
                    <input type="number" value={moveR} onChange={e => setMoveR(e.target.value)} className="w-full bg-[#1A1A1D] border border-slate-700/50 rounded px-1.5 py-1 text-white font-mono text-xs" />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase text-teal-500 font-bold">Speed</label>
                    <input type="number" min="1" max="100" value={moveSpeed} onChange={e => setMoveSpeed(e.target.value)} className="w-full bg-[#1A1A1D] border-b-2 border-teal-500/50 rounded px-1.5 py-1 text-white font-mono text-xs" />
                  </div>
                </div>
                <button onClick={sendCoordinateMove} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 rounded text-xs transition flex items-center justify-center gap-2">
                  <Send className="w-3.5 h-3.5"/> Execute @MOVE PTP
                </button>
              </div>

              {/* Raw Online Command */}
              <div className="bg-[#121212] border border-[#2A2A2E] rounded-xl p-4 flex-grow flex flex-col">
                <h3 className="text-white font-semibold mb-3 text-sm flex items-center gap-2">Advanced: Raw Online Command</h3>
                <div className="flex gap-2">
                  <input type="text" placeholder="@?VER" value={rawCommand} onChange={e => setRawCommand(e.target.value)} className="flex-grow bg-[#1A1A1D] border border-slate-700/50 rounded px-2 py-1.5 text-white font-mono text-xs" />
                  <button onClick={() => confirmAndSend("Send raw online command?", rawCommand)} className="bg-slate-700 hover:bg-slate-600 text-white px-3 py-1.5 rounded text-xs font-bold transition">Send</button>
                </div>
                <div className="mt-2 flex flex-wrap gap-1.5">
                   {["@?MODE", "@?ALM", "@?WHRXY", "@STOP", "@ALMRST", "@SERVO ON", "@SERVO OFF"].map(t => (
                     <button key={t} onClick={() => setRawCommand(t)} className="bg-slate-800/80 hover:bg-slate-700 text-[10px] text-slate-300 px-2 py-1 rounded font-mono transition">
                       {t}
                     </button>
                   ))}
                </div>
              </div>
            </div>
         </div>
      )}

      {/* Coordinate Sequence View */}
      {simulationResult && cartons && (
         <div className="bg-[#121212] border border-[#2A2A2E] rounded-xl p-0 overflow-hidden mt-4">
           <div className="bg-[#1A1A1D] px-4 py-3 border-b border-[#2A2A2E] flex justify-between items-center">
             <div className="text-sm font-semibold text-slate-300 flex items-center gap-2">
               <CheckSquare className="w-4 h-4 text-emerald-400"/>
               Computed Coordinate Path Sequence
             </div>
           </div>
           
           <div className="p-4">
              <div className="text-xs text-slate-400 mb-3">
                 The following coordinate path has been computed by the Palletizing Engine. You can execute these movements on the RCX340. 
                 Speeds are set low (20%) for safety. 
              </div>
              <div className="overflow-x-auto">
                 <table className="w-full text-left border-collapse">
                   <thead>
                     <tr className="bg-slate-800/40 text-[10px] uppercase text-slate-500 font-mono">
                        <th className="p-2 border-b border-slate-800">Step</th>
                        <th className="p-2 border-b border-slate-800">Operation</th>
                        <th className="p-2 border-b border-slate-800">Carton</th>
                        <th className="p-2 border-b border-slate-800">Coordinates (X,Y,Z,R)</th>
                        <th className="p-2 border-b border-slate-800 text-right">Action</th>
                     </tr>
                   </thead>
                   <tbody className="text-xs font-mono">
                     {simulationResult.placedBoxes?.map((bx, i) => {
                        const carton = cartons.find(c => c.id === bx.typeId);
                        const pickX_offset = rcxPickAlignmentMode === "corner" ? bx.l / 2 : 0;
                        const pickY_offset = rcxPickAlignmentMode === "corner" ? bx.w / 2 : 0;
                        
                        const sx = rcxScaleDown || 1.0;

                        // Pick Coordinate
                        // SCARA TCP pick rotation offset
                        const thetaPick = ((rcxPickOriginR || 0) * Math.PI) / 180;
                        const tcpPickX = (rcxToolOffsetX || 0) * Math.cos(thetaPick) - (rcxToolOffsetY || 0) * Math.sin(thetaPick);
                        const tcpPickY = (rcxToolOffsetX || 0) * Math.sin(thetaPick) + (rcxToolOffsetY || 0) * Math.cos(thetaPick);

                        const px = Number(((rcxPickOriginX || 0) + (rcxPickSignX * pickX_offset * sx) - (tcpPickX * sx)).toFixed(1));
                        const py = Number(((rcxPickOriginY || 0) + (rcxPickSignY * pickY_offset * sx) - (tcpPickY * sx)).toFixed(1));
                        const pz = Number(((rcxPickOriginZ || 0) + (rcxPickSignZ * bx.h * sx) - (rcxToolOffsetZ || 0)).toFixed(1));
                        const pr = Number(((rcxPickOriginR || 0)).toFixed(1));

                        const rotDeg = carton ? (bx.h === carton.height ? (bx.l === carton.length ? 0 : 90) : (bx.h === carton.width ? (bx.l === carton.length ? 0 : 90) : (bx.h === carton.length ? (bx.l === carton.width ? 0 : 90) : 0))) : 0;
                        let dr = Number(((rcxPalletOriginR || 0) + rotDeg).toFixed(1));

                        // SCARA TCP place rotation offset
                        const thetaPlace = (dr * Math.PI) / 180;
                        const tcpPlaceX = (rcxToolOffsetX || 0) * Math.cos(thetaPlace) - (rcxToolOffsetY || 0) * Math.sin(thetaPlace);
                        const tcpPlaceY = (rcxToolOffsetX || 0) * Math.sin(thetaPlace) + (rcxToolOffsetY || 0) * Math.cos(thetaPlace);

                        // Place Coordinate
                        const dx = Number(((rcxPalletOriginX || 0) + (rcxPlaceSignX * (bx.x + bx.l / 2) * sx) - (tcpPlaceX * sx)).toFixed(1));
                        const dy = Number(((rcxPalletOriginY || 0) + (rcxPlaceSignY * (bx.y + bx.w / 2) * sx) - (tcpPlaceY * sx)).toFixed(1));
                        const dz = Number(((rcxPalletOriginZ || 0) + (rcxPlaceSignZ * (bx.z + bx.h) * sx) - (rcxToolOffsetZ || 0)).toFixed(1));

                        const selected = selectedYamahaStepIndex === i;

                        return (
                           <React.Fragment key={`seq-${i}`}>
                              {/* PICK ROW */}
                              <tr onClick={() => setSelectedYamahaStepIndex && setSelectedYamahaStepIndex(i)} className={`cursor-pointer border-b border-slate-800/50 ${selected ? "bg-blue-900/10" : "hover:bg-slate-800/30"}`}>
                                 <td className="p-2 text-slate-500">{i+1}</td>
                                 <td className="p-2 text-amber-500 font-bold flex items-center gap-1.5"><PackageOpen className="w-3.5 h-3.5"/> Pick</td>
                                 <td className="p-2 text-slate-300">{carton?.name || "Unknown"}</td>
                                 <td className="p-2 text-slate-400 font-mono text-[11px]">{px}, {py}, {pz}, {pr}</td>
                                 <td className="p-2 text-right">
                                    <div className="flex gap-1.5 justify-end">
                                       <button 
                                         onClick={(e) => { 
                                           e.stopPropagation(); 
                                           if (rcxSafeZTravelEnabled) {
                                              confirmAndSend("Move Pick Sequence?", `@MOVE[${robotNumber}] P, WHR(1) WHR(2) 20.000 WHR(4) 0.00 0.00, S=20\r\n@MOVE[${robotNumber}] P, ${px} ${py} 20.000 ${pr} 0.000 0.000, S=20`);
                                           } else {
                                              confirmAndSend("Safe Move Pick (XYR at Top Z)?", `@MOVE[${robotNumber}] P, ${px} ${py} 20.000 ${pr} 0.000 0.000, S=20`); 
                                           }
                                         }} 
                                         className="bg-amber-600/10 hover:bg-amber-600/20 text-amber-500 px-1.5 py-0.5 rounded text-[9.5px] border border-amber-600/30 font-mono"
                                       >
                                          1. Pick Align XYR
                                       </button>
                                       <button 
                                         onClick={(e) => { e.stopPropagation(); confirmAndSend("Plunge Z down to Pick base coordinate?", `@MOVE[${robotNumber}] P, ${px} ${py} ${pz} ${pr} 0.000 0.000, S=15`); }} 
                                         className="bg-amber-600/25 hover:bg-amber-600/40 text-amber-300 px-1.5 py-0.5 rounded text-[9.5px] border border-amber-500 font-semibold font-mono"
                                       >
                                          2. Pick Plunge Z
                                       </button>
                                    </div>
                                 </td>
                              </tr>
                              {/* PLACE ROW */}
                              <tr onClick={() => setSelectedYamahaStepIndex && setSelectedYamahaStepIndex(i)} className={`cursor-pointer border-b border-slate-800 ${selected ? "bg-blue-900/10" : "hover:bg-slate-800/30"}`}>
                                 <td className="p-2 text-slate-500"></td>
                                 <td className="p-2 text-emerald-400 font-bold flex items-center gap-1.5"><CheckSquare className="w-3.5 h-3.5"/> Place</td>
                                 <td className="p-2 text-slate-300">[{bx.x}, {bx.y}, {bx.z}]</td>
                                 <td className="p-2 text-slate-400 font-mono text-[11px]">{dx}, {dy}, {dz}, {dr}</td>
                                 <td className="p-2 text-right">
                                    <div className="flex gap-1.5 justify-end">
                                       <button 
                                         onClick={(e) => { 
                                            e.stopPropagation(); 
                                            if (rcxSafeZTravelEnabled) {
                                               confirmAndSend("Move Place Sequence?", `@MOVE[${robotNumber}] P, WHR(1) WHR(2) 20.000 WHR(4) 0.00 0.00, S=20\r\n@MOVE[${robotNumber}] P, ${dx} ${dy} 20.000 ${dr} 0.000 0.000, S=20`);
                                            } else {
                                               confirmAndSend("Safe Move Place (XYR at Top Z)?", `@MOVE[${robotNumber}] P, ${dx} ${dy} 20.000 ${dr} 0.000 0.000, S=20`); 
                                            }
                                         }} 
                                         className="bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 px-1.5 py-0.5 rounded text-[9.5px] border border-emerald-600/30 font-mono"
                                       >
                                          3. Place Plunge Z
                                       </button>
                                       <button 
                                         onClick={(e) => { 
                                            e.stopPropagation(); 
                                            confirmAndSend("Ascend cleanly to safe height?", `@MOVE[${robotNumber}] P, ${dx} ${dy} 20.000 ${dr} 0.000 0.000, S=20`); 
                                         }} 
                                         className="bg-emerald-600/25 hover:bg-emerald-600/40 text-emerald-300 px-1.5 py-0.5 rounded text-[9.5px] border border-emerald-500 font-semibold font-mono"
                                       >
                                          4. Back to Safe Height
                                       </button>
                                    </div>
                                 </td>
                              </tr>
                           </React.Fragment>
                        );
                     })}
                   </tbody>
                 </table>
              </div>
           </div>
         </div>
      )}

      {/* Terminal Log Output */}
      <div className="bg-[#121212] border border-[#2A2A2E] rounded-xl p-0 overflow-hidden">
        <div className="bg-[#1A1A1D] px-4 py-2 border-b border-[#2A2A2E] flex justify-between items-center">
          <div className="text-xs font-semibold text-slate-300 font-mono flex items-center gap-2">
               <Terminal className="w-3.5 h-3.5 text-slate-400"/>
               Protocol Transmission Logs
             </div>
           </div>
           <div className="h-48 overflow-y-auto p-4 font-mono text-[10px] md:text-xs">
              {logs.slice().reverse().map((lg, i) => (
                <div key={i} className="mb-1 leading-snug">
                  <span className="text-slate-600">[{lg.time}]</span>{" "}
                  {lg.type === "tx" && <span className="text-blue-400">HOST &gt; RBT : </span>}
                  {lg.type === "rx" && <span className="text-emerald-400">RBT &gt; HOST : </span>}
                  {lg.type === "error" && <span className="text-red-400 font-bold">ERR: </span>}
                  {lg.type === "info" && <span className="text-slate-400">INFO: </span>}
                  <span className={lg.type === "error" ? "text-red-300" : "text-slate-300"}>{lg.msg}</span>
                </div>
              ))}
              {logs.length === 0 && <div className="text-slate-600 italic">No communication logs recorded yet.</div>}
           </div>
        </div>
    </div>
  );
}
