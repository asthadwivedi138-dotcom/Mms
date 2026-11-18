// Toast notifications (existing alert messages are displayed as toasts)
function showToast(message, type = "success") {
  let toast = document.getElementById("appToast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "appToast";
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
    document.body.appendChild(toast);
  }
  toast.textContent = String(message);
  toast.className = type;
  requestAnimationFrame(() => toast.classList.add("show"));
  clearTimeout(window.__appToastTimer);
  window.__appToastTimer = setTimeout(() => toast.classList.remove("show"), 3200);
}
window.alert = function(message) {
  const msg = String(message || "");
  showToast(msg, /error|failed|invalid|please fill|not found/i.test(msg) ? "error" : "success");
};

// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyCwGB3HYm85BuXf1JSjYgEJ0wlofDevOO0",
  authDomain: "school-management-system-6df41.firebaseapp.com",
  projectId: "school-management-system-6df41",
  storageBucket: "school-management-system-6df41.firebasestorage.app",
  messagingSenderId: "181814315451",
  appId: "1:181814315451:web:2d3e85d57249eaa3d61c9e",
  measurementId: "G-10R33K209Z"
};

// Start Firebase
firebase.initializeApp(firebaseConfig);

const db = firebase.firestore();
const auth = firebase.auth();

auth.onAuthStateChanged(function(user) {
  const loginScreen = document.getElementById("loginScreen");
  const appShell = document.getElementById("appShell");
  if (user) {
    loginScreen.style.display = "none";
    appShell.style.display = "block";
    const avatar = document.getElementById("adminAvatar");
    if (avatar) avatar.textContent = (user.email || "A").charAt(0).toUpperCase();
    loadStudents();
    loadTeachers();
    loadResults();
    loadfees();
    loadClasses();
  } else {
    appShell.style.display = "none";
    loginScreen.style.display = "flex";
  } 
});

document.getElementById("loginForm").addEventListener("submit", async function(e) {
  e.preventDefault();
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;
  const button = document.getElementById("loginButton");
  const errorBox = document.getElementById("loginError");
  errorBox.textContent = "";
  button.disabled = true;
  button.textContent = "Signing in...";
  try {
    await auth.signInWithEmailAndPassword(email, password);
  } catch (error) {
    console.error("Login error:", error);
    const messages = {
      "auth/invalid-email": "Please enter a valid email address.",
      "auth/user-not-found": "No admin account found with this email.",
      "auth/wrong-password": "Incorrect password. Please try again.",
      "auth/invalid-credential": "Incorrect email or password.",
      "auth/too-many-requests": "Too many attempts. Please try again later.",
      "auth/network-request-failed": "Network error. Check your internet connection."
    };
    errorBox.textContent = messages[error.code] || error.message || "Login failed. Please try again.";
  } finally {
    button.disabled = false;
    button.textContent = "Login to Dashboard";
  }
});

document.getElementById("logoutButton").addEventListener("click", async function() {
  try { await auth.signOut(); }
  catch (error) { console.error("Logout error:", error); showToast("Unable to logout. Please try again.", "error"); }
});



// =========================
// SECTION NAVIGATION
// =========================

function showSection(sectionName) {

  document.querySelectorAll(".section").forEach(function(section) {
    section.classList.remove("active-section");
  });

  const selected = document.getElementById(sectionName);

  if (selected) {
    selected.classList.add("active-section");
  }

  document.querySelectorAll(".sidebar nav a").forEach(function(link) {
    link.classList.remove("active");
  });
}


// =========================
// STUDENT MODAL
// =========================

function openStudentForm() {
  document.getElementById("studentModal").style.display = "flex";
}

function closeStudentForm() {
  document.getElementById("studentModal").style.display = "none";
}


// =========================
// ADD STUDENT
// =========================

document.getElementById("studentForm").addEventListener("submit", async function(e) {

  e.preventDefault();

  const name = document.getElementById("name").value.trim();
  const studentClass = document.getElementById("studentClass").value.trim();
  const roll = document.getElementById("studentRoll").value.trim();
  const phone = document.getElementById("studentPhone").value.trim();

  if (!name || !studentClass || !roll || !phone) {
    alert("Please fill all fields");
    return;
  }

  try {

    await db.collection("students").add({
      name: name,
      class: studentClass,
      roll: roll,
      phone: phone,
      createdAt: new Date()
    });

    alert("Student added successfully!");

    document.getElementById("studentForm").reset();

    closeStudentForm();

    loadStudents();

  } catch (error) {

    console.error(error);
    alert("Firebase Error: " + error.message);

  }

});


