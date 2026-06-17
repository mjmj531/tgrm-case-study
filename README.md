# TGRM Case Study Demo

## File Layout

Keep the exported JSON and copied image folder in the project root:

```text
ROMA_comb_user_demo/
  case_study_export_wtime.json
  case_study_images/
    B000XXXXXX.jpg
  case_study_demo/
    index.html
    styles.css
    app.js
```

The page reads `../case_study_export_wtime.json` by default. Each item image is loaded from `image_path` first, then falls back to `image_url`.

## Preview

From the project root:

```bash
python3 -m http.server 8765
```

Then open:

```text
http://localhost:8765/case_study_demo/index.html
```

If the JSON is stored elsewhere, use the `Load JSON` button. Local image paths work best when the JSON and image folder stay together in the project root.
