
from http.server import HTTPServer, SimpleHTTPRequestHandler
import json
from ai_engine import generate_reply


class AntaranveshiHandler(SimpleHTTPRequestHandler):

    def do_POST(self):
        if self.path != "/chat":
            self.send_error(404, "Not found")
            return

        try:
            length = int(self.headers.get("Content-Length", 0))
            data = self.rfile.read(length)
            body = json.loads(data.decode("utf-8"))

            question = body.get("message", "").strip()

            if not question:
                self.send_json({"reply": "Bhai, pehle apna sawal likh."})
                return

            answer = generate_reply(question)
            self.send_json({"reply": answer})

        except Exception as error:
            print("Chat error:", error)
            self.send_json({
                "reply": "Kuch dikkat aa gayi. PowerShell mein error check karo."
            })

    def send_json(self, data):
        encoded = json.dumps(data, ensure_ascii=False).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.send_header("Content-Length", str(len(encoded)))
        self.end_headers()
        self.wfile.write(encoded)

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")
        self.end_headers()


if __name__ == "__main__":
    server = HTTPServer(("127.0.0.1", 8000), AntaranveshiHandler)
    print("Antaranveshi AI backend is running!")
    print("Website: http://127.0.0.1:8000")
    print("Press Ctrl+C to stop.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nServer stopped.")
    finally:
        server.server_close()
