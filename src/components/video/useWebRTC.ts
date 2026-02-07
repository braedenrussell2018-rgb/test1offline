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
  const [participants, setParticipants] = useState<Map<string, Participant>>(new Map());
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [isVideoMuted, setIsVideoMuted] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  const peerConnections = useRef<Map<string, RTCPeerConnection>>(new Map());
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunks = useRef<Blob[]>([]);
  const localStreamRef = useRef<MediaStream | null>(null);

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

    // Create a combined stream with all audio tracks
    const audioContext = new AudioContext();
    const destination = audioContext.createMediaStreamDestination();

    // Add local audio
    const localAudioTracks = localStreamRef.current.getAudioTracks();
    if (localAudioTracks.length > 0) {
      const localSource = audioContext.createMediaStreamSource(
        new MediaStream(localAudioTracks)
      );
      localSource.connect(destination);
    }

    // Add remote audio tracks
    participants.forEach((participant) => {
      if (participant.stream) {
        const audioTracks = participant.stream.getAudioTracks();
        if (audioTracks.length > 0) {
          const source = audioContext.createMediaStreamSource(
            new MediaStream(audioTracks)
          );
          source.connect(destination);
        }
      }
    });

    // Combine video (local) + mixed audio
    const combinedStream = new MediaStream();
    const videoTrack = localStreamRef.current.getVideoTracks()[0];
    if (videoTrack) combinedStream.addTrack(videoTrack);
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
      const blob = new Blob(recordedChunks.current, { type: "video/webm" });
      onRecordingReady?.(blob);
      setIsRecording(false);
    };

    recorder.start(1000); // Collect data every second
    mediaRecorderRef.current = recorder;
    setIsRecording(true);
    console.log("[WebRTC] Recording started");
  }, [isHost, participants, onRecordingReady]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
      console.log("[WebRTC] Recording stopped");
    }
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
    participants,
    isAudioMuted,
    isVideoMuted,
    isRecording,
    isConnected,
    startMedia,
    joinChannel,
    startRecording,
    stopRecording,
    toggleAudio,
    toggleVideo,
    disconnect,
  };
}
