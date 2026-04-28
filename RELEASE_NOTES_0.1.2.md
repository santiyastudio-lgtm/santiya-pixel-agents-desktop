# Release Notes — Santiya Pixel Agents Desktop 0.1.2

## Fixed

- Rebuilt the Windows installer after isolating a broken `0.1.1` build artifact
- Added hard failure checks to the installer build pipeline
- Stopped installer builds from passing with stale output files
- Disabled reuse of a previous custom install path by default
- Hardened dynamic asset request handling against malformed paths
- Hardened external asset path resolution
- Restricted direct file-path desktop API flows to explicit test mode only
- Fixed office layout persistence so preset keys are not migrated like thread keys
- Added layout validation before layouts are persisted and reused

## Verified

- Silent install completes successfully
- Installed `Pixel Agents Desktop.exe` launches successfully
- Runtime starts in `codexDesktopLive` mode
- Thread listing and thread-state endpoints respond correctly
- Office export and import work
- External asset directories can be added and removed
- External character and furniture catalogs update correctly

## Release Asset

- Filename: `Pixel Agents Desktop Setup 0.1.2.exe`
- SHA256: `7D4BECFAA8129DEB5FBCADF9567769C4A656005A5F803CF113BB9302D6223708`

## Known Limitations

- The installer is not code-signed, so Windows SmartScreen may still show a warning
- The loopback desktop API still needs a future auth/origin-binding pass
- Some packaged UI ergonomics still need refinement around labels and settings-entry duplication
