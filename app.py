from flask import Flask, request, jsonify, render_template
import os
import requests

app = Flask(__name__, template_folder="templates", static_folder="static")

# Frontend talks to your local worker through ngrok
WORKER_URL = os.getenv("WORKER_URL")       # e.g. https://e1f08c8c5ba9.ngrok-free.app/ask
SHARED_SECRET = os.getenv("SHARED_SECRET") # e.g. supersecret123abc456

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/ask', methods=['POST'])
def ask():
    data = request.get_json()
    message = data.get("message")

    if not message:
        return jsonify({"error": "No message provided"}), 400

    # Forward the message to the local worker
    try:
        headers = {"Authorization": f"Bearer {SHARED_SECRET}"}
        payload = {"question": message}  # note: your worker expects "question"
        res = requests.post(WORKER_URL, json=payload, headers=headers, timeout=60)
        res.raise_for_status()  # raise exception if status != 200
        return jsonify(res.json())
    except requests.exceptions.RequestException as e:
        return jsonify({"error": f"Failed to reach worker: {str(e)}"}), 500

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.getenv("PORT", 5000)))
