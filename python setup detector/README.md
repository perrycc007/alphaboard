# Python Setup Detector

This folder extracts the Python setup-detection logic out of `notebooks/setup_detectors.ipynb` into a small package with:

- shared indicator, swing, and base helpers
- one detector module per setup
- one runner that fetches data, detects setups, and exports review PNGs plus `manifest.json`

## Main Command

From the repo root:

```powershell
py -3 ".\python setup detector\run_review.py" --fast
```

Full run with the default ticker basket:

```powershell
py -3 ".\python setup detector\run_review.py"
```

Target specific tickers:

```powershell
py -3 ".\python setup detector\run_review.py" --tickers ANET,ENPH,AI --rule-version python_v1
```

## Output

By default the runner writes review artifacts to:

`artifacts/setup_review/<rule-version>/`

It produces:

- PNG review charts when direct image export or Playwright fallback succeeds
- HTML chart files when PNG rendering is unavailable
- `manifest.json`
- `skipped.log`

## Dependencies

Recommended:

```powershell
py -3 -m pip install -r ".\python setup detector\requirements.txt"
py -3 -m playwright install chromium
```

`kaleido` is the fastest PNG path. If `kaleido` is unavailable, the runner falls back to HTML export and will try to screenshot the HTML with Playwright.
