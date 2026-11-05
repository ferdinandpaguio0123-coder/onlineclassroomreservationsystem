
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

function roomStatus(room) {
  return String(room.status || "Available").toLowerCase();
}

function roomById(rooms, id) {
  return rooms.find((r) => String(r.id) === String(id));
}

function formatDate(value) {
  if (!value) return "—";
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleDateString();
}

function roomDescription(room, buildings) {
  if (!room) return "Unknown classroom";
  const building = buildings.find((b) => String(b.id) === String(room.building_id));
  return `${roomName(room)} — ${building ? buildingName(building) : "Unknown Building"}`;
}

async function checkAvailability(classroomId, date, start, end) {
  if (!classroomId || !date || !start || !end || start >= end) return false;

  const { data, error } = await supabase.rpc("check_classroom_availability", {
    p_classroom_id: Number(classroomId),
    p_date: date,
    p_start_time: start,
    p_end_time: end
  });

  if (error) throw error;
  return data === true;
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
    const building = buildings.find(
      (item) => String(item.id) === String(id)
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
              <label>Building Name</label>
              <input
                id="building-name"
                maxlength="100"
                required
                placeholder="e.g. SAB Building"
              >
            </div>

            <div class="form-group">
              <label>Description (Optional)</label>
              <input
                id="building-description"
                maxlength="300"
                placeholder="Building description"
              >
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
              <input
                id="room-name"
                maxlength="100"
                required
                placeholder="e.g. Classroom 301"
              >
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
              <input
                id="room-capacity"
                type="number"
                min="1"
                max="10000"
                required
                placeholder="40"
              >
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
            <thead>
              <tr>
                <th>ID</th>
                <th>Building</th>
                <th>Status</th>
                <th>Admin Actions</th>
              </tr>
            </thead>

            <tbody>
              ${buildings.map((b) => `
                <tr>
                  <td>${escapeHTML(b.id)}</td>
                  <td>${escapeHTML(buildingName(b))}</td>
                  <td>${escapeHTML(b.status || "Active")}</td>
                  <td>
                    <button type="button" class="btn btn-primary btn-small" data-edit-building="${escapeHTML(b.id)}">Edit</button>
                    <button type="button" class="btn btn-small" data-toggle-building="${escapeHTML(b.id)}">${b.status === "Archived" ? "Restore" : "Archive"}</button>
                  </td>
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

            <input
              id="filter-capacity"
              type="number"
              min="0"
              placeholder="e.g. 30"
            >
          </div>
        </div>
      </div>
    `}

    <div class="content-section">
      <h3>Classrooms</h3>
      <div id="room-results" class="classroom-grid"></div>
    </div>
  `;

  function drawRooms() {
    const buildingFilter = $("filter-building")?.value || "";
    const capacityFilter = Number(
      $("filter-capacity")?.value || 0
    );

    const filtered = rooms.filter((room) => {
      const building = buildings.find((b) => String(b.id) === String(room.building_id));
      return (
        (isAdmin() || (room.status === "Available" && building?.status === "Active")) &&
        (!buildingFilter || String(room.building_id) === buildingFilter) &&
        Number(room.capacity) >= capacityFilter
      );
    });

    $("room-results").innerHTML = filtered.map((room) => `
      <div class="classroom-card">

        <h3>${escapeHTML(roomName(room))}</h3>

        <div class="room-details">
          <div>
            <strong>Building:</strong>
            ${escapeHTML(buildingLabel(room.building_id))}
          </div>

          <div>
            <strong>Capacity:</strong>
            ${escapeHTML(room.capacity)}
          </div>

          <div>
            <strong>Room Type:</strong>
            ${escapeHTML(room.room_type || "Regular Classroom")}
          </div>

          <div>
            <strong>Status:</strong>
            ${badge(room.status || "Available")}
          </div>
        </div>

        ${isAdmin() ? `
          <div style="display:flex;gap:8px;margin-top:14px;flex-wrap:wrap;">

            <button
              class="btn btn-primary btn-small"
              data-edit-room="${escapeHTML(room.id)}"
            >
              Edit
            </button>

            <button
              class="btn btn-small"
              data-maintenance-room="${escapeHTML(room.id)}"
            >
              Manage Status
            </button>

            <button type="button" class="btn btn-small" data-toggle-room="${escapeHTML(room.id)}">${room.status === "Archived" ? "Restore" : "Archive"}</button>
          </div>
        ` : ""}

      </div>
    `).join("") || "<p>No matching classrooms found.</p>";

    if (isAdmin()) {
      attachRoomActions();
    }
  }

  $("filter-building")?.addEventListener("change", drawRooms);
  $("filter-capacity")?.addEventListener("input", drawRooms);

  function attachRoomActions() {
    document.querySelectorAll("[data-toggle-room]").forEach((button) => {
      button.addEventListener("click", async () => {
        const room = rooms.find((r) => String(r.id) === button.dataset.toggleRoom);
        if (!room) return;
        const archived = room.status === "Archived";
        if (!confirm(`${archived ? "Restore" : "Archive"} ${roomName(room)}?`)) return;
        button.disabled = true;
        try {
          const { data, error } = await supabase.from("classrooms")
            .update({ status: archived ? "Available" : "Archived" })
            .eq("id", room.id).select("id");
          if (error) throw error;
          if (!data?.length) throw new Error("Room update was not permitted.");
          await navigate("rooms");
          message(`Room ${archived ? "restored" : "archived"} successfully.`);
        } catch (error) {
          message(error.message, true);
          if (button.isConnected) button.disabled = false;
        }
      });
    });

    // EDIT CLASSROOM
    document.querySelectorAll("[data-edit-room]").forEach((button) => {
      button.addEventListener("click", async () => {
        const room = rooms.find(
          (r) => String(r.id) === button.dataset.editRoom
        );

        if (!room) return;

        const name = prompt(
          "Classroom Name:",
          roomName(room)
        );

        if (name === null) return;

        const capacityInput = prompt(
          "Capacity:",
          room.capacity
        );

        if (capacityInput === null) return;

        const buildingInput = prompt(
          "Building ID:\n" +
          buildings.map(
            (b) => `${b.id} - ${buildingName(b)}`
          ).join("\n"),
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
          !buildings.some(
            (b) => Number(b.id) === building_id && b.status === "Active"
          )
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
          message(
            error?.message || "Update not permitted.",
            true
          );
          return;
        }

        await navigate("rooms");
        message("Classroom updated successfully.");
      });
    });

    // CLASSROOM MAINTENANCE STATUS
    document.querySelectorAll("[data-maintenance-room]").forEach((button) => {
      button.addEventListener("click", async () => {
        const room = rooms.find(
          (r) => String(r.id) === button.dataset.maintenanceRoom
        );

        if (!room) return;
        if (room.status === "Archived") {
          message("Restore this room using the Restore button first.", true);
          return;
        }

        const newStatus = prompt(
          "Enter classroom status:\n\n" +
          "Available\n" +
          "Under Maintenance\n" +
          "Unavailable",
          room.status || "Available"
        );

        if (newStatus === null) return;

        const allowedStatuses = [
          "Available",
          "Under Maintenance",
          "Unavailable"
        ];

        const status = allowedStatuses.find(
          (item) =>
            item.toLowerCase() === newStatus.trim().toLowerCase()
        );

        if (!status) {
          message(
            "Invalid status. Choose Available, Under Maintenance, or Unavailable.",
            true
          );
          return;
        }

        if (status === room.status) return;

        const confirmed = confirm(
          `Change ${roomName(room)} status to "${status}"?`
        );

        if (!confirmed) return;

        const { data, error } = await supabase
          .from("classrooms")
          .update({ status })
          .eq("id", room.id)
          .select("id");

        if (error || !data?.length) {
          message(
            error?.message || "Unable to update classroom status.",
            true
          );
          return;
        }

        await navigate("rooms");

        message(
          `${roomName(room)} status changed to ${status}.`
        );
      });
    });
  }

  drawRooms();

  if (!isAdmin()) return;

  document.querySelectorAll("[data-edit-building]").forEach((button) => {
    button.addEventListener("click", async () => {
      const building = buildings.find((b) => String(b.id) === button.dataset.editBuilding);
      if (!building) return;
      const name = prompt("Building name:", building.building_name);
      if (name === null) return;
      const cleanedName = name.trim();
      if (!cleanedName || cleanedName.length > 100) return message("Building name must be 1–100 characters.", true);
      const description = prompt("Building description:", building.description || "");
      if (description === null) return;
      if (description.length > 300) return message("Description must be at most 300 characters.", true);
      button.disabled = true;
      try {
        const { data, error } = await supabase.from("buildings")
          .update({ building_name: cleanedName, description: description.trim() || null })
          .eq("id", building.id).select("id");
        if (error) throw error;
        if (!data?.length) throw new Error("Building edit was not permitted.");
        await navigate("rooms");
        message("Building updated successfully.");
      } catch (error) {
        message(error.message, true);
        if (button.isConnected) button.disabled = false;
      }
    });
  });

  document.querySelectorAll("[data-toggle-building]").forEach((button) => {
    button.addEventListener("click", async () => {
      const building = buildings.find((b) => String(b.id) === button.dataset.toggleBuilding);
      if (!building) return;
      const archived = building.status === "Archived";
      const explanation = archived
        ? "Rooms will stay archived until you restore them individually."
        : "All rooms in this building will also be archived.";
      if (!confirm(`${archived ? "Restore" : "Archive"} ${buildingName(building)}?\n\n${explanation}`)) return;
      button.disabled = true;
      try {
        const { data, error } = await supabase.from("buildings")
          .update({ status: archived ? "Active" : "Archived" })
          .eq("id", building.id).select("id");
        if (error) throw error;
        if (!data?.length) throw new Error("Building update was not permitted.");
        await navigate("rooms");
        message(`Building ${archived ? "restored" : "archived"} successfully.`);
      } catch (error) {
        message(error.message, true);
        if (button.isConnected) button.disabled = false;
      }
    });
  });

  // ADD BUILDING
  $("add-building-form").addEventListener("submit", async (event) => {
    event.preventDefault();

    const button = event.submitter;
    if (button) button.disabled = true;

    try {
      const building_name = $("building-name").value.trim();

      if (!building_name) {
        throw new Error("Building name is required.");
      }

      const { error } = await supabase
        .from("buildings")
        .insert({
          building_name,
          description:
            $("building-description").value.trim() || null,
          status: "Active"
        });

      if (error) throw error;

      await navigate("rooms");
      message("Building added successfully.");

    } catch (error) {
      message(error.message, true);
    } finally {
      if (button?.isConnected) button.disabled = false;
    }
  });

  // ADD CLASSROOM
  $("add-room-form").addEventListener("submit", async (event) => {
    event.preventDefault();

    const classroom_name = $("room-name").value.trim();
    const building_id = Number($("room-building").value);
    const capacity = Number($("room-capacity").value);

    if (
      !classroom_name ||
      !buildings.some(
        (b) => Number(b.id) === building_id && b.status === "Active"
      ) ||
      !Number.isInteger(capacity) ||
      capacity < 1 ||
      capacity > 10000
    ) {
      return message(
        "Enter valid classroom details.",
        true
      );
    }

    const button = event.submitter;
    if (button) button.disabled = true;

    try {
      const { error } = await supabase
        .from("classrooms")
        .insert({
          classroom_name,
          building_id,
          capacity,

          room_type: $("room-type").value,
          status: "Available"
        });

      if (error) throw error;

      await navigate("rooms");
      message("Classroom added successfully.");

    } catch (error) {
      message(error.message, true);
    } finally {
      if (button?.isConnected) button.disabled = false;
    }
  });
}

/* =============================================
   RESERVATION TABLE AND DETAILS
   ============================================= */

function reservationTable(items, adminActions = false, cancelActions = false) {
  if (!items.length) {
    return "<p>No reservations found.</p>";
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
            <th>Purpose</th>
            <th>Status</th>
            <th>Actions</th>
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

              <td>
                <button
                  class="btn btn-primary btn-small"
                  data-details="${escapeHTML(r.id)}"
                >
                  Details
                </button>

                ${adminActions &&
                  String(r.status).toLowerCase() === "pending"
                    ? `
                      <button
                        class="btn btn-primary btn-small"
                        data-approve="${escapeHTML(r.id)}"
                      >
                        Approve
                      </button>

                      <button
                        class="btn btn-danger btn-small"
                        data-reject="${escapeHTML(r.id)}"
                      >
                        Reject
                      </button>
                    `
                    : ""
                }

                ${cancelActions &&
                  String(r.status).toLowerCase() === "pending"
                    ? `
                      <button
                        class="btn btn-danger btn-small"
                        data-cancel="${escapeHTML(r.id)}"
                      >
                        Cancel
                      </button>
                    `
                    : ""
                }
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

/* =============================================
   RESERVATION DETAILS MODAL
   ============================================= */

function showReservationDetails(reservation, rooms = [], buildings = []) {
  if (!reservation) return;

  const room = roomById(rooms, reservation.classroom_id);

  const building = room
    ? buildings.find(
        (b) => String(b.id) === String(room.building_id)
      )
    : null;

  document.getElementById("reservation-details-overlay")?.remove();

  const overlay = document.createElement("div");
  overlay.id = "reservation-details-overlay";

  overlay.style.cssText = `
    position: fixed;
    inset: 0;
    background: rgba(0,0,0,0.65);
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 20px;
  `;

  overlay.innerHTML = `
    <div style="
      background: var(--card-bg, #fff);
      color: var(--text-color, #222);
      width: 100%;
      max-width: 560px;
      max-height: 90vh;
      overflow-y: auto;
      border-radius: 14px;
      padding: 24px;
      box-shadow: 0 15px 50px rgba(0,0,0,0.3);
    ">

      <div style="
        display:flex;
        justify-content:space-between;
        align-items:center;
        gap:12px;
      ">
        <h2>Reservation Details</h2>

        <button
          type="button"
          class="btn btn-small"
          id="close-reservation-details"
        >
          Close
        </button>
      </div>

      <div style="line-height:2; margin-top:16px;">

        <p>
          <strong>Reservation ID:</strong>
          ${escapeHTML(reservation.id)}
        </p>

        <p>
          <strong>Requested By:</strong>
          ${escapeHTML(reservation.username || "User")}
        </p>

        <p>
          <strong>Role:</strong>
          ${escapeHTML(reservation.role || "—")}
        </p>

        <p>
          <strong>Building:</strong>
          ${escapeHTML(building ? buildingName(building) : "Not specified")}
        </p>

        <p>
          <strong>Classroom:</strong>
          ${escapeHTML(room ? roomName(room) : reservation.classroom)}
        </p>

        <p>
          <strong>Room Type:</strong>
          ${escapeHTML(room?.room_type || "—")}
        </p>

        <p>
          <strong>Capacity:</strong>
          ${escapeHTML(room?.capacity ?? "—")}
        </p>

        <p>
          <strong>Reservation Date:</strong>
          ${escapeHTML(formatDate(reservation.reservation_date))}
        </p>

        <p>
          <strong>Time:</strong>
          ${escapeHTML(displayRange(reservation))}
        </p>

        <p>
          <strong>Purpose:</strong>
          ${escapeHTML(reservation.purpose || "Not specified")}
        </p>

        <p>
          <strong>Status:</strong>
          ${badge(reservation.status)}
        </p>

        ${reservation.rejection_reason ? `
          <div style="
            margin-top:14px;
            padding:14px;
            border:1px solid #ef4444;
            border-radius:10px;
          ">
            <strong>Rejection Reason:</strong>
            <p>${escapeHTML(reservation.rejection_reason)}</p>
          </div>
        ` : ""}

        <p>
          <strong>Date Requested:</strong>
          ${escapeHTML(
            reservation.created_at
              ? new Date(reservation.created_at).toLocaleString()
              : "—"
          )}
        </p>

      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  $("close-reservation-details")?.addEventListener(
    "click",
    () => overlay.remove()
  );

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      overlay.remove();
    }
  });
}

/* =============================================
   RESERVATION TABLE BUTTON EVENTS
   ============================================= */

function attachReservationActions(reservations, rooms, buildings) {

  document.querySelectorAll("[data-details]").forEach((button) => {
    button.addEventListener("click", () => {
      const reservation = reservations.find(
        (r) => String(r.id) === button.dataset.details
      );

      showReservationDetails(reservation, rooms, buildings);
    });
  });

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

  document.querySelectorAll("[data-cancel]").forEach((button) => {
    button.addEventListener("click", () => {
      cancelReservation(button.dataset.cancel);
    });
  });
}

/* =============================================
   ADMIN APPROVE / REJECT
   ============================================= */

async function updateReservation(id, status) {
  if (!isAdmin()) {
    return message("Only Admin can process reservations.", true);
  }

  let rejection_reason = null;

  if (status === "Rejected") {
    const input = prompt(
      "Enter the reason for rejecting this reservation (3–500 characters):"
    );

    if (input === null) return;

    rejection_reason = input.trim();

    if (
      rejection_reason.length < 3 ||
      rejection_reason.length > 500
    ) {
      return message(
        "Rejection reason must contain 3–500 characters.",
        true
      );
    }

    if (!confirm("Reject this reservation with the provided reason?")) {
      return;
    }
  } else {
    if (!confirm("Approve this reservation?")) {
      return;
    }
  }

  try {
    const updates = {
      status,
      rejection_reason
    };

    const { data, error } = await supabase
      .from("reservations")
      .update(updates)
      .eq("id", id)
      .eq("status", "Pending")
      .select("id");

    if (error) throw error;

    if (!data?.length) {
      throw new Error(
        "Request not updated. It may already have been processed."
      );
    }

    await navigate("reservations");

    message(
      status === "Approved"
        ? "Reservation approved successfully."
        : "Reservation rejected with a reason."
    );

  } catch (error) {
    message(error.message, true);
  }
}

/* =============================================
   CANCEL RESERVATION
   ============================================= */

async function cancelReservation(id) {
  if (isAdmin()) return;

  if (!confirm("Cancel this pending reservation?")) {
    return;
  }

  try {
    const { data, error } = await supabase.rpc(
      "cancel_my_reservation",
      {
        p_reservation_id: Number(id)
      }
    );

    if (error) throw error;

    if (!data) {
      throw new Error(
        "Only your own pending reservations can be cancelled."
      );
    }

    await navigate("reservations");
    message("Reservation cancelled successfully.");

  } catch (error) {
    message(error.message, true);
  }
}

/* =============================================
   AVAILABILITY CHECKER DISPLAY
   ============================================= */

function availabilityCheckerHTML() {
  return `
    <div class="content-section">
      <h3>Check Classroom Availability</h3>

      <p>
        Select a classroom, date, and time to check
        whether it is available.
      </p>

      <div class="form-group">
        <label>Classroom</label>
        <select id="availability-room">
          <option value="">Select Classroom</option>
        </select>
      </div>

      <div class="form-group">
        <label>Date</label>
        <input
          type="date"
          id="availability-date"
          min="${localToday()}"
          value="${localToday()}"
        >
      </div>

      <div class="content-grid">
        <div class="form-group">
          <label>Start Time</label>
          <input
            type="time"
            id="availability-start"
            value="08:00"
          >
        </div>

        <div class="form-group">
          <label>End Time</label>
          <input
            type="time"
            id="availability-end"
            value="09:00"
          >
        </div>
      </div>

      <button
        type="button"
        class="btn btn-primary"
        id="check-availability-button"
      >
        Check Availability
      </button>

      <div id="availability-result" style="margin-top:16px;"></div>
    </div>
  `;
}

function setupAvailabilityChecker(rooms, buildings) {
  const select = $("availability-room");

  if (!select) return;

  select.innerHTML = `
    <option value="">Select Classroom</option>
    ${rooms.map((room) => `
      <option value="${escapeHTML(room.id)}">
        ${escapeHTML(roomDescription(room, buildings))}
      </option>
    `).join("")}
  `;

  $("check-availability-button")?.addEventListener(
    "click",
    async () => {
      const roomId = select.value;
      const date = $("availability-date").value;
      const start = $("availability-start").value;
      const end = $("availability-end").value;
      const result = $("availability-result");

      if (!roomId || !date || !start || !end) {
        result.textContent = "Complete all availability fields.";
        return;
      }

      if (start >= end) {
        result.textContent = "End time must be later than start time.";
        return;
      }

      const button = $("check-availability-button");
      button.disabled = true;
      result.textContent = "Checking availability...";

      try {
        const available = await checkAvailability(
          roomId,
          date,
          start,
          end
        );

        result.innerHTML = available
          ? `
            <p style="color:#16a34a;font-weight:bold;">
              Available! This classroom has no approved
              booking during the selected time.
            </p>
          `
          : `
            <p style="color:#dc2626;font-weight:bold;">
              Unavailable. This classroom is already booked
              or is not available for reservations.
            </p>
          `;

      } catch (error) {
        result.textContent = error.message;
      } finally {
        button.disabled = false;
      }
    }
  );
}

/* =============================================
   CLASSROOM SCHEDULE CALENDAR
   ============================================= */

function calendarHTML() {
  return `
    <div class="content-section">
      <h3>Classroom Schedule Calendar</h3>

      <p>
        View classroom availability by date.
        Green means available, and red means unavailable.
      </p>

      <div class="content-grid">

        <div class="form-group">
          <label>Select Classroom</label>
          <select id="calendar-room">
            <option value="">Select Classroom</option>
          </select>
        </div>

        <div class="form-group">
          <label>Select Date</label>
          <input
            id="calendar-date"
            type="date"
            min="${localToday()}"
            value="${localToday()}"
          >
        </div>

      </div>

      <button
        type="button"
        id="load-calendar-button"
        class="btn btn-primary"
      >
        View Schedule
      </button>

      <div
        id="calendar-results"
        style="margin-top:20px;"
      ></div>

    </div>
  `;
}

/* =============================================
   CALENDAR TIME SLOTS
   ============================================= */

function generateCalendarSlots() {
  const slots = [];

  // Calendar operating hours: 7:00 AM to 7:00 PM
  for (let hour = 7; hour < 19; hour++) {
    const start = `${String(hour).padStart(2, "0")}:00`;
    const end = `${String(hour + 1).padStart(2, "0")}:00`;

    slots.push({
      start,
      end
    });
  }

  return slots;
}

function formatCalendarTime(time) {
  const [hours, minutes] = time.split(":").map(Number);

  const period = hours >= 12 ? "PM" : "AM";
  const formattedHour = hours % 12 || 12;

  return `${formattedHour}:${String(minutes).padStart(2, "0")} ${period}`;
}

/* =============================================
   LOAD CLASSROOM CALENDAR
   ============================================= */

function setupCalendar(rooms, buildings) {
  const select = $("calendar-room");

  if (!select) return;

  select.innerHTML = `
    <option value="">Select Classroom</option>

    ${rooms.map((room) => `
      <option value="${escapeHTML(room.id)}">
        ${escapeHTML(roomDescription(room, buildings))}
      </option>
    `).join("")}
  `;

  $("load-calendar-button")?.addEventListener(
    "click",
    async () => {
      const roomId = select.value;
      const date = $("calendar-date").value;
      const results = $("calendar-results");
      const button = $("load-calendar-button");

      if (!roomId || !date) {
        results.innerHTML = `
          <p>Please select a classroom and date.</p>
        `;
        return;
      }

      const room = roomById(rooms, roomId);

      if (!room) {
        results.textContent = "Classroom not found.";
        return;
      }

      button.disabled = true;

      results.innerHTML = `
        <p>Loading classroom schedule...</p>
      `;

      try {
        const slots = generateCalendarSlots();

        // Check all time slots using the secure Supabase RPC.
        const availability = await Promise.all(
          slots.map(async (slot) => {
            const available = await checkAvailability(
              roomId,
              date,
              slot.start,
              slot.end
            );

            return {
              ...slot,
              available
            };
          })
        );

        const availableCount = availability.filter(
          (slot) => slot.available
        ).length;

        const occupiedCount =
          availability.length - availableCount;

        results.innerHTML = `
          <div style="margin-bottom:18px;">

            <h3>${escapeHTML(roomName(room))}</h3>

            <p>
              <strong>Date:</strong>
              ${escapeHTML(formatDate(date))}
            </p>

            <p>
              <strong>Room Status:</strong>
              ${badge(room.status || "Available")}
            </p>

            <p>
              <strong>Available Slots:</strong>
              ${availableCount}
            </p>

            <p>
              <strong>Unavailable Slots:</strong>
              ${occupiedCount}
            </p>

          </div>

          <div style="
            display:grid;
            grid-template-columns:repeat(auto-fit,minmax(170px,1fr));
            gap:12px;
          ">

            ${availability.map((slot) => `
              <div style="
                border:1px solid ${
                  slot.available ? "#16a34a" : "#dc2626"
                };
                border-radius:12px;
                padding:16px;
                background:${
                  slot.available
                    ? "rgba(22,163,74,0.08)"
                    : "rgba(220,38,38,0.08)"
                };
              ">

                <div style="font-weight:bold;margin-bottom:8px;">
                  ${escapeHTML(formatCalendarTime(slot.start))}
                  -
                  ${escapeHTML(formatCalendarTime(slot.end))}
                </div>

                <div style="
                  font-weight:600;
                  color:${slot.available ? "#16a34a" : "#dc2626"};
                ">
                  ${slot.available ? "Available" : "Unavailable"}
                </div>

              </div>
            `).join("")}

          </div>
        `;

      } catch (error) {
        results.textContent =
          error.message || "Unable to load calendar.";
      } finally {
        button.disabled = false;
      }
    }
  );
}

/* =============================================
   RESERVATION REQUESTS PAGE
   ============================================= */

async function renderReservations() {
  const [reservations, rooms, buildings] = await Promise.all([
    getReservations(),
    getRooms(),
    getBuildings()
  ]);

  const activeRooms = rooms.filter((room) => {
    const building = buildings.find((b) => String(b.id) === String(room.building_id));
    return roomStatus(room) === "available" && building?.status === "Active";
  });

  $("dashboard-content").innerHTML = `
    <div class="section-header">
      <h2>Reservations / Requests</h2>
    </div>

    ${!isAdmin() ? `
      <div class="content-section">
        <h3>Request a Classroom</h3>

        <form id="reservation-form">

          <div class="form-group">
            <label>Building</label>

            <select id="booking-building" required>
              <option value="">Select Building</option>

              ${buildings.filter((building) => building.status === "Active").map((building) => `
                <option value="${escapeHTML(building.id)}">
                  ${escapeHTML(buildingName(building))}

                </option>
              `).join("")}

            </select>
          </div>

          <div class="form-group">
            <label>Minimum Capacity</label>

            <input
              id="booking-capacity"
              type="number"
              min="0"
              placeholder="e.g. 30"
            >
          </div>

          <div class="form-group">
            <label>Classroom</label>

            <select id="booking-room" required>
              <option value="">Select Building First</option>
            </select>
          </div>

          <div class="form-group">
            <label>Reservation Date</label>

            <input
              id="booking-date"
              type="date"
              min="${localToday()}"
              required
            >
          </div>

          <div class="content-grid">

            <div class="form-group">
              <label>Start Time</label>

              <input
                id="booking-start"
                type="time"
                required
              >
            </div>

            <div class="form-group">
              <label>End Time</label>

              <input
                id="booking-end"
                type="time"
                required
              >
            </div>

          </div>

          <div class="form-group">
            <label>Reservation Purpose</label>

            <textarea
              id="booking-purpose"
              minlength="3"
              maxlength="500"
              required
              placeholder="e.g. Lecture, examination, group study"
            ></textarea>
          </div>

          <button
            type="submit"
            class="btn btn-primary"
          >
            Submit Reservation
          </button>

        </form>
      </div>
    ` : ""}

    <div class="content-section">
      <h3>${isAdmin() ? "Manage Requests" : "My Reservations"}</h3>

      ${reservationTable(
        reservations,
        isAdmin(),
        !isAdmin()
      )}
    </div>

    ${availabilityCheckerHTML()}

    ${calendarHTML()}
  `;

  /* =============================================
     RESERVATION FORM EVENTS
     ============================================= */

  if (!isAdmin()) {
    const updateRoomOptions = () => {
      const buildingId = $("booking-building").value;

      const capacity = Number(
        $("booking-capacity").value || 0
      );

      const filtered = activeRooms.filter(
        (room) =>
          String(room.building_id) === buildingId &&
          Number(room.capacity) >= capacity
      );

      $("booking-room").innerHTML = `
        <option value="">Select Classroom</option>

        ${filtered.map((room) => `
          <option value="${escapeHTML(room.id)}">
            ${escapeHTML(roomName(room))}
            — Capacity ${escapeHTML(room.capacity)}
          </option>
        `).join("")}
      `;
    };

    $("booking-building")?.addEventListener(
      "change",
      updateRoomOptions
    );

    $("booking-capacity")?.addEventListener(
      "input",
      updateRoomOptions
    );

    $("reservation-form")?.addEventListener(
      "submit",
      submitReservation
    );
  }

  /* =============================================
     CONNECT PAGE FEATURES
     ============================================= */

  attachReservationActions(
    reservations,
    rooms,
    buildings
  );

  setupAvailabilityChecker(
    isAdmin() ? rooms : activeRooms,
    buildings
  );

  setupCalendar(
    isAdmin() ? rooms : activeRooms,
    buildings
  );
}

/* =============================================
   SUBMIT CLASSROOM RESERVATION
   ============================================= */

async function submitReservation(event) {
  event.preventDefault();

  if (!currentUser || isAdmin()) {
    return message(
      "Only Faculty and Students can submit reservations.",
      true
    );
  }

  const classroomId = $("booking-room").value;
  const reservation_date = $("booking-date").value;
  const start_time = $("booking-start").value;
  const end_time = $("booking-end").value;
  const purpose = $("booking-purpose").value.trim();

  if (
    !classroomId ||
    !reservation_date ||
    !start_time ||
    !end_time
  ) {
    return message(
      "Please complete all reservation fields.",
      true
    );
  }

  if (start_time >= end_time) {
    return message(
      "End time must be later than start time.",
      true
    );
  }

  if (
    purpose.length < 3 ||
    purpose.length > 500
  ) {
    return message(
      "Reservation purpose must contain 3–500 characters.",
      true
    );
  }

  if (reservation_date < localToday()) {
    return message(
      "Select today or a future date.",
      true
    );
  }

  const button = event.submitter;

  if (button) button.disabled = true;

  try {
    const rooms = await getRooms();

    const room = roomById(
      rooms,
      classroomId
    );

    if (!room) {
      throw new Error("Selected classroom does not exist.");
    }

    if (roomStatus(room) !== "available") {
      throw new Error("This classroom is currently unavailable or under maintenance.");
    }
    const buildings = await getBuildings();
    const building = buildings.find((b) => String(b.id) === String(room.building_id));
    if (building?.status !== "Active") {
      throw new Error("This building is not active.");
    }

    // Check availability through the secure Supabase RPC.
    const available = await checkAvailability(
      classroomId,
      reservation_date,
      start_time,
      end_time
    );

    if (!available) {
      throw new Error(
        "This classroom is already booked during the selected time."
      );
    }

    const { error } = await supabase
      .from("reservations")
      .insert({
        user_id: currentUser.id,

        username:
          currentProfile?.username ||
          currentProfile?.full_name ||
          currentUser.email,

        role: currentProfile?.role || "Student",

        classroom_id: Number(classroomId),

        // Keep the existing classroom text column
        // for compatibility with older reservations.
        classroom: roomName(room),

        reservation_date,

        reservation_time:
          `${start_time} - ${end_time}`,

        start_time,
        end_time,
        purpose,

        status: "Pending"
      });

    if (error) throw error;

    await navigate("reservations");

    message(
      "Reservation submitted successfully. Waiting for Admin approval."
    );

  } catch (error) {
    message(
      error.message || "Unable to submit reservation.",
      true
    );
  } finally {
    if (button?.isConnected) {
      button.disabled = false;
    }
  }
}

/* =============================================
   NOTIFICATION BELL
   ============================================= */

function ensureNotificationBell() {
  if ($("notification-bell")) return;

  const dashboardTitle = $("dashboard-title");
  const welcomeMessage = $("welcome-message");

  const container =
    dashboardTitle?.parentElement ||
    welcomeMessage?.parentElement;

  if (!container) return;

  const bell = document.createElement("button");

  bell.type = "button";
  bell.id = "notification-bell";
  bell.className = "btn btn-small";

  bell.setAttribute(
    "aria-label",
    "View notifications"
  );

  bell.style.cssText = `
    position: relative;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    margin: 8px;
    padding: 10px 14px;
    cursor: pointer;
  `;

  bell.innerHTML = `
    <span style="font-size:20px;">🔔</span>

    <span
      id="notification-count"
      style="
        display:none;
        min-width:20px;
        height:20px;
        padding:0 5px;
        border-radius:999px;
        background:#dc2626;
        color:white;
        font-size:12px;
        font-weight:bold;
        align-items:center;
        justify-content:center;
      "
    >
      0
    </span>
  `;

  bell.addEventListener("click", () => {
    navigate("notifications");
  });

  container.appendChild(bell);
}

/* =============================================
   UPDATE UNREAD NOTIFICATION COUNT
   ============================================= */

async function updateNotificationBell() {
  const counter = $("notification-count");

  if (!counter || !currentUser) return;

  try {
    const { count, error } = await supabase
      .from("reservation_notifications")
      .select("id", {
        count: "exact",
        head: true
      })
      .eq("user_id", currentUser.id)
      .eq("is_read", false);

    if (error) throw error;

    const unread = count || 0;

    counter.textContent =
      unread > 99 ? "99+" : String(unread);

    counter.style.display =
      unread > 0 ? "inline-flex" : "none";

  } catch (error) {
    console.error(
      "Unable to update notification bell:",
      error
    );
  }
}

/* =============================================
   NOTIFICATION LIST
   ============================================= */

function notificationList(items) {
  if (!items.length) {
    return "<p>No notifications yet.</p>";
  }

  return items.map((item) => `
    <div
      class="classroom-card"
      style="
        margin-bottom:12px;
        border-left:4px solid ${
          item.is_read ? "#94a3b8" : "#2563eb"
        };
      "
    >

      <div style="
        display:flex;
        align-items:center;
        justify-content:space-between;
        gap:12px;
        flex-wrap:wrap;
      ">

        <h3>${escapeHTML(item.title || "Notification")}</h3>

        ${!item.is_read ? `
          <span style="
            color:#2563eb;
            font-size:12px;
            font-weight:bold;
          ">
            NEW
          </span>
        ` : ""}

      </div>

      <p style="margin-top:10px;">
        ${escapeHTML(item.message || "")}
      </p>

      <small>
        ${escapeHTML(
          item.created_at
            ? new Date(item.created_at).toLocaleString()
            : ""
        )}
      </small>

      <div style="
        display:flex;
        gap:8px;
        margin-top:14px;
        flex-wrap:wrap;
      ">

        ${!item.is_read ? `
          <button
            type="button"
            class="btn btn-primary btn-small"
            data-read-notification="${escapeHTML(item.id)}"
          >
            Mark as Read
          </button>
        ` : `
          <span style="font-size:13px;opacity:0.7;">
            Read
          </span>
        `}

        ${item.reservation_id ? `
          <button
            type="button"
            class="btn btn-small"
            data-notification-reservation="${escapeHTML(item.reservation_id)}"
          >
            View Reservation
          </button>
        ` : ""}

      </div>

    </div>
  `).join("");
}

/* =============================================
   NOTIFICATIONS PAGE
   ============================================= */

async function renderNotifications() {
  const [notifications, reservations, rooms, buildings] =
    await Promise.all([
      getNotifications(),
      getReservations(),
      getRooms(),
      getBuildings()
    ]);

  const unreadCount = notifications.filter(
    (item) => !item.is_read
  ).length;

  $("dashboard-content").innerHTML = `
    <div class="section-header">
      <h2>Notifications</h2>
    </div>

    <div class="content-section">

      <div style="
        display:flex;
        justify-content:space-between;
        align-items:center;
        flex-wrap:wrap;
        gap:12px;
        margin-bottom:18px;
      ">

        <div>
          <h3>My Notifications</h3>

          <p>
            ${unreadCount}
            unread notification${unreadCount === 1 ? "" : "s"}
          </p>
        </div>

        ${unreadCount > 0 ? `
          <button
            type="button"
            id="mark-all-notifications-read"
            class="btn btn-primary btn-small"
          >
            Mark All as Read
          </button>
        ` : ""}

      </div>

      ${notificationList(notifications)}

    </div>
  `;

  /* =============================================
     MARK ONE NOTIFICATION AS READ
     ============================================= */

  document.querySelectorAll(
    "[data-read-notification]"
  ).forEach((button) => {

    button.addEventListener("click", async () => {
      button.disabled = true;

      try {
        const { data, error } = await supabase
          .from("reservation_notifications")
          .update({
            is_read: true
          })
          .eq("id", button.dataset.readNotification)
          .eq("user_id", currentUser.id)
          .select("id");

        if (error) throw error;

        if (!data?.length) {
          throw new Error(
            "Notification could not be updated."
          );
        }

        await updateNotificationBell();
        await navigate("notifications");

      } catch (error) {
        message(error.message, true);

        if (button.isConnected) {
          button.disabled = false;
        }
      }
    });

  });

  /* =============================================
     MARK ALL NOTIFICATIONS AS READ
     ============================================= */

  $("mark-all-notifications-read")?.addEventListener(
    "click",
    async (event) => {
      const button = event.currentTarget;
      button.disabled = true;

      try {
        const { error } = await supabase
          .from("reservation_notifications")
          .update({
            is_read: true
          })
          .eq("user_id", currentUser.id)
          .eq("is_read", false);

        if (error) throw error;

        await updateNotificationBell();
        await navigate("notifications");

        message("All notifications marked as read.");

      } catch (error) {
        message(error.message, true);

        if (button.isConnected) {
          button.disabled = false;
        }
      }
    }
  );

  /* =============================================
     OPEN RESERVATION FROM NOTIFICATION
     ============================================= */

  document.querySelectorAll(
    "[data-notification-reservation]"
  ).forEach((button) => {

    button.addEventListener("click", () => {
      const reservation = reservations.find(
        (item) =>
          String(item.id) ===
          String(button.dataset.notificationReservation)
      );

      if (!reservation) {
        message(
          "Reservation details are unavailable.",
          true
        );
        return;
      }

      showReservationDetails(
        reservation,
        rooms,
        buildings
      );
    });

  });

  await updateNotificationBell();
}

/* =============================================
   REQUEST HISTORY
   ============================================= */

async function renderHistory() {
  const [reservations, rooms, buildings] =
    await Promise.all([
      getReservations(),
      getRooms(),
      getBuildings()
    ]);

  $("dashboard-content").innerHTML = `
    <div class="section-header">
      <h2>Request History</h2>
    </div>

    <div class="content-section">

      <h3>Reservation Records</h3>

      <p style="margin-bottom:16px;">
        View your reservation requests and their
        current approval status.
      </p>

      ${reservationTable(reservations)}

    </div>
  `;

  // Allow users to view complete reservation details.
  attachReservationActions(
    reservations,
    rooms,
    buildings
  );
}

/* =============================================
   CLASSRESERVE - PART 6 OF 6
   NAVIGATION, AUTHENTICATION AND STARTUP
   ============================================= */

let notificationChannel = null;
let navigationRequestId = 0;

/* =============================================
   SIDEBAR NAVIGATION
   ============================================= */

function setupNavigation() {
  document.querySelectorAll("[data-view]").forEach((button) => {
    if (button.dataset.classreserveBound === "true") return;

    button.dataset.classreserveBound = "true";

    button.addEventListener("click", (event) => {
      event.preventDefault();

      const view = button.dataset.view;

      if (view) {
        navigate(view);
      }
    });
  });
}

/* =============================================
   NAVIGATION
   ============================================= */

async function navigate(view = "dashboard") {
  if (!currentUser) {
    showLogin();
    return;
  }

  const validViews = [
    "dashboard",
    "rooms",
    "reservations",
    "history",
    "notifications"
  ];

  if (!validViews.includes(view)) {
    view = "dashboard";
  }

  currentView = view;

  const requestId = ++navigationRequestId;

  const content = $("dashboard-content");

  if (!content) {
    console.error("Dashboard content element not found.");
    return;
  }

  content.innerHTML = `
    <div class="content-section">
      <p>Loading...</p>
    </div>
  `;

  message("");

  document.querySelectorAll("[data-view]").forEach((button) => {
    const active = button.dataset.view === view;

    button.classList.toggle("active", active);

    if (active) {
      button.setAttribute("aria-current", "page");
    } else {
      button.removeAttribute("aria-current");
    }
  });

  const titles = {
    dashboard: "Dashboard",
    rooms: "Classrooms",
    reservations: "Reservations",
    history: "Request History",
    notifications: "Notifications"
  };

  if ($("dashboard-title")) {
    $("dashboard-title").textContent = titles[view];
  }

  try {
    switch (view) {
      case "dashboard":
        await renderDashboard();
        break;

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
    }

    if (requestId !== navigationRequestId) {
      return;
    }

    setupNavigation();

    if (view === "dashboard") {
      const reservations = await getReservations();
      const rooms = await getRooms();
      const buildings = await getBuildings();

      if (requestId === navigationRequestId) {
        attachReservationActions(
          reservations,
          rooms,
          buildings
        );
      }
    }

    await updateNotificationBell();

  } catch (error) {
    console.error("Navigation error:", error);

    if (requestId !== navigationRequestId) {
      return;
    }

    content.innerHTML = `
      <div class="content-section">
        <h3>Unable to Load Page</h3>
        <p>${escapeHTML(error.message || "Unknown error")}</p>
      </div>
    `;

    message(error.message || "Unable to load page.", true);
  }
}

/* =============================================
   NOTIFICATION SIDEBAR BUTTON
   ============================================= */

function ensureNotificationNavigation() {
  if (document.querySelector('[data-view="notifications"]')) {
    return;
  }

  const historyButton = document.querySelector(
    '[data-view="history"]'
  );

  const dashboardButton = document.querySelector(
    '[data-view="dashboard"]'
  );

  const reference = historyButton || dashboardButton;

  if (!reference || !reference.parentElement) {
    return;
  }

  const button = document.createElement("button");

  button.type = "button";
  button.className = reference.className;
  button.dataset.view = "notifications";

  button.innerHTML = `
    <span>🔔</span>
    <span>Notifications</span>
  `;

  reference.parentElement.appendChild(button);

  setupNavigation();
}

/* =============================================
   REAL-TIME NOTIFICATION SUBSCRIPTION
   ============================================= */

async function subscribeToNotifications() {
  if (!currentUser || !supabase) return;

  if (notificationChannel) {
    await supabase.removeChannel(notificationChannel);
    notificationChannel = null;
  }

  notificationChannel = supabase
    .channel(`classreserve-notifications-${currentUser.id}`)
    .on(
      "postgres_changes",
      {
        event: "*",
        schema: "public",
        table: "reservation_notifications",
        filter: `user_id=eq.${currentUser.id}`
      },
      async () => {
        await updateNotificationBell();

        if (currentView === "notifications") {
          await navigate("notifications");
        }
      }
    )
    .subscribe();
}

/* =============================================
   UPDATE USER INFORMATION
   ============================================= */

function updateUserInterface() {
  if (!currentUser) return;

  const username =
    currentProfile?.username ||
    currentProfile?.full_name ||
    currentUser.email ||
    "User";

  const userRole = currentProfile?.role || "Student";

  if ($("welcome-message")) {
    $("welcome-message").textContent =
      `Welcome, ${username}! (${userRole})`;
  }

  document.querySelectorAll("[data-admin-only]").forEach(
    (element) => {
      element.style.display = isAdmin() ? "" : "none";
    }
  );

  document.querySelectorAll("[data-user-only]").forEach(
    (element) => {
      element.style.display = isAdmin() ? "none" : "";
    }
  );
}

/* =============================================
   INITIALIZE USER SESSION
   ============================================= */

async function initializeSession() {
  const {
    data: { session },
    error
  } = await supabase.auth.getSession();

  if (error) {
    throw error;
  }

  if (!session?.user) {
    currentUser = null;
    currentProfile = null;

    if (notificationChannel) {
      await supabase.removeChannel(notificationChannel);
      notificationChannel = null;
    }

    showLogin();
    return;
  }

  currentUser = session.user;

  await loadProfile();

  updateUserInterface();

  showDashboard();

  ensureNotificationBell();
  ensureNotificationNavigation();

  setupNavigation();

  await navigate("dashboard");

  await updateNotificationBell();

  await subscribeToNotifications();
}

/* =============================================
   LOGIN
   ============================================= */

async function handleLogin(event) {
  event.preventDefault();

  loginError("");

  const email = $("email")?.value.trim();
  const password = $("password")?.value;

  if (!email || !password) {
    loginError("Please enter your email and password.");
    return;
  }

  const button = event.submitter;

  if (button) {
    button.disabled = true;
    button.textContent = "Logging in...";
  }

  try {
    const { data, error } =
      await supabase.auth.signInWithPassword({
        email,
        password
      });

    if (error) throw error;

    if (!data.user) {
      throw new Error("Unable to sign in.");
    }

    await initializeSession();

  } catch (error) {
    console.error("Login error:", error);

    loginError(
      error.message || "Login failed. Please try again."
    );

  } finally {
    if (button) {
      button.disabled = false;
      button.textContent = "Login";
    }
  }
}

/* =============================================
   LOGOUT
   ============================================= */

async function handleLogout() {
  const confirmed = confirm(
    "Are you sure you want to log out?"
  );

  if (!confirmed) return;

  try {
    if (notificationChannel) {
      await supabase.removeChannel(notificationChannel);
      notificationChannel = null;
    }

    const { error } = await supabase.auth.signOut();

    if (error) throw error;

    currentUser = null;
    currentProfile = null;
    currentView = "dashboard";

    navigationRequestId++;

    document.getElementById(
      "reservation-details-overlay"
    )?.remove();

    if ($("notification-count")) {
      $("notification-count").style.display = "none";
    }

    if ($("dashboard-content")) {
      $("dashboard-content").innerHTML = "";
    }

    if ($("login-form")) {
      $("login-form").reset();
    }

    loginError("");
    message("");

    showLogin();

  } catch (error) {
    console.error("Logout error:", error);

    message(
      error.message || "Unable to log out.",
      true
    );
  }
}

/* =============================================
   PASSWORD RESET
   ============================================= */

async function handlePasswordReset(event) {
  event?.preventDefault();

  const email = $("email")?.value.trim();

  if (!email) {
    loginError(
      "Enter your email address first to reset your password."
    );
    return;
  }

  try {
    const { error } =
      await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin
      });

    if (error) throw error;

    loginError(
      "If the email is registered, a password reset link will be sent."
    );

  } catch (error) {
    loginError(
      error.message || "Unable to send password reset email."
    );
  }
}

