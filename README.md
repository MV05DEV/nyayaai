This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Conversation cleanup safety

Conversation deletion and clear-all endpoints are restricted to development mode and same-origin loopback requests. This prototype has no authenticated user-scoping mechanism; the cleanup endpoints must not be enabled or exposed in a public deployment. Before public use, implement authentication and ensure every case lookup and delete is scoped to the authenticated user.

## OpenRouter chat models

The default primary is `nvidia/nemotron-3-ultra-550b-a55b:free` and the one-retry fallback is `google/gemma-4-31b-it:free`. OpenRouter currently lists both as free text-chat variants with text output and supports them through its OpenAI-compatible Chat Completions API. The fallback model page reported 100% uptime over the preceding three days when this configuration was checked. Free endpoints can still be rate limited or temporarily unavailable. To verify a model before changing these values, use OpenRouter's [free model catalog](https://openrouter.ai/collections/free-models), open its model page, and confirm the exact model ID, **Free** pricing, text input/output modalities, and Chat Completions support. Check the model's current availability/uptime and rate-limit information as well; listings and free routing can change.

`AI_MODEL` and `AI_FALLBACK_MODEL` can be overridden in `.env`. `openrouter/free` is a dynamic router: it selects a free model per request, so the actual model, response behavior and availability can vary from call to call. The application defaults to fixed model variants to make response behavior more predictable.

Current checked model pages: [nemotron-3-ultra-550b-a55b:free([https://openrouter.ai/google/gemma-4-26b-a4b-it:free](https://openrouter.ai/nvidia/nemotron-3-ultra-550b-a55b:free#providers)) and [Gemma 4 31B free](https://openrouter.ai/google/gemma-4-31b-it:free). Each showed $0 input and output pricing and text input/output at verification time. Free listings, provider availability, pricing and rate limits can change; recheck the catalog before relying on them.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
