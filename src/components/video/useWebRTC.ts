import { useState, useRef, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Participant {
  id: string;
  user_id: string;
  user_name: string;
  is_host: boolean;
  stream?: MediaStream;
}

export interface RecordingTrack {
  user_id: string;
  user_name: string;
  file_path: string;
  is_screen_share: boolean;
}

export interface SpeakerTimelineEntry {
  timestamp_ms: number;
  speaker_user_id: string;
}

interface UseWebRTCOptions {
  meetingId: string;
  userId: string;
  userName: string;
  isHost: boolean;
  onParticipantJoined?: (participant: Participant) => void;
  onParticipantLeft?: (userId: string) => void;
  onRecordingReady?: (tracks: { blob: Blob; userId: string; userName: string; isScreenShare: boolean }[], speakerTimeline: SpeakerTimelineEntry[]) => void;
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
  const localStreamRef = useRef<MediaStream | null>(null);

  // Per-stream recording refs
  const perStreamRecorders = useRef<Map<string, { recorder: MediaRecorder; chunks: Blob[]; userId: string; userName: string; isScreenShare: boolean }>>(new Map());
  const speakerTimelineRef = useRef<SpeakerTimelineEntry[]>([]);
  const speakerDetectionInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const audioAnalysers = useRef<Map<string, { analyser: AnalyserNode; ctx: AudioContext }>>(new Map());
  const pendingStops = useRef<number>(0);
  const allTracksCollected = useRef<{ blob: Blob; userId: string; userName: string; isScreenShare: boolean }[]>([]);

  const createPeerConnection = useCallback((remoteUserId: string, remoteUserName: string) => {
    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

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
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: true });
      localStreamRef.current = stream;
      setLocalStream(stream);
      return stream;
    } catch (error) {
      console.error("[WebRTC] Failed to get media:", error);
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
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
          payload: { sdp: offer, from: userId, fromName: userName, to: payload.userId },
        });
      })
      .on("broadcast", { event: "offer" }, async ({ payload }) => {
        if (payload.to !== userId) return;
        const pc = createPeerConnection(payload.from, payload.fromName);
        await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        channel.send({
          type: "broadcast",
          event: "answer",
          payload: { sdp: answer, from: userId, to: payload.from },
        });
      })
      .on("broadcast", { event: "answer" }, async ({ payload }) => {
        if (payload.to !== userId) return;
        const pc = peerConnections.current.get(payload.from);
        if (pc) await pc.setRemoteDescription(new RTCSessionDescription(payload.sdp));
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
        if (payload.userId !== userId) handlePeerDisconnect(payload.userId);
      })
      .subscribe((status) => {
        console.log("[WebRTC] Channel status:", status);
        if (status === "SUBSCRIBED") {
          setIsConnected(true);
          channel.send({
            type: "broadcast",
            event: "user-joined",
            payload: { userId, userName, isHost },
          });
        }
      });
  }, [meetingId, userId, userName, isHost, createPeerConnection, handlePeerDisconnect]);

  // Helper: create a MediaRecorder for a single stream
  const createStreamRecorder = (stream: MediaStream, trackUserId: string, trackUserName: string, isScreenShare: boolean) => {
    const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9,opus")
      ? "video/webm;codecs=vp9,opus"
      : "video/webm";
    const recorder = new MediaRecorder(stream, { mimeType });
    const chunks: Blob[] = [];

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: "video/webm" });
      console.log(`[WebRTC] Track blob ready for ${trackUserName} (screen=${isScreenShare}), size:`, blob.size);
      allTracksCollected.current.push({ blob, userId: trackUserId, userName: trackUserName, isScreenShare });
      pendingStops.current--;

      if (pendingStops.current <= 0) {
        // All recorders have stopped — deliver results
        if (speakerDetectionInterval.current) {
          clearInterval(speakerDetectionInterval.current);
          speakerDetectionInterval.current = null;
        }
        // Cleanup analysers
        audioAnalysers.current.forEach(({ ctx }) => ctx.close().catch(() => {}));
        audioAnalysers.current.clear();

        onRecordingReady?.(allTracksCollected.current, speakerTimelineRef.current);
        allTracksCollected.current = [];
        speakerTimelineRef.current = [];
        setIsRecording(false);
      }
    };

    recorder.start(1000);
    perStreamRecorders.current.set(`${trackUserId}${isScreenShare ? "-screen" : ""}`, {
      recorder, chunks, userId: trackUserId, userName: trackUserName, isScreenShare,
    });
  };

  // Helper: setup audio analyser for speaker detection
  const setupAnalyser = (stream: MediaStream, trackUserId: string) => {
    const audioTracks = stream.getAudioTracks();
    if (audioTracks.length === 0) return;
    try {
      const ctx = new AudioContext();
      const source = ctx.createMediaStreamSource(new MediaStream(audioTracks));
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      audioAnalysers.current.set(trackUserId, { analyser, ctx });
    } catch (e) {
      console.warn("[WebRTC] Failed to create analyser for", trackUserId, e);
    }
  };

  const startRecording = useCallback(() => {
    if (!localStreamRef.current || !isHost) return;

    perStreamRecorders.current.clear();
    allTracksCollected.current = [];
    speakerTimelineRef.current = [];
    pendingStops.current = 0;

    // Record local stream
    createStreamRecorder(localStreamRef.current, userId, userName, false);
    setupAnalyser(localStreamRef.current, userId);
    pendingStops.current++;

    // Record each remote participant
    participants.forEach((participant) => {
      if (participant.stream) {
        createStreamRecorder(participant.stream, participant.user_id, participant.user_name, false);
        setupAnalyser(participant.stream, participant.user_id);
        pendingStops.current++;
      }
    });

    // Record screen share if active
    if (screenStream) {
      createStreamRecorder(screenStream, userId, userName, true);
      pendingStops.current++;
    }

    // Speaker detection every 500ms
    speakerDetectionInterval.current = setInterval(() => {
      let loudestId = userId;
      let loudestVolume = 0;
      const dataArray = new Uint8Array(128);

      audioAnalysers.current.forEach(({ analyser }, uid) => {
        analyser.getByteFrequencyData(dataArray);
        const avg = dataArray.reduce((sum, v) => sum + v, 0) / dataArray.length;
        if (avg > loudestVolume && avg > 10) {
          loudestVolume = avg;
          loudestId = uid;
        }
      });

      if (loudestVolume > 10) {
        speakerTimelineRef.current.push({
          timestamp_ms: Date.now(),
          speaker_user_id: loudestId,
        });
      }
    }, 500);

    setIsRecording(true);
    console.log("[WebRTC] Per-stream recording started, tracks:", pendingStops.current);
  }, [isHost, participants, userId, userName, screenStream]);

  const stopRecording = useCallback((): Promise<void> => {
    return new Promise((resolve) => {
      const recorders = Array.from(perStreamRecorders.current.values());
      if (recorders.length === 0) { resolve(); return; }

      // Patch the last recorder's onstop to also resolve
      const origOnReady = onRecordingReady;
      let resolved = false;
      const checkResolve = () => {
        if (!resolved && pendingStops.current <= 0) {
          resolved = true;
          resolve();
        }
      };

      // Override onstop on each recorder to track completion
      recorders.forEach(({ recorder }) => {
        const origStop = recorder.onstop;
        recorder.onstop = (event) => {
          if (typeof origStop === "function") origStop.call(recorder, event);
          checkResolve();
        };
      });

      recorders.forEach(({ recorder }) => {
        if (recorder.state !== "inactive") recorder.stop();
      });

      console.log("[WebRTC] Per-stream recording stop requested");

      // Safety timeout
      setTimeout(() => { if (!resolved) { resolved = true; resolve(); } }, 5000);
    });
  }, [onRecordingReady]);

  const toggleAudio = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getAudioTracks().forEach((track) => { track.enabled = !track.enabled; });
      setIsAudioMuted((prev) => !prev);
    }
  }, []);

  const toggleVideo = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getVideoTracks().forEach((track) => { track.enabled = !track.enabled; });
      setIsVideoMuted((prev) => !prev);
    }
  }, []);

  const startScreenShare = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      const screenTrack = stream.getVideoTracks()[0];

      peerConnections.current.forEach((pc) => {
        const sender = pc.getSenders().find((s) => s.track?.kind === "video");
        if (sender) sender.replaceTrack(screenTrack);
      });

      screenTrack.onended = () => { stopScreenShare(); };
      setScreenStream(stream);
      setIsScreenSharing(true);

      // If recording, add screen share track
      if (isRecording) {
        createStreamRecorder(stream, userId, userName, true);
        pendingStops.current++;
      }

      console.log("[WebRTC] Screen sharing started");
    } catch (error) {
      console.error("[WebRTC] Screen share failed:", error);
    }
  }, [isRecording, userId, userName]);

  const stopScreenShare = useCallback(() => {
    const cameraTrack = localStreamRef.current?.getVideoTracks()[0];
    peerConnections.current.forEach((pc) => {
      const sender = pc.getSenders().find((s) => s.track?.kind === "video");
      if (sender && cameraTrack) sender.replaceTrack(cameraTrack);
    });

    // Stop the screen recorder if recording
    const screenRecEntry = perStreamRecorders.current.get(`${userId}-screen`);
    if (screenRecEntry && screenRecEntry.recorder.state !== "inactive") {
      screenRecEntry.recorder.stop();
    }

    screenStream?.getTracks().forEach((t) => t.stop());
    setScreenStream(null);
    setIsScreenSharing(false);
    console.log("[WebRTC] Screen sharing stopped");
  }, [screenStream, userId]);

  const disconnect = useCallback(() => {
    if (channelRef.current) {
      channelRef.current.send({
        type: "broadcast",
        event: "user-left",
        payload: { userId },
      });
      supabase.removeChannel(channelRef.current);
      channelRef.current = null;
    }

    peerConnections.current.forEach((pc) => pc.close());
    peerConnections.current.clear();

    stopRecording();

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
      setLocalStream(null);
    }

    setParticipants(new Map());
    setIsConnected(false);
  }, [userId, stopRecording]);

  useEffect(() => {
    return () => { disconnect(); };
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
