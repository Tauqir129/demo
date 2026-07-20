# Social Media Chat Manager

A web application like Metricool/Meta Business Suite that allows you to manage chats from multiple social media platforms (Facebook, Instagram, WhatsApp) from one place with AI-powered responses.

## Features

- **Multi-Platform Support**: Connect and manage Facebook, Instagram, and WhatsApp accounts
- **Unified Inbox**: Handle all chats from different platforms in one interface
- **AI-Powered Responses**: 
  - Global AI on/off toggle
  - Per-chat AI on/off toggle
  - OpenRouter API integration with multiple model support
  - Custom prompt library
  - AI response testing page
- **Model Selection**: Choose from various AI models (GPT-3.5, GPT-4, Claude, Gemini, Llama, etc.)
- **Prompt Management**: Create, save, and test custom AI prompts

## Tech Stack

- **Backend**: Node.js, Express
- **Frontend**: HTML, CSS, Vanilla JavaScript
- **AI Integration**: OpenRouter API

## Installation

1. Install dependencies:
```bash
npm install
```

2. Start the server:
```bash
npm start
```

3. Open your browser and navigate to:
```
http://localhost:3000
```

## Configuration

### Setting up OpenRouter API

1. Get your API key from [OpenRouter](https://openrouter.ai)
2. Go to Settings page in the app
3. Enter your API key
4. Select your preferred AI model
5. Click "Save Settings"

### Using AI Features

1. **Global AI Toggle**: Use the switch in the sidebar to enable/disable AI globally
2. **Per-Chat AI**: Each chat has its own AI toggle in the chat header
3. **AI Message Generation**: Check "Use AI to generate response" when sending a message
4. **Test AI Responses**: Go to AI Prompts page to test different prompts

## API Endpoints

- `GET /api/chats` - Get all chats
- `GET /api/chats/:id` - Get single chat
- `POST /api/chats/:id/messages` - Send message (with optional AI response)
- `PATCH /api/chats/:id/ai` - Toggle AI for specific chat
- `GET /api/platforms` - Get all platforms
- `POST /api/platforms/:id/toggle` - Connect/disconnect platform
- `GET /api/settings` - Get settings
- `POST /api/settings` - Update settings
- `GET /api/models` - Get available AI models
- `GET /api/prompts` - Get AI prompts
- `POST /api/prompts` - Add new prompt
- `POST /api/ai/test` - Test AI with a message and prompt

## Project Structure

```
/workspace
├── server/
│   └── index.js          # Backend server
├── public/
│   ├── index.html        # Main HTML file
│   ├── styles.css        # Stylesheet
│   └── app.js            # Frontend JavaScript
├── package.json
└── README.md
```

## Demo Data

The app comes with demo data including:
- 3 sample chats (Facebook, Instagram, WhatsApp)
- 3 pre-configured AI prompts
- 6 available AI models

## Notes

- This is a demo application using in-memory storage. For production use, implement a database.
- Platform connections are simulated. Integrate actual platform APIs for real functionality.
- The app runs on port 3000 by default.

## License

ISC
