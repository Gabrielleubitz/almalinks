# Mobile optimization audit

All listed pages have been checked for mobile-friendly layout. Global settings (see below) plus per-page wrappers ensure no horizontal scroll and consistent padding on small screens.

## Global mobile setup (already in place)

- **index.html**: `viewport` meta with `width=device-width, initial-scale=1.0, viewport-fit=cover`; `mobile-web-app-capable` and `apple-mobile-web-app-*` for PWA.
- **index.css**: `html, body { overflow-x: hidden; max-width: 100vw }`; `min-height: 100dvh`; safe-area insets; `@media (max-width: 768px)` and `480px` for containers, tables (`overflow-x: auto`), touch targets (`min-height: 44px`), and word-break.
- **useIsMobile** hook: breakpoint at 768px for conditional UI (e.g. MobileLayout vs desktop).

## Pages and status

| Route | Page component | Mobile status |
|-------|----------------|---------------|
| `/` | HomePage | OK – overflow-x-hidden, w-full |
| `/theme-preview` | ThemePreview | OK – responsive padding |
| `/help` | HelpPage | OK – overflow-x-hidden, responsive padding |
| `/terms` | TermsPage | OK – overflow-x-hidden, responsive padding |
| `/login` | LoginPage | OK – overflow-x-hidden, px-3 sm:px-4, touch targets |
| `/signup` | SignupPage | OK – overflow-x-hidden, px-3 sm:px-4 |
| `/forgot-password` | ForgotPasswordPage | OK – overflow-x-hidden, px-3 sm:px-4 |
| `/reset-password` | ResetPasswordPage | OK – overflow-x-hidden, px-3 sm:px-4 |
| `/change-password` | ChangePasswordPage | OK – overflow-x-hidden, px-3 sm:px-4 |
| `/pending` | PendingPage | OK – overflow-x-hidden, px-3 sm:px-4 |
| `/re-request-access` | ReRequestAccessPage | OK – overflow-x-hidden, px-3 sm:px-4 |
| `/unauthorized` | UnauthorizedPage | OK – overflow-x-hidden, px-3 sm:px-4 |
| `/connect` | ConnectPage | OK – overflow-x-hidden, px-3 sm:px-4 (both states) |
| `/dashboard` | DashboardPage | OK – overflow-x-hidden, responsive grid & sections |
| `/events` | EventsPage | OK – overflow-x-hidden |
| `/events/:slug` | EventDetailPage | OK – overflow-x-hidden (loading, error, main) |
| `/complete-profile` | CompleteProfilePage | OK – overflow-x-hidden, px-3 sm:px-4 |
| `/profile/:userId` | UserProfilePage | OK – overflow-x-hidden |
| `/members` | MembersPage | OK – overflow-x-hidden |
| `/chats` | ChatsPage | OK – h-screen, overflow-hidden, touch targets |
| `/chats/:chatId` | ChatViewPage | OK – h-screen max-h-dvh, overflow-hidden, 44px targets |
| `/discover-chats` | DiscoverChatsPage | OK – overflow-x-hidden |
| `/admin` | AdminDashboard | OK – overflow-x-hidden |
| `/admin/email` | AdminEmail | OK – overflow-x-hidden |
| `/admin/announcements` | AdminAnnouncements | OK – overflow-x-hidden |
| `/admin/chats` | AdminChatManagement | OK – overflow-x-hidden |
| `/admin/chats/create` | CreateChatGroup | OK – overflow-x-hidden, min-h-[44px] buttons |
| `/admin/events` | EventManagement | OK – overflow-x-auto on tables, overflow-x-hidden root |
| `/admin/events/create`, `/add` | AddEvent | OK – overflow-x-hidden |
| `/admin/events/:eventId/edit` | EditEvent | OK – overflow-x-hidden |
| `/admin/users` | UserManagement | OK – overflow-x-auto on tables, 44px touch targets |
| `/admin/pending-registrations`, `/pending` | PendingRegistrations | OK – overflow-x-hidden, overflow-x-auto where needed |
| `/admin/connections` | ConnectionManagement | OK – overflow-x-hidden |
| `/admin/activity` | ActivityManagement | OK – overflow-x-auto on table, overflow-x-hidden root |
| `/admin/users/:userId/edit` | AdminUserEdit | OK – overflow-x-hidden |
| `/admin/system-test` | SystemTestPage | OK – overflow-x-hidden |
| `/admin/hubspot-import` | HubSpotImportPage | OK – overflow-x-hidden |
| `/welcome` | (redirect to /dashboard) | N/A |
| Profile edit (in-dashboard / profile flow) | ProfileEditPage | OK – overflow-x-hidden |
| User directory | UserDirectoryPage | OK – overflow-x-hidden |
| Welcome onboarding | WelcomeOnboardingPage | OK – overflow-x-hidden |

## Summary

- **Root wrappers**: Every page root uses `overflow-x-hidden w-full max-w-full` (or equivalent) to prevent horizontal scroll.
- **Auth/form pages**: Use `px-3 sm:px-4` for consistent side padding on small screens.
- **Admin tables**: Wrapped in `overflow-x-auto` with `-mx-3 sm:mx-0` or similar so tables scroll on narrow viewports without breaking layout.
- **Touch targets**: Buttons and icon controls use `min-h-[44px] min-w-[44px]` on mobile (sm:min-h-0 sm:min-w-0 on desktop) where applicable.
- **Chats**: Full-height layout with `max-h-dvh` and internal overflow so keyboard and viewport behave correctly on mobile.

If you add a new page, add a root div with `overflow-x-hidden w-full max-w-full` and use responsive padding (`px-3 sm:px-4` or `px-4 sm:px-6`) and touch-friendly controls on small screens.
