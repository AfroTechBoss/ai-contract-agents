const express = require("express");
const multer = require("multer");
const { Configuration, OpenAIApi } = require("openai");
const fs = require("fs");

const app = express();
const upload = multer({ dest: "uploads/" });
const port = process.env.PORT || 3000;

const openai = new OpenAIApi(
  new Configuration({ apiKey: process.env.OPENAI_API_KEY })
);

app.post("/analyze", upload.single("contract"), async (req, res) => {
  const filePath = req.file.path;
  const fileText = fs.readFileSync(filePath, "utf-8"); // Use OCR/PDF extract here

  const prompt = `
You are a legal contract AI. Analyze this contract and return:
- riskScore (1-10)
- highRiskClauses (list)
- missingClauses (list)
- explanationSummary (short summary)

Contract Text:
${fileText}
`;

  try {
    const response = await openai.createChatCompletion({
      model: "gpt-4",
      messages: [
        { role: "system", content: "You analyze legal contracts." },
        { role: "user", content: prompt }
      ],
    });

    const analysis = response.data.choices[0].message.content;
    res.json({ result: analysis });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "AI analysis failed" });
  }
});

app.get("/", (req, res) => res.send("AI Contract Agent Running"));
app.listen(port, () => console.log(`Server running on port ${port}`));
