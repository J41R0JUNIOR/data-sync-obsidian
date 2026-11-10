# Vault Cloud Sync

Sync remote files into your Obsidian vault.

## Overview

- Import files from cloud providers into Obsidian.
- Keep the plugin architecture ready for future providers.
- Use a simple modal-based sync flow.
- Select the Google Drive folder containing the remote vault before syncing.

## Current status

- Google Drive support is implemented.
- Files are downloaded and imported in an overlapping, bounded pipeline, preserving folder structure and skipping files that already exist.
- The project is designed to support OneDrive, Dropbox, and other providers later.

## Setup

1. Install the plugin in Obsidian.
2. Run `npm install`.
3. Start development with `npm run dev`.
4. Authorize with Google, then choose the Google Drive folder containing the vault. The authorization requires read access to Drive files; reauthorize existing connections after upgrading.
5. Use **Sync now** to start syncing from the selected folder.

## Notes

This version focuses on one-way sync from the remote provider to the local vault. Bidirectional sync will be added in a later phase.
