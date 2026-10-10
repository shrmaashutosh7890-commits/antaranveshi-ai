
import json
from http.server import BaseHTTPRequestHandler
from ai_engine import generate_reply


class handler(BaseHTTPRequestHandler):
    def do_POST(self):
        try:
            length = int(self.headers.get("Content-Length", 0))
            body = self.rfile.read(length)
            data = json.loads(body.decode("utf-8"))

            question = data.get("message") or data.get("question")

            if not question:
                self.send_json(400, {"error": "Please enter a message."})
                return

            answer = generate_reply(question)
            self.send_json(200, {"reply": answer})

        except Exception as error:
            print("Chat API error:", error)
            self.send_json(500, {"error": "Something went wrong. Please try again."})

    def do_GET(self):
        self.send_json(200, {"status": "Antaranveshi AI API is running"})

    def send_json(self, status, payload):
        response = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "*")
        self.end_headers()
        self.wfile.write(response)
