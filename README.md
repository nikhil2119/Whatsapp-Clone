# WhatsApp Clone

A real-time WhatsApp Web clone built with **React**, **TypeScript**, **Tailwind CSS**, **Firebase** (Authentication & Realtime Database), and **Cloudinary** with client-side **AES-256-GCM** media encryption.

---

## Features

- **Authentication & Session Persistence**
  - Email/Password Sign Up & Login with Firebase Authentication
  - Protected routes (`RestrictToLoggedinUserOnly` / `RestrictLoggedInUsers`) with a WhatsApp-style loading screen
  - Persistent login in normal browser windows (`IndexedDB`) and automatic logout when incognito windows close
- **Real-Time Private Chats**
  - Start new 1-on-1 conversations or search existing chats
  - Live unread message counters in the sidebar and navigation rail
  - Read receipts with double ticks (grey → blue when read)
- **Presence & Last Seen**
  - Multi-tab online/offline tracking using Firebase `.info/connected` and `onDisconnect`
  - Live `"online"` indicator and formatted `"last seen ..."` timestamps
- **Group Chats**
  - Create groups with a name, optional description, and initial members
  - Join existing groups via an auto-generated 8-character invite code (with one-click copy)
  - Leave group support with atomic system messages (`created`, `joined`, `left`)
  - Live unread badges on both the group list and Groups navigation tab
  - **Group Read Receipts:** Double ticks turn blue when all group members have read the message, plus a **Message Info** modal showing **"Read by"** (with timestamps) and **"Delivered to"**
- **Encrypted Media Sharing & Voice Notes**
  - Send **Images** (with fullscreen lightbox), **Videos**, **Documents** (PDF, DOCX, ZIP, etc., up to 10 MB), and **Voice Notes** recorded via the browser `MediaRecorder` API
  - **Client-Side AES-256-GCM Encryption:** Files and voice notes are encrypted in the browser using the Web Crypto API before uploading to Cloudinary (`/raw/upload`), and decrypted in memory on the receiver's browser
  - Upload progress bar and attachment preview with optional captions
- **UI & Theming**
  - Light & Dark mode toggle
  - Responsive desktop and mobile layout

---

## Tech Stack

- **Frontend:** React 19, TypeScript, Vite, Tailwind CSS v4, React Router v7, Lucide React
- **Backend / Realtime:** Firebase Authentication, Firebase Realtime Database
- **Media Storage & HTTP:** Cloudinary (Unsigned Upload Preset), Axios, Browser Web Crypto API (`AES-GCM`), Browser `MediaRecorder` API

---

## Project Structure

```text
src/
├── components/
│   ├── dashboard.tsx         # Main chat, group, media & voice UI
│   ├── EncryptedMedia.tsx    # Client-side decryption & media renderer
│   ├── groupChat.tsx         # Create/Join group modals & invite badge
│   ├── login.tsx             # Login page
│   ├── register.tsx          # Registration page
│   ├── themeToggle.tsx       # Dark/Light theme switcher
│   └── WhatsAppLogo.tsx      # SVG brand icon
├── context/
│   ├── AuthContext.tsx
│   ├── AuthProvider.tsx      # Auth listener & presence lifecycle
│   ├── ThemeContext.tsx
│   └── ThemeProvider.tsx
├── hooks/
│   ├── useAuth.tsx
│   └── useTheme.tsx
├── services/
│   ├── chatService.tsx       # Private chat & read receipt operations
│   ├── firebase.ts           # Firebase app, auth & database init
│   ├── groupChatService.tsx  # Group create, join, leave, unread & read receipts
│   ├── presenceService.ts    # Multi-tab online/lastOnline tracking
│   ├── ProtectedRoute.tsx    # Route guards & loading screen
│   ├── storageService.ts     # AES-256-GCM encrypt/decrypt & Cloudinary upload
│   └── userService.tsx       # User profile & directory subscription
├── App.tsx
├── index.css
└── main.tsx
```

---

## Getting Started

### 1. Clone & Install

```bash
git clone <your-repo-url>
cd Whatsapp-Clone
npm install
```

### 2. Environment Variables

Create a `.env` file in the project root:

```env
# Firebase Configuration
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_DATABASE_URL=https://your_project-default-rtdb.firebaseio.com

# Cloudinary Configuration (Unsigned Upload Preset)
VITE_CLOUDINARY_CLOUD_NAME=your_cloudinary_cloud_name
VITE_CLOUDINARY_UPLOAD_PRESET=your_unsigned_upload_preset
```

