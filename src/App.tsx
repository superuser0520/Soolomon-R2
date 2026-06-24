import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  Layers,
  Settings,
  Activity,
  Trash2,
  Plus,
  RefreshCw,
  Play,
  Sliders,
  HelpCircle,
  TrendingUp,
  AlertTriangle,
  CheckCircle,
  Wifi,
  Send,
  Sparkles,
  ChevronDown,
  Info,
  Maximize2,
  Minimize2,
  FileText,
  Cpu,
  Download,
  Clipboard,
  ExternalLink,
  Camera,
  Terminal
} from "lucide-react";
import { PalletConfig, CartonType, PlacedBlock, PackingResult } from "./types";
import { simulateMultiPalletizing } from "./packing-algo";
import WorkspaceCalibrator from "./components/WorkspaceCalibrator";
import YamahaHostController from "./components/YamahaHostController";
import TouchHMI from "./components/TouchHMI";

interface SavedTemplate {
  id: string;
  name: string;
  length: string;
  width: string;
  height: string;
  weight: string;
  friction: string;
  color: string;
  orientations: { flat: boolean; sideways: boolean; uprightAvailable: boolean };
}

export default function App() {
  // 1. Core States
  const [pallet, setPallet] = useState<PalletConfig>({
    length: 1100, // 1.1m
    width: 1100,  // 1.1m
    height: 1100, // 1.1m
    maxWeight: 1000, // 1 Tonne
    defaultGap: 8, // 8mm clearance gap
    interlockType: "pinwheel",
    packSequence: "fifo", // Default to FIFO (First-In, First-Packed) / Fixed Positions
    checkCGSupport: true, // Standard 3D-BPP center of gravity support guard enabled by default
    baseType: "pallet" // Default target is standard flat wooden pallet
  });

  const [customTemplates, setCustomTemplates] = useState<SavedTemplate[]>(() => {
    try {
      const saved = localStorage.getItem("palletizer_custom_templates");
      return saved ? JSON.parse(saved) : [];
    } catch (_) {
      return [];
    }
  });
  const [newTemplateName, setNewTemplateName] = useState<string>("");

  const saveFormAsTemplate = () => {
    const nameToUse = newTemplateName.trim() || `${formName} Prefill`;
    const newTmpl: SavedTemplate = {
      id: "tmpl_" + Date.now(),
      name: nameToUse,
      length: formLength,
      width: formWidth,
      height: formHeight,
      weight: formWeight,
      friction: formFriction,
      color: formColor,
      orientations: { ...formOrientations }
    };
    const updated = [...customTemplates, newTmpl];
    setCustomTemplates(updated);
    localStorage.setItem("palletizer_custom_templates", JSON.stringify(updated));
    setNewTemplateName("");
  };

  const deleteCustomTemplate = (id: string) => {
    const updated = customTemplates.filter(t => t.id !== id);
    setCustomTemplates(updated);
    localStorage.setItem("palletizer_custom_templates", JSON.stringify(updated));
  };

  const [cartons, setCartons] = useState<CartonType[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [simulationResults, setSimulationResults] = useState<PackingResult[]>([]);
  const [activePalletIndex, setActivePalletIndex] = useState<number>(0);
  const [autoCyclePallets, setAutoCyclePallets] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<"palletizer" | "hmi">("palletizer");

  useEffect(() => {
    if (!autoCyclePallets || simulationResults.length <= 1) return;

    const interval = setInterval(() => {
      setActivePalletIndex((prev) => (prev + 1) % simulationResults.length);
    }, 5000);

    return () => clearInterval(interval);
  }, [autoCyclePallets, simulationResults.length]);

  // Derived state for the currently displayed active pallet
  const simulationResult = simulationResults[activePalletIndex] || null;

  // Staggered entry animation states driven by requestAnimationFrame
  const [animationElapsed, setAnimationElapsed] = useState<number>(0);
  const [animationTrigger, setAnimationTrigger] = useState<number>(0);
  const animationRef = useRef<number | null>(null);

  // Refs to track previous box counts per pallet and stay put on incremental updates
  const previousBoxCountsRef = useRef<Record<number, number>>({});
  const lastActivePalletIndexRef = useRef<number>(0);
  const animatingPrevCountRef = useRef<number>(0);

  useEffect(() => {
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
    }

    if (!simulationResult || simulationResult.placedBoxes.length === 0) {
      setAnimationElapsed(0);
      return;
    }

    // Reset reference trackers on switching pallets
    if (activePalletIndex !== lastActivePalletIndexRef.current) {
      previousBoxCountsRef.current = {};
      lastActivePalletIndexRef.current = activePalletIndex;
    }

    const currentCount = simulationResult.placedBoxes.length;
    const memoizedPrevCount = previousBoxCountsRef.current[activePalletIndex] || 0;

    let prevCount = memoizedPrevCount;
    if (currentCount < prevCount) {
      // If box count decreased, reset so remaining ones can be drawn safely
      prevCount = 0;
    }

    animatingPrevCountRef.current = prevCount;
    previousBoxCountsRef.current[activePalletIndex] = currentCount;

    const startTime = Date.now();
    const staggerDelay = 120; // 120ms staggered interval
    const popDuration = 300;  // Snap/Bounce pop duration

    // The animation only needs to run for the newly added boxes
    const animateCount = Math.max(1, currentCount - prevCount);
    const totalDuration = animateCount * staggerDelay + popDuration;

    setAnimationElapsed(0);

    const tick = () => {
      const elapsed = Date.now() - startTime;
      setAnimationElapsed(elapsed);

      if (elapsed < totalDuration) {
        animationRef.current = requestAnimationFrame(tick);
      }
    };

    animationRef.current = requestAnimationFrame(tick);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [simulationResult, animationTrigger, activePalletIndex]);

  // 3D Canvas camera controls - Fixed strictly to isometric viewpoint
  const cameraYaw = -0.78539; // exact -45 deg
  const cameraPitch = 0.61547; // exact 35.264 deg
  const [cameraZoom, setCameraZoom] = useState<number>(0.22); // pixels per mm
  const [selectedLayerIndex, setSelectedLayerIndex] = useState<number | "all">("all"); // Default to displaying all layers
  const [colorScheme, setColorScheme] = useState<"type" | "weight" | "friction">("type");

  // One-by-one carton key-in form states (string-backed to prevent typing bugs)
  const [formName, setFormName] = useState<string>("Industrial Battery");
  const [formLength, setFormLength] = useState<string>("350");
  const [formWidth, setFormWidth] = useState<string>("300");
  const [formHeight, setFormHeight] = useState<string>("200");
  const [formWeight, setFormWeight] = useState<string>("6.5");
  const [formFriction, setFormFriction] = useState<string>("0.45");
  const [formColor, setFormColor] = useState<string>("#1e3a8a");
  const [formOrientations, setFormOrientations] = useState({ flat: true, sideways: false, uprightAvailable: false });

  // Safety custom warnings tracking state
  const [dismissedWarnings, setDismissedWarnings] = useState<string[]>([]);
  const [showStabilityMetrics, setShowStabilityMetrics] = useState<boolean>(false);
  const [showBoxStabilityDetails, setShowBoxStabilityDetails] = useState<boolean>(true); // Enabled by default to highlight the new capability
  const [activePage, setActivePage] = useState<"hmi" | "pallet-settings" | "robot-settings" | "operator-hmi">("hmi");
  const [showScanSuccess, setShowScanSuccess] = useState<any | null>(null);
  const [showYamahaGuide, setShowYamahaGuide] = useState<boolean>(false);

  useEffect(() => {
    if (showScanSuccess) {
      const timer = setTimeout(() => {
        setShowScanSuccess(null);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [showScanSuccess]);

  // --- HIKROBOT CAMERA SCANNER HOST HMI STATES ---
  const [activeInputTab, setActiveInputTab] = useState<"manual" | "camera">("manual");
  const [scannerStatus, setScannerStatus] = useState({
    isTcpServerRunning: false,
    port: 7920,
    isConnected: false,
    clientAddress: null as string | null,
    logs: [] as string[]
  });
  const [scannerPortInput, setScannerPortInput] = useState<string>("7920");
  const [customScannerInput, setCustomScannerInput] = useState<string>("450;350;200");
  const [scannerLoading, setScannerLoading] = useState<boolean>(false);
  const [triggerStatusMsg, setTriggerStatusMsg] = useState<string>("");

  // --- YAMAHA RCX 340 ROBOT COORDINATE CONFIGURATION STATES (Robust String representation to prevent typing bugs) ---
  const [rcxPickOriginXStr, setRcxPickOriginXStr] = useState<string>(() => localStorage.getItem("rcxPickOriginXStr") || "850.0");
  const [rcxPickOriginYStr, setRcxPickOriginYStr] = useState<string>(() => localStorage.getItem("rcxPickOriginYStr") || "0.0");
  const [rcxPickOriginZStr, setRcxPickOriginZStr] = useState<string>(() => localStorage.getItem("rcxPickOriginZStr") || "150.0");
  const [rcxPickOriginRStr, setRcxPickOriginRStr] = useState<string>(() => localStorage.getItem("rcxPickOriginRStr") || "0.0");
  
  const [rcxPalletOriginXStr, setRcxPalletOriginXStr] = useState<string>(() => localStorage.getItem("rcxPalletOriginXStr") || "500.0");
  const [rcxPalletOriginYStr, setRcxPalletOriginYStr] = useState<string>(() => localStorage.getItem("rcxPalletOriginYStr") || "-450.0");
  const [rcxPalletOriginZStr, setRcxPalletOriginZStr] = useState<string>(() => localStorage.getItem("rcxPalletOriginZStr") || "100.0");
  const [rcxPalletOriginRStr, setRcxPalletOriginRStr] = useState<string>(() => localStorage.getItem("rcxPalletOriginRStr") || "0.0");

  const [rcxPickSignX, setRcxPickSignX] = useState<number>(() => parseFloat(localStorage.getItem("rcxPickSignX") || "-1"));
  const [rcxPickSignY, setRcxPickSignY] = useState<number>(() => parseFloat(localStorage.getItem("rcxPickSignY") || "1"));
  const [rcxPickSignZ, setRcxPickSignZ] = useState<number>(() => parseFloat(localStorage.getItem("rcxPickSignZ") || "-1"));

  const [rcxPlaceSignX, setRcxPlaceSignX] = useState<number>(() => parseFloat(localStorage.getItem("rcxPlaceSignX") || "-1"));
  const [rcxPlaceSignY, setRcxPlaceSignY] = useState<number>(() => parseFloat(localStorage.getItem("rcxPlaceSignY") || "-1"));
  const [rcxPlaceSignZ, setRcxPlaceSignZ] = useState<number>(() => parseFloat(localStorage.getItem("rcxPlaceSignZ") || "-1"));

  const [rcxSafeZTravelEnabled, setRcxSafeZTravelEnabled] = useState<boolean>(() => localStorage.getItem("rcxSafeZTravelEnabled") !== "false");

  const [rcxTravelSpeedStr, setRcxTravelSpeedStr] = useState<string>(() => localStorage.getItem("rcxTravelSpeedStr") || "80");
  const [rcxPlungeSpeedStr, setRcxPlungeSpeedStr] = useState<string>(() => localStorage.getItem("rcxPlungeSpeedStr") || "20");

  const [rcxToolOffsetZStr, setRcxToolOffsetZStr] = useState<string>(() => localStorage.getItem("rcxToolOffsetZStr") || "0.0");
  const [rcxToolOffsetXStr, setRcxToolOffsetXStr] = useState<string>(() => localStorage.getItem("rcxToolOffsetXStr") || "0.0");
  const [rcxToolOffsetYStr, setRcxToolOffsetYStr] = useState<string>(() => localStorage.getItem("rcxToolOffsetYStr") || "0.0");
  
  const [rcxEndEffectorLStr, setRcxEndEffectorLStr] = useState<string>(() => localStorage.getItem("rcxEndEffectorLStr") || "80.0");
  const [rcxEndEffectorWStr, setRcxEndEffectorWStr] = useState<string>(() => localStorage.getItem("rcxEndEffectorWStr") || "80.0");
  const [rcxEndEffectorHStr, setRcxEndEffectorHStr] = useState<string>(() => localStorage.getItem("rcxEndEffectorHStr") || "150.0");

  const [rcxScaleDownStr, setRcxScaleDownStr] = useState<string>(() => localStorage.getItem("rcxScaleDownStr") || "1.0");
  const [isYamahaConnected, setIsYamahaConnected] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  // Numeric parsed values for live calculations:
  const rcxPickOriginX = parseFloat(rcxPickOriginXStr) || 0;
  const rcxPickOriginY = parseFloat(rcxPickOriginYStr) || 0;
  const rcxPickOriginZ = parseFloat(rcxPickOriginZStr) || 0;
  const rcxPickOriginR = parseFloat(rcxPickOriginRStr) || 0;
  
  const rcxPalletOriginX = parseFloat(rcxPalletOriginXStr) || 0;
  const rcxPalletOriginY = parseFloat(rcxPalletOriginYStr) || 0;
  const rcxPalletOriginZ = parseFloat(rcxPalletOriginZStr) || 0;
  const rcxPalletOriginR = parseFloat(rcxPalletOriginRStr) || 0;

  const rcxToolOffsetZ = parseFloat(rcxToolOffsetZStr) || 0;
  const rcxToolOffsetX = parseFloat(rcxToolOffsetXStr) || 0;
  const rcxToolOffsetY = parseFloat(rcxToolOffsetYStr) || 0;

  const rcxEndEffectorL = parseFloat(rcxEndEffectorLStr) || 80.0;
  const rcxEndEffectorW = parseFloat(rcxEndEffectorWStr) || 80.0;
  const rcxEndEffectorH = parseFloat(rcxEndEffectorHStr) || 150.0;
  const rcxScaleDown = Math.max(0.001, parseFloat(rcxScaleDownStr) || 1.0);
  const rcxTravelSpeed = Math.max(1, Math.min(100, parseInt(rcxTravelSpeedStr) || 80));
  const rcxPlungeSpeed = Math.max(1, Math.min(100, parseInt(rcxPlungeSpeedStr) || 20));

  const [rcxPickAlignmentMode, setRcxPickAlignmentMode] = useState<"corner" | "center">(
    () => (localStorage.getItem("rcxPickAlignmentMode") as "corner" | "center" || "corner")
  );
  const [selectedYamahaStepIndex, setSelectedYamahaStepIndex] = useState<number>(0);

  // --- HOST TCP CLIENT CONFIGURATION AND STATUS STATES ---
  const [executionMode, setExecutionMode] = useState<"production" | "mockup">("production");
  const [autoTriggerRobot, setAutoTriggerRobot] = useState<boolean>(false);

  
  // Robot state for Hikrobot Camera display
  const [robotExecutionState, setRobotExecutionState] = useState<"idle" | "ready_pending" | "moving" | "completed">("idle");
  const [robotStatusText, setRobotStatusText] = useState<string>("Robot standing by. Awaiting scanned carton.");
  const [latestScannedCartonId, setLatestScannedCartonId] = useState<string | null>(null);


  useEffect(() => {
    let active = true;
    const fetchStatus = async () => {
      try {
        const res = await fetch("/api/hikrobot/status");
        const data = await res.json();
        if (data.status === "success" && active) {
          setScannerStatus({
            isTcpServerRunning: data.isTcpServerRunning,
            port: data.port,
            isConnected: data.isConnected,
            clientAddress: data.clientAddress,
            logs: data.logs
          });
          if (data.port) {
            setScannerPortInput(prev => {
              if (data.isTcpServerRunning || prev === "8080") {
                return String(data.port);
              }
              return prev;
            });
          }
        }
      } catch (err) {
        console.error("Failed to fetch Hikrobot status", err);
      }

      try {
        const res = await fetch("/api/yamaha/status");
        const data = await res.json();
        if (active) {
          setIsYamahaConnected(!!data.isConnected);
        }
      } catch (err) {
        console.error("Failed to fetch Yamaha status", err);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 2000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, []);

  const sendYamahaCmd = async (cmd: string, forceCtrlC = false) => {
    try {
      await fetch("/api/yamaha/command", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cmd, forceCtrlC })
      });
    } catch (err) {
      console.error("Failed to send Yamaha command", err);
    }
  };

  const handleInterrupt = () => {
    sendYamahaCmd("", true);
  };

  const jogToPickOriginXYR = () => {
    if (window.confirm(`Safe Jog Pick Origin: coordinate to XYR horizontally at safe top height (Z=20.0)?\nTarget: X ${rcxPickOriginX.toFixed(1)} Y ${rcxPickOriginY.toFixed(1)} Z 20.0 R ${rcxPickOriginR.toFixed(1)}`)) {
      sendYamahaCmd(`@MOVE[1] P, ${rcxPickOriginX.toFixed(3)} ${rcxPickOriginY.toFixed(3)} 20.000 ${rcxPickOriginR.toFixed(3)} 0.000 0.000, S=20`);
    }
  };

  const jogToPickOriginFull = () => {
    if (window.confirm(`Carefully Plunge Z: descend vertically down to Pick Origin floor Z height?\nTarget: X ${rcxPickOriginX.toFixed(1)} Y ${rcxPickOriginY.toFixed(1)} Z ${rcxPickOriginZ.toFixed(1)} R ${rcxPickOriginR.toFixed(1)}`)) {
      sendYamahaCmd(`@MOVE[1] P, ${rcxPickOriginX.toFixed(3)} ${rcxPickOriginY.toFixed(3)} ${rcxPickOriginZ.toFixed(3)} ${rcxPickOriginR.toFixed(3)} 0.000 0.000, S=12`);
    }
  };

  const jogToPalletOriginXYR = () => {
    if (window.confirm(`Safe Jog Pallet Origin: coordinate to XYR horizontally at safe top height (Z=20.0)?\nTarget: X ${rcxPalletOriginX.toFixed(1)} Y ${rcxPalletOriginY.toFixed(1)} Z 20.0 R ${rcxPalletOriginR.toFixed(1)}`)) {
      sendYamahaCmd(`@MOVE[1] P, ${rcxPalletOriginX.toFixed(3)} ${rcxPalletOriginY.toFixed(3)} 20.000 ${rcxPalletOriginR.toFixed(3)} 0.000 0.000, S=20`);
    }
  };

  const jogToPalletOriginFull = () => {
    if (window.confirm(`Carefully Plunge Z: descend vertically down to Pallet Base Origin floor Z height?\nTarget: X ${rcxPalletOriginX.toFixed(1)} Y ${rcxPalletOriginY.toFixed(1)} Z ${rcxPalletOriginZ.toFixed(1)} R ${rcxPalletOriginR.toFixed(1)}`)) {
      sendYamahaCmd(`@MOVE[1] P, ${rcxPalletOriginX.toFixed(3)} ${rcxPalletOriginY.toFixed(3)} ${rcxPalletOriginZ.toFixed(3)} ${rcxPalletOriginR.toFixed(3)} 0.000 0.000, S=12`);
    }
  };

  const handleSaveConfig = () => {
    localStorage.setItem("rcxPickOriginXStr", rcxPickOriginXStr);
    localStorage.setItem("rcxPickOriginYStr", rcxPickOriginYStr);
    localStorage.setItem("rcxPickOriginZStr", rcxPickOriginZStr);
    localStorage.setItem("rcxPickOriginRStr", rcxPickOriginRStr);
    localStorage.setItem("rcxPalletOriginXStr", rcxPalletOriginXStr);
    localStorage.setItem("rcxPalletOriginYStr", rcxPalletOriginYStr);
    localStorage.setItem("rcxPalletOriginZStr", rcxPalletOriginZStr);
    localStorage.setItem("rcxPalletOriginRStr", rcxPalletOriginRStr);
    localStorage.setItem("rcxToolOffsetZStr", rcxToolOffsetZStr);
    localStorage.setItem("rcxToolOffsetXStr", rcxToolOffsetXStr);
    localStorage.setItem("rcxToolOffsetYStr", rcxToolOffsetYStr);
    localStorage.setItem("rcxEndEffectorLStr", rcxEndEffectorLStr);
    localStorage.setItem("rcxEndEffectorWStr", rcxEndEffectorWStr);
    localStorage.setItem("rcxEndEffectorHStr", rcxEndEffectorHStr);
    localStorage.setItem("rcxScaleDownStr", rcxScaleDownStr);
    localStorage.setItem("rcxPickAlignmentMode", rcxPickAlignmentMode);

    localStorage.setItem("rcxPickSignX", rcxPickSignX.toString());
    localStorage.setItem("rcxPickSignY", rcxPickSignY.toString());
    localStorage.setItem("rcxPickSignZ", rcxPickSignZ.toString());
    localStorage.setItem("rcxPlaceSignX", rcxPlaceSignX.toString());
    localStorage.setItem("rcxPlaceSignY", rcxPlaceSignY.toString());
    localStorage.setItem("rcxPlaceSignZ", rcxPlaceSignZ.toString());
    localStorage.setItem("rcxSafeZTravelEnabled", rcxSafeZTravelEnabled.toString());
    localStorage.setItem("rcxTravelSpeedStr", rcxTravelSpeedStr);
    localStorage.setItem("rcxPlungeSpeedStr", rcxPlungeSpeedStr);

    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 3000);
  };

  const toggleScannerServer = async () => {
    setScannerLoading(true);
    setTriggerStatusMsg("");
    try {
      const port = parseInt(scannerPortInput) || 7920;
      const res = await fetch("/api/hikrobot/toggle", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: scannerStatus.isTcpServerRunning ? "stop" : "start",
          port
        })
      });
      const data = await res.json();
      if (data.status === "success") {
        setScannerStatus((prev) => ({
          ...prev,
          isTcpServerRunning: data.isTcpServerRunning,
          port: data.port,
          isConnected: data.isConnected
        }));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setScannerLoading(false);
    }
  };

  const triggerCameraScan = async () => {
    setTriggerStatusMsg("");
    try {
      const res = await fetch("/api/hikrobot/trigger", { method: "POST" });
      const data = await res.json();
      if (data.status === "success") {
        setTriggerStatusMsg("📸 Trigger '1' command sent! Camera scan initiated.");
        setTimeout(() => fetchCartons(), 800); // fetch cartons back
      } else {
        setTriggerStatusMsg(`❌ Camera Trigger error: ${data.error}`);
      }
    } catch (e) {
      setTriggerStatusMsg("❌ Server connection lost.");
    }
  };

  const simulateCameraScan = async (mockData?: string) => {
    setTriggerStatusMsg("");
    try {
      const payload = mockData || customScannerInput;
      const res = await fetch("/api/hikrobot/simulate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: payload })
      });
      const data = await res.json();
      if (data.status === "success") {
        setTriggerStatusMsg(`✅ Simulated QR code scanned format: "${payload}". Weight applied: 30kg.`);
        fetchCartons(); // refresh inventory list!
      } else {
        setTriggerStatusMsg(`❌ Simulated barcode parsing failed: ${data.error}`);
      }
    } catch (e) {
      setTriggerStatusMsg("❌ Connection failure simulating QR code.");
    }
  };

  // Pallet string-backed states to prevent typing/clamping bugs
  const [palletLengthStr, setPalletLengthStr] = useState<string>("1100");
  const [palletWidthStr, setPalletWidthStr] = useState<string>("1100");
  const [palletHeightStr, setPalletHeightStr] = useState<string>("1100");
  const [palletGapStr, setPalletGapStr] = useState<string>("8");
  const [palletMaxWeightStr, setPalletMaxWeightStr] = useState<string>("1000");

  // Keep string states in sync when standard/preset mechanisms update the core pallet config
  useEffect(() => {
    setPalletLengthStr(pallet.length.toString());
    setPalletWidthStr(pallet.width.toString());
    setPalletHeightStr(pallet.height.toString());
    setPalletGapStr(pallet.defaultGap.toString());
    setPalletMaxWeightStr(pallet.maxWeight.toString());
  }, [pallet.length, pallet.width, pallet.height, pallet.defaultGap, pallet.maxWeight]);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // 2. Fetch active cartons lists on initiation
  const fetchCartons = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const res = await fetch("/api/cartons");
      const data = await res.json();
      if (data.status === "success") {
        setCartons((prevCartons) => {
          // Detect if a brand new scanned carton just popped up
          const oldScanned = prevCartons.filter(c => c.id.startsWith("scanned_")).map(c => c.id);
          const newScanned = data.cartons.filter((c: any) => c.id.startsWith("scanned_"));
          
          if (newScanned.length > 0) {
            const lastOne = newScanned[newScanned.length - 1];
            if (!oldScanned.includes(lastOne.id)) {
              setLatestScannedCartonId(lastOne.id);
              setRobotExecutionState("ready_pending");
              setRobotStatusText(`Scan Received: '${lastOne.name}' (${lastOne.length}x${lastOne.width}x${lastOne.height}mm). Stacking recalculated. Ready to Trigger.`);
              setShowScanSuccess(lastOne);
            }
          }
          return data.cartons;
        });
      }
    } catch (e) {
      console.error(e);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  // --- CORE SYSTEM TRANSLATION HELPERS & MEMOS (YAMAHA RCX340 INTEGRATION) ---
  const activeResult = simulationResults[activePalletIndex];

  const getCartonRotationDegree = useCallback((block: PlacedBlock): number => {
    const carton = cartons.find((c) => c.id === block.typeId);
    if (!carton) return 0;
    if (block.h === carton.height) {
      return block.l === carton.length ? 0 : 90;
    }
    if (block.h === carton.width) {
      return block.l === carton.length ? 0 : 90;
    }
    if (block.h === carton.length) {
      return block.l === carton.width ? 0 : 90;
    }
    return 0;
  }, [cartons]);

  const getCartonRotationLabel = useCallback((block: PlacedBlock): string => {
    const carton = cartons.find((c) => c.id === block.typeId);
    if (!carton) return "0°";
    if (block.h === carton.height) {
      return block.l === carton.length ? "0° (Flat)" : "90° (Flat Rotated)";
    }
    if (block.h === carton.width) {
      return block.l === carton.length ? "0° (Sideways)" : "90° (Sideways Rotated)";
    }
    if (block.h === carton.length) {
      return block.l === carton.width ? "0° (Upright)" : "90° (Upright Rotated)";
    }
    return "0°";
  }, [cartons]);

  const yamahaCalculations = useMemo(() => {
    if (!activeResult) return { commands: [], pntLines: [], prgLines: [] };
    
    const commands = activeResult.placedBoxes.map((bx, idx) => {
      const rot = getCartonRotationDegree(bx);
      const pickX_offset = rcxPickAlignmentMode === "corner" ? bx.l / 2 : 0;
      const pickY_offset = rcxPickAlignmentMode === "corner" ? bx.w / 2 : 0;
      const pickZ_offset = bx.h;
      
      const pX = Number((rcxPickOriginX + (rcxPickSignX * pickX_offset * rcxScaleDown)).toFixed(2));
      const pY = Number((rcxPickOriginY + (rcxPickSignY * pickY_offset * rcxScaleDown)).toFixed(2));
      const pZ = Number((rcxPickOriginZ + (rcxPickSignZ * pickZ_offset * rcxScaleDown) - rcxToolOffsetZ).toFixed(2));
      const pR = Number(rcxPickOriginR.toFixed(2));

      const plX = Number((rcxPalletOriginX + (rcxPlaceSignX * (bx.x + bx.l / 2) * rcxScaleDown)).toFixed(2));
      const plY = Number((rcxPalletOriginY + (rcxPlaceSignY * (bx.y + bx.w / 2) * rcxScaleDown)).toFixed(2));
      const plZ = Number((rcxPalletOriginZ + (rcxPlaceSignZ * (bx.z + bx.h) * rcxScaleDown) - rcxToolOffsetZ).toFixed(2));
      const plR = Number((rcxPalletOriginR + rot).toFixed(2));

      return {
        sequenceOrder: idx + 1,
        id: bx.id,
        name: bx.name,
        dimensions: { length: bx.l, width: bx.w, height: bx.h },
        pickup: { x: pX, y: pY, z: pZ, r: pR },
        placement: { x: plX, y: plY, z: plZ, r: plR },
        rcxPickPointString: `P${10 + idx * 2}=${pX.toFixed(2)} ${pY.toFixed(2)} ${pZ.toFixed(2)} ${pR.toFixed(2)} 0.00 0.00`,
        rcxPlacePointString: `P${11 + idx * 2}=${plX.toFixed(2)} ${plY.toFixed(2)} ${plZ.toFixed(2)} ${plR.toFixed(2)} 0.00 0.00`
      };
    });

    const pntLines = [
      `; ==========================================`,
      `; YAMAHA RCX340 POINT DATA GENERATED TABLE`,
      `; Generated: ${new Date().toISOString()}`,
      `; ==========================================`,
      ...commands.flatMap(cmd => [
        `' Pick - Step ${cmd.sequenceOrder}: ${cmd.name}`,
        cmd.rcxPickPointString,
        `' Place - Step ${cmd.sequenceOrder}: ${cmd.name}`,
        cmd.rcxPlacePointString
      ])
    ];

    const prgLines = [
      `' ==========================================`,
      `' YAMAHA RCX340 PALLETIZING AUTO-GENERATED CONTROLLER SEQUENCE`,
      `' Generated: ${new Date().toLocaleString()}`,
      `' ==========================================`,
      `' Points allocation map:`,
      `' P100 = Safe Home Position`,
      `' P(10 + i*2) = Pickup coordinates for step i`,
      `' P(11 + i*2) = Pallet placement coordinates for step i`,
      `'`,
      `*INIT:`,
      `  MOTOR ON`,
      `  POWER HIGH`,
      `  SPEED 50          ' Base velocity`,
      `  ACCEL 80          ' Acceleration rate`,
      `  DECEL 80          ' Deceleration rate`,
      `  HALT(1)           ' Check safety guard interlocks`,
      `  `,
      `  ' Define default Safe Home position`,
      `  P100=400.00 0.00 500.00 0.00 0.00 0.00`,
      `  MOVE P, P100, S=100`,
      `  `,
      `' Begin robotic stacking steps`,
      ...commands.flatMap(cmd => {
        const pPick = `P${10 + (cmd.sequenceOrder - 1) * 2}`;
        const pPlace = `P${11 + (cmd.sequenceOrder - 1) * 2}`;
        return [
          `' --- STEP ${cmd.sequenceOrder}: PLACE ${cmd.name} ---`,
          `*STEP_${cmd.sequenceOrder}:`,
          ...(rcxSafeZTravelEnabled ? [
            `  ' Safe Z transit before motion`,
            `  P99 = WHR`,
            `  P99(3) = 20.0`,
            `  SPEED ${rcxTravelSpeed}`,
            `  MOVE P, P99`,
            `  `
          ] : []),
          `  ' 1. Fast travel to Pickup Safe Approach clearance (Z = 20.0)`,
          `  P1 = ${pPick}`,
          `  P2 = ${pPick}`,
          `  P2(3) = 20.0`,
          `  SPEED ${rcxTravelSpeed}`,
          `  MOVE P, P2`,
          `  `,
          `  ' 2. Creep descend to grab top center of carton`,
          `  SPEED ${rcxPlungeSpeed}`,
          `  DRIVE P, P1`,
          `  DELAY 150`,
          `  `,
          `  ' 3. Activate vacuum grip solenoid`,
          `  DO(1) = 1`,
          `  DELAY 300`,
          `  `,
          `  ' 4. Safe lift away from conveyor`,
          `  SPEED ${rcxTravelSpeed}`,
          `  MOVE P, P2`,
          `  `,
          `  ' 5. Transit high travel to Placement Safe Approach clearance (Z = 20.0)`,
          `  P3 = ${pPlace}`,
          `  P4 = ${pPlace}`,
          `  P4(3) = 20.0`,
          `  SPEED ${rcxTravelSpeed}`,
          `  MOVE P, P4`,
          `  `,
          `  ' 6. Lower carefully onto pallet stack coordinate`,
          `  SPEED ${rcxPlungeSpeed}`,
          `  DRIVE P, P3`,
          `  DELAY 100`,
          `  `,
          `  ' 7. Drop vacuum (no positive pressure blow-off / purging duty)`,
          `  DO(1) = 0`,
          `  DELAY 150`,
          `  `,
          `  ' 8. Ascend cleanly from task area`,
          `  SPEED ${rcxTravelSpeed}`,
          `  MOVE P, P4`,
          `  `
        ];
      }),
      `' pallet stacking completed successfully, reset loop`,
      `*COMPLETE:`,
      `  SPEED 50`,
      `  MOVE P, P100`,
      `  WRITE "Pallet completed successfully."`,
      `  HALT`,
      `  GOTO *INIT`
    ];

    return { commands, pntLines, prgLines };
  }, [activeResult, rcxPickOriginX, rcxPickOriginY, rcxPickOriginZ, rcxPickOriginR, rcxPalletOriginX, rcxPalletOriginY, rcxPalletOriginZ, rcxPalletOriginR, rcxToolOffsetZ, rcxPickAlignmentMode, getCartonRotationDegree, rcxScaleDown]);

  useEffect(() => {
    fetchCartons();
    // Maintain brief update polling to stay synced, silent
    const interval = setInterval(() => fetchCartons(true), 3500);
    return () => clearInterval(interval);
  }, []);

  // 3. Trigger multi-pallet packing calculation whenever cartons or pallet options change
  useEffect(() => {
    if (cartons.length >= 0) {
      const results = simulateMultiPalletizing(pallet, cartons);
      setSimulationResults(results);
      // Stay on current index if still valid, otherwise reset to 0
      setActivePalletIndex((prev) => (prev < results.length ? prev : 0));
      setDismissedWarnings([]); // reset dismissed alerts upon edits
    }
  }, [cartons, pallet]);

  // Synchronize robotic path to backend server whenever simulation result or active index changes
  useEffect(() => {
    const activeResult = simulationResults[activePalletIndex];
    if (!activeResult) return;

    const getCartonRotationDegree = (block: PlacedBlock): number => {
      const carton = cartons.find((c) => c.id === block.typeId);
      if (!carton) return 0;
      if (block.h === carton.height) {
        return block.l === carton.length ? 0 : 90;
      }
      if (block.h === carton.width) {
        return block.l === carton.length ? 0 : 90;
      }
      if (block.h === carton.length) {
        return block.l === carton.width ? 0 : 90;
      }
      return 0;
    };

    const getCartonRotationLabel = (block: PlacedBlock): string => {
      const carton = cartons.find((c) => c.id === block.typeId);
      if (!carton) return "0°";
      if (block.h === carton.height) {
        return block.l === carton.length ? "0° (Flat)" : "90° (Flat Rotated)";
      }
      if (block.h === carton.width) {
        return block.l === carton.length ? "0° (Sideways)" : "90° (Sideways Rotated)";
      }
      if (block.h === carton.length) {
        return block.l === carton.width ? "0° (Upright)" : "90° (Upright Rotated)";
      }
      return "0°";
    };

    // Calculate custom Yamaha RCX340 pick/place targets
    const yamahaCommands = activeResult.placedBoxes.map((bx, idx) => {
      const rot = getCartonRotationDegree(bx);
      
      // Pick calculation (Z is physical base height + box height for top-surface pickup)
      const pickX_offset = rcxPickAlignmentMode === "corner" ? bx.l / 2 : 0;
      const pickY_offset = rcxPickAlignmentMode === "corner" ? bx.w / 2 : 0;
      const pickZ_offset = bx.h;
      
      const pickCo_X = Number((rcxPickOriginX + (rcxPickSignX * pickX_offset * rcxScaleDown)).toFixed(2));
      const pickCo_Y = Number((rcxPickOriginY + (rcxPickSignY * pickY_offset * rcxScaleDown)).toFixed(2));
      const pickCo_Z = Number((rcxPickOriginZ + (rcxPickSignZ * pickZ_offset * rcxScaleDown) - rcxToolOffsetZ).toFixed(2));
      const pickCo_R = Number(rcxPickOriginR.toFixed(2));

      // Place calculation
      const placeCo_X = Number((rcxPalletOriginX + (rcxPlaceSignX * (bx.x + bx.l / 2) * rcxScaleDown)).toFixed(2));
      const placeCo_Y = Number((rcxPalletOriginY + (rcxPlaceSignY * (bx.y + bx.w / 2) * rcxScaleDown)).toFixed(2));
      const placeCo_Z = Number((rcxPalletOriginZ + (rcxPlaceSignZ * (bx.z + bx.h) * rcxScaleDown) - rcxToolOffsetZ).toFixed(2));
      const placeCo_R = Number((rcxPalletOriginR + rot).toFixed(2));

      return {
        sequenceOrder: idx + 1,
        id: bx.id,
        name: bx.name,
        dimensions: { length: bx.l, width: bx.w, height: bx.h },
        pickup: {
          x: pickCo_X,
          y: pickCo_Y,
          z: pickCo_Z,
          r: pickCo_R
        },
        placement: {
          x: placeCo_X,
          y: placeCo_Y,
          z: placeCo_Z,
          r: placeCo_R
        },
        rcxPickPointString: `P${10 + idx * 2}=${pickCo_X.toFixed(2)} ${pickCo_Y.toFixed(2)} ${pickCo_Z.toFixed(2)} ${pickCo_R.toFixed(2)} 0.00 0.00`,
        rcxPlacePointString: `P${11 + idx * 2}=${placeCo_X.toFixed(2)} ${placeCo_Y.toFixed(2)} ${placeCo_Z.toFixed(2)} ${placeCo_R.toFixed(2)} 0.00 0.00`
      };
    });

    const rcxPntFileLines = [
      `; ==========================================`,
      `; YAMAHA RCX340 POINT DATA GENERATED TABLE`,
      `; Generated: ${new Date().toISOString()}`,
      `; ==========================================`,
      ...yamahaCommands.flatMap(cmd => [
        `' Pick - Step ${cmd.sequenceOrder}: ${cmd.name}`,
        cmd.rcxPickPointString,
        `' Place - Step ${cmd.sequenceOrder}: ${cmd.name}`,
        cmd.rcxPlacePointString
      ])
    ];

    const rcxProgramLines = [
      `' ==========================================`,
      `' YAMAHA RCX340 PALLETIZING AUTO-GENERATED CONTROLLER SEQUENCE`,
      `' Generated: ${new Date().toLocaleString()}`,
      `' ==========================================`,
      `' Points allocation map:`,
      `' P100 = Safe Home Position`,
      `' P(10 + i*2) = Pickup coordinates for step i`,
      `' P(11 + i*2) = Pallet placement coordinates for step i`,
      `'`,
      `*INIT:`,
      `  MOTOR ON`,
      `  POWER HIGH`,
      `  SPEED 50          ' Base velocity`,
      `  ACCEL 80          ' Acceleration rate`,
      `  DECEL 80          ' Deceleration rate`,
      `  HALT(1)           ' Check safety guard interlocks`,
      `  `,
      `  ' Define default Safe Home position`,
      `  P100=400.00 0.00 500.00 0.00 0.00 0.00`,
      `  MOVE P, P100, S=100`,
      `  `,
      `' Begin robotic stacking steps`,
      ...yamahaCommands.flatMap(cmd => {
        const pPick = `P${10 + (cmd.sequenceOrder - 1) * 2}`;
        const pPlace = `P${11 + (cmd.sequenceOrder - 1) * 2}`;
        return [
          `' --- STEP ${cmd.sequenceOrder}: PLACE ${cmd.name} ---`,
          `*STEP_${cmd.sequenceOrder}:`,
          ...(rcxSafeZTravelEnabled ? [
            `  ' Safe Z transit before motion`,
            `  P99 = WHR`,
            `  P99(3) = 20.0`,
            `  SPEED ${rcxTravelSpeed}`,
            `  MOVE P, P99`,
            `  `
          ] : []),
          `  ' 1. Fast travel to Pickup Safe Approach clearance (Z = 20.0)`,
          `  P1 = ${pPick}`,
          `  P2 = ${pPick}`,
          `  P2(3) = 20.0`,
          `  SPEED ${rcxTravelSpeed}`,
          `  MOVE P, P2`,
          `  `,
          `  ' 2. Creep descend to grab top center of carton`,
          `  SPEED ${rcxPlungeSpeed}`,
          `  DRIVE P, P1`,
          `  DELAY 150`,
          `  `,
          `  ' 3. Activate vacuum grip solenoid`,
          `  DO(1) = 1`,
          `  DELAY 300`,
          `  `,
          `  ' 4. Safe lift away from conveyor`,
          `  SPEED ${rcxTravelSpeed}`,
          `  MOVE P, P2`,
          `  `,
          `  ' 5. Transit high travel to Placement Safe Approach clearance (Z = 20.0)`,
          `  P3 = ${pPlace}`,
          `  P4 = ${pPlace}`,
          `  P4(3) = 20.0`,
          `  SPEED ${rcxTravelSpeed}`,
          `  MOVE P, P4`,
          `  `,
          `  ' 6. Lower carefully onto pallet stack coordinate`,
          `  SPEED ${rcxPlungeSpeed}`,
          `  DRIVE P, P3`,
          `  DELAY 100`,
          `  `,
          `  ' 7. Drop vacuum (no positive pressure blow-off / purging duty)`,
          `  DO(1) = 0`,
          `  DELAY 150`,
          `  `,
          `  ' 8. Ascend cleanly from task area`,
          `  SPEED ${rcxTravelSpeed}`,
          `  MOVE P, P4`,
          `  `
        ];
      }),
      `' pallet stacking completed successfully, reset loop`,
      `*COMPLETE:`,
      `  SPEED 50`,
      `  MOVE P, P100`,
      `  WRITE "Pallet completed successfully."`,
      `  HALT`,
      `  GOTO *INIT`
    ];

    const roboticPathData = {
      palletIndex: activePalletIndex,
      palletSize: { length: pallet.length, width: pallet.width, height: pallet.height },
      placedBoxesCount: activeResult.placedBoxes.length,
      timestamp: new Date().toISOString(),
      commands: activeResult.placedBoxes.map((bx, idx) => ({
        sequenceOrder: idx + 1,
        id: bx.id,
        typeId: bx.typeId,
        name: bx.name,
        weight_kg: bx.weight,
        vacuumTargetCenter_mm: {
          x: Math.round(bx.x + bx.l / 2),
          y: Math.round(bx.y + bx.w / 2),
          z: Math.round(bx.z + bx.h)
        },
        centroid_mm: {
          x: Math.round(bx.x + bx.l / 2),
          y: Math.round(bx.y + bx.w / 2),
          z: Math.round(bx.z + bx.h / 2)
        },
        cornerOrigin_mm: {
          x: bx.x,
          y: bx.y,
          z: bx.z
        },
        actualDimensions_mm: {
          length: bx.l,
          width: bx.w,
          height: bx.h
        },
        rotationYaw_deg: getCartonRotationDegree(bx),
        orientationLabel: getCartonRotationLabel(bx),
        frictionCoeff: bx.frictionCoeff
      })),
      yamahaRCX340: {
        config: {
          pickOrigin: { x: rcxPickOriginX, y: rcxPickOriginY, z: rcxPickOriginZ, r: rcxPickOriginR },
          palletOrigin: { x: rcxPalletOriginX, y: rcxPalletOriginY, z: rcxPalletOriginZ, r: rcxPalletOriginR },
          toolOffsetZ: rcxToolOffsetZ,
          pickAlignmentMode: rcxPickAlignmentMode
        },
        steps: yamahaCommands,
        pntFileContent: rcxPntFileLines.join("\n"),
        programText: rcxProgramLines.join("\n")
      }
    };

    const syncPath = async () => {
      try {
        await fetch("/api/robotic-path", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(roboticPathData),
        });
      } catch (err) {
        console.error("Failed to sync robotic path schema", err);
      }
    };
    syncPath();
  }, [simulationResults, activePalletIndex, cartons, pallet, rcxPickOriginX, rcxPickOriginY, rcxPickOriginZ, rcxPickOriginR, rcxPalletOriginX, rcxPalletOriginY, rcxPalletOriginZ, rcxPalletOriginR, rcxToolOffsetZ, rcxPickAlignmentMode, rcxScaleDown]);

  // 4. Update cartons list back to server
  const saveCartonsList = async (updated: CartonType[]) => {
    setCartons(updated);
    try {
      await fetch("/api/cartons-update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated),
      });
    } catch (e) {
      console.error("Failed to sync cartons to backend server", e);
    }
  };

  // Key-In Carton One-by-One Action
  const keyInSingleCarton = () => {
    const randomColors = ["#1e3a8a", "#b45309", "#0d9488", "#111827", "#84cc16", "#a855f7", "#ec4899", "#14b8a6"];
    const col = formColor || randomColors[Math.floor(Math.random() * randomColors.length)];

    const parseL = Math.max(50, Math.min(2000, parseInt(formLength) || 350));
    const parseW = Math.max(50, Math.min(2000, parseInt(formWidth) || 300));
    const parseH = Math.max(50, Math.min(2000, parseInt(formHeight) || 200));
    const parseWt = Math.max(0.1, Math.min(500, parseFloat(formWeight) || 6.5));
    const parseFr = Math.max(0.01, Math.min(1.0, parseFloat(formFriction) || 0.45));

    const newItem: CartonType = {
      id: `manual_${Date.now()}`,
      name: formName || `Carton Type ${cartons.length + 1}`,
      length: parseL,
      width: parseW,
      height: parseH,
      weight: parseWt,
      color: col,
      frictionCoeff: parseFr,
      quantity: 1, // EXACTLY 1 - satisfying the one-by-one key-in requirement
      allowedOrientations: { ...formOrientations }
    };

    saveCartonsList([...cartons, newItem]);
    
    // Auto-update default values for subsequent ease
    const nextIndex = cartons.length + 2;
    setFormName(`Industrial Case #${nextIndex}`);
  };

  // Add a new raw table row
  const addCartonRow = () => {
    const randomColors = ["#1e3a8a", "#b45309", "#0d9488", "#111827", "#84cc16", "#a855f7", "#ec4899", "#14b8a6"];
    const randomColor = randomColors[Math.floor(Math.random() * randomColors.length)];

    const newRow: CartonType = {
      id: `manual_${Date.now()}`,
      name: `Carton Type ${cartons.length + 1}`,
      length: 350,
      width: 300,
      height: 200,
      weight: 6.5,
      color: randomColor,
      frictionCoeff: 0.45,
      quantity: 1, // exact 1
      allowedOrientations: { flat: true, sideways: false, uprightAvailable: false },
    };
    saveCartonsList([...cartons, newRow]);
  };

  // Update specific fields in manual table
  const updateCartonField = (index: number, field: string, value: any) => {
    const clone = [...cartons];
    const item = clone[index];

    if (field === "allowedOrientations") {
      item.allowedOrientations = { ...item.allowedOrientations, ...value };
    } else {
      (item as any)[field] = value;
    }

    // Force constraints
    if (field === "length" || field === "width" || field === "height" || field === "quantity" || field === "weight" || field === "frictionCoeff") {
      const num = parseFloat(value) || 0;
      if (field === "length" || field === "width" || field === "height") {
        (item as any)[field] = Math.max(50, Math.min(2000, num));
      }
      if (field === "quantity") {
        item.quantity = Math.max(0, Math.min(100, Math.floor(num)));
      }
      if (field === "weight") {
        item.weight = Math.max(0.1, Math.min(500, num));
      }
      if (field === "frictionCoeff") {
        item.frictionCoeff = Math.max(0.01, Math.min(1.0, num));
      }
    }

    saveCartonsList(clone);
  };

  // Delete carton configuration
  const deleteCarton = (index: number) => {
    const clone = cartons.filter((_, i) => i !== index);
    saveCartonsList(clone);
  };

  // Clear all cartons
  const clearAllCartons = async () => {
    try {
      await fetch("/api/clear-cartons", { method: "POST" });
      setCartons([]);
      setSimulationResults([]);
      setActivePalletIndex(0);
      fetchCartons();
    } catch (e) {
      console.error(e);
    }
  };

  // Factory reset presets
  const resetFactoryPresets = async () => {
    try {
      const res = await fetch("/api/reset-factory", { method: "POST" });
      const data = await res.json();
      if (data.status === "success") {
        setCartons(data.cartons);
        setSimulationResults([]);
        setActivePalletIndex(0);
      }
    } catch (e) {
      console.error(e);
    }
  };

  // 7. Interactive canvas 3D Painter draw loop
  const draw3DPallet = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // High-DPI support: scale canvas pixels while keeping CSS sizing consistent.
    const dpr = window.devicePixelRatio || 1;
    if (canvas.width !== 450 * dpr || canvas.height !== 440 * dpr) {
      canvas.width = 450 * dpr;
      canvas.height = 440 * dpr;
      canvas.style.width = "450px";
      canvas.style.height = "440px";
    }

    ctx.resetTransform?.();
    ctx.scale(dpr, dpr);

    const width = 450;
    const height = 440;
    ctx.clearRect(0, 0, width, height);

    // Dynamic scale parameters based on canvas sizes
    const centerX = width / 2;
    const centerY = height / 2 + 70; // Shift down slightly, optimal for 30-deg isometric upward towers
    const zoom = cameraZoom;

    const pL = pallet.length;
    const pW = pallet.width;
    const pH = pallet.height;

    // Standard high-fidelity symmetric 30-degree isometric projection formulas
    const project = (x3d: number, y3d: number, z3d: number) => {
      // Offset values relative to the pallet center
      const xRel = x3d - pL / 2;
      const yRel = y3d - pW / 2;
      const zRel = z3d; // Height is absolute starting from wooden surface Z = 0

      const isoAngle = 0.523599; // exact 30 degrees for industrial drafting style

      // X screen axis goes down-left for X increases, and down-right for Y increases.
      // Z goes straight UP.
      const screenX = centerX + (yRel - xRel) * Math.cos(isoAngle) * zoom;
      const screenY = centerY + (xRel + yRel) * Math.sin(isoAngle) * zoom - zRel * zoom;

      // depth represents back-to-front order. Point with larger X and Y and Z is closer to camera.
      const depth = xRel + yRel + zRel * 1.5;

      return { x: screenX, y: screenY, depth };
    };

    // Draw coordinate axes at the lower back corner
    const drawAxes = () => {
      const origin = project(0, 0, 0);
      const axisX = project(200, 0, 0);
      const axisY = project(0, 200, 0);
      const axisZ = project(0, 0, 200);

      ctx.lineWidth = 2;
      // X Axis (Red) - Length (Down-Left)
      ctx.strokeStyle = "rgba(239, 68, 68, 0.75)";
      ctx.beginPath();
      ctx.moveTo(origin.x, origin.y);
      ctx.lineTo(axisX.x, axisX.y);
      ctx.stroke();

      // Y Axis (Green) - Width (Down-Right)
      ctx.strokeStyle = "rgba(34, 197, 94, 0.75)";
      ctx.beginPath();
      ctx.moveTo(origin.x, origin.y);
      ctx.lineTo(axisY.x, axisY.y);
      ctx.stroke();

      // Z Axis (Blue) - Elevation (Straight Up)
      ctx.strokeStyle = "rgba(59, 130, 246, 0.75)";
      ctx.beginPath();
      ctx.moveTo(origin.x, origin.y);
      ctx.lineTo(axisZ.x, axisZ.y);
      ctx.stroke();
    };

    // Draw solid timber-grain pallet base with realistic runner blocks underneath
    const drawPalletStructure = () => {
      const isCarton = pallet.baseType === "carton";

      const drawPoly = (pts: { x: number; y: number }[], fillColor: string, strokeColor: string, lw = 1) => {
        ctx.fillStyle = fillColor;
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = lw;
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i < pts.length; i++) {
          ctx.lineTo(pts[i].x, pts[i].y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      };

      if (isCarton) {
        // --- DRAW MASTER CONTAINER/CARTON BASE & OUTER BOX WALLS ---
        const cardboardColor = "#bf8f5a"; // craft/cardboard light brown
        const cardboardDark = "#8d6438"; // shaded side
        const cardboardLine = "#6c451b"; // darker seams

        // 0. Ground shadow
        const shadowOffset2 = 12;
        const groundShadow = [
          project(-shadowOffset2, -shadowOffset2, -25),
          project(pL + shadowOffset2, -shadowOffset2, -25),
          project(pL + shadowOffset2, pW + shadowOffset2, -25),
          project(-shadowOffset2, pW + shadowOffset2, -25),
        ];
        drawPoly(groundShadow, "rgba(0, 0, 0, 0.25)", "transparent");

        // 1. Solid cardboard floor plate top (at Z = 0)
        const baseTop = [
          project(0, 0, 0),
          project(pL, 0, 0),
          project(pL, pW, 0),
          project(0, pW, 0),
        ];
        drawPoly(baseTop, cardboardColor, cardboardLine, 1.5);

        // 2. Extrusion edge front-left (X = pL, Z = 0 to -25)
        const flEdge = [
          project(pL, 0, 0),
          project(pL, pW, 0),
          project(pL, pW, -25),
          project(pL, 0, -25),
        ];
        drawPoly(flEdge, cardboardDark, cardboardLine, 1.5);

        // 3. Extrusion edge front-right (Y = pW, Z = 0 to -25)
        const frEdge = [
          project(0, pW, 0),
          project(pL, pW, 0),
          project(pL, pW, -25),
          project(0, pW, -25),
        ];
        drawPoly(frEdge, cardboardDark, cardboardLine, 1.5);

        // Back-Left wall face (from Y=0, X=0 to X=pL, Z=0 to pH)
        const wallBackLeft = [
          project(0, 0, 0),
          project(pL, 0, 0),
          project(pL, 0, pH),
          project(0, 0, pH),
        ];
        drawPoly(wallBackLeft, "rgba(189, 137, 85, 0.08)", "rgba(108, 69, 27, 0.25)", 1);

        // Back-Right wall face (from X=0, Y=0 to Y=pW, Z=0 to pH)
        const wallBackRight = [
          project(0, 0, 0),
          project(0, pW, 0),
          project(0, pW, pH),
          project(0, 0, pH),
        ];
        drawPoly(wallBackRight, "rgba(189, 137, 85, 0.08)", "rgba(108, 69, 27, 0.25)", 1);

        // Draw helper indicator at bottom
        ctx.font = "bold 8px sans-serif";
        ctx.fillStyle = "rgba(108, 69, 27, 0.6)";
        ctx.textAlign = "center";
        const labelProj = project(pL / 2, pW / 2, -15);
        ctx.fillText("MASTER CONTAINER DECK", labelProj.x, labelProj.y);

      } else {
        // --- DRAW DECK/TIMBER PALLET ---
        const woodDeckColor = "#854d0e"; // gorgeous rich oak wood amber-800
        const woodShadeColor = "#451a03"; // darker wood shadow for extrusion
        const woodLineColor = "#270e01"; // dark brown seam borders

        // 0. LAYERED GROUND SHADOW underneath the entire pallet
        const shadowOffset1 = 40;
        const groundShadow1 = [
          project(-shadowOffset1, -shadowOffset1, -110),
          project(pL + shadowOffset1, -shadowOffset1, -110),
          project(pL + shadowOffset1, pW + shadowOffset1, -110),
          project(-shadowOffset1, pW + shadowOffset1, -110),
        ];
        drawPoly(groundShadow1, "rgba(0, 0, 0, 0.15)", "transparent");

        const shadowOffset2 = 10;
        const groundShadow2 = [
          project(-shadowOffset2, -shadowOffset2, -110),
          project(pL + shadowOffset2, -shadowOffset2, -110),
          project(pL + shadowOffset2, pW + shadowOffset2, -110),
          project(-shadowOffset2, pW + shadowOffset2, -110),
        ];
        drawPoly(groundShadow2, "rgba(0, 0, 0, 0.22)", "transparent");

        // 1. INDIVIDUAL WOODEN PLANK SLATS (Z = 0) with organic color variability
        const slatCount = 7;
        const slatWidth = pL / slatCount;
        const woodTones = ["#78350f", "#854d0e", "#92400e", "#a16207", "#7c2d12"];

        for (let i = 0; i < slatCount; i++) {
          const xStart = i * slatWidth;
          const xEnd = (i + 1) * slatWidth - 8; // realistic gap between slats

          const sCorners = [
            project(xStart, 0, 0),
            project(xEnd, 0, 0),
            project(xEnd, pW, 0),
            project(xStart, pW, 0),
          ];

          const tone = woodTones[i % woodTones.length];
          drawPoly(sCorners, tone, woodLineColor, 1.5);

          // Draw a soft grain line on each slat
          ctx.strokeStyle = "rgba(0, 0, 0, 0.1)";
          ctx.lineWidth = 1;
          ctx.beginPath();
          const g1 = project(xStart + slatWidth * 0.35, 0, 0);
          const g2 = project(xStart + slatWidth * 0.35, pW, 0);
          ctx.moveTo(g1.x, g1.y);
          ctx.lineTo(g2.x, g2.y);
          ctx.stroke();
        }

        // 2. FRONT-LEFT EDGE EXTRUSION OF PALLET FACE (X = pL, Z = 0 to -25)
        const flEdge = [
          project(pL, 0, 0),
          project(pL, pW, 0),
          project(pL, pW, -25),
          project(pL,  0, -25),
        ];
        drawPoly(flEdge, woodShadeColor, woodLineColor, 1.5);

        // 3. FRONT-RIGHT EDGE EXTRUSION OF PALLET FACE (Y = pW, Z = 0 to -25)
        const frEdge = [
          project(0, pW, 0),
          project(pL, pW, 0),
          project(pL, pW, -25),
          project(0, pW, -25),
        ];
        drawPoly(frEdge, woodShadeColor, woodLineColor, 1.5);

        // 4. BOTTOM SUPPORT LUMBER BEAM RUNNERS (Z = -25 to Z = -110)
        const runnersY = [
          { start: 0, end: 110 },
          { start: pW / 2 - 55, end: pW / 2 + 55 },
          { start: pW - 110, end: pW }
        ];

        runnersY.forEach((run, idx) => {
          // Front-facing side of rightmost runner (at Y = pW)
          if (idx === 2) {
            const runRightSide = [
              project(0, pW, -25),
              project(pL, pW, -25),
              project(pL, pW, -110),
              project(0, pW, -110)
            ];
            drawPoly(runRightSide, woodShadeColor, woodLineColor, 1.5);
          }

          // Front-left end faces of runners visible at X = pL
          const runEndFace = [
            project(pL, run.start, -25),
            project(pL, run.end, -25),
            project(pL, run.end, -110),
            project(pL, run.start, -110)
          ];
          drawPoly(runEndFace, woodShadeColor, woodLineColor, 1.5);
        });
      }
    };

    // Draw theoretical wireframe maximum limit boundaries cage
    const drawBoundingCage = () => {
      const isCarton = pallet.baseType === "carton";

      if (isCarton) {
        // Draw elegant cardboard carton bounding wireframes and semi-transparent walls
        ctx.strokeStyle = "rgba(108, 69, 27, 0.4)";
        ctx.lineWidth = 1.2;
        
        const base = [
          project(0, 0, 0),
          project(pL, 0, 0),
          project(pL, pW, 0),
          project(0, pW, 0),
        ];
        const top = [
          project(0, 0, pH),
          project(pL, 0, pH),
          project(pL, pW, pH),
          project(0, pW, pH),
        ];

        // Draw transparent FRONT-LEFT wall (at Y = pW)
        const wallFrontLeft = [
          project(0, pW, 0),
          project(pL, pW, 0),
          project(pL, pW, pH),
          project(0, pW, pH),
        ];
        // Draw transparent FRONT-RIGHT wall (at X = pL)
        const wallFrontRight = [
          project(pL, 0, 0),
          project(pL, pW, 0),
          project(pL, pW, pH),
          project(pL, 0, pH),
        ];

        // Fill them with high transparency cardboard-brown
        ctx.fillStyle = "rgba(189, 137, 85, 0.04)";
        
        ctx.beginPath();
        ctx.moveTo(wallFrontLeft[0].x, wallFrontLeft[0].y);
        for(let i=1; i<4; i++) ctx.lineTo(wallFrontLeft[i].x, wallFrontLeft[i].y);
        ctx.closePath();
        ctx.fill();

        ctx.beginPath();
        ctx.moveTo(wallFrontRight[0].x, wallFrontRight[0].y);
        for(let i=1; i<4; i++) ctx.lineTo(wallFrontRight[i].x, wallFrontRight[i].y);
        ctx.closePath();
        ctx.fill();

        // Draw the main borders of the outer container box
        ctx.beginPath();
        // vertical corners
        for (let i = 0; i < 4; i++) {
          ctx.moveTo(base[i].x, base[i].y);
          ctx.lineTo(top[i].x, top[i].y);
        }
        // top loop
        ctx.moveTo(top[0].x, top[0].y);
        for (let i = 1; i < 4; i++) ctx.lineTo(top[i].x, top[i].y);
        ctx.closePath();
        ctx.stroke();

      } else {
        ctx.strokeStyle = "rgba(115, 115, 115, 0.22)";
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);

        const base = [
          project(0, 0, 0),
          project(pL, 0, 0),
          project(pL, pW, 0),
          project(0, pW, 0),
        ];
        const top = [
          project(0, 0, pH),
          project(pL, 0, pH),
          project(pL, pW, pH),
          project(0, pW, pH),
        ];

        // Draw sides
        for (let i = 0; i < 4; i++) {
          ctx.beginPath();
          ctx.moveTo(base[i].x, base[i].y);
          ctx.lineTo(top[i].x, top[i].y);
          ctx.stroke();
        }

        // Draw top contour
        ctx.beginPath();
        ctx.moveTo(top[0].x, top[0].y);
        for (let i = 1; i < 4; i++) {
          ctx.lineTo(top[i].x, top[i].y);
        }
        ctx.closePath();
        ctx.stroke();

        ctx.setLineDash([]); // clear dash
      }
    };

    // Render the cartoon boxes filled completely solid and opaque, sorted correctly back-to-front
    const drawBoxes = () => {
      if (!simulationResult || simulationResult.placedBoxes.length === 0) return;

      // Filter boxes by level if active
      let blocks = [...simulationResult.placedBoxes];
      if (selectedLayerIndex !== "all") {
        blocks = blocks.filter((bx) => bx.layerIndex === selectedLayerIndex);
      }

      // **CRITICAL PAINTERS ALGORITHM SORT**:
      // We evaluate the 3D transformed coordinate depth center of each box.
      // Larger depth values represent items closer to the frontmost corner, which should render later.
      blocks.sort((a, b) => {
        const depthA = a.x + a.l / 2 + (a.y + a.w / 2) + (a.z + a.h / 2) * 1.5;
        const depthB = b.x + b.l / 2 + (b.y + b.w / 2) + (b.z + b.h / 2) * 1.5;
        return depthA - depthB;
      });

      // Draw each solid cuboid block
      blocks.forEach((bx) => {
        // Find sequential placement index of this box to schedule staggered popping
        const seqIndex = simulationResult.placedBoxes.indexOf(bx);
        const prevCount = animatingPrevCountRef.current || 0;
        let scale = 1.0;

        if (seqIndex >= prevCount) {
          const relativeIndex = seqIndex - prevCount;
          const staggerDelay = 120; // ms stagger
          const boxStartTime = relativeIndex * staggerDelay;

          if (animationElapsed < boxStartTime) {
            // Box hasn't popped/entered yet in placement sequence
            return;
          }

          const boxElapsed = animationElapsed - boxStartTime;
          const t = Math.min(1.0, boxElapsed / 300); // 300ms pop duration
          
          // easeOutBack overshoot easing curve
          const k = 1.6;
          const easeOutBack = (x: number): number => {
            const c1 = k;
            const c3 = c1 + 1;
            return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2);
          };
          scale = t === 1.0 ? 1.0 : easeOutBack(t);
        }

        // Scale box from bottom-center
        const centerX = bx.x + bx.l / 2;
        const centerY = bx.y + bx.w / 2;
        const l_animated = bx.l * scale;
        const w_animated = bx.w * scale;
        const h_animated = bx.h * scale;

        const bx_x = centerX - l_animated / 2;
        const bx_y = centerY - w_animated / 2;
        const bx_z = bx.z;
        const bx_l = l_animated;
        const bx_w = w_animated;
        const bx_h = h_animated;

        // Core coordinate corners
        const c000 = project(bx_x, bx_y, bx_z);
        const c100 = project(bx_x + bx_l, bx_y, bx_z);
        const c110 = project(bx_x + bx_l, bx_y + bx_w, bx_z);
        const c010 = project(bx_x, bx_y + bx_w, bx_z);

        const c001 = project(bx_x, bx_y, bx_z + bx_h);
        const c101 = project(bx_x + bx_l, bx_y, bx_z + bx_h);
        const c111 = project(bx_x + bx_l, bx_y + bx_w, bx_z + bx_h);
        const c011 = project(bx_x, bx_y + bx_w, bx_z + bx_h);

        // Opaque solid choosing
        let baseColor = bx.color;
        if (colorScheme === "weight") {
          const weightRatio = Math.min(1, bx.weight / 20);
          baseColor = `rgb(${Math.floor(20 + 200 * (1 - weightRatio))}, ${Math.floor(80 + 120 * (1 - weightRatio))}, ${Math.floor(100 + 155 * weightRatio)})`;
        } else if (colorScheme === "friction") {
          const f = bx.frictionCoeff;
          if (f < 0.3) {
            baseColor = "#ef4444";
          } else if (f < 0.45) {
            baseColor = "#f59e0b";
          } else {
            baseColor = "#10b981";
          }
        }

        const drawFace = (pts: { x: number; y: number }[], fillColor: string, strokeColor = "rgba(15, 23, 42, 0.25)") => {
          ctx.fillStyle = fillColor;
          ctx.strokeStyle = strokeColor;
          ctx.lineWidth = 1.0;
          ctx.beginPath();
          ctx.moveTo(pts[0].x, pts[0].y);
          for (let i = 1; i < pts.length; i++) {
            ctx.lineTo(pts[i].x, pts[i].y);
          }
          ctx.closePath();
          ctx.fill();
          ctx.stroke();
        };

        // A. HIGH-FINESS AMBIENT SHADOW CAST UNDER EACH BOX
        const shadowOffset = 10 * scale;
        const s000 = project(bx_x + shadowOffset, bx_y + shadowOffset, bx_z);
        const s100 = project(bx_x + bx_l + shadowOffset, bx_y + shadowOffset, bx_z);
        const s110 = project(bx_x + bx_l + shadowOffset, bx_y + bx_w + shadowOffset, bx_z);
        const s010 = project(bx_x + shadowOffset, bx_y + bx_w + shadowOffset, bx_z);
        drawFace([s000, s100, s110, s010], "rgba(15, 23, 42, 0.16)", "transparent");

        // B. THREE VISIBLE FACES IN ORDER: SIDES FIRST, TOP SURFACE LAST TO FORM A CLOSED SOLID
        
        // 1. Front-Left Face (darker shadow side facing down-left)
        drawFace([c100, c110, c111, c101], baseColor);
        ctx.fillStyle = "rgba(0, 0, 0, 0.18)";
        ctx.beginPath();
        ctx.moveTo(c100.x, c100.y);
        ctx.lineTo(c110.x, c110.y);
        ctx.lineTo(c111.x, c111.y);
        ctx.lineTo(c101.x, c101.y);
        ctx.closePath();
        ctx.fill();

        // 2. Front-Right Face (medium shadow side facing down-right)
        drawFace([c010, c110, c111, c011], baseColor);
        ctx.fillStyle = "rgba(0, 0, 0, 0.08)";
        ctx.beginPath();
        ctx.moveTo(c010.x, c010.y);
        ctx.lineTo(c110.x, c110.y);
        ctx.lineTo(c111.x, c111.y);
        ctx.lineTo(c011.x, c011.y);
        ctx.closePath();
        ctx.fill();

        // 3. Top Face (brightest light side facing straight up)
        drawFace([c001, c101, c111, c011], baseColor);
        // Highlight layer on top to give a light reflecting glint
        ctx.fillStyle = "rgba(255, 255, 255, 0.15)";
        ctx.beginPath();
        ctx.moveTo(c001.x, c001.y);
        ctx.lineTo(c101.x, c101.y);
        ctx.lineTo(c111.x, c111.y);
        ctx.lineTo(c011.x, c011.y);
        ctx.closePath();
        ctx.fill();

        // Standard Packaging brown polymer tape running down the center along length (X axis)
        const tL1 = project(bx_x, bx_y + bx_w * 0.42, bx_z + bx_h);
        const tR1 = project(bx_x + bx_l, bx_y + bx_w * 0.42, bx_z + bx_h);
        const tR2 = project(bx_x + bx_l, bx_y + bx_w * 0.58, bx_z + bx_h);
        const tL2 = project(bx_x, bx_y + bx_w * 0.58, bx_z + bx_h);
        drawFace([tL1, tR1, tR2, tL2], "rgba(146, 64, 14, 0.48)", "rgba(146, 64, 14, 0.72)");

        // C. CRISP 3D BEVEL CORNER HIGHLIGHTING
        ctx.strokeStyle = "rgba(255, 255, 255, 0.28)";
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(c001.x, c001.y);
        ctx.lineTo(c101.x, c101.y);
        ctx.lineTo(c111.x, c111.y);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(c110.x, c110.y);
        ctx.lineTo(c111.x, c111.y);
        ctx.stroke();

        // D. SHIPPING LABEL / BADGES
        if (zoom > 0.12 && bx_h > 80) {
          const faceCenterX = (c010.x + c110.x + c111.x + c011.x) / 4;
          const faceCenterY = (c010.y + c110.y + c111.y + c011.y) / 4;

          if (bx_l >= 150 && bx_h >= 120 && colorScheme === "type") {
            const lX1 = bx_x + bx_l * 0.22;
            const lX2 = bx_x + bx_l * 0.78;
            const lZ1 = bx_z + bx_h * 0.22;
            const lZ2 = bx_z + bx_h * 0.78;

            const l00 = project(lX1, bx_y + bx_w, lZ1);
            const l10 = project(lX2, bx_y + bx_w, lZ1);
            const l11 = project(lX2, bx_y + bx_w, lZ2);
            const l01 = project(lX1, bx_y + bx_w, lZ2);

            // Draw shipping label white background
            drawFace([l00, l10, l11, l01], "rgba(255, 255, 255, 0.95)", "rgba(0, 0, 0, 0.2)");

            // Draw tiny barcode lines on label
            ctx.strokeStyle = "rgba(15, 23, 42, 0.9)";
            ctx.lineWidth = 1;
            const barcodePositions = [0.35, 0.45, 0.5, 0.6, 0.65, 0.7, 0.8];
            barcodePositions.forEach(p => {
              const botX = l00.x + (l10.x - l00.x) * p;
              const botY = l00.y + (l10.y - l00.y) * p;
              const tpX = l01.x + (l11.x - l01.x) * p;
              const tpY = l01.y + (l11.y - l01.y) * p;
              ctx.beginPath();
              ctx.moveTo(botX, botY);
              ctx.lineTo(tpX, tpY);
              ctx.stroke();
            });

            // Draw tiny text of weight on the label
            ctx.fillStyle = "#0f172a";
            ctx.font = "bold 8px monospace";
            ctx.textAlign = "center";
            ctx.fillText(`${bx.weight} kg`, faceCenterX, faceCenterY - 4);
          } else {
            // Draw clean shadow text directly on the cardboard side
            ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
            ctx.font = "bold 9px monospace";
            ctx.textAlign = "center";
            ctx.fillText(`${bx.weight} kg`, faceCenterX + 1, faceCenterY + 1);
            ctx.fillStyle = "rgba(255, 255, 255, 0.95)";
            ctx.fillText(`${bx.weight} kg`, faceCenterX, faceCenterY);
          }
        }

        // E. OVERLAY BOX STABILITY & SUPPORT CONTACTS
        if (showBoxStabilityDetails && scale > 0.85) {
          const topCenterX = (c001.x + c101.x + c111.x + c011.x) / 4;
          const topCenterY = (c001.y + c101.y + c111.y + c011.y) / 4;

          const pct = bx.supportPercentage ?? 100;
          const area = bx.supportAreaMm2 ?? (bx.l * bx.w);

          // Draw a small dark backdrop box for legibility
          ctx.fillStyle = "rgba(15, 23, 42, 0.88)";
          ctx.beginPath();
          const rectW = 80;
          const rectH = 26;
          ctx.rect(topCenterX - rectW/2, topCenterY - rectH/2, rectW, rectH);
          ctx.fill();

          ctx.lineWidth = 1;
          ctx.strokeStyle = pct < 60 ? "#f87171" : pct < 85 ? "#fbbf24" : "#34d399";
          ctx.beginPath();
          ctx.rect(topCenterX - rectW/2, topCenterY - rectH/2, rectW, rectH);
          ctx.stroke();

          ctx.fillStyle = "#ffffff";
          ctx.font = "bold 8px monospace";
          ctx.textAlign = "center";
          ctx.fillText(`${pct.toFixed(1)}% Spt`, topCenterX, topCenterY - 3);
          
          ctx.fillStyle = pct < 60 ? "#f87171" : pct < 85 ? "#fbe084" : "#a7f3d0";
          ctx.font = "7px monospace";
          ctx.fillText(`${area.toLocaleString()} mm²`, topCenterX, topCenterY + 7);
        }
      });
    };

    // Draw the Center of Gravity (CG) indicator
    const drawCGTarget = () => {
      if (!simulationResult || simulationResult.placedBoxes.length === 0) return;

      const cg = simulationResult.centerOfGravity;
      const cgProj = project(cg.x, cg.y, cg.z);
      const cgFloorProj = project(cg.x, cg.y, 0);

      // Low footprint glowing shadow at CG spot on raw wood floor
      ctx.fillStyle = "rgba(239, 68, 68, 0.15)";
      ctx.beginPath();
      ctx.arc(cgFloorProj.x, cgFloorProj.y, 16, 0, Math.PI * 2);
      ctx.fill();

      // Draw vertical plumb line from CG coordinates to wooden Pallet Ground Floor
      ctx.strokeStyle = "rgba(239, 68, 68, 0.85)";
      ctx.lineWidth = 1.6;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(cgProj.x, cgProj.y);
      ctx.lineTo(cgFloorProj.x, cgFloorProj.y);
      ctx.stroke();
      ctx.setLineDash([]);

      // Plumb intercept target decal on wooden deck
      ctx.fillStyle = "rgba(239, 68, 68, 0.25)";
      ctx.strokeStyle = "#ef4444";
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      const f1 = project(cg.x - 80, cg.y, 0);
      const f2 = project(cg.x + 80, cg.y, 0);
      const f3 = project(cg.x, cg.y - 80, 0);
      const f4 = project(cg.x, cg.y + 80, 0);
      ctx.moveTo(f1.x, f1.y); ctx.lineTo(f2.x, f2.y);
      ctx.moveTo(f3.x, f3.y); ctx.lineTo(f4.x, f4.y);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(cgFloorProj.x, cgFloorProj.y, 9, 0, Math.PI * 2);
      ctx.stroke();

      // Glowing physics CG sphere
      const cgGrad = ctx.createRadialGradient(cgProj.x, cgProj.y, 1, cgProj.x, cgProj.y, 8);
      cgGrad.addColorStop(0, "#ffffff");
      cgGrad.addColorStop(0.3, "#facc15"); // gold center
      cgGrad.addColorStop(1, "rgba(220, 38, 38, 0.9)"); // red crown glowing edge

      ctx.fillStyle = cgGrad;
      ctx.beginPath();
      ctx.arc(cgProj.x, cgProj.y, 6.5, 0, Math.PI * 2);
      ctx.fill();

      // Coordinates text labels
      ctx.font = "bold 9px monospace";
      ctx.textAlign = "left";
      ctx.fillStyle = "#ef4444";
      ctx.fillText(` CG (${cg.x.toFixed(0)},${cg.y.toFixed(0)},${cg.z.toFixed(0)})`, cgProj.x + 11, cgProj.y + 3);
    };

    // Draw simulated End Effector and compute collision warnings
    const drawEndEffectorSim = () => {
      if (!simulationResult || simulationResult.placedBoxes.length === 0) return;
      const bx = simulationResult.placedBoxes[selectedYamahaStepIndex];
      if (!bx) return;

      const eeL = rcxEndEffectorL;
      const eeW = rcxEndEffectorW;
      const eeH = rcxEndEffectorH;

      // End Effector bounding box coords
      const ee_minX = (bx.x + bx.l / 2) - eeL / 2;
      const ee_maxX = (bx.x + bx.l / 2) + eeL / 2;
      const ee_minY = (bx.y + bx.w / 2) - eeW / 2;
      const ee_maxY = (bx.y + bx.w / 2) + eeW / 2;
      const ee_minZ = bx.z + bx.h;
      const ee_maxZ = bx.z + bx.h + eeH;

      // Check collision with already placed boxes (sequence index < selectedYamahaStepIndex)
      let collisionDetected = false;

      for (let i = 0; i < selectedYamahaStepIndex; i++) {
        const otherBx = simulationResult.placedBoxes[i];
        const b_minX = otherBx.x;
        const b_maxX = otherBx.x + otherBx.l;
        const b_minY = otherBx.y;
        const b_maxY = otherBx.y + otherBx.w;
        const b_minZ = otherBx.z;
        const b_maxZ = otherBx.z + otherBx.h;

        const xOverlap = ee_minX < b_maxX && ee_maxX > b_minX;
        const yOverlap = ee_minY < b_maxY && ee_maxY > b_minY;
        const zOverlap = ee_minZ < b_maxZ && ee_maxZ > b_minZ;

        if (xOverlap && yOverlap && zOverlap) {
          collisionDetected = true;
          break;
        }
      }

      // Draw End Effector Cuboid
      const ec000 = project(ee_minX, ee_minY, ee_minZ);
      const ec100 = project(ee_maxX, ee_minY, ee_minZ);
      const ec110 = project(ee_maxX, ee_maxY, ee_minZ);
      const ec010 = project(ee_minX, ee_maxY, ee_minZ);

      const ec001 = project(ee_minX, ee_minY, ee_maxZ);
      const ec101 = project(ee_maxX, ee_minY, ee_maxZ);
      const ec111 = project(ee_maxX, ee_maxY, ee_maxZ);
      const ec011 = project(ee_minX, ee_maxY, ee_maxZ);

      const fillCol = collisionDetected ? "rgba(239, 68, 68, 0.45)" : "rgba(6, 182, 212, 0.3)";
      const strokeCol = collisionDetected ? "#ef4444" : "#06b6d4";

      const drawFace = (pts: { x: number; y: number }[], fCol: string, sCol: string) => {
        ctx.fillStyle = fCol;
        ctx.strokeStyle = sCol;
        ctx.lineWidth = 1.2;
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let j = 1; j < pts.length; j++) ctx.lineTo(pts[j].x, pts[j].y);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      };

      // Draw faces in depth order
      drawFace([ec100, ec110, ec111, ec101], fillCol, strokeCol); // Front-Left
      drawFace([ec010, ec110, ec111, ec011], fillCol, strokeCol); // Front-Right
      drawFace([ec001, ec101, ec111, ec011], fillCol, strokeCol); // Top Face

      // Draw mechanical shaft up
      ctx.strokeStyle = strokeCol;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      const topCenterProj = project(bx.x + bx.l / 2, bx.y + bx.w / 2, ee_maxZ);
      const topExtendProj = project(bx.x + bx.l / 2, bx.y + bx.w / 2, ee_maxZ + 60);
      ctx.moveTo(topCenterProj.x, topCenterProj.y);
      ctx.lineTo(topExtendProj.x, topExtendProj.y);
      ctx.stroke();

      // Label banner
      const bannerX = (ec001.x + ec111.x) / 2;
      const bannerY = Math.min(ec001.y, ec111.y) - 16;

      ctx.fillStyle = collisionDetected ? "rgba(220, 38, 38, 0.9)" : "rgba(15, 23, 42, 0.8)";
      ctx.beginPath();
      ctx.rect(bannerX - 55, bannerY - 8, 110, 16);
      ctx.fill();

      ctx.strokeStyle = strokeCol;
      ctx.lineWidth = 1.0;
      ctx.strokeRect(bannerX - 55, bannerY - 8, 110, 16);

      ctx.fillStyle = "#ffffff";
      ctx.font = "bold 7.5px monospace";
      ctx.textAlign = "center";
      ctx.fillText(collisionDetected ? "⚠️ COLLISION DETECTED" : "TCP EFF SIM OK", bannerX, bannerY + 3);
    };

    // Draw coordinate, base, boundaries and cargo in strict z-buffer layout order
    drawAxes();
    drawPalletStructure();
    drawBoundingCage();
    drawBoxes();
    drawCGTarget();
    drawEndEffectorSim();

  }, [pallet, cameraZoom, simulationResult, selectedLayerIndex, colorScheme, showBoxStabilityDetails, animationElapsed, selectedYamahaStepIndex, rcxEndEffectorL, rcxEndEffectorW, rcxEndEffectorH]);

  // Handle repaint triggers
  useEffect(() => {
    draw3DPallet();
  }, [draw3DPallet]);

  // Adjust zoom levels
  const adjustZoom = (amount: number) => {
    setCameraZoom((prev) => Math.max(0.08, Math.min(0.6, prev + amount)));
  };

  // Trigger camera resets
  const resetCamera = () => {
    setCameraZoom(0.22);
  };

  // Total cartons queued count
  const totalCartonsEntered = cartons.reduce((acc, c) => acc + c.quantity, 0);

  // Derived active system notifications
  const activeNotifications: {
    id: string;
    type: "warning" | "danger" | "info" | "success";
    title: string;
    message: string;
    action?: { label: string; onClick: () => void };
  }[] = [];

  let worstMetricLabel = "";

  if (simulationResult) {
    const score = simulationResult.stabilityScore;
    if (score < 60) {
      if (!dismissedWarnings.includes("stability-low")) {
        activeNotifications.push({
          id: "stability-low",
          type: "danger",
          title: "Critical Pallet Stability",
          message: `Pallet stability stands at ${score}%, which is below the safe operating minimum of 60%. Highly susceptible to transit collapse under dynamic cargo shifts.`,
          action: pallet.interlockType !== "pinwheel" ? {
            label: "Switch to Pinwheel Mode",
            onClick: () => setPallet((prev) => ({ ...prev, interlockType: "pinwheel" }))
          } : undefined
        });
      }
    }

    // Check if overhang rating is terrible
    if (simulationResult.metricBreakdowns.baseSupport < 15) {
      if (!dismissedWarnings.includes("base-support-low")) {
        activeNotifications.push({
          id: "base-support-low",
          type: "warning",
          title: "Unsupported Overhang Hazard",
          message: `Base support area is sub-optimal (${simulationResult.metricBreakdowns.baseSupport}/25 pts). Cartons on intermediate layers are exceeding stable gravity alignments.`,
          action: {
            label: "Increase Default Gap",
            onClick: () => setPallet((prev) => ({ ...prev, defaultGap: Math.max(12, prev.defaultGap + 4) }))
          }
        });
      }
    }

    // Check weight hierarchy
    if (simulationResult.metricBreakdowns.weightHierarchy < 15) {
      if (!dismissedWarnings.includes("weight-hierarchy-bad")) {
        activeNotifications.push({
          id: "weight-hierarchy-bad",
          type: "warning",
          title: "Vertical Mass Inversion",
          message: `Heavier boxes are packed at high coordinates (${simulationResult.metricBreakdowns.weightHierarchy}/25 pts). Highly top-heavy structures compromise kinetic load distribution. Check carton weights.`,
        });
      }
    }

    // Calculate underperforming metrics
    const { cgAlignment, baseSupport, weightHierarchy, interlocking, frictionPhysics } = simulationResult.metricBreakdowns;
    const scores = [
      { name: "Center of Gravity Placement", pct: cgAlignment / 25 },
      { name: "Overhang / Base Support Area", pct: baseSupport / 25 },
      { name: "Vertical Weight Hierarchy (Heaviest on Bottom)", pct: weightHierarchy / 25 },
      { name: "Interlocking Layer Overlap", pct: interlocking / 15 },
      { name: "Surface Friction Resistance", pct: frictionPhysics / 10 }
    ];
    scores.sort((a, b) => a.pct - b.pct);
    if (scores[0].pct < 0.7) {
      worstMetricLabel = scores[0].name;
    }
  }

  return (
    <div className="min-h-screen bg-[#0E0E12] text-[#F3F4F6] flex flex-col font-sans selection:bg-[#0A84FF] selection:text-white">
      {/* MACBOOK STYLE HEADER / TITLEBAR */}
      <header className="border-b border-[#2C2C2E]/70 bg-[#1C1C1E]/80 backdrop-blur-xl px-5 py-3 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-50 shadow-sm">
        {/* macOS Traffic Light Window Controls & Title */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 shrink-0 select-none">
            <div className="w-3 h-3 rounded-full bg-[#FF5F56] border border-[#E0443E]/20" />
            <div className="w-3 h-3 rounded-full bg-[#FFBD2E] border border-[#DEA123]/20" />
            <div className="w-3 h-3 rounded-full bg-[#27C93F] border border-[#1AAB29]/20" />
          </div>
          
          <div className="h-4 w-[1px] bg-[#2C2C2E] mx-1" />

          <div className="flex items-center gap-2">
            <h1 className="text-base font-bold tracking-tight text-white font-sans">
              Soolomon
            </h1>
            <span className="text-[10px] bg-[#2C2C2E] text-slate-450 px-2 py-0.5 rounded font-medium select-none">
              3D Smart Palletizer
            </span>
          </div>
        </div>

        {/* MacBook App Segmented Tab Control */}
        <div className="flex items-center gap-4">
          <div className="flex bg-[#2C2C2E]/60 p-0.5 rounded-lg border border-[#3A3A3C]/40 gap-0.5">
            <button
              onClick={() => setActivePage("hmi")}
              className={`px-3.5 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all outline-none duration-150 ${
                activePage === "hmi"
                  ? "bg-[#3A3A3C] text-white font-bold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Dashboard</span>
            </button>
            <button
              id="palletSettingsBtn"
              onClick={() => setActivePage("pallet-settings")}
              className={`px-3.5 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all outline-none duration-150 ${
                activePage === "pallet-settings"
                  ? "bg-[#3A3A3C] text-white font-bold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Base & Rules</span>
            </button>
            <button
              id="robotSettingsBtn"
              onClick={() => setActivePage("robot-settings")}
              className={`px-3.5 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all outline-none duration-150 ${
                activePage === "robot-settings"
                  ? "bg-[#3A3A3C] text-white font-bold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Cpu className="w-3.5 h-3.5" />
              <span>Robot Setup</span>
            </button>
            <button
              onClick={() => setActivePage("operator-hmi")}
              className={`px-3.5 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 transition-all outline-none duration-150 ${
                activePage === "operator-hmi"
                  ? "bg-[#3A3A3C] text-white font-bold"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Terminal className="w-3.5 h-3.5" />
              <span>Touch HMI</span>
            </button>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" />
            <span className="hidden sm:inline">Connected</span>
          </div>

          <button
            onClick={() => fetchCartons()}
            className="p-1.5 rounded-md bg-[#2C2C2E] hover:bg-[#3A3A3C] text-slate-200 border border-[#3A3A3C] transition-all"
            title="Refresh database"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* PERSISTENT CRITICAL STABILITY ALARM HUD */}
      {simulationResult && simulationResult.stabilityScore < 60 && (
        <div className="bg-[#1C1315] border-b border-[#FF453A]/30 px-6 py-3.5 flex items-center justify-between gap-4 transition-all">
          <div className="flex items-center gap-3">
            <div className="w-2.5 h-2.5 rounded-full bg-[#FF453A] animate-pulse shrink-0" />
            <div className="text-xs text-slate-300 leading-snug">
              <span className="font-bold text-white block sm:inline">Stack Stability Warning &middot; </span>
              The configuration stability is currently at <span className="font-bold text-[#FF453A] font-mono">{simulationResult.stabilityScore}%</span>, which is below the safe threshold of <span className="font-medium text-white">60%</span>. Alternate interlocking or smaller box profiles are recommended to prevent shift.
            </div>
          </div>
          <div className="flex gap-2 shrink-0">
            {pallet.interlockType !== "pinwheel" && (
              <button
                onClick={() => setPallet(prev => ({ ...prev, interlockType: "pinwheel" }))}
                className="bg-[#3A1E22] hover:bg-[#52292E] text-[#FF453A] font-semibold text-[11px] px-3 py-1.5 rounded-md border border-[#FF453A]/20 transition-all"
              >
                Apply Pinwheel Interlock
              </button>
            )}
          </div>
        </div>
      )}

      {/* CORE WORKSPACE DASHBOARD */}
      {activePage === "pallet-settings" ? (
        <main className="flex-1 p-6 max-w-3xl mx-auto w-full flex flex-col gap-6">
          {/* HEADER PATH */}
          <div className="bg-slate-950/55 rounded-xl border border-slate-800/80 p-5 shadow-md flex items-center justify-between animate-fade-in">
            <div className="flex items-center gap-3">
              <div className="bg-teal-500/10 p-2.5 rounded-lg text-teal-400">
                <Settings className="w-5 h-5 animate-spin-slow" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white tracking-wide">Loader Base & Stack Rules Settings</h2>
                <p className="text-xs text-slate-400">Define dimensional constraints, clearance spacing gaps, interlocking modes, and queue placement rules.</p>
              </div>
            </div>
            
            <button
              onClick={() => setActivePage("hmi")}
              className="px-4 py-2 bg-teal-500 hover:bg-teal-400 text-slate-950 rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow"
            >
              <span>&larr; Back to HMI Dashboard</span>
            </button>
          </div>

          {/* PARAMETERS FORM CONTAINER */}
          <div className="bg-slate-950/55 rounded-xl border border-slate-800/80 p-6 shadow-md flex flex-col gap-6">
            
            {/* Segmented Selector for Pallet vs Master Carton */}
            <div className="bg-slate-900/40 p-4 rounded-xl border border-slate-900 flex flex-col gap-2.5">
              <span className="text-xs uppercase font-mono tracking-wider font-semibold text-slate-400">Target Cargo Base Platform:</span>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setPallet(prev => ({ ...prev, baseType: "pallet" }))}
                  className={`text-xs py-2 px-3 rounded-md font-semibold border transition ${
                    pallet.baseType !== "carton"
                      ? "bg-teal-500 text-slate-950 border-teal-400 font-bold shadow-md shadow-teal-500/10"
                      : "bg-slate-900/60 border-slate-850 text-slate-400 hover:text-white"
                  }`}
                >
                  木 Wood Pallet Target Base
                </button>
                <button
                  type="button"
                  onClick={() => setPallet(prev => ({ ...prev, baseType: "carton" }))}
                  className={`text-xs py-2 px-3 rounded-md font-semibold border transition ${
                    pallet.baseType === "carton"
                      ? "bg-amber-500 text-slate-950 border-amber-400 font-bold shadow-md shadow-amber-500/10"
                      : "bg-slate-900/60 border-slate-850 text-slate-400 hover:text-white"
                  }`}
                >
                  📦 Master Carton Target Container Base
                </button>
              </div>
            </div>

            {/* Dimensional inputs */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs text-slate-400 mb-1 font-medium font-mono">
                  {pallet.baseType === "carton" ? "Carton Length (L) - mm" : "Length (L) - mm"}
                </label>
                <input
                  type="number"
                  value={palletLengthStr}
                  onChange={(e) => {
                    setPalletLengthStr(e.target.value);
                    const val = parseInt(e.target.value);
                    if (!isNaN(val) && val >= 50) {
                      setPallet(prev => ({ ...prev, length: val }));
                    }
                  }}
                  onBlur={() => {
                    const clamped = Math.max(200, Math.min(10000, parseInt(palletLengthStr) || 1100));
                    setPalletLengthStr(clamped.toString());
                    setPallet(prev => ({ ...prev, length: clamped }));
                  }}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-400 font-mono"
                />
              </div>
              
              <div>
                <label className="block text-xs text-slate-400 mb-1 font-medium font-mono">
                  {pallet.baseType === "carton" ? "Carton Width (W) - mm" : "Width (W) - mm"}
                </label>
                <input
                  type="number"
                  value={palletWidthStr}
                  onChange={(e) => {
                    setPalletWidthStr(e.target.value);
                    const val = parseInt(e.target.value);
                    if (!isNaN(val) && val >= 50) {
                      setPallet(prev => ({ ...prev, width: val }));
                    }
                  }}
                  onBlur={() => {
                    const clamped = Math.max(200, Math.min(10000, parseInt(palletWidthStr) || 1100));
                    setPalletWidthStr(clamped.toString());
                    setPallet(prev => ({ ...prev, width: clamped }));
                  }}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-400 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1 font-medium font-mono">
                  {pallet.baseType === "carton" ? "Carton Height (H) - mm" : "Height limit (H) - mm"}
                </label>
                <input
                  type="number"
                  value={palletHeightStr}
                  onChange={(e) => {
                    setPalletHeightStr(e.target.value);
                    const val = parseInt(e.target.value);
                    if (!isNaN(val) && val >= 50) {
                      setPallet(prev => ({ ...prev, height: val }));
                    }
                  }}
                  onBlur={() => {
                    const clamped = Math.max(200, Math.min(10000, parseInt(palletHeightStr) || 1100));
                    setPalletHeightStr(clamped.toString());
                    setPallet(prev => ({ ...prev, height: clamped }));
                  }}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-400 font-mono"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1 font-medium font-mono">Clearance Gaps - mm</label>
                <input
                  type="number"
                  value={palletGapStr}
                  onChange={(e) => {
                    setPalletGapStr(e.target.value);
                    const val = parseInt(e.target.value);
                    if (!isNaN(val) && val >= 0) {
                      setPallet(prev => ({ ...prev, defaultGap: val }));
                    }
                  }}
                  onBlur={() => {
                    const clamped = Math.max(0, Math.min(500, parseInt(palletGapStr) || 0));
                    setPalletGapStr(clamped.toString());
                    setPallet(prev => ({ ...prev, defaultGap: clamped }));
                  }}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-400 font-mono"
                />
              </div>

              <div className="md:col-span-2">
                <label className="block text-xs text-slate-400 mb-1 font-medium font-mono">Max Payload Capacity (kg)</label>
                <input
                  type="number"
                  value={palletMaxWeightStr}
                  onChange={(e) => {
                    setPalletMaxWeightStr(e.target.value);
                    const val = parseInt(e.target.value);
                    if (!isNaN(val) && val >= 1) {
                      setPallet(prev => ({ ...prev, maxWeight: val }));
                    }
                  }}
                  onBlur={() => {
                    const clamped = Math.max(10, Math.min(50000, parseInt(palletMaxWeightStr) || 1000));
                    setPalletMaxWeightStr(clamped.toString());
                    setPallet(prev => ({ ...prev, maxWeight: clamped }));
                  }}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:border-teal-400 font-mono"
                />
              </div>
            </div>

            {/* Stack Interlocking Mode (Only pinwheel and boundary-prefer remain) */}
            <div className="border-t border-slate-800/80 pt-4">
              <label className="block text-xs text-slate-300 font-semibold mb-1.5 uppercase tracking-wide">Stack Interlocking Mode</label>
              <div className="grid grid-cols-2 gap-3">
                {(["pinwheel", "boundary-prefer"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setPallet({ ...pallet, interlockType: mode })}
                    className={`text-xs py-2.5 px-3 rounded-lg font-medium border capitalize flex flex-col items-center gap-1 transition-all ${
                      pallet.interlockType === mode
                        ? "bg-teal-500/20 border-teal-400 text-teal-300 shadow-md shadow-teal-500/5 font-bold"
                        : "bg-slate-900/60 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-slate-300"
                    }`}
                  >
                    <span>{mode === "boundary-prefer" ? "Boundary Prefer" : "pinwheel"}</span>
                    <span className="text-[10px] text-slate-500 font-normal normal-case text-center">
                      {mode === "pinwheel" && "Concentric rotation surrounding structural layers of stacked cartons."}
                      {mode === "boundary-prefer" && "Force alignment directly along the outer bounds of the platform."}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Queue Placement Rule (Only fifo and vol-desc remain) */}
            <div className="border-t border-slate-800/80 pt-4">
              <label className="block text-xs text-slate-300 font-semibold mb-1.5 uppercase tracking-wide">Queue Placement Rule</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setPallet({ ...pallet, packSequence: "fifo" })}
                  className={`text-xs py-2.5 px-3 rounded-lg font-medium border flex flex-col items-center gap-1 transition-all ${
                    pallet.packSequence === "fifo"
                      ? "bg-teal-500/20 border-teal-400 text-teal-300 shadow-md shadow-teal-500/5 font-bold"
                      : "bg-slate-900/60 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-slate-300"
                  }`}
                >
                  <span>FIFO (Fixed Pos)</span>
                  <span className="text-[10px] text-slate-500 font-normal text-center">
                    Conveyor Mode: Packs cartons sequentially in insertion / queue order.
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => setPallet({ ...pallet, packSequence: "vol-desc" })}
                  className={`text-xs py-2.5 px-3 rounded-lg font-medium border flex flex-col items-center gap-1 transition-all ${
                    pallet.packSequence === "vol-desc"
                      ? "bg-teal-500/20 border-teal-400 text-teal-300 shadow-md shadow-teal-500/5 font-bold"
                      : "bg-slate-900/60 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-slate-300"
                  }`}
                >
                  <span>Volume Desc (3D-BPP)</span>
                  <span className="text-[10px] text-slate-500 font-normal text-center">
                    Volumetric Sort: Larger carton anchor bottom-tiers first to build a solid support base.
                  </span>
                </button>
              </div>
            </div>

            {/* CG Support Guard */}
            <div className="border-t border-slate-800/80 pt-4 flex items-center justify-between">
              <div className="max-w-[75%]">
                <span className="block text-xs text-slate-300 font-semibold uppercase tracking-wide">Center-of-Gravity (CG) Support Guard</span>
                <p className="text-[11px] text-slate-500 mt-1 leading-normal">
                  Disallow placing a carton if its horizontal projection center of gravity floats over empty space. Prevents overhang tipping collapses.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPallet(prev => ({ ...prev, checkCGSupport: !prev.checkCGSupport }))}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  pallet.checkCGSupport ? "bg-teal-500" : "bg-slate-800"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-slate-950 shadow ring-0 transition duration-200 ease-in-out ${
                    pallet.checkCGSupport ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* Presets Reload */}
            <div className="border-t border-slate-800/80 pt-4 flex justify-between items-center text-xs text-slate-450">
              <span>Return to factory definitions?</span>
              <button
                type="button"
                onClick={() => {
                  resetFactoryPresets();
                  setActivePage("hmi");
                }}
                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 rounded font-mono text-[10px] transition"
              >
                Reset System Presets
              </button>
            </div>

          </div>

          <button
            onClick={() => setActivePage("hmi")}
            className="w-full py-3 bg-teal-500 hover:bg-teal-400 text-slate-950 rounded-xl text-xs font-extrabold tracking-widest uppercase transition shadow shadow-teal-500/10 animate-pulse"
          >
            Apply Settings & Return to Dashboard
          </button>
        </main>
      ) : activePage === "robot-settings" ? (
        <main className="flex-1 p-6 max-w-7xl mx-auto w-full flex flex-col gap-6 animate-fade-in">
          {/* HEADER PATH */}
          <div className="bg-[#1C1C1E] rounded-2xl border border-[#2C2C2E]/70 p-5 shadow-sm flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="bg-[#0A84FF]/10 p-2.5 rounded-xl text-[#0A84FF]">
                <Cpu className="w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h2 className="text-base font-bold text-white tracking-tight">Robot Integration & Modbus Settings</h2>
                <p className="text-xs text-slate-400">Configure pickup origins, calibration scales, Modbus TCP addresses, and view the sequence program.</p>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-2.5">
              <button
                onClick={() => setShowYamahaGuide(true)}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition flex items-center gap-1.5 shadow-sm shrink-0 cursor-pointer"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Yamaha RCX Setup Guide &rarr;</span>
              </button>
              <button
                onClick={() => setActivePage("hmi")}
                className="px-4 py-2 bg-[#2C2C2E] hover:bg-[#3A3A3C] text-white border border-[#3A3A3C] rounded-lg text-xs font-semibold transition cursor-pointer"
              >
                &larr; Back to Dashboard
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* LEFT COLUMN: CALIBRATION ORIGINS & COOPERATIVE DRIVER CONFIGS */}
            <div className="lg:col-span-4 flex flex-col gap-6">
              {/* Placement Targets Calibrator */}
              <div className="bg-[#1C1C1E] rounded-2xl border border-[#2C2C2E]/70 p-5 shadow-sm">
                <h3 className="text-xs font-bold text-slate-350 tracking-wide uppercase mb-3 flex items-center gap-1.5 font-mono">
                  <Sliders className="w-3.5 h-3.5 text-[#0A84FF]" />
                  Placement Targets Alignment
                </h3>
                <WorkspaceCalibrator
                  rcxPickOriginXStr={rcxPickOriginXStr}
                  setRcxPickOriginXStr={setRcxPickOriginXStr}
                  rcxPickOriginYStr={rcxPickOriginYStr}
                  setRcxPickOriginYStr={setRcxPickOriginYStr}
                  rcxPickOriginZStr={rcxPickOriginZStr}
                  setRcxPickOriginZStr={setRcxPickOriginZStr}
                  rcxPickOriginRStr={rcxPickOriginRStr}
                  setRcxPickOriginRStr={setRcxPickOriginRStr}
                  
                  rcxPalletOriginXStr={rcxPalletOriginXStr}
                  setRcxPalletOriginXStr={setRcxPalletOriginXStr}
                  rcxPalletOriginYStr={rcxPalletOriginYStr}
                  setRcxPalletOriginYStr={setRcxPalletOriginYStr}
                  rcxPalletOriginZStr={rcxPalletOriginZStr}
                  setRcxPalletOriginZStr={setRcxPalletOriginZStr}
                  rcxPalletOriginRStr={rcxPalletOriginRStr}
                  setRcxPalletOriginRStr={setRcxPalletOriginRStr}
                  
                  rcxToolOffsetZStr={rcxToolOffsetZStr}
                  setRcxToolOffsetZStr={setRcxToolOffsetZStr}
                  rcxToolOffsetXStr={rcxToolOffsetXStr}
                  setRcxToolOffsetXStr={setRcxToolOffsetXStr}
                  rcxToolOffsetYStr={rcxToolOffsetYStr}
                  setRcxToolOffsetYStr={setRcxToolOffsetYStr}
                  rcxEndEffectorLStr={rcxEndEffectorLStr}
                  setRcxEndEffectorLStr={setRcxEndEffectorLStr}
                  rcxEndEffectorWStr={rcxEndEffectorWStr}
                  setRcxEndEffectorWStr={setRcxEndEffectorWStr}
                  rcxEndEffectorHStr={rcxEndEffectorHStr}
                  setRcxEndEffectorHStr={setRcxEndEffectorHStr}
                  rcxPickAlignmentMode={rcxPickAlignmentMode}
                  setRcxPickAlignmentMode={setRcxPickAlignmentMode}

                  rcxScaleDownStr={rcxScaleDownStr}
                  setRcxScaleDownStr={setRcxScaleDownStr}

                  rcxPickSignX={rcxPickSignX} setRcxPickSignX={setRcxPickSignX}
                  rcxPickSignY={rcxPickSignY} setRcxPickSignY={setRcxPickSignY}
                  rcxPickSignZ={rcxPickSignZ} setRcxPickSignZ={setRcxPickSignZ}
                  rcxPlaceSignX={rcxPlaceSignX} setRcxPlaceSignX={setRcxPlaceSignX}
                  rcxPlaceSignY={rcxPlaceSignY} setRcxPlaceSignY={setRcxPlaceSignY}
                  rcxPlaceSignZ={rcxPlaceSignZ} setRcxPlaceSignZ={setRcxPlaceSignZ}
                  rcxSafeZTravelEnabled={rcxSafeZTravelEnabled}
                  setRcxSafeZTravelEnabled={setRcxSafeZTravelEnabled}
                  rcxTravelSpeedStr={rcxTravelSpeedStr}
                  setRcxTravelSpeedStr={setRcxTravelSpeedStr}
                  rcxPlungeSpeedStr={rcxPlungeSpeedStr}
                  setRcxPlungeSpeedStr={setRcxPlungeSpeedStr}

                  isYamahaConnected={isYamahaConnected}
                  onJogToPickOriginXYR={jogToPickOriginXYR}
                  onJogToPickOriginFull={jogToPickOriginFull}
                  onJogToPalletOriginXYR={jogToPalletOriginXYR}
                  onJogToPalletOriginFull={jogToPalletOriginFull}
                  onSaveConfig={handleSaveConfig}
                  saveSuccess={saveSuccess}
                />
              </div>

            </div>

            {/* RIGHT COLUMN: CORE HOST CONTROLLER CONSOLE & SEQUENCE GRID */}
            <div className="lg:col-span-8 flex flex-col gap-6">
              <div className="bg-[#1C1C1E] rounded-2xl border border-[#2C2C2E]/70 p-5 shadow-sm">
                  <YamahaHostController
                    executionMode={executionMode}
                    simulationResult={simulationResult}
                    selectedYamahaStepIndex={selectedYamahaStepIndex}
                    setSelectedYamahaStepIndex={setSelectedYamahaStepIndex}
                    cartons={cartons}
                    rcxPickOriginX={rcxPickOriginX}
                    rcxPickOriginY={rcxPickOriginY}
                    rcxPickOriginZ={rcxPickOriginZ}
                    rcxPickOriginR={rcxPickOriginR}
                    rcxPalletOriginX={rcxPalletOriginX}
                    rcxPalletOriginY={rcxPalletOriginY}
                    rcxPalletOriginZ={rcxPalletOriginZ}
                    rcxPalletOriginR={rcxPalletOriginR}
                    rcxToolOffsetZ={rcxToolOffsetZ}
                    rcxToolOffsetX={rcxToolOffsetX}
                    rcxToolOffsetY={rcxToolOffsetY}
                    rcxPickAlignmentMode={rcxPickAlignmentMode}
                    rcxScaleDown={rcxScaleDown}
                    isYamahaConnected={isYamahaConnected}
                    setIsYamahaConnected={setIsYamahaConnected}
                    rcxPickSignX={rcxPickSignX}
                    rcxPickSignY={rcxPickSignY}
                    rcxPickSignZ={rcxPickSignZ}
                    rcxPlaceSignX={rcxPlaceSignX}
                    rcxPlaceSignY={rcxPlaceSignY}
                    rcxPlaceSignZ={rcxPlaceSignZ}
                    rcxSafeZTravelEnabled={rcxSafeZTravelEnabled}
                  />
              </div>
            </div>
          </div>
        </main>
      ) : activePage === "operator-hmi" ? (
        <main className="flex-1 w-full animate-fade-in">
          <TouchHMI 
            isYamahaConnected={isYamahaConnected} 
            onSendCmd={sendYamahaCmd} 
            onInterrupt={handleInterrupt} 
            onTriggerScan={triggerCameraScan}
            onSimulateScan={() => simulateCameraScan()}
            onJogToPickOriginXYR={jogToPickOriginXYR}
            onJogToPickOriginFull={jogToPickOriginFull}
            onJogToPlaceOriginXYR={jogToPalletOriginXYR}
            onJogToPlaceOriginFull={jogToPalletOriginFull}
            activePalletIndex={activePalletIndex}
            simulationResults={simulationResults}
          />
        </main>
      ) : (
        <main className="flex-1 p-6 grid grid-cols-1 xl:grid-cols-12 gap-6 items-start overflow-x-hidden">

          {/* COLUMN 1: PLATFORM BASE & BOX CONFIGURATOR */}
          <section className="xl:col-span-4 flex flex-col gap-6">

            {/* COMPACT ACTIVE CARGO BASE DECK STATUS BLOCK */}
            <div className="bg-[#1C1C1E] rounded-2xl border border-[#2C2C2E] p-5 shadow-sm flex flex-col gap-3">
              <div className="flex justify-between items-center">
                <h2 className="text-xs font-bold text-slate-350 tracking-wide uppercase flex items-center gap-1.5 font-sans">
                  <Sliders className="w-3.5 h-3.5 text-[#0A84FF]" />
                  Base Configuration
                </h2>
                <button
                  type="button"
                  onClick={() => setActivePage("pallet-settings")}
                  className="flex items-center gap-1.5 hover:text-white transition px-2.5 py-1 rounded bg-[#2C2C2E] border border-[#3A3A3C] text-[10px] text-slate-300"
                  title="Configure Cargo Base & System Rules"
                >
                  <Settings className="w-3.5 h-3.5" />
                  Modify Base
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 bg-[#0D0D0F] p-3 rounded-xl border border-[#2C2C2E]/50 text-xs">
                <div>
                  <span className="text-[9px] block text-slate-500 font-bold uppercase tracking-wider font-mono">PLATFORM MODEL</span>
                  <span className="font-semibold text-white">
                    {pallet.baseType === "carton" ? "Master Container" : "Wooden Pallet"}
                  </span>
                </div>
                <div>
                  <span className="text-[9px] block text-slate-505 font-bold uppercase tracking-wider font-mono">L × W × H SIZE</span>
                  <span className="font-mono font-semibold text-slate-250">
                    {pallet.length}×{pallet.width}×{pallet.height} mm
                  </span>
                </div>
                <div className="border-t border-[#2C2C2E]/40 pt-2 mt-1">
                  <span className="text-[9px] block text-slate-505 font-bold uppercase tracking-wider font-mono">CLEAR GAP / MAX CAP</span>
                  <span className="font-mono text-slate-300 font-medium">
                    {pallet.defaultGap}mm / {pallet.maxWeight}kg
                  </span>
                </div>
                <div className="border-t border-[#2C2C2E]/40 pt-2 mt-1">
                  <span className="text-[9px] block text-slate-505 font-bold uppercase tracking-wider font-mono">INTERLOCK / QUEUE</span>
                  <span className="text-slate-300 capitalize text-[10.5px] truncate font-medium block">
                    {pallet.interlockType === "pinwheel" ? "Pinwheel" : pallet.interlockType === "boundary-prefer" ? "Boundary" : "Custom"} ({pallet.packSequence === "fifo" ? "FIFO" : "3D-BPP"})
                  </span>
                </div>
              </div>
              
              <button
                onClick={() => setActivePage("pallet-settings")}
                className="text-center text-[10px] py-1.5 rounded-lg bg-[#0A84FF]/10 border border-[#0A84FF]/20 hover:bg-[#0A84FF]/20 text-white transition font-medium"
              >
                Configure Settings & Algorithm Rules &rarr;
              </button>
            </div>

            {/* ONE-BY-ONE MANUAL CARTONS SETUP ENGINE */}
            <div className="bg-[#1C1C1E] rounded-2xl border border-[#2C2C2E] p-5 shadow-sm flex-1 flex flex-col min-h-[580px]">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-xs font-bold text-slate-350 tracking-wide uppercase flex items-center gap-1.5 font-sans">
                  <Plus className="w-3.5 h-3.5 text-emerald-450" />
                  Add Cartons
                </h2>
                <div className="flex gap-1.5">
                  <button
                    onClick={resetFactoryPresets}
                    className="text-[10px] bg-[#2C2C2E] border border-[#3A3A3C] hover:bg-[#3A3A3C] px-2 py-1 rounded text-slate-300 transition-all"
                    title="Reload default model stacks"
                  >
                    Presets
                  </button>
                  <button
                    onClick={clearAllCartons}
                    className="text-[10px] bg-[#3A1E22] border border-[#FF453A]/20 hover:bg-[#52292E] text-[#FF453A] px-2 py-1 rounded transition-all"
                  >
                    Clear All
                  </button>
                </div>
              </div>

              {/* INPUT CONFIGURATION MODE SELECTOR */}
              <div className="grid grid-cols-2 gap-0.5 bg-[#0D0D0F] p-0.5 rounded-lg border border-[#2C2C2E]/60 mb-4 text-xs font-medium">
                <button
                  type="button"
                  onClick={() => {
                    setActiveInputTab("manual");
                    setTriggerStatusMsg("");
                  }}
                  className={`py-1.5 rounded-md transition duration-150 cursor-pointer flex items-center justify-center gap-1.5 ${
                    activeInputTab === "manual"
                      ? "bg-[#3A3A3C] text-white font-bold"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <Plus className="w-3.5 h-3.5" />
                  Manual Entry
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setActiveInputTab("camera");
                    setTriggerStatusMsg("");
                  }}
                  className={`py-1.5 rounded-md transition duration-150 cursor-pointer flex items-center justify-center gap-1.5 relative ${
                    activeInputTab === "camera"
                      ? "bg-[#3A3A3C] text-white font-bold"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  <Camera className="w-3.5 h-3.5" />
                  Camera Scan
                  {scannerStatus.isTcpServerRunning && (
                    <span className={`absolute top-1 right-2 w-2 h-2 rounded-full ${
                      scannerStatus.isConnected ? "bg-emerald-500 animate-pulse" : "bg-orange-500"
                    }`} />
                  )}
                </button>
              </div>

            {activeInputTab === "manual" && (
              <>
                {/* Quick prefill template pills */}
                <div className="mb-4 bg-[#0D0D0F] p-3 rounded-xl border border-[#2C2C2E]/60 flex flex-col gap-3">
                  <div>
                    <span className="text-[10px] font-semibold text-slate-400 block mb-1.5">Quick Templates:</span>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          setFormName("Heavy Engine Case");
                          setFormLength("450");
                          setFormWidth("400");
                          setFormHeight("250");
                          setFormWeight("24.0");
                          setFormFriction("0.65");
                          setFormColor("#1e3a8a");
                          setFormOrientations({ flat: true, sideways: false, uprightAvailable: false });
                        }}
                        className="bg-[#2C2C2E] hover:bg-[#3A3A3C] px-2 py-1 rounded text-[10px] text-slate-200 border border-[#3A3A3C] transition-all"
                      >
                        Heavy Case (24kg)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setFormName("Nylon Slip Case");
                          setFormLength("300");
                          setFormWidth("200");
                          setFormHeight("150");
                          setFormWeight("7.5");
                          setFormFriction("0.18");
                          setFormColor("#0d9488");
                          setFormOrientations({ flat: true, sideways: false, uprightAvailable: false });
                        }}
                        className="bg-[#2C2C2E] hover:bg-[#3A3A3C] px-2 py-1 rounded text-[10px] text-slate-200 border border-[#3A3A3C] transition-all"
                      >
                        Slip Carton (0.18μ)
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setFormName("Cube Acc Box");
                          setFormLength("250");
                          setFormWidth("250");
                          setFormHeight("200");
                          setFormWeight("3.2");
                          setFormFriction("0.42");
                          setFormColor("#b45309");
                          setFormOrientations({ flat: true, sideways: false, uprightAvailable: false });
                        }}
                        className="bg-[#2C2C2E] hover:bg-[#3A3A3C] px-2 py-1 rounded text-[10px] text-slate-200 border border-[#3A3A3C] transition-all"
                      >
                        Cube Box (3kg)
                      </button>
                    </div>
                  </div>

                  {/* Custom Saved Templates List with Names */}
                  {customTemplates.length > 0 && (
                    <div className="border-t border-[#2C2C2E]/40 pt-2.5">
                      <span className="text-[10px] font-semibold text-slate-400 block mb-1.5">User Saved Templates:</span>
                      <div className="flex flex-wrap gap-1.5 max-h-[100px] overflow-y-auto scrollbar-thin">
                        {customTemplates.map((tmpl) => (
                          <div
                            key={tmpl.id}
                            className="inline-flex items-center bg-[#131316] hover:border-slate-500/30 border border-[#2C2C2E]/60 rounded-md p-0.5 pr-1.5 text-[10px] text-slate-300 transition-all"
                          >
                            <button
                              type="button"
                              onClick={() => {
                                setFormName(tmpl.name);
                                setFormLength(tmpl.length);
                                setFormWidth(tmpl.width);
                                setFormHeight(tmpl.height);
                                setFormWeight(tmpl.weight);
                                setFormFriction(tmpl.friction);
                                setFormColor(tmpl.color);
                                setFormOrientations(tmpl.orientations);
                              }}
                              className="px-1.5 py-0.5 font-medium cursor-pointer text-left truncate max-w-[130px] text-[#0A84FF]"
                              title={`${tmpl.name} (${tmpl.length}x${tmpl.width}x${tmpl.height}mm)`}
                            >
                              ★ {tmpl.name}
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteCustomTemplate(tmpl.id)}
                              className="text-rose-450 hover:text-rose-300 ml-1 font-bold pl-1 border-l border-[#2C2C2E] text-[11px] leading-none select-none transition-all"
                              title="Delete Template"
                            >
                              &times;
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Save Form as Template Segment */}
                  <div className="border-t border-[#2C2C2E]/40 pt-2.5 flex items-center justify-between gap-2">
                    <input
                      type="text"
                      placeholder="Template Name..."
                      value={newTemplateName}
                      onChange={(e) => setNewTemplateName(e.target.value)}
                      className="bg-[#131316] border border-[#2C2C2E] text-[10px] text-slate-300 rounded px-2.5 py-1.5 max-w-[150px] focus:outline-none focus:border-[#0A84FF] flex-1 font-sans placeholder:text-slate-600"
                    />
                    <button
                      type="button"
                      onClick={saveFormAsTemplate}
                      className="bg-[#0A84FF] hover:bg-blue-600 text-white px-3 py-1.5 rounded-md text-[10px] transition-all font-semibold tracking-wide shadow-sm"
                    >
                      Save Template
                    </button>
                  </div>
                </div>

                {/* Single Carton Entry Form Card */}
                <div className="bg-[#0D0D0F] p-4 rounded-xl border border-[#2C2C2E]/60 mb-5 flex flex-col gap-3">
                  {/* Name & Color */}
                  <div className="grid grid-cols-12 gap-3">
                    <div className="col-span-8">
                      <label className="text-[10px] text-slate-400 block font-medium">Carton Name / Label</label>
                      <input
                        type="text"
                        value={formName}
                        onChange={(e) => setFormName(e.target.value)}
                        placeholder="e.g. Battery box"
                        className="w-full bg-[#131316] border border-[#2C2C2E] rounded-md px-2.5 py-1.5 text-xs text-white mt-1 focus:outline-none focus:border-[#0A84FF] font-semibold"
                      />
                    </div>
                    <div className="col-span-4">
                      <label className="text-[10px] text-slate-400 block font-medium">Color Hue</label>
                      <div className="flex items-center gap-2 mt-2">
                        <input
                          type="color"
                          value={formColor}
                          onChange={(e) => setFormColor(e.target.value)}
                          className="w-7 h-[22px] bg-transparent border-0 rounded cursor-pointer scale-105"
                          title="Custom color pick"
                        />
                        <span className="text-[10px] font-mono text-slate-400 uppercase">{formColor}</span>
                      </div>
                    </div>
                  </div>

                  {/* L, W, H */}
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-450 block">Length (L) - mm</label>
                      <input
                        type="number"
                        value={formLength}
                        onChange={(e) => setFormLength(e.target.value)}
                        onBlur={() => setFormLength(Math.max(50, Math.min(2000, parseInt(formLength) || 350)).toString())}
                        className="w-full bg-[#131316] border border-[#2C2C2E] rounded px-2.5 py-1.5 text-xs text-slate-200 mt-1 focus:outline-none focus:border-[#0A84FF] font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-450 block">Width (W) - mm</label>
                      <input
                        type="number"
                        value={formWidth}
                        onChange={(e) => setFormWidth(e.target.value)}
                        onBlur={() => setFormWidth(Math.max(50, Math.min(2000, parseInt(formWidth) || 300)).toString())}
                        className="w-full bg-[#131316] border border-[#2C2C2E] rounded px-2.5 py-1.5 text-xs text-slate-200 mt-1 focus:outline-none focus:border-[#0A84FF] font-mono"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-450 block">Height (H) - mm</label>
                      <input
                        type="number"
                        value={formHeight}
                        onChange={(e) => setFormHeight(e.target.value)}
                        onBlur={() => setFormHeight(Math.max(50, Math.min(2000, parseInt(formHeight) || 200)).toString())}
                        className="w-full bg-[#131316] border border-[#2C2C2E] rounded px-2.5 py-1.5 text-xs text-slate-200 mt-1 focus:outline-none focus:border-[#0A84FF] font-mono"
                      />
                    </div>
                  </div>

                  {/* Weight & Friction */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] text-slate-450 block">Weight (WT) - kg</label>
                      <input
                        type="number"
                        step="0.1"
                        value={formWeight}
                        onChange={(e) => setFormWeight(e.target.value)}
                        onBlur={() => setFormWeight(Math.max(0.1, Math.min(500, parseFloat(formWeight) || 6.5)).toString())}
                        className="w-full bg-[#131316] border border-[#2C2C2E] rounded px-2.5 py-1.5 text-xs text-[#30D158] mt-1 focus:outline-none focus:border-[#0A84FF] font-mono font-bold"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-450 block">Friction Coeff (μ)</label>
                      <input
                        type="number"
                        step="0.05"
                        value={formFriction}
                        onChange={(e) => setFormFriction(e.target.value)}
                        onBlur={() => setFormFriction(Math.max(0.01, Math.min(1.0, parseFloat(formFriction) || 0.45)).toString())}
                        className="w-full bg-[#131316] border border-[#2C2C2E] rounded px-2.5 py-1.5 text-xs text-[#BF5AF2] mt-1 focus:outline-none focus:border-[#0A84FF] font-mono"
                        title="Standard cardboard friction coefficient usually ranges 0.40 - 0.55."
                      />
                    </div>
                  </div>

                  {/* Orientations Static Requirement */}
                  <div className="border-t border-[#2C2C2E]/40 pt-2 flex flex-col gap-1">
                    <span className="text-[10px] text-slate-400 block font-medium">Allowed Orientations:</span>
                    <p className="text-[10px] text-slate-455 italic leading-snug">
                      Enforces flat packing (L x W) only for optimal stack stability.
                    </p>
                  </div>

                  {/* Action Button */}
                  <button
                    onClick={keyInSingleCarton}
                    className="mt-1 w-full py-2 bg-[#0A84FF] hover:bg-blue-600 text-white rounded-lg text-xs font-semibold leading-none select-none shadow-sm transition-all flex items-center justify-center gap-1.5"
                  >
                    <Plus className="w-3.5 h-3.5 text-white" />
                    Key-In Custom Carton (Single)
                  </button>
                </div>
              </>
            )}

            {activeInputTab === "camera" && (
              <div className="flex flex-col gap-3.5 flex-1 pb-4">
                {/* --- HIKROBOT SC6000 CAMERA SCANNER HMI MODULE --- */}
                
                {/* Connection Panel */}
                <div className="bg-slate-900/30 rounded-lg border border-slate-800 p-3 flex flex-col gap-2 relative">
                  <div className="text-[10px] font-bold text-slate-400 tracking-wider uppercase font-sans flex items-center gap-1.5">
                    <Settings className="w-3 h-3 text-teal-400" />
                    Host Socket Setup (TCP Server)
                  </div>

                  <div className="flex items-center gap-1.5 mt-1">
                    <div className="flex-1">
                      <label className="text-[9px] uppercase tracking-wider text-slate-500 font-bold block mb-1">Port</label>
                      <input
                        type="number"
                        disabled={scannerStatus.isTcpServerRunning}
                        value={scannerPortInput}
                        onChange={(e) => setScannerPortInput(e.target.value)}
                        placeholder="8080"
                        className="w-full bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-xs text-slate-300 focus:outline-none focus:border-teal-400 disabled:opacity-50 font-mono"
                      />
                    </div>
                    <div className="pt-4">
                      <button
                        onClick={toggleScannerServer}
                        disabled={scannerLoading}
                        className={`px-3 py-1.5 rounded text-xs font-bold font-mono transition shadow-sm leading-none flex items-center justify-center gap-1 ${
                          scannerStatus.isTcpServerRunning
                            ? "bg-rose-600 hover:bg-rose-500 text-white"
                            : "bg-slate-800 hover:bg-slate-700 text-slate-205 border border-slate-700"
                        }`}
                      >
                        {scannerLoading ? "Saving..." : scannerStatus.isTcpServerRunning ? "Stop Server" : "Start Server"}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] bg-slate-950/40 p-2 rounded border border-slate-900/60 font-medium">
                    <span className="text-slate-500">Host Status:</span>
                    {scannerStatus.isTcpServerRunning ? (
                      scannerStatus.isConnected ? (
                        <span className="text-emerald-400 font-bold flex items-center gap-1 font-sans">
                          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                          CONNECTED ({scannerStatus.clientAddress?.split(":")[0]})
                        </span>
                      ) : (
                        <span className="text-amber-400 font-bold flex items-center gap-1 font-sans">
                          <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                          LISTENING... (Port {scannerStatus.port})
                        </span>
                      )
                    ) : (
                      <span className="text-rose-450 font-semibold flex items-center gap-1 font-sans">
                        <span className="w-2 h-2 rounded-full bg-rose-500" />
                        STOPPED
                      </span>
                    )}
                  </div>
                </div>

                {/* Control Panel (📸 TRIGGER) */}
                <div className="bg-slate-900/30 rounded-lg border border-slate-800 p-3 flex flex-col gap-2">
                  <div className="text-[10px] font-bold text-slate-400 tracking-wider uppercase font-sans flex items-center gap-1.5">
                    <Cpu className="w-3 h-3 text-teal-400" />
                    Hikrobot Controller Hardware Trigger
                  </div>

                  <button
                    onClick={triggerCameraScan}
                    disabled={!scannerStatus.isConnected}
                    style={{ backgroundColor: scannerStatus.isConnected ? "#4CAF50" : "#374151" }}
                    className={`w-full py-3 rounded-lg text-white font-bold text-xs select-none shadow transition duration-200 tracking-wider leading-none flex items-center justify-center gap-1.5 ${
                      scannerStatus.isConnected ? "hover:brightness-110 active:scale-[0.98] cursor-pointer" : "opacity-40 cursor-not-allowed"
                    }`}
                  >
                    <Camera className="w-4 h-4 text-white" />
                    📸 TRIGGER CAMERA (CODE "1")
                  </button>

                  {!scannerStatus.isConnected && (
                    <div className="text-[9.5px] leading-snug text-slate-500 italic bg-slate-950/20 p-1.5 rounded border border-slate-900/60">
                      ℹ️ Connect your camera client to the TCP server on port <code className="text-amber-400 font-bold">{scannerStatus.port}</code> to enable hardware trigger signals. You can test immediately using the sandbox simulator below!
                    </div>
                  )}
                </div>

                {/* Simulated Scanner (Sandbox) */}
                <div className="bg-slate-900/30 rounded-lg border border-slate-800 p-3 flex flex-col gap-2">
                  <div className="text-[10px] font-bold text-slate-400 tracking-wider uppercase font-sans flex items-center gap-1.5">
                    <Sparkles className="w-3-h-3 text-teal-400" />
                    Interactive Barcode / QR Simulator
                  </div>

                  <div className="text-[10px] text-slate-400 leading-snug">
                    Simulate how the SC6000 camera scans a QR code and sends back dimensions (e.g., <code className="text-teal-400">450;350;200</code>).
                    The system automatically assumes the carton weight is <strong className="text-emerald-400 font-bold">30kg</strong> under this scanning workflow.
                  </div>

                  {/* Preset dimensions */}
                  <div className="flex flex-wrap gap-1 mt-1">
                    <button
                      type="button"
                      onClick={() => simulateCameraScan("350;300;200")}
                      className="bg-slate-950 hover:bg-slate-800 border border-slate-800/80 hover:border-slate-700 text-[10px] font-mono text-slate-300 px-2 py-1 rounded transition duration-150"
                    >
                      350;300;200
                    </button>
                    <button
                      type="button"
                      onClick={() => simulateCameraScan("450;350;250")}
                      className="bg-slate-950 hover:bg-slate-800 border border-slate-800/80 hover:border-slate-700 text-[10px] font-mono text-slate-300 px-2 py-1 rounded transition duration-150"
                    >
                      450;350;250
                    </button>
                    <button
                      type="button"
                      onClick={() => simulateCameraScan("400;200;300")}
                      className="bg-slate-950 hover:bg-slate-800 border border-slate-800/80 hover:border-slate-700 text-[10px] font-mono text-slate-300 px-2 py-1 rounded transition duration-150"
                    >
                      400;200;300
                    </button>
                  </div>

                  <div className="flex gap-1.5 mt-1.5">
                    <input
                      type="text"
                      value={customScannerInput}
                      onChange={(e) => setCustomScannerInput(e.target.value)}
                      placeholder="L;W;H"
                      className="bg-slate-950 border border-slate-800 rounded px-2.5 py-1 text-xs text-teal-300 focus:outline-none focus:border-teal-500 font-mono placeholder:text-slate-650 flex-1"
                    />
                    <button
                      type="button"
                      onClick={() => simulateCameraScan()}
                      className="bg-teal-500 hover:bg-teal-400 text-slate-950 px-3 py-1 rounded text-[11px] transition font-bold select-none leading-none shadow-sm shadow-teal-500/10 flex items-center justify-center"
                    >
                      🚀 Send Scan
                    </button>
                  </div>

                  {triggerStatusMsg && (
                    <div className={`text-[10px] font-mono p-2 rounded border leading-relaxed ${
                      triggerStatusMsg.startsWith("✅") || triggerStatusMsg.includes("sent")
                        ? "bg-teal-950/20 text-teal-400 border-teal-800/40"
                        : "bg-rose-950/20 text-rose-450 border-rose-900/40"
                    }`}>
                      {triggerStatusMsg}
                    </div>
                  )}
                </div>

                {/* Terminal Logs & Reading Results */}
                <div className="bg-slate-950 rounded-lg border border-slate-900 p-2.5 flex flex-col gap-1.5 relative">
                  <div className="text-[10px] font-bold text-slate-450 tracking-wider uppercase font-sans flex items-center gap-1.5 pb-1 border-b border-slate-900">
                    <Terminal className="w-3.5 h-3.5 text-sky-400" />
                    Logs & Reading Results (HMI Out)
                  </div>

                  <div className="h-32 overflow-y-auto pr-1 flex flex-col-reverse text-[9.5px] font-mono leading-relaxed max-h-[140px] scrollbar-thin">
                    {scannerStatus.logs && scannerStatus.logs.length > 0 ? (
                      [...scannerStatus.logs].reverse().map((lg, i) => (
                        <div
                          key={i}
                          className={`py-0.5 border-b border-slate-900/30 select-text ${
                            lg.includes("[ERROR]") || lg.includes("Failed") || lg.includes("error")
                              ? "text-rose-400"
                              : lg.includes("[SERVER]")
                              ? "text-sky-400"
                              : lg.includes("[SERVER ERROR]")
                              ? "text-rose-500 font-bold"
                              : lg.includes("[CAM -> HOST]")
                              ? "text-teal-300"
                              : lg.includes("[SYSTEM]")
                              ? "text-emerald-400 font-semibold"
                              : "text-slate-400"
                          }`}
                        >
                          {lg}
                        </div>
                      ))
                    ) : (
                      <div className="text-slate-600 text-center py-6 italic">No communications logged yet. Start server to begin.</div>
                    )}
                  </div>
                </div>

              </div>
            )}

            {/* Separator / Queue display block */}
            <div className="border-t border-slate-800/80 pt-3 flex-1 flex flex-col min-h-[180px]">
              <div className="flex justify-between items-center mb-2.5">
                <span className="text-[11px] font-bold text-slate-400 tracking-wider uppercase font-sans">
                  Current Stack Queue ({cartons.length} {cartons.length === 1 ? "Box" : "Boxes"})
                </span>
                {cartons.length > 0 && (
                  <span className="text-[10px] text-slate-500 italic">Total queued: {cartons.reduce((acc, c) => acc + c.quantity, 0)} units</span>
                )}
              </div>

              <div className="flex-1 overflow-y-auto max-h-[320px] pr-1 space-y-2.5 scrollbar-thin">
                {cartons.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-4 py-8 border border-dashed border-slate-800/80 rounded-lg bg-slate-900/10">
                    <span className="p-2.5 bg-slate-900 rounded-full text-slate-600 mb-2 text-xs">👀</span>
                    <p className="text-xs text-slate-500 font-medium">No cartons queued.</p>
                    <p className="text-[10px] text-slate-600 mt-0.5 max-w-[200px] leading-relaxed mx-auto">
                      Key-in custom carton designs using the parameter form above to simulate packing.
                    </p>
                  </div>
                ) : (
                  cartons.map((carton, idx) => (
                    <div
                      key={carton.id}
                      className="p-2.5 bg-slate-900/30 rounded-lg border border-slate-900 flex items-center justify-between relative overflow-hidden group hover:border-slate-800/80 transition"
                    >
                      {/* Left colored status strip */}
                      <div
                        className="absolute top-0 bottom-0 left-0 w-1"
                        style={{ backgroundColor: carton.color }}
                      />

                      <div className="pl-3 flex flex-col gap-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] font-bold text-slate-100">{carton.name}</span>
                          <span className="text-[9px] px-1 bg-slate-800 rounded text-slate-400 font-mono">Qty: {carton.quantity}</span>
                        </div>
                        <div className="flex items-center gap-3 text-[10px] text-slate-400 font-mono hover:text-slate-300">
                          <span>{carton.length}x{carton.width}x{carton.height}mm</span>
                          <span className="text-emerald-400 font-semibold">{carton.weight}kg</span>
                          <span className="text-sky-400">μ={carton.frictionCoeff}</span>
                        </div>
                      </div>

                      <button
                        onClick={() => deleteCarton(idx)}
                        className="p-1.5 rounded bg-slate-950/40 hover:bg-rose-950/50 hover:text-rose-400 text-slate-500 transition shrink-0"
                        title="Delete carton"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </section>

        {/* COLUMN 2: 3D GRAPHICAL SIMULATOR WORKING COCKPIT (xl:col-span-5) */}
        <section className="xl:col-span-5 flex flex-col gap-6" ref={containerRef}>
          <div className={`rounded-xl p-5 shadow-lg flex flex-col items-center relative overflow-hidden h-[635px] transition-all duration-300 ${
            simulationResult && simulationResult.stabilityScore < 60
              ? "bg-rose-950/5 border-2 border-rose-500 shadow-rose-950/30"
              : "bg-slate-950/55 border border-slate-800/80"
          }`}>

            {/* Warning Overlay banner on top of the 3D canvas */}
            {simulationResult && simulationResult.stabilityScore < 60 && (
              <div className="absolute top-16 left-5 right-5 bg-rose-950/90 border border-rose-500/30 rounded-lg p-2 flex items-center justify-between z-10 text-[10px] font-mono leading-none tracking-wide text-rose-300 backdrop-blur-sm shadow-md animate-[pulse_2s_infinite]">
                <div className="flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-ping" />
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                  <span className="font-bold">LOW-STABILITY WARNING: INDEX {simulationResult.stabilityScore}%</span>
                </div>
                <span className="text-[9px] hidden sm:inline">[STABILITY CLASS: CRITICAL SHIFT]</span>
              </div>
            )}

            {/* Layout view controls header */}
            <div className="w-full flex justify-between items-center z-10">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-sky-500/10 rounded text-sky-400 border border-sky-500/10">
                  <Maximize2 className="w-4 h-4" />
                </span>
                <div>
                  <h2 className="text-sm font-semibold text-slate-300 tracking-wider uppercase">3D Packing Visualizer</h2>
                  <p className="text-[10px] text-slate-500">Fixed 3D Isometric View starting from bottom layer</p>
                </div>
              </div>

              {/* Angle Resets */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => {
                    previousBoxCountsRef.current[activePalletIndex] = 0;
                    setAnimationTrigger(prev => prev + 1);
                  }}
                  className="flex items-center gap-1 text-[10px] bg-slate-900 border border-slate-700 px-2 py-1 rounded hover:bg-slate-800 text-teal-400 hover:text-teal-300 transition"
                  title="Replay sequence pop animation"
                >
                  <Play className="w-2.5 h-2.5 fill-current" />
                  <span>Replay Sequence</span>
                </button>
                <button
                  onClick={resetCamera}
                  className="text-[10px] bg-slate-900 border border-slate-700 px-2 py-1 rounded hover:bg-slate-800 text-slate-400 hover:text-white transition"
                >
                  Reset Zoom
                </button>
              </div>
            </div>

            {/* Pallet Switcher Tab Bar */}
            {simulationResults.length > 1 && (
              <div className="w-full flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 mt-3 mb-1 py-1.5 border-b border-slate-900 z-10">
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1.5 sm:pb-0">
                  <span className="text-[10px] font-mono font-bold uppercase text-slate-500 tracking-wider shrink-0 mr-1">Pallets Needed:</span>
                  {simulationResults.map((res, idx) => (
                    <button
                      key={idx}
                      onClick={() => setActivePalletIndex(idx)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold font-mono tracking-wide transition border shrink-0 ${
                        activePalletIndex === idx
                          ? "bg-teal-500 text-slate-950 border-teal-400 font-bold shadow-md shadow-teal-500/20"
                          : "bg-slate-900 text-slate-400 border-slate-800 hover:text-white"
                      }`}
                    >
                      Pallet {idx + 1} ({res.placedBoxes.length} Box{(res.placedBoxes.length !== 1) ? "es" : ""})
                    </button>
                  ))}
                </div>

                {/* Autoplay Toggler button */}
                <button
                  onClick={() => setAutoCyclePallets(!autoCyclePallets)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded border text-[10px] font-mono transition shrink-0 self-start sm:self-center ${
                    autoCyclePallets
                      ? "bg-teal-500/10 border-teal-500/30 text-teal-400 hover:bg-teal-500/20"
                      : "bg-slate-900 border-slate-800 text-slate-400 hover:text-white"
                  }`}
                  title="Automatically switch between pallets every 5 seconds"
                >
                  <RefreshCw className={`w-3 h-3 ${autoCyclePallets ? "animate-spin" : ""}`} style={{ animationDuration: '6s' }} />
                  <span>Auto-Cycle: <span className={autoCyclePallets ? "text-teal-400 font-bold" : "text-slate-500 font-medium"}>{autoCyclePallets ? "ON (5s)" : "OFF"}</span></span>
                </button>
              </div>
            )}

            {simulationResults.length > 0 && (
              <div className="w-full text-left z-10 text-[10px] font-mono text-teal-400/95 mt-1">
                Viewing Pallet <span className="text-white font-bold">{activePalletIndex + 1}</span> of <span className="text-white font-bold">{simulationResults.length}</span> (Total generated: {simulationResults.length} Pallet{(simulationResults.length !== 1) ? "s" : ""})
              </div>
            )}

            {/* Responsive floating view panel buttons */}
            <div className="absolute top-24 right-5 flex flex-col gap-2 z-10 bg-slate-950/85 p-2 rounded-lg border border-slate-800/95 shadow">
              <span className="text-[9px] font-mono text-slate-500 uppercase tracking-widest text-center">Zoom</span>
              <button
                onClick={() => adjustZoom(0.02)}
                className="w-7 h-7 bg-slate-900 text-white rounded hover:bg-slate-800 text-lg flex items-center justify-center border border-slate-800 font-bold transition"
              >
                +
              </button>
              <button
                onClick={() => adjustZoom(-0.02)}
                className="w-7 h-7 bg-slate-900 text-white rounded hover:bg-slate-800 text-lg flex items-center justify-center border border-slate-800 font-bold transition"
              >
                −
              </button>
            </div>

            {/* Bottom Color Scheme Selector & Layer filter bar */}
            <div className="absolute bottom-5 left-5 right-5 flex flex-wrap gap-4 items-center justify-between z-10 bg-slate-950/85 p-3 rounded-lg border border-slate-800/95 shadow text-[11px]">
              {/* Layer Selection dropdown */}
              <div className="flex items-center gap-1.5">
                <span className="text-slate-500">Filter Level:</span>
                <select
                  value={selectedLayerIndex}
                  onChange={(e) => setSelectedLayerIndex(e.target.value === "all" ? "all" : parseInt(e.target.value))}
                  className="bg-slate-900 border border-slate-800 px-2 py-1 rounded text-teal-300 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-teal-500"
                >
                  <option value="all">Display All Layers</option>
                  {(() => {
                    if (!simulationResult || simulationResult.placedBoxes.length === 0) return null;
                    const layers = Array.from(new Set<number>(simulationResult.placedBoxes.map(b => b.layerIndex))).sort((a, b) => a - b);
                    return layers.map(l => {
                      const boxesInLayer = simulationResult.placedBoxes.filter(b => b.layerIndex === l);
                      if (boxesInLayer.length === 0) return null;
                      const minZ = Math.min(...boxesInLayer.map(b => b.z));
                      const maxZ = Math.max(...boxesInLayer.map(b => b.z + b.h));
                      return (
                        <option key={l} value={l}>
                          Layer {l + 1} ({minZ}-{maxZ}mm)
                        </option>
                      );
                    });
                  })()}
                </select>
              </div>

              {/* Color Scheme Picker */}
              <div className="flex items-center gap-4 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500">Colors:</span>
                  <div className="flex gap-1 bg-slate-900 border border-slate-800 rounded p-0.5">
                    {(["type", "weight", "friction"] as const).map((sc) => (
                      <button
                        key={sc}
                        onClick={() => setColorScheme(sc)}
                        className={`px-2 py-0.5 rounded text-[10px] transition ${
                          colorScheme === sc ? "bg-teal-500 text-slate-950 font-semibold" : "text-slate-400 hover:text-white"
                        }`}
                      >
                        {sc === "type" ? "Unique Box Color" : sc === "weight" ? "Weight Stack" : "Friction Slips"}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-1.5">
                  <span className="text-slate-500">Stability Overlay:</span>
                  <button
                    id="toggle3DSupportOverlay"
                    onClick={() => setShowBoxStabilityDetails(!showBoxStabilityDetails)}
                    className={`px-2 py-1 rounded text-[10px] font-semibold transition tracking-wide leading-none ${
                      showBoxStabilityDetails
                        ? "bg-amber-500 hover:bg-amber-400 text-slate-950 shadow shadow-amber-500/20"
                        : "bg-slate-900 text-slate-400 hover:text-white border border-slate-800"
                    }`}
                  >
                    {showBoxStabilityDetails ? "● Active" : "○ Off"}
                  </button>
                </div>
              </div>
            </div>

            {/* Solid HTML5 locked isometric Canvas */}
            <canvas
              ref={canvasRef}
              width={450}
              height={440}
              className="max-w-full my-auto focus:outline-none"
              id="pallet3dCanvas"
            />
          </div>

          {/* PALLET PHYSICAL COMPLIANCE & ACCURACY CHART */}
          <div className={`rounded-xl p-5 shadow-lg transition-all duration-300 border ${
            simulationResult && simulationResult.stabilityScore < 60
              ? "bg-rose-950/5 border-rose-500/50"
              : "bg-slate-950/55 border border-slate-800/80"
          }`}>
            <button
              id="toggleStabilityDetailsBtn"
              onClick={() => setShowStabilityMetrics(!showStabilityMetrics)}
              className="w-full flex items-center justify-between text-left focus:outline-none group"
            >
              <div className="flex items-center gap-2">
                <Activity className={`w-4 h-4 ${simulationResult && simulationResult.stabilityScore < 60 ? "text-rose-500 animate-pulse" : "text-sky-400"}`} />
                <h2 className="text-sm font-semibold tracking-wider uppercase text-slate-300 select-none">
                  Stability Analysis
                </h2>
              </div>
              <div className="flex items-center gap-2 bg-slate-900/80 px-2.5 py-1 rounded text-xs border border-slate-800 group-hover:border-slate-705 group-hover:text-teal-400 transition-all select-none">
                <span className="font-mono text-[11px] font-bold text-slate-300">
                  {simulationResult ? `${simulationResult.stabilityScore}% Score` : "N/A"}
                </span>
                <ChevronDown className={`w-4 h-4 text-slate-500 group-hover:text-teal-450 transform transition-transform duration-250 ${showStabilityMetrics ? "rotate-180" : ""}`} />
              </div>
            </button>

            {showStabilityMetrics && (
              <div className="mt-5 pt-4 border-t border-slate-800/80">
                {simulationResult ? (
                  <div className="space-y-4 text-xs">
                    {worstMetricLabel && simulationResult.stabilityScore < 60 && (
                      <div className="p-2.5 bg-rose-500/15 border border-rose-500/30 rounded text-[11px] text-rose-300 mb-3 font-sans leading-relaxed">
                        <span className="font-bold uppercase text-white block mb-0.5 flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 text-rose-500" /> Key Deficit Origin:
                        </span>
                        The safety score is heavily limited by <span className="underline font-bold text-white">{worstMetricLabel}</span>. Expand item footprints or shift weight hierarchy downward to fix.
                      </div>
                    )}
                    {/* CG alignment description */}
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-slate-400">Center of Gravity Horizontal Centering</span>
                        <span className="font-mono text-teal-300">{simulationResult.metricBreakdowns.cgAlignment} / 25 pts</span>
                      </div>
                      <div className="w-full bg-slate-900 h-2 rounded overflow-hidden flex">
                        <div
                          className="bg-teal-500 h-full"
                          style={{ width: `${(simulationResult.metricBreakdowns.cgAlignment / 25) * 100}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1">
                        Ideal center is (X: {pallet.length / 2}mm, Y: {pallet.width / 2}mm). Your CG shift is <span className="text-teal-400 font-mono">{simulationResult.cgEccentricity}mm</span> off-center.
                      </p>
                    </div>

                    {/* Base Support description */}
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-slate-400">Overhang & Base Support Ratio Safety</span>
                        <span className="font-mono text-sky-300">{simulationResult.metricBreakdowns.baseSupport} / 25 pts</span>
                      </div>
                      <div className="w-full bg-slate-900 h-2 rounded overflow-hidden flex">
                        <div
                          className="bg-sky-500 h-full"
                          style={{ width: `${(simulationResult.metricBreakdowns.baseSupport / 25) * 100}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1">
                        Measures average percentage of supportive contact areas. Excess unsupported overhang triggers critical warning signs.
                      </p>
                    </div>

                    {/* Weight Hierarchy description */}
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-slate-400">Vertical Mass Hierarchy progression</span>
                        <span className="font-mono text-indigo-300">{simulationResult.metricBreakdowns.weightHierarchy} / 25 pts</span>
                      </div>
                      <div className="w-full bg-slate-900 h-2 rounded overflow-hidden flex">
                        <div
                          className="bg-indigo-500 h-full"
                          style={{ width: `${(simulationResult.metricBreakdowns.weightHierarchy / 25) * 100}%` }}
                        />
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1">
                        Heavier boxes sitting on bottom layers prevents downward box crushing and stabilizes the vertical axis.
                      </p>
                    </div>

                    {/* Interlocking description */}
                    <div className="grid grid-cols-2 gap-4 border-t border-slate-800/80 pt-3 text-[11px]">
                      <div className="bg-slate-900/60 p-2.5 rounded border border-slate-800">
                        <span className="text-slate-500 block mb-1">Seams Bonding lock:</span>
                        <div className="flex items-center gap-1.5 text-slate-200">
                          <span className={`w-2 h-2 rounded-full ${simulationResult.interlockingCheck.isInterlocked ? "bg-emerald-400" : "bg-amber-400"}`} />
                          <span className="font-medium text-slate-300">
                            {simulationResult.interlockingCheck.isInterlocked ? "Bridges overlapping" : "Narrow Col Stacking"}
                          </span>
                        </div>
                      </div>
                      <div className="bg-slate-900/60 p-2.5 rounded border border-slate-800">
                        <span className="text-slate-500 block mb-1">Friction Hold stability:</span>
                        <div className="flex items-center gap-1.5 text-slate-200">
                          <span className={`w-2 h-2 rounded-full ${simulationResult.metricBreakdowns.frictionPhysics > 7 ? "bg-emerald-400" : "bg-amber-400"}`} />
                          <span className="font-medium text-slate-300">
                            {simulationResult.metricBreakdowns.frictionPhysics > 7 ? "Slip-resistant" : "Slippery limits wrap"}
                          </span>
                        </div>
                      </div>
                    </div>

                  </div>
                ) : (
                  <p className="text-xs text-slate-500 text-center">Awaiting box definitions to compile metrics.</p>
                )}
              </div>
            )}
          </div>
        </section>

        {/* COLUMN 3: STABILITY ANALYSIS, PLC STREAM CONSOLE, AI BOT (xl:col-span-3) */}
        <section className="xl:col-span-3 flex flex-col gap-6">

          {/* SIMULATION OUTCOMES SUMMARY */}
          <div className={`bg-gradient-to-br from-slate-950 to-slate-900 rounded-xl p-5 shadow-xl relative overflow-hidden transition-all duration-300 border ${
            simulationResult && simulationResult.stabilityScore < 60
              ? "border-rose-500 shadow-rose-950/20"
              : "border-slate-800"
          }`}>
            <div className="absolute top-0 right-0 w-32 h-32 bg-teal-500/5 rounded-full blur-3xl" />

            <h2 className="text-sm font-semibold tracking-wider uppercase mb-4 flex items-center gap-2 text-slate-300">
              <TrendingUp className={`w-4 h-4 ${simulationResult && simulationResult.stabilityScore < 60 ? "text-rose-500" : "text-emerald-400"}`} />
              Simulation Metrics
            </h2>

            {simulationResult ? (
              <div className="space-y-4">
                {/* Score Dial Circle */}
                <div className="flex items-center gap-4 border-b border-slate-800 pb-4">
                  <div className={`relative w-16 h-16 rounded-full flex items-center justify-center bg-slate-900 border-2 transition-all ${
                    simulationResult.stabilityScore >= 80 ? "border-emerald-500" :
                    simulationResult.stabilityScore >= 60 ? "border-yellow-500" : "border-rose-500 animate-[pulse_1.5s_infinite] shadow-[0_0_12px_rgba(239,68,68,0.3)] bg-rose-950/25"
                  }`}>
                    <span className={`text-xl font-mono font-bold ${
                      simulationResult.stabilityScore >= 80 ? "text-emerald-400" :
                      simulationResult.stabilityScore >= 60 ? "text-yellow-400" : "text-rose-450"
                    }`}>
                      {simulationResult.stabilityScore}%
                    </span>
                  </div>
                  <div>
                    <h3 className="text-xs text-slate-400 uppercase tracking-widest">Stack Stability Class</h3>
                    <p className={`text-sm font-semibold ${
                      simulationResult.stabilityScore >= 80 ? "text-emerald-400" :
                      simulationResult.stabilityScore >= 60 ? "text-yellow-400" : "text-rose-400"
                    }`}>
                      {simulationResult.stabilityScore >= 80 ? "EXCELLENT (Rigid)" :
                       simulationResult.stabilityScore >= 60 ? "STABLE (Strap Safe)" : "CRITICAL OVERHANGS"}
                    </p>
                  </div>
                </div>

                {/* Utilisation KPI */}
                <div className="grid grid-cols-2 gap-3.5 text-xs text-slate-200">
                  <div className="bg-slate-950/80 p-3 rounded-lg border border-slate-800/60">
                    <span className="text-slate-500 block mb-0.5 font-medium uppercase font-mono text-[9px]">Utilisation</span>
                    <span className="text-xl font-bold font-mono text-white">{simulationResult.volumetricUtilisation}%</span>
                  </div>
                  <div className="bg-slate-950/80 p-3 rounded-lg border border-slate-800/60">
                    <span className="text-slate-500 block mb-0.5 font-medium uppercase font-mono text-[9px]">Loaded Weight</span>
                    <span className="text-xl font-bold font-mono text-emerald-400">{simulationResult.totalWeight.toFixed(1)} <span className="text-xs font-normal">kg</span></span>
                  </div>

                  <div className="bg-slate-950/80 p-3 rounded-lg border border-slate-800/60">
                    <span className="text-slate-500 block mb-0.5 font-medium uppercase font-mono text-[9px]">Packed Count</span>
                    <span className="text-base font-bold text-white">
                      {simulationResult.placedBoxes.length} <span className="text-[10px] text-slate-500 font-normal">/ {totalCartonsEntered} loaded</span>
                    </span>
                  </div>

                  <div className="bg-slate-950/80 p-3 rounded-lg border border-slate-800/60">
                    <span className="text-slate-500 block mb-0.5 font-medium uppercase font-mono text-[9px]">Stack Height</span>
                    <span className="text-base font-mono text-white font-semibold">
                      {simulationResult.palletUtilisedHeight} <span className="text-[10px] font-normal text-slate-500">mm</span>
                    </span>
                  </div>
                </div>

                {/* Warning message if unplaced cartoons exist */}
                {simulationResult.unplacedBoxes.length > 0 && (
                  <div className="p-3 bg-amber-500/10 border border-amber-500/30 text-[11px] text-amber-300 rounded flex gap-2">
                    <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-semibold block">Unpacked Cartons Alert</span>
                      {simulationResult.unplacedBoxes.length} box items could not be fitted safely within the {pallet.baseType === "carton" ? "master container" : "pallet"} height limits.
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-500">Add boxes configuration to run stability solver.</p>
            )}
          </div>

          {/* SYSTEM SAFETY COMMUNICATIONS & REAL-TIME ALERTS HUD */}
          {simulationResult && (
            <div className={`bg-slate-950/85 rounded-xl border p-5 shadow-lg flex flex-col transition-all duration-300 ${
              simulationResult.stabilityScore < 60 ? "border-rose-500/50 bg-rose-950/10 shadow-rose-950/25" : "border-slate-800"
            }`}>
              <div className="flex justify-between items-center mb-3">
                <h2 className="text-sm font-semibold tracking-wider uppercase flex items-center gap-2 text-slate-300">
                  <AlertTriangle className={`w-4 h-4 ${simulationResult.stabilityScore < 60 ? "text-rose-500 animate-[bounce_1.5s_infinite]" : "text-teal-400"}`} />
                  SAFETY NOTIFICATIONS
                </h2>
                {activeNotifications.length > 0 && (
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full font-bold ${
                    simulationResult.stabilityScore < 60 ? "bg-rose-500 text-white animate-pulse" : "bg-sky-500/10 text-sky-450 border border-sky-500/20"
                  }`}>
                    {activeNotifications.length} ACTIVE ALERTS
                  </span>
                )}
              </div>

              {activeNotifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center p-4 border border-dashed border-slate-800 rounded bg-slate-950/50 text-center">
                  <CheckCircle className="w-5 h-5 text-emerald-500 mb-1.5" />
                  <p className="text-xs text-slate-400 font-medium font-sans">All Stability Systems Nominal</p>
                  <p className="text-[10px] text-slate-500 font-sans mt-0.5">Stability score is within optimal parameters (&gt;= 60%).</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {activeNotifications.map((note) => (
                    <div
                      key={note.id}
                      className={`p-3 rounded-lg border flex flex-col gap-2 relative overflow-hidden transition ${
                        note.type === "danger"
                          ? "bg-rose-950/45 border-rose-500/40 text-rose-200 shadow shadow-rose-950/50 animate-pulse"
                          : "bg-amber-950/45 border-amber-500/40 text-amber-200 shadow shadow-amber-950/50"
                      }`}
                    >
                      {/* Alert Header */}
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex items-center gap-1.5">
                          <span className={`w-1.5 h-1.5 rounded-full ${note.type === "danger" ? "bg-rose-500 animate-ping" : "bg-amber-500"}`} />
                          <span className="font-bold text-[11px] leading-none tracking-normal uppercase text-white">
                            {note.title}
                          </span>
                        </div>
                        <button
                          onClick={() => setDismissedWarnings((prev) => [...prev, note.id])}
                          className="text-[10px] text-slate-400 hover:text-slate-200 transition px-1"
                          title="Dismiss alert"
                        >
                          ✕
                        </button>
                      </div>

                      {/* Alert Message */}
                      <p className="text-[11px] leading-relaxed text-slate-300">
                        {note.message}
                      </p>

                      {/* Alert Actions */}
                      {note.action && (
                        <button
                          onClick={note.action.onClick}
                          className={`mt-1 text-[10px] font-bold tracking-wider uppercase px-2 py-1 rounded text-center transition w-max ${
                            note.type === "danger"
                              ? "bg-rose-650 hover:bg-rose-600 text-white shadow-sm"
                              : "bg-amber-500 hover:bg-amber-600 text-slate-950 shadow-sm"
                          }`}
                        >
                          {note.action.label}
                        </button>
                      )}
                    </div>
                  ))}
                  <div className="flex justify-end pt-1">
                    <button
                      onClick={() => setDismissedWarnings([])}
                      className="text-[10px] text-slate-500 hover:text-slate-400 underline"
                    >
                      Reset All Dismissed Alerts
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

      </main>
      )}

      {/* YAMAHA RCX340 SETUP DIALOG */}
      {showYamahaGuide && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in" id="yamahaSetupModal">
          <div className="bg-[#1C1C1E] border border-[#2C2C2E] rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
            <div className="p-6 border-b border-[#2C2C2E] flex justify-between items-center bg-[#1C1C1E]">
              <div className="flex items-center gap-3">
                <div className="bg-emerald-500/10 p-2 rounded-lg text-emerald-400">
                  <Cpu className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold tracking-tight text-white uppercase font-sans">Yamaha RCX340 Setup Guide</h3>
                  <p className="text-[11px] text-slate-400 font-sans">Official hardware configuration and pneumatic driver handshake procedure.</p>
                </div>
              </div>
              <button 
                onClick={() => setShowYamahaGuide(false)}
                className="text-slate-400 hover:text-white transition-all text-xs border border-[#2C2C2E] px-2.5 py-1 rounded bg-[#2C2C2E] cursor-pointer font-semibold"
                id="closeYamahaSetupGuideBtn"
              >
                ✕ Close
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-6 text-slate-300 font-sans leading-relaxed text-xs">
              <div className="space-y-2">
                <h4 className="font-bold text-[#0A84FF] font-mono uppercase tracking-wider text-[10px]">1. Mechanical Setup & Pneumatic Solenoids</h4>
                <p className="text-slate-400">
                  Secure the suction-only end-effector on Axis 4 flange. Wire the 24V dry contacts to the controller:
                </p>
                <div className="bg-[#0D0D0F] border border-[#2C2C2E]/65 p-3 rounded-xl space-y-1 text-slate-405 font-mono text-[10.5px]">
                  <div className="flex justify-between border-b border-[#2C2C2E]/30 pb-1">
                    <span className="text-white">DO(1) Output:</span>
                    <span className="text-teal-400 font-bold font-sans">Main Vacuum Solenoid Valve (Hold / Grip)</span>
                  </div>
                  <div className="flex justify-between pt-1 text-slate-500">
                    <span>DO(2) Purging Out:</span>
                    <span className="font-sans">OFFLINE / NOT USED (Suction-Only Design)</span>
                  </div>
                </div>
                <p className="text-amber-400/80 bg-amber-500/10 border border-amber-500/20 px-3 py-2 rounded-lg text-[11px]">
                  <strong>Hardware Constraint:</strong> In-line positive blow-off / purging mechanism is disabled. Ensure Axis 4 has standard pneumatic pressure-relief loops to avoid suction release lag.
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="font-bold text-[#0A84FF] font-mono uppercase tracking-wider text-[10px]">2. Industrial Network Settings</h4>
                <p className="text-slate-400">
                  Set the static IP of your Yamaha RCX340 Ethernet module and match with this terminal's configurations:
                </p>
                <ul className="list-disc pl-4 text-slate-400 space-y-1">
                  <li><strong>Gateway IP Subnet:</strong> 192.168.1.xxx (Port 502)</li>
                  <li><strong>Active Modbus Mode:</strong> Host TCP Driver</li>
                  <li><strong>Default Base Register:</strong> <span className="font-mono text-teal-400">40001 (or Holding Register 0)</span></li>
                </ul>
              </div>

              <div className="space-y-2">
                <h4 className="font-bold text-[#0A84FF] font-mono uppercase tracking-wider text-[10px]">3. Sample Program Implementation (.PRG Code)</h4>
                <p className="text-slate-405">
                  Deploy this minimal polling routine on your RCX340 to parse instructions live from our Modbus TCP memory map:
                </p>
                <pre className="bg-[#0D0D0F] border border-[#2C2C2E]/65 p-3 rounded-xl overflow-x-auto text-[10px] text-emerald-400 font-mono leading-relaxed max-h-[160px]">
                  {`*POLL_LOOP:
  ' Read current sequence index from register 40001
  MOVE P, P100 ' Home / Safe altitude
  SW 1, 10 ' Delay poll
  IF DI(10) = 1 THEN GOTO *EXECUTE_PICK
  GOTO *POLL_LOOP

*EXECUTE_PICK:
  SPEED 60
  MOVE P, P1 ' Conveyor target coordinates
  DO(1) = 1 ' Activate vacuum grip (DO(2) purging unused)
  DELAY 200
  GOTO *EXECUTE_PLACE

*EXECUTE_PLACE:
  MOVE P, P2 ' Pallet drop-off translation target
  DO(1) = 0 ' Release vacuum
  DELAY 150
  GOTO *POLL_LOOP`}
                </pre>
              </div>
            </div>

            <div className="p-6 border-t border-[#2C2C2E] flex justify-end bg-[#161617]">
              <button
                onClick={() => setShowYamahaGuide(false)}
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-bold transition shadow cursor-pointer"
              >
                Got It, Thank You
              </button>
            </div>
          </div>
        </div>
      )}

      {/* AUTOMATIC SCAN SUCCESS POPUP DIALOG */}
      {showScanSuccess && (
        <div className="fixed top-6 right-6 z-50 animate-fade-in" id="scanSuccessOverlay">
          <div className="bg-[#1C1C1E]/95 border border-emerald-500 rounded-2xl p-5 shadow-2xl flex items-start gap-4 max-w-sm backdrop-blur-md">
            <div className="bg-emerald-500/10 p-2.5 rounded-xl text-emerald-400 shrink-0">
              <CheckCircle className="w-5 h-5 animate-bounce" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between mb-1">
                <h4 className="text-xs font-bold text-slate-100 uppercase tracking-widest">Scanner Success</h4>
                <div className="text-[9px] font-mono bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded font-bold animate-pulse">
                  2s AUTO CLOSE
                </div>
              </div>
              <p className="text-[11px] text-slate-350 leading-relaxed font-sans mb-3">
                Hikrobot barcode resolved successfully. Pack queue and stability metrics recalculated in real-time.
              </p>
              
              <div className="bg-[#09090A] border border-[#2C2C2E] p-3 rounded-xl font-mono text-[10.5px] leading-tight space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-slate-500 font-sans">Identifier:</span>
                  <span className="text-white truncate font-bold text-[#0A84FF]">{showScanSuccess.id}</span>
                </div>
                <div className="flex justify-between border-t border-[#2C2C2E]/45 pt-1.5">
                  <span className="text-slate-500 font-sans">Carton Profile:</span>
                  <span className="text-slate-300 font-semibold">{showScanSuccess.name}</span>
                </div>
                <div className="flex justify-between border-t border-[#2C2C2E]/45 pt-1.5">
                  <span className="text-slate-500 font-sans font-sans">Measured Size:</span>
                  <span className="text-teal-400">{showScanSuccess.length} × {showScanSuccess.width} × {showScanSuccess.height} mm</span>
                </div>
                <div className="flex justify-between border-t border-[#2C2C2E]/45 pt-1.5">
                  <span className="text-slate-500 font-sans font-sans font-sans">Reported Mass:</span>
                  <span className="text-emerald-400 font-sans">{showScanSuccess.weight} kg</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* FOOTER METADATA STATUS */}
      <footer className="border-t border-slate-800 bg-slate-950/40 text-[10px] text-slate-500 px-6 py-3 flex justify-between items-center tracking-wider">
        <span>CRAFTED FOR HEURISTIC PALLET MECHANICAL CONTROL TERMINALS · MODEL-PC-M1.1</span>
        <span>UTC TIMESTAMP: 2026-05-21 04:28Z</span>
      </footer>
    </div>
  );
}
