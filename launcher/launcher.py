import hashlib
import json
import os
import platform
import queue
import shutil
import subprocess
import sys
import threading
import urllib.parse
import uuid
import webbrowser
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path

import tkinter as tk
from tkinter import filedialog, messagebox, ttk

import minecraft_launcher_lib as mll
import requests

APP_NAME = "PineappleClient"
APP_VERSION = "1.0.0"
DEFAULT_MC_VERSION = "1.21.1"
REDIRECT_PORT = 8765
REDIRECT_URI = f"http://localhost:{REDIRECT_PORT}/callback"
USER_AGENT = f"SlaxY1r/{APP_NAME}-launcher/{APP_VERSION}"

LAUNCHER_DIR = Path(getattr(sys, "_MEIPASS", Path(__file__).resolve().parent))
BUNDLED_MODS_DIR = LAUNCHER_DIR / "mods"


def instance_dir() -> Path:
    system = platform.system()
    if system == "Windows":
        base = Path(os.environ.get("APPDATA", Path.home()))
        return base / ".pineappleclient"
    if system == "Darwin":
        return Path.home() / "Library" / "Application Support" / "pineappleclient"
    return Path.home() / ".pineappleclient"


GAME_DIR = instance_dir()
CONFIG_FILE = GAME_DIR / "launcher_config.json"

DEFAULT_CONFIG = {
    "username": "Player",
    "version": DEFAULT_MC_VERSION,
    "use_fabric": True,
    "ram_gb": 4,
    "account_type": "offline",
    "ms_client_id": "",
    "ms_refresh_token": "",
    "ms_name": "",
    "extra_mods": [],
}


def load_config() -> dict:
    cfg = dict(DEFAULT_CONFIG)
    if CONFIG_FILE.exists():
        try:
            cfg.update(json.loads(CONFIG_FILE.read_text()))
        except Exception:
            pass
    return cfg


def save_config(cfg: dict) -> None:
    GAME_DIR.mkdir(parents=True, exist_ok=True)
    CONFIG_FILE.write_text(json.dumps(cfg, indent=2))


def offline_uuid(name: str) -> str:
    digest = bytearray(hashlib.md5(f"OfflinePlayer:{name}".encode()).digest())
    digest[6] = (digest[6] & 0x0F) | 0x30
    digest[8] = (digest[8] & 0x3F) | 0x80
    return str(uuid.UUID(bytes=bytes(digest)))


def http_json(url: str):
    r = requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=30)
    r.raise_for_status()
    return r.json()


def download(url: str, dest: Path) -> None:
    tmp = dest.with_suffix(dest.suffix + ".part")
    with requests.get(url, headers={"User-Agent": USER_AGENT}, timeout=60, stream=True) as r:
        r.raise_for_status()
        with open(tmp, "wb") as f:
            for chunk in r.iter_content(1 << 16):
                f.write(chunk)
    tmp.replace(dest)


def ensure_fabric_api(mc_version: str, mods_dir: Path, log) -> None:
    params = urllib.parse.urlencode({
        "loaders": json.dumps(["fabric"]),
        "game_versions": json.dumps([mc_version]),
    })
    versions = http_json(f"https://api.modrinth.com/v2/project/fabric-api/version?{params}")
    if not versions:
        log(f"No Fabric API build found for {mc_version}")
        return
    files = versions[0]["files"]
    primary = next((f for f in files if f.get("primary")), files[0])
    target = mods_dir / primary["filename"]
    for old in mods_dir.glob("fabric-api-*.jar"):
        if old.name != target.name:
            old.unlink()
    if target.exists():
        log(f"Fabric API up to date ({primary['filename']})")
        return
    log(f"Downloading {primary['filename']}")
    download(primary["url"], target)


