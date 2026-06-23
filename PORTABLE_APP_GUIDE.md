# 💻 Portable USB Dongle Desktop App Guide: **Soolomon** (S Logo)

This guide provides step-by-step instructions to compile and pack the **Soolomon** app to run offline off a **portable USB dongle (thumb drive)**. 

With this setup, you can walk up to any Industrial PC (IPC), plug in your USB drive, double-click the `Soolomon.exe` executor, and run the complete SCARA robotic sequence & Hikrobot SC6000 vision services—**with zero dependencies, no installation, and no Node.js/Git required on the target machine!**

The app is branded with a single elegant **"S"** status logo and launches instantly.

---

## 📂 USB Drive Workspace Directory Layout
For the ultimate portable experience, set up your USB drive so it is organized cleanly. We recommend the following structure on your USB thumb drive:

```text
[USB Drive]  (e.g., FAT32 or exFAT formatted for Windows/Linux compatibility)
 ├── ⚙️ Soolomon.exe                     <-- Soolomon Dual-Compiled Windows Portable Binary
 ├── ⚙️ Soolomon-linux                   <-- Soolomon Dual-Compiled Linux Portable Binary
 ├── 🕹️ Run_Soolomon.bat                <-- Double-click to launch on Windows (Automated)
 └── 🕹️ Run_Soolomon.sh                 <-- Double-click/shell launch on Linux (Bypasses USB locks!)
```

---

## 🚀 Step 1: Exporting & Building the Code Locally

To package **Soolomon**, you first build and compile the current full-stack React + Express bundles on your development computer:

1. **Download/Clone the Repository:** 
   Extract your Soolomon repository folder onto your local computer.
2. **Install Local Dependencies (CRITICAL):**
   Open a terminal in the folder on your computer and run:
   ```bash
   npm install
   ```
   *If you skip this step, you will see an error: `'vite' is not recognized as an internal or external command`. Cooking the production assets requires local dependencies to be installed first.*
3. **Build the current bundle:**
   Compile the production client and backend files:
   ```bash
   npm run build
   ```
   *This compiles the React frontend elements under `/dist/`, and creates the bundled, backend Express controller at `/dist/server.cjs`.*

---

## 📦 Step 2: Compiling Into a Desktop Executable (`Soolomon`)

We use **Vercel's `pkg`** compiler to package the compiled Javascript bundles and static React visual files into a single, fully binary, offline execution pack.

1. **Install `pkg` globally:**
   ```bash
   npm install -g pkg
   ```

2. **Add asset mappings inside your `package.json`:**
   Configure `package.json` to include the compiled `/dist/` folder resources and the main server index as the binary launch pad:
   ```json
   "bin": "dist/server.cjs",
   "pkg": {
     "assets": [
       "dist/**/*"
     ],
     "targets": [
       "node18-win-x64",
       "node18-macos-x64",
       "node18-linux-x64"
     ]
   }
   ```

3. **Pack the Soolomon Executable:**
   In your terminal, execute:
   ```bash
   pkg . --output Soolomon
   ```
   *This single command will output:*
   * 🖥️ **`Soolomon.exe`** (Windows Portable Binary)
   * 🍎 **`Soolomon-macos`** (macOS Portable Binary)
   * 🐧 **`Soolomon-linux`** (Linux Portable Binary)

### ⚠️ Troubleshooting common compiler messages

#### 1) "Warning Failed to make bytecode node18-x64 for file..."
If you see various lines of warnings such as:
```text
Warning Failed to make bytecode node18-x64 for file /snapshot/02 Mix Case/node_modules/...
```
**This is fully expected and safe to ignore!** Here is why:
* **The Cause:** `pkg` tries to pre-compile the Javascript code in your `node_modules` (including `@google/genai`, `node-fetch`, or `vite`) into binary Node bytecode to hide the source code or speed up loading. Some packages are written in ESM/MJS format or contain features that cannot be pre-compiled into bytecode statically.
* **The Result:** When it fails, `pkg` automatically falls back to packaging the files seamlessly as plain-text raw Javascript inside the executable's virtual directory. It **will still execute perfectly** at runtime.

#### 2) "Warning Babel parse has failed: import.meta..."
If you see the warning:
```text
Warning Babel parse has failed: import.meta may appear only with 'sourceType: "module"'
```
* **Why it's Safe:** This warning is issued because `pkg` scans client-side web browser files under `dist/assets/index.js` which use modern Vite environment parameters (`import.meta.env`). These assets are served *exclusively* to the client's web browser and are never executed directly by the Node runtime. Soolomon will serve them accurately and everything will load flawlessly.

