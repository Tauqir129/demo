require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, '../public')));

// Data storage (in production, use a database)
const dataFile = path.join(__dirname, 'data.json');

// Initialize default data
function initializeData() {
    const defaultData = {
        settings: {
            openRouterApiKey: '',
            selectedModel: 'openai/gpt-3.5-turbo',
            globalAiEnabled: true
        },
        platforms: [],
        chats: [
            {
                id: 'chat_1',
                platform: 'facebook',
                platformId: 'fb_page_123',
                customerName: 'John Smith',
                customerAvatar: 'https://ui-avatars.com/api/?name=John+Smith&background=1877F2&color=fff',
                lastMessage: 'Hi, I need help with my order',
                timestamp: new Date().toISOString(),
                unread: 2,
                aiEnabled: true,
                messages: [
                    {
                        id: 'msg_1',
                        sender: 'customer',
                        text: 'Hi, I need help with my order',
                        timestamp: new Date(Date.now() - 3600000).toISOString()
                    },
                    {
                        id: 'msg_2',
                        sender: 'customer',
                        text: 'Order #12345 hasn\'t arrived yet',
                        timestamp: new Date(Date.now() - 1800000).toISOString()
                    }
                ]
            },
            {
                id: 'chat_2',
                platform: 'instagram',
                platformId: 'ig_account_456',
                customerName: 'Sarah Johnson',
                customerAvatar: 'https://ui-avatars.com/api/?name=Sarah+Johnson&background=E4405F&color=fff',
                lastMessage: 'Love your products! When will you restock?',
                timestamp: new Date().toISOString(),
                unread: 1,
                aiEnabled: false,
                messages: [
                    {
                        id: 'msg_3',
                        sender: 'customer',
                        text: 'Love your products! When will you restock?',
                        timestamp: new Date(Date.now() - 7200000).toISOString()
                    }
                ]
            },
            {
                id: 'chat_3',
                platform: 'whatsapp',
                platformId: 'wa_number_789',
                customerName: 'Mike Davis',
                customerAvatar: 'https://ui-avatars.com/api/?name=Mike+Davis&background=25D366&color=fff',
                lastMessage: 'Can I get a discount for bulk order?',
                timestamp: new Date().toISOString(),
                unread: 0,
                aiEnabled: true,
                messages: [
                    {
                        id: 'msg_4',
                        sender: 'customer',
                        text: 'Can I get a discount for bulk order?',
                        timestamp: new Date(Date.now() - 5400000).toISOString()
                    },
                    {
                        id: 'msg_5',
                        sender: 'agent',
                        text: 'Hi Mike! Yes, we offer bulk discounts. How many units are you looking at?',
                        timestamp: new Date(Date.now() - 5100000).toISOString()
                    }
                ]
            }
        ],
        prompts: [
            {
                id: 'prompt_1',
                name: 'Friendly Greeting',
                content: 'You are a friendly customer service representative. Greet the customer warmly and offer assistance.',
                isActive: true
            },
            {
                id: 'prompt_2',
                name: 'Order Inquiry',
                content: 'You are helping a customer with an order inquiry. Be helpful, provide accurate information, and maintain a professional tone.',
                isActive: true
            },
            {
                id: 'prompt_3',
                name: 'Complaint Handling',
                content: 'You are handling a customer complaint. Show empathy, apologize sincerely, and offer solutions.',
                isActive: false
            }
        ]
    };

    if (!fs.existsSync(dataFile)) {
        fs.writeFileSync(dataFile, JSON.stringify(defaultData, null, 2));
        return defaultData;
    }
    
    const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
    // Merge with defaults if missing keys
    if (!data.settings) data.settings = defaultData.settings;
    if (!data.platforms) data.platforms = defaultData.platforms;
    if (!data.chats) data.chats = defaultData.chats;
    if (!data.prompts) data.prompts = defaultData.prompts;
    
    return data;
}

let db = initializeData();

