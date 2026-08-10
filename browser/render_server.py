"""Mini servidor HTTP de renderizado con Playwright/Chromium.

POST /render  {"url": "...", "wait_ms": 3500, "selector": "opcional"}
  -> {"ok": true, "html": "<dom renderizado>", "title": "..."}
  -> {"ok": false, "error": "..."}
"""
import json
from http.server import BaseHTTPRequestHandler, HTTPServer
from playwright.sync_api import sync_playwright

UA = ("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
      "(KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36")

_pw = sync_playwright().start()
_browser = _pw.chromium.launch(
    headless=True,
    args=[
        "--no-sandbox", "--disable-dev-shm-usage",
        "--disable-blink-features=AutomationControlled",
        "--disable-gpu",
    ],
)


class Handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            n = int(self.headers.get("Content-Length", 0) or 0)
            body = json.loads(self.rfile.read(n) or b"{}")
            url = body.get("url", "")
            wait_ms = int(body.get("wait_ms", 3500))
            selector = body.get("selector")

            if not url:
                resp = {"ok": False, "error": "url required"}
            else:
                ctx = _browser.new_context(
                    user_agent=UA, locale="es-MX",
                    viewport={"width": 1280, "height": 800},
                    timezone_id="America/Mexico_City",
                    extra_http_headers={"Accept-Language": "es-MX,es;q=0.9"},
                )
                page = ctx.new_page()
                try:
                    page.goto(url, wait_until="domcontentloaded", timeout=30000)
                    if selector:
                        try:
                            page.wait_for_selector(selector, timeout=wait_ms + 2000)
                        except Exception:
                            pass
                    else:
                        page.wait_for_timeout(wait_ms)
                    # Scroll al final para disparar loading="lazy" de imágenes
                    try:
                        page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
                        page.wait_for_timeout(1200)
                    except Exception:
                        pass
                    html = page.content()
                    title = page.title()
                    resp = {"ok": True, "html": html, "title": title}
                except Exception as e:
                    resp = {"ok": False, "error": str(e)}
                finally:
                    try:
                        ctx.close()
                    except Exception:
                        pass
        except Exception as e:
            resp = {"ok": False, "error": str(e)}

        data = json.dumps(resp).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def log_message(self, *args):
        pass


if __name__ == "__main__":
    print("BROWSER 2.0 render server on :8580")
    HTTPServer(("0.0.0.0", 8580), Handler).serve_forever()