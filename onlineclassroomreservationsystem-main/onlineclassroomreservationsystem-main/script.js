document.addEventListener("DOMContentLoaded", function () {
    const loginSection = document.getElementById("login-section");
    const dashboardSection = document.getElementById("dashboard-section");
    const loginForm = document.getElementById("login-form");
    const loginError = document.getElementById("login-error");
    const dashboardTitle = document.getElementById("dashboard-title");
    const welcomeMessage = document.getElementById("welcome-message");
    const dashboardContent = document.getElementById("dashboard-content");
    const logoutButton = document.getElementById("logout-button");
    let currentUser = null;
    // DEMO ACCOUNTS
    const accounts = [
        {
            username: "Paguio",
            password: "Student",
            name: "Paguio",
            role: "Student"
        },
        {
            username: "Bhonz",
            password: "Faculty",
            name: "Bhonz",
            role: "Faculty"
        },
        {
            username: "Admin",
            password: "admin",
            name: "Administrator",
            role: "Admin"
        }
    ];
    // LOGIN
    loginForm.addEventListener("submit", function (event) {
        event.preventDefault();
        const username = document.getElementById("username").value.trim();
        const password = document.getElementById("password").value;
        const account = accounts.find(function (user) {
            return user.username === username &&
                   user.password === password;
        });
        if (!account) {
            loginError.textContent = "Incorrect username or password.";
            loginError.hidden = false;
            return;
        }
        loginError.hidden = true;
        currentUser = account;
        showDashboard();
    });
    // OPEN THE CORRECT DASHBOARD
    function showDashboard() {
        loginSection.hidden = true;
        dashboardSection.hidden = false;
        dashboardTitle.textContent = currentUser.role + " Dashboard";
        welcomeMessage.textContent =
            "Welcome, " + currentUser.name + "! You are logged in as " +
            currentUser.role + ".";
        renderView("dashboard");
    }
    // LOGOUT
    logoutButton.addEventListener("click", function () {
        currentUser = null;
        loginForm.reset();
        loginError.hidden = true;
        dashboardSection.hidden = true;
        loginSection.hidden = false;
    });
    // NAVIGATION
    document.querySelectorAll("[data-view]").forEach(function (button) {
        button.addEventListener("click", function () {
            renderView(button.dataset.view);
        });
    });
    // DISPLAY DASHBOARD CONTENT
    function renderView(view) {
        if (!currentUser) return;
        if (view === "dashboard") {
            dashboardContent.innerHTML = `
                <h3>Welcome to ClassReserve!</h3>
                <p>Use the menu to browse classrooms and manage reservations.</p>
                <p><strong>Account type:</strong> ${escapeHTML(currentUser.role)}</p>
            `;
        }
        if (view === "rooms") {
            dashboardContent.innerHTML = `
                <h3>Available Classrooms</h3>
                <p>Select a classroom to request a reservation.</p>
                <div class="room-card">
                    <h4>Classroom 101</h4>
                    <p>Capacity: 30 people</p>
                    <p>Main Building</p>
                    <button data-book-room="Classroom 101" type="button">
                        Request Reservation
                    </button>
                </div>
                <div class="room-card">
                    <h4>Classroom 102</h4>
                    <p>Capacity: 40 people</p>
                    <p>Main Building</p>
                    <button data-book-room="Classroom 102" type="button">
                        Request Reservation
                    </button>
                </div>
                <div class="room-card">
                    <h4>Computer Laboratory</h4>
                    <p>Capacity: 35 people</p>
                    <p>Technology Building</p>
                    <button data-book-room="Computer Laboratory" type="button">
                        Request Reservation
                    </button>
                </div>
            `;
            dashboardContent.querySelectorAll("[data-book-room]").forEach(function (button) {
                button.addEventListener("click", function () {
                    createReservation(button.dataset.bookRoom);
                });
            });
        }
        if (view === "reservations") {
            const reservations = getReservations();
            if (reservations.length === 0) {
                dashboardContent.innerHTML = `
                    <h3>Reservations</h3>
                    <p>You have no reservation requests yet.</p>
                `;
                return;
            }
            const rows = reservations.map(function (reservation) {
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
                <h3>Reservations</h3>
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
                        <tbody>${rows}</tbody>
                    </table>
                </div>
            `;
        }
    }
    // GET RESERVATIONS FOR THE LOGGED-IN ACCOUNT
    function getReservations() {
        try {
            const allReservations = JSON.parse(
                localStorage.getItem("classReserveReservations") || "[]"
            );
            return allReservations.filter(function (reservation) {
                return reservation.username === currentUser.username;
            });
        } catch (error) {
            return [];
        }
    }
    // CREATE A RESERVATION REQUEST
    function createReservation(roomName) {
        const date = prompt("Enter reservation date (YYYY-MM-DD):");
        if (!date) return;
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
            alert("Please use YYYY-MM-DD format.");
            return;
        }
        const time = prompt("Enter reservation time (example: 9:00 AM - 11:00 AM):");
        if (!time || !time.trim()) return;
        let reservations;
        try {
            reservations = JSON.parse(
                localStorage.getItem("classReserveReservations") || "[]"
            );
        } catch (error) {
            reservations = [];
        }
        reservations.push({
            id: Date.now(),
            username: currentUser.username,
            room: roomName,
            date: date,
            time: time.trim(),
            status: "Pending"
        });
        localStorage.setItem(
            "classReserveReservations",
            JSON.stringify(reservations)
        );
        alert("Reservation request submitted! Status: Pending.");
        renderView("reservations");
    }
    // SAFELY DISPLAY TEXT
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
    // INITIAL SCREEN
    loginSection.hidden = false;
    dashboardSection.hidden = true;
});