// Save data helper
function saveData() {
    fs.writeFileSync(dataFile, JSON.stringify(db, null, 2));
}

// Routes

// Get all data
app.get('/api/data', (req, res) => {
    res.json(db);
});

// Settings routes
app.get('/api/settings', (req, res) => {
    res.json(db.settings);
});

app.put('/api/settings', (req, res) => {
    db.settings = { ...db.settings, ...req.body };
    saveData();
    res.json(db.settings);
});

// Platforms routes
app.get('/api/platforms', (req, res) => {
    res.json(db.platforms);
});

app.post('/api/platforms/connect', async (req, res) => {
    const { platform, accessToken, pageId, pageName } = req.body;
    
    // In production, validate the token with the respective API
    const newPlatform = {
        id: `platform_${uuidv4()}`,
        platform,
        pageId,
        pageName,
        accessToken,
        connectedAt: new Date().toISOString(),
        status: 'active'
    };
    
    db.platforms.push(newPlatform);
    saveData();
    res.json({ success: true, platform: newPlatform });
});

app.delete('/api/platforms/:id', (req, res) => {
    db.platforms = db.platforms.filter(p => p.id !== req.params.id);
    saveData();
    res.json({ success: true });
});

// Chats routes
app.get('/api/chats', (req, res) => {
    const { platform, filter } = req.query;
    let chats = [...db.chats];
    
    if (platform) {
        chats = chats.filter(c => c.platform === platform);
    }
    
    if (filter === 'unread') {
        chats = chats.filter(c => c.unread > 0);
    }
    
    res.json(chats);
});

app.get('/api/chats/:id', (req, res) => {
    const chat = db.chats.find(c => c.id === req.params.id);
    if (!chat) {
        return res.status(404).json({ error: 'Chat not found' });
    }
    res.json(chat);
});

