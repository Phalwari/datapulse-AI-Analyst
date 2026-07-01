import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

const app = express();
const PORT = 3000;

// Increase JSON payload capacity for large CSV JSON representations
app.use(express.json({ limit: "15mb" }));

// Lazy-loaded Gemini client
let aiInstance: GoogleGenAI | null = null;
function getGemini(): GoogleGenAI {
  if (!aiInstance) {
    const key = process.env.GEMINI_API_KEY;
    // We fall back safely if missing and report it elegantly during runtime API call
    if (!key) {
      throw new Error("GEMINI_API_KEY is not set in secrets/environment variables.");
    }
    aiInstance = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiInstance;
}

// -------------------------------------------------------------
// API Endpoints
// -------------------------------------------------------------

// Basic health check
app.get("/api/health", (req, res) => {
  res.json({ status: "ok", time: new Date().toISOString() });
});

// CSV Screening & Automated Insight Generation
app.post("/api/analyze-metadata", async (req, res) => {
  try {
    const { datasetSummary, columns, sampleRows, rowCount } = req.body;

    if (!columns || !Array.isArray(columns) || columns.length === 0) {
      return res.status(400).json({ error: "Missing column details" });
    }

    const ai = getGemini();

    const prompt = `You are a world-class principal data scientist and business intelligence analyst.
Analyze the following dataset structure and characteristics:
Dataset Name: ${datasetSummary.name || 'uploaded_data.csv'}
Total Rows: ${rowCount}
Total Columns: ${columns.length}

Columns Specifications:
${JSON.stringify(columns, null, 2)}

Representative Sample Data (first few rows):
${JSON.stringify(sampleRows, null, 2)}

Tasks to accomplish:
1. Write a 2-3 sentence visual summary about the dataset context, highlighting its probable business meaning and overall quality.
2. Provide 3-5 high-value analytical business questions or hypotheses that could be asked of this dataset based on its columns.
3. Identify 3 high-impact mathematical or trend insights (could be positive trends, negative alarms, neutral shifts, anomalies) from analyzing column metadata and top-level sample data.
4. Recommend up to 2 key visualizations that the user should create first. Each visualization should use column names EXACTLY as xAxisKey and yAxisKeys. Ensure xAxisKey and yAxisKeys exist in the columns list. Choose from: bar, line, area, scatter, pie, or radar chart type. Ensure xAxisKey is ideally temporal, categorical, or identifier, and yAxisKeys are numeric or continuous columns.

Generate the response in strict JSON conforming to the requested schema.`;

    const modelName = "gemini-3.5-flash";
    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            summary: {
              type: Type.STRING,
              description: "Elegant overview summarizing what this dataset represents, its business value, and data quality check.",
            },
            businessQuestions: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "3-5 key business-facing analytical questions tailored to this dataset to prompt deeper research.",
            },
            insights: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  description: { type: Type.STRING, description: "Detailed analytic finding or relationship inferred from headers or samples." },
                  type: { type: Type.STRING, enum: ["positive", "negative", "neutral", "trend", "anomaly"] },
                  metric: { type: Type.STRING, description: "Optional focal metric" },
                  value: { type: Type.STRING, description: "Optional current visual context" }
                },
                required: ["title", "description", "type"],
              },
              description: "Top-value automated insights highlighting trends or structural characteristics.",
            },
            charts: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  id: { type: Type.STRING },
                  type: { type: Type.STRING, enum: ["bar", "line", "area", "scatter", "pie", "radar"] },
                  title: { type: Type.STRING },
                  xAxisKey: { type: Type.STRING, description: "Exact case-sensitive name of the column for X axis." },
                  yAxisKeys: {
                    type: Type.ARRAY,
                    items: { type: Type.STRING },
                    description: "Array containing exactly 1 or 2 numeric column names (exact match) to aggregate on the Y axis.",
                  },
                  description: { type: Type.STRING, description: "Why this visual chart is very useful for business exploration." },
                  summary: { type: Type.STRING, description: "Main takeaway of this chart representation." }
                },
                required: ["id", "type", "title", "xAxisKey", "yAxisKeys", "description", "summary"],
              },
              description: "List of recommended visual assets.",
            }
          },
          required: ["summary", "businessQuestions", "insights", "charts"],
        },
      },
    });

    const responseText = response.text;
    if (!responseText) {
      return res.status(500).json({ error: "Empty response from Gemini API" });
    }

    const data = JSON.parse(responseText.trim());
    return res.json(data);
  } catch (error: any) {
    console.error("Error generated during analysis:", error);
    return res.status(500).json({
      error: error.message || "Unknown error generated during data analysis screening.",
    });
  }
});

