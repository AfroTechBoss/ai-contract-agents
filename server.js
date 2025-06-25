const express = require("express");
const multer = require("multer");
const axios = require("axios");
const fs = require("fs");

const app = express();
const upload = multer({ dest: "uploads/" });
const port = process.env.PORT || 3000;

const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;

app.post("/analyze", upload.single("contract"), async (req, res) => {
  const filePath = req.file.path;
  const contractText = fs.readFileSync(filePath, "utf-8");

  const prompt = `
You are a legal contract analysis assistant.

Your job is to read the following contract text and return a JSON object with the following fields:

{
  "riskScore": 1–10,
  "highRiskClauses": [list of dangerous clauses],
  "missingClauses": [standard clauses not present],
  "explanationSummary": "short explanation of key risks in plain English"
}

Only return valid JSON and nothing else.

Contract Text:
${contractText}
`;

  try {
    const response = await axios.post(
      "https://api.anthropic.com/v1/messages",
      {
        model: "claude-3-sonnet-20240229", // use "opus" if you want the premium model
        max_tokens: 1000,
        temperature: 0.3,
        messages: [
          {
            role: "user",
            content: prompt
          }
        ]
      },
      {
        headers: {
          "x-api-key": CLAUDE_API_KEY,
          "anthropic-version": "2023-06-01",
          "Content-Type": "application/json"
        }
      }
    );

    const message = response.data.content[0]?.text || "No content";
    let jsonResult;

    try {
      jsonResult = JSON.parse(message);
    } catch (err) {
      return res.status(500).json({
        error: "Claude returned a malformed JSON",
        raw: message
      });
    }

    res.json({ result: jsonResult });
  } catch (err) {
    console.error("Claude API error:", err?.response?.data || err.message);
    res.status(500).json({ error: "Claude analysis failed" });
  }
});

app.get("/", (req, res) => {
  res.send("Claude-powered AI Contract Agent is running");
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
