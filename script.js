
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/* =============================================
   CLASSRESERVE - COMPLETE UPDATED SCRIPT.JS
   Admin / Faculty / Student
   ============================================= */

const $ = (id) => document.getElementById(id);

const SUPABASE_URL = window.CLASSRESERVE_SUPABASE_URL;
const SUPABASE_KEY = window.CLASSRESERVE_SUPABASE_PUBLISHABLE_KEY;

let supabase;
let currentUser = null;
let currentProfile = null;
let currentView = "dashboard";

const escapeHTML = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[character]);

function message(text, error = false) {
  const el = $("app-message");
  if (!el) return;
  el.textContent = text;
  el.hidden = !text;
  el.className = error ? "alert alert-error" : "alert alert-success";
}

function loginError(text) {
  const el = $("login-error");
  if (!el) return;
  el.textContent = text;
  el.hidden = !text;
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

function roomName(room) {
  return room.classroom_name || `Room ${room.id}`;
}

function buildingName(building) {
  return building.building_name || `Building ${building.id}`;
}

function badge(status) {
  const value = String(status || "Pending");
  const cls = value.toLowerCase();
  return `<span class="status-badge status-${escapeHTML(cls)}">${escapeHTML(value)}</span>`;
}

function localToday() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function displayTime(value) {
  return value ? String(value).slice(0, 5) : "Not specified";
}

function displayRange(reservation) {
  if (reservation.start_time && reservation.end_time) {
    return `${displayTime(reservation.start_time)} – ${displayTime(reservation.end_time)}`;
  }
  return reservation.reservation_time || "Not specified";
}

/* =============================================
   SUPABASE DATA
   ============================================= */

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

async function getNotifications() {
  if (!currentUser) return [];

  const { data, error } = await supabase
    .from("reservation_notifications")
    .select("*")
    .eq("user_id", currentUser.id)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) throw error;
  return data || [];
}

/* =============================================
   DASHBOARD
   ============================================= */

async function renderDashboard() {
  const [rooms, reservations] = await Promise.all([
    getRooms(),
    getReservations()
  ]);

  const count = (status) =>
    reservations.filter(
      (r) => String(r.status).toLowerCase() === status
    ).length;

  $("dashboard-content").innerHTML = `
    <div class="section-header">
      <h2>${escapeHTML(currentProfile?.role || "User")} Dashboard</h2>
    </div>

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
        <h3>Pending</h3>
        <div class="stat-number">${count("pending")}</div>
      </div>
      <div class="stat-card">
        <h3>Approved</h3>
        <div class="stat-number">${count("approved")}</div>
      </div>
    </div>

    <div class="content-section">
      <h3>Recent Reservations</h3>
      ${reservationTable(reservations.slice(0, 5))}
    </div>

    ${!isAdmin() ? `
      <div class="content-section">
        <h3>Notifications</h3>
        <div id="dashboard-notifications">Loading notifications...</div>
      </div>
    ` : ""}
  `;

  if (!isAdmin()) {
    try {
      const notifications = await getNotifications();
      const el = $("dashboard-notifications");
      if (el) el.innerHTML = notificationList(notifications.slice(0, 5));
    } catch (error) {
      const el = $("dashboard-notifications");
      if (el) el.textContent = error.message;
    }
  }
}

/* =============================================
   BUILDING AND CLASSROOM MANAGEMENT
   ============================================= */

