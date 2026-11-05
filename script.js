
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const $ = (id) => document.getElementById(id);

const loginSection = $("login-section");
const dashboardSection = $("dashboard-section");
const loginForm = $("login-form");
const loginButton = $("login-button");
const loginError = $("login-error");
const dashboardContent = $("dashboard-content");
const appMessage = $("app-message");

let supabase = null;
let currentUser = null;
let currentProfile = null;
let currentView = "dashboard";

const URL = window.CLASSRESERVE_SUPABASE_URL;
const KEY = window.CLASSRESERVE_SUPABASE_PUBLISHABLE_KEY;

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function showLoginError(message) {
  loginError.textContent = message;
  loginError.hidden = !message;
}

function showMessage(message, error = false) {
  appMessage.textContent = message;
  appMessage.className = error
    ? "message error"
    : "message success";
}

function clearMessage() {
  showMessage("");
}

function isAdmin() {
  return currentProfile?.role?.toLowerCase() === "admin";
}

function roleName() {
  return currentProfile?.role?.toLowerCase() || "student";
}

function formatDate(value) {
  if (!value) return "—";
  const parts = String(value).split("-");
  if (parts.length !== 3) return value;
  return `${parts[1]}/${parts[2]}/${parts[0]}`;
}

function statusBadge(status) {
  const value = String(status || "Pending");
  const normalized = value.toLowerCase();
  const className = ["pending", "approved", "rejected"]
    .includes(normalized) ? normalized : "pending";

  return `<span class="status status-${className}">
    ${escapeHTML(value)}
  </span>`;
}

