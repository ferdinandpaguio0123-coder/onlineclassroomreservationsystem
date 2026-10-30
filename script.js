import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const URL = window.CLASSRESERVE_SUPABASE_URL;
const KEY = window.CLASSRESERVE_SUPABASE_PUBLISHABLE_KEY;
const $ = (id) => document.getElementById(id);
const loginSection = $("login-section"), dashboardSection = $("dashboard-section");
const loginForm = $("login-form"), loginError = $("login-error"), loginButton = $("login-button");
const resetForm = $("reset-password-form"), newPasswordForm = $("new-password-form");
const dashboardContent = $("dashboard-content"), appMessage = $("app-message");
let supabase, currentUser = null, currentProfile = null;

if (!URL || !KEY || URL.includes("PASTE_") || KEY.includes("PASTE_") || !URL.startsWith("https://") || !KEY.startsWith("sb_publishable_")) {
  loginError.textContent = "Supabase setup is incomplete. Check the Project URL and sb_publishable_ key in supabase-config.js.";
  loginError.hidden = false; loginButton.disabled = true;
} else {
  supabase = createClient(URL, KEY);
  initialize();
}

async function initialize() {
  loginForm.addEventListener("submit", signIn);
  $("forgot-password-button").addEventListener("click", () => { resetForm.hidden = !resetForm.hidden; $("reset-email").value = $("email").value.trim(); });
  resetForm.addEventListener("submit", sendResetEmail);
  newPasswordForm.addEventListener("submit", saveNewPassword);
  $("logout-button").addEventListener("click", signOut);
  document.querySelectorAll("[data-view]").forEach(btn => btn.addEventListener("click", () => renderView(btn.dataset.view)));
  supabase.auth.onAuthStateChange(async (event) => { if (event === "PASSWORD_RECOVERY") { loginSection.hidden = false; dashboardSection.hidden = true; newPasswordForm.hidden = false; loginForm.hidden = true; resetForm.hidden = true; } });
  const { data: { session } } = await supabase.auth.getSession();
  if (session) await loadProfile(session.user);
}

async function signIn(event) {
  event.preventDefault(); clearLoginError(); loginButton.disabled = true; loginButton.textContent = "Signing in…";
  const { data, error } = await supabase.auth.signInWithPassword({ email: $("email").value.trim(), password: $("password").value });
  if (error) showLoginError("Login failed. Please check your email and password.");
  else await loadProfile(data.user);
  loginButton.disabled = false; loginButton.textContent = "Log In";
}
async function loadProfile(user) {
  const { data, error } = await supabase.from("profiles").select("id, username, role").eq("id", user.id).single();
  if (error || !data) { await supabase.auth.signOut(); showLoginError("Your login is valid, but your ClassReserve profile is missing. Please ask the administrator to check the profiles table."); return; }
  currentUser = user; currentProfile = data; loginSection.hidden = true; dashboardSection.hidden = false;
  $("dashboard-title").textContent = `${data.role} Dashboard`;
  $("welcome-message").textContent = `Welcome, ${data.username}. You are signed in as ${data.role}.`;
  renderView("dashboard");
}
async function signOut() { await supabase.auth.signOut(); currentUser = currentProfile = null; dashboardSection.hidden = true; loginSection.hidden = false; loginForm.hidden = false; newPasswordForm.hidden = true; loginForm.reset(); }
async function sendResetEmail(event) {
  event.preventDefault(); const email = $("reset-email").value.trim();
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + window.location.pathname });
  setMessage(error ? error.message : "If this email belongs to an account, Supabase will send a password-reset link. Check your inbox and spam folder.", !!error);
}
async function saveNewPassword(event) {
  event.preventDefault(); const password = $("new-password").value;
  const { error } = await supabase.auth.updateUser({ password });
  if (error) setMessage(error.message, true);
  else { setMessage("Your password has been updated. You can now sign in with it."); newPasswordForm.hidden = true; loginForm.hidden = false; }
}
function showLoginError(msg) { loginError.textContent = msg; loginError.hidden = false; }
function clearLoginError() { loginError.textContent = ""; loginError.hidden = true; }
function setMessage(msg, error = false) { appMessage.textContent = msg; appMessage.className = `message ${error ? "error" : "success"}`; }
function escapeHTML(value) { return String(value ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c])); }
function isAdmin() { return String(currentProfile?.role || "").toLowerCase() === "admin"; }

