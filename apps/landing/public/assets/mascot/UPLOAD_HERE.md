# Mascot Asset Upload Folder

Drop your mascot image files here. The landing page will automatically pick them up on the next save/reload.

## Required Files

| Filename | Used In | Description |
|---|---|---|
| `mascot-wave.png` | Hero section | Hamster waving — the main hero image |
| `mascot-idle.png` | How It Works step 1 | Hamster idle/neutral pose |
| `mascot-study.png` | How It Works step 2 | Hamster reading or studying |
| `mascot-celebrate.png` | How It Works step 3 | Hamster celebrating / jumping for joy |
| `mascot-briefcase.png` | CTA Banner | Hamster holding a briefcase |

## Tips

- **Format:** PNG with transparent background works best (WebP also fine).
- **Size:** Aim for at least 400×400 px so it looks sharp on retina displays.
- **Name must match exactly** (lowercase, hyphen-separated, `.png` extension).
- If a file is missing, the page shows a friendly `🐹` placeholder — no crash.

## Lottie Animations (Optional)

If you have a Lottie JSON animation for the mascot (exported from After Effects or Figma):

1. Place the `.json` file in `animations/mascot-idle.json`
2. The `MascotImage` component will need to be updated to use `lottie-react` for that slot.
