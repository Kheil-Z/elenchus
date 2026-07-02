#!/usr/bin/env python3
"""Auth-checking reverse proxy for serving a local LLM to Elenchus.

Sits between a public tunnel and a local OpenAI-compatible model server
(MLX, Ollama, LM Studio, vLLM, ...). Rejects any request whose Authorization
header isn't exactly "Bearer $PROXY_TOKEN"; forwards everything else to the
upstream on 127.0.0.1. Stdlib only — no dependencies, Python 3.9+.

Full walkthrough: docs/self-hosted-llm.md in the Elenchus repository.

Usage:
    export PROXY_TOKEN=$(openssl rand -hex 32)
    echo "$PROXY_TOKEN"   # save this — it goes in the app's API key field
    python3 auth_proxy.py --listen-port 8090 --upstream-port 8080

Then tunnel the proxy's port (NOT the model server's port):
    cloudflared tunnel --url http://127.0.0.1:8090
"""

import argparse
import hmac
import os
import sys
import time
import urllib.error
import urllib.request
from datetime import datetime
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

TOKEN = os.environ.get("PROXY_TOKEN", "")

# Generous timeout: local models can take a while on long prompts
UPSTREAM_TIMEOUT_SECONDS = 600


def log(line: str) -> None:
    print(f"[{datetime.now().strftime('%H:%M:%S')}] {line}", flush=True)


class AuthProxyHandler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"
    upstream_port = 8080  # overridden from args at startup

    # ── plumbing ──────────────────────────────────────────────────────────────

    def log_message(self, *_args) -> None:
        pass  # we print our own, more useful lines

    def _send(self, status: int, body: bytes, content_type: str = "application/json") -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    # ── auth ──────────────────────────────────────────────────────────────────

    def _authorized(self) -> bool:
        supplied = self.headers.get("Authorization", "")
        # Constant-time comparison — no timing side channel on the token
        return hmac.compare_digest(supplied, f"Bearer {TOKEN}")

    # ── request handling ──────────────────────────────────────────────────────

    def _handle(self) -> None:
        if not self._authorized():
            self.close_connection = True
            try:
                self._send(403, b'{"error":"forbidden"}')
            except (BrokenPipeError, ConnectionResetError):
                pass
            log(f"DENIED  {self.command} {self.path}  from {self.client_address[0]}")
            return

        length = int(self.headers.get("Content-Length") or 0)
        body = self.rfile.read(length) if length else None

        url = f"http://127.0.0.1:{self.upstream_port}{self.path}"
        req = urllib.request.Request(url, data=body, method=self.command)
        # Forward only what the upstream needs; the Authorization header stops here
        if self.headers.get("Content-Type"):
            req.add_header("Content-Type", self.headers["Content-Type"])

        # Talk to the upstream first, send to the client after — the client may
        # hang up while a slow model generates, and that must not crash us.
        started = time.monotonic()
        try:
            with urllib.request.urlopen(req, timeout=UPSTREAM_TIMEOUT_SECONDS) as resp:
                data = resp.read()
                status = resp.status
                content_type = resp.headers.get("Content-Type", "application/json")
                note = ""
        except urllib.error.HTTPError as e:
            data = e.read()
            status = e.code
            content_type = e.headers.get("Content-Type", "application/json")
            note = " (upstream error passed through)"
        except Exception as e:
            data = f'{{"error":"upstream unreachable: {e}"}}'.encode()
            status = 502
            content_type = "application/json"
            note = f" ({e})"
        elapsed = time.monotonic() - started

        try:
            self._send(status, data, content_type)
            log(f"OK      {self.command} {self.path}  -> {status} ({len(data)} bytes, {elapsed:.1f}s){note}")
        except (BrokenPipeError, ConnectionResetError):
            self.close_connection = True
            log(f"CLIENT GONE  {self.command} {self.path}  — upstream answered {status} after {elapsed:.1f}s, "
                f"but the caller had already hung up (a timeout upstream of us: Vercel's function limit, "
                f"or Cloudflare's ~100s edge limit). Response discarded — nothing is broken; "
                f"make generation faster or raise the caller's timeout.")

    def do_GET(self) -> None:
        self._handle()

    def do_POST(self) -> None:
        self._handle()


class QuietServer(ThreadingHTTPServer):
    """Clients (the tunnel, on behalf of a timed-out caller) routinely vanish
    mid-connection while a slow model generates. That's not an error worth a
    traceback — real errors still print."""

    def handle_error(self, request, client_address) -> None:
        exc = sys.exc_info()[1]
        if isinstance(exc, (BrokenPipeError, ConnectionResetError, TimeoutError)):
            return
        super().handle_error(request, client_address)


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--listen-port", type=int, default=8090, help="port the tunnel points at (default 8090)")
    parser.add_argument("--upstream-port", type=int, default=8080, help="port the model server listens on (default 8080)")
    args = parser.parse_args()

    if len(TOKEN) < 32:
        sys.exit("Refusing to start: set PROXY_TOKEN to a long random value first, e.g.\n"
                 "  export PROXY_TOKEN=$(openssl rand -hex 32)")

    AuthProxyHandler.upstream_port = args.upstream_port
    # 127.0.0.1 binding: the proxy itself is never reachable from the network — only the tunnel reaches it
    server = QuietServer(("127.0.0.1", args.listen_port), AuthProxyHandler)
    log(f"auth proxy on http://127.0.0.1:{args.listen_port} -> upstream http://127.0.0.1:{args.upstream_port}")
    log("requests without the exact Bearer token are rejected with 403")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        log("shutting down")


if __name__ == "__main__":
    main()
