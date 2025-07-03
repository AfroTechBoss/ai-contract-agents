const express = require("express");
const multer = require("multer");
const axios = require("axios");
const fs = require("fs");
const path = require("path");

const app = express();
const upload = multer({ dest: "uploads/" });
const port = process.env.PORT || 3000;

app.use(express.json());

const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY;
const CONTRACT_STORE = {}; // In-memory store for contract text

// === Route: Analyze Contract ===
app.post("/analyze", upload.single("contract"), async (req, res) => {
  const filePath = req.file.path;
  const fileType = path.extname(req.file.originalname).toLowerCase();
  const fileContent = fs.readFileSync(filePath, "utf-8");

  const contractId = `${Date.now()}-${Math.floor(Math.random() * 99999)}`;
  CONTRACT_STORE[contractId] = fileContent;

  const prompt = `
You are a legal contract analysis assistant.

Read the following contract and return a JSON object with:

{
  "riskScore": 1–10,
  "highRiskClauses": [list of dangerous clauses],
  "missingClauses": [standard clauses not present],
  "explanationSummary": "short explanation of key risks in plain English"
}

Contract Text:
${fileContent}
`;

  try {
    const response = await axios.post(
      "https://api.anthropic.com/v1/messages",
      {
        model: "claude-3-sonnet-20240229", // use "opus" if needed
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

    const aiText = response.data.content[0].text.trim();

    let parsed;
    try {
      parsed = JSON.parse(aiText);
    } catch (err) {
      return res.status(500).json({
        error: "AI returned malformed JSON",
        raw: aiText
      });
    }

    res.json({ contractId, result: parsed });
  } catch (err) {
    console.error("Claude API error:", err?.response?.data || err.message);
    res.status(500).json({ error: "Claude analysis failed" });
  }
});

// === Route: Ask ACA About Contract ===
app.post("/ask", async (req, res) => {
  const { contractId, question } = req.body;
  const contractText = CONTRACT_STORE[contractId];

  if (!contractText) {
    return res.status(404).json({ error: "Contract not found" });
  }

  const qnaPrompt = `
You are a legal assistant. Answer the user's question using only the contract text below.

If the answer is not in the contract, say:
"The contract does not mention this."

Format your response in plain English.

Contract:
${contractText}

User Question:
${question}
`;

  try {
    const response = await axios.post(
      "https://api.anthropic.com/v1/messages",
      {
        model: "claude-3-sonnet-20240229",
        max_tokens: 800,
        temperature: 0.3,
        messages: [
          {
            role: "user",
            content: qnaPrompt
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

    const reply = response.data.content[0].text.trim();
    res.json({ answer: reply });
  } catch (err) {
    console.error("Claude QnA error:", err?.response?.data || err.message);
    res.status(500).json({ error: "Claude QnA failed" });
  }
});

app.get("/", (req, res) => {
  res.send("ACA - AI Contract Analyzer running 🚀");
});

app.listen(port, () => {
  console.log(`ACA server running on port ${port}`);
});
