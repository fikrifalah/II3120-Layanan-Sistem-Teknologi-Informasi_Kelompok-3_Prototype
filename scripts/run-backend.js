const { spawn } = require("child_process");
const path = require("path");
const fs = require("fs");

const isWin = process.platform === "win32";
const backendDir = path.resolve(__dirname, "..", "backend");

const venvUvicorn = isWin
  ? path.join(backendDir, ".venv", "Scripts", "uvicorn.exe")
  : path.join(backendDir, ".venv", "bin", "uvicorn");

const fallbackVenvUvicorn = isWin
  ? path.join(backendDir, "venv", "Scripts", "uvicorn.exe")
  : path.join(backendDir, "venv", "bin", "uvicorn");

let cmd = "uvicorn";
if (fs.existsSync(venvUvicorn)) {
  cmd = venvUvicorn;
} else if (fs.existsSync(fallbackVenvUvicorn)) {
  cmd = fallbackVenvUvicorn;
}

const child = spawn(cmd, ["main:app", "--reload"], {
  cwd: backendDir,
  stdio: "inherit",
  shell: isWin,
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
