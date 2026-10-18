import { useCallback, useEffect, useRef, useState } from "react";
import socketAPI from "../config/webSocket";
import toast from "react-hot-toast";

const iceServers = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

export default function useCalls(contacts = []) {
  const [call, setCall] = useState(null);
  const [incomingCall, setIncomingCall] = useState(null);
  const [localStream, setLocalStream] = useState(null);
  const [remoteStream, setRemoteStream] = useState(null);
  const [muted, setMuted] = useState(false);
  const [cameraOff, setCameraOff] = useState(false);
  const peerRef = useRef(null);
  const localStreamRef = useRef(null);
  const remoteCandidatesRef = useRef([]);
  const incomingCallRef = useRef(null);
  const callRef = useRef(null);
  const callTimeoutRef = useRef(null);
  const contactsRef = useRef(contacts);
  contactsRef.current = contacts;

  const updateCall = useCallback((value) => {
    callRef.current = typeof value === "function" ? value(callRef.current) : value;
    setCall(callRef.current);
  }, []);

  const clearCall = useCallback(() => {
    if (callTimeoutRef.current) clearTimeout(callTimeoutRef.current);
    callTimeoutRef.current = null;
    peerRef.current?.close();
    peerRef.current = null;
    localStreamRef.current?.getTracks().forEach((track) => track.stop());
    localStreamRef.current = null;
    remoteCandidatesRef.current = [];
    incomingCallRef.current = null;
    setIncomingCall(null);
    setLocalStream(null);
    setRemoteStream(null);
    setMuted(false);
    setCameraOff(false);
    updateCall(null);
  }, [updateCall]);

  const flushRemoteCandidates = useCallback(async (peer) => {
    const candidates = remoteCandidatesRef.current.splice(0);
    for (const candidate of candidates) await peer.addIceCandidate(candidate);
  }, []);

  const createPeer = useCallback((peerId) => {
    const peer = new RTCPeerConnection({ iceServers });
    peerRef.current = peer;
    peer.onicecandidate = ({ candidate }) => {
      if (candidate) socketAPI.emit("call:ice", { to: peerId, candidate });
    };
    peer.ontrack = ({ streams }) => { if (streams[0]) setRemoteStream(streams[0]); };
    peer.onconnectionstatechange = () => {
      if (peer.connectionState === "connected") {
        if (callTimeoutRef.current) clearTimeout(callTimeoutRef.current);
        callTimeoutRef.current = null;
        updateCall((current) => current ? { ...current, status: "connected" } : current);
      } else if (peer.connectionState === "failed") {
        clearCall();
        toast.error("The call could not connect. Try again on another network.");
      }
    };
    return peer;
  }, [clearCall, updateCall]);

  const startCall = useCallback(async (peerPerson, type) => {
    if (!peerPerson?._id || callRef.current || incomingCallRef.current) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      toast.error("Calls need a secure HTTPS connection and microphone permission.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: type === "video" });
      localStreamRef.current = stream;
      setLocalStream(stream);
      const peer = createPeer(String(peerPerson._id));
      stream.getTracks().forEach((track) => peer.addTrack(track, stream));
      const offer = await peer.createOffer();
      await peer.setLocalDescription(offer);
      updateCall({ peerId: String(peerPerson._id), peerName: peerPerson.fullName, type, status: "calling" });
      socketAPI.emit("call:offer", { to: String(peerPerson._id), offer: peer.localDescription, callType: type });
      callTimeoutRef.current = setTimeout(() => {
        if (callRef.current?.status === "calling") {
          socketAPI.emit("call:end", { to: String(peerPerson._id) });
          clearCall();
          toast.error("No answer. Try calling again.");
        }
      }, 40000);
    } catch (error) {
      clearCall();
      const message = error.name === "NotAllowedError" ? "Allow microphone/camera access to make a call." : "Could not start the call. Check your microphone or camera.";
      toast.error(message);
    }
  }, [clearCall, createPeer, updateCall]);

  const acceptCall = useCallback(async () => {
    const pending = incomingCallRef.current;
    if (!pending) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: pending.callType === "video" });
      localStreamRef.current = stream;
      setLocalStream(stream);
      const peer = createPeer(String(pending.from));
      await peer.setRemoteDescription(new RTCSessionDescription(pending.offer));
      stream.getTracks().forEach((track) => peer.addTrack(track, stream));
      await flushRemoteCandidates(peer);
      const answer = await peer.createAnswer();
      await peer.setLocalDescription(answer);
      updateCall({ peerId: String(pending.from), peerName: pending.peerName, type: pending.callType, status: "connecting" });
      incomingCallRef.current = null;
      setIncomingCall(null);
      socketAPI.emit("call:answer", { to: String(pending.from), answer: peer.localDescription });
    } catch (error) {
      socketAPI.emit("call:reject", { to: String(pending.from) });
      clearCall();
      toast.error(error.name === "NotAllowedError" ? "Allow microphone/camera access to answer." : "Could not answer the call.");
    }
  }, [clearCall, createPeer, flushRemoteCandidates, updateCall]);

  const declineCall = useCallback(() => {
    const pending = incomingCallRef.current;
    if (pending) socketAPI.emit("call:reject", { to: String(pending.from) });
    clearCall();
  }, [clearCall]);

  const endCall = useCallback(() => {
    if (callRef.current?.peerId) socketAPI.emit("call:end", { to: callRef.current.peerId });
    clearCall();
  }, [clearCall]);

  const toggleMute = useCallback(() => {
    const next = !muted;
    localStreamRef.current?.getAudioTracks().forEach((track) => { track.enabled = !next; });
    setMuted(next);
  }, [muted]);

  const toggleCamera = useCallback(() => {
    const next = !cameraOff;
    localStreamRef.current?.getVideoTracks().forEach((track) => { track.enabled = !next; });
    setCameraOff(next);
  }, [cameraOff]);

  useEffect(() => {
    const findName = (id) => contactsRef.current.find((person) => String(person._id) === String(id))?.fullName || "Your partner";
    const onIncoming = (data) => {
      if (callRef.current || incomingCallRef.current) {
        socketAPI.emit("call:busy", { to: String(data.from) });
        return;
      }
      const pending = { ...data, peerName: findName(data.from) };
      incomingCallRef.current = pending;
      setIncomingCall(pending);
    };
    const onAnswer = async ({ answer } = {}) => {
      const peer = peerRef.current;
      if (!peer || !answer) return;
      try {
        await peer.setRemoteDescription(new RTCSessionDescription(answer));
        await flushRemoteCandidates(peer);
        updateCall((current) => current ? { ...current, status: "connecting" } : current);
      } catch (error) { console.error("Could not apply call answer", error); }
    };
    const onIce = async ({ candidate } = {}) => {
      if (!candidate) return;
      const peer = peerRef.current;
      if (!peer?.remoteDescription) remoteCandidatesRef.current.push(candidate);
      else {
        try { await peer.addIceCandidate(candidate); }
        catch (error) { console.error("Could not apply call network candidate", error); }
      }
    };
    const onUnavailable = () => { clearCall(); toast.error("Your partner is offline or not on the chat page."); };
    const onRejected = () => { clearCall(); toast("Call declined."); };
    const onBusy = () => { clearCall(); toast("Your partner is already on another call."); };
    const onEnded = () => { clearCall(); toast("Call ended."); };
    socketAPI.on("call:incoming", onIncoming);
    socketAPI.on("call:answer", onAnswer);
    socketAPI.on("call:ice", onIce);
    socketAPI.on("call:unavailable", onUnavailable);
    socketAPI.on("call:rejected", onRejected);
    socketAPI.on("call:busy", onBusy);
    socketAPI.on("call:ended", onEnded);
    return () => {
      socketAPI.off("call:incoming", onIncoming);
      socketAPI.off("call:answer", onAnswer);
      socketAPI.off("call:ice", onIce);
      socketAPI.off("call:unavailable", onUnavailable);
      socketAPI.off("call:rejected", onRejected);
      socketAPI.off("call:busy", onBusy);
      socketAPI.off("call:ended", onEnded);
      clearCall();
    };
  }, [clearCall, flushRemoteCandidates, updateCall]);

  return { call, incomingCall, localStream, remoteStream, muted, cameraOff, startCall, acceptCall, declineCall, endCall, toggleMute, toggleCamera };
}
