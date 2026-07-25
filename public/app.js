// Social Chat Hub - Production JavaScript
class SocialChatHub {
    constructor() {
        this.apiBase = '/api';
        this.currentChat = null;
        this.chats = [];
        this.platforms = [];
        this.prompts = [];
        this.settings = {};
        this.init();
    }

    async init() {
        this.setupEventListeners();
        await this.loadData();
        this.renderChats();
        this.renderPlatforms();
        this.renderPrompts();
        this.updateSettingsUI();
        this.updateAnalytics();
        this.startAutoRefresh();
    }

    async api(endpoint, options = {}) {
        try {
            const response = await fetch(`${this.apiBase}${endpoint}`, {
                ...options,
                headers: { 'Content-Type': 'application/json', ...options.headers }
            });
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.json();
        } catch (error) {
            console.error('API Error:', error);
            throw error;
        }
    }

    async loadData() {
        try {
            const data = await this.api('/data');
            this.chats = data.chats || [];
            this.platforms = data.platforms || [];
            this.prompts = data.prompts || [];
            this.settings = data.settings || {};
            this.updateUnreadBadge();
        } catch (error) {
            this.showToast('Failed to load data', 'error');
        }
    }

    setupEventListeners() {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                this.navigateTo(item.dataset.page);
            });
        });

        document.getElementById('mobileMenuToggle')?.addEventListener('click', () => {
            document.getElementById('sidebar').classList.toggle('active');
        });

        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.renderChats(e.target.dataset.filter);
            });
        });

        document.getElementById('platformFilter')?.addEventListener('change', (e) => {
            this.renderChats(null, e.target.value);
        });

        document.getElementById('chatSearch')?.addEventListener('input', (e) => {
            this.renderChats(null, null, e.target.value);
        });

        document.getElementById('sendBtn')?.addEventListener('click', () => this.sendMessage());
        document.getElementById('messageInput')?.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        document.getElementById('messageInput')?.addEventListener('input', function() {
            this.style.height = 'auto';
            this.style.height = Math.min(this.scrollHeight, 150) + 'px';
        });

        document.querySelectorAll('.quick-reply-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                document.getElementById('messageInput').value = btn.dataset.text;
                document.getElementById('messageInput').focus();
            });
        });

        document.getElementById('aiGenerateBtn')?.addEventListener('click', () => this.generateAIResponse());
        document.getElementById('globalAiToggle')?.addEventListener('change', (e) => this.toggleGlobalAI(e.target.checked));
        document.getElementById('chatAiToggle')?.addEventListener('change', (e) => {
            if (this.currentChat) this.toggleChatAI(this.currentChat.id, e.target.checked);
        });
        document.getElementById('saveSettingsBtn')?.addEventListener('click', () => this.saveSettings());
        document.getElementById('refreshModelsBtn')?.addEventListener('click', () => this.fetchModels());
        document.getElementById('testAiBtn')?.addEventListener('click', () => this.testAIResponse());
        document.getElementById('confirmConnectBtn')?.addEventListener('click', () => this.confirmConnectPlatform());
        document.getElementById('savePromptBtn')?.addEventListener('click', () => this.savePrompt());
        
        document.getElementById('darkModeToggle')?.addEventListener('change', (e) => {
            document.body.classList.toggle('dark-mode', e.target.checked);
            localStorage.setItem('darkMode', e.target.checked);
        });

        if (localStorage.getItem('darkMode') === 'true') {
            document.body.classList.add('dark-mode');
            document.getElementById('darkModeToggle').checked = true;
        }
    }

    navigateTo(page) {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.toggle('active', item.dataset.page === page);
        });
        document.querySelectorAll('.page').forEach(p => {
            p.classList.toggle('active', p.id === `${page}Page`);
        });
        document.getElementById('sidebar').classList.remove('active');
    }

    renderChats(filter = 'all', platform = '', search = '') {
        const chatList = document.getElementById('chatList');
        if (!chatList) return;

        let filteredChats = [...this.chats];
        if (filter === 'unread') filteredChats = filteredChats.filter(c => c.unread > 0);
        if (platform) filteredChats = filteredChats.filter(c => c.platform === platform);
        if (search) {
            const s = search.toLowerCase();
            filteredChats = filteredChats.filter(c => 
                c.customerName.toLowerCase().includes(s) || c.lastMessage.toLowerCase().includes(s)
            );
        }

        filteredChats.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        if (filteredChats.length === 0) {
            chatList.innerHTML = '<div class="empty-state" style="padding:2rem;"><i class="fas fa-inbox"></i><p>No conversations found</p></div>';
            return;
        }

        chatList.innerHTML = filteredChats.map(chat => `
            <div class="chat-item ${this.currentChat?.id === chat.id ? 'active' : ''}" data-chat-id="${chat.id}" onclick="app.selectChat('${chat.id}')">
                <div class="chat-item-avatar">
                    <img src="${chat.customerAvatar}" alt="${chat.customerName}">
                    <span class="chat-item-platform ${chat.platform}">
                        <i class="fab fa-${chat.platform === 'whatsapp' ? 'whatsapp' : chat.platform === 'facebook' ? 'facebook-f' : 'instagram'}"></i>
                    </span>
                </div>
                <div class="chat-item-content">
                    <div class="chat-item-header">
                        <span class="chat-item-name">${chat.customerName}</span>
                        <span class="chat-item-time">${this.formatTime(chat.timestamp)}</span>
                    </div>
                    <div class="chat-item-message">${chat.lastMessage || 'No messages yet'}</div>
                    ${chat.unread > 0 ? `<div class="chat-item-meta"><span class="chat-item-unread">${chat.unread}</span></div>` : ''}
                </div>
            </div>
        `).join('');
    }

    async selectChat(chatId) {
        this.currentChat = this.chats.find(c => c.id === chatId);
        if (!this.currentChat) return;

        document.getElementById('emptyState').style.display = 'none';
        document.getElementById('chatWindow').style.display = 'flex';
        document.getElementById('chatAvatar').src = this.currentChat.customerAvatar;
        document.getElementById('chatCustomerName').textContent = this.currentChat.customerName;
        document.getElementById('chatPlatformBadge').className = `platform-badge ${this.currentChat.platform}`;
        document.getElementById('chatPlatformBadge').innerHTML = `<i class="fab fa-${this.currentChat.platform === 'whatsapp' ? 'whatsapp' : this.currentChat.platform === 'facebook' ? 'facebook-f' : 'instagram'}"></i>`;
        document.getElementById('chatAiToggle').checked = this.currentChat.aiEnabled;

        this.renderMessages();

        if (this.currentChat.unread > 0) {
            this.currentChat.unread = 0;
            await this.api(`/api/chats/${chatId}`, { method: 'PUT', body: JSON.stringify({ unread: 0 }) });
            this.updateUnreadBadge();
        }

        document.querySelectorAll('.chat-item').forEach(item => {
            item.classList.toggle('active', item.dataset.chatId === chatId);
        });
        this.scrollToBottom();
    }

    renderMessages() {
        const messagesList = document.getElementById('messagesList');
        if (!messagesList || !this.currentChat) return;

        messagesList.innerHTML = this.currentChat.messages.map(msg => `
            <div class="message ${msg.sender}">
                <img src="${msg.sender === 'customer' ? this.currentChat.customerAvatar : 'https://ui-avatars.com/api/?name=Agent&background=6366f1&color=fff'}" alt="${msg.sender}" class="message-avatar">
                <div class="message-content">
                    <div class="message-bubble">${this.escapeHtml(msg.text)}</div>
                    <div class="message-time">${this.formatTime(msg.timestamp)}</div>
                </div>
            </div>
        `).join('');
        this.scrollToBottom();
    }

    async sendMessage() {
        const input = document.getElementById('messageInput');
        const text = input.value.trim();
        if (!text || !this.currentChat) return;

        try {
            const result = await this.api(`/api/chats/${this.currentChat.id}/messages`, {
                method: 'POST',
                body: JSON.stringify({ text, sender: 'agent' })
            });
            this.currentChat = result.chat;
            this.currentChat.messages.push(result.message);
            input.value = '';
            input.style.height = 'auto';
            this.renderMessages();
            this.renderChats();
            this.scrollToBottom();
        } catch (error) {
            this.showToast('Failed to send message', 'error');
        }
    }

    async generateAIResponse() {
        if (!this.currentChat) return;
        const lastCustomerMessage = [...this.currentChat.messages].reverse().find(m => m.sender === 'customer');
        if (!lastCustomerMessage) {
            this.showToast('No customer message to reply to', 'warning');
            return;
        }

        this.showLoading(true);
        try {
            const result = await this.api('/api/ai/generate', {
                method: 'POST',
                body: JSON.stringify({ message: lastCustomerMessage.text, chatId: this.currentChat.id })
            });
            document.getElementById('messageInput').value = result.response;
            document.getElementById('messageInput').focus();
            this.showToast('AI response generated! Review and send.', 'success');
        } catch (error) {
            this.showToast(error.message || 'Failed to generate AI response', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async toggleGlobalAI(enabled) {
        try {
            await this.api('/api/settings', { method: 'PUT', body: JSON.stringify({ globalAiEnabled: enabled }) });
            this.settings.globalAiEnabled = enabled;
            this.showToast(`Global AI ${enabled ? 'enabled' : 'disabled'}`, 'success');
        } catch (error) {
            this.showToast('Failed to update AI settings', 'error');
        }
    }

    async toggleChatAI(chatId, enabled) {
        try {
            await this.api(`/api/chats/${chatId}/ai-toggle`, { method: 'PUT', body: JSON.stringify({ aiEnabled: enabled }) });
            const chat = this.chats.find(c => c.id === chatId);
            if (chat) chat.aiEnabled = enabled;
            this.showToast(`AI ${enabled ? 'enabled' : 'disabled'} for this chat`, 'success');
        } catch (error) {
            this.showToast('Failed to update chat AI settings', 'error');
        }
    }

    renderPlatforms() {
        ['facebook', 'instagram', 'whatsapp'].forEach(platform => {
            const isConnected = this.platforms.some(p => p.platform === platform);
            const statusEl = document.getElementById(`${platform}Status`);
            if (statusEl) {
                statusEl.innerHTML = `<span class="status-indicator ${isConnected ? 'connected' : 'disconnected'}"></span><span class="status-text">${isConnected ? 'Connected' : 'Not Connected'}</span>`;
            }
        });

        const accountsList = document.getElementById('accountsList');
        if (accountsList) {
            if (this.platforms.length === 0) {
                accountsList.innerHTML = '<p style="color:var(--gray-500);text-align:center;padding:1rem;">No platforms connected yet</p>';
            } else {
                accountsList.innerHTML = this.platforms.map(platform => `
                    <div class="account-item">
                        <div class="account-info">
                            <div class="account-icon ${platform.platform}">
                                <i class="fab fa-${platform.platform === 'whatsapp' ? 'whatsapp' : platform.platform === 'facebook' ? 'facebook-f' : 'instagram'}"></i>
                            </div>
                            <div class="account-details">
                                <h4>${platform.pageName}</h4>
                                <p>Connected ${this.formatDate(platform.connectedAt)}</p>
                            </div>
                        </div>
                        <div class="account-actions">
                            <button class="btn btn-secondary" onclick="app.disconnectPlatform('${platform.id}')">
                                <i class="fas fa-unlink"></i> Disconnect
                            </button>
                        </div>
                    </div>
                `).join('');
            }
        }
    }

    async confirmConnectPlatform() {
        const platform = document.getElementById('connectPlatform').value;
        const accessToken = document.getElementById('accessToken').value.trim();
        const pageId = document.getElementById('pageId').value.trim();
        const pageName = document.getElementById('pageName').value.trim();

        if (!accessToken || !pageId || !pageName) {
            this.showToast('Please fill in all fields', 'warning');
            return;
        }

        this.showLoading(true);
        try {
            await this.api('/api/platforms/connect', {
                method: 'POST',
                body: JSON.stringify({ platform, accessToken, pageId, pageName })
            });
            await this.loadData();
            this.renderPlatforms();
            this.closeConnectModal();
            this.showToast('Platform connected successfully!', 'success');
        } catch (error) {
            this.showToast('Failed to connect platform', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async disconnectPlatform(platformId) {
        if (!confirm('Are you sure you want to disconnect this platform?')) return;
        try {
            await this.api(`/api/platforms/${platformId}`, { method: 'DELETE' });
            await this.loadData();
            this.renderPlatforms();
            this.showToast('Platform disconnected', 'success');
        } catch (error) {
            this.showToast('Failed to disconnect platform', 'error');
        }
    }

    renderPrompts() {
        const promptsList = document.getElementById('promptsList');
        const testPromptSelect = document.getElementById('testPromptSelect');
        
        if (promptsList) {
            if (this.prompts.length === 0) {
                promptsList.innerHTML = '<p style="color:var(--gray-500);text-align:center;padding:1rem;">No prompts created yet</p>';
            } else {
                promptsList.innerHTML = this.prompts.map(prompt => `
                    <div class="prompt-card">
                        <div class="prompt-card-header">
                            <h4>${prompt.name} ${prompt.isActive ? '<span class="prompt-active-badge">Active</span>' : ''}</h4>
                            <div class="prompt-card-actions">
                                <button onclick="app.editPrompt('${prompt.id}')"><i class="fas fa-edit"></i></button>
                                <button onclick="app.deletePrompt('${prompt.id}')"><i class="fas fa-trash"></i></button>
                            </div>
                        </div>
                        <p>${prompt.content}</p>
                    </div>
                `).join('');
            }
        }

        if (testPromptSelect) {
            testPromptSelect.innerHTML = '<option value="">Use Default System Prompt</option>' +
                this.prompts.filter(p => p.isActive).map(p => `<option value="${p.content}">${p.name}</option>`).join('');
        }
    }

    async savePrompt() {
        const editId = document.getElementById('editPromptId').value;
        const name = document.getElementById('promptName').value.trim();
        const content = document.getElementById('promptContent').value.trim();
        const isActive = document.getElementById('promptActive').checked;

        if (!name || !content) {
            this.showToast('Please fill in all fields', 'warning');
            return;
        }

        try {
            if (editId) {
                await this.api(`/api/prompts/${editId}`, { method: 'PUT', body: JSON.stringify({ name, content, isActive }) });
            } else {
                await this.api('/api/prompts', { method: 'POST', body: JSON.stringify({ name, content, isActive }) });
            }
            await this.loadData();
            this.renderPrompts();
            this.closePromptModal();
            this.showToast('Prompt saved successfully!', 'success');
        } catch (error) {
            this.showToast('Failed to save prompt', 'error');
        }
    }

    editPrompt(promptId) {
        const prompt = this.prompts.find(p => p.id === promptId);
        if (!prompt) return;
        document.getElementById('editPromptId').value = prompt.id;
        document.getElementById('promptName').value = prompt.name;
        document.getElementById('promptContent').value = prompt.content;
        document.getElementById('promptActive').checked = prompt.isActive;
        document.getElementById('promptModalTitle').textContent = 'Edit Prompt';
        document.getElementById('promptModal').classList.add('active');
    }

    async deletePrompt(promptId) {
        if (!confirm('Are you sure you want to delete this prompt?')) return;
        try {
            await this.api(`/api/prompts/${promptId}`, { method: 'DELETE' });
            await this.loadData();
            this.renderPrompts();
            this.showToast('Prompt deleted', 'success');
        } catch (error) {
            this.showToast('Failed to delete prompt', 'error');
        }
    }

    async testAIResponse() {
        const message = document.getElementById('testMessage').value.trim();
        const customPrompt = document.getElementById('testPromptSelect').value;

        if (!message) {
            this.showToast('Please enter a test message', 'warning');
            return;
        }

        this.showLoading(true);
        try {
            const result = await this.api('/api/ai/generate', {
                method: 'POST',
                body: JSON.stringify({ message, customPrompt, chatId: this.chats[0]?.id })
            });
            document.getElementById('responseContent').textContent = result.response;
            document.getElementById('responseMeta').textContent = `Model: ${result.model} | Tokens: ${result.usage?.total_tokens || 'N/A'}`;
            document.getElementById('testResult').style.display = 'block';
            this.showToast('AI response generated!', 'success');
        } catch (error) {
            this.showToast(error.message || 'Failed to generate AI response', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    async saveSettings() {
        const openRouterApiKey = document.getElementById('openRouterApiKey').value.trim();
        const selectedModel = document.getElementById('modelSelect').value;

        try {
            await this.api('/api/settings', { method: 'PUT', body: JSON.stringify({ openRouterApiKey, selectedModel }) });
            this.settings.openRouterApiKey = openRouterApiKey;
            this.settings.selectedModel = selectedModel;
            this.showToast('Settings saved successfully!', 'success');
        } catch (error) {
            this.showToast('Failed to save settings', 'error');
        }
    }

    async fetchModels() {
        const apiKey = document.getElementById('openRouterApiKey').value.trim();
        if (!apiKey) {
            this.showToast('Please enter your API key first', 'warning');
            return;
        }

        this.showLoading(true);
        try {
            const currentKey = this.settings.openRouterApiKey;
            this.settings.openRouterApiKey = apiKey;
            const result = await this.api('/api/ai/models');
            
            if (result.models && result.models.length > 0) {
                const modelSelect = document.getElementById('modelSelect');
                modelSelect.innerHTML = result.models.slice(0, 20).map(model => 
                    `<option value="${model.id}">${model.name || model.id}</option>`
                ).join('');
                this.showToast(`Loaded ${result.models.length} models`, 'success');
            } else {
                this.showToast('No models found', 'warning');
            }
            this.settings.openRouterApiKey = currentKey;
        } catch (error) {
            this.showToast('Failed to fetch models. Check your API key.', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    updateSettingsUI() {
        document.getElementById('openRouterApiKey').value = this.settings.openRouterApiKey || '';
        document.getElementById('modelSelect').value = this.settings.selectedModel || 'openai/gpt-3.5-turbo';
        document.getElementById('globalAiToggle').checked = this.settings.globalAiEnabled !== false;
    }

    updateAnalytics() {
        document.getElementById('totalConversations').textContent = this.chats.length;
        document.getElementById('resolvedToday').textContent = Math.floor(this.chats.length * 0.7);
        document.getElementById('avgResponseTime').textContent = '< 5m';
        const aiResponsesCount = this.chats.reduce((sum, chat) => sum + chat.messages.filter(m => m.sender === 'agent').length, 0);
        document.getElementById('aiResponses').textContent = aiResponsesCount;
    }

    updateUnreadBadge() {
        const totalUnread = this.chats.reduce((sum, chat) => sum + chat.unread, 0);
        const badge = document.getElementById('unreadBadge');
        if (badge) {
            badge.textContent = totalUnread;
            badge.style.display = totalUnread > 0 ? 'inline-block' : 'none';
        }
    }

    showConnectModal(platform) {
        document.getElementById('connectPlatform').value = platform;
        document.getElementById('connectModalTitle').textContent = `Connect ${platform.charAt(0).toUpperCase() + platform.slice(1)}`;
        
        const steps = {
            facebook: [
                'Go to Meta for Developers (developers.facebook.com)',
                'Create a new app or select existing one',
                'Add Facebook Login product',
                'Get Page Access Token with pages_manage_metadata, pages_read_engagement permissions',
                'Paste the token above'
            ],
            instagram: [
                'Ensure you have an Instagram Business account',
                'Link it to a Facebook Page',
                'Get Page Access Token with instagram_basic, pages_show_list permissions',
                'The token will also work for Instagram',
                'Paste the token above'
            ],
            whatsapp: [
                'Go to Meta for Developers',
                'Create WhatsApp Business App',
                'Get System User Access Token',
                'Add your phone number in WhatsApp Manager',
                'Paste the token and phone number ID above'
            ]
        };

        document.getElementById('oauthSteps').innerHTML = steps[platform]?.map(step => `<li>${step}</li>`).join('') || '';
        document.getElementById('connectModal').classList.add('active');
    }

    closeConnectModal() {
        document.getElementById('connectModal').classList.remove('active');
        document.getElementById('connectForm').reset();
    }

    showPromptModal() {
        document.getElementById('editPromptId').value = '';
        document.getElementById('promptName').value = '';
        document.getElementById('promptContent').value = '';
        document.getElementById('promptActive').checked = true;
        document.getElementById('promptModalTitle').textContent = 'Create Prompt';
        document.getElementById('promptModal').classList.add('active');
    }

    closePromptModal() {
        document.getElementById('promptModal').classList.remove('active');
    }

    formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = now - date;
        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }

    formatDate(timestamp) {
        return new Date(timestamp).toLocaleDateString([], { year: 'numeric', month: 'long', day: 'numeric' });
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    scrollToBottom() {
        const container = document.getElementById('messagesContainer');
        if (container) container.scrollTop = container.scrollHeight;
    }

    showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        const icons = { success: 'check-circle', error: 'exclamation-circle', warning: 'exclamation-triangle', info: 'info-circle' };
        
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `<i class="fas fa-${icons[type]} toast-icon"></i><span class="toast-message">${message}</span><button class="toast-close" onclick="this.parentElement.remove()"><i class="fas fa-times"></i></button>`;
        
        container.appendChild(toast);
        setTimeout(() => {
            toast.style.animation = 'toastSlideIn 0.3s ease reverse';
            setTimeout(() => toast.remove(), 300);
        }, 5000);
    }

    showLoading(show) {
        const overlay = document.getElementById('loadingOverlay');
        if (overlay) overlay.classList.toggle('active', show);
    }

    startAutoRefresh() {
        setInterval(async () => {
            await this.loadData();
            this.renderChats();
            this.updateAnalytics();
        }, 30000);
    }
}

const app = new SocialChatHub();

function showConnectModal(platform) { app.showConnectModal(platform); }
function closeConnectModal() { app.closeConnectModal(); }
function showPromptModal() { app.showPromptModal(); }
function closePromptModal() { app.closePromptModal(); }
function toggleApiKeyVisibility() {
    const input = document.getElementById('openRouterApiKey');
    input.type = input.type === 'password' ? 'text' : 'password';
}
