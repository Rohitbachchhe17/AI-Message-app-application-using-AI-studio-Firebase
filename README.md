# 🚀 AR Chats – AI Powered Messaging App

An **AI-powered real-time messaging application** built using **Google AI Studio + Firebase Realtime Database**.
The app allows users to **chat with friends, send requests, make calls, and interact with an AI assistant** directly inside the chat interface.

It combines **modern messaging features with Generative AI capabilities** to create a smart communication platform.
<img width="194" height="347" alt="Screenshot 2026-03-06 104226" src="https://github.com/user-attachments/assets/bab9e465-deb4-4786-bac4-d83472649297" />
<img width="677" height="317" alt="Screenshot 2026-03-06 103027" src="https://github.com/user-attachments/assets/6d0f7ada-4d55-4fa4-abd6-d420e1a5f789" />
<img width="189" height="314" alt="Screenshot 2026-03-06 103507" src="https://github.com/user-attachments/assets/4898df49-b416-4127-91d1-0b5897a363c1" />
<img width="200" height="324" alt="Screenshot 2026-03-06 103606" src="https://github.com/user-attachments/assets/89d57497-190f-4a9e-bcfa-fa2d2a6b0d69" />
<img width="197" height="323" alt="Screenshot 2026-03-06 103825" src="https://github.com/user-attachments/assets/254bab68-5969-4783-9bd9-745b0dd9dae0" />
<img width="191" height="314" alt="Screenshot 2026-03-06 103927" src="https://github.com/user-attachments/assets/c29126f8-1bab-4bb9-aa17-6a39f65893e4" />

# Firebase show all data 
<img width="919" height="430" alt="Screenshot 2026-03-06 104703" src="https://github.com/user-attachments/assets/ee92683d-db97-473a-bb27-33e1b844ba81" />
<img width="926" height="434" alt="Screenshot 2026-03-06 104529" src="https://github.com/user-attachments/assets/2dbe50f9-8cce-4cf2-ab4b-ba98429d0a11" />

---

# 📱 App Overview

**AR Chats** is a modern chat application where users can:

* Send real-time messages
* Chat with multiple friends
* Accept or reject friend requests
* Use an **AI Assistant powered by Google AI Studio**
* Track call logs and requests
* Use customizable themes

The backend is powered by **Firebase Realtime Database**, making all messages **instant and synchronized across devices**.

---

# 🧠 AI Features

The application integrates **Google AI Studio (Gemini API)** to provide an intelligent assistant inside the chat app.

### AI Capabilities

* 🤖 AI Chat Assistant
* 📚 Coding help
* ✍️ Content generation
* 🧠 Programming explanations
* 📖 Knowledge Q&A
* 💡 Idea generation
* 🔍 Smart responses inside the app

Users can simply open the **AI tab** and start asking questions.

Example:

User:

```
Explain Python inheritance
```

AI Response:

```
Inheritance allows one class to take properties and methods from another class.
Example:

class Animal:
    def speak(self):
        print("Animal sound")

class Dog(Animal):
    def bark(self):
        print("Woof")

dog = Dog()
dog.speak()
dog.bark()
```

---

# ⚡ Features

### 💬 Messaging

* Real-time chat
* Instant message delivery
* Chat history storage
* Multiple conversations

### 👥 Friends System

* Send friend requests
* Accept / Reject requests
* Manage contacts
* Add unlimited friends

### 📞 Calls

* Call logs tracking
* Voice call interface
* Recent call history

### 🤖 AI Integration

* AI assistant tab
* Ask AI anything
* Coding helper
* Study assistant

### 🎨 Customization

* Multiple theme colors
* Dark UI interface
* Profile avatar

### ☁️ Cloud Backend

Powered by **Firebase Realtime Database**

Database structure example:

```
ai-chat-eb709-default-rtdb

calls
contacts
messages
requests
status
```

---

# 🏗 Architecture

```
Mobile App
   │
   │
Firebase Realtime Database
   │
   ├── messages
   ├── contacts
   ├── requests
   ├── calls
   └── status
   │
Google AI Studio (Gemini API)
   │
AI Assistant Responses
```

---

# 🛠 Tech Stack

Frontend

* Android / Flutter / Web App UI

Backend

* Firebase Realtime Database
* Firebase Authentication

AI

* Google AI Studio
* Gemini API

Other Tools

* JavaScript
* REST APIs
* Cloud Messaging

---

# 🔥 Firebase Configuration

Example Firebase configuration used in the project:

```javascript
import { initializeApp } from "firebase/app";

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "your-project.firebaseapp.com",
  databaseURL: "https://your-project-default-rtdb.firebaseio.com",
  projectId: "your-project-id",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "XXXX",
  appId: "XXXX"
};

const app = initializeApp(firebaseConfig);
```

---

# 📂 Project Structure

```
AR-Chats
│
├── app
│   ├── chat
│   ├── ai
│   ├── requests
│   ├── calls
│   └── settings
│
├── firebase
│   ├── config
│   └── database
│
├── assets
│
└── README.md
```

---

# 📷 App Screenshots

## Chat Interface

<img src="screenshots/chat.png" width="250"/>

## AI Assistant

<img src="screenshots/ai.png" width="250"/>

## Contacts

<img src="screenshots/contacts.png" width="250"/>

## Settings

<img src="screenshots/settings.png" width="250"/>

---

# ⚙️ Installation

### 1️⃣ Clone Repository

```
git clone https://github.com/yourusername/ar-chats.git
```

### 2️⃣ Open Project

```
cd ar-chats
```

### 3️⃣ Add Firebase Config

Add your Firebase credentials in:

```
firebase/config.js
```

### 4️⃣ Run App

For Web:

```
npm install
npm start
```

For Android / Flutter:

```
flutter pub get
flutter run
```

---

# 🔐 Security

* Firebase authentication supported
* Database rules for protected access
* User-based message storage

Example rule:

```
{
 "rules": {
   "messages": {
      ".read": "auth != null",
      ".write": "auth != null"
   }
 }
}
```

---

# 🌍 Future Improvements

* Video calling
* Group chats
* Voice messages
* AI auto reply
* Smart chat summarization
* AI translation
* File sharing

---

# 👨‍💻 Author

**Rohit**

AI Developer | Data Analyst | Automation Engineer

GitHub
LinkedIn

---

# ⭐ Support

If you like this project, please ⭐ the repository on GitHub.

It helps others discover the project.
