import { io } from "socket.io-client";
import { backendUrl } from "./api";

const socketAPI = io(backendUrl, {
  withCredentials: true,
});

export default socketAPI;
