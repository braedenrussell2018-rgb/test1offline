

## Multi-Stream Recording & Interactive Playback

### Problem
Currently, all participant video streams are composited into a single grid on a canvas and recorded as one video file. During playback, users can only watch this fixed grid -- they cannot isolate individual participants or see who was speaking.

### Solution: Per-Participant Recording + Interactive Playback UI

#### 1. Record Each Participant Individually
Instead of compositing onto a canvas, record each participant's stream (camera + audio) as a separate file. Also record screen shares separately.

- **During recording**: Create a `MediaRecorder` per participant stream (local + each remote peer) plus one for any active screen share
- **On stop**: Upload each file to `meeting-recordings` bucket with path `{meetingId}/{userId}.webm` and `{meetingId}/screen.webm`
- **Store metadata**: Save a `recording_tracks` JSONB array on `video_meetings` containing `[{user_id, user_name, file_path, is_screen_share}]`

#### 2. Active Speaker Detection
Use the Web Audio API `AnalyserNode` on each participant's audio track to detect volume levels. Tag the loudest speaker in real-time.

- During recording, periodically (every 500ms) log `{timestamp_ms, speaker_user_id}` into an array
- Save this as `speaker_timeline` JSONB on `video_meetings` when recording stops
- During playback, highlight the active speaker based on video currentTime

#### 3. Interactive Playback UI (MeetingRecordingPlayer)
Replace the single `<video>` element with a multi-panel viewer:

- **Participant sidebar**: List all recorded participants with thumbnails. Each has a checkbox to toggle visibility.
- **Main view area**: Shows selected participant videos synced to the same playback time. Layout adapts (1 video = full width, 2 = side-by-side, etc.)
- **Active speaker indicator**: Gold border/badge on whichever participant was speaking at the current timestamp
- **Screen share track**: Appears as a selectable item labeled "Screen Share" in the sidebar
- **Playback controls**: Single scrubber/play/pause that controls all visible videos simultaneously

### Database Changes (Migration)
```sql
ALTER TABLE video_meetings
  ADD COLUMN IF NOT EXISTS recording_tracks jsonb DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS speaker_timeline jsonb DEFAULT '[]';
```

### Files Modified
- `src/components/video/useWebRTC.ts` -- Replace single canvas recorder with per-stream recorders + speaker detection
- `src/components/video/VideoMeetingRoom.tsx` -- Upload multiple track files on recording stop, save metadata
- `src/components/video/MeetingRecordingPlayer.tsx` -- Complete rewrite of playback UI with multi-track viewer

### Files Created
- `src/components/video/MultiTrackPlayer.tsx` -- The interactive multi-video playback component with participant selection, synced scrubber, and speaker highlighting

### How Playback Works
1. User opens a past meeting
2. Component reads `recording_tracks` to know which files exist
3. Fetches signed URLs for each track
4. Renders a sidebar of participants with toggle checkboxes (all on by default)
5. Selected videos play in a responsive grid, all synced to one timeline
6. The `speaker_timeline` data highlights the active speaker with a visual indicator
7. Users can toggle any combination: e.g. one person + screen share, or all participants

