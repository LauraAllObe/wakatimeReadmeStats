# wakatimeReadmeStats
<div align="center">
  <img src="https://github.com/LauraAllObe/wakatimeReadmeStats/blob/main/static/cardGif1.gif" width="250"/>
  <img src="https://github.com/LauraAllObe/wakatimeReadmeStats/blob/main/static/cardGif2.gif" width="250"/>
  <img src="https://github.com/LauraAllObe/wakatimeReadmeStats/blob/main/static/cardGif3.gif" width="250"/>
</div>

## What is wakatimeReadmeStats?

`wakatimeReadmeStats` lets you showcase pretty, customizable coding activity cards in your GitHub README.  
It pulls your latest WakaTime data and renders it as rich SVG charts you can embed directly using GitHub Actions.

## Table of Contents

- [Quick Setup](#quick-setup)
- [Formatting Examples](#formatting-examples)
- [Troubleshooting](#troubleshooting)
- [Themes](#themes)
- [Component Types](#component-types)
- [Chart Types](#chart-types)
- [All Shared Parameters](#all-shared-parameters)
- [All Component-Specific Parameters](#all-component-specific-parameters)

## Quick Setup

1. **Create a WakaTime Account**  
   - Sign up at [wakatime.com/signup](https://wakatime.com/signup)
   - Set your WakaTime profile to **public** and confirm your **username**
   - Connect it to your IDE: [Editor Setup Guide](https://wakatime.com/plugins)

2. **Set your API Key**  
   - Copy your API Key from [your WakaTime account settings](https://wakatime.com/settings/account)
   - Go to your GitHub repository where you want to display your stats -> Settings -> Secrets and variables -> Actions
   - Select new repository secret and add the name as "WAKATIME_API_KEY" and the value as the API key you copied

3. **Add the GitHub Actions Workflow**  
   - Create a new workflow file at ```.github/workflows/wakatime-stats.yml``` in your repo (example provided below)

<details>
<summary>Copy/Paste-Ready Example</summary>
<br/>
  
**Note:** if your WakaTime and GitHub usernames are different, replace ```"$GITHUB_ACTOR"``` in the URL with your actual WakaTime username.

```yml
name: Update WakaTime Stats SVG

on:
  schedule:
    - cron: '0 */6 * * *' # every 6 hours
  workflow_dispatch:

permissions:
  contents: write

jobs:
  generate-stats:
    runs-on: ubuntu-latest

    steps:
      - name: Checkout repo
        uses: actions/checkout@v3

      - name: Generate SVG from Vercel API
        env:
          WAKATIME_API_KEY: ${{ secrets.WAKATIME_API_KEY }}
        run: |
          mkdir -p wakatime
          curl -s "https://wakatime-readme-stats.vercel.app/api/wakatimeStats?username=$GITHUB_ACTOR&api_key=$WAKATIME_API_KEY" \
            -o wakatime/stats.svg

      - name: Commit SVG to repo
        run: |
          git config user.name github-actions
          git config user.email github-actions@github.com
          git add wakatime/stats.svg
          git commit -m "Update WakaTime stats SVG" || echo "No changes"
          git push
```
</details>

4. **Add the Stats Card to your README**
   - Add this to your readme: ```md <img src="wakatime/stats.svg" height="300"/>```
   - To update immediately, navigate to actions -> Update WakaTime Stats SVG (or other name used) -> Run Workflow and click **Run Now**.

## Formatting Examples

The card can be customized by changing the curl command in your GitHub actions workflow, such as in the examples below.

### Basic URL
```
https://wakatime-readme-stats.vercel.app/api/wakatimeStats?username=your_wakatime_username&api_key=your_api_key"
```
<img src="static/essential.svg" width="300"/>

### Full URL (Multiple Components + Styling + Scaling)

```
https://wakatime-readme-stats.vercel.app/api/wakatimeStats?username=your_wakatime_username&api_key=your_api_key
&components=2
&title_prefix=_____%27s&border_width=2&border_radius=10&scale=true
&bg_color=e6ddd8&title_color=fcf9f2&text_color=997967&logo_color=fcf9f2&border_color=ab8c7b
&component1_scale_value=1.5&component1_type=weekly_avg&component1_chart_type=radar&component1_chart_color=fcf9f2
&component1_start_day=mo&component1_y_axis=true&component1_y_axis_label=true&component1_hide_legend=true&component1_hide_total=true
&component2_type=heatmap&component2_start_day=mo&component2_heatmap_color=fcf9f2
```
*Remember to remove spaces and newlines*

<img src="static/example.svg" width="300"/>

## Troubleshooting

- **No output?** Make sure your WakaTime profile and GitHub repository are **public**
- **URL broken?** Check your `username` and `WAKATIME_API_KEY`
- **Not updating?** Trigger a manual update via GitHub Actions, or append `?v=1` to the image URL on your readme to bypass cache.
- **Still seeing old data?** Add a unique query string to the image URL on your readme, like `?timestamp=<some-value>` to force a fresh load.
- **SVG not committed?** Make sure your `.gitignore` doesn't exclude the `wakatime/` folder or `*.svg` files.

## Optional for Customization

### Themes

<div align="center">
  <img src="static/color_themes/mocha_pink.svg" alt="TO USE ADD THIS: &theme=mocha_pink" width="250"/>
  <img src="static/color_themes/latte_red.svg" alt="TO USE ADD THIS: &theme=latte_red" width="250"/>
  <img src="static/color_themes/icy_indigo.svg" alt="TO USE ADD THIS: &theme=icy_indigo" width="250"/>
</div>

<div align="center">
  <img src="static/color_themes/storm_blue.svg" alt="TO USE ADD THIS: &theme=storm_blue" width="250"/>
  <img src="static/color_themes/sky_blue.svg" alt="TO USE ADD THIS: &theme=sky_blue" width="250"/>
  <img src="static/color_themes/sunlight_gold.svg" alt="TO USE ADD THIS: &theme=sunlight_gold" width="250"/>
</div>

<div align="center">
  <img src="static/color_themes/fresh_green.svg" alt="TO USE ADD THIS: &theme=fresh_green" width="250"/>
  <img src="static/color_themes/soft_rose.svg" alt="TO USE ADD THIS: &theme=soft_rose" width="250"/>
  <img src="static/color_themes/neutral_cyan.svg" alt="TO USE ADD THIS: &theme=neutral_cyan" width="250"/>
</div>

<div align="center">
  <img src="static/color_themes/amber_cream.svg" alt="TO USE ADD THIS: &theme=amber_cream" width="250"/>
  <img src="static/color_themes/nature_green.svg" alt="TO USE ADD THIS: &theme=nature_green" width="250"/>
  <img src="static/color_themes/cherry_blossom.svg" alt="TO USE ADD THIS: &theme=cherry_blossom" width="250"/>
</div>

<div align="center">
  <img src="static/color_themes/ocean_mist.svg" alt="TO USE ADD THIS: &theme=ocean_mist" width="250"/>
  <img src="static/color_themes/lime_leaf.svg" alt="TO USE ADD THIS: &theme=lime_leaf" width="250"/>
  <img src="static/color_themes/pastel_pink.svg" alt="TO USE ADD THIS: &theme=pastel_pink" width="250"/>
</div>

<div align="center">
  <img src="static/color_themes/lavender_dream.svg" alt="TO USE ADD THIS: &theme=lavender_dream" width="250"/>
  <img src="static/color_themes/gray_cloud.svg" alt="TO USE ADD THIS: &theme=gray_cloud" width="250"/>
  <img src="static/color_themes/frost_steel.svg" alt="TO USE ADD THIS: &theme=frost_steel" width="250"/>
</div>

<div align="center">
  <img src="static/color_themes/earth_brown.svg" alt="TO USE ADD THIS: &theme=earth_brown" width="250"/>
  <img src="static/color_themes/royal_violet.svg" alt="TO USE ADD THIS: &theme=royal_violet" width="250"/>
  <img src="static/color_themes/lemon_glow.svg" alt="TO USE ADD THIS: &theme=lemon_glow" width="250"/>
</div>

<div align="center">
  <img src="static/color_themes/arctic_wave.svg" alt="TO USE ADD THIS: &theme=arctic_wave" width="250"/>
  <img src="static/color_themes/spicy_coral.svg" alt="TO USE ADD THIS: &theme=spicy_coral" width="250"/>
  <img src="static/color_themes/berry_grape.svg" alt="TO USE ADD THIS: &theme=berry_grape" width="250"/>
</div>

<div align="center">
  <img src="static/color_themes/midnight_violet.svg" alt="TO USE ADD THIS: &theme=midnight_violet" width="250"/>
  <img src="static/color_themes/teal_neon.svg" alt="TO USE ADD THIS: &theme=teal_neon" width="250"/>
  <img src="static/color_themes/dark_github.svg" alt="TO USE ADD THIS: &theme=dark_github" width="250"/>
</div>

<div align="center">
  <img src="static/color_themes/classic_monokai.svg" alt="TO USE ADD THIS: &theme=classic_monokai" width="250"/>
  <img src="static/color_themes/cyber_aqua.svg" alt="TO USE ADD THIS: &theme=cyber_aqua" width="250"/>
  <img src="static/color_themes/warm_graphite.svg" alt="TO USE ADD THIS: &theme=warm_graphite" width="250"/>
</div>

<div align="center"> 
  <details>
    <summary>Name key for themes</summary>
    <div style="text-align: left; display: inline-block;">
      <div>• mocha_pink (row1, col1)</div>
      <div>• latte_red (row1, col2)</div>
      <div>• icy_indigo (row1, col3)</div>
      <div>• storm_blue (row2, col1)</div>
      <div>• sky_blue (row2, col2)</div>
      <div>• sunlight_gold (row2, col3)</div>
      <div>• fresh_green (row3, col1)</div>
      <div>• soft_rose (row3, col2)</div>
      <div>• neutral_cyan (row3, col3)</div>
      <div>• amber_cream (row4, col1)</div>
      <div>• nature_green (row4, col2)</div>
      <div>• cherry_blossom (row4, col3)</div>
      <div>• ocean_mist (row5, col1)</div>
      <div>• lime_leaf (row5, col2)</div>
      <div>• pastel_pink (row5, col3)</div>
      <div>• lavender_dream (row6, col1)</div>
      <div>• gray_cloud (row6, col2)</div>
      <div>• frost_steel (row6, col3)</div>
      <div>• earth_brown (row7, col1)</div>
      <div>• royal_violet (row7, col2)</div>
      <div>• lemon_glow (row7, col3)</div>
      <div>• arctic_wave (row8, col1)</div>
      <div>• spicy_coral (row8, col2)</div>
      <div>• berry_grape (row8, col3)</div>
      <div>• midnight_violet (row9, col1)</div>
      <div>• teal_neon (row9, col2)</div>
      <div>• dark_github (row9, col3)</div>
      <div>• classic_monokai (row10, col1)</div>
      <div>• cyber_aqua (row10, col2)</div>
      <div>• warm_graphite (row10, col3)</div>
    </div>
  </details>
</div>

### Component Types

<div align="center">
  <img src="static/types/heatmap.svg" alt="TO USE ADD THIS (CAN CHANGE NUMBERS AS NEEDED): &components=1&component1_type=heatmap" width="250"/>
  <img src="static/types/basic.svg" alt="TO USE ADD THIS (CAN CHANGE NUMBERS AS NEEDED): &components=1&component1_type=basic" width="250"/>
</div>

<div align="center">
  <img src="static/types/weekly_bar.svg" alt="TO USE ADD THIS (CAN CHANGE NUMBERS AS NEEDED): &components=1&component1_type=weekly&component1_chart_type=bar" width="250"/>
  <img src="static/types/weekly_avg_bar.svg" alt="TO USE ADD THIS (CAN CHANGE NUMBERS AS NEEDED): &components=1&component1_type=weekly_avg&component1_chart_type=bar" width="250"/>
  <img src="static/types/rank.svg" alt="TO USE ADD THIS (CAN CHANGE NUMBERS AS NEEDED): &components=1&component1_type=rank" width="250"/>
</div>

<div align="center">
  <img src="static/types/weekly_langs_bar.svg" alt="TO USE ADD THIS (CAN CHANGE NUMBERS AS NEEDED): &components=1&component1_type=weekly_langs&component1_chart_type=bar" width="250"/>
  <img src="static/types/weekly_projs_bar.svg" alt="TO USE ADD THIS (CAN CHANGE NUMBERS AS NEEDED): &components=1&component1_type=weekly_projs&component1_chart_type=bar" width="250"/>
  <img src="static/types/all_projs_bar_vertical.svg" alt="TO USE ADD THIS (CAN CHANGE NUMBERS AS NEEDED): &components=1&component1_type=all_projs&component1_chart_type=bar_vertical" width="250"/>
</div>

<div align="center">
  <img src="static/types/all_langs_bar_vertical.svg" alt="TO USE ADD THIS (CAN CHANGE NUMBERS AS NEEDED): &components=1&component1_type=all_langs&component1_chart_type=bar_vertical" width="250"/>
  <img src="static/types/spedometer.svg" alt="TO USE ADD THIS (CAN CHANGE NUMBERS AS NEEDED): &components=1&component1_type=spedometer" width="250"/>
</div>

<div align="center"> 
  <details>
    <summary>Name key for component types</summary>
    <div style="text-align: left; display: inline-block;">
      <div>• heatmap (row1, col1)</div>
      <div>• basic (row1, col2)</div>
      <div>• weekly (row2, col1)</div>
      <div>• weekly_avg (row2, col2)</div>
      <div>• rank (row2, col3)</div>
      <div>• weekly_langs (row3, col1)</div>
      <div>• weekly_projs (row3, col2)</div>
      <div>• all_projs (row3, col3)</div>
      <div>• all_langs (row4, col1)</div>
      <div>• spedometer (row4, col2)</div>
    </div>
  </details>
</div>

### Chart Types

<div align="center">
  <img src="static/chart_types/weekly_bar.svg" alt="TO USE ADD THIS (CAN CHANGE NUMBERS AS NEEDED): &components=1&component1_type=weekly&component1_chart_type=bar" width="250"/>
  <img src="static/chart_types/weekly_line.svg" alt="TO USE ADD THIS (CAN CHANGE NUMBERS AS NEEDED): &components=1&component1_type=weekly&component1_chart_type=line" width="250"/>
  <img src="static/chart_types/weekly_area.svg" alt="TO USE ADD THIS (CAN CHANGE NUMBERS AS NEEDED): &components=1&component1_type=weekly&component1_chart_type=area" width="250"/>
</div>

<div align="center">
  <img src="static/chart_types/all_langs_bar_vertical.svg" alt="TO USE ADD THIS (CAN CHANGE NUMBERS AS NEEDED): &components=1&component1_type=all_langs&component1_chart_type=bar_vertical" width="250"/>
  <img src="static/chart_types/weekly_spiral.svg" alt="TO USE ADD THIS (CAN CHANGE NUMBERS AS NEEDED): &components=1&component1_type=weekly&component1_chart_type=spiral" width="250"/>
  <img src="static/chart_types/weekly_donut.svg" alt="TO USE ADD THIS (CAN CHANGE NUMBERS AS NEEDED): &components=1&component1_type=weekly&component1_chart_type=donut" width="250"/>
</div>

<div align="center">
  <img src="static/chart_types/weekly_radar.svg" alt="TO USE ADD THIS (CAN CHANGE NUMBERS AS NEEDED): &components=1&component1_type=weekly&component1_chart_type=radar" width="250"/>
  <img src="static/chart_types/weekly_bubble.svg" alt="TO USE ADD THIS (CAN CHANGE NUMBERS AS NEEDED): &components=1&component1_type=weekly&component1_chart_type=bubble" width="250"/>
</div>

<div align="center"> 
  <details>
    <summary>Name key for chart types</summary>
    <div style="text-align: left; display: inline-block;">
      <div>• bar (row1, col1)</div>
      <div>• line (row1, col2)</div>
      <div>• area (row1, col3)</div>
      <div>• bar_vertical (row2, col1)</div>
      <div>• spiral (row2, col2)</div>
      <div>• donut (row2, col3)</div>
      <div>• radar (row3, col1)</div>
      <div>• bubble (row3, col2)</div>
    </div>
  </details>
</div>

<br/>
<details>
<summary>Click to expand full customization parameter list</summary>
  
### All Shared Parameters

| **Parameter**            | **Components**         | **Value**            | **Description**                                                                 | **Example**                         |
|--------------------------|------------------------|----------------------|---------------------------------------------------------------------------------|-------------------------------------|
| `username`               | All                    | `string`             | **Required**. Your WakaTime username (from your WakaTime profile URL).          | `username=yourname`               |
| `theme`                  | All                    | `string`             | Color theme for all card colors.                                                | `theme=teal_neon`                 |
| `bg_color`               | All                    | hex color            | Background color of the SVG card.                                               | `bg_color=ffffff`                 |
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

### All Component-Specific Parameters

| **Parameter**            | **Components**                          | **Value**                     | **Description**                                                                 | **Example**                          |
|--------------------------|-----------------------------------------|-------------------------------|---------------------------------------------------------------------------------|--------------------------------------|
| `type`                   | All                 | `basic`, `heatmap`, `rank`, `spedometer`, `weekly`, `weekly_avg`, `weekly_langs`, `weekly_projs`, `all_langs`, `all_projs`      | Specifies which card to render.                                                | `component1_type=weekly_avg`        |
| `chart_type`             | `weekly`, `weekly_avg`, `weekly_langs`, `weekly_projs`, `all_langs`, `all_projs` | `bar`, `bar_vertical`, `line`, `area`, `radar`, `bubble`, `donut`, `spiral` → See notes below for compatibility.  | Chart visualization style.                                          | `component1_chart_type=radar`       |
| `chart_color`            | Same as above                          | hex color                     | Color of bars/lines in charts.                                                 | `component1_chart_color=fcf9f2`      |
| `chart_curved_line`      | Same as above                          | `true` / `false`              | Enables curved line chart if applicable.                                       | `component1_chart_curved_line=true`  |
| `start_day`              | `heatmap`, `weekly`, `weekly_projs`, `weekly_langs` | `mo`, `-7`, etc.              | Starting point for data in charts.                                             | `component1_start_day=-7`           |
| `heading_type`           | `heatmap`, `weekly`, `weekly_avg`, `weekly_langs`, `weekly_projs`, `all_langs`, `all_projs`                    | `friendly`, `compact`         | Title formatting style.                                                        | `component2_heading_type=compact`    |
| `hide_title`             | All                                     | `true` / `false`              | Hides the component title.                                                     | `component3_hide_title=true`        |
| `hide_total`, `hide_time`, `hide_percentage`, `hide_legend` | Most charts                   | `true` / `false`                          | Optionally hide stats within chart.                                | `component2_hide_legend=true`       |
| `y_axis`, `y_axis_label` | Most bar charts                        | `true` / `false`              | Controls Y-axis visibility and label.                                          | `component1_y_axis=true`            |
| `num_langs`, `num_projs` | `all_langs`, `all_projs`               | integer                        | How many top items to show.                                                    | `component2_num_langs=5`            |
| `heatmap_color`          | `heatmap`                              | hex color                     | Color of the heatmap blocks.                                                   | `component3_heatmap_color=fcf9f2`    |
| `rank_color`             | `rank`                                 | hex color                     | Color of the rank highlight.                                                   | `component2_rank_color=ffcc00`       |
| `difficulty`             | `spedometer`                           | `self`, `easy`, `medium`, `hard`      | Difficulty range for spedometer gauge.                                         | `component1_difficulty=medium`       |
| `label_type`             | `spedometer`                           | `standard`, `emoji`, `game`, `emojiStandard`, `emojiGame`, `customEmoji`, `customEmojiStandard`, `customEmojiGame`           | How labels are shown above the gauge.                                          | `component1_label_type=emojiGame`        |
| `custom_emojis`          | `spedometer`                           | 5 emojis string                  | Used when label_type includes customEmoji variations.                                 | `component1_custom_emojis=🐢🐇🚀🔥👑`    |
| `show_high_score`        | `spedometer`                           | `true` / `false`              | Whether to show your highest speed value.                                      | `component1_show_high_score=true`    |

🧾 Notes on chart_type compatibility:
- bar: in all chart components
- radar: only in weekly_avg and weekly
- line, area: not in all_langs, all_projs
- bar_vertical: only in all_langs, all_projs
- bubble, donut: not in weekly_langs, weekly_projs
- spiral: only in weekly, weekly_avg
</details>