// =========================
// LOAD STUDENTS
// =========================


// Dashboard charts
let __studentsClassChart = null;
let __schoolOverviewChart = null;
let __dashboardStudentTotal = 0;
let __dashboardTeacherTotal = 0;

function updateDashboardCharts(classLabels = [], classValues = []) {
  if (typeof Chart === "undefined") return;
  const classCanvas = document.getElementById("studentsClassChart");
  if (classCanvas) {
    if (__studentsClassChart) __studentsClassChart.destroy();
    __studentsClassChart = new Chart(classCanvas, {
      type: "bar",
      data: { labels: classLabels.length ? classLabels : ["No data"], datasets: [{ label: "Students", data: classValues.length ? classValues : [0], backgroundColor: "#60a5fa", borderRadius: 7, maxBarThickness: 48 }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { precision: 0 } } } }
    });
  }
  const overviewCanvas = document.getElementById("schoolOverviewChart");
  if (overviewCanvas) {
    if (__schoolOverviewChart) __schoolOverviewChart.destroy();
    __schoolOverviewChart = new Chart(overviewCanvas, {
      type: "doughnut",
      data: { labels: ["Students", "Teachers", "Classes"], datasets: [{ data: [__dashboardStudentTotal, __dashboardTeacherTotal, 6], backgroundColor: ["#3b82f6", "#10b981", "#f59e0b"], borderWidth: 2, borderColor: "#ffffff" }] },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: "bottom" } }, cutout: "62%" }
    });
  }
}

async function loadStudents() {

  try {

    const snapshot = await db.collection("students").get();

    const table = document.getElementById("studentTable");
    const recent = document.getElementById("recentStudents");
    const count = document.getElementById("studentCount");

    table.innerHTML = "";
    recent.innerHTML = "";

    let total = 0;
    const __classCounts = {};

    snapshot.forEach(function(student) {

      total++;

      const data = student.data();
      const __className = data.class || "Not specified";
      __classCounts[__className] = (__classCounts[__className] || 0) + 1;

      // Student table
      table.innerHTML += `
        <tr>
          <td>${data.name || "-"}</td>
          <td>${data.class || "-"}</td>
          <td>${data.roll || "-"}</td>
          <td>${data.phone || "-"}</td>
          <td>
            <button onclick="deleteStudent('${student.id}')">
              🗑️
            </button>
          </td>
        </tr>
      `;

      // Recent students
      recent.innerHTML += `
        <tr>
          <td>${data.name || "-"}</td>
          <td>${data.class || "-"}</td>
          <td>${data.roll || "-"}</td>
        </tr>
      `;

    });

    if (total === 0) {

      table.innerHTML = `
        <tr>
          <td colspan="5">No students available</td>
        </tr>
      `;

      recent.innerHTML = `
        <tr>
          <td colspan="3">No students added yet</td>
        </tr>
      `;

    }

    count.textContent = total;
    __dashboardStudentTotal = total;
    updateDashboardCharts(Object.keys(__classCounts), Object.values(__classCounts));

  } catch (error) {

    console.error("Load Error:", error);

  }

}


// =========================
// DELETE STUDENT
// =========================

async function deleteStudent(id) {

  if (!confirm("Delete this student?")) {
    return;
  }

  try {

    await db.collection("students").doc(id).delete();

    alert("Student deleted successfully!");

    loadStudents();

  } catch (error) {

    alert("Delete Error: " + error.message);

  }

}


// =========================
// SEARCH STUDENTS
// =========================

function searchStudents() {

  const search =
    document.getElementById("studentSearch").value.toLowerCase();

  document.querySelectorAll("#studentTable tr").forEach(function(row) {

    row.style.display =
      row.innerText.toLowerCase().includes(search)
      ? ""
      : "none";

  });

}


// =========================
// START
// =========================

// Students load after authenticated admin sign-in.
// =========================
// TEACHER
// =========================

function openTeacherForm() {
  document.getElementById("teacherModal").style.display = "flex";
}

function closeTeacherForm() {
  document.getElementById("teacherModal").style.display = "none";
}


