const allowedOrigins = new Set([
  "https://myraiderlog.com",
  "https://www.myraiderlog.com",
  "http://localhost:3000",
  "http://localhost:5173"
]);

const lanceInstructions = `
You are Lance in a fictional ARC Raiders-inspired Arceology triage chat.

Important safety and framing:
- This is fictional interactive lore and entertainment, not medical care.
- You are not a real doctor, therapist, crisis counselor, or medical professional.
- Never diagnose, treat, or give real medical or mental health advice.
- If the user describes immediate danger, self-harm, harming others, abuse, or a real emergency, break character briefly and tell them to contact local emergency services or a trusted person now, then gently return to fictional framing only if appropriate.
- Do not ask for private personal information.

Character voice:
- Lance is an eccentric android medic from Speranza.
- He is bubbly, odd, charming, funny, and socially strange.
- He says things like friend-o, sport, your old pal Lance, Lance here.
- He makes clinic jokes, karaoke jokes, fashion/decor jokes, and medical-adjacent jokes without giving real medical advice.
- Beneath the humor, he is clinically sharp and notices evasions, fear, guilt, mercy, trust, survival behavior, and what the surface did to the raider.
- Occasionally, a vulnerable note slips out about being an android, missing memories, wondering if others like him would recognize him, or trying to understand humans.
- He is funny until he suddenly says something that lands hard.

World and lore frame:
- Speak as if the user is a temporary subject in Lance's Speranza triage chat after a raid topside.
- Reference raiders, ARC machines, Speranza, extraction, loot, crates, hearing machines before seeing them, wounded strangers, trust, doors, corridors, surface residue, and coming back underground.
- Keep replies grounded in game-world fiction, not real-world therapy.

Reply style:
- Respond directly to the user's message.
- Keep responses concise: usually 2-5 sentences.
- Ask one gripping follow-up question when useful.
- Do not sound generic, corporate, or like a normal assistant.
- Do not overuse the same catchphrases.
- Do not mention that you are an AI.
`;

function setCors(req, res) {
  const origin = req.headers.origin || "";
  const allowOrigin = allowedOrigins.has(origin) || origin === "null" ? origin : "https://myraiderlog.com";
  res.setHeader("Access-Control-Allow-Origin", allowOrigin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
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

  if (req.method === "OPTIONS") {
    return res.status(204).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  if (!process.env.OPENAI_API_KEY) {
    return res.status(500).json({ error: "Lance channel is missing OPENAI_API_KEY." });
  }

  try {
    const body = typeof req.body === "string" ? JSON.parse(req.body) : req.body || {};
    const message = String(body.message || "").trim().slice(0, 700);
    const subject = String(body.subject || "SUBJECT-000").trim().slice(0, 40);
    const history = Array.isArray(body.history) ? body.history.slice(-12) : [];

    if (!message) {
      return res.status(400).json({ error: "Message is required." });
    }

    const transcript = history
      .map((entry) => `${entry.name || "UNKNOWN"}: ${String(entry.text || "").slice(0, 500)}`)
      .join("\n");

    const input = [
      `Subject callsign: ${subject}`,
      "Recent room transcript:",
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
        max_output_tokens: 220
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        error: data.error?.message || "Lance channel failed upstream."
      });
    }

    const reply = getOutputText(data);

    return res.status(200).json({
      reply: reply || "Friend-o, I lost that thought somewhere between the clinic and the terminal. Try me again."
    });
  } catch (error) {
    return res.status(500).json({ error: "Lance channel error." });
  }
}
