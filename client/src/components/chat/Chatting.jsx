import React, { useEffect, useState } from "react";
import { chatData, userData } from "../../assets/dummy";
import { useAuth } from "../../context/AuthContext";
import api from "../../config/api";
import socketAPI from "../../config/webSocket";

const Chatting = ({ selectedFriend, currentUser }) =>
   {
  const { user } = useAuth();
  const [filteredChatData, setFilteredChatData] = useState([]);
  const [receiver, setReceiver] = useState("");


  const [sender, setSender] = useState("");
  const [message, setMessage] = useState("");
  //console.log(selectedFriend);
  //console.log(currentUser);

  const fetchChatData = async () => {
    try {
      const res = await api.get(`/user/get-messages/${selectedFriend._id}`);
      setFilteredChatData(res.data.data);
    } catch (error) {
      console.error("Failed to fetch chat data", error);
    }
  };

  const handleMessageSendRestAPI = async () =>
     {
    if (!message) return; 
    console.log(message);



    try {
      const res = await api.post("/user/send-message", {
        receiverID: receiver?._id,
        message,
      });
      console.log(res.data.message);
      setMessage("");
      fetchChatData();
    } catch (error) {
      console.error("Failed to send message", error);
    }
  };

  const handleMessageSendSocket = async () => {
    if (!message) return;
    console.log(message);

    const payload = {
      senderID: user._id,
      receiverID: receiver?._id,
      message,
    };

    const timeStamp = new Date().toISOString();

    try {
      if (socketAPI.connected) {
        socketAPI.emit("send", payload);

        setFilteredChatData((prev) => [
          ...prev,
          {
            senderId: user._id,
            receiverId: receiver?._id,
            message,
            updatedAt: timeStamp,
            createdAt: timeStamp,
          },
        ]);
        setMessage("");
      }
    } catch (error) {
      console.error("Failed to send message", error);
    }
  };

  const handleReceiveMessage = (newMessagePack) => 
    {
    console.log("Data Received");

    setFilteredChatData((prev) => [...prev, newMessagePack]);
  };

  useEffect(() => {
    fetchChatData();
    setSender(user);
    setReceiver(selectedFriend);
    // //Polling
    // const interval = setInterval(() => {
    //   fetchChatData();
    // }, 2000);

    // return () => {
    //   clearInterval(interval);
    // };

    if (selectedFriend) {
      socketAPI.on("receive", handleReceiveMessage);
    }

    return () => {
      socketAPI.off("receive", handleReceiveMessage);
    };
  }, [selectedFriend]);

  console.log(filteredChatData);
  return (
    <>
      <div className="bg-base-200 p-4">
        <div>{receiver?.fullName || "no friend Selected"}</div>
      </div>

      <div className="p-3 flex flex-col gap-3">
        <div className="h-[70vh] w-full card p-3 overflow-y-auto bg-accent/20">
          {filteredChatData.map((chat, idx) => (
            <div
              className={`chat ${chat.senderId !== sender._id ? "chat-receiver" : "chat-sender"}`}
            >
              <div className="chat-avatar avatar">
                {/* <div className="size-10 rounded-full">
                  <img
                    src={
                      chat.senderId !== sender._id
                        ? receiver.photo
                        : sender.photo
                    }
                    alt="avatar"
                  />
                </div> */}
              </div>
              <div className="chat-header text-base-content">
                {chat.senderId !== sender._id
                  ? receiver.fullName
                  : sender.fullName}
                <time className="text-base-content/50">{chat.timestamp}</time>
              </div>
              <div className={`chat-bubble `}>{chat.message}</div>
            </div>
          ))}
        </div>
        <div className="h-full px-3 py-2 input flex gap-3">
          <button>😊</button>
          <textarea
            type="text"
            className="w-full outline-0"
            onChange={(e) => setMessage(e.target.value)}
            value={message}
          ></textarea>
          <button onClick={handleMessageSendSocket}>Send</button>
        </div>
      </div>
    </>
  );
};

export default Chatting;