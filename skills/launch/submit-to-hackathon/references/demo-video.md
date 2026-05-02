# Demo Video

The 90-second demo video is the most important piece of your hackathon submission. Judges watch this before they read your README or look at your code. This guide covers how to make one that works.

## The 90-Second Structure

```
0-10s    Hook: What is this, in one sentence
10-60s   Demo: Actual product working, one complete user flow
60-75s   Tech: How you used sponsor X / Y (if targeting sponsor prizes)
75-90s   Close: What's next + GitHub URL on screen
```

## Segment by Segment

### 0-10s: The Hook

**Goal:** Make the judge understand what they're about to see.

**Format:**
```
"[Product] helps [user] do [thing] [benefit]."

Examples:
"AutoVault auto-rebalances your stablecoin deposits across Aave, GMX,
and Camelot on Arbitrum — earning you the best yield without any effort."

"Nexus lets you send money to anyone with just their email address,
no wallet setup required, powered by Base's smart wallet infrastructure."
```

**Do:**
- One sentence
- Name the user
- Name the benefit
- Show the product UI on screen

**Don't:**
- "We built a decentralized..." (generic opener)
- Talk about the hackathon ("For ETHGlobal we built...")
- Explain the problem (save it for the written description)

### 10-60s: The Demo

**Goal:** Show the product working, end to end.

**Pick one flow.** Not three features. Not "here's what it can do." One complete user journey:

```
Good flows:
- Connect wallet → deposit → see balance → withdraw
- Create listing → buy item → confirm transfer
- Submit proposal → vote → see result

Bad flows:
- "Here's the landing page... and here's the dashboard... and here's..."
- Walking through every page without completing any action
- Showing code instead of the product
```

**Demo rules:**
- **Show the wallet connection.** Judges need to see it's a real dApp.
- **Show a transaction confirm.** The metamask/wallet popup.
- **Show the explorer link after the tx confirms.** Proves it's onchain.
- **No slides.** Screen recording of the actual product.
- **No editing tricks.** If the flow takes 60 seconds, speed it up in recording, not in post.
- **Cut silence and dead time.** If you're waiting for a tx to confirm, speed up that part.

### 60-75s: The Tech Mention

**Goal:** Show sponsor integration (if targeting sponsor prizes).

**Format:**
```
"We use [Sponsor] for [specific purpose]. Here's the integration:
[show the feature in action or the code briefly]"
```

**If not targeting sponsor prizes:** Skip this segment. Don't name-drop sponsors you didn't integrate.

### 75-90s: The Close

**Goal:** Leave the judge with your GitHub URL and a clear next step.

**Format:**
```
"[Product] is open-source at github.com/org/project.
We're building [next feature] next. Thanks for watching."

[Screen shows the GitHub URL large and clear]
```

## Recording Tools

| Tool | Platform | Cost | Notes |
|---|---|---|---|
| Screen Studio | Mac | $29 | Best output, auto-zooms on clicks |
| Loom | Web | Free tier | Fastest, good enough |
| OBS | All | Free | Most control, steepest learning curve |
| QuickTime | Mac | Free | Built-in, basic but works |

## Recording Setup

**Before recording:**
1. **Clean your browser.** No random tabs, no personal bookmarks visible.
2. **Use a clean wallet.** Not your main wallet with real funds. A test wallet with testnet ETH.
3. **Close notifications.** Turn off Slack, Discord, email. Nothing should pop up during recording.
4. **Test the flow first.** Run through it once before hitting record.
5. **Use a good microphone.** Laptop mic sounds amateur. A $30 USB mic is enough.

**During recording:**
- **Speak slower than you think.** Judges may not be native English speakers.
- **Don't apologize for bugs.** If something breaks, re-record.
- **Pause between sections.** You can cut silence later, but you can't add it.
- **Show the full URL bar.** Judges need to see it's a live deployment, not localhost.

## Post-Production

**What to cut:**
- All dead time and silence
- Loading states longer than 2 seconds (speed them up)
- Mistakes (re-record that section)
- Any "um," "uh," or "let me try again"

**What to add:**
- Simple text overlays for key numbers or addresses
- A title card at the start with the product name
- The GitHub URL at the end

**What NOT to add:**
- Background music (distracting, makes it feel like marketing)
- Fancy transitions (judges care about the product, not your editing skills)
- Voice effects or filters
- Logos everywhere

## Common Demo Video Failures

| Failure | Why it's bad | Fix |
|---|---|---|
| 4 minutes long | Judges stop watching at 90s | Cut ruthlessly |
| Shows slides | Not a real product | Record the actual product |
| No wallet popup | Could be a mockup | Show the signing flow |
| Localhost URL | Not deployed | Deploy to Vercel |
- No audio | Judges can't understand context | Add voiceover |
- Too quiet to hear | Same as no audio | Use a mic, check levels |
- Shows code for 30 seconds | Judges want to see the product | Show code for 5 seconds max |
- No GitHub URL at end | Judges can't find the repo | Add it as the final frame |
- Explains the problem for 60 seconds | Save it for the written description | Start with the product |

## The Backup Plan

Always have a backup recording. If the live demo breaks during a pitch:

1. **Record the video first.** This is your primary demo for judges who review asynchronously.
2. **Have the video ready to play** during any live presentation.
3. **Narrate over the video** during live pitches. It's more reliable than live demos.
