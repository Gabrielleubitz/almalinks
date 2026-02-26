# Alma Links — Buyer Presentation Walkthrough

Use this as a step-by-step script to show the buyer the full platform. Go in order so she sees the member experience first, then the admin tools that run it.

---

## Part 1: Member experience (what your community sees)

### 1. Login & onboarding
- **Show:** Login page (`/login`).
- **Point out:** Clean login; optional “Forgot password” and signup flow. After login, approved members go to the dashboard; new signups go to a **pending** state until admin approves.
- **Show:** Signup flow (`/signup`) — collect name, email, password; then **Pending** page (`/pending`) so she sees what new applicants see (“Your account is pending approval”).
- **Optional:** Forgot password and Terms/Help pages to show completeness.

---

### 2. Dashboard (member home)
- **Show:** Dashboard (`/dashboard`) as an approved member.
- **Point out:**
  - **Profile card** — Photo, cover, name, title, company, bio. Edits **auto-save** (mention this).
  - **Upcoming events** — Next events they’re registered for; link to full Events.
  - **My connections** — Count and quick link to Members.
  - **Announcements sidebar** — “From the Makers of Alma Links”: top 3 announcements, with **emoji reactions** (👍 ❤️ 🔥 👑 😊). Order is controlled by admin.
- **Show:** Editing profile (name, phone, work, company, LinkedIn, position, bio, city/country, timezone, website, Twitter, skills). Point out **profile and cover photo upload** (Cloudinary) and **saved** indicator.

---

### 3. Events
- **Show:** Events list (`/events`).
- **Point out:** Upcoming and past events; clear CTAs to view details or register.
- **Show:** Event detail (`/events/:slug`) — image, date, location, description, **Register** / **Unregister**.
- **Point out:** Registration is per-event; members can see their registrations on the dashboard and on this page.

---

### 4. Members directory
- **Show:** Members page (`/members`).
- **Point out:**
  - **Search** by name/email.
  - **Grid vs list** view.
  - **Member cards**: photo, name, title, company, location, LinkedIn; **Connect** or **Connected** / **Pending**.
  - **Connection requests**: daily limit (e.g. 5/day) to avoid spam; incoming requests can be accepted/declined.
- **Show:** **Map view** (if enabled) — members on a map by location.
- **Show:** Clicking a member → **profile** (`/profile/:userId`) with full bio, contact, and connection option.

---

### 5. Connection magic link (in-person / email)
- **Show:** Connect page (`/connect?to=USER_ID&event=EVENT_ID`) — e.g. from QR or email link.
- **Point out:** Designed for events: “Connect with [Name]” — one-click send or accept connection. No need to search in the directory.

---

### 6. Chats
- **Show:** Chats list (`/chats`).
- **Point out:** Group chats the member is in; **Discover** to browse and request to join; admins see **New Chat**.
- **Show:** **Discover Chats** — list of joinable groups; **Request to join** where allowed.
- **Show:** Opening a chat (`/chats/:chatId`) — messages, **send**, **emoji reactions**, **settings** (for admins: edit group name/description/image, allow join requests, add/remove members, view join requests). **Close chat** (X) returns to list.
- **Point out:** Group image and name; real-time messaging; admin can reorder announcements and manage chats.

---

## Part 2: Admin experience (what you run the community with)

Start from **Admin** in the nav (or `/admin`). Use the **sidebar** to move between sections.

### 7. Admin dashboard
- **Show:** Admin dashboard (`/admin`).
- **Point out:**
  - **Metrics**: Upcoming events, total users, **pending approvals**, and **integrations** (Mailjet, Mailchimp, Cloudinary, HubSpot) so she sees the stack.
  - **Shortcuts**: Pending registrations, Users, Events, Email, Announcements, Chats, Check-in, Connections, Activity, HubSpot Import, System test.

---

### 8. Pending registrations (approve/reject members)
- **Show:** Pending registrations (`/admin/pending-registrations` or **Pending** in sidebar).
- **Point out:** List of applicants; **Approve** or **Reject**; optional email on approval. Rejected users can re-request access (`/re-request-access`).

---

### 9. User management
- **Show:** Users (`/admin/users`).
- **Point out:**
  - **Table**: Avatar, name, **signed-up/joined date**, email, **role badge** (Member / Admin), **role dropdown** to change role.
  - **Actions per user**: **Edit profile**, **Connect** (with another user), **Manage connections**, **Force password reset**, **Delete** (with confirmation).
  - **Create user** and **Bulk import** (CSV) for adding many users.
  - **Audit logs** button — all admin actions (user created, updated, role changed, password reset, deleted) with clear “what changed” and no fake “no change” lines.
- **Show:** **Edit user** (`/admin/users/:userId/edit`) — full profile edit, profile/cover upload, **auto-save**, role change. Mention that autosave runs in the background without jumping the page.

---

### 10. Events (create, edit, manage)
- **Show:** Events (`/admin/events`) — list of events; **Add event**.
- **Show:** Create event (`/admin/events/create` or `/admin/events/add`).
- **Point out:** Name, date, location, description, **event image** (URL or **upload to Cloudinary**), optional Mailchimp announcement on create.
- **Show:** Edit event — same fields; image library (Cloudinary) for event images.
- **Point out:** Event slug/URL for sharing; registrations visible in Check-in and event detail.

