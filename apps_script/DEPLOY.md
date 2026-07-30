# Rebuilding / deploying the check-in Apps Script

`Code.gs` in this folder is the source of truth. The Google-side project is
disposable — if it gets deleted again, run through "First-time rebuild" and
you're back in about five minutes.

All commands run from `apps_script/`. clasp is installed here as a devDependency
(`npx clasp ...`), version 3.x — note that v3 renamed some commands, so recipes
you find online for clasp 2.x may not match.

## First-time rebuild (the project doesn't exist yet)

1. **Enable the Apps Script API** for the Google account that will own the script
   — one toggle at <https://script.google.com/home/usersettings>. `clasp create`
   fails with a "User has not enabled the Apps Script API" error without it.

2. **Log in.** Opens a browser; sign in as the account that should own the
   script. Use **coproperty.info@gmail.com** — it owns the rental contract
   template the script copies, and it's the address the script mails results to.

   ```
   npx clasp login
   ```

3. **Create the project.**

   ```
   npx clasp create --type standalone --title "Coproperty_CheckIn" --rootDir .
   ```

   This writes `.clasp.json` containing the new script ID. Keep that file — it's
   what links this folder to the Google project. It holds no secrets.

4. **Push the code.**

   ```
   npx clasp push
   ```

   Only `Code.gs` and `appsscript.json` are uploaded (see `.claspignore`).

5. **Add the Hospitable token.** This is *not* in the code and cannot be scripted
   in without committing a secret to git, so do it by hand:

   ```
   npx clasp open-script
   ```

   Then **Project Settings → Script Properties → Add script property**:

   | Property | Value |
   |---|---|
   | `HOSPITABLE_TOKEN` | your Hospitable Personal Access Token |

   Get the token from Hospitable → Settings → API & Webhooks. Without it every
   submission fails at the address lookup (`Code.gs` reads this property in
   `getPropertyAddressByPID`).

6. **Deploy as a web app.**

   ```
   npx clasp deploy --description "check-in form"
   ```

   Access settings come from the `webapp` block in `appsscript.json`
   (`executeAs: USER_DEPLOYING`, `access: ANYONE_ANONYMOUS`) — that combination
   is what lets Vercel POST to it without a Google login. Don't loosen or
   tighten it without re-reading step 8.

7. **Authorize it.** Open the script editor (`npx clasp open-script`), pick
   `doPost` in the function dropdown and hit **Run**. It will throw (there's no
   event object) — that's expected and fine. The point is the consent screen:
   accept the Drive / Docs / send-mail / external-request scopes. Until a human
   accepts these once, the web app returns errors for everybody.

8. **Wire up Vercel.** `clasp deploy` prints a deployment ID starting `AKfycb…`.
   The endpoint URL is:

   ```
   https://script.google.com/macros/s/<DEPLOYMENT_ID>/exec
   ```

   Put that in `APPS_SCRIPT_BASE_URL` at the top of `../api/app.py`, then redeploy
   to Vercel.

9. **Verify** before trusting it — submit the form once. On success you get
   "✅ Successfully processed and emailed PDF!" and a PDF lands in
   coproperty.info@gmail.com. If it fails, `api/app.py` now reports the actual
   cause (404 / sign-in page / non-JSON) rather than a JSON parse error.

## Pushing a code change afterwards

```
npx clasp push
npx clasp list-deployments                        # copy the existing deployment ID
npx clasp redeploy <DEPLOYMENT_ID> -d "what changed"
```

Use `redeploy` on the **existing** deployment ID. `clasp deploy` creates a *new*
deployment with a *new* URL, which silently breaks `api/app.py`.

## Notes

- `npx clasp pull` overwrites local `Code.gs` with whatever is live. Useful to
  check for drift if someone edited in the browser; destructive otherwise.
- `npx clasp tail-logs` streams execution logs — the fastest way to see why a
  submission failed server-side.
- If authorization complains about scopes, delete the `oauthScopes` array from
  `appsscript.json` and push again; Apps Script will then auto-detect them.

## Templates the script depends on

| What | Doc ID | Owner |
|---|---|---|
| Rental contract (all PIDs) | `1QDzhQncskMkAkcIJq_tOraW2EU5HOP6zgOrr11YUhKs` | coproperty.info@gmail.com |
| Residential Register (PID 061 / Circle Condominium) | `1aZp5ogm0Xf8s4nrxH35fRHG_Zpw89Lo1ic2l3ciBv8g` | coproperty.info@gmail.com |
| House Rules Acknowledgement (PID 170) | `1tiQ2JcKhb2Vpn1b7YUFAT6FU8X70ig-CgII3fIDsYto` | coproperty.info@gmail.com |
| Register Form (PID 170) | `1IheOxItkQ7kdD3cTPLPNXgtMn-CPrW-S3xz6d_IXr8E` | coproperty.info@gmail.com |

Any entry whose ID still reads `PASTE_…` is skipped, so deploying with one form
configured and one not is safe — the unset form simply isn't attached.

The Register Form is the scanned form with tags typed over it as body text, so it
fills `{NAME}` `{SURNAME}` `{SIGNATURE}` only — every other box goes to the office
blank. Do not replace it with the `.docx` upload
(`1KFcD4cMMsYtETfJhySA4aHzeI96DDsli`) it superseded: that file's tags live in Word
text boxes, which become Docs drawings on conversion and are invisible to
`getBody()`, so it exports as a single horizontal rule and fills nothing.

Because the tags are positioned with runs of spaces rather than a table, a long
guest name pushes `{SURNAME}` rightwards and can wrap the line. A table-based
retype (`templates/residential-status-170.md`) is the durable fix and would also
let the form fill passport number, address, email, guest count and both dates,
all of which are already wired but currently unused.

### Templates must be text, not scans

`Code.gs` fills documents with `body.replaceText()`, which matches **real text**.
A template therefore has to contain the placeholder tags as typed characters.

Two ways a template silently produces a blank form instead of erroring:

- **It's a scan / photo of the paper form.** The doc is then a single embedded
  image with no text layer, and there is nothing for `replaceText()` to match.
  Check quickly by opening the doc and trying to select a word with the cursor —
  if you can't put a caret inside the text, it's an image. Or append
  `/export?format=txt` to the doc URL: an image-only doc exports as (almost)
  nothing.
- **The tags are in a header or footer.** `getBody()` covers body paragraphs and
  tables but *not* headers/footers. Move them into the body, or ask for the fill
  to be extended to header/footer sections.

Converting a `.docx` to Google Docs format does **not** fix a scan — it just puts
the same picture inside a native doc. The form has to be retyped (or OCR'd) so
the fields are text.

### Copy access

The account that owns the script must be able to **copy** every template above,
since `buildDocFromTemplate` calls `DriveApp.getFileById(...).makeCopy(...)`.
View access is enough; no access fails the whole submission.
