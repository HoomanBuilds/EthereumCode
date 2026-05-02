# Mobile, In-Wallet Browsers, and PWA QA

The single biggest gap between "works on desktop with MetaMask extension" and "works in production" is mobile. Most onchain users come from a wallet's in-app browser or via WalletConnect, and most apps haven't been tested in those conditions. This file is the mobile QA pass.

For the full QA checklist, see `SKILL.md`. For error handling, see `references/error-handling-and-toasts.md`. For post-launch monitoring, see `references/post-launch-monitoring.md`.

## The two mobile contexts

```
Mobile Web Context A: Browser + WalletConnect
  - User opens https://yourapp.com in Safari/Chrome
  - Connects via WalletConnect QR or deep link
  - Each tx requires switching to wallet app
  - window.ethereum is undefined

Mobile Web Context B: Wallet's in-app browser
  - User opens yourapp.com from inside MetaMask / Rainbow / Coinbase Wallet
  - window.ethereum is injected by the wallet
  - No app-switching needed
  - Different wallet = different bugs
```

Both contexts must work. The WalletConnect path has the deep-link complexity; the in-app browser path has injection-quirks.

## Detecting which context

```ts
const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
const isInWalletBrowser = !!window.ethereum;
const usingWalletConnect = isMobile && !isInWalletBrowser && !!localStorage.getItem("wc@2:client:0.3//session");
```

Use this to gate behavior:

```ts
// Skip deep link if in-wallet (already in the wallet)
if (isInWalletBrowser) return;

// Adjust UX hints
if (usingWalletConnect) showHint("After signing, switch back to this tab");
```

## WalletConnect deep-link pattern

The full pattern is in `SKILL.md`. The summary:

1. **Fire the transaction first** — don't navigate away before `writeContractAsync` is called
2. **Wait ~2 seconds** — the WalletConnect relay takes time to push the request
3. **Then deep link** — switch to the wallet app
4. **Detect the wallet** by walking connector ID, name, AND the WC session storage

```ts
const writeAndOpen = async <T>(writeFn: () => Promise<T>): Promise<T> => {
  const promise = writeFn();
  setTimeout(openWallet, 2000);
  return promise;
};
```

Verify EVERY write call in your app uses this pattern. Approve, action, claim, batch — all of them.

## Wallet detection

`connector.id` is `"walletConnect"` regardless of which wallet. To know which to deep-link to:

```ts
function detectWallet(): string | null {
  const candidates = [
    connector?.id,
    connector?.name,
    localStorage.getItem("wagmi.recentConnectorId"),
  ].filter(Boolean).join(" ").toLowerCase();

  // WalletConnect session storage holds the actual wallet name
  let wcWallet = "";
  try {
    const wcKey = Object.keys(localStorage).find(k => k.startsWith("wc@2:client"));
    if (wcKey) wcWallet = (localStorage.getItem(wcKey) || "").toLowerCase();
  } catch {}

  const search = `${candidates} ${wcWallet}`;

  if (search.includes("rainbow")) return "rainbow://";
  if (search.includes("metamask")) return "metamask://";
  if (search.includes("coinbase") || search.includes("cbwallet")) return "cbwallet://";
  if (search.includes("trust")) return "trust://";
  if (search.includes("phantom")) return "phantom://";
  return null;
}
```

Use simple scheme URLs (`rainbow://`) — schemes with paths (`rainbow://dapp/...`) often reload the wallet's webview and cause the user to lose state.

## Viewport and meta tags

Mobile rendering goes wrong without the right viewport setup:

```html
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="theme-color" content="#000000" />
```

In Next.js App Router:

```tsx
export const metadata: Metadata = {
  themeColor: "#000000",
  viewport: "width=device-width, initial-scale=1, viewport-fit=cover",
};
```

`viewport-fit=cover` is required for iPhone notch/island handling.

## Safe-area insets

iPhone X+ has a notch. Without safe-area handling, your bottom nav bar gets hidden by the home indicator:

