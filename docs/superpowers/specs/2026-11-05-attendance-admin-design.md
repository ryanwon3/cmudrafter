# Attendance and organizer controls

The lobby lets a captain unselect their seat before readying up. Players choose their own roster name and confirm attendance. A random browser token lets a player withdraw their own check-in; only its hash is stored, and the organizer can correct attendance. Attendance closes when drafting starts. Only present players may be drafted, including organizer picks.

The organizer signs in from a visible Admin login link using the server-side ADMIN_KEY. The requested password is stored only in ignored local configuration and Vercel secrets. The organizer reviews ready captains and present players before explicitly starting the draft, and can undo picks, reset, and publish the final teams after reviewing the completed draft. A public announcement communicates when the next phase will begin. Eight teams and four picks per team remain fixed; start requires at least 32 present players and keeps four picks per captain fixed.

Approach: extend the existing transactional store and Supabase RPCs so the local and hosted modes enforce identical rules. This keeps the existing browser identity model and Realtime updates. Requiring new user accounts would add setup to a casual event; unrestricted attendance toggles would let one player withdraw someone else. A full reset clears attendance and browser tokens; a draft-only reset keeps check-ins and captain claims.

Implementation choices: absent by default, organizer controls all phase transitions, final pick enters review, publish enters complete. Non-destructive hosted migration preserves current claims and picks. Hosted verification must not reset real participant data.
