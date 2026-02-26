# Legal Advisor Bot

A full-stack, AI-powered web application that serves as a professional legal advisor based in India. It utilizes natural language processing to explain Indian laws and documents clearly, logically, and simply. It is capable of storing chat histories and managing user authentication securely.

---

## 🚀 Technologies Used
* **Frontend:** Next.js, React, Tailwind CSS
* **Backend:** Node.js, Express.js
* **Database:** MongoDB (with Mongoose)
* **AI Provider:** OpenRouter API (using `openrouter/free` model)

## 📁 Project Architecture
The repository is split into two independent folders for the client and server.

### Backend (`/Backend`)
The backend is an Express API that handles security, data logic, and AI integrations.
* **Authentication**: Users must create an account. Passwords are encrypted using `bcryptjs` before hitting the database. Access is controlled via `jsonwebtoken` (JWT).
* **AI Steaming**: A live connection to OpenRouter. We use Server-Sent Events (SSE) to stream the AI response token-by-token directly to the client to emulate real-time typing.
* **MongoDB Modals**: 
  - `User.js` (Manages login/registration data)
  - `Conversation.js` (Stores arrays of previous message histories)

### Frontend (`/frontend`)
The frontend is built using Next.js.
* **State Management**: Uses React state to manage active conversations securely.
* **Design Systems**: Built seamlessly using standard Vanilla CSS and Tailwind CSS classes to emulate modern application design.
* **API Communication**: The frontend attaches the JWT token to every request securely so users can fetch previous chats or create new ones dynamically.

---

## ⚙️ How to Run Locally

### 1. Prerequisites
Ensure you have the following installed on your machine:
* [Node.js](https://nodejs.org/)
* [MongoDB](https://www.mongodb.com/try/download/community) (running locally or a cloud Atlas URI)
* An API key from [OpenRouter](https://openrouter.ai/)

### 2. Backend Setup
1. Open a terminal and navigate to the backend folder:
   ```bash
   cd Backend
   ```
2. Install NodeJS dependencies:
   ```bash
   npm install
   ```
3. Create a `.env` file inside the `Backend/` directory and add your secret keys:
   ```env
   # Backend/.env
   MONGO_URI=your_mongodb_connection_string
   JWT_SECRET=your_super_secret_jwt_key
   OPENROUTER_API_KEY=your_openrouter_api_key
   ```
4. Start the Express server:
   ```bash
   node index.js
   ```
   *The server should now be running on `http://localhost:5000`*

### 3. Frontend Setup
1. Open a **new** terminal window and navigate to the frontend folder:
   ```bash
   cd frontend
   ```
2. Install Next.js dependencies:
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```
   *The frontend should now be running on `http://localhost:3000`*

---

> **Note**: This application provides AI-generated information for **educational purposes only**. It does not substitute professional legal counsel.