function renderTable(headers, rows) {
  if (!rows.length) {
    return `<p class="muted">No records found.</p>`;
  }

  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>${headers.map((h) =>
            `<th>${escapeHTML(h)}</th>`).join("")}</tr>
        </thead>
        <tbody>${rows.join("")}</tbody>
      </table>
    </div>
  `;
}

function initializeSupabase() {
  if (
    typeof URL !== "string" ||
    !URL.startsWith("https://") ||
    typeof KEY !== "string" ||
    !KEY.startsWith("sb_publishable_")
  ) {
    showLoginError(
      "Supabase setup is incomplete. Check the Project URL and sb_publishable_ key in supabase-config.js."
    );
    loginButton.disabled = true;
    return false;
  }

  try {
    supabase = createClient(URL, KEY);
    loginButton.disabled = false;
    return true;
  } catch (error) {
    showLoginError("Unable to initialize Supabase: " + error.message);
    loginButton.disabled = true;
    return false;
  }
}

async function loadProfile(user) {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, role")
    .eq("id", user.id)
    .single();

  if (error || !data) {
    throw new Error(
      "Your user profile could not be loaded. Contact the administrator."
    );
  }

  const role = String(data.role || "").toLowerCase();

  if (!["admin", "faculty", "student"].includes(role)) {
    throw new Error("Your account has an invalid role.");
  }

  return data;
}

async function openDashboard(user) {
  currentUser = user;
  currentProfile = await loadProfile(user);

  loginSection.hidden = true;
  dashboardSection.hidden = false;
  showLoginError("");

  $("dashboard-title").textContent =
    `${currentProfile.role} Dashboard`;

  $("welcome-message").textContent =
    `Welcome, ${currentProfile.username}!`;

  await switchView("dashboard");
}

async function handleLogin(event) {
  event.preventDefault();
  if (!supabase) return;

  loginButton.disabled = true;
  loginButton.textContent = "Signing in...";
  showLoginError("");

  try {
    const email = $("email").value.trim();
    const password = $("password").value;

    const { data, error } =
      await supabase.auth.signInWithPassword({
        email,
        password
      });

    if (error) throw error;
    await openDashboard(data.user);
  } catch (error) {
    showLoginError(error.message);
    await supabase.auth.signOut();
  } finally {
    loginButton.disabled = false;
    loginButton.textContent = "Log In";
  }
}

async function handleLogout() {
  if (supabase) {
    const { error } = await supabase.auth.signOut();
    if (error) {
      showMessage(error.message, true);
      return;
    }
  }

  currentUser = null;
  currentProfile = null;
  dashboardSection.hidden = true;
  loginSection.hidden = false;
  loginForm.reset();
  clearMessage();
}

async function getReservations() {
  const { data, error } = await supabase
    .from("reservations")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data || [];
}

async function getClassrooms() {
  const { data, error } = await supabase
    .from("classrooms")
    .select("*");

  if (error) throw error;
  return data || [];
}

async function getBuildings() {
  const { data, error } = await supabase
    .from("buildings")
    .select("*");

  if (error) throw error;
  return data || [];
}

async function renderDashboard() {
  const reservations = await getReservations();

  const total = reservations.length;
  const pending = reservations.filter(
    (r) => r.status?.toLowerCase() === "pending"
  ).length;
  const approved = reservations.filter(
    (r) => r.status?.toLowerCase() === "approved"
  ).length;
  const rejected = reservations.filter(
    (r) => r.status?.toLowerCase() === "rejected"
  ).length;

  dashboardContent.innerHTML = `
    <h3>Reservation Overview</h3>
    <p>${isAdmin()
      ? "Manage classroom reservation requests."
      : "Track your classroom reservation requests."}</p>

    <div class="stat-grid">
      <div class="stat-card">
        <span>Total Reservations</span>
        <strong>${total}</strong>
      </div>
      <div class="stat-card pending-stat">
        <span>Pending Requests</span>
        <strong>${pending}</strong>
      </div>
      <div class="stat-card">
        <span>Approved</span>
        <strong>${approved}</strong>
      </div>
      <div class="stat-card">
        <span>Rejected</span>
        <strong>${rejected}</strong>
      </div>
    </div>

    <h3>Recent Reservations</h3>
    ${reservationTable(reservations.slice(0, 5), false)}
  `;
}

function reservationTable(reservations, actions = false) {
  const headers = [
    "Classroom", "Date", "Time", "Status"
  ];

  if (isAdmin()) headers.unshift("Requested By");
  if (actions && isAdmin()) headers.push("Actions");

  const rows = reservations.map((r) => {
    let cells = "";

    if (isAdmin()) {
      cells += `<td>${escapeHTML(r.username)}</td>`;
    }

    cells += `
      <td>${escapeHTML(r.classroom)}</td>
      <td>${escapeHTML(formatDate(r.reservation_date))}</td>
      <td>${escapeHTML(r.reservation_time)}</td>
      <td>${statusBadge(r.status)}</td>
    `;

    if (actions && isAdmin()) {
      cells += `<td>`;

      if (r.status?.toLowerCase() === "pending") {
        cells += `
          <button class="approve-button"
            data-action="approve" data-id="${r.id}">
            Approve
          </button>
          <button class="reject-button"
            data-action="reject" data-id="${r.id}">
            Reject
          </button>
        `;
      } else {
        cells += "—";
      }

      cells += `</td>`;
    }

    return `<tr>${cells}</tr>`;
  });

  return renderTable(headers, rows);
}

async function renderRooms() {
  const [rooms, buildings] = await Promise.all([
    getClassrooms(),
    getBuildings()
  ]);

  const buildingNames = new Map(
    buildings.map((b) => [String(b.id), b.name])
  );

  dashboardContent.innerHTML = `
    <h3>Available Classrooms</h3>
    <p>Browse the classrooms registered in ClassReserve.</p>

    <div class="room-grid">
      ${rooms.map((room) => `
        <div class="room-card">
          <h4>${escapeHTML(
            room.name || room.classroom_name || "Classroom"
          )}</h4>
          <p>Building: ${escapeHTML(
            buildingNames.get(String(room.building_id)) ||
            room.building || "Not specified"
          )}</p>
          <p>Capacity: ${escapeHTML(
            room.capacity ?? "Not specified"
          )}</p>
          <p>Status: ${escapeHTML(
            room.status || "Active"
          )}</p>
        </div>
      `).join("") || "<p>No classrooms found.</p>"}
    </div>
  `;
}

async function renderReservations() {
  const reservations = await getReservations();

  if (isAdmin()) {
    dashboardContent.innerHTML = `
      <h3>Manage Reservation Requests</h3>
      <p>Review pending classroom reservations.</p>
      ${reservationTable(reservations, true)}
    `;
    return;
  }

  const rooms = await getClassrooms();

  dashboardContent.innerHTML = `
    <h3>Request a Classroom</h3>
    <p>Submit a classroom reservation for approval.</p>

    <form id="booking-form" class="booking-form">
      <label for="booking-classroom">Classroom</label>
      <select id="booking-classroom" required>
        <option value="">Select classroom</option>
        ${rooms.map((room) => {
          const name = room.name || room.classroom_name;
          return `<option value="${escapeHTML(name)}">
            ${escapeHTML(name)}
          </option>`;
        }).join("")}
      </select>

      <label for="booking-date">Reservation Date</label>
      <input type="date" id="booking-date" required>

      <label for="booking-time">Reservation Time</label>
      <input type="time" id="booking-time" required>

      <button type="submit" class="primary-button">
        Submit Request
      </button>
    </form>

    <h3>My Reservations</h3>
    ${reservationTable(reservations)}
  `;

  $("booking-date").min =
    new Date(Date.now() - new Date().getTimezoneOffset() * 60000)
      .toISOString().split("T")[0];

  $("booking-form").addEventListener("submit", submitReservation);
}

async function submitReservation(event) {
  event.preventDefault();

  if (isAdmin() || !currentUser) return;

  const button = event.currentTarget.querySelector(
    'button[type="submit"]'
  );
  button.disabled = true;

  try {
    const classroom = $("booking-classroom").value;
    const reservationDate = $("booking-date").value;
    const reservationTime = $("booking-time").value;

    if (!classroom || !reservationDate || !reservationTime) {
      throw new Error("Complete all reservation fields.");
    }

    const { error } = await supabase
      .from("reservations")
      .insert({
        user_id: currentUser.id,
        username: currentProfile.username,
        role: roleName(),
        classroom,
        reservation_date: reservationDate,
        reservation_time: reservationTime,
        status: "Pending"
      });

    if (error) throw error;

    await renderReservations();
    showMessage("Reservation request submitted successfully!");
  } catch (error) {
    showMessage(error.message, true);
    button.disabled = false;
  }
}

async function updateReservation(id, status) {
  if (!isAdmin()) return;

  const confirmed = confirm(
    `Are you sure you want to ${status.toLowerCase()} this request?`
  );

  if (!confirmed) return;

  try {
    const { data, error } = await supabase
      .from("reservations")
      .update({ status })
      .eq("id", id)
      .eq("status", "Pending")
      .select("id");

    if (error) throw error;

    if (!data?.length) {
      throw new Error(
        "This request may have already been processed."
      );
    }

    await renderReservations();
    showMessage(`Reservation ${status.toLowerCase()} successfully.`);
  } catch (error) {
    showMessage(error.message, true);
  }
}

async function renderHistory() {
  const { data, error } = await supabase
    .from("reservation_history")
    .select("*")
    .order("changed_at", { ascending: false });

  if (error) throw error;

  const records = data || [];
  const headers = [
    "Classroom", "Previous Status", "New Status", "Changed At"
  ];

  if (isAdmin()) headers.unshift("User");

  const rows = records.map((record) => `
    <tr>
      ${isAdmin()
        ? `<td>${escapeHTML(record.username)}</td>`
        : ""}
      <td>${escapeHTML(record.classroom)}</td>
      <td>${escapeHTML(record.old_status || "New Request")}</td>
      <td>${statusBadge(record.new_status)}</td>
      <td>${escapeHTML(
        new Date(record.changed_at).toLocaleString()
      )}</td>
    </tr>
  `);

  dashboardContent.innerHTML = `
    <h3>Reservation History</h3>
    <p>View reservation status changes.</p>
    ${renderTable(headers, rows)}
  `;
}

async function switchView(view) {
  if (!currentUser) return;

  currentView = view;
  clearMessage();

  document.querySelectorAll(".navigation button")
    .forEach((button) => {
      button.classList.toggle(
        "active",
        button.dataset.view === view
      );
    });

  dashboardContent.innerHTML = "<p>Loading...</p>";

  try {
    if (view === "dashboard") await renderDashboard();
    else if (view === "rooms") await renderRooms();
    else if (view === "reservations") await renderReservations();
    else if (view === "history") await renderHistory();
    else await renderDashboard();
  } catch (error) {
    dashboardContent.innerHTML = "";
    showMessage(error.message, true);
  }
}

async function sendPasswordReset(event) {
  event.preventDefault();

  if (!supabase) return;

  const email = $("reset-email").value.trim();

  const { error } = await supabase.auth.resetPasswordForEmail(
    email,
    {
      redirectTo: window.location.origin +
        window.location.pathname
    }
  );

  showLoginError(
    error
      ? error.message
      : "If the email is registered, a reset link will be sent."
  );
}

async function saveNewPassword(event) {
  event.preventDefault();

  if (!supabase) return;

  const password = $("new-password").value;

  const { error } = await supabase.auth.updateUser({
    password
  });

  if (error) {
    showLoginError(error.message);
    return;
  }

  $("new-password-form").hidden = true;
  $("login-form").hidden = false;

  showLoginError("");
  alert("Password updated successfully.");
}

function registerEvents() {
  loginForm.addEventListener("submit", handleLogin);

  $("logout-button").addEventListener("click", handleLogout);

  $("forgot-password-button").addEventListener("click", () => {
    const form = $("reset-password-form");
    form.hidden = !form.hidden;
  });

  $("reset-password-form").addEventListener(
    "submit", sendPasswordReset
  );

  $("new-password-form").addEventListener(
    "submit", saveNewPassword
  );

  document.querySelectorAll(".navigation button")
    .forEach((button) => {
      button.addEventListener("click", () => {
        switchView(button.dataset.view);
      });
    });

  dashboardContent.addEventListener("click", (event) => {
    const button = event.target.closest("[data-action]");
    if (!button) return;

    const id = Number(button.dataset.id);

    if (!Number.isSafeInteger(id) || id <= 0) return;

    if (button.dataset.action === "approve") {
      updateReservation(id, "Approved");
    } else if (button.dataset.action === "reject") {
      updateReservation(id, "Rejected");
    }
  });
}

async function startApp() {
  registerEvents();

  if (!initializeSupabase()) return;

  supabase.auth.onAuthStateChange((event) => {
    if (event === "PASSWORD_RECOVERY") {
      loginForm.hidden = true;
      $("new-password-form").hidden = false;
      $("reset-password-form").hidden = true;
    }
  });

  try {
    const { data, error } = await supabase.auth.getUser();

    if (error && error.name !== "AuthSessionMissingError") {
      console.warn("Session check:", error.message);
    }

    if (data?.user) {
      await openDashboard(data.user);
    }
  } catch (error) {
    console.error("ClassReserve startup error:", error);
    dashboardSection.hidden = true;
    loginSection.hidden = false;
    showLoginError(error.message);
  }
}

startApp();