/* =============================================
   AUTHENTICATION STATE CHANGES
   ============================================= */

function setupAuthListener() {
  supabase.auth.onAuthStateChange((event) => {
    if (event === "SIGNED_OUT") {
      currentUser = null;
      currentProfile = null;
      currentView = "dashboard";

      navigationRequestId++;

      if (notificationChannel) {
        const channel = notificationChannel;
        notificationChannel = null;

        Promise.resolve().then(() => {
          supabase.removeChannel(channel).catch(console.error);
        });
      }

      showLogin();
    }
  });
}

/* =============================================
   APPLICATION SETUP
   ============================================= */

async function setup() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error(
      "Missing Supabase configuration. Check supabase-config.js."
    );

    loginError(
      "Supabase configuration is missing. Contact the administrator."
    );

    showLogin();
    return;
  }

  supabase = createClient(
    SUPABASE_URL,
    SUPABASE_KEY
  );

  $("login-form")?.addEventListener(
    "submit",
    handleLogin
  );

  $("logout-button")?.addEventListener(
    "click",
    handleLogout
  );

  const resetButton =
    $("forgot-password") ||
    $("forgot-password-button") ||
    $("reset-password-button");

  resetButton?.addEventListener(
    "click",
    handlePasswordReset
  );

  setupNavigation();

  setupAuthListener();

  try {
    await initializeSession();
  } catch (error) {
    console.error(
      "Initialization error:",
      error
    );

    loginError(
      error.message || "Unable to initialize ClassReserve."
    );

    showLogin();
  }
}

/* =============================================
   START CLASSRESERVE
   ============================================= */

if (document.readyState === "loading") {
  document.addEventListener(
    "DOMContentLoaded",
    setup,
    { once: true }
  );
} else {
  setup();
}

/* =============================================
   END OF CLASSRESERVE SCRIPT.JS
*/
