@echo off
title Smart City Complaint Management System
echo =========================================================
echo   Starting Smart City Complaint Management System...
echo =========================================================
cd /d "%~dp0"
node backend/scripts/start-all.js
pause

