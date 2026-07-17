# Santiya Pixel Agents Desktop

Santiya Pixel Agents Desktop is a Windows desktop app that turns live Codex threads into a shared pixel-office workspace.

The app presents active threads as office workers inside a live office scene, supports multiple office presets, includes a built-in office editor, and allows importing layouts plus adding custom character and furniture asset packs.

## Highlights

- Live office view for active Codex threads
- Office presets with a shared command-center workflow
- Built-in office editor
- Import and export for office layouts
- External asset-pack support for characters and furniture
- Packaged Windows installer release

## Repository Layout

- `app-runtime/` — packaged app runtime code used by the desktop build
- `installer/` — Inno Setup installer scripts
- `screenshots/` — release screenshots for the GitHub page

## Screenshots

### Main Office

![Main office](screenshots/01-main-office.png)

### Settings

![Settings](screenshots/02-settings.png)

### Office Preset 2

![Office preset 2](screenshots/03-office-2.png)

## Release

The tested Windows installer for the current release is:

- `Pixel Agents Desktop Setup 0.1.2.exe`
- SHA256: `7D4BECFAA8129DEB5FBCADF9567769C4A656005A5F803CF113BB9302D6223708`

The installer should be uploaded to GitHub Releases as a release asset rather than committed into the repository history.

## Version 0.1.2

Version `0.1.2` includes:

- verified installer rebuild after a broken `0.1.1` artifact
- stricter installer build validation
- safer external asset path handling
- office layout storage hardening
- validated office import/export flows
- tested external asset-pack support

<!-- SANTIYA_SUPPORT_START -->
## Support / Поддержать проект

If this project has been useful to you, thank you for supporting it. Your help
gives me time to keep improving it, fixing rough edges, and shipping updates.
Please take a moment to double-check the network before sending funds.

Wallets / Кошельки:

- Bitcoin (BTC, Bitcoin network): `bc1qhft9dxkn0g07zm9ht8zrfqyrh85djhueu4q49k`
- Ethereum (ETH, Ethereum network): `0x5311B0318A24F63196A572b447609bc336A4C7b2`
- Solana (SOL, Solana network): `9i76uPGouNh8KVB8LtippfFY7p6kG2ZSLbtLwPqb6i76`
- USDT (Tether, Solana/SPL network): `9i76uPGouNh8KVB8LtippfFY7p6kG2ZSLbtLwPqb6i76`
<!-- SANTIYA_SUPPORT_END -->
