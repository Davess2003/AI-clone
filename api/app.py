from flask import Flask, request, jsonify
import base64
import requests

app = Flask(__name__)

# === CONFIGURATION ===
APPS_SCRIPT_BASE_URL = "https://script.google.com/macros/s/AKfycbwTuP4Ju2bgBMOid32sZY2dWpip3qPAjzTN9sOWRoYlx3k4MuAq1FUiSVlkSfZzQydf/exec"

# === ROUTES ===
@app.route("/", methods=["GET"])
def form_page():
    building = request.args.get("form", "Circle")  # Default to "Liv" if not provided

    return f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Guest Check-In Form</title>
      <style>
        body {{ font-family: Arial, sans-serif; background: #f3f4f6; padding: 2rem; }}
        form {{ background: white; padding: 2rem; border-radius: 12px; max-width: 420px; margin: auto; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }}
        input, button {{ display: block; width: 100%; margin-bottom: 1rem; padding: 0.6rem; font-size: 1rem; border: 1px solid #ccc; border-radius: 6px; }}
        button {{ background: #2563eb; color: white; border: none; border-radius: 8px; cursor: pointer; transition: background 0.2s; }}
        button:hover {{ background: #1e3a8a; }}
        small {{ color: #666; display: block; margin-top: -0.5rem; margin-bottom: 1rem; }}
      </style>
    </head>
    <body>
      <h2 style="text-align:center;">Guest Check-In Form</h2>
      <form id="checkin-form" enctype="multipart/form-data">
        <input type="text" name="fullname" placeholder="Full Name" required />
        <input type="email" name="email" placeholder="Email Address" required />
        <input type="text" name="passportId" placeholder="Passport ID" required />
        <input type="number" name="numGuests" placeholder="Number of Guests" required min="1" />

        <label>PID <span style="font-weight:normal;">(3 digits, e.g. 001, 012)</span></label>
        <input type="text" name="pid" placeholder="PID (e.g. 001)" required pattern="\\d{{3}}" maxlength="3" inputmode="numeric" title="Enter exactly 3 digits, e.g. 001" />
        <small>Maps to the first 3 digits of the Hospitable property number.</small>

        <label>Check-In Date</label>
        <input type="date" name="checkinDate" required />

        <label>Checkout Date <span style="font-weight:normal;">(only if your stay is over 30 days)</span></label>
        <input type="date" name="checkoutDate" placeholder="Checkout Date" />
        <small>Only required for stays longer than one month.</small>

        <label>Upload Passport Image</label>
        <input type="file" name="image" accept="image/*" required />

        <button type="submit">Submit</button>
      </form>

      <p id="message" style="text-align:center; margin-top:1rem; font-weight:bold;"></p>

      <script>
        const form = document.getElementById("checkin-form");
        const msg = document.getElementById("message");
        const building = "{building}";

        form.addEventListener("submit", async (e) => {{
          e.preventDefault();
          msg.textContent = "Submitting...";

          const formData = new FormData(form);
          const payload = {{}};
          formData.forEach((v, k) => payload[k] = v);

          // Handle image upload
          const imageFile = formData.get("image");
          if (imageFile) {{
            const reader = new FileReader();
            reader.onload = async () => {{
              payload.image = reader.result;

              const res = await fetch("/submit?form=" + building, {{
                method: "POST",
                headers: {{ "Content-Type": "application/json" }},
                body: JSON.stringify(payload)
              }});
              const data = await res.json();
              msg.textContent = data.message;
            }};
            reader.readAsDataURL(imageFile);
          }} else {{
            const res = await fetch("/submit?form=" + building, {{
              method: "POST",
              headers: {{ "Content-Type": "application/json" }},
              body: JSON.stringify(payload)
            }});
            const data = await res.json();
            msg.textContent = data.message;
          }}
        }});
      </script>
    </body>
    </html>
    """

@app.route("/submit", methods=["POST"])
def submit_form():
    try:
        building = request.args.get("form", "Liv")  # Read form/building from URL
        data = request.get_json()

        fullname = data.get("fullname")
        email = data.get("email")
        passport_id = data.get("passportId")
        pid = data.get("pid")
        num_guests = data.get("numGuests")
        checkin_date = data.get("checkinDate")
        checkout_date = data.get("checkoutDate") or ""
        image_data_url = data.get("image")

        payload = {
            "fullname": fullname,
            "email": email,
            "passportId": passport_id,
            "pid": pid,
            "numGuests": num_guests,
            "checkinDate": checkin_date,
            "checkoutDate": checkout_date,
            "image": image_data_url
        }

        form_url = f"{APPS_SCRIPT_BASE_URL}?form={building}"

        response = requests.post(form_url, json=payload)
        data = response.json()

        return jsonify({"message": data.get("message", "Submitted successfully!")})

    except Exception as e:
        return jsonify({"message": f"Error submitting form: {str(e)}"})

# === RUN APP ===
if __name__ == "__main__":
    app.run(debug=True, port=5000)