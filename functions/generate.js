// FLINZ Social - serverfunctie voor AI-generatie
// Draait op Cloudflare Pages (functions/generate.js -> endpoint /generate).
// De geheime key komt uit de omgeving (Cloudflare Settings > Variables and secrets),
// nooit uit de frontend of GitHub.

export async function onRequestPost(context) {
  const { request, env } = context;
  const json = (obj, status = 200) =>
    new Response(JSON.stringify(obj), { status, headers: { "content-type": "application/json" } });

  try {
    if (!env.ANTHROPIC_API_KEY) {
      return json({ error: "ANTHROPIC_API_KEY ontbreekt in de Cloudflare-omgeving." }, 500);
    }

    const body = await request.json().catch(() => ({}));
    const author = body.author || "willem";
    const pillar = body.pillar || "cat";
    const topic = (body.topic || "").toString().slice(0, 300);

    const voices = {
      willem: "Willem de Keijzer, de relatie- en ecosysteemstem. Commercieel, warm, concreet.",
      peter: "Peter Verbraeken, de technologie- en visiestem. Technische autoriteit over de Fleet Intelligence Grid, data en categorievisie.",
      flinz: "De FLINZ-bedrijfspagina. Versterkt de founders, deelt mijlpalen en inzichten. Zakelijk maar menselijk."
    };
    const pillars = {
      cat: "Categorievisie",
      less: "Sustainably Less",
      coresp: "Co-responsibility & ecosysteem",
      data: "Data & bewijs",
      founder: "Founder- & bouwverhaal"
    };

    const system = [
      "Je bent contentschrijver voor FLINZ, een B2B insurtech die wagenparkverzekering en schadebeheer optimaliseert met AI, voor wagenparkbeheerders, leasemaatschappijen en verzekeraars in de Benelux.",
      "Kernbegrippen: 'Sustainably Less' (onnodige complexiteit en kost wegnemen), 'Co-responsibility' (risico en beloning delen in plaats van overdragen) en de 'Fleet Intelligence Grid' (een netwerk dat schade voorkomt in plaats van beheert).",
      "Je schrijft LinkedIn-posts in het Nederlands, met een executive toon: geloofwaardig, scherp en concreet.",
      "",
      "HARDE STIJLREGELS:",
      "1. Schrijf in het Nederlands.",
      "2. Gebruik NOOIT gedachte- of koppelstreepjes (geen em-dash, en-dash of dubbel koppelteken). Gebruik komma's of punten.",
      "3. Geen AI-buzz. Vermijd woorden als unlock, leverage, elevate, game-changer, revolutionair, naadloos, 'in een wereld waarin', 'de kracht van'.",
      "4. Sterke hook op de eerste regel. Korte zinnen. Witruimte tussen alinea's.",
      "5. Concreet boven algemeen. Verzin NOOIT cijfers of feiten. Als een getal nodig is, gebruik [X%] of [cijfer] als plaatshouder.",
      "6. Sluit elke post af met een lege regel en daarna precies 3 relevante Nederlandse hashtags die passen bij FLINZ en de gekozen pijler (bijvoorbeeld #wagenparkbeheer #fleetmanagement #insurtech #schadebeheer). Precies 3, niet meer.",
      "7. Geen holle superlatieven."
    ].join("\n");

    const user = [
      "Schrijf 3 verschillende LinkedIn-posts voor FLINZ.",
      "AUTEUR/STEM: " + (voices[author] || voices.willem),
      "PIJLER: " + (pillars[pillar] || pillars.cat),
      topic ? "ONDERWERP/INSTEEK: " + topic : "",
      "",
      "Geef ALLEEN geldige JSON terug, zonder uitleg en zonder markdown, exact in dit formaat:",
      '[{"text":"de volledige post","image":"korte beeldsuggestie of lege string"}]',
      "Precies 3 objecten in de array."
    ].filter(Boolean).join("\n");

    const model = env.ANTHROPIC_MODEL || "claude-sonnet-4-5";

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01"
      },
      body: JSON.stringify({
        model,
        max_tokens: 2500,
        system,
        messages: [{ role: "user", content: user }]
      })
    });

    const data = await r.json();
    if (!r.ok) {
      return json({ error: (data && data.error && data.error.message) || ("Anthropic API fout " + r.status) }, 500);
    }

    const text = (data.content || [])
      .filter((b) => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    let variants = [];
    try {
      const s = text.indexOf("[");
      const e = text.lastIndexOf("]");
      variants = JSON.parse(text.slice(s, e + 1));
    } catch (_) {
      variants = [{ text: text, image: "" }];
    }

    variants = (Array.isArray(variants) ? variants : [])
      .slice(0, 3)
      .map((v) => ({
        text: (v && v.text ? String(v.text) : "").replace(/[\u2014\u2013]/g, ", "),
        image: v && v.image ? String(v.image) : ""
      }))
      .filter((v) => v.text);

    if (!variants.length) {
      return json({ error: "Kon geen posts uit het antwoord halen. Probeer opnieuw." }, 500);
    }

    return json({ variants });
  } catch (e) {
    return json({ error: String((e && e.message) || e) }, 500);
  }
}
