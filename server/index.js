import "dotenv/config";
import express from "express";
import http from "node:http";
import path from "node:path";
import fs from "node:fs";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { randomInt } from "node:crypto";
import { fileURLToPath } from "node:url";
import cors from "cors";
import cookieParser from "cookie-parser";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import multer from "multer";
import { Server } from "socket.io";

const app = express();
const server = http.createServer(app);
const configuredClient = process.env.CLIENT_URL || "http://localhost:5173";
const allowedOrigin = (origin, callback) => {
  const localNetworkOrigin = process.env.NODE_ENV !== "production" && /^http:\/\/(localhost|127\.0\.0\.1|10\.\d{1,3}\.\d{1,3}\.\d{1,3}|192\.168\.\d{1,3}\.\d{1,3}|172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}):5173$/.test(origin || "");
  if (!origin || origin === configuredClient || localNetworkOrigin) return callback(null, true);
  callback(new Error("This app origin is not allowed by CORS."));
};
const io = new Server(server, process.env.NODE_ENV === "production" ? {} : { cors: { origin: allowedOrigin, credentials: true } });
const __dirname = path.dirname(fileURLToPath(import.meta.url));
if (process.env.NODE_ENV !== "production") app.use(cors({ origin: allowedOrigin, credentials: true }));
app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());