### 3. Firebase Setup

1. Enable **Email/Password** sign-in under **Firebase Console → Authentication → Sign-in method**.
2. Create a **Realtime Database** under **Firebase Console → Build → Realtime Database**.
3. Paste the security rules into **Realtime Database → Rules** and publish:

<details>
<summary>Firebase Realtime Database Rules</summary>

```json
{
  "rules": {
    ".read": false,
    ".write": false,

    "users": {
      ".read": "auth != null",
      "$uid": {
        ".write": "auth != null && auth.uid === $uid",
        ".validate": "newData.hasChildren(['username', 'email', 'createdAt'])",
        "username": {
          ".validate": "newData.isString() && newData.val().length <= 50"
        },
        "email": {
          ".validate": "newData.isString() && newData.val().length <= 254"
        },
        "createdAt": {
          ".validate": "newData.isNumber()"
        },
        "$other": {
          ".validate": false
        }
      }
    },

    "chat_room": {
      "$chatId": {
        ".read": "auth != null && (!data.exists() || data.child('participants').child(auth.uid).val() === true)",
        ".write": "auth != null && !data.exists() && newData.child('participants').child(auth.uid).val() === true && newData.child('participants').hasChildren()",
        ".validate": "newData.hasChildren(['type', 'participants', 'createdAt', 'lastMessage', 'lastMessageAt'])",
        "type": {
          ".validate": "newData.isString() && newData.val() === 'private'"
        },
        "participants": {
          ".validate": "newData.hasChildren()",
          "$participantUid": {
            ".validate": "newData.val() === true"
          }
        },
        "createdAt": {
          ".validate": "newData.isNumber()"
        },
        "lastMessage": {
          ".write": "auth != null && root.child('chat_room').child($chatId).child('participants').child(auth.uid).val() === true",
          ".validate": "newData.isString() && newData.val().length <= 5000"
        },
        "lastMessageAt": {
          ".write": "auth != null && root.child('chat_room').child($chatId).child('participants').child(auth.uid).val() === true",
          ".validate": "newData.isNumber()"
        },
        "$other": {
          ".validate": false
        }
      }
    },

    "messages": {
      "$chatId": {
        ".read": "auth != null && (root.child('chat_room').child($chatId).child('participants').child(auth.uid).val() === true || root.child('group_chats').child($chatId).child('participants').child(auth.uid).val() === true)",
        "$messageId": {
          ".write": "auth != null && !data.exists() && newData.child('senderId').val() === auth.uid && (root.child('chat_room').child($chatId).child('participants').child(auth.uid).val() === true || root.child('group_chats').child($chatId).child('participants').child(auth.uid).val() === true)",
          ".validate": "newData.hasChildren(['senderId', 'text', 'createdAt']) && (newData.child('text').val().length > 0 || newData.hasChild('mediaUrl'))",
          "senderId": {
            ".validate": "newData.isString() && newData.val() === auth.uid"
          },
          "text": {
            ".validate": "newData.isString() && newData.val().length <= 5000"
          },
          "createdAt": {
            ".validate": "newData.isNumber()"
          },
          "isSystem": {
            ".validate": "newData.isBoolean()"
          },
          "mediaUrl": {
            ".validate": "newData.isString()"
          },
          "mediaType": {
            ".validate": "newData.isString() && (newData.val() === 'image' || newData.val() === 'video' || newData.val() === 'audio' || newData.val() === 'file')"
          },
          "fileName": {
            ".validate": "newData.isString() && newData.val().length <= 255"
          },
          "fileSize": {
            ".validate": "newData.isNumber()"
          },
          "mediaKey": {
            ".validate": "newData.isString()"
          },
          "mediaIv": {
            ".validate": "newData.isString()"
          },
          "mimeType": {
            ".validate": "newData.isString() && newData.val().length <= 150"
          },
          "$other": {
            ".validate": false
          }
        }
      }
    },

    "userChats": {
      "$uid": {
        ".read": "auth != null && auth.uid === $uid",
        "$chatId": {
          "otherUserId": {
            ".write": "auth != null && (!data.exists() || data.val() === newData.val()) && newData.isString() && root.child('chat_room').child($chatId).child('participants').child(auth.uid).val() === true && root.child('chat_room').child($chatId).child('participants').child($uid).val() === true && root.child('chat_room').child($chatId).child('participants').child(newData.val()).val() === true && newData.val() !== $uid",
            ".validate": "newData.isString()"
          },
          "lastReadAt": {
            ".read": "auth != null && root.child('chat_room').child($chatId).child('participants').child(auth.uid).val() === true && root.child('chat_room').child($chatId).child('participants').child($uid).val() === true",
            ".write": "auth != null && auth.uid === $uid && root.child('chat_room').child($chatId).child('participants').child($uid).val() === true && newData.isNumber()",
            ".validate": "newData.isNumber()"
          },
          "$other": {
            ".validate": false
          }
        }
      }
    },

    "presence": {
      "$uid": {
        ".read": "auth != null",
        ".write": "auth != null && auth.uid === $uid",
        "connections": {
          "$connectionId": {
            ".validate": "newData.isBoolean() && newData.val() === true"
          }
        },
        "lastOnline": {
          ".validate": "newData.isNumber()"
        },
        "$other": {
          ".validate": false
        }
      }
    },

    "group_chats": {
      ".read": "auth != null",
      "$groupId": {
        ".write": "auth != null && !data.exists() && newData.child('createdBy').val() === auth.uid && newData.child('participants').child(auth.uid).val() === true",
        ".validate": "newData.hasChildren(['name', 'description', 'createdBy', 'createdAt', 'participants', 'lastMessage', 'lastMessageAt', 'lastMessageSender', 'inviteCode'])",
        "name": {
          ".validate": "newData.isString() && newData.val().length > 0 && newData.val().length <= 50"
        },
        "description": {
          ".validate": "newData.isString() && newData.val().length <= 120"
        },
        "createdBy": {
          ".validate": "newData.isString()"
        },
        "createdAt": {
          ".validate": "newData.isNumber()"
        },
        "inviteCode": {
          ".validate": "newData.isString() && newData.val().length === 8"
        },
        "lastMessage": {
          ".write": "auth != null && root.child('group_chats').child($groupId).child('participants').child(auth.uid).val() === true",
          ".validate": "newData.isString() && newData.val().length <= 5000"
        },
        "lastMessageAt": {
          ".write": "auth != null && root.child('group_chats').child($groupId).child('participants').child(auth.uid).val() === true",
          ".validate": "newData.isNumber()"
        },
        "lastMessageSender": {
          ".write": "auth != null && root.child('group_chats').child($groupId).child('participants').child(auth.uid).val() === true",
          ".validate": "newData.isString()"
        },
        "participants": {
          "$uid": {
            ".write": "auth != null && auth.uid === $uid",
            ".validate": "newData.val() === true"
          }
        },
        "lastRead": {
          "$uid": {
            ".write": "auth != null && auth.uid === $uid",
            ".validate": "newData.isNumber()"
          }
        },
        "$other": {
          ".validate": false
        }
      }
    },

    "userGroups": {
      "$uid": {
        ".read": "auth != null && auth.uid === $uid",
        "$groupId": {
          ".write": "auth != null && (auth.uid === $uid || newData.exists())",
          ".validate": "newData.val() === true"
        }
      }
    }
  }
}
```

</details>

### 4. Cloudinary Setup

1. Create a free account at [Cloudinary](https://cloudinary.com).
2. Go to **Settings → Upload → Upload Presets → Add upload preset**.
3. Set **Signing Mode** to **Unsigned** and save.
4. Add your Cloud Name and Upload Preset Name to `.env`.

### 5. Run the App

```bash
npm run dev
```

---

## Available Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start Vite development server |
| `npm run build` | Type-check (`tsc -b`) and build for production |
| `npm run lint` | Run ESLint |
| `npm run preview` | Preview production build locally |

---

## Realtime Database Schema

```text
├── users/{uid}                  # username, email, createdAt
├── presence/{uid}               # connections/{connId}, lastOnline
├── chat_room/{chatId}           # private chat metadata & participants
├── userChats/{uid}/{chatId}     # otherUserId, lastReadAt
├── group_chats/{groupId}        # group metadata, participants, lastRead/{uid}
├── userGroups/{uid}/{groupId}   # true (user's group index)
└── messages/{chatId}/{msgId}    # senderId, text, createdAt, isSystem, encrypted media fields
```
