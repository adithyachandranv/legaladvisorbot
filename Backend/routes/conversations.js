import express from "express";
import Conversation from "../models/Conversation.js";
import auth from "../middleware/auth.js";

const router = express.Router();

// Get all conversations for the logged-in user
router.get("/", auth, async (req, res) => {
  try {
    const conversations = await Conversation.find({ userId: req.userId })
      .select("title updatedAt createdAt")
      .sort({ updatedAt: -1 });
    res.json(conversations);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
});

// Create a new conversation
router.post("/", auth, async (req, res) => {
  try {
    const conversation = new Conversation({
      userId: req.userId,
      title: "New Conversation",
      messages: [],
    });
    await conversation.save();
    res.status(201).json(conversation);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
});

// Get a single conversation with all messages
router.get("/:id", auth, async (req, res) => {
  try {
    const conversation = await Conversation.findOne({
      _id: req.params.id,
      userId: req.userId,
    });
    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }
    res.json(conversation);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
});

// Delete a conversation
router.delete("/:id", auth, async (req, res) => {
  try {
    const conversation = await Conversation.findOneAndDelete({
      _id: req.params.id,
      userId: req.userId,
    });
    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }
    res.json({ message: "Conversation deleted" });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
});

export default router;