// AI Agent Conversation & Custom Action Generator
app.post("/api/chat", async (req, res) => {
  try {
    const { messages, sampleRows, columns, rowCount, datasetName } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Missing chat log conversation messages" });
    }

    const ai = getGemini();

    const datasetStatsSummary = `This is a dataset called '${datasetName || "data.csv"}' with ${rowCount} rows and the following ${columns.length} columns: ${columns.map((c: any) => `${c.name} (${c.type})`).join(", ")}. Sample data rows: ${JSON.stringify(sampleRows)}`;

    const lastMessage = messages[messages.length - 1]?.text;

    const promptMessage = `You are a senior data analyst and expert programmer.
You are chatting with a business user about their uploaded dataset.
Dataset Context Summary:
${datasetStatsSummary}

Chat history context to maintain:
${JSON.stringify(messages.slice(-5), null, 2)}

User request/query:
"${lastMessage}"

Tasks:
1. Formulate a friendly, highly precise, professional, and insight-driven analytical response to the user's inquiry (markdown tables, bullet lists, or bold definitions are encouraged). If they ask you to calculate something, estimate or explain the mathematical trends clearly based on the available metadata and sample.
2. Determine if the user's query implies or would benefit from a custom interactive visual chart or plot (e.g. comparing sales, distribution, trend, time series, performance, scatter correlation). If so, construct a 'chart' object. Ensure xAxisKey and yAxisKeys match the columns of the dataset exactly, and the values can be aggregated. Choose a suitable chart type (bar, line, area, scatter, pie, radar). Specify an 'aggregation' strategy like 'mean' if they ask for averages or ratios, 'count' if they ask for occurrence frequency, 'sum' for totals, 'min' for minimal boundaries, or 'max' for upper limits. If a chart is not requested or relevant, do not supply a 'chart' key.
3. Suggest 2 dynamic downstream conversational questions that explore this analytical thread.

Generate the exact JSON response. Do not add markdown backticks wrapper around the JSON itself unless it's standard JSON format, return in strict JSON schema.`;

    const modelName = "gemini-3.5-flash";
    const response = await ai.models.generateContent({
      model: modelName,
      contents: promptMessage,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            answer: {
              type: Type.STRING,
              description: "The rich markdown-formatted answer explaining metrics, ratios, summaries, or insights directly.",
            },
            suggestedQuestions: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: "2-3 highly relevant analytical next questions tailored to this current chat point.",
            },
            chart: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING, description: "A simple unique slug for this custom chart" },
                type: { type: Type.STRING, enum: ["bar", "line", "area", "scatter", "pie", "radar"] },
                title: { type: Type.STRING, description: "Descriptive chart title" },
                xAxisKey: { type: Type.STRING, description: "Original Column name to put on the X axis." },
                yAxisKeys: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                  description: "Array containing exactly 1 or 2 numeric column names (exact match) to aggregate on the Y axis.",
                },
                aggregation: {
                  type: Type.STRING,
                  enum: ["sum", "mean", "count", "min", "max"],
                  description: "Mathematical aggregation operation when grouping rows. E.g. mean, sum, count, min, max."
                },
                description: { type: Type.STRING, description: "How this chart answers the query." },
                summary: { type: Type.STRING, description: "One-sentence takeaway." }
              },
              required: ["id", "type", "title", "xAxisKey", "yAxisKeys", "description", "summary"],
              description: "Optional custom chart to render. ONLY include this if the query asks for a trend, visual, plot, or comparison.",
            }
          },
          required: ["answer"],
        },
      },
    });

    const responseText = response.text;
    if (!responseText) {
      return res.status(500).json({ error: "Empty response from Gemini server." });
    }

    const jsonResult = JSON.parse(responseText.trim());
    return res.json(jsonResult);
  } catch (error: any) {
    console.error("Error generated during conversation chat:", error);
    return res.status(500).json({
      error: error.message || "Unknown error generated during agent conversion.",
    });
  }
});

// -------------------------------------------------------------
// Vite or Production Static Assets Middleware Setup
// -------------------------------------------------------------
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting server in development mode with Vite HMR middleware.");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Starting server in production mode.");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
