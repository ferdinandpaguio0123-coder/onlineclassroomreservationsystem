// ========================================
// ClassReserve
// Online Classroom Reservation System
// ========================================
document.addEventListener("DOMContentLoaded", function () {
    const loginSection = document.getElementById("login-section");
    const dashboardSection = document.getElementById("dashboard-section");
    const loginForm = document.getElementById("login-form");
    const dashboardTitle = document.getElementById("dashboard-title");
    const welcomeMessage = document.getElementById("welcome-message");
    const dashboardContent = document.getElementById("dashboard-content");
    const logoutButton = document.getElementById("logout-button");
    const navigationButtons = document.querySelectorAll("[data-view]");
    let currentUser = null;
    // Show the login form
    function showLogin() {
        loginSection.hidden = false;
        dashboardSection.hidden = true;
        currentUser = null;
    }
    // Show the dashboard
    function showDashboard() {
        loginSection.hidden = true;
        dashboardSection.hidden = false;
        dashboardTitle.textContent =
            currentUser.role.charAt(0).toUpperCase() +
            currentUser.role.slice(1) +
            " Dashboard";
        welcomeMessage.textContent =
            "Welcome, " + currentUser.name + "!";
            
        renderView("dashboard");
    }
    // Handle demo login
    loginForm.addEventListener("submit", function (event) {
        event.preventDefault();
        const role = document.getElementById("role").value;
        const name = document.getElementById("name").value.trim();
        const email = document.getElementById("email").value.trim();
        if (!name || !email) {
            alert("Please enter your name and school email.");
            return;
        }
        currentUser = {
            role: role,
            name: name,
            email: email
        };
        showDashboard();
    });
    // Dashboard navigation
    navigationButtons.forEach(function (button) {
        button.addEventListener("click", function () {
            renderView(button.dataset.view);
        });
    });
    // Display dashboard pages
    function renderView(view) {
        if (view === "dashboard") {
            dashboardContent.innerHTML = `
                <h3>Welcome to ClassReserve!</h3>
                <p>Manage your classroom reservations in one place.</p>
                <div class="dashboard-cards">
                    <div class="info-card">
                        <h4>Classrooms</h4>
                        <p>Browse available classrooms.</p>
                        <button type="button" data-action="rooms">
                            View Classrooms
                        </button>
                    </div>
                    <div class="info-card">
                        <h4>Reservations</h4>
                        <p>Review your reservation requests.</p>
                        <button type="button" data-action="reservations">
                            View Reservations
                        </button>
                    </div>
                </div>
            `;
        } else if (view === "rooms") {
            dashboardContent.innerHTML = `
                <h3>Available Classrooms</h3>
                <p>Choose a classroom to request a reservation.</p>
                <div class="room-list">
                    <div class="room-card">
                        <h4>Classroom 101</h4>
                        <p>Capacity: 30 people</p>
                        <p>Location: Main Building</p>
                        <button type="button" data-book-room="Classroom 101">
                            Request Reservation
                        </button>
                    </div>
                    <div class="room-card">
                        <h4>Classroom 102</h4>
                        <p>Capacity: 40 people</p>
                        <p>Location: Main Building</p>
                        <button type="button" data-book-room="Classroom 102">
                            Request Reservation
                        </button>
                    </div>
                    <div class="room-card">
                        <h4>Computer Laboratory</h4>
                        <p>Capacity: 35 people</p>
                        <p>Location: Technology Building</p>
                        <button type="button" data-book-room="Computer Laboratory">
                            Request Reservation
                        </button>
                    </div>
                </div>
            `;
        } else if (view === "reservations") {
            const reservations = getReservations();
            if (reservations.length === 0) {
                dashboardContent.innerHTML = `
                    <h3>My Reservations</h3>
                    <p>You do not have any reservation requests yet.</p>
                `;
            } else {
                const reservationRows = reservations.map(function (reservation) {
                    return `
                        <tr>
                            <td>${escapeHTML(reservation.room)}</td>
                            <td>${escapeHTML(reservation.date)}</td>
                            <td>${escapeHTML(reservation.time)}</td>
                            <td>${escapeHTML(reservation.status)}</td>
                        </tr>
                    `;
                }).join("");
                dashboardContent.innerHTML = `
                    <h3>My Reservations</h3>
                    <div class="table-container">
                        <table>
                            <thead>
                                <tr>
                                    <th>Classroom</th>
                                    <th>Date</th>
                                    <th>Time</th>
                                    <th>Status</th>
                                </tr>
                            </thead>
                            <tbody>${reservationRows}</tbody>
                        </table>
                    </div>
                `;
            }
        }
        // Attach events to buttons created in the dashboard
        const actionButtons = dashboardContent.querySelectorAll("[data-action]");
        actionButtons.forEach(function (button) {
            button.addEventListener("click", function () {
                renderView(button.dataset.action);
            });
        });
        const bookingButtons = dashboardContent.querySelectorAll("[data-book-room]");
        bookingButtons.forEach(function (button) {
            button.addEventListener("click", function () {
                createReservation(button.dataset.bookRoom);
            });
        });
    }
    // Get saved demo reservations for the current user
    function getReservations() {
        if (!currentUser) {
            return [];
        }
        try {
            const allReservations = JSON.parse(
                localStorage.getItem("classReserveReservations") || "[]"
            );
            return allReservations.filter(function (reservation) {
                return reservation.email === currentUser.email;
            });
        } catch (error) {
            return [];
        }
    }
    // Request a classroom reservation
    function createReservation(roomName) {
        const date = prompt("Enter the reservation date (YYYY-MM-DD):");
        if (!date) {
            return;
        }
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            alert("Please enter the date in YYYY-MM-DD format.");
            return;
        }
        const time = prompt(
            "Enter the reservation time (example: 9:00 AM - 11:00 AM):"
        );
        if (!time || !time.trim()) {
            return;
        }
        const allReservations = JSON.parse(
            localStorage.getItem("classReserveReservations") || "[]"
        );
        allReservations.push({
            id: Date.now(),
            room: roomName,
            date: date,
            time: time.trim(),
            status: "Pending",
            name: currentUser.name,
            email: currentUser.email
        });
        localStorage.setItem(
            "classReserveReservations",
            JSON.stringify(allReservations)
        );
        alert("Your reservation request has been saved as Pending.");
        renderView("reservations");
    }
    // Prevent user-entered text from being interpreted as HTML
    function escapeHTML(value) {
        return String(value).replace(/[&<>"']/g, function (character) {
            const entities = {
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#39;"
            };
            return entities[character];
        });
    }
    // Sign out
    logoutButton.addEventListener("click", function () {
        showLogin();
        loginForm.reset();
    });
    // Start at the login screen
    showLogin();
});
Sent
Compose
Write to
