# ClassReserve — Online Classroom Reservation System

A responsive front-end prototype built with HTML, CSS, and JavaScript.

## Files
- `index.html` — page structure and forms
- `style.css` — responsive interface styles
- `script.js` — prototype sign-in, classroom management, reservation requests, approval/rejection, reports, and CSV export

## Run locally
Open `index.html` in a browser, or use the VS Code Live Server extension.

## Demo roles
On the sign-in screen, choose Student, Faculty, or Administrator and enter any name and email. This is a prototype sign-in only; it does not authenticate passwords.

## Important limitations
- Data is stored in the current browser using `localStorage`; it is not shared across browsers/devices and may be cleared by the user.
- Role selection is not secure authentication. Anyone can choose Administrator in this demo.
- Before real use, integrate Supabase Auth and a Supabase database, add Row Level Security policies, and enforce authorization server-side.
- The prototype prevents overlapping requests for a room and checks room capacity, but production booking rules should be enforced by the database as well.

## Deploy to Vercel
Import the GitHub repository into Vercel. For this static site, leave Framework Preset as `Other`, leave Build Command empty, and set the Output Directory to `.` if asked. Deploy.