async function renderRooms() {
  const [rooms, buildings] = await Promise.all([
    getRooms(),
    getBuildings()
  ]);

  const buildingLabel = (id) => {
    const b = buildings.find((item) => String(item.id) === String(id));
    return b ? buildingName(b) : "Unknown Building";
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
              <label>Building Name</label>
              <input id="building-name" maxlength="100" required
                placeholder="e.g. SAB Building">
            </div>
            <div class="form-group">
              <label>Description (Optional)</label>
              <input id="building-description" maxlength="300"
                placeholder="Building description">
            </div>
            <button class="btn btn-primary" type="submit">
              Add Building
            </button>
          </form>
        </div>

        <div class="content-section">
          <h3>Add New Classroom</h3>
          <form id="add-room-form">
            <div class="form-group">
              <label>Classroom Name</label>
              <input id="room-name" maxlength="100" required
                placeholder="e.g. Classroom 301">
            </div>
            <div class="form-group">
              <label>Building</label>
              <select id="room-building" required>
                <option value="">Select Building</option>
                ${buildings.map((b) => `
                  <option value="${escapeHTML(b.id)}">
                    ${escapeHTML(buildingName(b))}
                  </option>
                `).join("")}
              </select>
            </div>
            <div class="form-group">
              <label>Capacity</label>
              <input id="room-capacity" type="number"
                min="1" max="10000" required placeholder="40">
            </div>
            <div class="form-group">
              <label>Room Type</label>
              <select id="room-type">
                <option>Regular Classroom</option>
                <option>Computer Laboratory</option>
                <option>Science Laboratory</option>
                <option>Lecture Hall</option>
                <option>Meeting Room</option>
              </select>
            </div>
            <button class="btn btn-primary" type="submit">
              Add Classroom
            </button>
          </form>
        </div>
      </div>

      <div class="content-section">
        <h3>Buildings</h3>
        <div class="table-responsive">
          <table>
            <thead><tr><th>ID</th><th>Building</th><th>Status</th></tr></thead>
            <tbody>
              ${buildings.map((b) => `
                <tr>
                  <td>${escapeHTML(b.id)}</td>
                  <td>${escapeHTML(buildingName(b))}</td>
                  <td>${escapeHTML(b.status || "Active")}</td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      </div>
    ` : `
      <div class="content-section">
        <h3>Find a Classroom</h3>
        <div class="content-grid">
          <div class="form-group">
            <label>Filter by Building</label>
            <select id="filter-building">
              <option value="">All Buildings</option>
              ${buildings.map((b) => `
                <option value="${escapeHTML(b.id)}">
                  ${escapeHTML(buildingName(b))}
                </option>
              `).join("")}
            </select>
          </div>
          <div class="form-group">
            <label>Minimum Capacity</label>
            <input id="filter-capacity" type="number"
              min="0" placeholder="e.g. 30">
          </div>
        </div>
      </div>
    `}

    <div class="content-section">
      <h3>Classrooms</h3>
      <div id="room-results" class="classroom-grid"></div>
    </div>
  `;

  const drawRooms = () => {
    const buildingFilter = $("filter-building")?.value || "";
    const capacityFilter = Number($("filter-capacity")?.value || 0);

    const filtered = rooms.filter((room) => {
      return (
        (!buildingFilter || String(room.building_id) === buildingFilter) &&
        Number(room.capacity) >= capacityFilter
      );
    });

    $("room-results").innerHTML = filtered.map((room) => `
      <div class="classroom-card">
        <h3>${escapeHTML(roomName(room))}</h3>
        <div class="room-details">
          <div>Building: ${escapeHTML(buildingLabel(room.building_id))}</div>
          <div>Capacity: ${escapeHTML(room.capacity)}</div>
          <div>Type: ${escapeHTML(room.room_type || "Regular Classroom")}</div>
          <div>Status: ${escapeHTML(room.status || "Available")}</div>
        </div>
        ${isAdmin() ? `
          <div style="display:flex;gap:8px;margin-top:14px;">
            <button class="btn btn-primary btn-small"
              data-edit-room="${escapeHTML(room.id)}">Edit</button>
            <button class="btn btn-danger btn-small"
              data-delete-room="${escapeHTML(room.id)}">Delete</button>
          </div>
        ` : ""}
      </div>
    `).join("") || "<p>No matching classrooms found.</p>";

    if (isAdmin()) attachRoomActions();
  };

  $("filter-building")?.addEventListener("change", drawRooms);
  $("filter-capacity")?.addEventListener("input", drawRooms);

  function attachRoomActions() {
    document.querySelectorAll("[data-edit-room]").forEach((button) => {
      button.addEventListener("click", async () => {
        const room = rooms.find(
          (r) => String(r.id) === button.dataset.editRoom
        );
        if (!room) return;

        const name = prompt("Classroom Name:", roomName(room));
        if (name === null) return;

        const capacityInput = prompt("Capacity:", room.capacity);
        if (capacityInput === null) return;

        const buildingInput = prompt(
          "Building ID:\n" +
          buildings.map((b) => `${b.id} - ${buildingName(b)}`).join("\n"),
          room.building_id
        );
        if (buildingInput === null) return;

        const capacity = Number(capacityInput);
        const building_id = Number(buildingInput);

        if (
          !name.trim() ||
          name.trim().length > 100 ||
          !Number.isInteger(capacity) ||
          capacity < 1 ||
          capacity > 10000 ||
          !buildings.some((b) => Number(b.id) === building_id)
        ) {
          message("Invalid classroom details.", true);
          return;
        }

        const { data, error } = await supabase
          .from("classrooms")
          .update({
            classroom_name: name.trim(),
            capacity,
            building_id
          })
          .eq("id", room.id)
          .select("id");

        if (error || !data?.length) {
          message(error?.message || "Update not permitted.", true);
          return;
        }

        await navigate("rooms");
        message("Classroom updated.");
      });
    });

    document.querySelectorAll("[data-delete-room]").forEach((button) => {
      button.addEventListener("click", async () => {
        const room = rooms.find(
          (r) => String(r.id) === button.dataset.deleteRoom
        );
        if (!room) return;

        if (!confirm(`Delete ${roomName(room)}?`)) return;

        const { data, error } = await supabase
          .from("classrooms")
          .delete()
          .eq("id", room.id)
          .select("id");

        if (error || !data?.length) {
          message(error?.message || "Deletion not permitted.", true);
          return;
        }

        await navigate("rooms");
        message("Classroom deleted.");
      });
    });
  }

  drawRooms();

  if (!isAdmin()) return;

  $("add-building-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = event.submitter;
    if (button) button.disabled = true;

    const { error } = await supabase.from("buildings").insert({
      building_name: $("building-name").value.trim(),
      description: $("building-description").value.trim() || null,
      status: "Active"
    });

    if (button) button.disabled = false;
    if (error) return message(error.message, true);

    await navigate("rooms");
    message("Building added successfully.");
  });

  $("add-room-form").addEventListener("submit", async (event) => {
    event.preventDefault();

    const classroom_name = $("room-name").value.trim();
    const building_id = Number($("room-building").value);
    const capacity = Number($("room-capacity").value);

    if (
      !classroom_name ||
      !buildings.some((b) => Number(b.id) === building_id) ||
      !Number.isInteger(capacity) ||
      capacity < 1 ||
      capacity > 10000
    ) {
      return message("Enter valid classroom details.", true);
    }

    const button = event.submitter;
    if (button) button.disabled = true;

    const { error } = await supabase.from("classrooms").insert({
      classroom_name,
      building_id,
      capacity,
      room_type: $("room-type").value,
      status: "Available"
    });

    if (button) button.disabled = false;
    if (error) return message(error.message, true);

    await navigate("rooms");
    message("Classroom added successfully.");
  });
}

/* =============================================
   RESERVATION TABLE
   ============================================= */

function reservationTable(items, adminActions = false, cancelActions = false) {
  if (!items.length) return "<p>No reservations found.</p>";

  return `
    <div class="table-responsive">
      <table>
        <thead>
          <tr>
            <th>Classroom</th>
            <th>Requested By</th>
            <th>Date</th>
            <th>Time</th>
            <th>Purpose</th>
            <th>Status</th>
            ${adminActions || cancelActions ? "<th>Actions</th>" : ""}
          </tr>
        </thead>
        <tbody>
          ${items.map((r) => `
            <tr>
              <td>${escapeHTML(r.classroom)}</td>
              <td>${escapeHTML(r.username || "User")}</td>
              <td>${escapeHTML(r.reservation_date)}</td>
              <td>${escapeHTML(displayRange(r))}</td>
              <td>${escapeHTML(r.purpose || "—")}</td>
              <td>${badge(r.status)}</td>
              ${adminActions || cancelActions ? `
                <td>
                  ${String(r.status).toLowerCase() === "pending" ? (
                    adminActions ? `
                      <button class="btn btn-primary btn-small"
                        data-approve="${escapeHTML(r.id)}">Approve</button>
                      <button class="btn btn-danger btn-small"
                        data-reject="${escapeHTML(r.id)}">Reject</button>
                    ` : `
                      <button class="btn btn-danger btn-small"
                        data-cancel="${escapeHTML(r.id)}">Cancel</button>
                    `
                  ) : "—"}
                </td>
              ` : ""}
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

/* =============================================
   AVAILABILITY CHECK
   ============================================= */

async function checkAvailability(classroom, date, start, end) {
  const { data, error } = await supabase
    .from("reservations")
    .select("id,start_time,end_time,status")
    .eq("classroom", classroom)
    .eq("reservation_date", date)
    .ilike("status", "Approved");

  if (error) throw error;

  return !(data || []).some((r) => {
    if (!r.start_time || !r.end_time) return true;
    return start < r.end_time && end > r.start_time;
  });
}

/* =============================================
   RESERVATION REQUESTS
   ============================================= */

async function renderReservations() {
  const [reservations, rooms, buildings] = await Promise.all([
    getReservations(),
    getRooms(),
    getBuildings()
  ]);

  const activeRooms = rooms.filter(
    (r) => String(r.status || "Available").toLowerCase() === "available"
  );

  $("dashboard-content").innerHTML = `
    <h2>Reservations / Requests</h2>

    ${!isAdmin() ? `
      <div class="content-section">
        <h3>Request a Classroom</h3>

        <form id="reservation-form">
          <div class="form-group">
            <label>Building</label>
            <select id="booking-building" required>
              <option value="">Select Building</option>
              ${buildings.map((b) => `
                <option value="${escapeHTML(b.id)}">
                  ${escapeHTML(buildingName(b))}
                </option>
              `).join("")}
            </select>
          </div>

          <div class="form-group">
            <label>Minimum Capacity</label>
            <input id="booking-capacity" type="number"
              min="0" placeholder="e.g. 30">
          </div>

          <div class="form-group">
            <label>Classroom</label>
            <select id="booking-room" required>
              <option value="">Select Building First</option>
            </select>
          </div>

          <div class="form-group">
            <label>Reservation Date</label>
            <input id="booking-date" type="date" required
              min="${localToday()}">
          </div>

          <div class="content-grid">
            <div class="form-group">
              <label>Start Time</label>
              <input id="booking-start" type="time" required>
            </div>
            <div class="form-group">
              <label>End Time</label>
              <input id="booking-end" type="time" required>
            </div>
          </div>

          <div class="form-group">
            <label>Reservation Purpose</label>
            <textarea id="booking-purpose" required
              minlength="3" maxlength="500"
              placeholder="e.g. Group study, lecture, examination"></textarea>
          </div>

          <button type="submit" class="btn btn-primary">
            Submit Reservation
          </button>
        </form>
      </div>
    ` : ""}

    <div class="content-section">
      <h3>${isAdmin() ? "Manage Requests" : "My Reservations"}</h3>
      ${reservationTable(reservations, isAdmin(), !isAdmin())}
    </div>
  `;

  if (!isAdmin()) {
    const updateRoomOptions = () => {
      const building = $("booking-building").value;
      const capacity = Number($("booking-capacity").value || 0);

      const filtered = activeRooms.filter(
        (r) =>
          String(r.building_id) === building &&
          Number(r.capacity) >= capacity
      );

      $("booking-room").innerHTML = `
        <option value="">Select Classroom</option>
        ${filtered.map((r) => `
          <option value="${escapeHTML(roomName(r))}">
            ${escapeHTML(roomName(r))} — Capacity ${escapeHTML(r.capacity)}
          </option>
        `).join("")}
      `;
    };

    $("booking-building").addEventListener("change", updateRoomOptions);
    $("booking-capacity").addEventListener("input", updateRoomOptions);
    $("reservation-form").addEventListener("submit", submitReservation);
  }

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

  document.querySelectorAll("[data-cancel]").forEach((button) => {
    button.addEventListener("click", () =>
      cancelReservation(button.dataset.cancel)
    );
  });
}

async function submitReservation(event) {
  event.preventDefault();

  const classroom = $("booking-room").value;
  const reservation_date = $("booking-date").value;
  const start_time = $("booking-start").value;
  const end_time = $("booking-end").value;
  const purpose = $("booking-purpose").value.trim();

  if (!classroom || !reservation_date || !start_time || !end_time) {
    return message("Complete all reservation fields.", true);
  }

  if (start_time >= end_time) {
    return message("End time must be later than start time.", true);
  }

  if (purpose.length < 3 || purpose.length > 500) {
    return message("Purpose must contain 3–500 characters.", true);
  }

  if (reservation_date < localToday()) {
    return message("Select today or a future date.", true);
  }

  const button = event.submitter;
  if (button) button.disabled = true;

  try {
    const available = await checkAvailability(
      classroom, reservation_date, start_time, end_time
    );

    if (!available) {
      return message(
        "This classroom already has an approved booking at that time.",
        true
      );
    }

    const { error } = await supabase.from("reservations").insert({
      user_id: currentUser.id,
      username:
        currentProfile?.username ||
        currentProfile?.full_name ||
        currentUser.email,
      role: currentProfile?.role || "Student",
      classroom,
      reservation_date,
      reservation_time: `${start_time} - ${end_time}`,
      start_time,
      end_time,
      purpose,
      status: "Pending"
    });

    if (error) throw error;

    await navigate("reservations");
    message("Reservation submitted. Waiting for Admin approval.");
  } catch (error) {
    message(error.message, true);
  } finally {
    if (button?.isConnected) button.disabled = false;
  }
}

async function updateReservation(id, status) {
  if (!isAdmin()) return;

  if (!confirm(`${status} this reservation?`)) return;

  const { data, error } = await supabase
    .from("reservations")
    .update({ status })
    .eq("id", id)
    .eq("status", "Pending")
    .select("id");

  if (error) {
    return message(error.message, true);
  }

  if (!data?.length) {
    return message("Request not updated. It may already be processed.", true);
  }

  await navigate("reservations");
  message(`Reservation ${status.toLowerCase()}.`);
}

async function cancelReservation(id) {
  if (isAdmin()) return;
  if (!confirm("Cancel this pending reservation?")) return;

  const { data, error } = await supabase.rpc(
    "cancel_my_reservation",
    { p_reservation_id: Number(id) }
  );

  if (error) return message(error.message, true);
  if (!data) return message("Only your pending requests can be cancelled.", true);

  await navigate("reservations");
  message("Reservation cancelled successfully.");
}

/* =============================================
   NOTIFICATIONS
   ============================================= */

function notificationList(items) {
  if (!items.length) return "<p>No notifications yet.</p>";

  return items.map((item) => `
    <div class="classroom-card" style="margin-bottom:12px;">
      <h3>${escapeHTML(item.title)}</h3>
      <p>${escapeHTML(item.message)}</p>
      <small>${escapeHTML(
        item.created_at
          ? new Date(item.created_at).toLocaleString()
          : ""
      )}</small>
      ${!item.is_read ? `
        <div style="margin-top:12px;">
          <button class="btn btn-primary btn-small"
            data-read-notification="${escapeHTML(item.id)}">
            Mark as Read
          </button>
        </div>
      ` : "<p>Read</p>"}
    </div>
  `).join("");
}

async function renderNotifications() {
  const items = await getNotifications();

  $("dashboard-content").innerHTML = `
    <h2>Notifications</h2>
    <div class="content-section">
      ${notificationList(items)}
    </div>
  `;

  document.querySelectorAll("[data-read-notification]").forEach((button) => {
    button.addEventListener("click", async () => {
      const { data, error } = await supabase
        .from("reservation_notifications")
        .update({ is_read: true })
        .eq("id", button.dataset.readNotification)
        .eq("user_id", currentUser.id)
        .select("id");

      if (error || !data?.length) {
        return message(error?.message || "Could not update notification.", true);
      }

      await navigate("notifications");
    });
  });
}

/* =============================================
   REQUEST HISTORY
   ============================================= */

async function renderHistory() {
  const reservations = await getReservations();

  $("dashboard-content").innerHTML = `
    <h2>Request History</h2>
    <div class="content-section">
      <h3>Reservation Records</h3>
      ${reservationTable(reservations)}
    </div>
  `;
}

/* =============================================
   NAVIGATION
   ============================================= */

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
      case "notifications":
        await renderNotifications();
        break;
      default:
        await renderDashboard();
    }
  } catch (error) {
    content.innerHTML = "";
    message(error.message || "Unable to load data.", true);
  }
}

/* =============================================
   LOGIN / LOGOUT
   ============================================= */

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
  } catch (error) {
    showLogin();
    loginError("Unable to load profile: " + error.message);
    return;
  }

  loginError("");
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

  // Add Notifications navigation without changing index.html.
  const sidebar = document.querySelector("[data-view='history']")?.parentElement;

  if (sidebar && !document.querySelector("[data-view='notifications']")) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "nav-item";
    button.dataset.view = "notifications";
    button.textContent = "Notifications";
    button.addEventListener("click", () => navigate("notifications"));
    sidebar.appendChild(button);
  }

  await navigate("dashboard");
}

async function handleLogin(event) {
  event.preventDefault();
  loginError("");

  const email = $("email")?.value.trim();
  const password = $("password")?.value;

  if (!email || !password) {
    return loginError("Enter your email and password.");
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

  if (error) return message(error.message, true);

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

  loginError(error
    ? error.message
    : "If the email exists, a password reset link will be sent.");
}

async function handleNewPassword(event) {
  event.preventDefault();

  const password = $("new-password")?.value;
  if (!password) return;

  const { error } = await supabase.auth.updateUser({ password });

  loginError(error
    ? error.message
    : "Password updated successfully.");
}

/* =============================================
   INITIALIZATION
   ============================================= */

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
    button.addEventListener("click", () => navigate(button.dataset.view));
  });
}

async function start() {
  setupEvents();

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    loginError("Supabase configuration is missing.");
    return;
  }

  try {
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

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
    loginError(error.message);
  }
}

start();
