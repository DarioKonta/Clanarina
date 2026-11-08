# Secret key (Tajni ključ)

The app syncs with Google Sheets through an Apps Script web app. Every request carries a **secret key**,
and the script rejects any request whose key doesn't match. Each phone needs two values:

| In the app | What it is | Where it comes from |
|---|---|---|
| **URL skripte** | Web app address, ends in `/exec` | Apps Script → Deploy |
| **Tajni ključ** | 20-character key | Apps Script → `setup` log, or Script properties |

## 1. Get the key (once, on the PC)
1. Open the Google Sheet → **Extensions → Apps Script**.
2. Make sure all of [`apps-script/Code.gs`](../apps-script/Code.gs) is pasted in and saved.
3. In the toolbar, select the **`setup`** function and click **Run**. Allow access the first time
   ("Google hasn't verified this app" → **Advanced → Go to …**).
4. The **Execution log** at the bottom shows:
   ```
   Tajni ključ (unesi u aplikaciju): 3f9a1c0b7e2d4a6b8c1e
   ```
   Copy the key after the colon.

Running `setup` again won't change the key. It prints the same one.

**Lost the log?** Go to **Project Settings** (⚙️ on the left) → **Script properties** → `SECRET`.

## 2. Get the URL
**Deploy → New deployment → Web app**, *Execute as:* **Me**, *Who has access:* **Anyone** → **Deploy**.
Copy the **Web app URL** (`https://script.google.com/macros/s/…/exec`).
Already deployed? Use **Deploy → Manage deployments** to copy it again.

## 3. Enter both in the app (on each phone)
1. Open the app → **Podešavanja** tab.
2. Under **Google Sheets sinhronizacija**:
   - **URL skripte** → paste the URL
   - **Tajni ključ** → paste the key
3. Tap **Poveži i sačuvaj**. You should see **Povezano ✔**; the settings are saved and a sync starts.

Spaces before or after the values are removed automatically. The key is stored encrypted on the phone
(`expo-secure-store`) and never appears in the code or in the Sheet.

**Tip for sending to users:** send the URL and the key in a private message, so they can
copy and paste instead of typing them.

## Troubleshooting
| Message in the app | Fix |
|---|---|
| **Pogrešan tajni ključ** | The key doesn't match. Copy it again from Script properties. |
| **URL mora početi sa https://script.google.com/ i završavati se sa /exec** | You copied the wrong link. Use the *Web app URL*, not the editor link. |
| **Nema veze sa serverom** | No internet, or the deployment's access isn't **Anyone**. |
| **Greška na serveru** | Run `setup` once, and after editing Code.gs make a new version (see below). |

## Change the key (e.g. if it leaks)
1. Apps Script → **Project Settings → Script properties** → edit `SECRET` → set a new value
   (any long random text, letters and numbers) → **Save**.
2. Enter the new key in **Podešavanja** on **every** phone. Until they do, their sync fails with
   **Pogrešan tajni ključ**. Their data stays safe on the phone and syncs once the key is updated.

No redeploy is needed. Script properties take effect immediately.

## Don't
- Commit the key or URL to git, or put them in the code.
- Share them publicly. Anyone with both can read and change the Sheet data.