const userSchema = new mongoose.Schema({
  fullName: { type: String, required: true, trim: true }, email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  mobileNumber: String, password: { type: String, required: true }, avatar: String, lastSeen: Date,
  following: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
  memoryEnabled: { type: Boolean, default: false },
}, { timestamps: true });
const messageSchema = new mongoose.Schema({
  senderId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  receiverId: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, groupId: { type: mongoose.Schema.Types.ObjectId, ref: "Group" },
  message: { type: String, default: "" }, mediaUrl: String, mediaType: String, fileName: String, readAt: Date,
}, { timestamps: true });
messageSchema.index({ senderId: 1, receiverId: 1, createdAt: 1 });
messageSchema.index({ groupId: 1, createdAt: 1 });
const groupSchema = new mongoose.Schema({ name: { type: String, required: true, trim: true, maxlength: 60 }, createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }] }, { timestamps: true });
groupSchema.index({ members: 1, updatedAt: -1 });
const instagramReelSchema = new mongoose.Schema({ userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, shortcode: { type: String, required: true }, url: { type: String, required: true } }, { timestamps: true });
instagramReelSchema.index({ userId: 1, shortcode: 1 }, { unique: true });
const storySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  shareWith: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  text: { type: String, required: true, maxlength: 500 },
  musicUrl: { type: String, default: "" },
  theme: { type: String, default: "peach" },
  expiresAt: { type: Date, required: true, expires: 0 },
}, { timestamps: true });
const studyNoteSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 120 },
  text: { type: String, required: true, trim: true, maxlength: 5000 },
}, { timestamps: true });
const memorySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
  sourceType: { type: String, enum: ["note", "message", "memory"], required: true },
  sourceId: { type: String, required: true },
  title: { type: String, default: "" },
  text: { type: String, required: true, maxlength: 5000 },
  embedding: { type: [Number], default: undefined },
}, { timestamps: true });
memorySchema.index({ userId: 1, sourceType: 1, sourceId: 1 }, { unique: true });
const followRequestSchema = new mongoose.Schema({ from: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, to: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, status: { type: String, enum: ["pending", "accepted", "rejected"], default: "pending" } }, { timestamps: true });
followRequestSchema.index({ from: 1, to: 1 }, { unique: true });
const notificationSchema = new mongoose.Schema({ userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true }, actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User" }, type: { type: String, enum: ["message", "call", "follow_request", "follow_accepted"], required: true }, text: { type: String, required: true, maxlength: 180 }, readAt: Date, meta: { type: mongoose.Schema.Types.Mixed, default: {} } }, { timestamps: true });
notificationSchema.index({ userId: 1, createdAt: -1 });
const listeningRoomSchema = new mongoose.Schema({ code: { type: String, required: true, unique: true }, owner: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, track: { type: mongoose.Schema.Types.Mixed, default: null }, action: { type: String, default: "pause" }, time: { type: Number, default: 0 }, expiresAt: { type: Date, required: true, expires: 0 } }, { timestamps: true });
const User = mongoose.models.User || mongoose.model("User", userSchema);
const Message = mongoose.models.Message || mongoose.model("Message", messageSchema);
const Group = mongoose.models.Group || mongoose.model("Group", groupSchema);
const InstagramReel = mongoose.models.InstagramReel || mongoose.model("InstagramReel", instagramReelSchema);
const Story = mongoose.models.Story || mongoose.model("Story", storySchema);
const StudyNote = mongoose.models.StudyNote || mongoose.model("StudyNote", studyNoteSchema);
const MemoryItem = mongoose.models.MemoryItem || mongoose.model("MemoryItem", memorySchema);
const FollowRequest = mongoose.models.FollowRequest || mongoose.model("FollowRequest", followRequestSchema);
const Notification = mongoose.models.Notification || mongoose.model("Notification", notificationSchema);
const ListeningRoom = mongoose.models.ListeningRoom || mongoose.model("ListeningRoom", listeningRoomSchema);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 }, fileFilter: (_req, file, cb) => cb(null, /^(image|video)\//.test(file.mimetype)) });
const mediaBucket = () => new mongoose.mongo.GridFSBucket(mongoose.connection.db, { bucketName: "media" });
const onlineSockets = new Map();
const listeningRooms = new Map();

const createNotification = async ({ userId, actorId, type, text, meta = {} }) => {
  const notification = await Notification.create({ userId, actorId, type, text, meta });
  const payload = { ...notification.toObject(), actor: await User.findById(actorId).select("fullName avatar").lean() };
  io.to(String(userId)).emit("notification:new", payload);
  return payload;
};

io.use(async (socket, next) => {
  try {
    const cookie = (socket.handshake.headers.cookie || "").split(";").map((part) => part.trim()).find((part) => part.startsWith(`${sessionCookieName}=`));
    const token = cookie ? decodeURIComponent(cookie.slice(sessionCookieName.length + 1)) : "";
    if (!token) return next(new Error("Please sign in to use live chat."));
    const decoded = jwt.verify(token, process.env.JWT_SECRET || "mingo-local-development-secret");
    const user = await User.findById(decoded.id).select("_id").lean();
    if (!user) return next(new Error("Your account could not be found."));
    socket.data.authenticatedUserId = String(user._id);
    next();
  } catch { next(new Error("Your live chat session expired. Please sign in again.")); }
});

const leavePresence = (socket, userId = socket.data.userId) => {
  if (!socket.data.joined || !userId) return;
  socket.data.joined = false;
  socket.leave(String(userId));
  const count = Math.max(0, (onlineSockets.get(String(userId)) || 1) - 1);
  if (count) onlineSockets.set(String(userId), count);
  else {
    onlineSockets.delete(String(userId));
    const lastSeen = new Date();
    User.findByIdAndUpdate(userId, { lastSeen }).catch((error) => console.error("Could not save last seen", error.message));
    io.emit("presence:update", { userId: String(userId), online: false, lastSeen });
  }
};

const publicUser = (user) => ({ _id: user._id, fullName: user.fullName, email: user.email, avatar: user.avatar });
const areConnected = async (firstId, secondId) => Boolean(await FollowRequest.exists({
  status: "accepted",
  $or: [{ from: firstId, to: secondId }, { from: secondId, to: firstId }],
}) || await User.exists({ _id: firstId, following: secondId }) || await User.exists({ _id: secondId, following: firstId }));
const requireConnection = async (firstId, secondId) => {
  if (String(firstId) === String(secondId) || !await areConnected(firstId, secondId)) {
    const error = new Error("You can chat or call only after the follow request is accepted.");
    error.status = 403;
    throw error;
  }
};
const fail = (res, status, message) => res.status(status).json({ success: false, message });
const asyncRoute = (handler) => (req, res, next) => Promise.resolve(handler(req, res, next)).catch(next);
const sessionCookieName = "mingo_session";
const tokenFor = (user) => jwt.sign({ id: user._id }, process.env.JWT_SECRET || "mingo-local-development-secret", { expiresIn: "30d" });
const requireAuth = asyncRoute(async (req, res, next) => {
  const token = req.cookies[sessionCookieName];
  if (!token) return fail(res, 401, "Please sign in to continue.");
  let decoded;
  try { decoded = jwt.verify(token, process.env.JWT_SECRET || "mingo-local-development-secret"); }
  catch (error) {
    console.error("Session token verification failed:", error.name);
    return fail(res, 401, "Your login session is invalid. Please sign in again.");
  }
  try { req.user = await User.findById(decoded.id); }
  catch (error) {
    console.error("Session account lookup failed:", error.message);
    return fail(res, 503, "Could not check your account in the database. Please try again shortly.");
  }
  if (!req.user) return fail(res, 401, "Account not found. Please sign in again.");
  next();
});
const issueSession = (res, user) => {
  const cookieOptions = { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" };
  res.clearCookie("token", cookieOptions);
  res.cookie(sessionCookieName, tokenFor(user), { ...cookieOptions, maxAge: 30 * 24 * 60 * 60 * 1000 });
};

app.get("/api/health", (_req, res) => res.json({ name: "Mingo API", status: "ok" }));
app.get("/music/search", requireAuth, asyncRoute(async (req, res) => {
  const term = String(req.query.q || "top hits").trim().slice(0, 100);
  if (!term) return res.json({ success: true, data: [] });
  const response = await fetch(`https://itunes.apple.com/search?${new URLSearchParams({ term, entity: "song", limit: "24", country: "IN" })}`);
  if (!response.ok) return fail(res, 502, "Music search is unavailable right now. Try again in a moment.");
  const data = await response.json();
  res.json({ success: true, data: (data.results || []).filter((track) => track.previewUrl).map((track) => ({ id: String(track.trackId), title: track.trackName, artist: track.artistName, album: track.collectionName || "Single", genre: track.primaryGenreName || "Music", artwork: track.artworkUrl100?.replace("100x100", "300x300") || "", previewUrl: track.previewUrl, link: track.trackViewUrl })) });
}));
app.get("/youtube/search", requireAuth, asyncRoute(async (req, res) => {
  const query = String(req.query.q || "").trim().slice(0, 100);
  if (!query) return res.json({ success: true, data: [] });
  if (!process.env.YOUTUBE_API_KEY) return fail(res, 503, "In-app YouTube search needs a YouTube Data API key in the server environment.");
  const pageToken = /^[\w-]{1,100}$/.test(String(req.query.pageToken || "")) ? String(req.query.pageToken) : "";
  const parameters = { key: process.env.YOUTUBE_API_KEY, part: "snippet", type: "video", videoEmbeddable: "true", maxResults: "12", regionCode: "IN", q: query };
  if (req.query.kind === "reels") parameters.videoDuration = "short";
  if (pageToken) parameters.pageToken = pageToken;
  const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${new URLSearchParams(parameters)}`);
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) return fail(res, 502, payload.error?.message || "YouTube search is unavailable right now.");
  res.json({ success: true, data: (payload.items || []).filter((item) => item.id?.videoId).map((item) => ({ id: item.id.videoId, title: item.snippet.title, channel: item.snippet.channelTitle, artwork: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.medium?.url || "", publishedAt: item.snippet.publishedAt })), nextPageToken: payload.nextPageToken || null });
}));
const parseInstagramReel = (raw) => {
  try {
    const url = new URL(String(raw || "").trim());
    if (url.protocol !== "https:" || !["instagram.com", "www.instagram.com"].includes(url.hostname.toLowerCase())) return null;
    const match = url.pathname.match(/^\/reel\/([A-Za-z0-9_-]{5,})\/?$/);
    return match ? { shortcode: match[1], url: `https://www.instagram.com/reel/${match[1]}/` } : null;
  } catch { return null; }
};
app.get("/instagram/reels", requireAuth, asyncRoute(async (req, res) => {
  const reels = await InstagramReel.find({ userId: req.user._id }).sort({ createdAt: -1 }).lean();
  res.json({ success: true, data: reels });
}));
app.post("/instagram/reels", requireAuth, asyncRoute(async (req, res) => {
  const parsed = parseInstagramReel(req.body.url);
  if (!parsed) return fail(res, 400, "Paste a valid public Instagram Reel link, such as instagram.com/reel/…");
  const reel = await InstagramReel.findOneAndUpdate({ userId: req.user._id, shortcode: parsed.shortcode }, { $setOnInsert: { ...parsed, userId: req.user._id } }, { upsert: true, new: true, setDefaultsOnInsert: true }).lean();
  res.status(201).json({ success: true, data: reel });
}));
app.delete("/instagram/reels/:shortcode", requireAuth, asyncRoute(async (req, res) => {
  const shortcode = String(req.params.shortcode || "");
  if (!/^[A-Za-z0-9_-]{5,}$/.test(shortcode)) return fail(res, 400, "Invalid Instagram Reel.");
  await InstagramReel.deleteOne({ userId: req.user._id, shortcode });
  res.json({ success: true });
}));
app.post("/auth/register", asyncRoute(async (req, res) => {
  const { fullName, email, mobileNumber, password } = req.body;
  if (!fullName?.trim() || !email?.trim() || !password) return fail(res, 400, "Name, email, and password are required.");
  if (password.length < 8) return fail(res, 400, "Use a password with at least 8 characters.");
  if (await User.exists({ email: email.toLowerCase().trim() })) return fail(res, 409, "An account with that email already exists.");
  const user = await User.create({ fullName: fullName.trim(), email: email.toLowerCase().trim(), mobileNumber, password: await bcrypt.hash(password, 12) });
  issueSession(res, user);
  res.status(201).json({ success: true, message: "Your Mingo account is ready!", data: publicUser(user) });
}));
app.post("/auth/login", asyncRoute(async (req, res) => {
  const user = await User.findOne({ email: req.body.email?.toLowerCase().trim() });
  if (!user || !await bcrypt.compare(req.body.password || "", user.password)) return fail(res, 401, "Email or password is incorrect.");
  issueSession(res, user);
  res.json({ success: true, message: "Welcome back!", data: publicUser(user) });
}));
app.post("/auth/logout", (_req, res) => {
  const cookieOptions = { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" };
  res.clearCookie(sessionCookieName, cookieOptions);
  res.clearCookie("token", cookieOptions);
  res.json({ success: true });
});
app.get("/auth/me", requireAuth, (req, res) => res.json({ data: publicUser(req.user) }));

app.put("/user/profile", requireAuth, asyncRoute(async (req, res) => {
  const fullName = req.body.fullName?.trim(); const email = req.body.email?.toLowerCase().trim();
  if (!fullName || fullName.length > 80 || !email || !/^\S+@\S+\.\S+$/.test(email)) return fail(res, 400, "Enter a name and a valid email address.");
  if (await User.exists({ email, _id: { $ne: req.user._id } })) return fail(res, 409, "That email address is already in use.");
  req.user.fullName = fullName; req.user.email = email; req.user.mobileNumber = String(req.body.mobileNumber || "").slice(0, 30);
  await req.user.save();
  res.json({ success: true, message: "Profile updated.", data: publicUser(req.user) });
}));
app.put("/user/avatar", requireAuth, upload.single("avatar"), asyncRoute(async (req, res) => {
  const avatar = req.file;
  if (!avatar || !/^image\/(jpeg|png|webp)$/.test(avatar.mimetype) || avatar.size > 900_000) return fail(res, 400, "Choose a JPG, PNG, or WebP photo under 900 KB.");
  const previous = req.user.avatar; const avatarId = new mongoose.Types.ObjectId();
  const stream = mediaBucket().openUploadStreamWithId(avatarId, avatar.originalname, { contentType: avatar.mimetype });
  await pipeline(Readable.from(avatar.buffer), stream);
  req.user.avatar = `/user/avatar/${avatarId}`; await req.user.save();
  const oldMatch = previous?.match(/^\/user\/avatar\/([a-f\d]{24})$/i);
  if (oldMatch) { try { await mediaBucket().delete(new mongoose.Types.ObjectId(oldMatch[1])); } catch { /* old photo may already be gone */ } }
  res.json({ success: true, data: publicUser(req.user) });
}));
app.delete("/user/avatar", requireAuth, asyncRoute(async (req, res) => {
  const previous = req.user.avatar; req.user.avatar = ""; await req.user.save();
  const oldMatch = previous?.match(/^\/user\/avatar\/([a-f\d]{24})$/i);
  if (oldMatch) { try { await mediaBucket().delete(new mongoose.Types.ObjectId(oldMatch[1])); } catch { /* old photo may already be gone */ } }
  res.json({ success: true, data: publicUser(req.user) });
}));
app.get("/user/avatar/:avatarId", asyncRoute(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.avatarId)) return fail(res, 400, "Invalid profile photo.");
  const avatarUrl = `/user/avatar/${req.params.avatarId}`;
  if (!await User.exists({ avatar: avatarUrl })) return fail(res, 404, "Profile photo not found.");
  const id = new mongoose.Types.ObjectId(req.params.avatarId); const file = await mediaBucket().find({ _id: id }).next();
  if (!file) return fail(res, 404, "Profile photo not found.");
  res.set({ "Content-Type": file.contentType || "image/jpeg", "Content-Length": file.length, "Cache-Control": "private, max-age=3600" });
  mediaBucket().openDownloadStream(id).on("error", () => { if (!res.headersSent) res.status(404).end(); }).pipe(res);
}));
app.post("/user/follow/:friendId", requireAuth, asyncRoute(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.friendId) || String(req.params.friendId) === String(req.user._id)) return fail(res, 400, "Choose another Mingo member.");
  const recipient = await User.findById(req.params.friendId).select("fullName"); if (!recipient) return fail(res, 404, "Person not found.");
  if (req.user.following.some((id) => String(id) === String(recipient._id))) return res.json({ success: true, data: { following: true, requested: false } });
  let request = await FollowRequest.findOne({ from: req.user._id, to: recipient._id });
  if (request?.status === "accepted") return res.json({ success: true, data: { following: false, requested: false, connected: true } });
  if (request?.status === "pending") return res.json({ success: true, data: { following: false, requested: true } });
  if (request) { request.status = "pending"; await request.save(); }
  else request = await FollowRequest.create({ from: req.user._id, to: recipient._id });
  await createNotification({ userId: recipient._id, actorId: req.user._id, type: "follow_request", text: `${req.user.fullName} sent you a follow request.`, meta: { requestId: String(request._id) } });
  res.json({ success: true, data: { following: false, requested: true } });
}));
app.delete("/user/follow/:friendId", requireAuth, asyncRoute(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.friendId)) return fail(res, 400, "Choose a valid Mingo member.");
  await User.updateOne({ _id: req.user._id }, { $pull: { following: req.params.friendId } });
  const pending = await FollowRequest.findOneAndDelete({ from: req.user._id, to: req.params.friendId, status: "pending" });
  if (pending) await Notification.updateMany({ userId: req.params.friendId, type: "follow_request", "meta.requestId": String(pending._id), readAt: { $exists: false } }, { $set: { readAt: new Date() } });
  res.json({ success: true, data: { following: false } });
}));
app.get("/user/follow-requests", requireAuth, asyncRoute(async (req, res) => {
  const [incoming, outgoing] = await Promise.all([
    FollowRequest.find({ to: req.user._id, status: "pending" }).sort({ createdAt: -1 }).populate("from", "fullName avatar").lean(),
    FollowRequest.find({ from: req.user._id, status: "pending" }).select("to").lean(),
  ]);
  res.json({ success: true, data: { incoming: incoming.map((item) => ({ _id: item._id, createdAt: item.createdAt, user: item.from })), outgoing: outgoing.map((item) => String(item.to)) } });
}));
app.patch("/user/follow-requests/:requestId", requireAuth, asyncRoute(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.requestId) || !["accept", "reject"].includes(req.body.action)) return fail(res, 400, "Choose accept or decline for this request.");
  const request = await FollowRequest.findOne({ _id: req.params.requestId, to: req.user._id, status: "pending" });
  if (!request) return fail(res, 404, "This follow request is no longer available.");
  if (req.body.action === "accept") {
    await Promise.all([User.updateOne({ _id: request.from }, { $addToSet: { following: request.to } }), FollowRequest.updateOne({ _id: request._id }, { $set: { status: "accepted" } })]);
    await createNotification({ userId: request.from, actorId: req.user._id, type: "follow_accepted", text: `${req.user.fullName} accepted your follow request.` });
  } else await FollowRequest.updateOne({ _id: request._id }, { $set: { status: "rejected" } });
  await Notification.updateMany({ userId: req.user._id, type: "follow_request", "meta.requestId": String(request._id), readAt: { $exists: false } }, { $set: { readAt: new Date() } });
  res.json({ success: true, data: { accepted: req.body.action === "accept" } });
}));
app.get("/notifications", requireAuth, asyncRoute(async (req, res) => {
  const items = await Notification.find({ userId: req.user._id }).sort({ createdAt: -1 }).limit(40).populate("actorId", "fullName avatar").lean();
  res.json({ success: true, data: items.map(({ actorId, ...item }) => ({ ...item, actor: actorId })) });
}));
app.patch("/notifications/read", requireAuth, asyncRoute(async (req, res) => {
  await Notification.updateMany({ userId: req.user._id, readAt: { $exists: false } }, { $set: { readAt: new Date() } });
  res.json({ success: true });
}));
app.get("/user/follow-stats", requireAuth, asyncRoute(async (req, res) => {
  const [me, followers] = await Promise.all([User.findById(req.user._id).select("following").lean(), User.countDocuments({ following: req.user._id })]);
  const following = me?.following?.length || 0;
  res.json({ success: true, data: { following, followers } });
}));

