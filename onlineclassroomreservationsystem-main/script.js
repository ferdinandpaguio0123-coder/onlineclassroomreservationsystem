
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/* =========================================
   CLASSRESERVE - COMPLETE JAVASCRIPT
   ========================================= */

const $ = (id) => document.getElementById(id);

const SUPABASE_URL = window.CLASSRESERVE_SUPABASE_URL;
const SUPABASE_KEY = window.CLASSRESERVE_SUPABASE_PUBLISHABLE_KEY;

let supabase = null;
let currentUser = null;
let currentProfile = null;
let currentView = "dashboard";

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);
}

function showMessage(text, error = false) {
  const element = $("app-message");
  if (!element) return;

  element.hidden = !text;
  element.textContent = text;
  element.className = error
    ? "alert alert-error"
    : "alert alert-success";
}

function showLoginError(text) {
  const element = $("login-error");
  if (!element) return;

  element.hidden = !text;
  element.textContent = text;
}

function showLogin() {
  $("login-section")?.classList.remove("hidden");
  $("dashboard-section")?.classList.add("hidden");
}

function showDashboard() {
  $("login-section")?.classList.add("hidden");
  $("dashboard-section")?.classList.remove("hidden");
}

function getRole() {
  return String(currentProfile?.role || "Student").toLowerCase();
}

function isAdmin() {
  return getRole() === "admin";
}

function roomName(room) {
  return room.name ||
    room.classroom_name ||
    room.room_name ||
    `Room ${room.id}`;
}

function buildingName(building) {
  return building?.name ||
    building?.building_name ||
    `Building ${building?.id || ""}`;
}

function statusBadge(status) {
  const text = String(status || "Pending");
  const statusClass = text.toLowerCase();

  return `
    <span class="status-badge status-${escapeHTML(statusClass)}">
      ${escapeHTML(text)}
    </span>
  `;
}

/* =========================================
   DATABASE
   ========================================= */

async function loadProfile() {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", currentUser.id)
    .single();

  if (error) throw error;

  currentProfile = data;
}

async function getBuildings() {
  const { data, error } = await supabase
    .from("buildings")
    .select("*")
    .order("id");

  if (error) throw error;

  return data || [];
}

