#!/usr/bin/env python3
"""Playwright WebKit interaction test for the Deadline Widget UI.

Requires (started externally):
  - backend API on 127.0.0.1:8766 with DEADLINE_FIXTURES=<project>/backend/data/fixtures-ui
    and a FRESH db (rm backend/data/*.db* before first sync)
  - vite dev server on http://localhost:5199
Run: <gcash venv python> ui_test.py
"""
import sys
from playwright.sync_api import sync_playwright

BASE = 'http://localhost:5199'
failures = []

def check(name, cond, extra=''):
    tag = 'PASS' if cond else 'FAIL'
    print(f'[{tag}] {name} {extra}')
    if not cond:
        failures.append(name)

with sync_playwright() as p:
    browser = p.webkit.launch()
    page = browser.new_page(viewport={'width': 384, 'height': 640}, device_scale_factor=2)
    page.goto(BASE)

    # --- initial load: cards + sync happened? (assume a sync was triggered by test harness)
    try:
        page.wait_for_selector('.card', timeout=20000)
    except Exception:
        # maybe empty state; trigger sync via the toggle
        page.locator('.sync-toggle').click()
        page.wait_for_selector('.card', timeout=30000)
    page.wait_for_timeout(700)

    total_pages = len(page.locator('.page-indicator').inner_text().split('/')) == 2
    check('page indicator shows n/m', total_pages, page.locator('.page-indicator').inner_text())

    n1 = page.locator('.card').count()
    check('page 1 has 4 cards', n1 == 4, f'got {n1}')
    page.screenshot(path='/tmp/dw-test-page1.png')

    ind_text = page.locator('.page-indicator').inner_text()
    check('indicator is 1/2', ind_text == '1/2', ind_text)

    # --- paginate to page 2
    page.locator('.page-next').click()
    page.wait_for_timeout(600)
    n2 = page.locator('.card').count()
    check('page 2 has 4 cards', n2 == 4, f'got {n2}')
    check('indicator now 2/2', page.locator('.page-indicator').inner_text() == '2/2',
          page.locator('.page-indicator').inner_text())
    page.screenshot(path='/tmp/dw-test-page2.png')

    # --- back to page 1
    page.locator('.page-prev').click()
    page.wait_for_timeout(600)

    # --- check a card: strikethrough -> removal -> toast with UNDO
    first_subject = page.locator('.card .card-subject').first.inner_text()
    page.locator('.card .card-check').first.click()
    page.wait_for_timeout(250)
    page.screenshot(path='/tmp/dw-test-struck.png')
    page.wait_for_timeout(500)  # removal after strikethrough
    check('card removed after check', page.locator('.card').count() == n1,
          f'page reflowed to {page.locator(".card").count()}')
    visible = [page.locator('.card .card-subject').nth(i).inner_text() for i in range(page.locator('.card').count())]
    check('checked card gone from list', first_subject not in visible)
    check('toast visible', page.locator('.toast').count() == 1)
    check('toast has UNDO', page.locator('.toast-undo').count() == 1,
          page.locator('.toast .toast-msg').inner_text())
    page.screenshot(path='/tmp/dw-test-toast.png')

    # --- undo restores it
    page.locator('.toast-undo').click()
    page.wait_for_timeout(700)
    check('card restored after undo', page.locator('.card').count() == n1)
    subjects = [page.locator('.card .card-subject').nth(i).inner_text() for i in range(page.locator('.card').count())]
    check('restored card is the same', first_subject in subjects)

    # --- sync button: toast feedback
    page.locator('.sync-toggle').click()
    page.wait_for_timeout(2500)
    toast_msg = page.locator('.toast .toast-msg').inner_text() if page.locator('.toast').count() else '(none)'
    check('sync toast appeared', 'SYNC' in toast_msg or 'NO NEW' in toast_msg, toast_msg)
    page.screenshot(path='/tmp/dw-test-synced.png')

    # --- pagination still works after undo
    page.locator('.page-next').click()
    page.wait_for_timeout(600)
    check('pagination after undo', page.locator('.page-indicator').inner_text() == '2/2',
          page.locator('.page-indicator').inner_text())
    page.locator('.page-prev').click()
    page.wait_for_timeout(600)

    browser.close()

print()
if failures:
    print(f'RESULT: {len(failures)} FAILURES -> {failures}')
    sys.exit(1)
print('RESULT: ALL UI TESTS PASSED')
