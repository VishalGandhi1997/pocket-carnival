# Store assets — Khel Mela

Everything you need for the Google Play listing. Full submission steps are in
[../APK-AND-PLAYSTORE.md](../APK-AND-PLAYSTORE.md).

| File | What it is | How to use |
|---|---|---|
| `listing.md` | App name, short + full description, category, data-safety declarations | Copy-paste into Play Console |
| `privacy-policy.html` | Complete, ads-aware privacy policy (required to publish) | Host at a public URL; paste that URL into Play Console. Edit the contact email first. |
| `feature-graphic.html` | The 1024×500 banner Play shows atop your listing | Open in a browser, screenshot the graphic at 1× → save as PNG |
| App icon | — | Export `../public/icon.svg` to a 512×512 PNG |
| Phone screenshots | — | Screenshot the running app in portrait (home, BlockBazi, a win screen, a 2-player match). 2–8 required. |

## Fastest way to host the privacy policy
Any static host works. E.g. with Vercel: drop `privacy-policy.html` in a folder
and `vercel deploy`, or commit it to a GitHub repo and enable GitHub Pages. The
resulting URL goes in Play Console ▸ Store settings ▸ Privacy Policy **and** in
the Data safety form.
