# wakatimeReadmeStats

## Setup Instructions

Follow these steps to automatically update your WakaTime stats card in your GitHub README using GitHub Actions or use it directly.

### 1. Create and Add Your WakaTime API Key

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

5. for using directly, skip to step 4

### 2. Grant GitHub Actions Write Permissions (FOR GITHUB ACTIONS SETUP ONLY)

1. Go to **Repository → Settings → Actions → General**
2. Scroll down to **Workflow permissions**
3. Select:  
   ```
   [x] Read and write permissions
   ```
4. Click **Save**

### 3. Add the GitHub Actions Workflow (FOR GITHUB ACTIONS SETUP ONLY)

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

If using directly:
```md
![WakaTime Stats](YOUR_CUSTOM_VERCEL_URL)
```
```md
<img src="YOUR_CUSTOM_VERCEL_URL" height="410"/>
```

If using github actions:
```md
![WakaTime Stats](https://github.com/YOUR_USERNAME/YOUR_REPO_NAME/main/stats.svg)
```
```md
<img src="https://github.com/YOUR_USERNAME/YOUR_REPO_NAME/main/stats.svg" height="410"/>
```
*Note the file path may be different, such as https://github.com/YOUR_USERNAME/YOUR_REPO_NAME/blob/main/stats.svg; or you may have to use the raw.githubsusercontent.com url, such as https://raw.githubusercontent.com/YOUR_USERNAME/YOUR_REPO_NAME/main/stats.svg*

### 5. Test the Setup (FOR GITHUB ACTIONS SETUP ONLY)

- Go to the **Actions** tab in your GitHub repo
- Click **"Update WakaTime Stats"**
- Use the **"Run workflow"** button to trigger it manually
- Wait a few seconds, then refresh your repo – `stats.svg` should be updated


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