app.post('/api/chats', (req, res) => {
    const { platform, platformId, customerName, customerAvatar } = req.body;
    
    const newChat = {
        id: `chat_${uuidv4()}`,
        platform,
        platformId,
        customerName,
        customerAvatar: customerAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(customerName)}&background=random`,
        lastMessage: '',
        timestamp: new Date().toISOString(),
        unread: 0,
        aiEnabled: db.settings.globalAiEnabled,
        messages: []
    };
    
    db.chats.unshift(newChat);
    saveData();
    res.json(newChat);
});

app.put('/api/chats/:id', (req, res) => {
    const chatIndex = db.chats.findIndex(c => c.id === req.params.id);
    if (chatIndex === -1) {
        return res.status(404).json({ error: 'Chat not found' });
    }
    
    db.chats[chatIndex] = { ...db.chats[chatIndex], ...req.body };
    saveData();
    res.json(db.chats[chatIndex]);
});

app.post('/api/chats/:id/messages', (req, res) => {
    const { text, sender } = req.body;
    const chat = db.chats.find(c => c.id === req.params.id);
    
    if (!chat) {
        return res.status(404).json({ error: 'Chat not found' });
    }
    
    const newMessage = {
        id: `msg_${uuidv4()}`,
        sender: sender || 'agent',
        text,
        timestamp: new Date().toISOString()
    };
    
    chat.messages.push(newMessage);
    chat.lastMessage = text;
    chat.timestamp = new Date().toISOString();
    
    if (sender === 'customer') {
        chat.unread++;
    }
    
    saveData();
    res.json({ message: newMessage, chat });
});

app.put('/api/chats/:id/ai-toggle', (req, res) => {
    const { aiEnabled } = req.body;
    const chat = db.chats.find(c => c.id === req.params.id);
    
    if (!chat) {
        return res.status(404).json({ error: 'Chat not found' });
    }
    
    chat.aiEnabled = aiEnabled;
    saveData();
    res.json({ success: true, aiEnabled: chat.aiEnabled });
});

// Prompts routes
app.get('/api/prompts', (req, res) => {
    res.json(db.prompts);
});

app.post('/api/prompts', (req, res) => {
    const { name, content } = req.body;
    
    const newPrompt = {
        id: `prompt_${uuidv4()}`,
        name,
        content,
        isActive: true
    };
    
    db.prompts.push(newPrompt);
    saveData();
    res.json(newPrompt);
});

app.put('/api/prompts/:id', (req, res) => {
    const prompt = db.prompts.find(p => p.id === req.params.id);
    if (!prompt) {
        return res.status(404).json({ error: 'Prompt not found' });
    }
    
    Object.assign(prompt, req.body);
    saveData();
    res.json(prompt);
});

app.delete('/api/prompts/:id', (req, res) => {
    db.prompts = db.prompts.filter(p => p.id !== req.params.id);
    saveData();
    res.json({ success: true });
});

// AI routes
app.get('/api/ai/models', async (req, res) => {
    const { openRouterApiKey } = db.settings;
    
    if (!openRouterApiKey) {
        return res.json({ models: [] });
    }
    
    try {
        const response = await axios.get('https://openrouter.ai/api/v1/models', {
            headers: {
                'Authorization': `Bearer ${openRouterApiKey}`
            }
        });
        res.json({ models: response.data.data || [] });
    } catch (error) {
        console.error('Error fetching models:', error.message);
        res.status(500).json({ error: 'Failed to fetch models' });
    }
});

app.post('/api/ai/generate', async (req, res) => {
    const { message, chatId, customPrompt } = req.body;
    const { openRouterApiKey, selectedModel, globalAiEnabled } = db.settings;
    
    if (!globalAiEnabled) {
        return res.status(400).json({ error: 'Global AI is disabled' });
    }
    
    const chat = db.chats.find(c => c.id === chatId);
    if (!chat || !chat.aiEnabled) {
        return res.status(400).json({ error: 'AI is disabled for this chat' });
    }
    
    if (!openRouterApiKey) {
        return res.status(400).json({ error: 'OpenRouter API key not configured' });
    }
    
    // Build conversation context
    const conversationHistory = chat.messages.slice(-10).map(msg => ({
        role: msg.sender === 'customer' ? 'user' : 'assistant',
        content: msg.text
    }));
    
    // Add system prompt
    let systemContent = 'You are a helpful customer service representative managing social media conversations. Be professional, friendly, and concise.';
    
    if (customPrompt) {
        systemContent = customPrompt;
    } else {
        const activePrompts = db.prompts.filter(p => p.isActive);
        if (activePrompts.length > 0) {
            systemContent = activePrompts.map(p => p.content).join('\n\n');
        }
    }
    
    const messages = [
        { role: 'system', content: systemContent },
        ...conversationHistory,
        { role: 'user', content: message }
    ];
    
    try {
        const response = await axios.post(
            'https://openrouter.ai/api/v1/chat/completions',
            {
                model: selectedModel || 'openai/gpt-3.5-turbo',
                messages,
                max_tokens: 500,
                temperature: 0.7
            },
            {
                headers: {
                    'Authorization': `Bearer ${openRouterApiKey}`,
                    'Content-Type': 'application/json',
                    'HTTP-Referer': 'http://localhost:3000',
                    'X-Title': 'Social Chat Hub'
                }
            }
        );
        
        const aiResponse = response.data.choices[0]?.message?.content || 'Sorry, I couldn\'t generate a response.';
        
        res.json({ 
            response: aiResponse,
            model: selectedModel,
            usage: response.data.usage
        });
    } catch (error) {
        console.error('AI generation error:', error.response?.data || error.message);
        res.status(500).json({ 
            error: 'Failed to generate AI response',
            details: error.response?.data?.error?.message || error.message
        });
    }
});

// Serve index.html for all other routes (SPA support)
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Social Chat Hub running on http://localhost:${PORT}`);
    console.log(`📊 Data stored in: ${dataFile}`);
});