app.get("/user/allusers", requireAuth, asyncRoute(async (req, res) => {
  const [accepted, followerCounts] = await Promise.all([FollowRequest.find({ status: "accepted", $or: [{ from: req.user._id }, { to: req.user._id }] }).select("from to").lean(), User.aggregate([{ $unwind: "$following" }, { $group: { _id: "$following", count: { $sum: 1 } } }])]);
  const friendIds = new Set(accepted.map((item) => String(item.from) === String(req.user._id) ? String(item.to) : String(item.from)));
  (req.user.following || []).forEach((id) => friendIds.add(String(id)));
  const incomingLegacy = await User.find({ following: req.user._id }).select("_id").lean(); incomingLegacy.forEach((item) => friendIds.add(String(item._id)));
  friendIds.delete(String(req.user._id));
  const [allUsers, requests] = await Promise.all([User.find({ _id: { $in: [...friendIds] } }).select("fullName email avatar lastSeen following").lean(), FollowRequest.find({ from: req.user._id, status: "pending" }).select("to").lean()]);
  const followersById = new Map(followerCounts.map((item) => [String(item._id), item.count])); const requested = new Set(requests.map((item) => String(item.to)));
  const myFollowing = new Set((req.user.following || []).map(String));
  const ordered = allUsers
    .filter((person) => String(person._id) !== String(req.user._id))
    .map((person) => ({ ...person, connected: true, following: myFollowing.has(String(person._id)), followRequested: requested.has(String(person._id)), followersCount: followersById.get(String(person._id)) || 0, followingCount: person.following?.length || 0, online: (onlineSockets.get(String(person._id)) || 0) > 0, lastSeen: (onlineSockets.get(String(person._id)) || 0) > 0 ? null : person.lastSeen, lastMessage: null }))
    .sort((a, b) => String(a.fullName || "").localeCompare(String(b.fullName || "")));
  res.json({ success: true, data: ordered });
}));
app.get("/user/search", requireAuth, asyncRoute(async (req, res) => {
  const query = String(req.query.q || "").trim().slice(0, 80);
  if (query.length < 2) return res.json({ success: true, data: [] });
  const safeQuery = query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const [people, outgoing, incoming, accepted] = await Promise.all([
    User.find({ _id: { $ne: req.user._id }, fullName: { $regex: safeQuery, $options: "i" } }).select("fullName avatar following").limit(16).lean(),
    FollowRequest.find({ from: req.user._id, status: "pending" }).select("to").lean(),
    FollowRequest.find({ to: req.user._id, status: "pending" }).select("from").lean(),
    FollowRequest.find({ status: "accepted", $or: [{ from: req.user._id }, { to: req.user._id }] }).select("from to").lean(),
  ]);
  const outgoingIds = new Set(outgoing.map((item) => String(item.to)));
  const incomingIds = new Set(incoming.map((item) => String(item.from)));
  const acceptedIds = new Set(accepted.map((item) => String(item.from) === String(req.user._id) ? String(item.to) : String(item.from)));
  res.json({ success: true, data: people.filter((person) => !acceptedIds.has(String(person._id))).map((person) => ({ _id: person._id, fullName: person.fullName, avatar: person.avatar, followRequested: outgoingIds.has(String(person._id)), requestReceived: incomingIds.has(String(person._id)), followersCount: person.following?.length || 0 })) });
}));
app.get("/user/get-messages/:friendId", requireAuth, asyncRoute(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.friendId)) return fail(res, 400, "Invalid conversation.");
  const friend = await User.exists({ _id: req.params.friendId }); if (!friend) return fail(res, 404, "Person not found.");
  await requireConnection(req.user._id, req.params.friendId);
  const unread = await Message.find({ senderId: req.params.friendId, receiverId: req.user._id, readAt: { $exists: false } }).select("_id").lean();
  const readAt = unread.length ? new Date() : null;
  if (readAt) await Message.updateMany({ _id: { $in: unread.map(({ _id }) => _id) } }, { $set: { readAt } });
  const messages = await Message.find({ $or: [{ senderId: req.user._id, receiverId: req.params.friendId }, { senderId: req.params.friendId, receiverId: req.user._id }] }).sort({ createdAt: 1 }).lean();
  if (readAt) io.to(String(req.params.friendId)).emit("messages:read", { readerId: String(req.user._id), messageIds: unread.map(({ _id }) => String(_id)), readAt });
  res.json({ success: true, data: messages });
}));
app.post("/user/send-message", requireAuth, asyncRoute(async (req, res) => {
  const { receiverID, message } = req.body;
  if (!mongoose.isValidObjectId(receiverID) || !message?.trim()) return fail(res, 400, "Choose a person and write a message first.");
  if (String(receiverID) === String(req.user._id)) return fail(res, 400, "You can’t message yourself.");
  if (!await User.exists({ _id: receiverID })) return fail(res, 404, "Person not found.");
  await requireConnection(req.user._id, receiverID);
  const saved = await Message.create({ senderId: req.user._id, receiverId: receiverID, message: message.trim() });
  await createNotification({ userId: receiverID, actorId: req.user._id, type: "message", text: `${req.user.fullName} sent you a message.`, meta: { messageId: String(saved._id) } }).catch((error) => console.error("Message notification failed", error.message));
  res.status(201).json({ success: true, data: saved });
}));
app.get("/groups", requireAuth, asyncRoute(async (req, res) => {
  const groups = await Group.find({ members: req.user._id }).populate("members", "fullName avatar").sort({ updatedAt: -1 }).lean();
  const data = await Promise.all(groups.map(async (group) => ({ ...group, lastMessage: await Message.findOne({ groupId: group._id }).sort({ createdAt: -1 }).select("message senderId createdAt").lean() })));
  res.json({ success: true, data });
}));
app.post("/groups", requireAuth, asyncRoute(async (req, res) => {
  const name = String(req.body.name || "").trim().slice(0, 60);
  const memberIds = [...new Set((Array.isArray(req.body.memberIds) ? req.body.memberIds : []).map(String).filter((id) => mongoose.isValidObjectId(id) && id !== String(req.user._id)))];
  if (name.length < 2 || memberIds.length < 2 || memberIds.length > 49) return fail(res, 400, "Enter a group name and choose 2–49 friends.");
  for (const memberId of memberIds) await requireConnection(req.user._id, memberId);
  const members = [req.user._id, ...memberIds];
  const group = await Group.create({ name, createdBy: req.user._id, members });
  const result = await Group.findById(group._id).populate("members", "fullName avatar").lean();
  members.forEach((memberId) => io.to(String(memberId)).emit("group:created", result));
  res.status(201).json({ success: true, data: result });
}));
app.get("/groups/:groupId/messages", requireAuth, asyncRoute(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.groupId)) return fail(res, 400, "Invalid group conversation.");
  const group = await Group.findOne({ _id: req.params.groupId, members: req.user._id }).select("_id").lean();
  if (!group) return fail(res, 404, "Group not found.");
  const messages = await Message.find({ groupId: group._id }).sort({ createdAt: 1 }).lean();
  res.json({ success: true, data: messages });
}));
app.post("/groups/:groupId/messages", requireAuth, asyncRoute(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.groupId)) return fail(res, 400, "Invalid group conversation.");
  const message = String(req.body.message || "").trim();
  if (!message || message.length > 5000) return fail(res, 400, "Write a message up to 5,000 characters.");
  const group = await Group.findOne({ _id: req.params.groupId, members: req.user._id }).select("_id members").lean();
  if (!group) return fail(res, 404, "Group not found.");
  const saved = await Message.create({ groupId: group._id, senderId: req.user._id, message });
  await Group.updateOne({ _id: group._id }, { $set: { updatedAt: new Date() } });
  res.status(201).json({ success: true, data: saved });
}));
app.post("/user/send-media", requireAuth, upload.single("media"), asyncRoute(async (req, res) => {
  if (!req.file) return fail(res, 400, "Choose an image or video under 50 MB.");
  if (!mongoose.isValidObjectId(req.body.receiverID) || !await User.exists({ _id: req.body.receiverID })) return fail(res, 400, "Choose a valid person to share with.");
  await requireConnection(req.user._id, req.body.receiverID);
  const mediaId = new mongoose.Types.ObjectId();
  const mediaUpload = mediaBucket().openUploadStreamWithId(mediaId, req.file.originalname, { contentType: req.file.mimetype });
  await pipeline(Readable.from(req.file.buffer), mediaUpload);
  const saved = await Message.create({ senderId: req.user._id, receiverId: req.body.receiverID, message: req.body.caption?.trim() || "", mediaUrl: `/user/media/${mediaId}`, mediaType: req.file.mimetype, fileName: req.file.originalname });
  await createNotification({ userId: req.body.receiverID, actorId: req.user._id, type: "message", text: `${req.user.fullName} shared a photo or video with you.`, meta: { messageId: String(saved._id) } }).catch((error) => console.error("Media notification failed", error.message));
  res.status(201).json({ success: true, data: saved });
}));
app.get("/user/media/:mediaId", requireAuth, asyncRoute(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.mediaId)) return fail(res, 400, "Invalid media link.");
  const mediaUrl = `/user/media/${req.params.mediaId}`;
  const message = await Message.findOne({ mediaUrl, $or: [{ senderId: req.user._id }, { receiverId: req.user._id }] }).select("senderId receiverId").lean();
  if (!message) return fail(res, 404, "Media not found.");
  const otherPerson = String(message.senderId) === String(req.user._id) ? message.receiverId : message.senderId;
  await requireConnection(req.user._id, otherPerson);
  const fileId = new mongoose.Types.ObjectId(req.params.mediaId);
  const file = await mediaBucket().find({ _id: fileId }).next();
  if (!file) return fail(res, 404, "Media not found.");
  res.set({ "Content-Type": file.contentType || "application/octet-stream", "Content-Length": file.length, "Cache-Control": "private, no-store" });
  mediaBucket().openDownloadStream(fileId).on("error", () => { if (!res.headersSent) res.status(404).end(); }).pipe(res);
}));
app.get("/stories", requireAuth, asyncRoute(async (req, res) => {
  const stories = await Story.find({ expiresAt: { $gt: new Date() }, $or: [{ userId: req.user._id }, { shareWith: req.user._id }] }).populate("userId", "fullName avatar").sort({ createdAt: -1 }).lean();
  res.json({ success: true, data: stories });
}));
app.post("/stories", requireAuth, asyncRoute(async (req, res) => {
  const text = req.body.text?.trim();
  const musicUrl = req.body.musicUrl?.trim() || "";
  const shareWith = req.body.shareWith;
  const theme = ["peach", "lavender", "ocean", "sunset"].includes(req.body.theme) ? req.body.theme : "peach";
  if (!text || text.length > 500) return fail(res, 400, "Write a story under 500 characters.");
  if (!mongoose.isValidObjectId(shareWith) || String(shareWith) === String(req.user._id) || !await User.exists({ _id: shareWith })) return fail(res, 400, "Choose your partner before sharing a story.");
  await requireConnection(req.user._id, shareWith);
  if (musicUrl && !/^https:\/\/(www\.)?(youtube\.com|youtu\.be|open\.spotify\.com)\//i.test(musicUrl)) return fail(res, 400, "Use a YouTube or Spotify link for story music.");
  const story = await Story.create({ userId: req.user._id, shareWith, text, musicUrl, theme, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) });
  res.status(201).json({ success: true, data: await story.populate("userId", "fullName avatar") });
}));
const studyProvider = () => (process.env.STUDY_AI_PROVIDER || "gemini").trim().toLowerCase() === "openai" ? "openai" : "gemini";
const studyProviderKey = () => studyProvider() === "gemini" ? process.env.GEMINI_API_KEY : process.env.OPENAI_API_KEY;
const geminiGenerateContent = async (model, apiKey, body) => {
  const request = (modelId) => fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelId)}:generateContent`, { method: "POST", headers: { "x-goog-api-key": apiKey, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const response = await request(model);
  if (response.status === 503 && model !== "gemini-3.6-flash") {
    console.warn(`Gemini ${model} is busy; retrying with gemini-3.6-flash.`);
    return request("gemini-3.6-flash");
  }
  return response;
};
const memoryEmbedding = async (text) => {
  if (studyProvider() !== "openai" || !process.env.OPENAI_API_KEY) return null;
  const response = await fetch("https://api.openai.com/v1/embeddings", { method: "POST", headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: process.env.MEMORY_EMBEDDING_MODEL || "text-embedding-3-small", input: text.slice(0, 5000) }) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error?.message || "Could not create a memory embedding.");
  return payload.data?.[0]?.embedding || null;
};
const memoryEmbeddings = async (texts) => {
  if (studyProvider() !== "openai" || !process.env.OPENAI_API_KEY || !texts.length) return [];
  const response = await fetch("https://api.openai.com/v1/embeddings", { method: "POST", headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: process.env.MEMORY_EMBEDDING_MODEL || "text-embedding-3-small", input: texts.map((text) => text.slice(0, 5000)) }) });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error?.message || "Could not create memory embeddings.");
  return (payload.data || []).sort((a, b) => a.index - b.index).map((item) => item.embedding);
};
const tokens = (value) => (value.toLowerCase().match(/[\p{L}\p{N}]{2,}/gu) || []);
const overlapScore = (question, text) => {
  const query = new Set(tokens(question)); const words = tokens(text);
  if (!query.size || !words.length) return 0;
  const frequencies = new Map(); for (const word of words) frequencies.set(word, (frequencies.get(word) || 0) + 1);
  return [...query].reduce((score, word) => score + Math.min(frequencies.get(word) || 0, 3) / Math.sqrt(words.length), 0);
};
const cosineSimilarity = (a, b) => { let dot = 0, aNorm = 0, bNorm = 0; for (let i = 0; i < Math.min(a.length, b.length); i++) { dot += a[i] * b[i]; aNorm += a[i] * a[i]; bNorm += b[i] * b[i]; } return aNorm && bNorm ? dot / Math.sqrt(aNorm * bNorm) : 0; };
const memorySources = async (userId) => {
  const [notes, saved] = await Promise.all([StudyNote.find({ userId }).lean(), MemoryItem.find({ userId }).lean()]);
  const indexedNotes = new Map(saved.filter((item) => item.sourceType === "note").map((item) => [item.sourceId, item]));
  return [...notes.map((note) => { const indexed = indexedNotes.get(String(note._id)); return { sourceId: String(note._id), sourceType: "note", title: note.title, text: note.text, embedding: indexed?.embedding, createdAt: note.createdAt }; }), ...saved.filter((item) => item.sourceType !== "note").map((item) => ({ sourceId: item.sourceId, sourceType: item.sourceType, title: item.title || "Saved chat memory", text: item.text, embedding: item.embedding, createdAt: item.createdAt }))];
};
app.get("/memory/settings", requireAuth, (req, res) => res.json({ success: true, data: { enabled: Boolean(req.user.memoryEnabled), aiAvailable: Boolean(studyProviderKey()), provider: studyProvider(), semanticAvailable: studyProvider() === "openai" && Boolean(process.env.OPENAI_API_KEY) } }));
app.patch("/memory/settings", requireAuth, asyncRoute(async (req, res) => {
  if (typeof req.body.enabled !== "boolean") return fail(res, 400, "Choose whether Mingo Memory is on or off.");
  req.user.memoryEnabled = req.body.enabled; await req.user.save();
  if (req.user.memoryEnabled && process.env.OPENAI_API_KEY) {
    try {
      const notes = await StudyNote.find({ userId: req.user._id }).lean();
      for (let start = 0; start < notes.length; start += 64) {
        const batch = notes.slice(start, start + 64); const embeddings = await memoryEmbeddings(batch.map((note) => `${note.title}\n${note.text}`));
        await Promise.all(batch.map((note, index) => MemoryItem.updateOne({ userId: req.user._id, sourceType: "note", sourceId: String(note._id) }, { $set: { title: note.title, text: note.text, embedding: embeddings[index] } }, { upsert: true })));
      }
    } catch (error) { console.error("Existing note embedding failed", error.message); }
  }
  res.json({ success: true, data: { enabled: req.user.memoryEnabled, aiAvailable: Boolean(studyProviderKey()), provider: studyProvider(), semanticAvailable: studyProvider() === "openai" && Boolean(process.env.OPENAI_API_KEY) } });
}));
app.get("/memory/notes", requireAuth, asyncRoute(async (req, res) => {
  const notes = await StudyNote.find({ userId: req.user._id }).sort({ updatedAt: -1 }).lean();
  res.json({ success: true, data: notes });
}));
app.post("/memory/notes", requireAuth, asyncRoute(async (req, res) => {
  const title = req.body.title?.trim(); const text = req.body.text?.trim();
  if (!title || title.length > 120 || !text || text.length > 5000) return fail(res, 400, "Add a title and note under 5,000 characters.");
  const note = await StudyNote.create({ userId: req.user._id, title, text });
  if (req.user.memoryEnabled) {
    try { await MemoryItem.updateOne({ userId: req.user._id, sourceType: "note", sourceId: String(note._id) }, { $set: { title, text, embedding: await memoryEmbedding(`${title}\n${text}`) } }, { upsert: true }); }
    catch (error) { console.error("Note embedding failed", error.message); }
  }
  res.status(201).json({ success: true, data: note });
}));
app.delete("/memory/notes/:noteId", requireAuth, asyncRoute(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.noteId)) return fail(res, 400, "Invalid note.");
  await StudyNote.deleteOne({ _id: req.params.noteId, userId: req.user._id });
  await MemoryItem.deleteOne({ userId: req.user._id, sourceType: "note", sourceId: req.params.noteId });
  res.json({ success: true });
}));
app.post("/memory/items", requireAuth, asyncRoute(async (req, res) => {
  if (!req.user.memoryEnabled) return fail(res, 403, "Turn on Mingo Memory before saving a memory.");
  const { sourceId, title = "" } = req.body;
  if (!mongoose.isValidObjectId(sourceId)) return fail(res, 400, "This message cannot be saved as a memory.");
  const message = await Message.findOne({ _id: sourceId, senderId: req.user._id, message: { $ne: "" } }).lean();
  if (!message) return fail(res, 404, "Only your own text messages can be saved to your private memory.");
  let embedding = null; try { embedding = await memoryEmbedding(message.message); } catch (error) { console.error("Memory embedding failed", error.message); }
  const item = await MemoryItem.findOneAndUpdate({ userId: req.user._id, sourceType: "message", sourceId: String(message._id) }, { $set: { title: typeof title === "string" ? title.slice(0, 120) : "", text: message.message, embedding } }, { upsert: true, new: true });
  res.status(201).json({ success: true, data: { _id: item._id, sourceType: item.sourceType, sourceId: item.sourceId, title: item.title, text: item.text, createdAt: item.createdAt } });
}));
app.get("/memory/items", requireAuth, asyncRoute(async (req, res) => {
  const items = await MemoryItem.find({ userId: req.user._id }).sort({ updatedAt: -1 }).select("sourceType sourceId title text createdAt updatedAt").lean();
  res.json({ success: true, data: items });
}));
app.delete("/memory/items/:itemId", requireAuth, asyncRoute(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.itemId)) return fail(res, 400, "Invalid memory.");
  await MemoryItem.deleteOne({ _id: req.params.itemId, userId: req.user._id });
  res.json({ success: true });
}));
app.post("/memory/ask", requireAuth, asyncRoute(async (req, res) => {
  if (!req.user.memoryEnabled) return fail(res, 403, "Turn on Mingo Memory before asking about saved memories.");
  const question = req.body.question?.trim();
  if (!question || question.length > 1000) return fail(res, 400, "Ask a question under 1,000 characters.");
  const sources = await memorySources(req.user._id);
  if (!sources.length) return res.json({ success: true, data: { answer: "Your private memory is empty so far. Save one of your messages or add a study note, then ask me again.", sources: [], method: "empty" } });
  let queryEmbedding = null;
  try { queryEmbedding = await memoryEmbedding(question); } catch (error) { console.error("Question embedding failed", error.message); }
  const ranked = sources.map((source) => ({ ...source, score: queryEmbedding ? (source.embedding?.length === queryEmbedding.length ? cosineSimilarity(queryEmbedding, source.embedding) : 0) : overlapScore(question, `${source.title} ${source.text}`) }))
    .sort((a, b) => b.score - a.score).slice(0, 5);
  const hits = ranked.filter((source) => source.score > 0.08);
  if (!hits.length) return res.json({ success: true, data: { answer: "I couldn't find a saved note or memory that answers that. Try different words or save the detail first.", sources: [], method: queryEmbedding ? "semantic" : "keyword" } });
  let answer = hits.map((source, index) => `${index + 1}. ${source.title}: ${source.text.slice(0, 420)}`).join("\n\n");
  let answeredBy = "retrieval";
  if (studyProviderKey()) {
    try {
      const memoryPrompt = `Question: ${question}\n\nPrivate memory snippets:\n${hits.map((source, index) => `[${index + 1}] ${source.title} (${new Date(source.createdAt).toLocaleDateString()}): ${source.text}`).join("\n\n")}`;
      const response = studyProvider() === "gemini"
        ? await geminiGenerateContent(process.env.GEMINI_MODEL || "gemini-3.8-flash", studyProviderKey(), { systemInstruction: { parts: [{ text: "Answer the user's question only from the private memory snippets provided. If they do not contain the answer, say you could not find it. Never invent details. Be concise and write in the user's language when clear." }] }, contents: [{ role: "user", parts: [{ text: memoryPrompt }] }], generationConfig: { maxOutputTokens: 400, thinkingConfig: { thinkingLevel: "low" } } })
        : await fetch("https://api.openai.com/v1/responses", { method: "POST", headers: { Authorization: `Bearer ${studyProviderKey()}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: process.env.OPENAI_MODEL || "gpt-4.1-mini", instructions: "Answer the user's question only from the private memory snippets provided. If they do not contain the answer, say you could not find it. Never invent details. Be concise and write in the user's language when clear.", input: memoryPrompt, max_output_tokens: 400 }) });
      const payload = await response.json().catch(() => ({}));
      const generated = (studyProvider() === "gemini" ? payload.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("\n") : payload.output?.flatMap((item) => item.content || []).filter((item) => item.type === "output_text").map((item) => item.text).join("\n"))?.trim();
      if (response.ok && generated) { answer = generated; answeredBy = "ai"; }
      else console.error("Memory answer generation failed", payload.error?.message || response.status);
    } catch (error) { console.error("Memory answer request failed", error.message); }
  }
  res.json({ success: true, data: { answer, answeredBy, method: queryEmbedding ? "semantic" : "keyword", sources: hits.map(({ sourceId, sourceType, title, text, createdAt, score }) => ({ sourceId, sourceType, title, snippet: text.slice(0, 240), createdAt, score })) } });
}));
app.post("/memory/compare", requireAuth, asyncRoute(async (req, res) => {
  if (!req.user.memoryEnabled) return fail(res, 403, "Turn on Mingo Memory to compare search results.");
  const question = req.body.question?.trim();
  if (!question || question.length > 1000) return fail(res, 400, "Enter a question under 1,000 characters.");
  const sources = await memorySources(req.user._id); let vector = null;
  try { vector = await memoryEmbedding(question); } catch (error) { console.error("Comparison embedding failed", error.message); }
  const rank = (score) => sources.map((source) => ({ title: source.title, sourceType: source.sourceType, score: score(source) })).sort((a, b) => b.score - a.score).slice(0, 5);
  res.json({ success: true, data: { semantic: vector ? rank((source) => source.embedding?.length === vector.length ? cosineSimilarity(vector, source.embedding) : 0) : null, keyword: rank((source) => overlapScore(question, `${source.title} ${source.text}`)), semanticAvailable: Boolean(vector) } });
}));
app.post("/study/ask", requireAuth, asyncRoute(async (req, res) => {
  const useGemini = studyProvider() === "gemini";
  const aiKey = studyProviderKey();
  if (!aiKey) return fail(res, 503, useGemini ? "Study AI is set to the free Gemini provider. Add GEMINI_API_KEY in Render environment variables." : "Study AI is set to OpenAI. Add OPENAI_API_KEY in Render environment variables.");
  const question = req.body.question?.trim();
  const history = Array.isArray(req.body.history) ? req.body.history.slice(-8) : [];
  if (!question || question.length > 4000) return fail(res, 400, "Enter a question under 4,000 characters.");
  const notes = await StudyNote.find({ userId: req.user._id }).sort({ updatedAt: -1 }).limit(8).lean();
  const noteContext = notes.length ? `\n\nThe user’s own saved study notes (use them when relevant):\n${notes.map((note, index) => `[${index + 1}] ${note.title}: ${note.text}`).join("\n\n").slice(0, 18000)}` : "";
  const input = [...history.filter((item) => ["user", "assistant"].includes(item.role) && typeof item.content === "string").map(({ role, content }) => ({ role, content: content.slice(0, 4000) })), { role: "user", content: `${question}${noteContext}` }];
  let result;
  try {
    if (useGemini) {
      const model = process.env.GEMINI_MODEL || "gemini-3.8-flash";
      result = await geminiGenerateContent(model, aiKey, { systemInstruction: { parts: [{ text: "You are Mingo Study Buddy. Explain clearly for a student, use simple steps, help create revision notes and quizzes. Do not invent sources. Be supportive and concise." }] }, contents: input.map(({ role, content }) => ({ role: role === "assistant" ? "model" : "user", parts: [{ text: content }] })), generationConfig: { maxOutputTokens: 600, thinkingConfig: { thinkingLevel: "low" } } });
    } else {
      result = await fetch("https://api.openai.com/v1/responses", { method: "POST", headers: { Authorization: `Bearer ${aiKey}`, "Content-Type": "application/json" }, body: JSON.stringify({ model: process.env.OPENAI_MODEL || "gpt-4.1-mini", instructions: "You are Mingo Study Buddy. Explain clearly for a student, use simple steps, help create revision notes and quizzes. Do not invent sources. Be supportive and concise.", input, max_output_tokens: 800 }) });
    }
  } catch (error) {
    console.error("Study assistant network request failed", error.message);
    return fail(res, 502, "Could not connect to the AI service. Try again in a moment.");
  }
  const payload = await result.json().catch(() => ({}));
  if (!result.ok) {
    const providerMessage = payload.error?.message || payload.message;
    console.error("Study assistant request failed", providerMessage || result.status);
    if (result.status === 401 || result.status === 429) {
      const rankedNotes = notes.map((note) => ({ ...note, score: overlapScore(question, `${note.title} ${note.text}`) })).sort((a, b) => b.score - a.score).filter((note) => note.score > 0.08).slice(0, 3);
      const issue = result.status === 401 ? "The AI key needs attention." : useGemini ? "The free AI quota is temporarily unavailable or has been reached." : "The AI service is temporarily unavailable or out of API credits.";
      const answer = rankedNotes.length
        ? `${issue} Here are the closest matches from your private saved notes:\n\n${rankedNotes.map((note, index) => `${index + 1}. ${note.title}\n${note.text.slice(0, 700)}`).join("\n\n")}\n\nTry asking again after the AI connection is available.`
        : `${issue} I couldn't find a relevant saved note for this question. Check the API account’s usage and credits, or add a note here and ask me about it.`;
      return res.json({ success: true, data: { answer, fallback: true } });
    }
    if (result.status === 400 && /model/i.test(providerMessage || "")) return fail(res, 503, useGemini ? "The configured Gemini model is unavailable. Check GEMINI_MODEL in Render → Environment." : "The configured AI model is unavailable. Check OPENAI_MODEL in Render → Environment.");
    if (useGemini && [400, 403].includes(result.status)) return fail(res, 502, "Gemini rejected this request. Check the API key and free-tier access in Google AI Studio.");
    return fail(res, 502, "Study AI could not answer right now. Check the AI setup and try again.");
  }
  const answer = (useGemini ? payload.candidates?.[0]?.content?.parts?.map((part) => part.text || "").join("\n") : payload.output?.flatMap((item) => item.content || []).filter((item) => item.type === "output_text").map((item) => item.text).join("\n"))?.trim();
  res.json({ success: true, data: { answer: answer || "I couldn't form an answer just now. Try asking another way." } });
}));
app.get("/study/status", requireAuth, (_req, res) => res.json({ success: true, data: { enabled: Boolean(studyProviderKey()), provider: studyProvider() } }));

