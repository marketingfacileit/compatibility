// netlify/functions/astro-analysis.js
//
// Chiama l'API di Anthropic lato server, cosi la chiave API non è mai
// esposta nel browser. Imposta la variabile d'ambiente ANTHROPIC_API_KEY
// nel pannello Netlify: Site settings → Environment variables.

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  let payload;
  try {
    payload = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: "JSON non valido" }) };
  }

  const { me, partner, compatibility } = payload;

  const prompt = `
Sei un'astrologa esperta e diretta, che scrive in italiano con un tono caldo ma senza fronzoli.
Hai a disposizione i dati di una coppia che ha completato un questionario di compatibilità di valori (punteggio complessivo: ${compatibility}%).

Persona 1: ${me.name}
Segno solare: ${me.sunSign || "non specificato"}
Ora di nascita: ${me.birthTime || "non specificata"} — Città: ${me.birthPlace || "non specificata"}
Ha già avuto relazioni lunghe: ${me.hadLongRelationship || "non specificato"}
Risposte aperte:
${me.openAnswers.map(o => `- ${o.q} ${o.a}`).join("\n")}

Persona 2: ${partner.name}
Segno solare: ${partner.sunSign || "non specificato"}
Ora di nascita: ${partner.birthTime || "non specificata"} — Città: ${partner.birthPlace || "non specificata"}
Ha già avuto relazioni lunghe: ${partner.hadLongRelationship || "non specificato"}
Risposte aperte:
${partner.openAnswers.map(o => `- ${o.q} ${o.a}`).join("\n")}

Istruzioni:
- Se manca ora o città di nascita, NON inventare un ascendente: usa solo il segno solare e dillo esplicitamente.
- Scrivi un'analisi in 4 parti, con questi titoli esatti:
  1) "Dinamica di coppia" (3-4 frasi)
  2) "Su cosa lavorare tu, ${me.name}" (3-4 frasi, basate sulle sue risposte aperte, non generiche da oroscopo)
  3) "Su cosa lavorare tu, ${partner.name}" (3-4 frasi, stesso criterio)
  4) "Un consiglio pratico per la coppia" (2-3 frasi)
- Tono diretto, concreto, mai vago o New Age generico.
- Non superare le 350 parole totali.
`.trim();

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1000,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await response.json();

    if (!response.ok || data.type === "error") {
      const detail = data.error ? `${data.error.type}: ${data.error.message}` : `HTTP ${response.status}`;
      return {
        statusCode: 502,
        body: JSON.stringify({ error: `Errore da Anthropic API — ${detail}` }),
      };
    }

    const text = (data.content || [])
      .map((block) => block.text || "")
      .join("\n")
      .trim();

    if (!text) {
      return { statusCode: 502, body: JSON.stringify({ error: "Risposta vuota dall'API (nessun blocco di testo nel content)" }) };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};