async function getRooms() {
  const { data, error } = await supabase
    .from("classrooms")
    .select("*")
    .order("id");

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

/* =========================================
   DASHBOARD
   ========================================= */

async function renderDashboard() {
  const rooms = await getRooms();
  const reservations = await getReservations();

  const pending = reservations.filter(
    (r) => String(r.status).toLowerCase() === "pending"
  ).length;

  const approved = reservations.filter(
    (r) => String(r.status).toLowerCase() === "approved"
  ).length;

  const rejected = reservations.filter(
    (r) => String(r.status).toLowerCase() === "rejected"
  ).length;

  $("dashboard-content").innerHTML = `
    <h2>${escapeHTML(currentProfile?.role || "User")} Dashboard</h2>
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
      <p>
        Approved: ${approved} |
        Pending: ${pending} |
        Rejected: ${rejected}
      </p>

      ${reservationTable(reservations.slice(0, 5))}
    </div>
  `;
}

/* =========================================
   ADMIN - BUILDINGS AND CLASSROOMS
   ========================================= */

async function renderRooms() {
  const [rooms, buildings] = await Promise.all([
    getRooms(),
    getBuildings()
  ]);

  const findBuildingName = (id) => {
    const building = buildings.find(
      (b) => String(b.id) === String(id)
    );

    return building ? buildingName(building) : "Unknown Building";
  };

  $("dashboard-content").innerHTML = `
    <div class="section-header">
      <h2>${isAdmin() ? "Classroom Management" : "Available Classrooms"}</h2>
    </div>

    ${isAdmin() ? `
      <div class="content-grid">

        <div class="content-section">
          <h3>Add New Building</h3>

          <form id="add-building-form">

            <div class="form-group">
              <label for="building-name">Building Name</label>
              <input
                type="text"
                id="building-name"
                placeholder="Example: SAB Building"
                maxlength="100"
                required
              >
            </div>

            <button type="submit" class="btn btn-primary">
              Add Building
            </button>

          </form>
        </div>

        <div class="content-section">
          <h3>Add New Classroom</h3>

          <form id="add-room-form">

            <div class="form-group">
              <label for="room-name">Classroom Name</label>
              <input
                type="text"
                id="room-name"
                placeholder="Example: Classroom 301"
                maxlength="100"
                required
              >
            </div>

            <div class="form-group">
              <label for="room-building">Building</label>

              <select id="room-building" required>
                <option value="">Select Building</option>

                ${buildings.map((building) => `
                  <option value="${escapeHTML(building.id)}">
                    ${escapeHTML(buildingName(building))}
                  </option>
                `).join("")}

              </select>
            </div>

            <div class="form-group">
              <label for="room-capacity">Capacity</label>

              <input
                type="number"
                id="room-capacity"
                min="1"
                max="10000"
                placeholder="Example: 40"
                required
              >
            </div>

            <button type="submit" class="btn btn-primary">
              Add Classroom
            </button>

          </form>
        </div>

      </div>

      <div class="content-section">
        <h3>Buildings</h3>

        <div class="table-responsive">
          <table>
            <thead>
              <tr>
                <th>Building ID</th>
                <th>Building Name</th>
              </tr>
            </thead>

            <tbody>
              ${buildings.map((building) => `
                <tr>
                  <td>${escapeHTML(building.id)}</td>
                  <td>${escapeHTML(buildingName(building))}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </div>
    ` : ""}

    <div class="content-section">

      <h3>Available Classrooms</h3>

      <div class="classroom-grid">

        ${rooms.map((room) => `
          <div class="classroom-card">

            <h3>${escapeHTML(roomName(room))}</h3>

            <div class="room-details">
              <div>
                Building: ${escapeHTML(findBuildingName(room.building_id))}
              </div>

              <div>
                Capacity: ${escapeHTML(room.capacity)}
              </div>

              <div>
                Status: ${escapeHTML(room.status || "Available")}
              </div>
            </div>

            ${isAdmin() ? `
              <div style="display:flex;gap:8px;margin-top:16px;">

                <button
                  type="button"
                  class="btn btn-primary btn-small"
                  data-edit-room="${escapeHTML(room.id)}"
                >
                  Edit
                </button>

                <button
                  type="button"
                  class="btn btn-danger btn-small"
                  data-delete-room="${escapeHTML(room.id)}"
                >
                  Delete
                </button>

              </div>
            ` : ""}

          </div>
        `).join("") || "<p>No classrooms found.</p>"}

      </div>
    </div>
  `;

  if (!isAdmin()) return;

  /* ADD BUILDING */

  $("add-building-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const name = $("building-name").value.trim();

    if (!name) return;

    const button = event.submitter;
    if (button) button.disabled = true;

    const { error } = await supabase
      .from("buildings")
      .insert({
        name,
        status: "Active"
      });

    if (button) button.disabled = false;

    if (error) {
      showMessage(error.message, true);
      return;
    }

    await navigate("rooms");
    showMessage("Building added successfully.");
  });

  /* ADD CLASSROOM */

  $("add-room-form")?.addEventListener("submit", async (event) => {
    event.preventDefault();

    const name = $("room-name").value.trim();
    const building_id = Number($("room-building").value);
    const capacity = Number($("room-capacity").value);

    if (
      !name ||
      !Number.isInteger(building_id) ||
      !buildings.some((b) => Number(b.id) === building_id) ||
      !Number.isInteger(capacity) ||
      capacity < 1 ||
      capacity > 10000
    ) {
      showMessage("Please enter valid classroom details.", true);
      return;
    }

    const button = event.submitter;
    if (button) button.disabled = true;

    const { error } = await supabase
      .from("classrooms")
      .insert({
        name,
        building_id,
        capacity,
        status: "Available"
      });

    if (button) button.disabled = false;

    if (error) {
      showMessage(error.message, true);
      return;
    }

    await navigate("rooms");
    showMessage("Classroom added successfully.");
  });

  /* EDIT CLASSROOM */

  document.querySelectorAll("[data-edit-room]").forEach((button) => {
    button.addEventListener("click", async () => {
      const room = rooms.find(
        (r) => String(r.id) === button.dataset.editRoom
      );

      if (!room) return;

      const name = prompt("Classroom name:", roomName(room));

      if (name === null) return;

      if (!name.trim() || name.trim().length > 100) {
        showMessage("Invalid classroom name.", true);
        return;
      }

      const capacityInput = prompt(
        "Classroom capacity:",
        room.capacity
      );

      if (capacityInput === null) return;

      const capacity = Number(capacityInput);

      if (!Number.isInteger(capacity) || capacity < 1 || capacity > 10000) {
        showMessage("Invalid capacity.", true);
        return;
      }

      const buildingInput = prompt(
        "Enter Building ID:\n" +
        buildings.map((b) =>
          `${b.id} - ${buildingName(b)}`
        ).join("\n"),
        room.building_id
      );

      if (buildingInput === null) return;

      const building_id = Number(buildingInput);

      if (!buildings.some((b) => Number(b.id) === building_id)) {
        showMessage("Invalid building.", true);
        return;
      }

      const { error } = await supabase
        .from("classrooms")
        .update({
          name: name.trim(),
          capacity,
          building_id
        })
        .eq("id", room.id);

      if (error) {
        showMessage(error.message, true);
        return;
      }

      await navigate("rooms");
      showMessage("Classroom updated successfully.");
    });
  });

  /* DELETE CLASSROOM */

  document.querySelectorAll("[data-delete-room]").forEach((button) => {
    button.addEventListener("click", async () => {
      const room = rooms.find(
        (r) => String(r.id) === button.dataset.deleteRoom
      );

      if (!room) return;

      const confirmed = confirm(
        `Delete ${roomName(room)}? This action cannot be undone.`
      );

      if (!confirmed) return;

      const { data, error } = await supabase
        .from("classrooms")
        .delete()
        .eq("id", room.id)
        .select("id");

      if (error) {
        showMessage(error.message, true);
        return;
      }

      if (!data?.length) {
        showMessage(
          "Classroom was not deleted. Check Admin permissions.",
          true
        );
        return;
      }

      await navigate("rooms");
      showMessage("Classroom deleted successfully.");
    });
  });
}

/* =========================================
   RESERVATIONS
   ========================================= */

function reservationTable(reservations, adminActions = false) {
  if (!reservations.length) {
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
          ${reservations.map((reservation) => `
            <tr>
              <td>${escapeHTML(reservation.classroom)}</td>
              <td>${escapeHTML(reservation.username || "User")}</td>
              <td>${escapeHTML(reservation.reservation_date)}</td>
              <td>${escapeHTML(reservation.reservation_time)}</td>
              <td>${statusBadge(reservation.status)}</td>

              ${adminActions ? `
                <td>
                  ${String(reservation.status).toLowerCase() === "pending" ? `
                    <button
                      type="button"
                      class="btn btn-success btn-small"
                      data-approve="${escapeHTML(reservation.id)}"
                    >
                      Approve
                    </button>

                    <button
                      type="button"
                      class="btn btn-danger btn-small"
                      data-reject="${escapeHTML(reservation.id)}"
                    >
                      Reject
                    </button>
                  ` : "—"}
                </td>
              ` : ""}
            </tr>
          `).join("")}
        </tbody>
      </table>
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
              <option value="">Select Classroom</option>

              ${rooms.map((room) => `
                <option value="${escapeHTML(roomName(room))}">
                  ${escapeHTML(roomName(room))}
                </option>
              `).join("")}
            </select>
          </div>

          <div class="form-group">
            <label for="reservation-date">Reservation Date</label>
            <input
              id="reservation-date"
              type="date"
              required
            >
          </div>

          <div class="form-group">
            <label for="reservation-time">Reservation Time</label>
            <input
              id="reservation-time"
              type="time"
              required
            >
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

  const dateInput = $("reservation-date");
  if (dateInput) {
    const now = new Date();
    const localDate = new Date(
      now.getTime() - now.getTimezoneOffset() * 60000
    ).toISOString().slice(0, 10);

    dateInput.min = localDate;
  }

  $("reservation-form")?.addEventListener(
    "submit",
    submitReservation
  );

  document.querySelectorAll("[data-approve]").forEach((button) => {
    button.addEventListener("click", () => {
      updateReservation(button.dataset.approve, "Approved");
    });
  });

  document.querySelectorAll("[data-reject]").forEach((button) => {
    button.addEventListener("click", () => {
      updateReservation(button.dataset.reject, "Rejected");
    });
  });
}

async function submitReservation(event) {
  event.preventDefault();

  const classroom = $("reservation-classroom").value;
  const reservation_date = $("reservation-date").value;
  const reservation_time = $("reservation-time").value;

  if (!classroom || !reservation_date || !reservation_time) {
    showMessage("Complete all reservation fields.", true);
    return;
  }

  const button = event.submitter;
  if (button) button.disabled = true;

  const { error } = await supabase
    .from("reservations")
    .insert({
      user_id: currentUser.id,
      username:
        currentProfile?.username ||
        currentProfile?.full_name ||
        currentUser.email,
      role: currentProfile?.role || "Student",
      classroom,
      reservation_date,
      reservation_time,
      status: "Pending"
    });

  if (button) button.disabled = false;

  if (error) {
    showMessage(error.message, true);
    return;
  }

  await navigate("reservations");
  showMessage("Reservation submitted successfully.");
}

async function updateReservation(id, status) {
  if (!isAdmin()) return;

  const { data, error } = await supabase
    .from("reservations")
    .update({ status })
    .eq("id", id)
    .eq("status", "Pending")
    .select("id");

  if (error) {
    showMessage(error.message, true);
    return;
  }

  if (!data?.length) {
    showMessage(
      "Request was not updated. Check its status or permissions.",
      true
    );
    return;
  }

  await navigate("reservations");
  showMessage(`Reservation ${status.toLowerCase()} successfully.`);
}

/* =========================================
   REQUEST HISTORY
   ========================================= */

async function renderHistory() {
  const reservations = await getReservations();

  const { data, error } = await supabase
    .from("reservation_history")
    .select("*");

  if (error) throw error;

  let history = data || [];

  if (!isAdmin()) {
    const allowedIds = new Set(
      reservations.map((r) => String(r.id))
    );

    history = history.filter((entry) =>
      allowedIds.has(String(entry.reservation_id))
    );
  }

  $("dashboard-content").innerHTML = `
    <h2>Request History</h2>

    <div class="content-section">
      ${history.length ? `
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
              ${history.map((entry) => `
                <tr>
                  <td>${escapeHTML(entry.reservation_id)}</td>
                  <td>${escapeHTML(entry.old_status || "—")}</td>
                  <td>${escapeHTML(entry.new_status || "—")}</td>
                  <td>${escapeHTML(
                    entry.changed_at ||
                    entry.created_at ||
                    "—"
                  )}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      ` : `
        <div class="empty-state">
          No request history found.
        </div>
      `}
    </div>
  `;
}

/* =========================================
   NAVIGATION
   ========================================= */

async function navigate(view) {
  currentView = view;
  showMessage("");

  document.querySelectorAll("[data-view]").forEach((button) => {
    button.classList.toggle(
      "active",
      button.dataset.view === view
    );
  });

  const content = $("dashboard-content");

  if (!content) return;

  content.innerHTML = `
    <div class="loading">Loading...</div>
  `;

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
    showMessage(error.message || "Unable to load data.", true);
  }
}

/* =========================================
   AUTHENTICATION
   ========================================= */

async function initializeSession() {
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    currentUser = null;
    currentProfile = null;
    showLogin();
    return;
  }

  currentUser = data.user;

  try {
    await loadProfile();
  } catch (profileError) {
    showLogin();
    showLoginError(
      "Unable to load profile: " + profileError.message
    );
    return;
  }

  showLoginError("");
  showDashboard();

  if ($("dashboard-title")) {
    $("dashboard-title").textContent =
      `ClassReserve - ${currentProfile?.role || "User"} Dashboard`;
  }

  if ($("welcome-message")) {
    $("welcome-message").textContent =
      `Welcome, ${
        currentProfile?.full_name ||
        currentProfile?.username ||
        currentUser.email
      }`;
  }

  await navigate("dashboard");
}

async function handleLogin(event) {
  event.preventDefault();
  showLoginError("");

  const email = $("email")?.value.trim();
  const password = $("password")?.value;

  if (!email || !password) {
    showLoginError("Enter your email and password.");
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
    showLoginError(error.message);
  } finally {
    if (button) button.disabled = false;
  }
}

async function handleLogout() {
  const { error } = await supabase.auth.signOut();

  if (error) {
    showMessage(error.message, true);
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

  const { error } = await supabase.auth.resetPasswordForEmail(
    email,
    {
      redirectTo:
        window.location.origin + window.location.pathname
    }
  );

  if (error) {
    showLoginError(error.message);
  } else {
    showLoginError(
      "If the email is registered, a reset link will be sent."
    );
  }
}

async function handleNewPassword(event) {
  event.preventDefault();

  const password = $("new-password")?.value;

  if (!password) return;

  const { error } = await supabase.auth.updateUser({
    password
  });

  if (error) {
    showLoginError(error.message);
  } else {
    showLoginError("Password updated successfully.");
  }
}

/* =========================================
   INITIALIZATION
   ========================================= */

function setupEvents() {
  $("login-form")?.addEventListener(
    "submit",
    handleLogin
  );

  $("logout-button")?.addEventListener(
    "click",
    handleLogout
  );

  $("forgot-password-button")?.addEventListener(
    "click",
    () => {
      $("reset-password-form")?.classList.toggle("hidden");
    }
  );

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

  if (
    !SUPABASE_URL ||
    !SUPABASE_KEY ||
    !SUPABASE_KEY.startsWith("sb_publishable_")
  ) {
    showLoginError(
      "Supabase setup is incomplete. Check supabase-config.js."
    );
    return;
  }

  try {
    supabase = createClient(
      SUPABASE_URL,
      SUPABASE_KEY
    );

    supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        currentUser = null;
        currentProfile = null;
        showLogin();
      }
    });

    await initializeSession();
  } catch (error) {
    showLogin();
    showLoginError(error.message);
  }
}

start();
