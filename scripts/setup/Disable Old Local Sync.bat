@echo off
title Disable Old M-Machine Local Sync
powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "Start-Process powershell.exe -Verb RunAs -ArgumentList '-NoProfile -ExecutionPolicy Bypass -File ""%~dp0Disable-Local-MMachine-Sync.ps1""'"
