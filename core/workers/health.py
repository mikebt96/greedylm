import http.server
import socketserver
import threading
import os

PORT = int(os.environ.get("PORT", 10000))

class HealthCheckHandler(http.server.SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/health':
            self.send_response(200)
            self.send_header('Content-type', 'application/json')
            self.end_headers()
            self.wfile.write(b'{"status": "healthy"}')
        else:
            self.send_response(404)
            self.end_headers()

def run_health_check():
    handler = HealthCheckHandler
    with socketserver.TCPServer(("", PORT), handler) as httpd:
        print(f"Health check server listening on port {PORT}")
        httpd.serve_forever()

if __name__ == "__main__":
    run_health_check()
