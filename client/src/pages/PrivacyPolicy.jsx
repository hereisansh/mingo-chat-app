import { Link } from "react-router-dom";

const PrivacyPolicy = () => (
  <main className="privacy-page">
    <Link to="/" className="privacy-back">← Back to Mingo</Link>
    <p className="eyebrow">MINGO · PRIVACY</p>
    <h1>Privacy Policy</h1>
    <p className="privacy-updated">Last updated: October 27, 2026</p>
    <p>Mingo is a chat and shared activities app. This policy explains what information Mingo handles when you create an account and use its features.</p>

    <h2>Information you provide</h2>
    <p>When you register, Mingo stores your name, email address, optional phone number, and a securely hashed password. Mingo sends a one-time verification code to your email; only a hash of the code is stored, for up to 10 minutes. If you choose to use them, Mingo also stores your profile photo, messages and message attachments, friend requests, group chats, stories, saved Instagram Reel links, study notes, and private memory items.</p>

    <h2>Information created while you use Mingo</h2>
    <p>Mingo processes sign-in sessions, message delivery and read state, online and last-seen status, and activity-sharing status so chat and shared features work. Live presence, calls, games, and listening-room synchronization may be relayed through the Mingo server. They are not end-to-end encrypted.</p>

    <h2>How information is used</h2>
    <p>Account information is used to provide chat, contacts, profiles, groups, media sharing, notifications, study tools, and shared activities. Account data and uploaded files are stored by Mingo’s hosting and database providers (Render and MongoDB Atlas).</p>
    <p>If you use Study AI, the question and any notes you include for that request are sent to Google’s Gemini service to generate an answer. Music and video searches or embedded content may connect to the provider shown in the feature, such as YouTube or Internet Archive. Those providers apply their own privacy policies.</p>

    <h2>Sharing and visibility</h2>
    <p>Your profile details and content are shown to other Mingo users as needed for the features you use. Activity sharing is optional and can be turned off in the app. Avoid sharing information you do not want another participant to see or save.</p>

    <h2>Retention and deletion</h2>
    <p>You can delete your account from your profile in Mingo. Account deletion removes your profile, messages and attachments, stories, saved links, notes, memories, notifications, friend requests, and groups you created from Mingo’s active database. Some copies may remain temporarily in provider backups before they expire.</p>
    <p>To request deletion, use the <Link to="/delete-account">account deletion page</Link> or sign in, open your profile, and choose “Delete account.” Your password is used to verify the request and is not stored by the deletion form.</p>

    <h2>Security and children</h2>
    <p>Mingo uses HTTPS for its hosted service and hashes account passwords. Mingo messages are not end-to-end encrypted. Mingo is not designed for children under 13.</p>

    <h2>Contact</h2>
    <p>For privacy questions or account deletion help, use the <Link to="/contact">Mingo contact page</Link>.</p>
  </main>
);

export default PrivacyPolicy;
