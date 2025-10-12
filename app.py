from flask import Flask, request, jsonify, render_template
import undetected_chromedriver as uc
from selenium.webdriver.common.by import By
from selenium.webdriver.common.keys import Keys
import time
import random
import contextlib

app = Flask(__name__)

# --- Setup Chrome ---
options = uc.ChromeOptions()
options.add_argument("--headless=new")
options.add_argument("--disable-gpu")
options.add_argument("--window-size=1920,1080")
options.add_argument("--no-sandbox")
options.add_argument("--disable-dev-shm-usage")

driver = uc.Chrome(options=options, version_main=140)
driver.get("https://www.easemate.ai/webapp/chat")
time.sleep(20)  # wait for chat to load

def human_typing(element, text):
    for _ in range(3):
        element.send_keys(Keys.BACKSPACE)
        time.sleep(random.uniform(0.2, 0.4))
    for char in text:
        element.send_keys(char)
        time.sleep(random.uniform(0.2, 0.5))

def get_latest_ai_response():
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

    textarea = driver.find_element(By.CSS_SELECTOR, "textarea.ant-input")
    textarea.clear()
    human_typing(textarea, message)
    textarea.send_keys(Keys.ENTER)
    time.sleep(10)
    driver.execute_script("window.scrollTo(0, document.body.scrollHeight);")
    time.sleep(3)
    response = get_latest_ai_response()
    return jsonify({"response": response})

if __name__ == "__main__":
    try:
        app.run(debug=True)
    finally:
        with contextlib.suppress(Exception):
            driver.quit()
        del driver
