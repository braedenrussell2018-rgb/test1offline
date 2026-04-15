import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Play,
  Pause,
  Users,
  MonitorUp,
  Volume2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface RecordingTrack {
  user_id: string;
  user_name: string;
  file_path: string;
  is_screen_share: boolean;
}

interface SpeakerTimelineEntry {
  timestamp_ms: number;
  speaker_user_id: string;
}

interface MultiTrackPlayerProps {
  tracks: RecordingTrack[];
  speakerTimeline: SpeakerTimelineEntry[];
  meetingStartedAt?: string;
}

export function MultiTrackPlayer({ tracks, speakerTimeline, meetingStartedAt }: MultiTrackPlayerProps) {
  const [signedUrls, setSignedUrls] = useState<Map<string, string>>(new Map());
  const [visibleTracks, setVisibleTracks] = useState<Set<string>>(new Set(tracks.map(t => t.file_path)));
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [activeSpeaker, setActiveSpeaker] = useState<string | null>(null);
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());
  const primaryVideoRef = useRef<string | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const timelineStartMs = useRef<number>(0);

  // Fetch signed URLs for all tracks
  useEffect(() => {
    const fetchUrls = async () => {
      const urlMap = new Map<string, string>();
      await Promise.all(
        tracks.map(async (track) => {
          const { data, error } = await supabase.storage
            .from("meeting-recordings")
            .createSignedUrl(track.file_path, 3600);
          if (data && !error) {
            urlMap.set(track.file_path, data.signedUrl);
          }
        })
      );
      setSignedUrls(urlMap);
    };
    if (tracks.length > 0) fetchUrls();
  }, [tracks]);

  // Set timeline start from speaker timeline or meeting start
  useEffect(() => {
    if (speakerTimeline.length > 0) {
      timelineStartMs.current = speakerTimeline[0].timestamp_ms;
    } else if (meetingStartedAt) {
      timelineStartMs.current = new Date(meetingStartedAt).getTime();
    }
  }, [speakerTimeline, meetingStartedAt]);

  // Track duration from first loaded video
  const handleLoadedMetadata = useCallback((filePath: string, el: HTMLVideoElement) => {
    if (el.duration && el.duration > duration) {
      setDuration(el.duration);
      primaryVideoRef.current = filePath;
    }
  }, [duration]);

  // Sync all videos to the same time
  const syncAllVideos = useCallback((time: number) => {
    videoRefs.current.forEach((video) => {
      if (Math.abs(video.currentTime - time) > 0.5) {
        video.currentTime = time;
      }
    });
  }, []);

  // Update current time and active speaker
  const updatePlayback = useCallback(() => {
    const primary = primaryVideoRef.current ? videoRefs.current.get(primaryVideoRef.current) : null;
    if (primary) {
      setCurrentTime(primary.currentTime);

      // Determine active speaker
      if (speakerTimeline.length > 0 && timelineStartMs.current > 0) {
        const currentMs = timelineStartMs.current + primary.currentTime * 1000;
        let speaker: string | null = null;
        for (let i = speakerTimeline.length - 1; i >= 0; i--) {
          if (speakerTimeline[i].timestamp_ms <= currentMs) {
            speaker = speakerTimeline[i].speaker_user_id;
            break;
          }
        }
        setActiveSpeaker(speaker);
      }
    }

    if (isPlaying) {
      animFrameRef.current = requestAnimationFrame(updatePlayback);
    }
  }, [isPlaying, speakerTimeline]);

  useEffect(() => {
    if (isPlaying) {
      animFrameRef.current = requestAnimationFrame(updatePlayback);
    }
    return () => {
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isPlaying, updatePlayback]);

  const togglePlayPause = useCallback(() => {
    const newPlaying = !isPlaying;
    videoRefs.current.forEach((video, filePath) => {
      if (visibleTracks.has(filePath)) {
        if (newPlaying) video.play().catch(() => {});
        else video.pause();
      }
    });
    setIsPlaying(newPlaying);
  }, [isPlaying, visibleTracks]);

  const handleSeek = useCallback((values: number[]) => {
    const time = values[0];
    setCurrentTime(time);
    syncAllVideos(time);
  }, [syncAllVideos]);

  const toggleTrack = useCallback((filePath: string) => {
    setVisibleTracks((prev) => {
      const next = new Set(prev);
      if (next.has(filePath)) {
        next.delete(filePath);
        // Pause hidden video
        const video = videoRefs.current.get(filePath);
        if (video) video.pause();
      } else {
        next.add(filePath);
        // Sync and play if currently playing
        const video = videoRefs.current.get(filePath);
        if (video) {
          const primary = primaryVideoRef.current ? videoRefs.current.get(primaryVideoRef.current) : null;
          if (primary) video.currentTime = primary.currentTime;
          if (isPlaying) video.play().catch(() => {});
        }
      }
      return next;
    });
  }, [isPlaying]);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const visibleTrackList = tracks.filter(t => visibleTracks.has(t.file_path));
  const visibleCount = visibleTrackList.length;

  if (tracks.length === 0) {
    return (
      <div className="flex items-center justify-center py-8 bg-muted rounded-lg">
        <p className="text-muted-foreground">No recording tracks available</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Video Grid */}
      <div className="rounded-lg overflow-hidden bg-black">
        <div className={`grid gap-1 ${
          visibleCount <= 1 ? "grid-cols-1" : visibleCount <= 4 ? "grid-cols-2" : "grid-cols-3"
        }`} style={{ minHeight: visibleCount > 0 ? "300px" : undefined }}>
          {tracks.map((track) => {
            const url = signedUrls.get(track.file_path);
            const isVisible = visibleTracks.has(track.file_path);
            const isSpeaking = activeSpeaker === track.user_id && !track.is_screen_share;

            return (
              <div
                key={track.file_path}
                className={`relative ${!isVisible ? "hidden" : ""}`}
                style={isVisible ? {} : { display: "none" }}
              >
                <div className={`relative rounded overflow-hidden ${
                  isSpeaking ? "ring-2 ring-yellow-400 ring-offset-1 ring-offset-black" : ""
                }`}>
                  {url ? (
                    <video
                      ref={(el) => {
                        if (el) {
                          videoRefs.current.set(track.file_path, el);
                          el.onloadedmetadata = () => handleLoadedMetadata(track.file_path, el);
                        } else {
                          videoRefs.current.delete(track.file_path);
                        }
                      }}
                      src={url}
                      className="w-full h-full object-cover"
                      style={{ maxHeight: visibleCount <= 2 ? "400px" : "250px" }}
                      playsInline
                      muted={track.is_screen_share}
                    />
                  ) : (
                    <div className="flex items-center justify-center h-48 bg-muted">
                      <p className="text-muted-foreground text-sm">Loading...</p>
                    </div>
                  )}
                  <div className="absolute bottom-2 left-2 flex items-center gap-1.5">
                    <Badge
                      variant="secondary"
                      className={`text-xs ${isSpeaking ? "bg-yellow-500/90 text-black" : "bg-black/60 text-white"}`}
                    >
                      {track.is_screen_share ? (
                        <><MonitorUp className="h-3 w-3 mr-1" />Screen Share</>
                      ) : (
                        <><Users className="h-3 w-3 mr-1" />{track.user_name}</>
                      )}
                    </Badge>
                    {isSpeaking && (
                      <Badge className="bg-yellow-500/90 text-black text-[10px] px-1.5">
                        <Volume2 className="h-3 w-3" />
                      </Badge>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {visibleCount === 0 && (
          <div className="flex items-center justify-center h-48 text-muted-foreground">
            Select at least one participant to view
          </div>
        )}
      </div>

      {/* Playback Controls */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={togglePlayPause}>
          {isPlaying ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
        </Button>
        <span className="text-xs text-muted-foreground w-12 shrink-0">{formatTime(currentTime)}</span>
        <Slider
          value={[currentTime]}
          min={0}
          max={duration || 1}
          step={0.5}
          onValueChange={handleSeek}
          className="flex-1"
        />
        <span className="text-xs text-muted-foreground w-12 shrink-0 text-right">{formatTime(duration)}</span>
      </div>

      {/* Track Selector */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Users className="h-4 w-4" />
            Participant Tracks ({tracks.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ScrollArea className="max-h-[200px]">
            <div className="space-y-2">
              {tracks.map((track) => (
                <label
                  key={track.file_path}
                  className="flex items-center gap-3 p-2 rounded hover:bg-muted/50 cursor-pointer"
                >
                  <Checkbox
                    checked={visibleTracks.has(track.file_path)}
                    onCheckedChange={() => toggleTrack(track.file_path)}
                  />
                  <div className="flex items-center gap-2 flex-1">
                    {track.is_screen_share ? (
                      <MonitorUp className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Users className="h-4 w-4 text-muted-foreground" />
                    )}
                    <span className="text-sm">
                      {track.is_screen_share ? `Screen Share (${track.user_name})` : track.user_name}
                    </span>
                  </div>
                  {activeSpeaker === track.user_id && !track.is_screen_share && (
                    <Badge variant="outline" className="text-[10px] border-yellow-400 text-yellow-600">Speaking</Badge>
                  )}
                </label>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
