@echo off
echo Starting Custom Patike Admin Sub-App on Port 4050...
cd /d "%~dp0admin"
if not exist node_modules (
    echo Installing admin dependencies...
    npm install
)
echo Launching Admin Server on http://localhost:4050 ...
node server.js
pause
