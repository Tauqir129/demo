const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static(path.join(__dirname, '../public')));

// Data storage (in-memory for demo, use database in production)
let settings = {
    openRouterApiKey: '',
    selectedModel: 'openai/gpt-3.5-turbo',
    globalAiEnabled: true
};

let platforms = [
    { id: 1, name: 'Facebook', connected: false, color: '#1877F2' },
    { id: 2, name: 'Instagram', connected: false, color: '#E4405F' },
    { id: 3, name: 'WhatsApp', connected: false, color: '#25D366' }
];

let chats = [
    {
        id: 1,
        platformId: 1,
        platformName: 'Facebook',
        userName: 'John Doe',
        messages: [
            { id: 1, sender: 'user', text: 'Hello!', timestamp: new Date().toISOString() },
            { id: 2, sender: 'me', text: 'Hi John! How can I help?', timestamp: new Date().toISOString() }
        ],
        aiEnabled: true,
        lastMessage: 'Hi John! How can I help?',
        unread: 0
    },
    {
        id: 2,
        platformId: 2,
        platformName: 'Instagram',
        userName: 'Jane Smith',
        messages: [
            { id: 1, sender: 'user', text: 'What are your prices?', timestamp: new Date().toISOString() }
        ],
        aiEnabled: true,
        lastMessage: 'What are your prices?',
        unread: 1
    },
    {
        id: 3,
        platformId: 3,
        platformName: 'WhatsApp',
        userName: 'Bob Wilson',
        messages: [
            { id: 1, sender: 'user', text: 'Is this available?', timestamp: new Date().toISOString() }
        ],
        aiEnabled: false,
        lastMessage: 'Is this available?',
        unread: 1
    }
];

let aiPrompts = [
    { id: 1, name: 'Friendly Greeting', prompt: 'Respond in a friendly and welcoming manner. Be helpful and professional.' },
    { id: 2, name: 'Sales Inquiry', prompt: 'You are a sales assistant. Provide information about products and services professionally.' },
    { id: 3, name: 'Support Agent', prompt: 'You are a customer support agent. Solve problems efficiently and empathetically.' }
];

// Helper function to call OpenRouter API
async function callOpenRouter(message, conversationHistory, model, apiKey) {
    if (!apiKey) {
        throw new Error('OpenRouter API key not configured');
    }

    const messages = [
        { role: 'system', content: 'You are a helpful customer service assistant for a business managing multiple social media platforms. Be concise, professional, and helpful.' },
        ...conversationHistory.map(msg => ({
            role: msg.sender === 'user' ? 'user' : 'assistant',
            content: msg.text
        })),
        { role: 'user', content: message }
    ];

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
            'HTTP-Referer': 'http://localhost:3000',
            'X-Title': 'Social Media Chat Manager'
        },
        body: JSON.stringify({
            model: model,
            messages: messages,
            max_tokens: 500
        })
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error?.message || 'Failed to get AI response');
    }

    const data = await response.json();
    return data.choices[0].message.content;
}

// Routes

// Get all settings
app.get('/api/settings', (req, res) => {
    res.json(settings);
});

// Update settings
app.post('/api/settings', (req, res) => {
    const { openRouterApiKey, selectedModel, globalAiEnabled } = req.body;
    
    if (openRouterApiKey !== undefined) settings.openRouterApiKey = openRouterApiKey;
    if (selectedModel !== undefined) settings.selectedModel = selectedModel;
    if (globalAiEnabled !== undefined) settings.globalAiEnabled = globalAiEnabled;
    
    res.json(settings);
});

// Get available models (demo - in production, fetch from OpenRouter)
app.get('/api/models', (req, res) => {
    const demoModels = [
        { id: 'openai/gpt-3.5-turbo', name: 'GPT-3.5 Turbo' },
        { id: 'openai/gpt-4', name: 'GPT-4' },
        { id: 'anthropic/claude-3-haiku', name: 'Claude 3 Haiku' },
        { id: 'anthropic/claude-3-sonnet', name: 'Claude 3 Sonnet' },
        { id: 'google/gemini-pro', name: 'Gemini Pro' },
        { id: 'meta-llama/llama-3-8b-instruct', name: 'Llama 3 8B' }
    ];
    res.json(demoModels);
});

