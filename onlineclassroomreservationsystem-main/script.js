
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const $ = (id) => document.getElementById(id);
const url = window.CLASSRESERVE_SUPABASE_URL;
const key = window.CLASSRESERVE_SUPABASE_PUBLISHABLE_KEY;

let supabase;
let currentUser = null;
let currentProfile = null;
let currentView = "dashboard";

const escapeHTML = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);

function message(text, error = false) {
  const el = $("app-message");
  if (!el) return;
  el.hidden = !text;
  el.textContent = text;
  el.className = error ? "alert alert-error" : "alert alert-success";
}

function loginError(text) {
  const el = $("login-error");
  if (el) {
    el.textContent = text;
    el.hidden = !text;
  }
}

function showLogin() {
  $("login-section")?.classList.remove("hidden");
  $("dashboard-section")?.classList.add("hidden");
}

function showDashboard() {
  $("login-section")?.classList.add("hidden");
  $("dashboard-section")?.classList.remove("hidden");
}

function role() {
  return String(currentProfile?.role || "Student").toLowerCase();
}

function isAdmin() {
  return role() === "admin";
}

function statusBadge(status) {
  const s = String(status || "Pending");
  return `<span class="status-badge status-${escapeHTML(s.toLowerCase())}">${escapeHTML(s)}</span>`;
}

async function loadProfile() {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", currentUser.id)
    .single();

  if (error) throw error;
  currentProfile = data;
}

async function getRooms() {
  const { data, error } = await supabase
    .from("classrooms")
    .select("*");

  if (error) throw error;
  return data || [];
}

