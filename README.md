# Lance Triage API

This is the private backend for the Arceology Lance chat room.

## Vercel setup

1. Create a new Vercel project from this folder.
2. Add this environment variable:

```text
OPENAI_API_KEY=your_openai_key_here
```

Optional:

```text
OPENAI_MODEL=gpt-4.1-mini
```

3. Deploy.
4. Copy the deployed URL, for example:

```text
https://lance-triage-api.vercel.app/api/chat
```

5. Put that URL into `triage.html` as `LANCE_API_URL`.

The browser should never contain your OpenAI API key.
