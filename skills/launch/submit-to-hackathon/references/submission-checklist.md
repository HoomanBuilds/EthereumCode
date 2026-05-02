# Submission Checklist

The complete pre-submission checklist for ETHGlobal, ETHIndia, ETHDenver, and similar hackathons. Run this 2 hours before the deadline.

## Before You Submit

### Repository
- [ ] **Public repo.** Not private. Judges can't access private repos.
- [ ] **README at the top.** Follows the structure in `submit-to-hackathon/SKILL.md`.
- [ ] **Deployed contract addresses** in the README. With explorer links.
- [ ] **Contracts verified** on the chain explorer.
- [ ] **`.env.example`** included. No `.env` committed.
- [ ] **One-line "how to run"** in the README. No judge will install 12 dependencies.
- [ ] **No hardcoded private keys or API keys.** Scan with `git log -p` for leaked secrets.

### Deployed Demo
- [ ] **Live URL** that works (not localhost). Vercel, Netlify, Railway, etc.
- [ ] **Deployed on the prize chain** (Base Sepolia, Arbitrum Sepolia, etc.).
- [ ] **Contracts are funded** if they need ETH for gas.
- [ ] **Demo flow works end-to-end** on the live deployment.
- [ ] **Test with a fresh wallet** to verify the full flow works for a new user.

### Demo Video
- [ ] **90 seconds or less.** Hard limit.
- [ ] **Shows product working.** Not slides, not Figma mockups.
- [ ] **Audio is clear.** Microphone, no background noise.
- [ ] **Plays without editing required.** Upload the final file.
- [ ] **Includes sponsor mentions** if you're targeting sponsor prizes.

### Submission Form
- [ ] **Title** is short and memorable (not "DeFi App" or "Our Project").
- [ ] **Description** is 200-400 words. Covers problem, solution, how it works.
- [ ] **Tags selected.** Pick the right prize tracks.
- [ ] **Sponsor selections match actual integrations.** Don't claim to use a sponsor's tech if you didn't integrate it.
- [ ] **Team members listed.** Everyone who contributed.
- [ ] **Demo video URL** pasted and tested (open it in an incognito window).
- [ ] **Live URL** pasted and tested.
- [ ] **GitHub URL** pasted and verified (public, correct repo).

### Sponsor Prizes
- [ ] **Each sponsor prize you select** has a corresponding integration in your code.
- [ ] **You mention each sponsor** in the README.
- [ ] **Your demo video shows** the sponsor integration in action.
- [ ] **You link to the specific file** where the sponsor's SDK is used.

### Final Sanity Checks
- [ ] **Open your submission in an incognito browser.** This is what judges see.
- [ ] **Ask someone who didn't build it** to read the README. Can they explain what the project does in one sentence?
- [ ] **Check the deadline timezone.** Many hackers miss deadlines because of timezone confusion.
- [ ] **Submit 30 minutes before the deadline.** Platforms crash at deadline time.

## Post-Submission
- [ ] **Share the submission** on Farcaster/Twitter with the event hashtag.
- [ ] **Reply to sponsor announcements** about prize tracks with your project.
- [ ] **Prepare for judging questions.** Know your codebase well enough to explain any part.
- [ ] **If you advance to live pitch:** prepare a 3-minute version of your demo.

## Common Disqualification Reasons

| Reason | How it happens | Prevention |
|---|---|---|
| Submitted after deadline | Timezone confusion | Check timezone, submit early |
| Private repo | Forgot to make it public | Verify repo is public before submitting |
| Demo doesn't work | Tested on localhost only | Test on live deployment |
| Sponsor prize without integration | Selected every prize | Only select prizes you actually integrated |
| Plagiarism | Copied another team's code | Write your own; cite any libraries used |
| Team size violation | Too many members | Check the event's team size limit |
