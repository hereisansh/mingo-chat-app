# Mingo

A private, colorful chat space for you and your partner, built with React, Express, MongoDB, and Socket.IO. Create an account for each person, then choose each other from the Messages list to chat. Text conversations are saved in MongoDB and delivered live; photos and videos are stored by the server and shown in the conversation.

## Run locally

You'll need Node.js and a MongoDB connection string (a local MongoDB instance or MongoDB Atlas).

1. In `server/.env`, set `PORT=4500`, `MONGO_URL` to your database connection string, and a private `JWT_SECRET`. For AI Study Buddy answers, set `OPENAI_API_KEY`. You can set `CLIENT_URL` if the Vite app runs at a different address. Keep this file private.
2. In one terminal, run `cd server`, `npm install` (if needed), then `npm run dev`.
3. In another terminal, run `cd client`, `npm install` (if needed), then `npm run dev`.
4. Open the Vite address (usually `http://localhost:5173`) and register an account on each device/browser. Search for your friend by name, send a follow request, and accept it from the notification bell; accepted connections appear in Messages.

The server serves uploaded media from `server/uploads`; files up to 50 MB are accepted. Set `VITE_BACKEND_URL` in `client/.env` if the API is hosted somewhere other than `http://localhost:4500`.

## New Mingo features

- **Instagram Reels:** save public Instagram Reel links to your account and watch them in a vertical, scroll-snapping feed. Mingo embeds the original Instagram post; private or embedding-disabled Reels may not play. Links are stored in MongoDB under the signed-in account.
- **Study Buddy & Notes:** `STUDY_AI_PROVIDER` selects `gemini` or `openai` and defaults to `gemini`, so the app won't silently fall back to a paid OpenAI API. For Gemini, set `GEMINI_API_KEY` and the model defaults to `gemini-3.8-flash` (`GEMINI_MODEL` overrides it). Google's free tier has usage limits and submitted prompts/notes may be used to improve Google's products, so don't send private or sensitive material unless you're comfortable with that. To use OpenAI instead, set `STUDY_AI_PROVIDER=openai` and `OPENAI_API_KEY`; API usage may incur charges. Keep all provider keys server-side. Notes are stored in MongoDB and belong to the signed-in account.
- **Mingo Memory:** switch it on per account to ask questions about your notes and chat details you explicitly save with **Remember**. It only accepts your own sent text messages; it never indexes your partner's messages. Answers show the matching note/message and date. With Gemini selected, Mingo uses keyword search and sends matching saved details to Gemini for a grounded answer when you ask. With OpenAI selected, it uses `text-embedding-3-small` for semantic search and the Responses API for grounded answers. Free Gemini prompts may be used to improve Google's products; OpenAI API usage may incur charges. The account can turn memory off and delete notes or saved memories.
- **Stories:** text stories with optional YouTube/Spotify links, shared only with the selected chat contact, saved in MongoDB, and shown for 24 hours.
- **Music room:** search music videos on YouTube, with quick Bollywood categories and pagination, or search free MP3 tracks from the Internet Archive Netlabels collection. YouTube search needs `YOUTUBE_API_KEY` in Render or `server/.env`; playback uses YouTube's official embedded player and room controls sync between listeners. Search results are not a complete licensed Bollywood catalog. Room codes and selected tracks survive switching tabs or refreshing.
- **Private chats:** only accepted follow connections are returned in the chat list. Message history, media, calls, and live events require an accepted connection; Socket.IO verifies the signed-in session instead of trusting an ID sent by the browser.
- **Group chats:** create a named group with at least two accepted friends. Group messages are stored in MongoDB and delivered live to group members; each group route and socket join checks membership.
- **Read receipts:** direct messages show a sent checkmark until the recipient opens the conversation, then show two checks. Receipts update live and are saved with the message.
- **Mini games:** the Games area includes same-screen pass-and-play tic-tac-toe and a memory matching game.
- **Presence:** chat contacts show online state or when they were last seen; the server saves the last-seen time when their final connected tab leaves.
- **Back navigation:** signing in or registering replaces the auth page in browser history. Opening a conversation adds one in-app history step so Back returns to the conversation list first.

The server-side AI route follows the [OpenAI Responses API](https://platform.openai.com/docs/api-reference/responses).

For the AIML project report, prepare a consented or synthetic set of search questions with their relevant note/message IDs. Compare keyword search with semantic search using Recall@5 and MRR@5, then manually score whether generated answers are supported by the citations. The **Compare keyword vs semantic results** control helps inspect the top-ranked results for a question.

## Production notes

The repository includes a Render Blueprint (`render.yaml`) that builds the client and server together and serves both from one public URL. Messages and shared media are stored in MongoDB (GridFS), so the app does not depend on local upload files.

1. Create a MongoDB Atlas cluster, a database user, and an IP access entry. Copy the Node.js connection string and add `/mingo` as the database name.
2. For no-cost Study Buddy usage within Google's free quota, create a Gemini API key in Google AI Studio and set `GEMINI_API_KEY` in Render. The service defaults to Gemini and will not call OpenAI unless `STUDY_AI_PROVIDER=openai` is set. Google's free tier has usage limits and may use prompts to improve its products. Keep keys private and set them only in the server environment. Render reads `render.yaml`; provide the Atlas connection string when asked for `MONGO_URL`. The Blueprint generates `JWT_SECRET` and sets production mode.
3. After Render creates the service, copy its outbound IP ranges from **Connect → Outbound** into the Atlas project's **Network Access** list. Atlas only accepts connections from addresses on that list.
4. When deployment is live, open the Render URL and register both people. Share that URL with your partner.

## Deploy this project

The repository includes `render.yaml` as a Render Blueprint. Push this project folder to a GitHub repository, then in Render choose **New → Blueprint** and select that repository. Render builds the React client and starts the Express server from one service, so the client and live chat use the same URL. The Blueprint generates `JWT_SECRET`; provide the Atlas connection string as `MONGO_URL`. `STUDY_AI_PROVIDER=gemini` and `GEMINI_API_KEY` enable the Gemini Study Buddy. Set `STUDY_AI_PROVIDER=openai` and `OPENAI_API_KEY` if OpenAI is preferred.

In MongoDB Atlas, create a database user and a database named `mingo`, then copy the Node.js connection string and replace its password placeholder with that database user's password. Add Render's outbound IP ranges to the Atlas Network Access allowlist before deploying. Keep database passwords and API keys in Render's Environment settings; never commit `.env` files. To run locally, copy `server/.env.example` to `server/.env` and `client/.env.example` to `client/.env`, then set a real MongoDB URL and a long random JWT secret in the server file.

For local development, keep `client/.env` pointed to `http://localhost:4500` and set `MONGO_URL` in `server/.env`. Never put database credentials or JWT secrets in GitHub.
