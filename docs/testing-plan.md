# Testing Plan

This document outlines how we intend to test CodeCap.  Automated unit and integration tests are complemented by manual exploratory testing to ensure that the MVP meets its acceptance criteria.

## Unit Tests

Unit tests live in the `src/tests` directory and are executed with your preferred test runner (e.g. [vitest](https://vitest.dev/) or Mocha).  Key areas covered by unit tests include:

* **Database repositories:** CRUD operations for Snippets, Tags, Shares and Comments.
* **AI client:** handling of success and error responses; caching logic.
* **Capture service:** conversion of captured images into cropped buffers; coordinate translation across DPI settings.
* **OCR service:** proper invocation of Tesseract.js workers; correct language selection; fallback behaviour.

## Integration Tests

Integration tests verify that multiple components work together.  They include:

* **Capture flow:** simulate a user initiating a capture, drawing a selection and receiving extracted text.  Test cancellation with the escape key.
* **Database persistence:** save a capture, restart the app and verify that it appears in the Codes list.
* **Sharing:** invite a collaborator and confirm that the shared item appears on the recipient’s side with appropriate permissions.

## Manual Testing

In addition to automated tests, we recommend performing manual tests on all supported operating systems.  Key scenarios:

* Launch the app, ensure tray icon appears and clickable emblem toggles the toolbar.
* Execute the capture hotkey on single and multi‑monitor setups.  Verify that coordinates are accurate and text is extracted correctly.
* Use the Codes list to search, filter and copy snippets to the clipboard.
* Adjust settings for hotkeys, OCR languages and AI provider.  Verify that changes persist across restarts.
* Test permission flows for screen recording and file system access.

## Continuous Integration

Although not configured in the MVP, the recommended CI setup runs unit and integration tests on each commit and builds the app for all target platforms.  Packaging and signing steps should be run in a secure environment with the appropriate certificates and credentials.