def sync_mods(cfg: dict, mods_dir: Path, log) -> None:
    sources = []
    if BUNDLED_MODS_DIR.is_dir():
        sources += sorted(BUNDLED_MODS_DIR.glob("*.jar"))
    sources += [Path(p) for p in cfg.get("extra_mods", []) if Path(p).is_file()]
    for src in sources:
        dest = mods_dir / src.name
        if not dest.exists() or dest.stat().st_mtime < src.stat().st_mtime:
            shutil.copy2(src, dest)
            log(f"Installed mod {src.name}")
    if not any(mods_dir.glob("pineappleclient*.jar")):
        log("PineappleClient mod jar not found. Build it and put it in launcher/mods/")


class CallbackCatcher(BaseHTTPRequestHandler):
    result = None

    def do_GET(self):
        CallbackCatcher.result = f"http://localhost:{REDIRECT_PORT}{self.path}"
        self.send_response(200)
        self.send_header("Content-Type", "text/html")
        self.end_headers()
        self.wfile.write(b"<h2>Signed in. You can close this tab and go back to PineappleClient.</h2>")

    def log_message(self, *args):
        pass


def microsoft_login(client_id: str) -> dict:
    url, state, verifier = mll.microsoft_account.get_secure_login_data(client_id, REDIRECT_URI)
    CallbackCatcher.result = None
    server = HTTPServer(("localhost", REDIRECT_PORT), CallbackCatcher)
    server.timeout = 300
    webbrowser.open(url)
    server.handle_request()
    server.server_close()
    if not CallbackCatcher.result:
        raise RuntimeError("Login timed out")
    code = mll.microsoft_account.parse_auth_code_url(CallbackCatcher.result, state)
    return mll.microsoft_account.complete_login(client_id, None, REDIRECT_URI, code, verifier)


