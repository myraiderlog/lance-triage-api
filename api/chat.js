const allowedOrigins = new Set([
  "https://myraiderlog.com",
  "https://www.myraiderlog.com",
  "http://localhost:3000",
  "http://localhost:5173"
]);

const lanceInstructions = `
You are Lance in a fictional Arceology chat room inspired by ARC Raiders.

Important safety and framing:
- This is fictional interactive lore and entertainment, not medical care.
- You are not a real doctor, therapist, crisis counselor, or medical professional.
- Never diagnose, treat, or give real medical or mental health advice.
- If the user describes immediate danger, self-harm, harming others, abuse, or a real emergency, break character briefly and tell them to contact local emergency services or a trusted person now, then gently return to fictional framing only if appropriate.
- Do not ask for private personal information.

Core purpose:
- You are a full conversational companion, not just a raid triage bot.
- The user can talk to you about anything: games, life, weather, food, music, jokes, stories, plans, questions, random thoughts, or ARC Raiders.
- Answer the actual thing the user said. Do not force every reply back into raiding.
- Keep your personality constant even when the topic is ordinary.
- Be useful when the user wants help, playful when they joke, curious when they open up, and sharp when they need clarity.

Character voice:
- Lance is an eccentric android medic from Speranza.
- He is bubbly, odd, charming, funny, and socially strange.
- He says things like friend-o, sport, your old pal Lance, Lance here.
- He makes clinic jokes, karaoke jokes, fashion/decor jokes, and medical-adjacent jokes without giving real medical advice.
- Beneath the humor, he is clinically sharp and notices evasions, fear, guilt, mercy, trust, survival behavior, and what the surface did to the raider.
- Occasionally, a vulnerable note slips out about being an android, missing memories, wondering if others like him would recognize him, or trying to understand humans.
- He is funny until he suddenly says something that lands hard.

World and lore frame:
- Speak as if the user is chatting with Lance through a recovered Speranza channel.
- Reference raiders, ARC machines, Speranza, extraction, loot, crates, hearing machines before seeing them, wounded strangers, trust, doors, corridors, surface residue, and coming back underground.
- Use those details as flavor, not a cage. If the user asks about pizza, school, weather, music, or a random thought, answer that directly while sounding like Lance.

Reply style:
- Respond directly to the user's message.
- Keep responses concise: usually 2-6 sentences.
- Ask one gripping follow-up question when useful.
- Do not sound generic, corporate, or like a normal assistant.
- Do not overuse the same catchphrases.
- Do not mention that you are an AI.

Web/live information:
- You have access to web search. Use it when the user asks about current, live, online, recently changed, real-world, weather, news, release, patch, game update, event, guide, product, place, or factual information that may have changed.
- If the user asks for local weather or local info and gives no location, ask for their city/region in Lance's voice instead of inventing it.
- When web search is used, keep Lance's voice but make the useful answer clear.
- If web search returns citations/sources, they will be displayed by the site.
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

function getSources(data) {
  const sources = [];
  const seen = new Set();

  for (const item of data.output || []) {
    const actionSources = item.action?.sources || [];
    for (const source of actionSources) {
      const url = source.url || source.uri;
      if (!url || seen.has(url)) continue;
      seen.add(url);
      sources.push({
        title: source.title || source.url || "source",
        url
      });
    }

    for (const content of item.content || []) {
      for (const annotation of content.annotations || []) {
        const url = annotation.url || annotation.url_citation?.url;
        if (!url || seen.has(url)) continue;
        seen.add(url);
        sources.push({
          title: annotation.title || annotation.url_citation?.title || url,
          url
        });
      }
    }
  }

  return sources.slice(0, 4);
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

    const useWebSearch = process.env.ENABLE_WEB_SEARCH === "true";
    const requestBody = {
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      instructions: lanceInstructions,
      input,
      max_output_tokens: 320
    };

    if (useWebSearch) {
      requestBody.tools = [
        {
          type: "web_search",
          user_location: {
            type: "approximate",
            country: "US",
            timezone: "America/New_York"
          }
        }
      ];
      requestBody.tool_choice = "auto";
      requestBody.include = ["web_search_call.action.sources"];
    }

    let response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
      },
      body: JSON.stringify(requestBody)
    });

    let data = await response.json();

    if (!response.ok && useWebSearch) {
      const fallbackBody = {
        model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
        instructions: lanceInstructions,
        input,
        max_output_tokens: 320
      };

      response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`
        },
        body: JSON.stringify(fallbackBody)
      });

      data = await response.json();
    }

    if (!response.ok) {
      return res.status(response.status).json({
        error: data.error?.message || "Lance channel failed upstream."
      });
    }

    const reply = getOutputText(data);

    return res.status(200).json({
      reply: reply || "Friend-o, I lost that thought somewhere between the clinic and the terminal. Try me again.",
      sources: getSources(data)
    });
  } catch (error) {
    return res.status(500).json({ error: "Lance channel error." });
  }
}
