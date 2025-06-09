# wakatimeReadmeStats

## 🔐 WakaTime API Setup

To use your own WakaTime stats in this card:

1. Go to your WakaTime account → Settings → Copy your **API Key**
2. In your GitHub repo, go to **Settings → Secrets → Actions**
3. Add a new secret:
   - **Name**: `WAKATIME_API_KEY`
   - **Value**: *(paste your WakaTime key)*

Then add this to your `README.md`:

```html
<img src="https://yourusername.vercel.app/api/wakatime-stats?username=YOUR_WAKATIME_USERNAME&type=basic" />
```

---

## 📊 Card Type: `basic`

This card displays your yearly WakaTime stats, such as total coding time, daily average, and top categories like languages and OS.

### ➕ Basic Example

```html
<img src="http://localhost:3000/api/wakatime-stats?username=LauraAllObe&type=basic" />
```

### 🎨 Fully Customized Example

```html
<img src="http://localhost:3000/api/wakatime-stats?username=LauraAllObe&type=basic&bg_color=f0d9c5&title_color=5c4b3e&text_color=7d6c5e&logo_color=fff8f2&font_family=Fira%20Code&width=500&showLogo=true&hideLanguages=true&hideProjects=true&hideOperatingSystems=true&hideMostActiveDay=true" />
```

### ⚙️ Available Parameters

| Parameter              | Type         | Description                                                        |
| ---------------------- | ------------ | ------------------------------------------------------------------ |
| `username`             | `string`     | **Required**. Your WakaTime username (from your profile URL).      |
| `type`                 | `string`     | **Required**. Use `basic` to show this card type.                  |
| `bg_color`             | `hex`        | Background color of the card (e.g. `ffffff`, `0d1117`).            |
| `title_color`          | `hex`        | Color of the title text (e.g. `000000`).                           |
| `text_color`           | `hex`        | Color of all other text content.                                   |
| `logo_color`           | `hex`        | Fill color of the WakaTime logo (only applies if `showLogo=true`). |
| `font_family`          | `string`     | Optional font family (e.g. `Calibri`, `Fira Code`, `Courier New`). |
| `width`                | `number`     | Width of the SVG card (default is `400`).                          |
| `showLogo`             | `true/false` | Toggles display of the WakaTime logo next to the title.            |
| `hideLanguages`        | `true/false` | Hides the **Top Languages** section if set to `true`.              |
| `hideProjects`         | `true/false` | Hides the **Top Projects** section if set to `true`.               |
| `hideOperatingSystems` | `true/false` | Hides the **Top OS** section if set to `true`.                     |
| `hideMostActiveDay`    | `true/false` | Hides the **Most Active Day** section if set to `true`.            |

---

## 📁 File Structure

```
project-root/
├── .vercel/
│   └── ...
├── api/
│   └── wakatimeStats.js       # Vercel function entry point
├── lib/
│   ├── heatmapCard.js         # generates SVG for heatmap
│   └── basicStatsCard.js      # generates SVG for basic stats
├── node_modules/
│   └── ...
├── .env                       # for local testing WAKATIME_API_KEY
├── .gitignore
├── package.json
├── README.md
├── vercel.json                # optional config
```