---

### 11. Check-in (event day)
- **Show:** Check-in (`/admin/check-in`).
- **Point out:** Select event; list of registrants; **manual check-in** (e.g. mark attended). Useful for in-person events.

---

### 12. Announcements
- **Show:** Announcements (`/admin/announcements`).
- **Point out:**
  - **Create**: Message (300 chars), **Publish**; appears in member dashboard sidebar.
  - **List**: Each item has **move up/down** to **reorder** (order is what members see); **Edit**, **Active/Hidden**, **Delete**; **emoji reactions** from members.
  - Only the **top 3 active** (by order) show on the dashboard; reordering here changes that.

---

### 13. Chats (admin)
- **Show:** Chats (`/admin/chats`) — all group chats.
- **Point out:** **Create** new group: name, description, **group image** (URL or **Upload to Cloudinary**), allow join requests, public/private, **initial admins** and **seed members**.
- **Show:** Managing a chat: add members, join as admin; in the **member chat view** you already showed editing group name/description/image (Cloudinary) and **Close chat**.
- **Point out:** One place to create and manage all community groups.

---

### 14. Email
- **Show:** Email (`/admin/email`).
- **Point out:** Send **transactional/template emails** (e.g. event announcement, password reset, welcome). Integrates with **Mailjet** and/or **Mailchimp**; templates and audience options so she can communicate at scale.

---

### 15. Connections management
- **Show:** Connections (`/admin/connections`).
- **Point out:** View and manage **connections** between members (who’s connected to whom). Useful for support or data export.

---

### 16. Activity (audit & analytics)
- **Show:** Activity (`/admin/activity`).
- **Point out:** **Activity logs** (logins, page views, profile updates, event registrations, connection requests, chat activity). **Filter** by type, date, search; **export CSV**; stats (total activities, active users, top type). Optional **cleanup** (duplicates, old logs) so she knows the platform stays manageable.

---

### 17. HubSpot import (optional)
- **Show:** HubSpot Import (`/admin/hubspot-import`) if relevant.
- **Point out:** Import contacts from **HubSpot** into the community (users or events). Mention **HubSpot** integration in the dashboard integrations card.

---

### 18. System test (optional)
- **Show:** System test (`/admin/system-test`) briefly.
- **Point out:** Quick checks for **email**, **Firebase**, and other integrations so she can verify configuration.

---

## Part 3: Integrations & technical highlights (talking points)

When she asks “how is this built?” or “what can I plug in?”:

- **Auth & database:** Firebase (Auth + Firestore). Secure, real-time, scales.
- **Email:** Mailjet and/or Mailchimp for transactional and campaigns; event announcements and optional welcome/signup emails.
- **Images:** Cloudinary for profile photos, cover photos, event images, and **chat group images** (upload on create and in chat settings).
- **HubSpot:** Import contacts; optional sync of users/events so community and CRM stay aligned.
- **Audit:** Admin actions (user create/update/role/password reset/delete) logged with **only real changes** shown; activity logs for member behavior.
- **Mobile-friendly:** Layout and touch targets work on phones; connection links and check-in are event-day friendly.
- **Terms & help:** Terms of service and Help page; optional terms agreement modal after login.

---

## Quick reference — All features list

| Area | Feature |
|------|--------|
| **Auth** | Login, signup, forgot password, reset/change password, pending approval, re-request access, terms |
| **Member** | Dashboard, profile edit (auto-save), profile/cover upload, events list & detail, event registration, members directory (search, grid/list, map), connect requests (send/accept/decline, daily limit), connection magic link, chats list, discover chats, group chat (messages, reactions, settings), announcements sidebar (reactions), profile view |
| **Admin** | Dashboard (metrics, integrations), pending registrations (approve/reject), user management (list, create, bulk import, edit, role, force password reset, delete, audit logs), events (list, create, edit, images), check-in, announcements (create, reorder, active/hidden, delete), chats (create, manage, group image), email (templates/send), connections management, activity logs (filter, export, cleanup), HubSpot import, system test |
| **Integrations** | Firebase, Mailjet, Mailchimp, Cloudinary, HubSpot |

---

## Suggested presentation order (30–45 min)

1. **Login + Pending** (2 min) — show member journey start.
2. **Dashboard** (5 min) — profile, events, connections, announcements.
3. **Events** (3 min) — list, one event detail, register.
4. **Members** (4 min) — directory, search, connect, profile, map.
5. **Connect link** (1 min) — magic link for events.
6. **Chats** (4 min) — list, discover, one chat (send, reactions, settings).
7. **Admin dashboard** (2 min) — metrics and integrations.
8. **Pending + Users** (5 min) — approve user, user list, edit one user, audit logs.
9. **Events + Check-in** (4 min) — create/edit event, check-in.
10. **Announcements + Chats admin** (4 min) — create announcement, reorder; create chat, upload image.
11. **Email + Activity** (3 min) — email tool, activity logs and export.
12. **HubSpot / System test** (1–2 min) — if she cares about CRM or tech checks.

End with: “You have the codebase and this walkthrough; you can rebrand, add events, and run the community from day one.”