#### 3) What if Soolomon.exe flashes and closes immediately?
* **The Cause:** If Soolomon.exe flashes and closes, it was likely trying to boot in a developer environment (`process.env.NODE_ENV !== "production"`) which triggers loading of raw unbundled `vite` source dependencies that don't exist inside.
* **The Resolution (Fixed!):** We have optimized **`server.ts`** dynamically to always check `!("pkg" in process)` and default to production static serving unless `NODE_ENV` is explicitly set to `"development"`. The executable will now boot **fully stable out-of-the-box in absolute production mode on double-click**, resolving any instant crashing.

---

## 💾 Step 3: Placing the App Onto Your USB Dongle

1. Insert your USB thumb drive (dongle) into your development machine.
2. Transfer **`Soolomon.exe`** (Windows) and **`Soolomon-linux`** (Linux) directly into the **root folder** of your USB drive.
3. Copied directly onto the root folder, place:
   - **`Run_Soolomon.bat`** (Windows batch launcher)
   - **`Run_Soolomon.sh`** (Linux launcher script)

---

## 🖥️ Running on Windows IPCs
On your Windows Industrial PC (IPC):
1. Plug in your USB dongle.
2. Double-click the **`Run_Soolomon.bat`** script.
3. Done! Soolomon boots instantly and automatically loads in the system's default browser (standard Chrome, Edge, or Firefox).

---

## 🐧 Running on Linux IPCs (e.g. Ubuntu, Debian, RedHat)
Most USB flash drives are formatted with **FAT32** or **exFAT** so they work on both Windows and Linux. However, **Linux dynamically treats USB drives as high-security (`noexec`) file systems**, meaning you cannot directly execute files on the USB thumb drive (attempts will show: `Permission denied`, even after running `chmod +x`).

To bypass this automatic OS restriction seamlessly:
1. Plug in your USB dongle on your Linux IPC.
2. Open a terminal inside the USB drive folder (or navigate there via `cd`).
3. Run the automated launcher:
   ```bash
   ./Run_Soolomon.sh
   ```
4. **How it works:** The launcher copies the `Soolomon-linux` binary to `/tmp/soolomon_portable` (the host PC's high-speed RAM-backed storage), automatically sets correct POSIX executable permissions, boots the server, triggers the system browser, and cleans up after exit! Very slick and fully compliant.

---

## 🎨 Step 4: The Elegant single "S" Branding Config
This software has been pre-configured with a clean, high-performance **teal "S" vector favicon logo**. 
- Whenever Soolomon is booted from the USB drive on any computer, it automatically serves the customized favicon logo with a **minimalist teal "S" curve** on top of a deep space-slate background tile.
- The browser tab and title header bar are statically set to **`Soolomon`**.
- To customized the icon image embedded directly within Windows Explorer for the `.exe` file itself, you can optionally wrap the compiled binaries using a free icon compiler utility like **Resource Hacker** or **Quick Any2Ico** to assign a custom `.ico` version of your stylized "S" brand logo.

---

## 🔌 Connection Checklist on Target Machinery

Once you plug your USB dongle into the target controller computer at the industrial site, perform this brief 2-step setup:

### 1) Set Static IPv4 Address on Host PC
1. Press `Win + R`, type `ncpa.cpl` and press Enter to open **Network Connections**.
2. Right-click your Ethernet adapter and choose **Properties**.
3. Select **Internet Protocol Version 4 (TCP/IPv4)** and click **Properties**.
4. Check **"Use the following IP address"** and configure:
   * **IP Address:** `192.168.1.5` *(or any unused IP on the robot/camera subnet)*
   * **Subnet Mask:** `255.255.255.0`
   * **Default Gateway:** Leave blank (no routing necessary)
5. Save and hit OK.

### 2) Point Hikrobot SC6000 & SCARA Slave to the PC
* **Hikrobot SC6000:** Setup the smart camera output data stream inside your MVS configurations as a **TCP Client** pointed to IP: `192.168.1.5` and Port: `8080`.
* **Soolomon GUI:** Use the dashboard to input the IP address of your Yamaha Modbus slave (e.g., `192.168.1.100` on port `502`) and transition to **Production Mode** to execute live handshakes!
