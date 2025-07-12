# wakatimeReadmeStats

## Setup Instructions

Follow these steps to automatically update your WakaTime stats card in your GitHub README using GitHub Actions (svg loads faster on page refresh, updates once a day) or by using the url directly (easier setup and updates on page refresh).

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

5. if using the url directly, skip to step 4

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

Replace `YOUR_CUSTOM_VERCEL_URL` in the URL with your actual WakaTime customized url.

### 4. Add the Stats Card to Your README

In your `README.md`, add the following line wherever you want the card to appear.

If using the url directly:
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

## Shared Parameters

| **Parameter**            | **Components**         | **Value**            | **Description**                                                                 | **Example**                         |
|--------------------------|------------------------|----------------------|---------------------------------------------------------------------------------|-------------------------------------|
| `username`               | All                    | `string`             | **Required**. Your WakaTime username (from your WakaTime profile URL).          | `username=yourname`                |
| `bg_color`               | All                    | hex color            | Background color of the SVG card.                                               | `bg_color=ffffff`                  |
| `title_color`            | All                    | hex color            | Color of the title text.                                                        | `title_color=000000`              |
| `text_color`             | All                    | hex color            | Color of all other text.                                                        | `text_color=333333`               |
| `logo_color`             | All                    | hex color            | Color used to fill the WakaTime logo.                                           | `logo_color=a68b2c`               |
| `font_family`            | All                    | string               | Font used across the card.                                                      | `font_family=Fira Code`           |
| `border_color`           | All                    | hex color            | Color of the outer border.                                                      | `border_color=cccccc`             |
| `border_width`           | All                    | number (px)          | Border thickness in pixels.                                                     | `border_width=2`                  |
| `border_radius`          | All                    | number (px)          | Rounded border radius.                                                          | `border_radius=10`                |
| `show_logo`              | All                    | `true` / `false`     | Whether to show the WakaTime logo.                                              | `show_logo=true`                  |
| `title_prefix`           | All                    | string               | Prefix text for the title.                                                      | `title_prefix=My`                 |
| `title_scale_value`      | All                    | decimal              | Scales the title block width (relative to the widest component).                | `title_scale_value=0.8`           |
| `scale`                  | All                    | `true` / `false`     | Whether to auto-scale all components to the same width.                         | `scale=true`                      |
| `componentX_scale_value` | All                    | decimal              | Per-component width scale relative to the widest one. Overrides `scale`.        | `component1_scale_value=1.5`      |

## Component-Specific Parameters

| **Parameter**            | **Components**                          | **Value**                     | **Description**                                                                 | **Example**                          |
|--------------------------|-----------------------------------------|-------------------------------|---------------------------------------------------------------------------------|--------------------------------------|
| `type`                   | All (`componentX_type`)                 | `basic`, `heatmap`, etc.      | Specifies which card to render.                                                | `component1_type=weekly_avg`        |
| `chart_type`             | `weekly`, `weekly_avg`, `weekly_langs`, `weekly_projs`, `all_langs`, `all_projs` | `bar`, `radar`, `bar_vertical` | Chart visualization style.                                          | `component1_chart_type=radar`       |
| `chart_color`            | Same as above                          | hex color                     | Color of bars/lines in charts.                                                 | `component1_chart_color=fcf9f2`      |
| `chart_curved_line`      | Same as above                          | `true` / `false`              | Enables curved line chart if applicable.                                       | `component1_chart_curved_line=true`  |
| `start_day`              | `heatmap`, `weekly`, `weekly_projs`, `weekly_langs` | `mo`, `-7`, etc.              | Starting point for data in charts.                                             | `component1_start_day=-7`           |
| `heading_type`           | All breakdown cards                    | `friendly`, `compact`         | Title formatting style.                                                        | `component2_heading_type=compact`    |
| `hide_title`             | All                                     | `true` / `false`              | Hides the component title.                                                     | `component3_hide_title=true`        |
| `hide_total`, `hide_time`, `hide_percentage`, `hide_legend` | Most charts                   | `true` / `false`                          | Optionally hide stats within chart.                                | `component2_hide_legend=true`       |
| `custom_heading`         | `weekly`, `weekly_avg`                 | string                        | Overrides the auto title for the chart.                                        | `component1_custom_heading=Week`     |
| `custom_days`            | `weekly`, `weekly_avg`                 | comma-separated days          | Custom days override, e.g. for `last 5 days`.                                  | `component1_custom_days=Mo,Tu,We`    |
| `y_axis`, `y_axis_label` | Most bar charts                        | `true` / `false`              | Controls Y-axis visibility and label.                                          | `component1_y_axis=true`            |
| `num_langs`, `num_projs` | `all_langs`, `all_projs`               | number                        | How many top items to show.                                                    | `component2_num_langs=5`            |
| `heatmap_color`          | `heatmap`                              | hex color                     | Color of the heatmap blocks.                                                   | `component3_heatmap_color=fcf9f2`    |
| `rank_color`             | `rank`                                 | hex color                     | Color of the rank highlight.                                                   | `component2_rank_color=ffcc00`       |
| `difficulty`             | `spedometer`                           | `easy`, `medium`, `hard`      | Difficulty range for spedometer gauge.                                         | `component1_difficulty=medium`       |
| `label_type`             | `spedometer`                           | `standard`, `emoji`           | How labels are shown below the gauge.                                          | `component1_label_type=emoji`        |
| `custom_emojis`          | `spedometer`                           | emoji string                  | Override emoji sequence for spedometer labels.                                 | `component1_custom_emojis=😴,⚡️,🔥`    |
| `show_high_score`        | `spedometer`                           | `true` / `false`              | Whether to show your highest speed value.                                      | `component1_show_high_score=true`    |
