# Ansura

A **low-profile Chrome extension** that brings Gemini’s answers directly to your webpage with a single click.

Designed for **discretion**, it displays answers in a subtle, semi-transparent overlay that vanishes the instant you click away or tap a key. It handles **any question format** — from multiple-choice to free-text — and works in the background with **automatic model fallbacks** to ensure you’re never left hanging.

**No sidebars, no copy-pasting, and no visible footprint.**

## Installation

1. Go to [the latest release](https://github.com/vojtechsanda/ansura/releases/latest)
2. Download the **ZIP** file `ansura-v0.x.x.zip` and extract it to a safe location
   where you won’t accidentally delete it, as the extension won’t load if the files are removed.
3. Go to the browser extension manager [chrome://extensions/](chrome://extensions/)
4. Enable `Developer mode`. In Google Chrome at the top right, in Microsoft Edge on the left side.
5. The `Load unpacked` option should appear. Click on it and navigate to the directory where you extracted the files.
6. That's it! Extension is now ready to use 🎉

After installation, reload any open webpages for the extension to work properly.

## Configuration

Open the extension options (right-click the toolbar icon → Options, or `chrome://extensions` → Ansura → Details → Extension options):

| Setting             | Description                                                            |
| ------------------- | ---------------------------------------------------------------------- |
| **Gemini API Key**  | Your [Google AI Studio API key](https://aistudio.google.com/api-keys?) |
| **Model**           | Primary model to use (e.g. `gemini-2.5-flash`)                         |
| **Fallback models** | Comma-separated list of models to try when the primary one fails       |

Ensure your usage aligns with the Gemini [rate limits](https://aistudio.google.com/rate-limit).

The **Test models** button checks all configured models against the API and shows a per-model result.

## Usage

1. **Click** the Ansura icon in the toolbar. The cursor will change to a crosshair and the badge will show **ON**.

2. Hover over the question to see a subtle highlight:
   - For **multiple-choice**, highlight the element containing both the question AND the answers.

   - For **free-text**, highlight only the element containing the question.

3. Click the highlighted area. The highlight disappears and the question is sent to Gemini.

4. **The answer** appears in a subtle overlay in the bottom-right.

5. **Click** anywhere or **press any key** to dismiss the overlay at any time.

Press **Esc** during selection to cancel without sending.
