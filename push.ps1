cd C:\MesLineSideBoard
git add -A
git commit -m "update"
git push origin main --force
Write-Host "Done — now run 'deploy' on the server" -ForegroundColor Green
