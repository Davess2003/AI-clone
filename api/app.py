from flask import Flask, request, jsonify
import base64
import re
import requests

app = Flask(__name__)

# === CONFIGURATION ===
APPS_SCRIPT_BASE_URL = "https://script.google.com/macros/s/AKfycbywiUdyRJIOlrX-bmVSxj4JolCFiG1YRhZ1XWnko806nJo9hAkMAeT4iXOrVQmMBNZ5ww/exec"

def lookup_reservation(code):
    """Ask the Apps Script deployment to resolve a Hospitable reservation code.

    Returns (prefill_dict, note). A failed lookup returns an empty dict and a
    human-readable note rather than raising: the form must still render so the
    guest can fill it in by hand.
    """
    code = (code or "").strip()
    if not code:
        return {}, ""

    try:
        res = requests.get(APPS_SCRIPT_BASE_URL, params={"code": code}, timeout=30)
        data = res.json()
    except (requests.exceptions.RequestException, ValueError) as e:
        return {}, f"Could not look up reservation {code} ({e}). Please fill the form in manually."

    if data.get("error"):
        return {}, f"Reservation {code}: {data['error']}. Please fill the form in manually."

    return data, ""


# === ROUTES ===
@app.route("/", methods=["GET"])
def form_page():
    building = request.args.get("form", "Coproperty")  # Default to "Liv" if not provided

    # ?code=<Hospitable reservation code> prefills the dates and PID from the
    # booking. The lookup is done by the Apps Script deployment rather than here,
    # so the Hospitable token only ever lives in one place.
    prefill, prefill_note = lookup_reservation(request.args.get("code"))

    # A PID from the reservation is authoritative, so it locks the field the same
    # way a numeric ?form= does — and takes precedence over it.
    pid_match = re.match(r"\s*(\d{1,3})", building)
    if prefill.get("pid"):
        locked_pid = prefill["pid"]
        pid_field = (
            f'<input type="text" name="pid" value="{locked_pid}" readonly '
            f'pattern="\\d{{3}}" maxlength="3" inputmode="numeric" '
            f'title="Locked to this reservation" />'
        )
        pid_hint = "Generated code from reservation (DO NOT change)"
    elif pid_match:
        locked_pid = pid_match.group(1).zfill(3)
        pid_field = (
            f'<input type="text" name="pid" value="{locked_pid}" readonly '
            f'pattern="\\d{{3}}" maxlength="3" inputmode="numeric" '
            f'title="Locked to this property" />'
        )
        pid_hint = f"Locked to property {locked_pid} (set by the link)."
    else:
        pid_field = (
            '<input type="text" name="pid" placeholder="PID (e.g. 001)" required '
            'pattern="\\d{3}" maxlength="3" inputmode="numeric" '
            'title="Enter exactly 3 digits, e.g. 001" />'
        )
        pid_hint = "Maps to the first 3 digits of the Hospitable property number."

    # Dates come back as YYYY-MM-DD, which is exactly what <input type="date"> wants.
    checkin_value = prefill.get("checkinDate", "")
    checkout_value = prefill.get("checkoutDate", "")

    if prefill_note:
        banner = f'<div class="banner warn">⚠️ {prefill_note}</div>'
    elif prefill:
        banner = (
            f'<div class="banner ok">Prefilled from reservation '
            f'<strong>{prefill.get("code", "")}</strong> — {prefill.get("propertyName", "")}</div>'
        )
    else:
        banner = ""

    return f"""
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>Guest Check-In Form</title>
      <!-- Dancing Script is the font Code.gs writes the signature in, so the
           preview below matches what actually lands on the PDF. -->
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
      <link href="https://fonts.googleapis.com/css2?family=Dancing+Script:wght@400;600&display=swap" rel="stylesheet" />
      <style>
        body {{ font-family: Arial, sans-serif; background: #f3f4f6; padding: 2rem; }}
        form {{ background: white; padding: 2rem; border-radius: 12px; max-width: 420px; margin: auto; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }}
        input, button {{ display: block; width: 100%; margin-bottom: 1rem; padding: 0.6rem; font-size: 1rem; border: 1px solid #ccc; border-radius: 6px; }}
        button {{ background: #2563eb; color: white; border: none; border-radius: 8px; cursor: pointer; transition: background 0.2s; }}
        button:hover {{ background: #1e3a8a; }}
        small {{ color: #666; display: block; margin-top: -0.5rem; margin-bottom: 1rem; }}
        input[readonly] {{ background: #e9ecef; color: #555; cursor: not-allowed; }}
        .banner {{ max-width: 420px; margin: 0 auto 1rem; padding: 0.6rem 0.8rem; border-radius: 8px; font-size: 0.9rem; }}
        .banner.ok {{ background: #e7f2ff; color: #1e3a8a; }}
        .banner.warn {{ background: #fff4e5; color: #8a5300; }}
        .esign {{ border-top: 1px solid #e5e7eb; margin-top: 1.5rem; padding-top: 1.25rem; }}
        .esign p {{ color: #374151; font-size: 0.92rem; line-height: 1.45; margin: 0 0 0.75rem; }}
        .esign ul {{ color: #374151; font-size: 0.92rem; line-height: 1.5; margin: 0 0 1.25rem; padding-left: 1.25rem; }}
        .esign li {{ margin-bottom: 0.35rem; }}
        .esign-label {{ color: #6b7280; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.04em; }}
        /* cursive is the fallback if Google Fonts is blocked, so the preview
           still reads as a signature rather than as body text. */
        .esign-preview {{
          font-family: "Dancing Script", cursive;
          font-size: 2rem; line-height: 1.4; color: #111827; min-height: 2.8rem;
          border-bottom: 1px solid #9ca3af; margin: 0.25rem 0 1rem; padding: 0 0.25rem 0.35rem;
          overflow-wrap: anywhere;
        }}
        .esign-preview.empty {{ color: #9ca3af; font-family: Arial, sans-serif; font-size: 0.9rem; }}
      </style>
    </head>
    <body>
      <h2 style="text-align:center;">Guest Check-In Form</h2>
      {banner}
      <form id="checkin-form" enctype="multipart/form-data">
        <input type="text" name="fullname" placeholder="Full Name" required />
        <input type="email" name="email" placeholder="Email Address" required />
        <input type="text" name="passportId" placeholder="Passport ID" required />
        <input type="number" name="numGuests" placeholder="Number of Guests" required min="1" />

        <label>PID <span style="font-weight:normal;">(3 digits, e.g. 001, 012)</span></label>
        {pid_field}
        <small>{pid_hint}</small>

        <label>Check-In Date</label>
        <input type="date" name="checkinDate" value="{checkin_value}" required />

        <label>Checkout Date</label>
        <input type="date" name="checkoutDate" value="{checkout_value}" />

        <label>Upload Passport Image</label>
        <input type="file" name="image" accept="image/*" required />

        <div class="esign">
          <p>Since we do not collect signatures, your name will be used as esignature
             of confirmation that you agree to building rules and airbnb rules of conduct.</p>
          <span class="esign-label">Your e-signature</span>
          <div id="esign-preview" class="esign-preview empty" aria-live="polite">Type your full name above</div>
        </div>

        <button type="submit">Submit</button>
      </form>

      <p id="message" style="text-align:center; margin-top:1rem; font-weight:bold;"></p>

      <script>
        const form = document.getElementById("checkin-form");
        const msg = document.getElementById("message");
        const building = "{building}";

        // Live e-signature preview. Uses textContent rather than innerHTML so a
        // name containing < or & renders literally instead of as markup.
        const nameInput = form.querySelector('input[name="fullname"]');
        const esign = document.getElementById("esign-preview");
        function renderSignature() {{
          const name = nameInput.value.trim();
          esign.textContent = name || "Type your full name above";
          esign.classList.toggle("empty", !name);
        }}
        nameInput.addEventListener("input", renderSignature);
        renderSignature();

        // Downscale + JPEG-compress an image file in the browser so the base64
        // payload stays well under Vercel's 4.5 MB serverless request limit.
        // A raw iPhone photo (~6 MB) base64-encodes to ~8 MB and gets rejected
        // with FUNCTION_PAYLOAD_TOO_LARGE (413); this keeps it under ~500 KB.
        function compressImage(file, maxEdge = 1600, quality = 0.8) {{
          return new Promise((resolve, reject) => {{
            const reader = new FileReader();
            reader.onerror = () => reject(new Error("Could not read the image file."));
            reader.onload = () => {{
              const img = new Image();
              img.onerror = () => reject(new Error("Could not load the image."));
              img.onload = () => {{
                let {{ width, height }} = img;
                if (width > height && width > maxEdge) {{
                  height = Math.round(height * (maxEdge / width));
                  width = maxEdge;
                }} else if (height >= width && height > maxEdge) {{
                  width = Math.round(width * (maxEdge / height));
                  height = maxEdge;
                }}
                const canvas = document.createElement("canvas");
                canvas.width = width;
                canvas.height = height;
                canvas.getContext("2d").drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL("image/jpeg", quality));
              }};
              img.src = reader.result;
            }};
            reader.readAsDataURL(file);
          }});
        }}

        form.addEventListener("submit", async (e) => {{
          e.preventDefault();
          msg.textContent = "Submitting...";

          const formData = new FormData(form);
          const payload = {{}};
          formData.forEach((v, k) => payload[k] = v);

          try {{
            // Handle image upload (compressed client-side before encoding)
            const imageFile = formData.get("image");
            if (imageFile && imageFile.size > 0) {{
              payload.image = await compressImage(imageFile);
            }}

            const res = await fetch("/submit?form=" + building, {{
              method: "POST",
              headers: {{ "Content-Type": "application/json" }},
              body: JSON.stringify(payload)
            }});
            const data = await res.json();
            msg.textContent = data.message;
          }} catch (err) {{
            msg.textContent = "Error preparing your submission: " + err.message;
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

        response = requests.post(form_url, json=payload, timeout=120)

        # Apps Script only returns JSON when the deployment is alive and reachable.
        # A deleted deployment returns a 404 HTML page and a permissions problem
        # returns a login page, both of which used to surface as the useless
        # "Expecting value: line 1 column 1 (char 0)". Name the real cause instead.
        try:
            data = response.json()
        except ValueError:
            if response.status_code == 404:
                detail = (
                    "the Apps Script deployment no longer exists (404). "
                    "It needs to be redeployed and APPS_SCRIPT_BASE_URL updated."
                )
            elif "accounts.google.com" in response.url or response.status_code in (401, 403):
                detail = (
                    "Apps Script returned a sign-in page. Set the web app's "
                    "'Who has access' to 'Anyone' and redeploy."
                )
            else:
                detail = (
                    f"Apps Script returned {response.status_code} instead of JSON "
                    f"({response.text[:200].strip()!r})"
                )
            return jsonify({"message": f"❌ Could not reach the document service: {detail}"}), 502

        return jsonify({"message": data.get("message", "Submitted successfully!")})

    except requests.exceptions.RequestException as e:
        return jsonify({"message": f"❌ Network error reaching Apps Script: {e}"}), 502
    except Exception as e:
        return jsonify({"message": f"Error submitting form: {str(e)}"})

# === RUN APP ===
if __name__ == "__main__":
    app.run(debug=True, port=5000)