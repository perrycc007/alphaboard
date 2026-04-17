from __future__ import annotations

import asyncio
from pathlib import Path

import plotly.graph_objects as go


async def _render_html_to_png(html_path: Path, png_path: Path, wait_ms: int = 2000, selector: str = ".plotly-graph-div") -> None:
    from playwright.async_api import async_playwright

    async with async_playwright() as playwright:
        browser = await playwright.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1200, "height": 700})
        page = await context.new_page()
        try:
            await page.goto(html_path.as_uri(), wait_until="networkidle")
            await page.wait_for_timeout(wait_ms)
            chart = page.locator(selector)
            if await chart.count() == 0:
                raise RuntimeError(f"selector not found: {selector}")
            await chart.first.screenshot(path=str(png_path))
        finally:
            await page.close()
            await context.close()
            await browser.close()


def export_figure(fig: go.Figure, png_path: Path, scale: int = 2) -> tuple[Path, str]:
    png_path.parent.mkdir(parents=True, exist_ok=True)
    try:
        fig.write_image(str(png_path), width=1100, height=540, scale=scale)
        return png_path, "png"
    except Exception:
        html_path = png_path.with_suffix(".html")
        fig.write_html(str(html_path), include_plotlyjs="cdn")
        try:
            asyncio.run(_render_html_to_png(html_path, png_path))
            return png_path, "png"
        except Exception:
            return html_path, "html"
