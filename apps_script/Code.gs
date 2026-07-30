function doPost(e) {
  try {
    const formType = e.parameter.form || "Form";

    // === SINGLEE SHARED TEMPLATE FOR ALL FORMS ===
    const templateId = "1QDzhQncskMkAkcIJq_tOraW2EU5HOP6zgOrr11YUhKs";

    // Extra juristic-office forms, generated only for specific properties.
    // Doc ID = the long string in the doc URL: docs.google.com/document/d/<THIS>/edit
    //
    // Keys are the 3-digit PID as a QUOTED STRING. The quotes matter: a bare 061
    // is an octal literal in JS and would silently become 49, so the form would
    // never generate. Always "061", never 061.
    const PID_ONLY_TEMPLATES = {
      // 061 and 170 are different buildings that both read as "Circle" —
      // Circle Condominium here, The Circle Living Prototype below. Don't merge them.
      "061": [ // Circle Condominium
        { templateId: "1aZp5ogm0Xf8s4nrxH35fRHG_Zpw89Lo1ic2l3ciBv8g", docName: "Residential Register" }
      ],
      "170": [ // Fragrant / The Circle Living Prototype
        // House rules acknowledgement. {SIGNATURE} sits on the
        // "(ผู้เช่า/บริวาร) (Tenant / Occupant(s))" line; the other signature line
        // is the co-owner's and is left blank for hand-signing.
        { templateId: "1tiQ2JcKhb2Vpn1b7YUFAT6FU8X70ig-CgII3fIDsYto", docName: "House Rules Acknowledgement" },

        // Register form. The scanned form is an image with {NAME} {SURNAME}
        // {SIGNATURE} typed over it as body text, so only those three fill —
        // every other box is blank for hand-completion. NOT the earlier .docx
        // upload (1KFcD4cMMsYtETfJhySA4aHzeI96DDsli): its tags were in Word text
        // boxes, which convert to Docs drawings and are invisible to getBody().
        // templates/residential-status-170.md lists the tags a full retype could use.
        { templateId: "1IheOxItkQ7kdD3cTPLPNXgtMn-CPrW-S3xz6d_IXr8E", docName: "Register Form" }
      ],
      "121": [ // Noble BE 33, unit 19/244 (24A4)
        // Power of attorney from the owner (MR. QIAN, LEI) letting the guest
        // register their face scan as tenant. Owner name, passport and unit are
        // typed into the template, so this entry is valid for that one unit only.
        // includeImage attaches the passport photo, which the juristic office
        // needs alongside the POA — the only extra form that gets it.
        { templateId: "17HAlzOC7YWEqCD8m5OWSTAJymnetwn1IbMFyd7jpXNA", docName: "Power of Attorney", includeImage: true }
      ]
    };

    // Font used for the {SIGNATURE} placeholder. Must be a font that exists in
    // Google Docs' font list (Dancing Script / Great Vibes / Sacramento / Caveat).
    const SIGNATURE_FONT = "Dancing Script";

    // POA folder link — always included in the email body alongside the rental contract
    const POA_FOLDER_URL = "https://drive.google.com/drive/folders/1BtckiJL60BquXN0sadkoh6tztT3NI-YX";

    const data = JSON.parse(e.postData.contents);
    const fullname = data.fullname;
    const email = data.email;
    const passportId = data.passportId;
    const pid = (data.pid || "").toString().padStart(3, "0"); // 3-digit Hospitable property prefix
    const numGuests = data.numGuests || "1";

    // === LOOK UP THE PROPERTY ADDRESS FROM HOSPITABLE VIA PID ===
    let fullAddress = "";
    let matchedPropertyName = "";
    try {
      const lookup = getPropertyAddressByPID(pid);
      if (lookup) {
        fullAddress = lookup.address;
        matchedPropertyName = lookup.name + (lookup.multiple ? "  (⚠️ multiple PID matches — using first)" : "");
      } else {
        fullAddress = "⚠️ No Hospitable property found for PID " + pid;
      }
    } catch (lookupErr) {
      fullAddress = "⚠️ Address lookup failed: " + lookupErr.message;
    }
    const checkinDateStr = data.checkinDate;
    let checkoutDateStr = data.checkoutDate || "";
    const imageDataUrl = data.image;

    const checkinDate = new Date(checkinDateStr);
    const checkinFormatted = formatDate(checkinDate);

    let checkoutDate;
    const minimumCheckout = new Date(checkinDate);
    minimumCheckout.setMonth(minimumCheckout.getMonth() + 1);

    if (!checkoutDateStr || checkoutDateStr.trim() === "") {
      checkoutDate = minimumCheckout;
    } else {
      const inputCheckout = new Date(checkoutDateStr);
      checkoutDate = inputCheckout < minimumCheckout ? minimumCheckout : inputCheckout;
    }

    const checkoutFormatted = formatDate(checkoutDate);

    // Every field covers both the spaced and the underscore naming style so it
    // works regardless of how the placeholder is written in the doc.
    const fields = {
      "FULLNAME": fullname,
      "GUEST_FULL_NAME": fullname,
      "FULL NAME": fullname,
      "EMAIL": email,
      "PASSPORT ID": passportId,
      "PASSPORT_ID": passportId,
      "PID": pid,
      "FULL_ADDRESS": fullAddress,
      "FULL ADDRESS": fullAddress,
      "NUMBER OF GUESTS": numGuests,
      "NUMBER_OF_GUESTS": numGuests,
      "CHECKIN DATE": checkinFormatted,
      "CHECKIN_DATE": checkinFormatted,
      "CHECKOUT DATE": checkoutFormatted,
      "CHECKOUT_DATE": checkoutFormatted
    };

    // Building forms tend to have separate Name / Surname boxes, so offer both the
    // split parts and the full name — each template uses whichever it contains.
    // Kept out of the shared `fields` map so the rental contract's behaviour is
    // untouched: a bare {TOTAL} there would more likely mean a rent amount than a
    // headcount, and {NAME} could read as "name of the agreement".
    const nameParts = splitName(fullname);
    const pidFields = Object.assign({}, fields, {
      "NAME": nameParts.first,
      "SURNAME": nameParts.last,
      "FIRST_NAME": nameParts.first,
      "LAST_NAME": nameParts.last,
      "TOTAL": numGuests
    });

    const attachments = [
      buildDocFromTemplate(templateId, `CheckIn - ${formType} - ${fullname}`, {
        fields: fields,
        imageDataUrl: imageDataUrl,
        signatureName: fullname,
        signatureFont: SIGNATURE_FONT
      })
    ];

    // === PID-SPECIFIC EXTRA FORMS ===
    // Only built when the submitted PID matches. Everything else is untouched.
    const extraFormNames = [];
    const extraFormErrors = [];
    // `pid` is already zero-padded to 3 digits above, so it matches the keys directly.
    const pidRules = PID_ONLY_TEMPLATES[pid] || [];

    if (pidRules.length) {
      pidRules.forEach(function (rule) {
        if (!rule.templateId || rule.templateId.indexOf("PASTE_") === 0) return; // not configured yet

        // Each extra form is isolated: a bad template ID, a .docx that
        // DocumentApp can't open, or a sharing problem must not throw away the
        // whole submission — the guest's rental contract still has to go out.
        try {
          attachments.push(
            buildDocFromTemplate(rule.templateId, `${rule.docName} - ${fullname}`, {
              fields: pidFields,
              // Opt-in per form: most juristic forms want the details only, but a
              // POA has to travel with the passport copy it authorises against.
              imageDataUrl: rule.includeImage ? imageDataUrl : undefined,
              signatureName: fullname,
              signatureFont: SIGNATURE_FONT
            })
          );
          extraFormNames.push(rule.docName);
        } catch (formErr) {
          Logger.log("Extra form failed (" + rule.docName + "): " + formErr.stack);
          extraFormErrors.push(rule.docName + " — " + formErr.message);
        }
      });
    }

    let emailBody = `Dear ${fullname},

Your check-in record for ${formType} has been received successfully.

PID: ${pid}
Property: ${matchedPropertyName || "—"}
Address: ${fullAddress}
Number of Guests: ${numGuests}
`;

    if (extraFormNames.length) {
      emailBody += `
Also attached for this building, to go to the juristic office:
${extraFormNames.map(function (n) { return "  - " + n; }).join("\n")}
`;
    }

    // Surfaced in the email so a silently missing juristic form gets noticed
    // rather than being discovered at the office.
    if (extraFormErrors.length) {
      emailBody += `
⚠️ These building forms could NOT be generated and must be done manually:
${extraFormErrors.map(function (n) { return "  - " + n; }).join("\n")}
`;
    }

    emailBody += `

Here is the POA to send to juristic too:
${POA_FOLDER_URL}
`;

    emailBody += `

Best regards,
Dave`;

    MailApp.sendEmail({
      to: "coproperty.info@gmail.com",
      subject: `Check-In Confirmation for ${formType} - ${fullname}`,
      body: emailBody,
      attachments: attachments
    });

    return ContentService
      .createTextOutput(JSON.stringify({ message: "✅ Successfully processed and emailed PDF!" }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    Logger.log("Error details: " + err.stack);

    return ContentService
      .createTextOutput(JSON.stringify({ message: "❌ Error: " + err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Splits a full name into first name + surname on whitespace. The first word is
 * the given name and everything after it is the surname, so multi-word family
 * names ("Maria del Carmen Ruiz") stay together. A single word leaves the
 * surname blank rather than duplicating it.
 *
 * @param {string} fullname
 * @return {{first: string, last: string}}
 */
function splitName(fullname) {
  const parts = (fullname || "").trim().split(/\s+/).filter(String);
  if (parts.length === 0) return { first: "", last: "" };
  if (parts.length === 1) return { first: parts[0], last: "" };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

/**
 * Rejects a template that DocumentApp can't open, before anything gets copied.
 *
 * An uploaded .doc/.docx keeps its Word MIME type in Drive, and
 * DocumentApp.openById() then fails with a message that says nothing about the
 * real cause. Since extra-form failures are surfaced to the recipient by name,
 * it's worth spending one metadata read to make that line actionable.
 *
 * @param {string} templateId
 */
function assertTemplateIsGoogleDoc(templateId) {
  const mime = DriveApp.getFileById(templateId).getMimeType();
  if (mime !== MimeType.GOOGLE_DOCS) {
    throw new Error(
      "template is not a Google Doc (" + mime + "). Open it in Drive and use " +
      "File → Save as Google Docs, then use the new doc's ID."
    );
  }
}

/**
 * Copies a template doc, fills its {PLACEHOLDER} tags, optionally appends the
 * uploaded image, and returns the result as a PDF blob.
 *
 * @param {string} templateId  Doc ID of the template to copy
 * @param {string} docName     Name for the generated copy
 * @param {{fields: Object, imageDataUrl: (string|undefined),
 *          signatureName: (string|undefined), signatureFont: (string|undefined)}} opts
 * @return {Blob} the generated PDF
 */
function buildDocFromTemplate(templateId, docName, opts) {
  assertTemplateIsGoogleDoc(templateId);
  const copy = DriveApp.getFileById(templateId).makeCopy(docName);
  const doc = DocumentApp.openById(copy.getId());
  const body = doc.getBody();

  // Curly braces are escaped because replaceText() treats the search string as a regex.
  const fields = opts.fields || {};
  Object.keys(fields).forEach(function (placeholder) {
    const v = fields[placeholder] == null ? "" : fields[placeholder].toString();
    body.replaceText("\\{" + placeholder + "\\}", v);
  });

  if (opts.signatureName) {
    fillSignature(body, opts.signatureName, opts.signatureFont);
  }

  // === INSERT & AUTO-RESIZE IMAGE TO A4 ===
  const imageDataUrl = opts.imageDataUrl;
  if (imageDataUrl && imageDataUrl.startsWith("data:")) {
    const base64Data = imageDataUrl.split(",")[1];
    const contentType = imageDataUrl.split(";")[0].split(":")[1];
    const blob = Utilities.base64Decode(base64Data);
    const imageBlob = Utilities.newBlob(blob, contentType, "image.png");

    body.appendParagraph("\nAttached Image:");

    const image = body.appendImage(imageBlob);

    const pageWidth = doc.getPageWidth();
    const marginLeft = doc.getMarginLeft();
    const marginRight = doc.getMarginRight();
    const maxWidth = pageWidth - marginLeft - marginRight;

    const originalWidth = image.getWidth();
    const originalHeight = image.getHeight();

    if (originalWidth > maxWidth) {
      const ratio = maxWidth / originalWidth;
      image.setWidth(maxWidth);
      image.setHeight(originalHeight * ratio);
    }

    image.getParent().setAlignment(DocumentApp.HorizontalAlignment.CENTER);
  }

  doc.saveAndClose();
  return DriveApp.getFileById(copy.getId()).getAs("application/pdf");
}

/**
 * Replaces every {SIGNATURE} placeholder with the guest's name in a handwriting
 * font. Done manually instead of via replaceText() because replaceText() can't
 * style the text it inserts.
 */
function fillSignature(body, name, fontFamily) {
  const placeholder = "\\{SIGNATURE\\}";
  let guard = 0;
  let found = body.findText(placeholder);

  while (found && guard++ < 50) {
    const text = found.getElement().asText();
    const start = found.getStartOffset();

    text.deleteText(start, found.getEndOffsetInclusive());
    text.insertText(start, name);
    text.setFontFamily(start, start + name.length - 1, fontFamily || "Dancing Script");
    text.setFontSize(start, start + name.length - 1, 16);
    text.setBold(start, start + name.length - 1, false);
    text.setItalic(start, start + name.length - 1, false);

    // Re-search from the top: the range above is stale after the edit.
    found = body.findText(placeholder);
  }
}

function formatDate(date) {
  const dd = String(date.getDate()).padStart(2, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${dd} ${mm} ${yyyy}`;
}

/**
 * Finds the Hospitable property whose name starts with the given PID number
 * (the leading digits of property.name, e.g. "001-R36-..." or "04_N276 F26")
 * and returns its full address.
 *
 * Set up once: Project Settings → Script Properties → add
 *   HOSPITABLE_TOKEN = <your Hospitable Public API token>
 * (Hospitable: Settings → API & Webhooks → create a Personal Access Token.)
 *
 * @param {string} pid  3-digit PID from the form (e.g. "012")
 * @return {{name: string, address: string, multiple: boolean}|null}
 */
function getPropertyAddressByPID(pid) {
  const token = "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhdWQiOiI5YTYyNGRmMC0xMmYxLTQ0OGUtYjg4NC00MzY3ODBhNWQzY2QiLCJqdGkiOiJlMzk1NzZjOTE4ZTc4ZjIzYjgxZGVhNjhkYmUzNzhmZWE5NmZlYmZlMTk4MmQ1NmZhZjMwYjM5Mzk5ZWNjZjUwNzhkMzRiYmZkZDk5YWNiYiIsImlhdCI6MTc2NzY4MjYwOC4zODY3NDksIm5iZiI6MTc2NzY4MjYwOC4zODY3NTQsImV4cCI6MTc5OTIxODYwOC4zODEyMTYsInN1YiI6IjIwNzQyMiIsInNjb3BlcyI6WyJwYXQ6cmVhZCIsInBhdDp3cml0ZSJdfQ.ZzkFpTzRAo_fwiRiU22clBsEIw5fpGs7zlJdNcNu42fcQJqvURls3L8ZZZYx4NatwyijckMWR9EMSxDKQtOW1terbCbU_isw6zQzomXjJKePUAqjANS-nI_OyKrN7biDck_uyXd2EdoglmcHEbEa5qopIo8Z2MRluD-YZJjt0hfUTdVJzsbVHji5FC4goLERTOnWY1xlvV1WhSh97vEcEBZCot4yjrHYOtkTG5gSkn6_I7BrkRcWH1v0NB942yT8G2DmZ9_elsTzQp7Hh7ucRWqLqcUCcJoSB5YXHK_lkZYQz-Ax2_ocfqollhMxCLVsCswzf8_DPj-UxUSLL9SlY2eOT7u6JrokP54Irtt8ZRZ86ulUF3107IVg9ocHInJ5vbeSeE-eJNAM6_qfApWDhI0JXxlhT_oZ6qzBdukUhM-KnTSsdj5a0FMVw5M2-HdnTy0dx_xOQkLFBgg3NDFup4fWq7YOXDnLVYZS5EO26p6FTVUxHxI4Vm8ifjwzFMm-AjgGLDzJQQwBqAQy_1YD-m0-ShcxhCvbJ0TUqrcL-31RJm2XOUdKqxtKDVpK6VNADiHXcoiWSOjat6RNgaVfM0662UVfZUUfJ-VW53M6L4yfU2K-FUR2Kq8hhABNht4sNBddWRUikjTAITn1c43dZ9Qtq3dbcfh5RF1eH5pAmVA";
  if (!token) throw new Error("HOSPITABLE_TOKEN script property not set");

  const target = parseInt(pid, 10); // numeric match → tolerant of "001" vs "1" vs "04"
  if (isNaN(target)) throw new Error("Invalid PID: " + pid);

  const matches = [];
  let page = 1;
  let lastPage = 1;

  do {
    const url = "https://public.api.hospitable.com/v2/properties?page=" + page + "&per_page=100";
    const res = UrlFetchApp.fetch(url, {
      method: "get",
      headers: { "Authorization": "Bearer " + token, "Accept": "application/json" },
      muteHttpExceptions: true
    });

    if (res.getResponseCode() !== 200) {
      throw new Error("Hospitable API " + res.getResponseCode() + ": " + res.getContentText());
    }

    const json = JSON.parse(res.getContentText());
    const props = json.data || [];
    props.forEach(function (p) {
      const m = (p.name || "").match(/^\s*(\d+)/); // leading number of the name
      if (m && parseInt(m[1], 10) === target) matches.push(p);
    });

    lastPage = (json.meta && json.meta.last_page) ? json.meta.last_page : page;
    page++;
  } while (page <= lastPage);

  if (matches.length === 0) return null;

  const prop = matches[0];
  const a = prop.address || {};
  const fullAddress = a.display ||
    [a.number, a.street, a.city, a.state, a.postcode, a.country_name || a.country]
      .filter(Boolean).join(", ");

  return { name: prop.name, address: fullAddress, multiple: matches.length > 1 };
}
