// netlify/functions/pair-data.mjs
//
// Salva e legge le risposte della coppia usando Netlify Blobs, indicizzate
// per il "codice della coppia" scelto dagli utenti stessi (non generato).
// Zero configurazione aggiuntiva richiesta: Netlify Blobs funziona appena
// il sito è pubblicato su Netlify.

import { getStore } from "@netlify/blobs";

function sanitizeKey(s) {
  return (s || "").trim().toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

export default async (req) => {
  const store = getStore({ name: "coppie-compatibilita", consistency: "strong" });

  if (req.method === "POST") {
    let body;
    try {
      body = await req.json();
    } catch (e) {
      return new Response(JSON.stringify({ error: "JSON non valido" }), { status: 400 });
    }
    const { code, name, data } = body;
    if (!code || !name || !data) {
      return new Response(JSON.stringify({ error: "Mancano code, name o data" }), { status: 400 });
    }
    const key = sanitizeKey(code);
    const existing = (await store.get(key, { type: "json" })) || {};
    existing[name] = { ...data, savedAt: Date.now() };
    await store.setJSON(key, existing);
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (req.method === "GET") {
    const url = new URL(req.url);
    const code = url.searchParams.get("code");
    if (!code) {
      return new Response(JSON.stringify({ error: "Manca il parametro code" }), { status: 400 });
    }
    const key = sanitizeKey(code);
    const record = (await store.get(key, { type: "json" })) || {};
    return new Response(JSON.stringify({ record }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response("Method not allowed", { status: 405 });
};
