@echo off
REM Run every test in tools\tests\*.js sequentially. Exit non-zero on any FAIL.
setlocal enabledelayedexpansion

set FAILED=0
for %%F in ("%~dp0tests\*.js") do (
    echo.
    echo === %%~nF ===
    node "%%F"
    if errorlevel 1 set /a FAILED+=1
)

echo.
if !FAILED! GTR 0 (
    echo SUITE FAIL: !FAILED! test^(s^) failed.
    exit /b 1
) else (
    echo SUITE PASS: all tests green.
    exit /b 0
)