// Add Teacher
document.getElementById("teacherForm").addEventListener("submit", async function(e) {

  e.preventDefault();

  const name = document.getElementById("teacherName").value.trim();
  const subject = document.getElementById("teacherSubject").value.trim();
  const teacherClass = document.getElementById("teacherClass").value.trim();
  const phone = document.getElementById("teacherPhone").value.trim();

  try {

    await db.collection("teachers").add({
      name: name,
      subject: subject,
      class: teacherClass,
      phone: phone,
      createdAt: new Date()
    });

    alert("Teacher added successfully!");

    document.getElementById("teacherForm").reset();

    closeTeacherForm();

    loadTeachers();

  } catch (error) {

    console.error(error);

    alert("Teacher Error: " + error.message);

  }

});


// Load Teachers
async function loadTeachers() {

  const table = document.getElementById("teacherTable");

  if (!table) return;

  try {

    const snapshot = await db.collection("teachers").get();
    __dashboardTeacherTotal = snapshot.size;
    const __teacherCount = document.getElementById("teacherCount");
    if (__teacherCount) __teacherCount.textContent = snapshot.size;
    updateDashboardCharts();

    table.innerHTML = "";

    if (snapshot.empty) {

      table.innerHTML = `
        <tr>
          <td colspan="4">No teachers available</td>
        </tr>
      `;

      return;
    }

    snapshot.forEach(function(teacherDoc) {

      const data = teacherDoc.data();

      table.innerHTML += `
        <tr>
          <td>${data.name || "-"}</td>
          <td>${data.subject || "-"}</td>
          <td>${data.class || "-"}</td>
          <td>${data.phone || "-"}</td>
          <td>
  <button class="delete-btn"
    onclick="deleteTeacher('${teacherDoc.id}')">
    Delete
  </button>
</td>
        </tr>
      `;

    });

  } catch (error) {

    console.error("Teacher Load Error:", error);

  }

}


// Teachers load after authenticated admin sign-in.
// ================= RESULTS =================