async function renderView(view) {
  if (!currentUser) return; appMessage.textContent = "";
  document.querySelectorAll("[data-view]").forEach(b => b.classList.toggle("active", b.dataset.view === view));
  if (view === "dashboard") {
    const { count: mine } = await supabase.from("reservations").select("id", { count: "exact", head: true }).eq("user_id", currentUser.id);
    let pending = 0;
    if (isAdmin()) { const r = await supabase.from("reservations").select("id", { count: "exact", head: true }).eq("status", "Pending"); pending = r.count || 0; }
    dashboardContent.innerHTML = `<h3>Welcome to ClassReserve</h3><div class="stat-grid"><article class="stat-card"><span>My requests</span><strong>${mine ?? 0}</strong></article>${isAdmin() ? `<article class="stat-card pending-stat"><span>Pending approval</span><strong>${pending}</strong></article>` : ""}</div><p>Choose a colored menu tab above to browse classrooms, submit a request, or check its progress.</p>`;
  } else if (view === "rooms") renderRooms();
  else if (view === "reservations") await loadReservations(false);
  else if (view === "history") await loadReservations(true);
}
function renderRooms() {
  const rooms = [{name:"Classroom 101",capacity:30,building:"Main Building"},{name:"Classroom 102",capacity:40,building:"Main Building"},{name:"Computer Laboratory",capacity:35,building:"Technology Building"}];
  dashboardContent.innerHTML = `<h3>Available Classrooms</h3><p>Select a room to send a reservation request.</p><div class="room-grid">${rooms.map(r=>`<article class="room-card"><h4>${r.name}</h4><p>Capacity: ${r.capacity} people</p><p>${r.building}</p>${isAdmin()?"":"<button class='primary-button' data-book='"+r.name+"'>Request this room</button>"}</article>`).join("")}</div>`;
  dashboardContent.querySelectorAll("[data-book]").forEach(b=>b.addEventListener("click",()=>reservationForm(b.dataset.book)));
}
function reservationForm(room) {
  dashboardContent.innerHTML = `<h3>Request ${escapeHTML(room)}</h3><form id="booking-form" class="booking-form"><label for="booking-date">Reservation date</label><input id="booking-date" type="date" min="${new Date().toLocaleDateString("en-CA")}" required><label for="booking-time">Reservation time</label><input id="booking-time" type="text" placeholder="9:00 AM - 11:00 AM" required><button class="primary-button" type="submit">Submit request</button><button class="secondary-button" id="cancel-booking" type="button">Cancel</button></form>`;
  $("cancel-booking").addEventListener("click",()=>renderView("rooms"));
  $("booking-form").addEventListener("submit",async e=>{e.preventDefault(); const {error}=await supabase.from("reservations").insert({user_id:currentUser.id,username:currentProfile.username,role:currentProfile.role,classroom:room,reservation_date:$("booking-date").value,reservation_time:$("booking-time").value.trim(),status:"Pending"}); if(error)setMessage(`Request could not be submitted: ${error.message}`,true); else {setMessage("Your room request was submitted. Its status is Pending."); await loadReservations(false);}});
}
async function loadReservations(historyOnly) {
  dashboardContent.innerHTML = "<p>Loading…</p>";
  if (historyOnly) return loadHistory();
  let query = supabase.from("reservations").select("id, user_id, username, role, classroom, reservation_date, reservation_time, status, created_at").order("created_at",{ascending:false});
  if (!isAdmin()) query = query.eq("user_id",currentUser.id);
  const {data,error}=await query;
  if(error){dashboardContent.innerHTML="<p>Unable to load requests. Check the Supabase SQL setup and Row Level Security policies.</p>";setMessage(error.message,true);return;}
  dashboardContent.innerHTML = `<h3>${isAdmin()?"Incoming reservation requests":"My reservation requests"}</h3>${!data?.length?"<p>No reservation requests yet.</p>":`<div class="table-wrap"><table><thead><tr>${isAdmin()?"<th>Requester</th><th>Role</th>":""}<th>Classroom</th><th>Date</th><th>Time</th><th>Status</th>${isAdmin()?"<th>Decision</th>":""}</tr></thead><tbody>${data.map(r=>`<tr>${isAdmin()?`<td>${escapeHTML(r.username)}</td><td>${escapeHTML(r.role)}</td>`:""}<td>${escapeHTML(r.classroom)}</td><td>${escapeHTML(r.reservation_date)}</td><td>${escapeHTML(r.reservation_time)}</td><td><span class="status status-${r.status.toLowerCase()}">${escapeHTML(r.status)}</span></td>${isAdmin()?`<td>${r.status==="Pending"?`<button class="approve-button" data-approve="${r.id}">Approve</button> <button class="reject-button" data-reject="${r.id}">Reject</button>`:`<span class="muted">Decision recorded</span>`}</td>`:""}</tr>`).join("")}</tbody></table></div>`}`;
  dashboardContent.querySelectorAll("[data-approve]").forEach(b=>b.addEventListener("click",()=>updateStatus(b.dataset.approve,"Approved")));
  dashboardContent.querySelectorAll("[data-reject]").forEach(b=>b.addEventListener("click",()=>updateStatus(b.dataset.reject,"Rejected")));
}
async function updateStatus(id,status) {
  const {error}=await supabase.from("reservations").update({status}).eq("id",id);
  if(error){setMessage(`Could not update request: ${error.message}`,true);return;}
  setMessage(`Request ${status.toLowerCase()}. The database history trigger records this decision.`); await loadReservations(false);
}
async function loadHistory() {
  let q=supabase.from("reservation_history").select("id,reservation_id,changed_by,old_status,new_status,changed_at,username,classroom").order("changed_at",{ascending:false});
  if(!isAdmin()) q=q.eq("user_id",currentUser.id);
  const {data,error}=await q;
  if(error){dashboardContent.innerHTML="<h3>Request History</h3><p>History is not set up yet. An administrator must run the SQL setup file in Supabase.</p>";setMessage(error.message,true);return;}
  dashboardContent.innerHTML=`<h3>Request History</h3>${!data?.length?"<p>No decisions have been recorded yet.</p>":`<div class="table-wrap"><table><thead><tr><th>Requester</th><th>Classroom</th><th>Previous status</th><th>New status</th><th>Changed at</th></tr></thead><tbody>${data.map(h=>`<tr><td>${escapeHTML(h.username)}</td><td>${escapeHTML(h.classroom)}</td><td>${escapeHTML(h.old_status||"New request")}</td><td><span class="status status-${String(h.new_status).toLowerCase()}">${escapeHTML(h.new_status)}</span></td><td>${new Date(h.changed_at).toLocaleString()}</td></tr>`).join("")}</tbody></table></div>`}`;
}
