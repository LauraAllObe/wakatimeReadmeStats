# wakatimeReadmeStats

## Setup Instructions

Follow these steps to automatically update your WakaTime stats card in your GitHub README using GitHub Actions.

### 1. Grant GitHub Actions Write Permissions

1. Go to **Repository → Settings → Actions → General**
2. Scroll down to **Workflow permissions**
3. Select:  
   ```
   [x] Read and write permissions
   ```
4. Click **Save**

### 2. Create and Add Your WakaTime API Key

#### Get your WakaTime API key:
1. Go to [https://wakatime.com/settings/account](https://wakatime.com/settings/account)
2. Copy your **"Secret API Key"**

#### Add it to GitHub:
1. Go to **Repository → Settings → Secrets and variables → Actions**
2. Click **"New repository secret"**
3. Name it exactly:
   ```
   WAKATIME_API_KEY
   ```
4. Paste your WakaTime key into the value field and click **Add secret**

### 3. Add the GitHub Actions Workflow

1. In your repo, create this folder if it doesn't exist:
   ```
   .github/workflows/
   ```
2. Inside that folder, create a file named:
   ```
   update-stats.yml
   ```
3. Paste the following contents:

```yaml
name: Update WakaTime Stats

on:
  schedule:
    - cron: '55 23 * * *'  # Runs once a day at 23:55 UTC
  workflow_dispatch:       # Allows manual trigger

jobs:
  update:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout repository
        uses: actions/checkout@v3
        with:
          ref: main

      - name: Download WakaTime Stats SVG
        run: |
          curl -f "YOUR_CUSTOM_VERCEL_URL" -o stats.svg

      - name: Commit and push if changed
        run: |
          git config --global user.name "github-actions"
          git config --global user.email "github-actions@github.com"
          git add stats.svg
          git diff --quiet && git diff --staged --quiet || git commit -m "Update stats.svg"
          git push
```

Replace `YOUR_USERNAME` in the URL with your actual WakaTime username.

### 4. Add the Stats Card to Your README

In your `README.md`, add the following line wherever you want the card to appear:

```md
![WakaTime Stats](https://github.com/YOUR_USERNAME/YOUR_REPO_NAME/main/stats.svg)
```

Or use code:

```md
<img src="https://github.com/YOUR_USERNAME/YOUR_REPO_NAME/main/stats.svg" height="410"/>
```
*Note the file path may be different, such as https://github.com/YOUR_USERNAME/YOUR_REPO_NAME/blob/main/stats.svg; or you may have to use the raw.githubsusercontent.com url, such as https://raw.githubusercontent.com/YOUR_USERNAME/YOUR_REPO_NAME/main/stats.svg*

### 5. Test the Setup

- Go to the **Actions** tab in your GitHub repo
- Click **"Update WakaTime Stats"**
- Use the **"Run workflow"** button to trigger it manually
- Wait a few seconds, then refresh your repo – `stats.svg` should be updated

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