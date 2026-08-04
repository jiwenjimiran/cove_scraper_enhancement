# Changelog

## 1.1.0 - 2026-08-04

- Fix settings loading when Cove returns a null settings payload.
- Add optional exponential retry backoff for HTTP 429 scraper failures.
- Add a configurable maximum backoff, defaulting to 120 seconds.
- Match the Duplicate Manager settings-save button.

## 1.0.2 - 2026-08-04

- Reduce Save All to the same 24px height as Scrape All.

## 1.0.1 - 2026-08-04

- Match Cove's native Scrape All and Save button utility classes.
- Add the native cloud-download and check icons.
- Preserve button icons while showing running-state labels.

## 1.0.0 - 2026-08-04

- Add a rate-limited replacement for Video Tagger's **Scrape All** action.
- Add a green **Save All** action for saving selected scraper matches.
- Add configurable batch size and inter-batch pause settings (both default to 5).
