// API Base URL
const API_BASE = 'http://localhost:3000/api';

// State
let currentChatId = null;
let chats = [];
let platforms = [];
let prompts = [];
let settings = {};
let models = [];

// DOM Elements
const navItems = document.querySelectorAll('.nav-item');
const pages = document.querySelectorAll('.page');
const globalAiToggle = document.getElementById('globalAiToggle');
const chatListContainer = document.getElementById('chatListContainer');
const messagesContainer = document.getElementById('messagesContainer');
const messageInput = document.getElementById('messageInput');
const sendMessageBtn = document.getElementById('sendMessageBtn');
const enableAiCheckbox = document.getElementById('enableAiCheckbox');
const chatUserName = document.getElementById('chatUserName');
const chatPlatform = document.getElementById('chatPlatform');
const chatAiToggle = document.getElementById('chatAiToggle');
const chatWindow = document.getElementById('chatWindow');

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    loadSettings();
    loadChats();
    loadPlatforms();
    loadPrompts();
    loadModels();
    setupEventListeners();
});

// Setup Event Listeners
function setupEventListeners() {
    // Navigation
    navItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const page = item.dataset.page;
            switchPage(page);
        });
    });

    // Global AI Toggle
    globalAiToggle.addEventListener('change', async (e) => {
        try {
            const response = await fetch(`${API_BASE}/settings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ globalAiEnabled: e.target.checked })
            });
            settings = await response.json();
            showMessage('Global AI setting updated', 'success');
        } catch (error) {
            showMessage('Failed to update global AI setting', 'error');
        }
    });

    // Send Message
    sendMessageBtn.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // Chat AI Toggle
    chatAiToggle.addEventListener('change', async (e) => {
        if (currentChatId) {
            try {
                const response = await fetch(`${API_BASE}/chats/${currentChatId}/ai`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ aiEnabled: e.target.checked })
                });
                const updatedChat = await response.json();
                const chat = chats.find(c => c.id === currentChatId);
                if (chat) chat.aiEnabled = updatedChat.aiEnabled;
            } catch (error) {
                showMessage('Failed to update chat AI setting', 'error');
            }
        }
    });

    // Add Prompt
    document.getElementById('addPromptBtn').addEventListener('click', addPrompt);

    // Test AI
    document.getElementById('testAiBtn').addEventListener('click', testAi);

    // Save Settings
    document.getElementById('saveSettingsBtn').addEventListener('click', saveSettings);
}

// Switch Page
function switchPage(pageName) {
    navItems.forEach(item => {
        item.classList.toggle('active', item.dataset.page === pageName);
    });
    
    pages.forEach(page => {
        page.classList.toggle('active', page.id === `${pageName}-page`);
    });
}

// Load Settings
async function loadSettings() {
    try {
        const response = await fetch(`${API_BASE}/settings`);
        settings = await response.json();
        globalAiToggle.checked = settings.globalAiEnabled;
        
        if (settings.openRouterApiKey) {
            document.getElementById('apiKeyInput').value = settings.openRouterApiKey;
        }
        
        if (settings.selectedModel) {
            document.getElementById('modelSelect').value = settings.selectedModel;
        }
    } catch (error) {
        console.error('Failed to load settings:', error);
    }
}

// Load Models
async function loadModels() {
    try {
        const response = await fetch(`${API_BASE}/models`);
        models = await response.json();
        
        const modelSelect = document.getElementById('modelSelect');
        modelSelect.innerHTML = models.map(model => 
            `<option value="${model.id}">${model.name}</option>`
        ).join('');
        
        if (settings.selectedModel) {
            modelSelect.value = settings.selectedModel;
        }
    } catch (error) {
        console.error('Failed to load models:', error);
    }
}

// Load Chats
async function loadChats() {
    try {
        const response = await fetch(`${API_BASE}/chats`);
        chats = await response.json();
        renderChatList();
    } catch (error) {
        console.error('Failed to load chats:', error);
    }
}

// Render Chat List
function renderChatList() {
    chatListContainer.innerHTML = chats.map(chat => `
        <div class="chat-item ${chat.id === currentChatId ? 'active' : ''}" data-chat-id="${chat.id}">
            <div class="chat-item-header">
                <span class="chat-item-name">${chat.userName}</span>
                <span class="chat-item-platform" style="background-color: ${getPlatformColor(chat.platformName)}">
                    ${chat.platformName}
                </span>
            </div>
            <div class="chat-item-last-message">${chat.lastMessage}</div>
            <div class="chat-item-meta">
                <span>${formatTime(chat.messages[chat.messages.length - 1]?.timestamp)}</span>
                ${chat.unread > 0 ? `<span class="unread-badge">${chat.unread}</span>` : ''}
            </div>
        </div>
    `).join('');
    
    // Add click listeners
    document.querySelectorAll('.chat-item').forEach(item => {
        item.addEventListener('click', () => selectChat(parseInt(item.dataset.chatId)));
    });
}

// Get Platform Color
function getPlatformColor(platformName) {
    const colors = {
        'Facebook': '#1877F2',
        'Instagram': '#E4405F',
        'WhatsApp': '#25D366'
    };
    return colors[platformName] || '#6B7280';
}

// Format Time
function formatTime(timestamp) {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Select Chat
async function selectChat(chatId) {
    currentChatId = chatId;
    const chat = chats.find(c => c.id === chatId);
    
    if (!chat) return;
    
    // Update UI
    chatUserName.textContent = chat.userName;
    chatPlatform.textContent = chat.platformName;
    chatPlatform.style.backgroundColor = getPlatformColor(chat.platformName);
    chatAiToggle.checked = chat.aiEnabled;
    
    // Render messages
    renderMessages(chat);
    
    // Update active state
    document.querySelectorAll('.chat-item').forEach(item => {
        item.classList.toggle('active', parseInt(item.dataset.chatId) === chatId);
    });
    
    // Load fresh chat data
    try {
        const response = await fetch(`${API_BASE}/chats/${chatId}`);
        const freshChat = await response.json();
        const chatIndex = chats.findIndex(c => c.id === chatId);
        if (chatIndex !== -1) chats[chatIndex] = freshChat;
        renderMessages(freshChat);
    } catch (error) {
        console.error('Failed to load chat:', error);
    }
}

// Render Messages
function renderMessages(chat) {
    messagesContainer.innerHTML = chat.messages.map(msg => `
        <div class="message ${msg.sender} ${msg.isAi ? 'ai-generated' : ''}">
            ${msg.text}
            ${msg.isAi ? '<span class="message-ai-badge">AI</span>' : ''}
            <div class="message-time">${formatTime(msg.timestamp)}</div>
        </div>
    `).join('');
    
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Send Message
async function sendMessage() {
    const text = messageInput.value.trim();
    if (!text || !currentChatId) return;
    
    const enableAi = enableAiCheckbox.checked;
    
    try {
        const response = await fetch(`${API_BASE}/chats/${currentChatId}/messages`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text, enableAi })
        });
        
        const result = await response.json();
        const chatIndex = chats.findIndex(c => c.id === currentChatId);
        if (chatIndex !== -1) chats[chatIndex] = result.chat;
        
        renderMessages(result.chat);
        renderChatList();
        
        messageInput.value = '';
        
        if (result.aiUsed) {
            console.log('AI was used to generate response');
        } else if (result.aiError) {
            showMessage(`AI Error: ${result.aiError}`, 'error');
        }
    } catch (error) {
        showMessage('Failed to send message', 'error');
    }
}

// Load Platforms
async function loadPlatforms() {
    try {
        const response = await fetch(`${API_BASE}/platforms`);
        platforms = await response.json();
        renderPlatforms();
    } catch (error) {
        console.error('Failed to load platforms:', error);
    }
}

// Render Platforms
function renderPlatforms() {
    const grid = document.getElementById('platformsGrid');
    grid.innerHTML = platforms.map(platform => `
        <div class="platform-card">
            <div class="platform-icon" style="background-color: ${platform.color}20; color: ${platform.color}">
                ${getPlatformIcon(platform.name)}
            </div>
            <h3>${platform.name}</h3>
            <p>Connect your ${platform.name} account to manage messages</p>
            <span class="status-badge ${platform.connected ? 'connected' : 'disconnected'}">
                ${platform.connected ? 'Connected' : 'Not Connected'}
            </span>
            <button class="btn ${platform.connected ? 'btn-danger' : 'btn-primary'}" onclick="togglePlatform(${platform.id})">
                ${platform.connected ? 'Disconnect' : 'Connect'}
            </button>
        </div>
    `).join('');
}

// Get Platform Icon
function getPlatformIcon(platformName) {
    const icons = {
        'Facebook': '📘',
        'Instagram': '📷',
        'WhatsApp': '💬'
    };
    return icons[platformName] || '🔗';
}

// Toggle Platform
async function togglePlatform(platformId) {
    try {
        const response = await fetch(`${API_BASE}/platforms/${platformId}/toggle`, {
            method: 'POST'
        });
        const platform = await response.json();
        const platformIndex = platforms.findIndex(p => p.id === platformId);
        if (platformIndex !== -1) platforms[platformIndex] = platform;
        renderPlatforms();
        showMessage(`Platform ${platform.connected ? 'connected' : 'disconnected'}`, 'success');
    } catch (error) {
        showMessage('Failed to toggle platform', 'error');
    }
}

// Load Prompts
async function loadPrompts() {
    try {
        const response = await fetch(`${API_BASE}/prompts`);
        prompts = await response.json();
        renderPrompts();
        populatePromptSelect();
    } catch (error) {
        console.error('Failed to load prompts:', error);
    }
}

// Render Prompts
function renderPrompts() {
    const list = document.getElementById('promptsList');
    list.innerHTML = `
        <h3>Saved Prompts</h3>
        ${prompts.map(prompt => `
            <div class="prompt-item">
                <h4>${prompt.name}</h4>
                <p>${prompt.prompt}</p>
            </div>
        `).join('')}
    `;
}

// Populate Prompt Select
function populatePromptSelect() {
    const select = document.getElementById('testPromptSelect');
    select.innerHTML = `
        <option value="">Select a prompt...</option>
        ${prompts.map(prompt => `
            <option value="${prompt.prompt}">${prompt.name}</option>
        `).join('')}
    `;
}

// Add Prompt
async function addPrompt() {
    const name = document.getElementById('promptName').value.trim();
    const promptText = document.getElementById('promptText').value.trim();
    
    if (!name || !promptText) {
        showMessage('Please fill in all fields', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${API_BASE}/prompts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, prompt: promptText })
        });
        
        const newPrompt = await response.json();
        prompts.push(newPrompt);
        renderPrompts();
        populatePromptSelect();
        
        document.getElementById('promptName').value = '';
        document.getElementById('promptText').value = '';
        
        showMessage('Prompt added successfully', 'success');
    } catch (error) {
        showMessage('Failed to add prompt', 'error');
    }
}

// Test AI
async function testAi() {
    const message = document.getElementById('testMessage').value.trim();
    const prompt = document.getElementById('testPromptSelect').value;
    const resultDiv = document.getElementById('testResult');
    
    if (!message) {
        showMessage('Please enter a test message', 'error');
        return;
    }
    
    if (!settings.openRouterApiKey) {
        resultDiv.className = 'test-result show error';
        resultDiv.textContent = 'Please configure your OpenRouter API key in settings first';
        return;
    }
    
    resultDiv.className = 'test-result show';
    resultDiv.innerHTML = '<span class="loading"></span> Testing AI...';
    
    try {
        const response = await fetch(`${API_BASE}/ai/test`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message, prompt })
        });
        
        const result = await response.json();
        
        if (result.success) {
            resultDiv.className = 'test-result show success';
            resultDiv.innerHTML = `<strong>AI Response:</strong><br>${result.response}`;
        } else {
            resultDiv.className = 'test-result show error';
            resultDiv.textContent = `Error: ${result.error}`;
        }
    } catch (error) {
        resultDiv.className = 'test-result show error';
        resultDiv.textContent = `Error: ${error.message}`;
    }
}

// Save Settings
async function saveSettings() {
    const apiKey = document.getElementById('apiKeyInput').value.trim();
    const selectedModel = document.getElementById('modelSelect').value;
    
    try {
        const response = await fetch(`${API_BASE}/settings`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ openRouterApiKey: apiKey, selectedModel })
        });
        
        settings = await response.json();
        showMessage('Settings saved successfully', 'success');
    } catch (error) {
        showMessage('Failed to save settings', 'error');
    }
}

// Show Message
function showMessage(text, type = 'success') {
    const messageDiv = document.getElementById('settingsMessage');
    if (messageDiv) {
        messageDiv.className = `message show ${type}`;
        messageDiv.textContent = text;
        setTimeout(() => {
            messageDiv.className = 'message';
        }, 3000);
    } else {
        // For other pages, use alert as fallback
        alert(text);
    }
}