// Get all platforms
app.get('/api/platforms', (req, res) => {
    res.json(platforms);
});

// Connect/disconnect platform (demo)
app.post('/api/platforms/:id/toggle', (req, res) => {
    const platform = platforms.find(p => p.id === parseInt(req.params.id));
    if (platform) {
        platform.connected = !platform.connected;
        res.json(platform);
    } else {
        res.status(404).json({ error: 'Platform not found' });
    }
});

// Get all chats
app.get('/api/chats', (req, res) => {
    res.json(chats);
});

// Get single chat
app.get('/api/chats/:id', (req, res) => {
    const chat = chats.find(c => c.id === parseInt(req.params.id));
    if (chat) {
        chat.unread = 0; // Mark as read
        res.json(chat);
    } else {
        res.status(404).json({ error: 'Chat not found' });
    }
});

// Send message
app.post('/api/chats/:id/messages', async (req, res) => {
    const chat = chats.find(c => c.id === parseInt(req.params.id));
    const { text, enableAi } = req.body;
    
    if (!chat) {
        return res.status(404).json({ error: 'Chat not found' });
    }
    
    // Add user message
    const userMessage = {
        id: chat.messages.length + 1,
        sender: 'me',
        text: text,
        timestamp: new Date().toISOString()
    };
    chat.messages.push(userMessage);
    chat.lastMessage = text;
    
    // Check if AI should respond
    const shouldUseAi = enableAi && settings.globalAiEnabled && chat.aiEnabled;
    
    if (shouldUseAi && settings.openRouterApiKey) {
        try {
            // Get conversation history (last 10 messages for context)
            const history = chat.messages.slice(-10);
            
            const aiResponse = await callOpenRouter(
                text,
                history,
                settings.selectedModel,
                settings.openRouterApiKey
            );
            
            const aiMessage = {
                id: chat.messages.length + 1,
                sender: 'me',
                text: aiResponse,
                timestamp: new Date().toISOString(),
                isAi: true
            };
            chat.messages.push(aiMessage);
            chat.lastMessage = aiResponse;
            
            res.json({ chat, aiUsed: true });
            return;
        } catch (error) {
            console.error('AI Error:', error.message);
            res.json({ chat, aiUsed: false, aiError: error.message });
            return;
        }
    }
    
    res.json({ chat, aiUsed: false });
});

// Toggle AI for specific chat
app.patch('/api/chats/:id/ai', (req, res) => {
    const chat = chats.find(c => c.id === parseInt(req.params.id));
    if (chat) {
        chat.aiEnabled = req.body.aiEnabled;
        res.json(chat);
    } else {
        res.status(404).json({ error: 'Chat not found' });
    }
});

// Get AI prompts
app.get('/api/prompts', (req, res) => {
    res.json(aiPrompts);
});

// Add new prompt
app.post('/api/prompts', (req, res) => {
    const { name, prompt } = req.body;
    const newPrompt = {
        id: aiPrompts.length + 1,
        name,
        prompt
    };
    aiPrompts.push(newPrompt);
    res.json(newPrompt);
});

// Test AI with prompt
app.post('/api/ai/test', async (req, res) => {
    const { message, prompt } = req.body;
    
    if (!settings.openRouterApiKey) {
        return res.status(400).json({ error: 'OpenRouter API key not configured' });
    }
    
    try {
        const fullMessage = prompt ? `${prompt}\n\nUser message: ${message}` : message;
        const response = await callOpenRouter(
            fullMessage,
            [],
            settings.selectedModel,
            settings.openRouterApiKey
        );
        
        res.json({ response, success: true });
    } catch (error) {
        res.status(500).json({ error: error.message, success: false });
    }
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