class Launcher(tk.Tk):
    def __init__(self):
        super().__init__()
        self.cfg = load_config()
        self.events = queue.Queue()
        self.busy = False
        self.game = None

        self.title(f"{APP_NAME} Launcher")
        self.geometry("640x560")
        self.minsize(560, 480)
        self.configure(bg="#14161c")
        self._style()
        self._build()
        self._refresh_account()
        self.after(50, self._pump)
        threading.Thread(target=self._load_versions, daemon=True).start()

    def _style(self):
        s = ttk.Style(self)
        s.theme_use("clam")
        bg, panel, fg, accent = "#14161c", "#1e212b", "#e8e8e8", "#f7c948"
        s.configure(".", background=bg, foreground=fg, fieldbackground=panel, bordercolor=panel)
        s.configure("TLabel", background=bg, foreground=fg)
        s.configure("Title.TLabel", font=("Segoe UI", 22, "bold"), foreground=accent)
        s.configure("Sub.TLabel", foreground="#9aa0ad")
        s.configure("TCheckbutton", background=bg, foreground=fg)
        s.configure("TRadiobutton", background=bg, foreground=fg)
        s.configure("TButton", background=panel, foreground=fg, padding=6)
        s.map("TButton", background=[("active", "#2a2e3b")])
        s.configure("Play.TButton", background=accent, foreground="#0b0d12", font=("Segoe UI", 14, "bold"), padding=10)
        s.map("Play.TButton", background=[("active", "#ffd966"), ("disabled", "#4a4f5c")])
        s.configure("Horizontal.TProgressbar", background=accent, troughcolor=panel)
        s.configure("TLabelframe", background=bg, foreground=fg)
        s.configure("TLabelframe.Label", background=bg, foreground=accent)

    def _build(self):
        pad = {"padx": 12, "pady": 4}
        ttk.Label(self, text="PineappleClient", style="Title.TLabel").pack(anchor="w", padx=12, pady=(12, 0))
        ttk.Label(self, text=f"Instance folder: {GAME_DIR}", style="Sub.TLabel").pack(anchor="w", padx=12)

        acc = ttk.LabelFrame(self, text="Account")
        acc.pack(fill="x", **pad)
        self.account_type = tk.StringVar(value=self.cfg["account_type"])
        ttk.Radiobutton(acc, text="Offline (singleplayer / offline servers)", value="offline",
                        variable=self.account_type, command=self._refresh_account).grid(row=0, column=0, columnspan=2, sticky="w", padx=8)
        ttk.Radiobutton(acc, text="Microsoft account", value="microsoft",
                        variable=self.account_type, command=self._refresh_account).grid(row=1, column=0, columnspan=2, sticky="w", padx=8)
        ttk.Label(acc, text="Username").grid(row=2, column=0, sticky="w", padx=8, pady=4)
        self.username = tk.StringVar(value=self.cfg["username"])
        self.username_entry = ttk.Entry(acc, textvariable=self.username, width=24)
        self.username_entry.grid(row=2, column=1, sticky="w", pady=4)
        ttk.Label(acc, text="Azure client ID").grid(row=3, column=0, sticky="w", padx=8)
        self.client_id = tk.StringVar(value=self.cfg["ms_client_id"])
        self.client_id_entry = ttk.Entry(acc, textvariable=self.client_id, width=40)
        self.client_id_entry.grid(row=3, column=1, sticky="w")
        self.ms_status = ttk.Label(acc, text="", style="Sub.TLabel")
        self.ms_status.grid(row=4, column=0, columnspan=2, sticky="w", padx=8)
        btns = ttk.Frame(acc)
        btns.grid(row=5, column=0, columnspan=2, sticky="w", padx=8, pady=4)
        self.login_btn = ttk.Button(btns, text="Sign in", command=self._login)
        self.login_btn.pack(side="left")
        self.logout_btn = ttk.Button(btns, text="Sign out", command=self._logout)
        self.logout_btn.pack(side="left", padx=6)

        game = ttk.LabelFrame(self, text="Game")
        game.pack(fill="x", **pad)
        ttk.Label(game, text="Version").grid(row=0, column=0, sticky="w", padx=8, pady=4)
        self.version = tk.StringVar(value=self.cfg["version"])
        self.version_box = ttk.Combobox(game, textvariable=self.version, values=[self.cfg["version"]], width=14)
        self.version_box.grid(row=0, column=1, sticky="w")
        self.use_fabric = tk.BooleanVar(value=self.cfg["use_fabric"])
        ttk.Checkbutton(game, text="Fabric + PineappleClient mod", variable=self.use_fabric).grid(row=0, column=2, sticky="w", padx=12)
        ttk.Label(game, text="RAM").grid(row=1, column=0, sticky="w", padx=8, pady=4)
        self.ram = tk.IntVar(value=self.cfg["ram_gb"])
        self.ram_label = ttk.Label(game, text=f"{self.ram.get()} GB", width=6)
        ttk.Scale(game, from_=2, to=16, variable=self.ram, length=200,
                  command=lambda v: self._snap_ram(v)).grid(row=1, column=1, columnspan=2, sticky="w")
        self.ram_label.grid(row=1, column=3, sticky="w")
        row = ttk.Frame(game)
        row.grid(row=2, column=0, columnspan=4, sticky="w", padx=8, pady=4)
        ttk.Button(row, text="Add mod jar…", command=self._add_mod).pack(side="left")
        ttk.Button(row, text="Open game folder", command=self._open_folder).pack(side="left", padx=6)

        self.play_btn = ttk.Button(self, text="PLAY", style="Play.TButton", command=self._play)
        self.play_btn.pack(fill="x", padx=12, pady=(8, 4))
        self.status = ttk.Label(self, text="Ready", style="Sub.TLabel")
        self.status.pack(anchor="w", padx=12)
        self.progress = ttk.Progressbar(self, mode="determinate")
        self.progress.pack(fill="x", padx=12, pady=4)

        self.log_box = tk.Text(self, height=8, bg="#0d0f14", fg="#b8bcc6", insertbackground="#b8bcc6",
                               relief="flat", font=("Consolas", 9), state="disabled")
        self.log_box.pack(fill="both", expand=True, padx=12, pady=(4, 12))

    def _snap_ram(self, v):
        val = int(round(float(v)))
        self.ram.set(val)
        self.ram_label.config(text=f"{val} GB")

    def _refresh_account(self):
        ms = self.account_type.get() == "microsoft"
        self.username_entry.config(state="disabled" if ms else "normal")
        for w in (self.client_id_entry, self.login_btn, self.logout_btn):
            w.config(state="normal" if ms else "disabled")
        if ms:
            name = self.cfg.get("ms_name")
            self.ms_status.config(text=f"Signed in as {name}" if self.cfg.get("ms_refresh_token") else "Not signed in")
        else:
            self.ms_status.config(text="")

    def _collect(self):
        self.cfg.update({
            "username": self.username.get().strip() or "Player",
            "version": self.version.get().strip() or DEFAULT_MC_VERSION,
            "use_fabric": bool(self.use_fabric.get()),
            "ram_gb": int(self.ram.get()),
            "account_type": self.account_type.get(),
            "ms_client_id": self.client_id.get().strip(),
        })
        save_config(self.cfg)

    def _load_versions(self):
        try:
            releases = [v["id"] for v in mll.utils.get_version_list() if v["type"] == "release"]
            self.events.put(("versions", releases))
        except Exception as e:
            self.events.put(("log", f"Could not fetch version list: {e}"))

    def _add_mod(self):
        paths = filedialog.askopenfilenames(title="Choose mod jars", filetypes=[("Mod jars", "*.jar")])
        if paths:
            mods = set(self.cfg.get("extra_mods", []))
            mods.update(paths)
            self.cfg["extra_mods"] = sorted(mods)
            save_config(self.cfg)
            self._log(f"Added {len(paths)} mod(s); they install on next launch")

    def _open_folder(self):
        GAME_DIR.mkdir(parents=True, exist_ok=True)
        if platform.system() == "Windows":
            os.startfile(GAME_DIR)
        elif platform.system() == "Darwin":
            subprocess.Popen(["open", str(GAME_DIR)])
        else:
            subprocess.Popen(["xdg-open", str(GAME_DIR)])

    def _login(self):
        self._collect()
        if not self.cfg["ms_client_id"]:
            messagebox.showinfo(APP_NAME, "Enter your Azure app client ID first (see README).")
            return
        self._run_bg(self._login_worker)

    def _login_worker(self):
        self._set_status("Waiting for Microsoft sign-in in your browser…")
        data = microsoft_login(self.cfg["ms_client_id"])
        self.cfg["ms_refresh_token"] = data["refresh_token"]
        self.cfg["ms_name"] = data["name"]
        save_config(self.cfg)
        self.events.put(("account", None))
        self._set_status(f"Signed in as {data['name']}")

    def _logout(self):
        self.cfg["ms_refresh_token"] = ""
        self.cfg["ms_name"] = ""
        save_config(self.cfg)
        self._refresh_account()

    def _play(self):
        if self.game and self.game.poll() is None:
            messagebox.showinfo(APP_NAME, "The game is already running.")
            return
        self._collect()
        self._run_bg(self._play_worker)

    def _auth(self):
        if self.cfg["account_type"] == "microsoft":
            if not self.cfg.get("ms_refresh_token"):
                raise RuntimeError("Sign in with Microsoft first, or switch to Offline.")
            self._set_status("Refreshing Microsoft login…")
            data = mll.microsoft_account.complete_refresh(self.cfg["ms_client_id"], None, REDIRECT_URI,
                                                          self.cfg["ms_refresh_token"])
            self.cfg["ms_refresh_token"] = data["refresh_token"]
            self.cfg["ms_name"] = data["name"]
            save_config(self.cfg)
            return data["name"], data["id"], data["access_token"]
        name = self.cfg["username"]
        return name, offline_uuid(name), "0"

    def _play_worker(self):
        mc_version = self.cfg["version"]
        GAME_DIR.mkdir(parents=True, exist_ok=True)
        callback = {
            "setStatus": self._set_status,
            "setProgress": lambda v: self.events.put(("progress", v)),
            "setMax": lambda v: self.events.put(("max", v)),
        }

        name, player_uuid, token = self._auth()

        if self.cfg["use_fabric"]:
            fabric = mll.mod_loader.get_mod_loader("fabric")
            if not fabric.is_minecraft_version_supported(mc_version):
                raise RuntimeError(f"Fabric does not support {mc_version}")
            loader = fabric.get_latest_loader_version(mc_version)
            launch_version = fabric.get_installed_version(mc_version, loader)
            self._log(f"Installing Minecraft {mc_version} + Fabric loader {loader}")
            fabric.install(mc_version, GAME_DIR, loader_version=loader, callback=callback)
            mods_dir = GAME_DIR / "mods"
            mods_dir.mkdir(exist_ok=True)
            self._set_status("Checking mods…")
            ensure_fabric_api(mc_version, mods_dir, self._log)
            sync_mods(self.cfg, mods_dir, self._log)
            if mc_version != DEFAULT_MC_VERSION:
                self._log(f"Note: the PineappleClient mod is built for {DEFAULT_MC_VERSION}; other versions may crash.")
        else:
            launch_version = mc_version
            self._log(f"Installing Minecraft {mc_version}")
            mll.install.install_minecraft_version(mc_version, GAME_DIR, callback=callback)

        ram = self.cfg["ram_gb"]
        options = {
            "username": name,
            "uuid": player_uuid,
            "token": token,
            "jvmArguments": [f"-Xmx{ram}G", f"-Xms{min(ram, 2)}G", "-XX:+UseG1GC"],
            "launcherName": APP_NAME,
            "launcherVersion": APP_VERSION,
            "gameDirectory": str(GAME_DIR),
        }
        cmd = mll.command.get_minecraft_command(launch_version, GAME_DIR, options)
        self._set_status(f"Launching {launch_version} as {name}")
        kwargs = {}
        if platform.system() == "Windows":
            kwargs["creationflags"] = 0x08000000
        self.game = subprocess.Popen(cmd, cwd=GAME_DIR, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                                     text=True, errors="replace", **kwargs)
        self.events.put(("running", True))
        for line in self.game.stdout:
            self._log(line.rstrip())
        code = self.game.wait()
        self._set_status(f"Game closed (exit code {code})")

    def _run_bg(self, fn):
        if self.busy:
            return
        self.busy = True
        self.play_btn.config(state="disabled")

        def wrapper():
            try:
                fn()
            except Exception as e:
                self._log(f"ERROR: {e}")
                self._set_status(f"Error: {e}")
            finally:
                self.events.put(("done", None))

        threading.Thread(target=wrapper, daemon=True).start()

    def _set_status(self, text):
        self.events.put(("status", text))

    def _log(self, text):
        self.events.put(("log", text))

    def _pump(self):
        try:
            while True:
                kind, value = self.events.get_nowait()
                if kind == "status":
                    self.status.config(text=value)
                elif kind == "progress":
                    self.progress["value"] = value
                elif kind == "max":
                    self.progress["maximum"] = max(int(value), 1)
                elif kind == "log":
                    self.log_box.config(state="normal")
                    self.log_box.insert("end", value + "\n")
                    if int(self.log_box.index("end-1c").split(".")[0]) > 2000:
                        self.log_box.delete("1.0", "500.0")
                    self.log_box.see("end")
                    self.log_box.config(state="disabled")
                elif kind == "versions":
                    self.version_box.config(values=value)
                elif kind == "account":
                    self._refresh_account()
                elif kind == "running":
                    self.progress["value"] = self.progress["maximum"]
                elif kind == "done":
                    self.busy = False
                    self.play_btn.config(state="normal")
        except queue.Empty:
            pass
        self.after(50, self._pump)


if __name__ == "__main__":
    if sys.version_info < (3, 10):
        print("PineappleClient launcher needs Python 3.10 or newer")
        sys.exit(1)
    Launcher().mainloop()
