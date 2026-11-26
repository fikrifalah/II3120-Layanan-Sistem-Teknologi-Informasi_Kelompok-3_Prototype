const { spawn, spawnSync } = require("child_process");
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

// Install any packages added to requirements.txt since the last run (fast no-op when up to date).
if (cmd !== "uvicorn") {
  const python = path.join(path.dirname(cmd), isWin ? "python.exe" : "python");
  const pip = spawnSync(
    python,
    ["-m", "pip", "install", "-q", "--disable-pip-version-check", "-r", "requirements.txt"],
    { cwd: backendDir, stdio: "inherit" }
  );
  if (pip.status !== 0) {
    console.warn("[backend] pip install -r requirements.txt failed; starting with installed packages.");
  }
}

const child = spawn(cmd, ["main:app", "--reload"], {
  cwd: backendDir,
  stdio: "inherit",
  shell: isWin,
});

child.on("exit", (code) => {
  process.exit(code ?? 0);
});
