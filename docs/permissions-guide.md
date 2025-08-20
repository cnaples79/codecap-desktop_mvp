# Permissions Guide

CodeCap requires certain operating system permissions in order to function correctly.  These permissions are requested at runtime and you can change them later in your system settings.

## Screen Recording / Capture

* **Why we need it:** To capture text from any window, CodeCap must be able to record your screen.  When you start the first capture, macOS, Windows and some Linux distributions will prompt you to grant screen capture permission.
* **How it's used:** The permission is only used when you actively initiate a capture.  No continuous recording takes place.  You can opt out of storing the raw image after OCR in the Settings panel.
* **Where to manage:**
  - **macOS:** System Settings → Privacy & Security → Screen Recording → enable CodeCap.
  - **Windows:** Settings → Privacy → Screen recording or background apps → enable CodeCap.
  - **Linux:** Varies by distribution; check your desktop environment’s privacy settings.

## File System Access

* **Why we need it:** CodeCap stores your captures in a local SQLite database and optionally writes logs or raw images to disk.  On first launch, your operating system may ask if CodeCap can access your file system.
* **How it's used:** Files are stored within CodeCap’s application data directory.  No files are read or written outside this directory unless you export a capture manually.

## Notifications (Future)

In future versions, CodeCap may send you notifications when a shared capture is updated or when AI processing completes.  You will be asked to grant notification permission at that time.