```css
.bottom-nav {
  padding-bottom: env(safe-area-inset-bottom);
}

.app-shell {
  padding-top: env(safe-area-inset-top);
  padding-bottom: env(safe-area-inset-bottom);
}
```

Tailwind has built-in support: `pt-safe`, `pb-safe`, `pl-safe`, `pr-safe` (via `tailwindcss-safe-area` plugin).

## Touch target sizes

Apple HIG: minimum 44×44pt. Material Design: 48×48dp. Default `<button class="btn btn-sm">` in DaisyUI is too small for thumbs:

| Class | Approx height | Mobile-OK? |
|---|---|---|
| `btn-xs` | 24px | No |
| `btn-sm` | 32px | No |
| `btn` (default) | 48px | Yes |
| `btn-lg` | 64px | Yes |

For primary CTAs on mobile screens, use at least default `btn` size.

## Input field UX

```html
<!-- For numeric input — avoids the alphabet keyboard -->
<input type="number" inputmode="decimal" pattern="[0-9]*\.?[0-9]*" />

<!-- For ETH amounts — prevent the autocorrect catastrophe -->
<input type="text" inputmode="decimal" autoComplete="off" autoCorrect="off" spellCheck={false} />

<!-- For addresses (use AddressInput component instead) -->
<input type="text" inputmode="text" autoComplete="off" autoCorrect="off" spellCheck={false} />
```

Without `inputmode="decimal"`, iOS shows the alphabet keyboard, which is wrong for amount inputs.

## Connect modal on mobile

RainbowKit's modal works on mobile but defaults are not always great:

- **Too many wallets**: the list of "Other Wallets" is long; cap or filter
- **No QR code on mobile**: don't show a QR if the user is already on mobile (they'd need a second device)
- **Wallet detection**: RainbowKit shows a special row if the wallet is installed; verify this works for Phantom (often missing from default config)

```ts
import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import {
  metaMaskWallet,
  rainbowWallet,
  coinbaseWallet,
  walletConnectWallet,
  phantomWallet,
  trustWallet,
} from "@rainbow-me/rainbowkit/wallets";

const connectors = connectorsForWallets(
  [
    {
      groupName: "Recommended",
      wallets: [metaMaskWallet, rainbowWallet, coinbaseWallet, phantomWallet, walletConnectWallet],
    },
    {
      groupName: "Others",
      wallets: [trustWallet],
    },
  ],
  { appName: "YourApp", projectId: WC_PROJECT_ID }
);
```

## In-wallet browser quirks

| Wallet | Quirk |
|---|---|
| MetaMask Mobile | Aggressive popup blocking; opening external links breaks flow |
| Rainbow | Only some wallet schemes work for redirects |
| Coinbase Wallet | `window.ethereum.isCoinbaseWallet` true; some hooks behave differently |
| Trust Wallet | Slower injection; `window.ethereum` may not be ready on first render |
| Phantom (mobile) | Different EVM support than desktop; verify chain support |

Test in each. The QA pass is "open the live URL in each wallet's in-app browser; complete the flow."

## PWA support (optional but valuable)

Adding a Web App Manifest lets users "Add to Home Screen" and use the app like native:

```json
{
  "name": "YourApp",
  "short_name": "YA",
  "icons": [
    { "src": "/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ],
  "theme_color": "#000000",
  "background_color": "#ffffff",
  "display": "standalone",
  "start_url": "/"
}
```

Caveats for Web3:
- Service workers + WalletConnect can interfere; test thoroughly
- "standalone" PWAs don't deep-link to other apps as easily
- iOS Safari PWAs are second-class citizens; accept the limitations

If your users will spend time in the app daily, PWA is worth it. If it's a one-off claim/swap flow, skip it.

## OG previews on mobile

When users share your link in Telegram, Twitter, iMessage, the unfurl uses Open Graph tags:

