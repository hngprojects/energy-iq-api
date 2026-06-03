@echo off
echo ============================================
echo   EnergyIQ QA Regression Suite Runner
echo ============================================
echo.

echo [1/2] Installing dependencies...
call npm install

echo.
echo [2/2] Running full regression suite...
call npm test

echo.
echo ============================================
echo   Test Complete. See reports/report.html
echo ============================================
pause