async function getReservations() {
  let query = supabase
    .from("reservations")
    .select("*")
    .order("created_at", { ascending: false });

  if (!isAdmin()) {
    query = query.eq("user_id", currentUser.id);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

async function getHistory() {
  const { data, error } = await supabase
    .from("reservation_history")
    .select("*");

  if (error) throw error;
  return data || [];
}

function roomName(room) {
  return room.name || room.classroom_name || room.room_name || `Room ${room.id}`;
}

function roomOptions(rooms) {
  return rooms.map((room) =>
    `<option value="${escapeHTML(roomName(room))}">${escapeHTML(roomName(room))}</option>`
  ).join("");
}

function reservationTable(items, adminActions = false) {
  if (!items.length) {
    return `<div class="empty-state">No reservations found.</div>`;
  }

  return `
    <div class="table-responsive">
      <table>
        <thead>
          <tr>
            <th>Classroom</th>
            <th>Requested By</th>
            <th>Date</th>
            <th>Time</th>
            <th>Status</th>
            ${adminActions ? "<th>Actions</th>" : ""}
          </tr>
        </thead>
        <tbody>
          ${items.map((r) => `
            <tr>
              <td>${escapeHTML(r.classroom)}</td>
              <td>${escapeHTML(r.username || "User")}</td>
              <td>${escapeHTML(r.reservation_date)}</td>
              <td>${escapeHTML(r.reservation_time)}</td>
              <td>${statusBadge(r.status)}</td>
              ${adminActions ? `
                <td>
                  ${String(r.status).toLowerCase() === "pending" ? `
                    <button class="btn btn-success btn-small"
                      data-approve="${r.id}">Approve</button>
                    <button class="btn btn-danger btn-small"
                      data-reject="${r.id}">Reject</button>
                  ` : "—"}
                </td>` : ""}
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

async function renderDashboard() {
  const reservations = await getReservations();
  const rooms = await getRooms();

  const pending = reservations.filter((r) =>
    String(r.status).toLowerCase() === "pending"
  ).length;

  const approved = reservations.filter((r) =>
    String(r.status).toLowerCase() === "approved"
  ).length;

  const rejected = reservations.filter((r) =>
    String(r.status).toLowerCase() === "rejected"
  ).length;

  $("dashboard-content").innerHTML = `
    <h2>${isAdmin() ? "Admin" : escapeHTML(currentProfile?.role || "User")} Dashboard</h2>
    <p class="muted">Welcome to ClassReserve.</p>

    <div class="stats-grid">
      <div class="stat-card">
        <h3>Total Classrooms</h3>
        <div class="stat-number">${rooms.length}</div>
      </div>
      <div class="stat-card">
        <h3>${isAdmin() ? "Total Requests" : "My Requests"}</h3>
        <div class="stat-number">${reservations.length}</div>
      </div>
      <div class="stat-card">
        <h3>Pending Requests</h3>
        <div class="stat-number">${pending}</div>
      </div>
      <div class="stat-card">
        <h3>Approved Requests</h3>
        <div class="stat-number">${approved}</div>
      </div>
    </div>

    <div class="content-section">
      <h3>Reservation Overview</h3>
      <p>Approved: ${approved} | Pending: ${pending} | Rejected: ${rejected}</p>
      ${reservationTable(reservations.slice(0, 5))}
    </div>
  `;
}

async function renderRooms() {
  const rooms = await getRooms();

  $("dashboard-content").innerHTML = `
    <div class="section-header">
      <h2>Available Classrooms</h2>
    </div>

    <div class="classroom-grid">
      ${rooms.map((room) => `
        <div class="classroom-card">
          <h3>${escapeHTML(roomName(room))}</h3>
          <div class="room-details">
            <div>Capacity: ${escapeHTML(room.capacity || "Not specified")}</div>
            <div>Building ID: ${escapeHTML(room.building_id || "Not specified")}</div>
            <div>Status: ${escapeHTML(room.status || "Available")}</div>
          </div>
        </div>
      `).join("") || `<p>No classrooms found.</p>`}
    </div>
  `;
}

async function renderReservations() {
  const reservations = await getReservations();
  const rooms = await getRooms();

  $("dashboard-content").innerHTML = `
    <h2>Reservations / Requests</h2>

    ${!isAdmin() ? `
      <div class="content-section">
        <h3>Reserve a Classroom</h3>

        <form id="reservation-form">
          <div class="form-group">
            <label for="reservation-classroom">Classroom</label>
            <select id="reservation-classroom" required>
              <option value="">Select a classroom</option>
              ${roomOptions(rooms)}
            </select>
          </div>

          <div class="form-group">
            <label for="reservation-date">Reservation Date</label>
            <input id="reservation-date" type="date" required>
          </div>

          <div class="form-group">
            <label for="reservation-time">Reservation Time</label>
            <input id="reservation-time" type="time" required>
          </div>

          <button type="submit" class="btn btn-primary">
            Submit Reservation
          </button>
        </form>
      </div>
    ` : ""}

    <div class="content-section">
      <h3>${isAdmin() ? "Manage Requests" : "My Requests"}</h3>
      ${reservationTable(reservations, isAdmin())}
    </div>
  `;

  $("reservation-form")?.addEventListener("submit", submitReservation);

  document.querySelectorAll("[data-approve]").forEach((button) => {
    button.addEventListener("click", () =>
      updateReservation(button.dataset.approve, "Approved")
    );
  });

  document.querySelectorAll("[data-reject]").forEach((button) => {
    button.addEventListener("click", () =>
      updateReservation(button.dataset.reject, "Rejected")
    );
  });
}

async function submitReservation(event) {
  event.preventDefault();

  const classroom = $("reservation-classroom").value;
  const date = $("reservation-date").value;
  const time = $("reservation-time").value;

  if (!classroom || !date || !time) {
    message("Please complete all fields.", true);
    return;
  }

  const { error } = await supabase.from("reservations").insert({
    user_id: currentUser.id,
    username: currentProfile?.username ||
      currentProfile?.full_name ||
      currentUser.email,
    role: currentProfile?.role || "Student",
    classroom,
    reservation_date: date,
    reservation_time: time,
    status: "Pending"
  });

  if (error) {
    message(error.message, true);
    return;
  }

  await navigate("reservations");
  message("Reservation submitted successfully.");
}

async function updateReservation(id, status) {
  if (!isAdmin()) return;

  const { error } = await supabase
    .from("reservations")
    .update({ status })
    .eq("id", id);

  if (error) {
    message(error.message, true);
    return;
  }

  await navigate("reservations");
  message(`Reservation ${status.toLowerCase()} successfully.`);
}

async function renderHistory() {
  const reservations = await getReservations();

  let history = [];
  let historyError = null;

  const result = await supabase
    .from("reservation_history")
    .select("*");

  history = result.data || [];
  historyError = result.error;

  const visibleIds = new Set(reservations.map((r) => String(r.id)));

  if (!isAdmin()) {
    history = history.filter((h) =>
      visibleIds.has(String(h.reservation_id))
    );
  }

  $("dashboard-content").innerHTML = `
    <h2>Request History</h2>

    <div class="content-section">
      ${historyError ? `
        <p class="muted">History could not be loaded: ${escapeHTML(historyError.message)}</p>
      ` : history.length ? `
        <div class="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Reservation ID</th>
                <th>Previous Status</th>
                <th>New Status</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              ${history.map((h) => `
                <tr>
                  <td>${escapeHTML(h.reservation_id)}</td>
                  <td>${escapeHTML(h.old_status || "—")}</td>
                  <td>${escapeHTML(h.new_status || "—")}</td>
                  <td>${escapeHTML(h.changed_at || h.created_at || "—")}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      ` : `
        <div class="empty-state">No request history found.</div>
      `}
    </div>
  `;
}

async function navigate(view) {
  currentView = view;
  message("");

  document.querySelectorAll("[data-view]").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === view);
  });

  const content = $("dashboard-content");
  if (!content) return;

  content.innerHTML = `<div class="loading">Loading...</div>`;

  try {
    switch (view) {
      case "rooms":
        await renderRooms();
        break;
      case "reservations":
        await renderReservations();
        break;
      case "history":
        await renderHistory();
        break;
      default:
        await renderDashboard();
    }
  } catch (error) {
    content.innerHTML = "";
    message(error.message || "Unable to load data.", true);
  }
}

async function initializeSession() {
  const { data: { user }, error } = await supabase.auth.getUser();

  if (error || !user) {
    currentUser = null;
    currentProfile = null;
    showLogin();
    return;
  }

  currentUser = user;

  try {
    await loadProfile();
  } catch (error) {
    showLogin();
    loginError("Unable to load your profile: " + error.message);
    return;
  }

  showDashboard();

  if ($("dashboard-title")) {
    $("dashboard-title").textContent =
      `ClassReserve - ${currentProfile?.role || "User"} Dashboard`;
  }

  if ($("welcome-message")) {
    $("welcome-message").textContent =
      `Welcome, ${currentProfile?.full_name ||
        currentProfile?.username ||
        currentUser.email}`;
  }

  await navigate("dashboard");
}

async function handleLogin(event) {
  event.preventDefault();
  loginError("");

  const email = $("email")?.value.trim();
  const password = $("password")?.value;

  if (!email || !password) {
    loginError("Please enter your email and password.");
    return;
  }

  const button = $("login-button");
  if (button) button.disabled = true;

  try {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (error) throw error;
    await initializeSession();
  } catch (error) {
    loginError(error.message);
  } finally {
    if (button) button.disabled = false;
  }
}

async function handleLogout() {
  const { error } = await supabase.auth.signOut();

  if (error) {
    message(error.message, true);
    return;
  }

  currentUser = null;
  currentProfile = null;
  showLogin();
}

async function handleResetRequest(event) {
  event.preventDefault();

  const email = $("reset-email")?.value.trim();
  if (!email) return;

  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + window.location.pathname
  });

  if (error) {
    loginError(error.message);
  } else {
    loginError("If this email is registered, a reset link will be sent.");
  }
}

async function handleNewPassword(event) {
  event.preventDefault();

  const password = $("new-password")?.value;
  if (!password) return;

  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    loginError(error.message);
  } else {
    loginError("Password updated. You can now sign in.");
  }
}

function setupEvents() {
  $("login-form")?.addEventListener("submit", handleLogin);
  $("logout-button")?.addEventListener("click", handleLogout);

  $("forgot-password-button")?.addEventListener("click", () => {
    $("reset-password-form")?.classList.toggle("hidden");
  });

  $("reset-password-form")?.addEventListener(
    "submit",
    handleResetRequest
  );

  $("new-password-form")?.addEventListener(
    "submit",
    handleNewPassword
  );

  document.querySelectorAll("[data-view]").forEach((button) => {
    button.addEventListener("click", () => {
      navigate(button.dataset.view);
    });
  });
}

async function start() {
  setupEvents();

  if (!url || !key || !key.startsWith("sb_publishable_")) {
    loginError(
      "Supabase setup is incomplete. Check the Project URL and publishable key in supabase-config.js."
    );
    return;
  }

  supabase = createClient(url, key);

  supabase.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_OUT") {
      currentUser = null;
      currentProfile = null;
      showLogin();
    }
  });

  await initializeSession();
}

start();
