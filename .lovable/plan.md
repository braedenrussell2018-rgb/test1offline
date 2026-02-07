

# Video Call Meeting Feature

## Overview

Add a video call meeting system to the Employee Dashboard where authenticated users can create, join, and rewatch local company meetings with AI-generated notes and to-do lists.

## Architecture

The system uses **browser-native WebRTC** for peer-to-peer video calls, **Supabase Realtime** as the signaling server, **MediaRecorder API** for client-side recording, **Lovable Cloud Storage** for saving recordings, and **Lovable AI** for generating meeting notes and to-do lists.

## How It Works

1. A user clicks "New Meeting" and selects "Local Company Meeting" from a dropdown
2. They fill in a meeting title and it creates a meeting room
3. Other authenticated users see a "Join Meeting" button on live meetings
4. During the call, one participant (the host) records audio/video using the browser's MediaRecorder
5. When the meeting ends, the recording is uploaded to storage
6. An AI edge function processes the audio to generate a summary, key points, and to-do lists for each attendee
7. Users can rewatch any past meeting recording from their dashboard

## Limitations (Browser-Only WebRTC)

- Best for **2-4 participants** (no media server means each participant sends video to every other participant)
- Recording happens on the **host's browser only** -- if the host disconnects, recording stops
- Audio/video quality depends on each participant's network connection
- No screen sharing in initial version (can be added later)

## What Gets Built

### Database Changes

**New table: `video_meetings`**
- `id` (uuid, primary key)
- `title` (text)
- `status` (text: 'waiting', 'live', 'ended')
- `meeting_type` (text: 'local_company')
- `created_by` (uuid, references auth.users)
- `started_at` (timestamptz)
- `ended_at` (timestamptz)
- `recording_url` (text, nullable)
- `ai_summary` (text, nullable)
- `ai_key_points` (jsonb, nullable)
- `ai_todo_list` (jsonb, nullable -- array of {assignee, task, completed})
- `created_at`, `updated_at` (timestamptz)

**New table: `video_meeting_participants`**
- `id` (uuid, primary key)
- `meeting_id` (uuid, references video_meetings)
- `user_id` (uuid)
- `user_name` (text)
- `joined_at` (timestamptz)
- `left_at` (timestamptz, nullable)
- `is_host` (boolean, default false)

**New storage bucket:** `meeting-recordings` (private, with RLS so only authenticated users can read/write)

**Realtime:** Enable realtime on `video_meetings` and `video_meeting_participants` for live status updates.

**RLS policies:** All tables restricted to authenticated users only. Only the creator can delete a meeting. All authenticated users can view and join meetings.

### New Components

1. **`src/components/video/VideoMeetingRoom.tsx`** -- The main video call UI with:
   - Local and remote video streams
   - Mute/unmute audio and video controls
   - End call button
   - Participant list
   - Recording indicator (host only)

2. **`src/components/video/CreateMeetingDropdown.tsx`** -- Dropdown button with "Local Company Meeting" option that opens a dialog to set the meeting title

3. **`src/components/video/LiveMeetingsBanner.tsx`** -- Shows active meetings with "Join" buttons, displayed at the top of the Meetings tab

4. **`src/components/video/MeetingRecordingPlayer.tsx`** -- Video player for rewatching past meetings, with the AI summary, key points, and to-do list displayed alongside

5. **`src/components/video/useWebRTC.ts`** -- Custom hook managing:
   - WebRTC peer connections
   - Supabase Realtime channel for signaling (ICE candidates, SDP offers/answers)
   - MediaRecorder for the host
   - Cleanup on disconnect

### New Edge Function

**`supabase/functions/process-meeting-recording/index.ts`**
- Triggered after a meeting ends and the recording is uploaded
- Downloads the audio from storage
- Sends audio to Lovable AI (Gemini Flash) for transcription and analysis
- Generates: summary, key points, and a to-do list with assignees
- Updates the `video_meetings` row with the AI output

### Employee Dashboard Changes

- Add a "Video Meetings" sub-section within the existing Meetings tab
- "New Meeting" dropdown button at the top
- Live meetings banner with join buttons
- Past meetings list with recording playback and AI notes
- Stats card updated to show active meetings count

## Technical Details

### Signaling via Supabase Realtime

Instead of a dedicated signaling server, WebRTC signaling (SDP offers/answers, ICE candidates) will be exchanged through a Supabase Realtime broadcast channel named `meeting:{meetingId}`. This avoids any additional infrastructure.

### Recording Flow

1. Host's browser captures all audio/video streams using `MediaRecorder`
2. On meeting end, the recorded blob is uploaded to `meeting-recordings` bucket
3. The client calls the `process-meeting-recording` edge function with the meeting ID
4. The edge function fetches the recording, sends it to AI for analysis, and saves results

### AI Note-Taking

The edge function will use Lovable AI (google/gemini-3-flash-preview) to:
- Transcribe the meeting audio
- Generate a structured summary
- Extract action items as a to-do list with suggested assignees based on meeting context

