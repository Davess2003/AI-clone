from flask import Flask, request, jsonify, render_template
import undetected_chromedriver as uc
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
import time
import random
import threading

app = Flask(__name__)

# --- Setup Chrome ---
options = uc.ChromeOptions()
options.add_argument("--headless=new")
options.add_argument("--disable-gpu")
options.add_argument("--window-size=1920,1080")
options.add_argument("--no-sandbox")
options.add_argument("--disable-dev-shm-usage")

# Create a lock to avoid concurrent Selenium commands
driver_lock = threading.Lock()

driver = uc.Chrome(options=options, version_main=140)
driver.get("https://www.easemate.ai/webapp/chat")
time.sleep(20)  # wait for chat to load

def human_typing(element, text):
    """Type text like a human"""
    for _ in range(3):
        element.send_keys(Keys.BACKSPACE)
        time.sleep(random.uniform(0.2, 0.4))
    for char in text:
        element.send_keys(char)
        time.sleep(random.uniform(0.2, 0.5))

def get_latest_ai_response():
    """Get the last AI message from the chat"""
    ai_messages = driver.find_elements(
        By.CSS_SELECTOR,
        "div.chat-message-row.ai div.md-editor-preview.default-theme.md-editor-scrn"
    )
    if ai_messages:
        return ai_messages[-1].text.strip()
    return "No response yet."

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/ask', methods=['POST'])
def ask():
    data = request.json
    message = data.get("message")
    if not message:
        return jsonify({"error": "No message provided"}), 400

    with driver_lock:  # ensure only one request uses Selenium at a time
        try:
            # Focus the textarea
            textarea = driver.find_element(By.CSS_SELECTOR, "textarea.ant-input")
            human_typing(textarea, message)
            textarea.send_keys(Keys.ENTER)
            time.sleep(10)  # wait for AI to respond
            driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
            time.sleep(2)
            response = get_latest_ai_response()
        except Exception as e:
            return jsonify({"error": str(e)}), 500

    return jsonify({"response": response})

if __name__ == "__main__":
    try:
        app.run(debug=True, threaded=True)
    finally:
        driver.quit()
