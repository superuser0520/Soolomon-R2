import express from "express";
import path from "path";
import cors from "cors";
import * as net from "net";
import { EventEmitter } from "events";
import { createRequire } from "module";
import { CartonType } from "./src/types";

const app = express();
const PORT = 3000;

// Set up server-side parsers
app.use(express.json());
app.use(express.text());
app.use(cors());

// In-Memory Database for received cartons, presets
let receivedCartons: CartonType[] = [];

// --- HIKROBOT SC6000 TCP SOCKET SERVER STATE ---
let tcpServer: net.Server | null = null;
let connectedSocket: net.Socket | null = null;
let hikrobotLogs: string[] = ["System initialized. Hikrobot SC6000 Host TCP server is ready to compile."];
let hikrobotPort = 8080; // Matches the default Tkinter listening port
let isTcpServerRunning = false;

function logHikrobot(msg: string) {
  const time = new Date().toLocaleTimeString();
  const line = `[${time}] ${msg}`;
  hikrobotLogs.push(line);
  if (hikrobotLogs.length > 50) {
    hikrobotLogs.shift();
  }
  console.log(`[HIKROBOT] ${line}`);
}

function startHikrobotTcpServer(portToBind: number, attemptCount = 0) {
  if (tcpServer) {
    stopHikrobotTcpServer();
  }

  hikrobotPort = portToBind;
  const currentServer = net.createServer((socket) => {
    // Only expect 1 camera HMI client at a time, clear dead or lingering clients safely
    if (connectedSocket) {
      logHikrobot(`[SERVER]: Clearing earlier camera connection from ${connectedSocket.remoteAddress}:${connectedSocket.remotePort}`);
      try {
        connectedSocket.destroy();
      } catch (err) {}
    }

    connectedSocket = socket;
    const clientIp = socket.remoteAddress || "Unknown IP";
    const clientPort = socket.remotePort || 0;
    logHikrobot(`[SERVER]: Camera connected from ${clientIp}:${clientPort}`);

    socket.on("data", (data) => {
      const decoded_msg = data.toString("utf8").trim();
      logHikrobot(`[CAM -> HOST]: Received: "${decoded_msg}"`);

      // Parse dimensions formatted as: L;W;H (e.g. 450;350;200)
      const parts = decoded_msg.split(";");
      if (parts.length >= 3) {
        const parsedL = Math.max(50, Math.min(2000, parseInt(parts[0]) || 350));
        const parsedW = Math.max(50, Math.min(2000, parseInt(parts[1]) || 300));
        const parsedH = Math.max(50, Math.min(2000, parseInt(parts[2]) || 200));

        if (!isNaN(parsedL) && !isNaN(parsedW) && !isNaN(parsedH)) {
          const mockWeight = 30.0; // Under this scanning method, weight is strictly assumed as 30kg.
          
          const randomColors = ["#1e3a8a", "#b45309", "#0d9488", "#e11d48", "#a855f7", "#ec4899", "#14b8a6", "#fbbf24", "#059669"];
          const selectedColor = randomColors[Math.floor(Math.random() * randomColors.length)];

          const newCarton: CartonType = {
            id: `scanned_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
            name: `Camera QA Carton [${parsedL}x${parsedW}x${parsedH}]`,
            length: parsedL,
            width: parsedW,
            height: parsedH,
            weight: mockWeight,
            color: selectedColor,
            frictionCoeff: 0.45,
            quantity: 1, // satisfying the one-by-one key-in requirement
            allowedOrientations: { flat: true, sideways: false, uprightAvailable: false }
          };

          receivedCartons.push(newCarton);
          logHikrobot(`[SERVER]: Successfully auto-added scanned carton! Dimensions: ${parsedL}x${parsedW}x${parsedH}mm, Weight: 30kg.`);
        } else {
          logHikrobot(`[ERROR]: Semicolon check passed but values are not valid integers: "${decoded_msg}"`);
        }
      } else {
        logHikrobot(`[WARNING]: Received packet with invalid "L;W;H" barcode structure: "${decoded_msg}"`);
      }
    });

    socket.on("end", () => {
      logHikrobot(`[SERVER]: Camera disconnected.`);
      if (connectedSocket === socket) {
        connectedSocket = null;
      }
    });

    socket.on("error", (err) => {
      logHikrobot(`[SERVER]: Connection error: ${err.message}`);
      if (connectedSocket === socket) {
        connectedSocket = null;
      }
    });
  });

  tcpServer = currentServer;

  currentServer.on("error", (err: any) => {
    if (err.code === "EADDRINUSE" && attemptCount < 15) {
      logHikrobot(`[SERVER ERROR]: Port ${portToBind} is in use. Retrying automatically with port ${portToBind + 1}...`);
      try {
        currentServer.close();
      } catch (e) {}
      if (tcpServer === currentServer) {
        tcpServer = null;
      }
      setTimeout(() => {
        startHikrobotTcpServer(portToBind + 1, attemptCount + 1);
      }, 100);
      return;
    }

    logHikrobot(`[SERVER ERROR]: Failed to bind or operate TCP on port ${portToBind}: ${err.message}`);
    isTcpServerRunning = false;
    if (tcpServer === currentServer) {
      tcpServer = null;
    }
    connectedSocket = null;
  });

  currentServer.listen(portToBind, "0.0.0.0", () => {
    isTcpServerRunning = true;
    logHikrobot(`[SERVER]: Host server active on 0.0.0.0:${portToBind}. Waiting for Hikrobot SC6000...`);
  });
}

function stopHikrobotTcpServer() {
  if (connectedSocket) {
    try {
      connectedSocket.destroy();
    } catch (e) {}
    connectedSocket = null;
  }
  if (tcpServer) {
    try {
      tcpServer.close();
    } catch (e) {}
    tcpServer = null;
  }
  isTcpServerRunning = false;
  logHikrobot(`[SERVER]: Host Host server stopped.`);
}

// Start default TCP socket listener on 8080 matching the camera entry default
startHikrobotTcpServer(8080);


// REST API endpoint: Retrieve current received and preset cartons
app.get("/api/cartons", (req, res) => {
  res.json({
    status: "success",
    cartons: receivedCartons,
  });
});

// --- HIKROBOT SC6000 CONTROL ENDPOINTS ---

// 1. Get current TCP server & camera socket status
app.get("/api/hikrobot/status", (req, res) => {
  res.json({
    status: "success",
    isTcpServerRunning,
    port: hikrobotPort,
    isConnected: connectedSocket !== null,
    clientAddress: connectedSocket 
      ? `${connectedSocket.remoteAddress}:${connectedSocket.remotePort}` 
      : null,
    logs: hikrobotLogs,
  });
});

// 2. Start or Stop TCP Socket listener
app.post("/api/hikrobot/toggle", (req, res) => {
  try {
    const { action, port } = req.body;
    const targetPort = parseInt(port) || 8080;
    
    if (action === "start") {
      startHikrobotTcpServer(targetPort);
    } else {
      stopHikrobotTcpServer();
    }
    
    res.json({
      status: "success",
      isTcpServerRunning,
      port: hikrobotPort,
      isConnected: connectedSocket !== null,
    });
  } catch (err: any) {
    res.status(500).json({ status: "error", error: err.message });
  }
});

// 3. Trigger Camera scan: writes raw character "1" to TCP connection
app.post("/api/hikrobot/trigger", (req, res) => {
  if (!connectedSocket) {
    return res.status(400).json({
      status: "error",
      error: "No camera client currently connected. First connect your camera to the TCP socket server."
    });
  }
  
  try {
    logHikrobot("[HOST -> CAM]: Sent trigger command '1'");
    connectedSocket.write("1"); // Sends exactly '1' as raw byte stream
    res.json({
      status: "success",
      message: "Trigger code '1' sent to camera client successfully."
    });
  } catch (err: any) {
    logHikrobot(`[ERROR]: Transmission break to camera: ${err.message}`);
    if (connectedSocket) {
      try { connectedSocket.destroy(); } catch (e) {}
      connectedSocket = null;
    }
    res.status(500).json({ status: "error", error: `Transmission break: ${err.message}` });
  }
});

// 4. Simulate a camera barcode QR scan coming in
app.post("/api/hikrobot/simulate", (req, res) => {
  try {
    const { data } = req.body;
    if (!data || typeof data !== "string") {
      return res.status(400).json({ status: "error", error: "Missing or invalid 'data' parameter in body." });
    }
    
    logHikrobot(`[SIMULATOR]: Injected raw scan input: "${data.trim()}"`);
    const decoded = data.trim();
    const parts = decoded.split(";");
    if (parts.length >= 3) {
      const parsedL = Math.max(50, Math.min(2000, parseInt(parts[0]) || 350));
      const parsedW = Math.max(50, Math.min(2000, parseInt(parts[1]) || 300));
      const parsedH = Math.max(50, Math.min(2000, parseInt(parts[2]) || 200));

      if (!isNaN(parsedL) && !isNaN(parsedW) && !isNaN(parsedH)) {
        const mockWeight = 30.0; // strictly 30kg under this scanning method
        
        const randomColors = ["#1e3a8a", "#b45309", "#0d9488", "#e11d48", "#a855f7", "#ec4899", "#14b8a6", "#fbbf24", "#059669"];
        const selectedColor = randomColors[Math.floor(Math.random() * randomColors.length)];

        const newCarton: CartonType = {
          id: `scanned_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
          name: `Camera QR Scanned [${parsedL}x${parsedW}x${parsedH}]`,
          length: parsedL,
          width: parsedW,
          height: parsedH,
          weight: mockWeight,
          color: selectedColor,
          frictionCoeff: 0.45,
          quantity: 1,
          allowedOrientations: { flat: true, sideways: false, uprightAvailable: false }
        };

        receivedCartons.push(newCarton);
        logHikrobot(`[SYSTEM]: Auto-added scanned carton to inventory! Dimensions: ${parsedL}x${parsedW}x${parsedH}mm, Weight: 30kg.`);
        
        return res.json({
          status: "success",
          message: `Simulated scan successful! Added carton: ${parsedL}x${parsedW}x${parsedH}mm.`,
          carton: newCarton
        });
      }
    }
    
    return res.status(400).json({
      status: "error",
      error: `Failed to parse. Expected 'Length;Width;Height' separated by semicolons (e.g. '400;300;200'), got '${decoded}'`
    });
  } catch (err: any) {
    res.status(550).json({ status: "error", error: err.message });
  }
});

// In-memory store for robotic kinematics path coordinates
let currentRoboticPath: any = null;

// REST API endpoint: Update current robotic placement coordinates
app.post("/api/robotic-path", (req, res) => {
  try {
    currentRoboticPath = req.body;
    res.json({
      status: "success",
      message: "Robotic path coordinates updated successfully.",
      timestamp: new Date().toISOString()
    });
  } catch (err: any) {
    res.status(500).json({ status: "error", error: err.message });
  }
});

// Real-time simulator tracking state for Mockup Simulator Integration
let currentSimulatorState = {
  activeStepIndex: 0,
  executionState: "idle", // "idle" | "moving_to_pick" | "picking" | "moving_to_place" | "placing" | "returning_home" | "completed"
  robotStatusText: "Standing by. Awaiting scanned carton.",
  pickCoords: { x: 0, y: 0, z: 0, r: 0 },
  placeCoords: { x: 0, y: 0, z: 0, r: 0 },
  cartonData: { l: 0, w: 0, h: 0, weight: 0, name: "" },
  lastUpdated: new Date().toISOString()
};

// REST API endpoint: Retrieve active simulation state
app.get("/api/simulator/state", (req, res) => {
  res.json(currentSimulatorState);
});

// REST API endpoint: Update active simulation state (called by current app or simulator)
app.post("/api/simulator/state", (req, res) => {
  try {
    currentSimulatorState = {
      ...currentSimulatorState,
      ...req.body,
      lastUpdated: new Date().toISOString()
    };
    res.json({
      status: "success",
      message: "Simulator state updated successfully.",
      state: currentSimulatorState
    });
  } catch (err: any) {
    res.status(500).json({ status: "error", error: err.message });
  }
});

// REST API endpoint: Retrieve active pallet robotic arm coordinates
app.get("/api/robotic-path", (req, res) => {
  if (!currentRoboticPath) {
    return res.status(404).json({
      status: "error",
      error: "No active robotic palletizing plan exists."
    });
  }
  res.json(currentRoboticPath);
});

// REST API endpoint: Update the carton configurations
app.post("/api/cartons-update", (req, res) => {
  try {
    const updated = req.body;
    if (Array.isArray(updated)) {
      receivedCartons = updated;
      res.json({ status: "success", cartons: receivedCartons });
    } else {
      res.status(400).json({ status: "error", error: "Invalid body format" });
    }
  } catch (err: any) {
    res.status(500).json({ status: "error", error: err.message });
  }
});

// REST API endpoint: Clear loaded cartons list
app.post("/api/clear-cartons", (req, res) => {
  receivedCartons = [];
  res.json({ status: "success", cartons: [] });
});

// REST API endpoint: Reset to factory defaults
app.post("/api/reset-factory", (req, res) => {
  receivedCartons = [
    {
      id: "preset_heavy",
      name: "Heavy Base Container",
      length: 400,
      width: 350,
      height: 250,
      weight: 12.0,
      color: "#1e3a8a",
      frictionCoeff: 0.55,
      quantity: 6,
      allowedOrientations: { flat: true, sideways: false, uprightAvailable: false },
    },
    {
      id: "preset_medium",
      name: "Medium Corrugated Box",
      length: 300,
      width: 300,
      height: 200,
      weight: 5.5,
      color: "#b45309",
      frictionCoeff: 0.48,
      quantity: 8,
      allowedOrientations: { flat: true, sideways: false, uprightAvailable: false },
    },
    {
      id: "preset_slippery",
      name: "Glossy Slip-coated Case",
      length: 400,
      width: 200,
      height: 300,
      weight: 8.0,
      color: "#0d9488",
      frictionCoeff: 0.24,
      quantity: 4,
      allowedOrientations: { flat: true, sideways: false, uprightAvailable: false },
    },
    {
      id: "preset_light",
      name: "Small Accessory Pack",
      length: 200,
      width: 150,
      height: 150,
      weight: 1.8,
      color: "#6b7280",
      frictionCoeff: 0.40,
      quantity: 5,
      allowedOrientations: { flat: true, sideways: false, uprightAvailable: false },
    }
  ];
  res.json({ status: "success", cartons: receivedCartons });
});

// --- YAMAHA RCX340 CLIENT ---
class Rcx340Client extends EventEmitter {
  private host: string;
  private port: number;
  private socket: net.Socket | null = null;
  private isConnected: boolean = false;
  private commandQueue: { cmd: string, isCtrlC: boolean, resolve: (val: string) => void, reject: (err: Error) => void }[] = [];
  private currentCommand: { cmd: string, isCtrlC: boolean, resolve: (val: string) => void, reject: (err: Error) => void } | null = null;
  private receiveBuffer: string = "";
  private mockMode: boolean;

  constructor(host: string, port: number = 23, mockMode: boolean = false) {
    super();
    this.host = host;
    this.port = port;
    this.mockMode = mockMode;
  }

  public connect(): Promise<void> {
    if (this.mockMode) {
      this.isConnected = true;
      this.emit('connected');
      return Promise.resolve();
    }
    return new Promise((resolve, reject) => {
      this.socket = new net.Socket();
      this.socket.setTimeout(5000);

      this.socket.connect(this.port, this.host, () => {
        this.isConnected = true;
        this.emit('connected');
        resolve();
      });

      this.socket.on('data', (data) => {
        // Telnet negotiation: simple rejection of options
        const telnetPattern = /^\xff[\xfb-\xfe]./;
        if (telnetPattern.test(data.toString('binary'))) {
          // Send WONT/DONT to ignore telnet negotiation
          const response = Buffer.from([0xff, 0xfc, data[2]]); // IAC WONT <option>
          this.socket!.write(response);
          return;
        }

        this.receiveBuffer += data.toString('ascii');
        this.processBuffer();
      });

      this.socket.on('error', (err) => {
        this.emit('error', err);
        if (!this.isConnected) reject(err);
        this.disconnect();
      });

      this.socket.on('close', () => {
        this.isConnected = false;
        this.emit('disconnected');
        this.currentCommand?.reject(new Error("Socket closed"));
        this.currentCommand = null;
        this.commandQueue.forEach(q => q.reject(new Error("Socket closed")));
        this.commandQueue = [];
      });
      
      this.socket.on('timeout', () => {
         this.emit('error', new Error('Connection timeout'));
         if (!this.isConnected) reject(new Error('Connection timeout'));
         this.disconnect();
      });
    });
  }

  public disconnect() {
    this.isConnected = false;
    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }
    this.currentCommand?.reject(new Error("Disconnected"));
    this.currentCommand = null;
    this.commandQueue.forEach(q => q.reject(new Error("Disconnected")));
    this.commandQueue = [];
  }

  private processBuffer() {
    if (!this.currentCommand) {
       this.receiveBuffer = "";
       return;
    }

    // Checking for OK, END, READY, or NG=...
    if (this.receiveBuffer.includes("OK\r\n") || 
        this.receiveBuffer.includes("END\r\n") || 
        this.receiveBuffer.includes("READY\r\n") || 
        /^NG=\d{2}\.\d{3}/m.test(this.receiveBuffer)) {
        
        const response = this.receiveBuffer;
        this.receiveBuffer = "";
        const cmdToResolve = this.currentCommand;
        this.currentCommand = null;
        cmdToResolve.resolve(response.trim());
        this.processQueue();
    }
  }

  public sendCommand(cmd: string): Promise<string> {
    return new Promise((resolve, reject) => {
      this.commandQueue.push({ cmd, isCtrlC: false, resolve, reject });
      if (!this.currentCommand) {
        this.processQueue();
      }
    });
  }

  public sendCtrlC(): Promise<string> {
    return new Promise((resolve, reject) => {
      // Clear queue and prepend CtrlC
      this.commandQueue.forEach(q => q.reject(new Error("Interrupted by Ctrl+C")));
      this.commandQueue = [{ cmd: "\x03", isCtrlC: true, resolve, reject }];
      if (!this.currentCommand) {
        this.processQueue();
      }
    });
  }

  private processQueue() {
    if (this.commandQueue.length === 0 || this.currentCommand) return;
    
    this.currentCommand = this.commandQueue.shift()!;
    this.receiveBuffer = "";

    if (this.mockMode) {
      setTimeout(() => {
        let mockResponse = "OK";
        if (this.currentCommand!.cmd.startsWith("@?WHRXY")) {
           mockResponse = "0.000 0.000 0.000 0.000\r\nOK";
        } else if (this.currentCommand!.cmd.startsWith("@?MODE")) {
           mockResponse = "1\r\nOK";
        }
        
        const cmdToResolve = this.currentCommand;
        this.currentCommand = null;
        cmdToResolve?.resolve(mockResponse);
        this.processQueue();
      }, 100);
      return;
    }

    if (!this.isConnected || !this.socket) {
      const errCmd = this.currentCommand;
      this.currentCommand = null;
      errCmd.reject(new Error("Not connected"));
      this.processQueue();
      return;
    }

    const payload = this.currentCommand.isCtrlC ? "\x03" : `${this.currentCommand.cmd}\r\n`;
    
    // Safety timeout
    const timeout = setTimeout(() => {
        if (this.currentCommand) {
            const errCmd = this.currentCommand;
            this.currentCommand = null;
            this.receiveBuffer = "";
            errCmd.reject(new Error("Command timeout"));
            this.processQueue();
        }
    }, 5000);

    const ogResolve = this.currentCommand.resolve;
    const ogReject = this.currentCommand.reject;

    this.currentCommand.resolve = (val) => {
        clearTimeout(timeout);
        ogResolve(val);
    };
    
    this.currentCommand.reject = (err) => {
        clearTimeout(timeout);
        ogReject(err);
    };

    this.socket.write(payload, 'ascii');
  }
}

let activeYamahaClient: Rcx340Client | null = null;
let yamahaLogs: { time: string; msg: string; type: "info" | "error" | "tx" | "rx" }[] = [];

function logYamaha(msg: string, type: "info" | "error" | "tx" | "rx" = "info") {
  const time = new Date().toLocaleTimeString();
  yamahaLogs.push({ time, msg, type });
  if (yamahaLogs.length > 100) yamahaLogs.shift();
  console.log(`[YAMAHA] ${msg}`);
}

app.post("/api/yamaha/connect", async (req, res) => {
  const { host, port, mockMode } = req.body;
  if (activeYamahaClient) {
    activeYamahaClient.disconnect();
  }
  
  activeYamahaClient = new Rcx340Client(host || "192.168.0.2", parseInt(port) || 23, mockMode);
  logYamaha(`Connecting to ${host}:${port} (Mock: ${mockMode})`, "info");
  
  activeYamahaClient.on("error", (err) => logYamaha(err.message, "error"));
  activeYamahaClient.on("disconnected", () => logYamaha("Disconnected", "info"));

  try {
    await activeYamahaClient.connect();
    logYamaha("Connected successfully", "info");
    res.json({ status: "success" });
  } catch (err: any) {
    logYamaha(`Connection failed: ${err.message}`, "error");
    res.status(500).json({ status: "error", error: err.message });
  }
});

app.post("/api/yamaha/disconnect", (req, res) => {
  if (activeYamahaClient) {
    activeYamahaClient.disconnect();
    activeYamahaClient = null;
  }
  logYamaha("Disconnected requested by user", "info");
  res.json({ status: "success" });
});

app.post("/api/yamaha/command", async (req, res) => {
  if (!activeYamahaClient) {
    return res.status(400).json({ status: "error", error: "Not connected" });
  }
  const { cmd, isCtrlC } = req.body;
  logYamaha(isCtrlC ? "^C" : cmd, "tx");
  
  try {
    const response = isCtrlC ? await activeYamahaClient.sendCtrlC() : await activeYamahaClient.sendCommand(cmd);
    logYamaha(response.replace(/\r/g, "\\r").replace(/\n/g, "\\n"), "rx");
    res.json({ status: "success", response });
  } catch (err: any) {
    logYamaha(err.message, "error");
    res.status(500).json({ status: "error", error: err.message });
  }
});

app.get("/api/yamaha/status", (req, res) => {
  res.json({ 
    isConnected: activeYamahaClient != null && (activeYamahaClient as any).isConnected,
    logs: yamahaLogs
  });
});

app.post("/api/yamaha/clear-logs", (req, res) => {
  yamahaLogs = [];
  res.json({ status: "success" });
});

// 6. Mount Vite middleware for development or Static bundle serving for production.
async function initServer() {
  // Standalone executable or default runs should default to production mode
  const isDev = process.env.NODE_ENV !== "production" && !("pkg" in process);

  if (isDev) {
    const { createServer: createViteServer } = await import("vite");
    const viteServer = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(viteServer.middlewares);
  } else {
    // Robust detection of package path for both normal run and pkg virtual filesystem (/snapshot)
    const distPath = typeof __dirname !== "undefined"
      ? (path.basename(__dirname) === "dist" ? __dirname : path.join(__dirname, "dist"))
      : path.join(process.cwd(), "dist");
    
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Express developer server running on http://0.0.0.0:${PORT}`);
    
    // Auto-launch web browser on PC startup when run locally (portable/desktop modes)
    if (process.env.OPEN_BROWSER === "true" || process.argv.includes("--open")) {
      const url = `http://localhost:${PORT}`;
      // Import sequentially inside block to avoid static ESM vs CJS bundling discrepancies
      const { exec } = require("child_process");
      const startCmd = process.platform === "win32" ? `start ${url}` : process.platform === "darwin" ? `open ${url}` : `xdg-open ${url}`;
      exec(startCmd, (error: any) => {
        if (error) {
          console.log(`[PORTABLE]: Server active. Please open your browser at ${url}`);
        } else {
          console.log(`[PORTABLE]: Launched system web browser pointing to ${url}`);
        }
      });
    }
  });
}

initServer();