```tsx
export const metadata: Metadata = {
  title: "YourApp",
  description: "What it does in one sentence",
  openGraph: {
    title: "YourApp",
    description: "What it does in one sentence",
    images: ["https://yourapp.com/og-image.png"], // ABSOLUTE URL
    url: "https://yourapp.com",
    siteName: "YourApp",
  },
  twitter: {
    card: "summary_large_image",
    title: "YourApp",
    description: "What it does in one sentence",
    images: ["https://yourapp.com/og-image.png"],
  },
};
```

Test the unfurl by sharing the URL to yourself in Telegram or Twitter. If it doesn't render the image, the URL is wrong (must be absolute, must be HTTPS, must be reachable from public internet).

## Performance budget for mobile

| Metric | Target | Why |
|---|---|---|
| Time to Interactive (3G) | < 5s | Web3 users on flaky networks |
| LCP | < 2.5s | Above-fold content quickly |
| First wallet connection prompt | < 1s after click | If it's slow, user thinks it's broken |
| Bundle size (gzipped) | < 250 KB | Mobile data usage matters |

Run Lighthouse with mobile preset. SE2 default builds often miss this — Wagmi + ethers / viem + RainbowKit is heavy. Tree-shake what you can.

```bash
yarn next build
yarn next-bundle-analyzer  # see what's bloating
```

## Mobile-specific failure modes

- **App switching loses TX** — user signs in wallet, switches back, the tab was unloaded. Use `localStorage` to persist in-flight TX state.
- **Page reload after sign** — some wallets reload the dapp page after redirect. Persist user input in `localStorage` so reloads don't lose form state.
- **Fixed positioning + virtual keyboard** — `position: fixed` elements break when the keyboard opens on iOS. Test inputs near footers.
- **Pull-to-refresh** — accidentally refreshing mid-tx is destructive. Add `overscroll-behavior: none` on the body if the app is full-screen.
- **Address copy from explorer** — users frequently paste addresses from explorer apps; ensure `<AddressInput>` handles trailing whitespace and case differences.

## Mobile QA checklist

- [ ] Page loads on iOS Safari and Android Chrome
- [ ] Page loads in MetaMask, Rainbow, Coinbase, Trust in-app browsers
- [ ] Connect button visible without scrolling
- [ ] Wallet connection works via QR (desktop), deep link (mobile-to-mobile), and in-app browser injection
- [ ] Every write call uses `writeAndOpen` pattern (fire TX, wait, deep link)
- [ ] Wallet detection includes WC session storage, not just `connector.id`
- [ ] No deep link when `window.ethereum` exists
- [ ] Touch targets >= 44×44px for primary CTAs
- [ ] Numeric inputs use `inputmode="decimal"`
- [ ] No `position: fixed` elements break with virtual keyboard open
- [ ] Safe-area insets respected (notch, home indicator)
- [ ] Viewport meta tag includes `viewport-fit=cover`
- [ ] OG preview renders correctly when shared on Telegram / Twitter
- [ ] Lighthouse mobile score >= 80 for performance
- [ ] App tested with throttled 3G to surface blocking calls
- [ ] In-flight transaction state survives page reload
- [ ] No console errors in any of the 5 wallet in-app browsers

## Common mistakes

- **Testing on desktop only** — works for you, breaks for 60% of users
- **Skipping in-wallet browser test** — different injection behavior; surfaces bugs
- **Deep-linking before TX** — user lands in wallet with nothing to sign
- **Showing QR on mobile** — they need a second device; useless
- **Tiny touch targets** — `btn-sm` everywhere because it "looks cleaner" on desktop
- **No persistence** — page reload mid-flow loses everything
- **Fixed-position bottom bar over safe area** — gets hidden by home indicator
- **Default RainbowKit wallet list** — Phantom missing, key wallets buried under "Others"

## What to read next

- `SKILL.md` — full QA checklist (includes mobile sections)
- `references/error-handling-and-toasts.md` — error and toast discipline
- `references/post-launch-monitoring.md` — monitoring after launch
- RainbowKit docs: https://rainbowkit.com/docs
- viem mobile considerations: https://viem.sh
