function doPost(e) {
  try {
    const formType = e.parameter.form || "Form";

    // === SINGLE SHARED TEMPLATE FOR ALL FORMS ===
    const templateId = "1QDzhQncskMkAkcIJq_tOraW2EU5HOP6zgOrr11YUhKs";

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

    const templateFile = DriveApp.getFileById(templateId);
    const copy = templateFile.makeCopy(`CheckIn - ${formType} - ${fullname}`);
    const doc = DocumentApp.openById(copy.getId());
    const body = doc.getBody();

    body.replaceText("{FULLNAME}", fullname);
    body.replaceText("{EMAIL}", email);
    body.replaceText("{PASSPORT ID}", passportId);
    body.replaceText("{PID}", pid);
    body.replaceText("{FULL_ADDRESS}", fullAddress);
    body.replaceText("{NUMBER OF GUESTS}", numGuests);
    body.replaceText("{CHECKIN DATE}", checkinFormatted);
    body.replaceText("{CHECKOUT DATE}", checkoutFormatted);

    // === INSERT & AUTO-RESIZE IMAGE TO A4 ===
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

    const mainPdf = DriveApp.getFileById(copy.getId()).getAs("application/pdf");
    const attachments = [mainPdf];

    let emailBody = `Dear ${fullname},

Your check-in record for ${formType} has been received successfully.

PID: ${pid}
Property: ${matchedPropertyName || "—"}
Address: ${fullAddress}
Number of Guests: ${numGuests}
`;

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
  const token = PropertiesService.getScriptProperties().getProperty("HOSPITABLE_TOKEN");
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