// In production, serve the built React app from this same origin. This keeps
// API requests, Socket.IO, and the login cookie on one public address.
const clientDist = path.resolve(__dirname, "../client/dist");
if (process.env.NODE_ENV === "production") {
  app.use(express.static(clientDist));
  app.use((req, res, next) => {
    if (req.method === "GET" && req.accepts("html") && fs.existsSync(path.join(clientDist, "index.html"))) {
      return res.sendFile(path.join(clientDist, "index.html"));
    }
    next();
  });
}

io.on("connection", (socket) => {
  const relayToFriend = (to, eventName, payload) => {
    if (!socket.data.userId || !mongoose.isValidObjectId(to)) return;
    areConnected(socket.data.userId, to).then((connected) => {
      if (connected) io.to(String(to)).emit(eventName, { ...payload, from: socket.data.userId });
    }).catch((error) => console.error("Live event authorization failed", error.message));
  };
  socket.on("OmBhramyaNamah", (userId) => {
    if (!mongoose.isValidObjectId(userId) || String(userId) !== socket.data.authenticatedUserId) return;
    if (socket.data.joined && socket.data.userId === String(userId)) return;
    leavePresence(socket);
    const id = String(userId);
    socket.data.userId = id;
    socket.data.joined = true;
    socket.join(id);
    const count = onlineSockets.get(id) || 0;
    onlineSockets.set(id, count + 1);
    if (count === 0) io.emit("presence:update", { userId: id, online: true, lastSeen: null });
  });
  socket.on("OmNamahShivay", (userId) => { if (String(userId) === socket.data.userId) leavePresence(socket, userId); });
  socket.on("send", async (payload) => {
    try {
      if (!socket.data.userId || !payload?._id) return;
      const message = await Message.findById(payload._id).lean();
      if (!message || String(message.senderId) !== socket.data.userId) return;
      io.to(String(message.receiverId)).emit("receive", message);
    } catch (error) { console.error("Socket delivery failed", error.message); }
  });
  socket.on("messages:read", async ({ peerId } = {}) => {
    try {
      const readerId = socket.data.userId;
      if (!readerId || !mongoose.isValidObjectId(peerId) || !await areConnected(readerId, peerId)) return;
      const unread = await Message.find({ senderId: peerId, receiverId: readerId, readAt: { $exists: false } }).select("_id").lean();
      if (!unread.length) return;
      const readAt = new Date();
      await Message.updateMany({ _id: { $in: unread.map(({ _id }) => _id) } }, { $set: { readAt } });
      io.to(String(peerId)).emit("messages:read", { readerId, messageIds: unread.map(({ _id }) => String(_id)), readAt });
    } catch (error) { console.error("Read receipt update failed", error.message); }
  });
  socket.on("group:join", async ({ groupId } = {}) => {
    if (!socket.data.userId || !mongoose.isValidObjectId(groupId)) return;
    if (await Group.exists({ _id: groupId, members: socket.data.userId })) socket.join(`group:${groupId}`);
  });
  socket.on("group:send", async ({ messageId } = {}) => {
    try {
      if (!socket.data.userId || !mongoose.isValidObjectId(messageId)) return;
      const message = await Message.findById(messageId).lean();
      if (!message?.groupId || String(message.senderId) !== socket.data.userId || !await Group.exists({ _id: message.groupId, members: socket.data.userId })) return;
      io.to(`group:${message.groupId}`).emit("group:message", message);
    } catch (error) { console.error("Group message delivery failed", error.message); }
  });
  socket.on("call:offer", ({ to, offer, callType } = {}) => {
    if (!socket.data.userId || !mongoose.isValidObjectId(to) || !offer?.sdp) return;
    areConnected(socket.data.userId, to).then((connected) => {
      if (!connected) return socket.emit("call:unavailable");
      const room = io.sockets.adapter.rooms.get(String(to));
      if (!room?.size) return socket.emit("call:unavailable");
      io.to(String(to)).emit("call:incoming", { from: socket.data.userId, offer, callType: callType === "video" ? "video" : "audio" });
      createNotification({ userId: to, actorId: socket.data.userId, type: "call", text: `Incoming ${callType === "video" ? "video" : "voice"} call.`, meta: { callType: callType === "video" ? "video" : "audio" } }).catch((error) => console.error("Call notification failed", error.message));
    }).catch((error) => console.error("Call authorization failed", error.message));
  });
  socket.on("call:answer", ({ to, answer } = {}) => { if (answer?.sdp) relayToFriend(to, "call:answer", { answer }); });
  socket.on("call:ice", ({ to, candidate } = {}) => { if (candidate) relayToFriend(to, "call:ice", { candidate }); });
  socket.on("call:reject", ({ to } = {}) => relayToFriend(to, "call:rejected", {}));
  socket.on("call:end", ({ to } = {}) => relayToFriend(to, "call:ended", {}));
  socket.on("call:busy", ({ to } = {}) => relayToFriend(to, "call:busy", {}));
  socket.on("music:sync", (payload = {}) => {
    const { to, ...event } = payload;
    relayToFriend(to, "music:sync", event);
  });
  socket.on("music-room:create", async (callback) => {
    if (!socket.data.userId || typeof callback !== "function") return;
    try {
      let code; do { code = String(randomInt(100000, 1000000)); } while (listeningRooms.has(code) || await ListeningRoom.exists({ code }));
      const expiresAt = new Date(Date.now() + 12 * 60 * 60 * 1000);
      await ListeningRoom.create({ code, owner: socket.data.userId, expiresAt });
      const room = `music-room:${code}`; listeningRooms.set(code, { owner: socket.data.userId, track: null, action: "pause", time: 0 });
      socket.join(room); callback({ success: true, code, count: 1 });
      setTimeout(() => { listeningRooms.delete(code); io.in(room).socketsLeave(room); }, 12 * 60 * 60 * 1000).unref?.();
    } catch (error) { console.error("Listening room creation failed", error.message); callback({ success: false, message: "Couldn’t create the room. Try again." }); }
  });
  socket.on("music-room:join", async ({ code } = {}, callback) => {
    const normalized = String(code || "").replace(/\D/g, "").slice(0, 6); let state = listeningRooms.get(normalized);
    if (!state) { const savedRoom = await ListeningRoom.findOne({ code: normalized, expiresAt: { $gt: new Date() } }).lean(); if (savedRoom) { state = { owner: String(savedRoom.owner), track: savedRoom.track, action: savedRoom.action, time: savedRoom.time }; listeningRooms.set(normalized, state); } }
    if (!socket.data.userId || !state) return typeof callback === "function" && callback({ success: false, message: "That listening room code is invalid or expired." });
    const room = `music-room:${normalized}`; socket.join(room);
    if (state.track) socket.emit("music-room:sync", { ...state, action: "load", code: normalized });
    callback?.({ success: true, code: normalized, count: io.sockets.adapter.rooms.get(room)?.size || 1 });
    io.to(room).emit("music-room:presence", { code: normalized, count: io.sockets.adapter.rooms.get(room)?.size || 1 });
  });
  socket.on("music-room:leave", ({ code } = {}) => {
    const normalized = String(code || "").replace(/\D/g, "").slice(0, 6); const room = `music-room:${normalized}`;
    if (!socket.data.userId || !socket.rooms.has(room)) return;
    socket.leave(room);
    io.to(room).emit("music-room:presence", { code: normalized, count: io.sockets.adapter.rooms.get(room)?.size || 0 });
  });
  socket.on("music-room:sync", (payload = {}) => {
    const code = String(payload.code || "").replace(/\D/g, "").slice(0, 6); const room = `music-room:${code}`;
    if (!socket.data.userId || !listeningRooms.has(code) || !socket.rooms.has(room)) return;
    const { code: _code, ...event } = payload;
    const state = listeningRooms.get(code);
    if (event.action === "load" && /^[\w-]{11}$/.test(String(event.track?.videoId || ""))) state.track = event.track;
    if (["play", "pause", "seek"].includes(event.action)) { if (event.action !== "seek") state.action = event.action; state.time = Math.max(0, Number(event.time) || 0); }
    ListeningRoom.updateOne({ code }, { $set: { track: state.track, action: state.action, time: state.time } }).catch((error) => console.error("Listening room sync save failed", error.message));
    io.to(room).except(socket.id).emit("music-room:sync", { ...event, code, from: socket.data.userId });
  });
  socket.on("disconnecting", () => {
    for (const room of socket.rooms) {
      if (!room.startsWith("music-room:")) continue;
      const code = room.slice("music-room:".length); const count = Math.max(0, (io.sockets.adapter.rooms.get(room)?.size || 1) - 1);
      io.to(room).except(socket.id).emit("music-room:presence", { code, count });
    }
  });
  socket.on("disconnect", () => leavePresence(socket));
});
app.use((error, _req, res, _next) => { console.error(error); if (error instanceof multer.MulterError) return fail(res, 400, error.code === "LIMIT_FILE_SIZE" ? "Files must be smaller than 50 MB." : "The upload could not be processed."); res.status(error.status || 500).json({ success: false, message: error.status ? error.message : "Something went wrong. Please try again." }); });

const port = Number(process.env.PORT) || 4500;
mongoose.connect(process.env.MONGO_URL).then(() => server.listen(port, () => console.log(`Mingo API listening on ${port}`))).catch((error) => { console.error("MongoDB connection failed. Check MONGO_URL in server/.env", error.message); process.exitCode = 1; });
