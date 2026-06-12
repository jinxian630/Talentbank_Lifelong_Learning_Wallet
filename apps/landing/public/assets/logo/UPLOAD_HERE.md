# Logo Asset Upload Folder

Drop your logo files here.

## Required Files

| Filename | Used In | Description |
|---|---|---|
| `logo-icon.svg` | Navbar, Footer | Small mascot icon only (no text), square |
| `logo-full.svg` | Navbar (optional) | Full logo with mascot + "XP Career Wallet" text |

## Tips

- **SVG preferred** — scales perfectly at any size with no blur.
- If you only have a PNG, rename it `logo-icon.png` and update the `src` prop in `Navbar.tsx` and `Footer.tsx` accordingly.
- The navbar displays the icon at 40×40 px; the full logo at up to 160 px wide.
