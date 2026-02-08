import { useState, useRef, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Participant {
  id: string;
  user_id: string;
  user_name: string;
  is_host: boolean;
  stream?: MediaStream;
}

interface UseWebRTCOptions {
  meetingId: string;
  userId: string;
  userName: string;
  isHost: boolean;
  onParticipantJoined?: (participant: Participant) => void;
  onParticipantLeft?: (userId: string) => void;
  onRecordingReady?: (blob: Blob) => void;
}

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
];

export function useWebRTC({
  meetingId,
  userId,
  userName,
  isHost,
  onParticipantJoined,
  onParticipantLeft,
  onRecordingReady,
}: UseWebRTCOptions) {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [participants, setParticipants] = useState<Map<string, Participant>>(new Map());
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);

  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunks = useRef<Blob[]>([]);
  const localStreamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const recordingAudioCtxRef = useRef<AudioContext | null>(null);

  const createPeerConnection = useCallback((remoteUserId: string, remoteUserName: string) => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    // Add local tracks
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    // Handle ICE candidates
    pc.onicecandidate = (event) => {
      if (event.candidate && channelRef.current) {
        channelRef.current.send({
          type: "broadcast",
          event: "ice-candidate",
          payload: {
            candidate: event.candidate.toJSON(),
            from: userId,
            to: remoteUserId,
          },
        });
      }
    };

    // Handle remote tracks
    pc.ontrack = (event) => {
      const remoteStream = event.streams[0];
      if (remoteStream) {
        setParticipants((prev) => {
          const updated = new Map(prev);
          const existing = updated.get(remoteUserId);
          updated.set(remoteUserId, {
            id: remoteUserId,
            user_id: remoteUserId,
            user_name: remoteUserName,
            is_host: false,
            stream: remoteStream,
            ...existing,
          });
          return updated;
        });
        onParticipantJoined?.({
          id: remoteUserId,
          user_id: remoteUserId,
          user_name: remoteUserName,
          is_host: false,
          stream: remoteStream,
        });
      }
    };

    pc.onconnectionstatechange = () => {
      console.log(`[WebRTC] Connection state with ${remoteUserId}: ${pc.connectionState}`);
      if (pc.connectionState === "disconnected" || pc.connectionState === "failed") {
        handlePeerDisconnect(remoteUserId);
      }
    };

    peerConnections.current.set(remoteUserId, pc);
    return pc;
  }, [userId, onParticipantJoined]);

  const handlePeerDisconnect = useCallback((remoteUserId: string) => {
    const pc = peerConnections.current.get(remoteUserId);
    if (pc) {
      pc.close();
      peerConnections.current.delete(remoteUserId);
    }
    setParticipants((prev) => {
      const updated = new Map(prev);
      updated.delete(remoteUserId);
      return updated;
    });
    onParticipantLeft?.(remoteUserId);
  }, [onParticipantLeft]);

  const startMedia = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true,
      });
      localStreamRef.current = stream;
      setLocalStream(stream);
      return stream;
    } catch (error) {
      console.error("[WebRTC] Failed to get media:", error);
      // Try audio only
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: false,
        });
        localStreamRef.current = stream;
        setLocalStream(stream);
        return stream;
      } catch (audioError) {
        console.error("[WebRTC] Failed to get audio:", audioError);
        throw audioError;
      }
    }
  }, []);

  const joinChannel = useCallback(async () => {
    const channel = supabase.channel(`meeting:${meetingId}`, {
      config: { broadcast: { self: false } },
    });

    channelRef.current = channel;

    channel
      .on("broadcast", { event: "user-joined" }, async ({ payload }) => {
        console.log("[WebRTC] User joined:", payload);
        if (payload.userId === userId) return;

        const pc = createPeerConnection(payload.userId, payload.userName);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        channel.send({
          type: "broadcast",
          event: "offer",
          payload: {
            sdp: offer,
            from: userId,
            fromName: userName,
            to: payload.userId,
          },
        });
      })
      .on("broadcast", { event: "offer" }, async ({ payload }) => {
        if (payload.to !== userId) return;
        console.log("[WebRTC] Received offer from:", payload.from);

        const pc = createPeerConnection(payload.from, payload.fromName);
        await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        channel.send({
          type: "broadcast",
          event: "answer",
          payload: {
            sdp: answer,
            from: userId,
            to: payload.from,
          },
        });
      })
      .on("broadcast", { event: "answer" }, async ({ payload }) => {
        if (payload.to !== userId) return;
        console.log("[WebRTC] Received answer from:", payload.from);

        const pc = peerConnections.current.get(payload.from);
        if (pc) {
          await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        }
      })
      .on("broadcast", { event: "ice-candidate" }, async ({ payload }) => {
        if (payload.to !== userId) return;

        const pc = peerConnections.current.get(payload.from);
        if (pc && payload.candidate) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
          } catch (e) {
            console.error("[WebRTC] Error adding ICE candidate:", e);
          }
        }
      })
      .on("broadcast", { event: "user-left" }, ({ payload }) => {
        if (payload.userId !== userId) {
          handlePeerDisconnect(payload.userId);
        }
      })
      .subscribe((status) => {
        console.log("[WebRTC] Channel status:", status);
        if (status === "SUBSCRIBED") {
          setIsConnected(true);
          // Announce presence
          channel.send({
            type: "broadcast",
            event: "user-joined",
            payload: { userId, userName, isHost },
          });
        }
      });
  }, [meetingId, userId, userName, isHost, createPeerConnection, handlePeerDisconnect]);

  const startRecording = useCallback(() => {
    if (!localStreamRef.current || !isHost) return;

    // Create a canvas to composite all video streams
    const canvas = document.createElement("canvas");
    canvas.width = 1280;
    canvas.height = 720;
    canvasRef.current = canvas;
    const ctx = canvas.getContext("2d")!;

    // Hidden video elements for drawing
    const videoElements = new Map<string, HTMLVideoElement>();

    // Create video element for local stream
    const localVid = document.createElement("video");
    localVid.srcObject = localStreamRef.current;
    localVid.muted = true;
    localVid.playsInline = true;
    localVid.play().catch(() => {});
    videoElements.set("local", localVid);

    // Draw loop: composite all streams into a grid on the canvas
    const drawFrame = () => {
      // Rebuild video elements for current participants
      const currentParticipants = Array.from(participants.values());
      // Add new participant videos
      currentParticipants.forEach((p) => {
        if (p.stream && !videoElements.has(p.user_id)) {
          const vid = document.createElement("video");
          vid.srcObject = p.stream;
          vid.playsInline = true;
          vid.play().catch(() => {});
          videoElements.set(p.user_id, vid);
        }
      });

      const allIds = ["local", ...currentParticipants.filter(p => p.stream).map(p => p.user_id)];
      const count = allIds.length;
      const cols = count <= 1 ? 1 : count <= 4 ? 2 : 3;
      const rows = Math.ceil(count / cols);
      const cellW = canvas.width / cols;
      const cellH = canvas.height / rows;

      ctx.fillStyle = "#1a1a2e";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      allIds.forEach((id, i) => {
        const vid = videoElements.get(id);
        if (!vid || vid.readyState < 2) return;
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = col * cellW;
        const y = row * cellH;

        // Draw video maintaining aspect ratio (cover)
        const vidAspect = vid.videoWidth / vid.videoHeight;
        const cellAspect = cellW / cellH;
        let sx = 0, sy = 0, sw = vid.videoWidth, sh = vid.videoHeight;
        if (vidAspect > cellAspect) {
          sw = vid.videoHeight * cellAspect;
          sx = (vid.videoWidth - sw) / 2;
        } else {
          sh = vid.videoWidth / cellAspect;
          sy = (vid.videoHeight - sh) / 2;
        }
        ctx.drawImage(vid, sx, sy, sw, sh, x + 2, y + 2, cellW - 4, cellH - 4);

        // Draw name label
        const label = id === "local" ? "You (Host)" : (currentParticipants.find(p => p.user_id === id)?.user_name || id);
        ctx.fillStyle = "rgba(0,0,0,0.6)";
        ctx.fillRect(x + 2, y + cellH - 30, Math.min(label.length * 9 + 16, cellW - 4), 26);
        ctx.fillStyle = "#fff";
        ctx.font = "13px sans-serif";
        ctx.fillText(label, x + 10, y + cellH - 11);
      });

      animationFrameRef.current = requestAnimationFrame(drawFrame);
    };
    drawFrame();

    // Mix all audio
    const audioContext = new AudioContext();
    recordingAudioCtxRef.current = audioContext;
    const destination = audioContext.createMediaStreamDestination();

    const localAudioTracks = localStreamRef.current.getAudioTracks();
    if (localAudioTracks.length > 0) {
      const localSource = audioContext.createMediaStreamSource(new MediaStream(localAudioTracks));
      localSource.connect(destination);
    }

    participants.forEach((participant) => {
      if (participant.stream) {
        const audioTracks = participant.stream.getAudioTracks();
        if (audioTracks.length > 0) {
          const source = audioContext.createMediaStreamSource(new MediaStream(audioTracks));
          source.connect(destination);
        }
      }
    });

    // Combine canvas video + mixed audio
    const canvasStream = canvas.captureStream(30);
    const combinedStream = new MediaStream();
    canvasStream.getVideoTracks().forEach((t) => combinedStream.addTrack(t));
    destination.stream.getAudioTracks().forEach((t) => combinedStream.addTrack(t));

    const recorder = new MediaRecorder(combinedStream, {
      mimeType: MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
        ? "video/webm;codecs=vp9,opus"
        : "video/webm",
    });

    recordedChunks.current = [];
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        recordedChunks.current.push(event.data);
      }
    };

    recorder.onstop = () => {
      // Cleanup canvas drawing loop
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      recordingAudioCtxRef.current?.close();
      recordingAudioCtxRef.current = null;
      canvasRef.current = null;

      const blob = new Blob(recordedChunks.current, { type: "video/webm" });
      console.log("[WebRTC] Recording blob ready, size:", blob.size);
      onRecordingReady?.(blob);
      setIsRecording(false);
    };

    recorder.start(1000);
    mediaRecorderRef.current = recorder;
    setIsRecording(true);
    console.log("[WebRTC] Canvas-composite recording started");
  }, [isHost, participants, onRecordingReady]);

  const stopRecording = useCallback((): Promise<void> => {
    return new Promise((resolve) => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
        const recorder = mediaRecorderRef.current;
        const originalOnStop = recorder.onstop;
        recorder.onstop = (event) => {
          // Run original handler first (creates blob, calls onRecordingReady)
          if (typeof originalOnStop === 'function') {
            originalOnStop.call(recorder, event);
          }
          // Then resolve the promise
          resolve();
        };
        recorder.stop();
        console.log("[WebRTC] Recording stop requested, waiting for blob...");
      } else {
        resolve();
      }
    });
  }, []);

  const toggleAudio = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsAudioMuted((prev) => !prev);
    }
  }, []);

  const toggleVideo = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((track) => {
        track.enabled = !track.enabled;
      });
      setIsVideoMuted((prev) => !prev);
    }
  }, []);

  const startScreenShare = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });
      const screenTrack = stream.getVideoTracks()[0];

      // Replace the video track in all peer connections
      peerConnections.current.forEach((pc) => {
        const sender = pc.getSenders().find((s) => s.track?.kind === "video");
        if (sender) {
          sender.replaceTrack(screenTrack);
        }
      });

      // When user stops sharing via browser UI
      screenTrack.onended = () => {
        stopScreenShare();
      };

      setScreenStream(stream);
      setIsScreenSharing(true);
      console.log("[WebRTC] Screen sharing started");
    } catch (error) {
      console.error("[WebRTC] Screen share failed:", error);
    }
  }, []);

  const stopScreenShare = useCallback(() => {
    // Restore camera video track to all peers
    const cameraTrack = localStreamRef.current?.getVideoTracks()[0];
    peerConnections.current.forEach((pc) => {
      const sender = pc.getSenders().find((s) => s.track?.kind === "video");
      if (sender && cameraTrack) {
        sender.replaceTrack(cameraTrack);
      }
    });

    // Stop screen tracks
    screenStream?.getTracks().forEach((t) => t.stop());
    setScreenStream(null);
    setIsScreenSharing(false);
    console.log("[WebRTC] Screen sharing stopped");
  }, [screenStream]);

  const disconnect = useCallback(() => {
    // Announce leaving
    if (channelRef.current) {
      channelRef.current.send({
        type: "broadcast",
        event: "user-left",
        payload: { userId },
      });
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    // Close all peer connections
    peerConnections.current.forEach((pc) => pc.close());
    peerConnections.current.clear();

    // Stop recording
    stopRecording();

    // Stop local media
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
      setLocalStream(null);
    }

    setParticipants(new Map());
    setIsConnected(false);
  }, [userId, stopRecording]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, []);

  return {
    localStream,
    screenStream,
    participants,
    isAudioMuted,
    isVideoMuted,
    isRecording,
    isConnected,
    isScreenSharing,
    startMedia,
    joinChannel,
    startRecording,
    stopRecording,
    toggleAudio,
    toggleVideo,
    startScreenShare,
    stopScreenShare,
    disconnect,
  };
}
