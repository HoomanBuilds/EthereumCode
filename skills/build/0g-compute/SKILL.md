---
name: 0g-compute
description: 0G Compute integration for AI inference with OpenAI-compatible API. Use when swapping Anthropic/OpenAI for 0G Compute, or when building agents that run inference on decentralized compute nodes.
---

# 0G Compute

0G Compute provides decentralized AI inference through an OpenAI-compatible API. It's the drop-in replacement for Anthropic or OpenAI when you want decentralized compute.

## Network Configuration

| Network | Chain ID | RPC |
|---------|----------|-----|
| Mainnet | 16661 | `https://evmrpc.0g.ai` |
| Testnet | 16602 | `https://evmrpc-testnet.0g.ai` |

## Compute Router

The **0G Compute Router** is recommended for most applications. It provides a single OpenAI-compatible endpoint with a unified balance across models.

```typescript
import OpenAI from "openai";

const openai = new OpenAI({
  baseURL: "https://compute-router.0g.ai/v1",
  apiKey: process.env.ZEROG_COMPUTE_API_KEY,
});

const response = await openai.chat.completions.create({
  model: "gpt-4", // or other available models
  messages: [{ role: "user", content: "Hello from 0G!" }],
});
```

## Available Models

Check the 0G Compute Router for the current list of available models. The router abstracts model availability — you specify the model name and the router routes to an available provider.

## Integration with Agent Framework

### Replacing Anthropic

```typescript
// Before: Anthropic
import { Anthropic } from "@anthropic-ai/sdk";
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const response = await anthropic.messages.create({
  model: "claude-sonnet-4-20250514",
  messages: [{ role: "user", content: prompt }],
});

// After: 0G Compute
import OpenAI from "openai";
const openai = new OpenAI({
  baseURL: "https://compute-router.0g.ai/v1",
  apiKey: process.env.ZEROG_COMPUTE_API_KEY,
});
const response = await openai.chat.completions.create({
  model: "gpt-4",
  messages: [{ role: "user", content: prompt }],
});
```

### Streaming

```typescript
const stream = await openai.chat.completions.create({
  model: "gpt-4",
  messages: [{ role: "user", content: prompt }],
  stream: true,
});

for await (const chunk of stream) {
  const content = chunk.choices[0]?.delta?.content || "";
  process.stdout.write(content);
}
```

## Cost Considerations

0G Compute pricing is determined by the model and compute provider. Check the router for current pricing. Generally, decentralized compute can be more cost-effective than centralized providers.

## Error Handling

```typescript
try {
  const response = await openai.chat.completions.create({
    model: "gpt-4",
    messages: [{ role: "user", content: prompt }],
  });
} catch (err) {
  if (err.status === 429) {
    // Rate limited — implement backoff
  } else if (err.status === 503) {
    // Service unavailable — retry with different model or wait
  }
}
```

## Security

- Never hardcode API keys
- Use environment variables for `ZEROG_COMPUTE_API_KEY`
- Validate all model outputs before using them in contracts
- The compute layer is decentralized — outputs may vary between providers

## Common Pitfalls

- **Model availability:** not all models are always available — implement fallback logic
- **Response format:** responses follow OpenAI format, not Anthropic format — adjust parsing accordingly
- **Rate limits:** check current rate limits for your API key
- **Latency:** decentralized compute may have higher latency than centralized providers — implement timeouts
