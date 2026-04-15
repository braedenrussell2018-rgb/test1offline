

## Video Meetings Improvement Plan

### Priority 1 -- Pre-Join Lobby
Create a `MeetingLobby` component shown before entering the room. Users see a local camera preview, can toggle mic/camera, set their display name, and click "Join" when ready.

### Priority 2 -- Invite Link & Meeting Code
- Generate a short meeting code (e.g. 6-char alphanumeric) stored on the `video_meetings` table
- Add a "Copy Link" button that copies `{app_url}/meeting/{code}`
- Add a "Join by Code" input field on the dashboard
- Add a `/meeting/:code` route that resolves the code and joins

### Priority 3 -- Participant List Panel
Add a toggleable sidebar showing all connected participants with:
- Name, host badge, mute/video status icons
- Host controls: mute a participant, remove from meeting

### Priority 4 -- Reactions & Hand Raise
- Add reaction buttons (thumbs up, clap, heart, hand raise) in the control bar
- Broadcast reactions via Supabase Realtime
- Show floating emoji animations over participant tiles
- Show a persistent "hand raised" indicator on the participant's video

### Priority 5 -- Meeting Duration Timer
Display elapsed time in the header since `started_at`, updating every second.

### Priority 6 -- Interactive Todo List
Make the AI-generated action item checkboxes functional -- toggling updates the `ai_todo_list` JSONB in the database so progress is saved.

### Priority 7 -- Speaker View Toggle
Add a button to switch between:
- **Grid view** (current default): equal-sized tiles
- **Speaker view**: active speaker large, others in a small strip

### Priority 8 -- Meeting Scheduling
- Add date/time picker to the create meeting dialog
- Store `scheduled_at` on `video_meetings`
- Show upcoming scheduled meetings in the banner with a countdown
- Optional: integrate with the existing `WeeklyCalendar` component

### Technical Details

**Database migrations needed:**
- Add `meeting_code` (text, unique) and `scheduled_at` (timestamptz, nullable) columns to `video_meetings`
- Auto-generate meeting codes via a trigger or application logic

**New components:**
- `src/components/video/MeetingLobby.tsx`
- `src/components/video/ParticipantList.tsx`
- `src/components/video/MeetingReactions.tsx`

**Modified files:**
- `src/components/video/VideoMeetingRoom.tsx` -- add timer, reactions, participant panel, speaker view toggle
- `src/components/video/CreateMeetingDropdown.tsx` -- add scheduling, copy link
- `src/components/video/LiveMeetingsBanner.tsx` -- show scheduled meetings
- `src/components/video/MeetingRecordingPlayer.tsx` -- make todo checkboxes interactive
- `src/App.tsx` -- add `/meeting/:code` route

### Implementation Order
Tackle in priority order (1-8). Each priority is a self-contained deliverable.

