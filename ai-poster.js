exports.handler = async function (event) {
  const headers = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "POST, OPTIONS"
  };
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers, body: "" };
  if (event.httpMethod !== "POST") return { statusCode: 405, headers, body: JSON.stringify({ error: "Use POST for poster ideas." }) };

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return { statusCode: 503, headers, body: JSON.stringify({ error: "AI is not configured. Add the OPENAI_API_KEY environment variable in your Netlify site settings." }) };
  }

  try {
    const body = JSON.parse(event.body || "{}");
    const prompt = String(body.prompt || "").trim().slice(0, 1200);
    if (!prompt) return { statusCode: 400, headers, body: JSON.stringify({ error: "Please describe your poster." }) };

    const schema = {
      type: "object",
      additionalProperties: false,
      properties: {
        title: { type: "string" },
        subtitle: { type: "string" },
        details: { type: "string" },
        backgroundColor: { type: "string" },
        textColor: { type: "string" },
        accentColor: { type: "string" },
        font: { type: "string", enum: ["Space Grotesk", "Arial", "Georgia", "Impact", "DM Sans"] },
        titleSize: { type: "integer" },
        designTip: { type: "string" }
      },
      required: ["title", "subtitle", "details", "backgroundColor", "textColor", "accentColor", "font", "titleSize", "designTip"]
    };

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-5.4-mini",
        instructions: "You are a creative poster design assistant. Turn the user's request into a clear, appealing poster design. Keep title concise, subtitle short, details readable and useful. Choose harmonious high-contrast hex colours. Return only the requested structured design data. Do not include copyrighted slogans or song lyrics. Keep content suitable for a general audience.",
        input: prompt,
        text: { format: { type: "json_schema", name: "poster_design", strict: true, schema } },
        max_output_tokens: 450
      })
    });

    const result = await response.json();
    if (!response.ok) {
      const message = result?.error?.message || "The AI service returned an error.";
      return { statusCode: response.status === 429 ? 429 : 502, headers, body: JSON.stringify({ error: message }) };
    }
    const outputText = result.output?.flatMap(item => item.content || []).find(part => part.type === "output_text")?.text;
    if (!outputText) throw new Error("The AI did not return a poster design. Please try again.");
    const design = JSON.parse(outputText);
    return { statusCode: 200, headers, body: JSON.stringify({ design }) };
  } catch (error) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message || "Something went wrong. Please try again." }) };
  }
};