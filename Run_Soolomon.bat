@echo off
title Soolomon SCARA ^& Hikrobot Controller
cls
echo =======================================================
echo          S O O L O M O N  --  P O R T A B L E
echo =======================================================
echo  - Portability Mode: Active (USB Dongle)
echo  - OS Platform: Windows (x64)
echo  - Auto-launching system web browser...
echo =======================================================
echo.

:: Check if Soolomon.exe exists in the current folder, fallback to Soolomon if no suffix
if exist Soolomon.exe (
    Soolomon.exe --open
) else if exist Soolomon (
    Soolomon --open
) else (
    echo [ERROR] Soolomon binary not found in this folder!
    echo Please make sure you have built and packed the binary into Soolomon.exe or Soolomon.
    echo.
    pause
)