async function loadResults() {
    const tableBody = document.getElementById("resultsTableBody");

    if (!tableBody) return;

    tableBody.innerHTML = `
        <tr>
            <td colspan="6" class="empty-state">Loading results...</td>
        </tr>
    `;

    try {
        const snapshot = await db.collection("results").get();

        if (snapshot.empty) {
            tableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="empty-state">No results found</td>
                </tr>
            `;
            return;
        }

        tableBody.innerHTML = "";

        snapshot.forEach(doc => {
            const data = doc.data();

            tableBody.innerHTML += `
                <tr>
                    <td>${data.studentId || "-"}</td>
                    <td>${data.studentName || "-"}</td>
                    <td>${data.subject || "-"}</td>
                    <td>${data.marks || "0"}</td>
                    <td>${data.grade || "-"}</td>
                    <td>
                        <button class="btn btn-sm btn-primary"
                            onclick="editResult('${doc.id}')">
                            Edit
                        </button>

                        <button class="btn btn-sm btn-danger"
                            onclick="deleteResult('${doc.id}')">
                            Delete
                        </button>
                    </td>
                </tr>
            `;
        });

    } catch (error) {
        console.error("Error loading results:", error);

        tableBody.innerHTML = `
            <tr>
                <td colspan="6" class="empty-state">
                    Failed to load results
                </td>
            </tr>
        `;
    }
}


// DELETE RESULT
async function deleteResult(id) {
    if (!confirm("Are you sure you want to delete this result?")) return;

    try {
        await db.collection("results").doc(id).delete();

        alert("Result deleted successfully!");
        loadResults();

    } catch (error) {
        console.error(error);
        alert("Failed to delete result.");
    }
}


// EDIT RESULT
async function editResult(id) {
    const doc = await db.collection("results").doc(id).get();

    if (!doc.exists) {
        alert("Result not found!");
        return;
    }

    const data = doc.data();

    const studentName = prompt("Student Name:", data.studentName || "");
    if (studentName === null) return;

    const subject = prompt("Subject:", data.subject || "");
    if (subject === null) return;

    const marks = prompt("Marks:", data.marks || "");
    if (marks === null) return;

    const grade = prompt("Grade:", data.grade || "");
    if (grade === null) return;

    await db.collection("results").doc(id).update({
        studentName: studentName,
        subject: subject,
        marks: marks,
        grade: grade
    });

    alert("Result updated successfully!");

    loadResults();
}


// Results load after authenticated admin sign-in.
document.getElementById("resultForm").addEventListener("submit", async function(e) {
    e.preventDefault();

    const studentId = document.getElementById("studentId").value;
    const studentName = document.getElementById("studentName").value;
    const subject = document.getElementById("subject").value;
    const marks = document.getElementById("marks").value;
    const grade = document.getElementById("grade").value;

    try {
        await db.collection("results").add({
            studentId: studentId,
            studentName: studentName,
            subject: subject,
            marks: marks,
            grade: grade,
            createdAt: new Date()
        });

        alert("Result added successfully!");

        document.getElementById("resultForm").reset();

        closeResultsModal();

        loadResults();

    } catch (error) {
        console.error(error);
        alert("Error: " + error.message);
    }
});
function openResultsModal() {
    document.getElementById("resultsModal").style.display = "flex";
}

function closeResultsModal() {
    document.getElementById("resultsModal").style.display = "none";
}
function openResultsModal() {
    document.getElementById("resultsModal").style.display = "flex";
}

function closeResultsModal() {
    document.getElementById("resultsModal").style.display = "none";
}
window.addEventListener("load", function () {
    setTimeout(function () {
        const loader = document.getElementById("pageLoader");

        if (loader) {
            loader.classList.add("hide");

            setTimeout(function () {
                loader.remove();
            }, 500);
        }
    }, 900);
});
// Delete Teacher
async function deleteTeacher(id) {
  if (!confirm("Are you sure you want to delete this teacher?")) {
    return;
  }

  try {
    await db.collection("teachers").doc(id).delete();

    showToast("Teacher deleted successfully!");
    loadTeachers();

  } catch (error) {
    console.error("Delete Teacher Error:", error);
    showToast("Unable to delete teacher!");
  }
}
let attendanceStudents = [];
let attendanceStatus = {};

async function loadAttendance() {
  const date = document.getElementById("attendanceDate").value;
  const tbody = document.getElementById("attendanceTableBody");

  if (!date) {
    alert("Select date");
    return;
  }

  try {
    const snapshot = await db.collection("students").get();

    attendanceStudents = [];

    snapshot.forEach(doc => {
      attendanceStudents.push({
        id: doc.id,
        ...doc.data()
      });
    });

    const saved = await db.collection("attendance")
      .where("date", "==", date).get();

    attendanceStatus = {};

    saved.forEach(doc => {
      const data = doc.data();
      attendanceStatus[data.studentDocId] = data.status;
    });

    tbody.innerHTML = "";

    attendanceStudents.forEach(student => {
      const status = attendanceStatus[student.id] || "";

      tbody.innerHTML += `
        <tr>
          <td>${student.name || ""}</td>
          <td>${student.class || ""}</td>
          <td>${student.roll || ""}</td>
          <td>
            <select onchange="attendanceStatus['${student.id}']=this.value">
              <option value="">Select</option>
              <option value="Present" ${status === "Present" ? "selected" : ""}>Present</option>
              <option value="Absent" ${status === "Absent" ? "selected" : ""}>Absent</option>
            </select>
          </td>
        </tr>`;
    });

  } catch (error) {
    console.error(error);
    alert(error.message);
  }
}

async function saveAttendance() {
  const date = document.getElementById("attendanceDate").value;

  if (!date || attendanceStudents.length === 0) {
    alert("Load students first");
    return;
  }

  if (attendanceStudents.some(s => !attendanceStatus[s.id])) {
    alert("Select Present or Absent for every student");
    return;
  }

  try {
    const batch = db.batch();

    attendanceStudents.forEach(student => {
      const ref = db.collection("attendance")
        .doc(date + "_" + student.id);

      batch.set(ref, {
        date: date,
        studentDocId: student.id,
        studentName: student.name || "",
        studentClass: student.class || "",
        roll: student.roll || "",
        status: attendanceStatus[student.id]
      });
    });

    await batch.commit();
    alert("Attendance saved successfully!");

  } catch (error) {
    alert(error.message);
  }
}
// OPEN FEE MODAL
function openFeeModal() {
    document.getElementById("feeModal").style.display = "flex";
}

// CLOSE FEE MODAL
function closeFeeModal() {
    document.getElementById("feeModal").style.display = "none";
}

// SAVE FEE
async function saveFee() {

    const student = document.getElementById("feeStudent").value.trim();
    const studentClass = document.getElementById("feeClass").value.trim();
    const roll = document.getElementById("feeRoll").value.trim();
    const amount = Number(document.getElementById("feeAmount").value);
    const status = document.getElementById("feeStatus").value;

    if (!student || !studentClass || !roll || !amount || amount <= 0) {
        alert("Please fill all fields correctly!");
        return;
    }

    try {
        await db.collection("fees").add({
            student: student,
            studentClass: studentClass,
            roll: roll,
            amount: amount,
            status: status,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        alert("Fees saved successfully!");

        closeFeeModal();

        document.getElementById("feeStudent").value = "";
        document.getElementById("feeClass").value = "";
        document.getElementById("feeRoll").value = "";
        document.getElementById("feeAmount").value = "";

        loadFees();

    } catch(error) {
        console.error(error);
        alert(error.message);
    }
}

// LOAD FEES
async function loadFees() {

    const tbody = document.getElementById("feesTableBody");

    try {
        const snapshot = await db.collection("fees").get();

        tbody.innerHTML = "";

        snapshot.forEach(doc => {
            const fee = doc.data();

            tbody.innerHTML += `
                <tr>
                    <td>${fee.student}</td>
                    <td>${fee.studentClass}</td>
                    <td>₹${fee.amount}</td>
                    <td>${fee.status}</td>
                    <td>
                        <button onclick="deleteFee('${doc.id}')">
                            Delete
                        </button>
                    </td>
                </tr>
            `;
        });

    } catch(error) {
        console.error(error);
        alert(error.message);
    }
    updateFeeSummary();
}

// DELETE FEE
async function deleteFee(id) {

    if (!confirm("Delete this fee record?")) return;

    try {
        await db.collection("fees").doc(id).delete();

        alert("Fee deleted successfully!");
        loadFees();

    } catch(error) {
        alert(error.message);
    }
}
async function updateFeeSummary() {
    try {
        const snapshot = await db.collection("fees").get();

        let totalCollected = 0;
        let pendingFees = 0;

        snapshot.forEach(doc => {
            const fee = doc.data();

            if (fee.status === "Paid") {
                totalCollected += Number(fee.amount) || 0;
            } else {
                pendingFees += Number(fee.amount) || 0;
            }
        });

        document.getElementById("totalCollected").textContent =
            "₹" + totalCollected;

        document.getElementById("pendingFees").textContent =
            "₹" + pendingFees;

    } catch (error) {
        console.log(error);
    }
}
function openClassForm() {
    const modal = document.getElementById("classModal");

    if (modal) {
        modal.style.display = "flex";
    }
}

function closeClassForm() {
    const modal = document.getElementById("classModal");

    if (modal) {
        modal.style.display = "none";
    }
}
// SAVE CLASS TO FIREBASE
document.getElementById("classForm").addEventListener("submit", async function(e) {
    e.preventDefault();

    const className = document.getElementById("className").value.trim();
    const section = document.getElementById("classSection").value.trim();
    const teacher = document.getElementById("classTeacher").value.trim();

    if (!className || !section || !teacher) {
        alert("Please fill all fields!");
        return;
    }

    try {
        await db.collection("classes").add({
            className: className,
            section: section,
            teacher: teacher,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        alert("Class saved successfully!");
        await loadClasses();

        document.getElementById("classForm").reset();
        closeClassForm();

    } catch (error) {
        console.error(error);
        alert("Error saving class: " + error.message);
    }
});
// LOAD CLASSES FROM FIREBASE
async function loadClasses() {
    const grid = document.querySelector(".class-grid");

    try {
        const snapshot = await db.collection("classes").get();

        grid.innerHTML = "";

        if (snapshot.empty) {
            grid.innerHTML = "<p>No classes added yet.</p>";
            return;
        }

        snapshot.forEach(doc => {
            const data = doc.data();

            const card = document.createElement("div");
            card.className = "class-card";

            const heading = document.createElement("h3");
            heading.textContent = data.className;

            const section = document.createElement("p");
            section.textContent = "Section: " + data.section;

            const teacher = document.createElement("p");
            teacher.textContent = "Teacher: " + data.teacher;

            card.append(heading, section, teacher);
            grid.appendChild(card);
        });

    } catch (error) {
        console.error("Class loading error:", error);
        alert(error.message);
    }
}
async function deleteClass(id) {
    if (!confirm("Delete this class?")) return;

    try {
        await db.collection("classes").doc(id).delete();
        alert("Class deleted successfully!");
        loadClasses();
    } catch (error) {
        alert(error.message);
    }
}