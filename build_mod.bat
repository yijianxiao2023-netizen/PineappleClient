@echo off
cd /d "%~dp0mod"
call gradlew.bat build || exit /b 1
del /q "..\launcher\mods\pineappleclient-*.jar" 2>nul
for %%f in (build\libs\pineappleclient-*.jar) do (
  echo %%f | findstr /i "sources" >nul || copy /y "%%f" "..\launcher\mods\" >nul
)
echo Mod built and copied to launcher\mods
