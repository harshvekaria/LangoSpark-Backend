@echo off
echo Starting server in test mode...

:: Start the server in a new window with TEST environment
start "Test Server" cmd /c "set TEST=true && npm run dev"

:: Wait for server to start
timeout /t 10

echo Server started
echo Running tests...

:: Run the tests
call npm test

:: Store the test result
set TEST_RESULT=%ERRORLEVEL%

:: Ask user to close the server window
echo Please close the server window that was opened.
pause

:: Return the test result
if %TEST_RESULT% EQU 0 (
  echo All tests passed!
  exit /b 0
) else (
  echo Some tests failed.
  exit /b %TEST_RESULT%
) 