@echo off
echo ========================================================
echo Inkwell / Docker Desktop Virtualization Feature Enabler
echo ========================================================
echo.
echo [1/2] Enabling Windows Virtual Machine Platform...
dism.exe /online /enable-feature /featurename:VirtualMachinePlatform /all /norestart
echo.
echo [2/2] Enabling Microsoft Windows Subsystem for Linux...
dism.exe /online /enable-feature /featurename:Microsoft-Windows-Subsystem-Linux /all /norestart
echo.
echo ========================================================
echo Windows Virtualization features enabled!
echo NOTE: A system reboot may be required by Windows to complete kernel driver activation.
echo Once rebooted, launch Docker Desktop to start container execution.
echo ========================================================
pause
