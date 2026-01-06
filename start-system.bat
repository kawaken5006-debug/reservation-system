@echo off
cd /d "%~dp0"

echo Starting Server and React...
echo.

start "Server-Port5001" cmd /k node server.js

timeout /t 2 /nobreak > nul

start "React-Port3000" cmd /k npx react-scripts start

echo.
echo ========================================
echo Server: http://localhost:5001
echo Booking: http://localhost:5001/booking/
echo Admin: http://localhost:3000
echo ========================================
echo.
echo Do NOT close the windows!
echo.
pause
