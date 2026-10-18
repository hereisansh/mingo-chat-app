import { useEffect, useState } from "react";
import { FiBell, FiCheck, FiUserCheck, FiX } from "react-icons/fi";
import api, { assetUrl } from "../config/api";
import socketAPI from "../config/webSocket";
import toast from "react-hot-toast";

export default function NotificationCenter({ contacts = [], onOpenPerson = () => {} }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [requests, setRequests] = useState([]);
  const [permission, setPermission] = useState(() => ("Notification" in window ? Notification.permission : "unsupported"));
  const unread = items.filter((item) => !item.readAt && item.type !== "follow_request").length + requests.length;
  const load = async () => {
    try {
      const [{ data: noticeData }, { data: requestData }] = await Promise.all([api.get("/notifications"), api.get("/user/follow-requests")]);
      setItems(noticeData.data || []); setRequests(requestData.data?.incoming || []);
    } catch { /* Login/session errors are already handled by the chat screen. */ }
  };
  useEffect(() => {
    const initialLoad = window.setTimeout(load, 0);
    const onNew = (item) => {
      setItems((current) => [item, ...current.filter((entry) => String(entry._id) !== String(item._id))].slice(0, 40));
      if (item.type === "message") toast(`${item.actor?.fullName || "Your person"} sent you a message`, { icon: "💬" });
      else if (item.type === "call") toast(`${item.actor?.fullName || "Your person"} is calling`, { icon: "📞" });
      else if (item.type === "follow_request") { toast(`${item.actor?.fullName || "Someone"} sent a follow request`, { icon: "♡" }); load(); }
      else if (item.type === "follow_accepted") { toast(`${item.actor?.fullName || "Your friend"} accepted your follow request`, { icon: "💛" }); window.dispatchEvent(new CustomEvent("mingo:people-changed")); }
      if (document.hidden && permission === "granted") new Notification("Mingo", { body: item.text, tag: String(item._id) });
    };
    socketAPI.on("notification:new", onNew);
    return () => { window.clearTimeout(initialLoad); socketAPI.off("notification:new", onNew); };
  }, [permission]);
  const markRead = async () => {
    setItems((current) => current.map((item) => ({ ...item, readAt: item.readAt || new Date().toISOString() })));
    try { await api.patch("/notifications/read"); } catch { /* The local panel remains usable if offline. */ }
  };
  const decide = async (request, action) => {
    try {
      await api.patch(`/user/follow-requests/${request._id}`, { action });
      setRequests((current) => current.filter((item) => String(item._id) !== String(request._id)));
      setItems((current) => current.map((item) => String(item.meta?.requestId) === String(request._id) ? { ...item, readAt: new Date().toISOString() } : item));
      toast.success(action === "accept" ? `You and ${request.user.fullName} are connected.` : "Follow request declined.");
      window.dispatchEvent(new CustomEvent("mingo:people-changed"));
    } catch (error) { toast.error(error.response?.data?.message || "Couldn't update the follow request."); }
  };
  const enableDesktop = async () => { if (!("Notification" in window)) return toast.error("This browser doesn't support desktop notifications."); const result = await Notification.requestPermission(); setPermission(result); if (result === "granted") toast.success("Desktop alerts are on."); };
  const openNotification = async (item) => {
    if (!item.readAt) { setItems((current) => current.map((entry) => entry._id === item._id ? { ...entry, readAt: new Date().toISOString() } : entry)); api.patch("/notifications/read").catch(() => {}); }
    setOpen(false);
    const contact = contacts.find((person) => String(person._id) === String(item.actor?._id || item.actorId));
    if (contact && ["message", "call", "follow_accepted"].includes(item.type)) onOpenPerson(contact);
  };
  return <div className="notification-wrap"><button className="icon-button notification-trigger" type="button" title="Notifications and follow requests" aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`} onClick={() => { setOpen((value) => !value); if (!open) load(); }}><FiBell/>{unread > 0 && <span className="notification-badge">{unread > 9 ? "9+" : unread}</span>}</button>{open && <section className="notification-popover" aria-label="Notifications"><header><div><strong>Your updates</strong><span>{unread ? `${unread} unread` : "You're all caught up"}</span></div><button type="button" title="Mark all read" onClick={markRead}><FiCheck/></button><button type="button" title="Close" onClick={() => setOpen(false)}><FiX/></button></header><div className="notification-requests"><div className="notification-section-title"><FiUserCheck/> Follow requests <span>{requests.length}</span></div>{requests.length ? requests.map((request) => <article className="follow-request-row" key={request._id}><div className="notification-avatar">{request.user?.avatar ? <img src={assetUrl(request.user.avatar)} alt=""/> : request.user?.fullName?.slice(0,1) || "♡"}</div><div className="follow-request-copy"><strong>{request.user?.fullName || "Mingo member"}</strong><small>wants to follow you</small></div><button className="request-accept" title="Accept" onClick={() => decide(request, "accept")}><FiCheck/></button><button className="request-decline" title="Decline" onClick={() => decide(request, "reject")}><FiX/></button></article>) : <p className="notification-empty">No new follow requests.</p>}</div><div className="notification-items">{items.length ? items.map((item) => <button type="button" className={`notification-item ${item.readAt ? "is-read" : ""}`} key={item._id} onClick={() => openNotification(item)}><span className="notification-item-icon">{item.type === "call" ? "📞" : item.type === "message" ? "💬" : item.type === "follow_request" ? "♡" : "✓"}</span><span><strong>{item.actor?.fullName || "Mingo"}</strong><small>{item.text}</small><time>{new Date(item.createdAt).toLocaleString([], { dateStyle: "short", timeStyle: "short" })}</time></span>{!item.readAt && <i/>}</button>) : <p className="notification-empty">Messages, calls, and follows will show up here.</p>}</div>{permission !== "granted" && <button className="desktop-alert-button" type="button" onClick={enableDesktop}>Turn on desktop alerts</button>}</section>}</div>;
}
