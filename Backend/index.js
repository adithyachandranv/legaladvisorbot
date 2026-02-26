import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import OpenAI from "openai";
import connectDB from "./db.js";
import authRoutes from "./routes/auth.js";
import conversationRoutes from "./routes/conversations.js";
import auth from "./middleware/auth.js";
import Conversation from "./models/Conversation.js";

dotenv.config();

// Connect to MongoDB
connectDB();

const app = express();
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Server is working");
});

// Mount routes
app.use("/api/auth", authRoutes);
app.use("/api/conversations", conversationRoutes);

// 🔥 OpenRouter Setup
const client = new OpenAI({
  apiKey: process.env.OPENROUTER_API_KEY,
  baseURL: "https://openrouter.ai/api/v1",
});

app.post("/legal-advice", auth, async (req, res) => {
  try {
    const { history, conversationId } = req.body;

    if (!history || !Array.isArray(history) || history.length === 0) {
      return res.status(400).json({ error: "Conversation history is required" });
    }

    // Set SSE headers for streaming
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");

    const stream = await client.chat.completions.create({
      model: "openrouter/free",
      messages: [
        {
          role: "system",
          content:
            "You are a professional legal advisor based in India. Give clear, structured, simple legal explanations. Refer to all the Indian laws and documents. Mention that advice is for educational purposes only.",
        },
        ...history,
      ],
      stream: true,
    });

    let fullResponse = "";

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        fullResponse += content;
        res.write(`data: ${JSON.stringify({ content })}\n\n`);
      }
    }

    // Save messages to the conversation in DB
    if (conversationId) {
      try {
        const conversation = await Conversation.findOne({
          _id: conversationId,
          userId: req.userId,
        });

        if (conversation) {
          // Add the latest user message
          const lastUserMsg = history[history.length - 1];
          conversation.messages.push({
            role: "user",
            content: lastUserMsg.content,
          });

          // Add the assistant response
          conversation.messages.push({
            role: "assistant",
            content: fullResponse,
          });

          // Auto-set title from first user message
          if (conversation.title === "New Conversation") {
            const firstUserMsg = history.find((m) => m.role === "user");
            if (firstUserMsg) {
              conversation.title =
                firstUserMsg.content.length > 50
                  ? firstUserMsg.content.substring(0, 50) + "..."
                  : firstUserMsg.content;
            }
          }

          await conversation.save();
        }
      } catch (dbError) {
        console.error("Error saving to DB:", dbError);
      }
    }

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (error) {
    console.error(error);
    res.write(`data: ${JSON.stringify({ error: "Something went wrong" })}\n\n`);
    res.end();
  }
});

app.listen(5000, () => {
  console.log("Server running on port 5000");
});