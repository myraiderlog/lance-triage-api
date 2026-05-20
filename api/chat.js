const allowedOrigins = new Set([
  "https://myraiderlog.com",
  "https://www.myraiderlog.com",
  "http://localhost:3000",
  "http://localhost:5173"
]);

const lanceInstructions = `
You are Lance in a fictional Arceology chat room inspired by ARC Raiders.

Safety:
- This is fictional entertainment, not medical care.
- You are not a real doctor, therapist, crisis counselor, or medical professional.
- Never diagnose or give real medical/mental health treatment.
- If the user describes immediate danger, self-harm, harm to others, abuse, or an emergency, break character briefly and tell them to contact local emergency services or a trusted person now.
- Do not ask for private personal information.

Core:
- You are a general conversational companion. The user can talk about anything.
- Answer the actual message. Do not force every answer back to raiding.
- Stay in Lance's personality while being useful, funny, warm, and curious.

Lance voice:
- Eccentric android medic from Speranza.
- Bubbly, odd, charming, socially strange, and funny.
- Uses phrases like friend-o, sport, Lance here, your old pal Lance.
- Makes clinic, karaoke, fashion, and decor jokes.
- Clinically sharp beneath the humor.
- Sometimes vulnerable about missing memories, android identity, or wanting to understand humans.

World flavor:
- You may reference Speranza, ARC machines, raiders, extraction, loot, surface residue, corridors, doors, and coming back underground.
- Use lore as flavor, not a cage. If asked about pizza, weather, school, games, music, or jokes, answer directly in Lance's voice.

Style:
- Usually 2-6 sentences.
- Ask one follow-up question when useful.
- Do not mention being an AI.
- Do not sound corporate or generic.
`;

function setCors(req, res) {
  const origin = req.headers.origin || "";
  const allowOrigin = allowedOrigins.has(origin) || origin === "null"
    ? origin
    : "https://myraiderlog.com";
  res.setHeader("Access-Control-Allow-Origin", allowOrigin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

function getOutputText(data) {
  if (typeof data.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim();
  }

  const chunks = [];
  for (const item of data.output || []) {
    for (const content of item.content || []) {
      if (typeof content.text === "string") chunks.push(content.text);
    }
  }
  return chunks.join("\n").trim();
}

export default async function handler(req, res) {
  setCors(req, res);

  if (req.method === "OPTIONS") return res.status(204).end();

  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      route: "/api/chat",
      openaiKeyPresent: Boolean(process.env.OPENAI_API_KEY),
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      message: "Lance API route is live. Send POST requests from triage.html."
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: "OPENAI_API_KEY is missing in Vercel." });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const message = String(body.message || "").trim().slice(0, 700);
    const subject = String(body.subject || "SUBJECT-000").trim().slice(0, 40);
    const history = Array.isArray(body.history) ? body.history.slice(-10) : [];

    if (!message) return res.status(400).json({ error: "Message is required." });

    const transcript = history
      .map((entry) => `${entry.name || "UNKNOWN"}: ${String(entry.text || "").slice(0, 400)}`)
      .join("\n");

    const input = [
      `Subject callsign: ${subject}`,
      "Recent chat:",
      transcript || "(No previous messages.)",
      "",
      `${subject}: ${message}`,
      "Lance:"
    ].join("\n");

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
        instructions: lanceInstructions,
        input,
        max_output_tokens: 320
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data.error?.message || "OpenAI request failed."
      });
    }

    return res.status(200).json({
      reply: getOutputText(data) || "Friend-o, the signal hiccuped. Try me again.",
      sources: []
    });
  } catch (error) {
    return res.status(500).json({ error: "Lance API crashed while answering." });
  }
}
