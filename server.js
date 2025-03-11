require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const cors = require("cors");
const axios = require("axios");

const app = express();
app.use(express.json());
app.use(cors());

// ✅ Connect to MongoDB
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true
})
.then(() => console.log("✅ MongoDB Connected"))
.catch(err => console.error("❌ MongoDB Connection Error:", err));

// ✅ User Schema
const userSchema = new mongoose.Schema({
    name: String,
    email: { type: String, unique: true },
    password: String,
    chatHistory: [
        {
            userMessage: String,
            aiResponse: String,
            timestamp: { type: Date, default: Date.now }
        }
    ]
});

const User = mongoose.model("User", userSchema);

// ✅ Signup Route
app.post("/signup", async (req, res) => {
    const { name, email, password } = req.body;
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        const newUser = new User({ name, email, password: hashedPassword });
        await newUser.save();
        res.json({ message: "✅ User registered successfully" });
    } catch (err) {
        res.status(500).json({ error: "❌ Error registering user" });
    }
});

// ✅ Login Route
app.post("/login", async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ error: "❌ User not found" });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ error: "❌ Invalid credentials" });

        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, { expiresIn: "1h" });

        res.json({ message: "✅ Login successful", token });
    } catch (err) {
        res.status(500).json({ error: "❌ Error logging in" });
    }
});

// ✅ AI Chat Route
app.post("/chat", async (req, res) => {
    try {
        const { email, message } = req.body;

        // Find user
        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ error: "❌ User not found" });

        // Send user message to OpenAI
        const response = await axios.post(
            "https://api.openai.com/v1/chat/completions",
            {
                model: "gpt-4",
                messages: [{ role: "user", content: message }]
            },
            {
                headers: {
                    "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
                    "Content-Type": "application/json"
                }
            }
        );

        const aiReply = response.data.choices[0].message.content;

        // ✅ Save chat history
        user.chatHistory.push({ userMessage: message, aiResponse: aiReply });
        await user.save();

        res.json({ reply: aiReply });
    } catch (error) {
        console.error("Chat Error:", error);
        res.status(500).json({ error: "❌ AI Chat Error" });
    }
});

// ✅ Get Chat History
app.get("/chat-history/:email", async (req, res) => {
    try {
        const { email } = req.params;
        const user = await User.findOne({ email });

        if (!user) return res.status(404).json({ error: "❌ No chat history found" });

        res.json({ chatHistory: user.chatHistory });
    } catch (error) {
        console.error("Chat History Error:", error);
        res.status(500).json({ error: "❌ Error fetching chat history" });
    }
});

// ✅ Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
