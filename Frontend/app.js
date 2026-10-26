const DB_KEY = "tripti_demo_db_v1";
const SESSION_KEY = "tripti_demo_session_v1";
const $ = (selector) => document.querySelector(selector);

const seed = {
  users: [],
  foods: [],
  orders: [],
  riders: []
};

function loadDB() {
  try {
    const saved = JSON.parse(localStorage.getItem(DB_KEY));
    return saved && saved.users && saved.foods && saved.orders ? saved : structuredClone(seed);
  } catch { return structuredClone(seed); }
}
let db = loadDB();
let cart = [];
let currentUser = null;

function saveDB() { localStorage.setItem(DB_KEY, JSON.stringify(db)); }
function saveSession() {
  if (currentUser) localStorage.setItem(SESSION_KEY, JSON.stringify({ id: currentUser.id }));
  else localStorage.removeItem(SESSION_KEY);
}
function escapeHTML(value = "") {
  return String(value).replace(/[&<>"']/g, ch => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[ch]));
}
function money(amount) { return `৳${Number(amount).toLocaleString("en-BD")}`; }
function roleName(role) { return ({ customer: "Customer", rider: "Rider", owner: "Restaurant Owner" })[role] || role; }
function statusClass(status) { return String(status).toLowerCase().replace(/\s+/g, "-"); }
function setNotice(message, isError = false) {
  const el = $("#notice");
  el.textContent = message;
  el.classList.toggle("error", isError);
  el.classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
}
function clearNotice() { $("#notice").classList.add("hidden"); }
function getUserById(id) { return db.users.find(user => user.id === id); }
function myOrders() {
  if (!currentUser) return [];
  if (currentUser.role === "customer") return db.orders.filter(order => order.customerId === currentUser.id);
  if (currentUser.role === "rider") return db.orders.filter(order => order.riderId === currentUser.id);
  return db.orders.filter(order => order.ownerId === currentUser.id);
}  

function getFood(id) { return db.foods.find(food => food.id === id); }

$("#register-form").elements.role.addEventListener("change", (event) => {
  $("#restaurant-name-wrap").classList.toggle("hidden", event.target.value !== "owner");
  $("#register-form").elements.restaurantName.required = event.target.value === "owner";
});

$("#register-form").addEventListener("submit", event => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const name = String(form.get("name")).trim();
  const email = String(form.get("email")).trim().toLowerCase();
  const password = String(form.get("password"));
  const role = String(form.get("role"));
  const restaurantName = String(form.get("restaurantName") || "").trim();
  if (db.users.some(user => user.email === email)) return setNotice("This email already has an account. Please log in.", true);
  const user = { id: `${role}-${Date.now()}-${Math.random().toString(16).slice(2, 7)}`, name, email, password, role, restaurantName, createdAt: new Date().toISOString() };
  db.users.push(user);
  if (role === "rider") db.riders.push({ id: user.id, name: user.name });
  saveDB();
  currentUser = user;
  saveSession();
  cart = [];
  render();
  setNotice(`Account created. Welcome, ${name}!`);
  event.currentTarget.reset();
  $("#restaurant-name-wrap").classList.add("hidden");
});

$("#login-form").addEventListener("submit", event => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const email = String(form.get("email")).trim().toLowerCase();
  const password = String(form.get("password"));
  const user = db.users.find(item => item.email === email && item.password === password);
  if (!user) return setNotice("Email or password is incorrect. Register first if you do not have an account.", true);
  currentUser = user;
  saveSession();
  cart = [];
  render();
  setNotice(`Logged in as ${roleName(user.role)}.`);
  event.currentTarget.reset();
});

$("#logout-btn").addEventListener("click", () => {
  currentUser = null; cart = []; saveSession(); render(); setNotice("You have logged out.");
});

function render() {
  $("#auth-section").classList.toggle("hidden", Boolean(currentUser));
  $("#app-section").classList.toggle("hidden", !currentUser);
  $("#logout-btn").classList.toggle("hidden", !currentUser);
  $("#session-label").textContent = currentUser ? `${currentUser.name} · ${roleName(currentUser.role)}` : "Welcome! Sign in to continue.";
  clearNotice();
  if (!currentUser) return;
  $("#role-eyebrow").textContent = `${roleName(currentUser.role).toUpperCase()} PORTAL`;
  $("#portal-title").textContent = currentUser.role === "owner" ? (currentUser.restaurantName || "Restaurant") : `${roleName(currentUser.role)} Portal`;
  $("#role-chip").textContent = roleName(currentUser.role);
  if (currentUser.role === "customer") renderCustomer();
  else if (currentUser.role === "rider") renderRider();
  else renderOwner();
}

function foodCard(food) {
  const image = food.image
    ? `<img src="${food.image}" alt="${escapeHTML(food.name)}">`
    : `<div class="food-placeholder" role="img" aria-label="Food image placeholder">🍽️</div>`;
  return `<article class="food-card">${image}<div class="food-info"><h4>${escapeHTML(food.name)}</h4><p>${escapeHTML(food.restaurantName || "Restaurant")}</p><div class="food-bottom"><span class="price">${money(food.price)}</span><button class="btn btn-primary btn-small" data-add-cart="${food.id}">Add</button></div></div></article>`;
}

function renderCustomer() {
  const foods = db.foods.filter(food => food.active !== false);
  const orders = myOrders().sort((a,b) => b.createdAt.localeCompare(a.createdAt));
  const cartTotal = cart.reduce((sum, line) => sum + getFood(line.foodId).price * line.qty, 0);
  $("#portal-content").innerHTML = `
    <div class="portal-grid">
      <section class="card"><h3>Available food</h3><div class="food-grid">${foods.length ? foods.map(foodCard).join("") : '<div class="empty">No food is available yet. Check back soon.</div>'}</div></section>
      <aside>
        <section class="card"><h3>Your cart (${cart.reduce((s,l)=>s+l.qty,0)})</h3>
          ${cart.length ? cart.map(line => { const food=getFood(line.foodId); return `<div class="cart-line"><span>${escapeHTML(food.name)} × ${line.qty}</span><strong>${money(food.price*line.qty)}</strong></div>`; }).join("") : '<div class="empty">Your cart is empty.</div>'}
          <div class="total-line"><span>Total</span><span>${money(cartTotal)}</span></div>
          <form id="checkout-form" class="stack" style="margin-top:15px">
            <label>Delivery address<input name="address" required placeholder="House, road, area" /></label>
            <label>Payment method<select name="payment" required><option value="Cash on Delivery">Cash on Delivery</option><option value="Demo Online Payment">Demo online payment (test only)</option></select></label>
            <button class="btn btn-primary full" type="submit" ${cart.length ? "" : "disabled"}>Place order</button>
          </form>
          <p class="small muted">Online payment is only a demo and does not charge money.</p>
        </section>
        <section class="card"><h3>Your orders</h3><div class="stack">${orders.length ? orders.map(orderCard).join("") : '<div class="empty">Your orders will appear here.</div>'}</div></section>
      </aside>
    </div>`;
  $("#portal-content").querySelectorAll("[data-add-cart]").forEach(button => button.addEventListener("click", () => {
    const foodId = button.dataset.addCart;
    const line = cart.find(item => item.foodId === foodId);
    if (line) line.qty++; else cart.push({ foodId, qty: 1 });
    renderCustomer();
  }));
  
  $("#checkout-form").addEventListener("submit", event => {
    event.preventDefault();
    if (!cart.length) return;

    const form = new FormData(event.currentTarget);
    const items = cart.map(line => { const food = getFood(line.foodId); return { foodId: food.id, name: food.name, price: food.price, qty: line.qty, ownerId: food.ownerId, restaurantName: food.restaurantName }; });
    const total = items.reduce((sum, item) => sum + item.price * item.qty, 0);
    const paymentMethod = String(form.get("payment"));
    const order = {

      id: `TRP-${Date.now().toString().slice(-7)}`, customerId: currentUser.id, customerName: currentUser.name,
      address: String(form.get("address")).trim(), items, total, paymentMethod,
      paymentStatus: paymentMethod === "Demo Online Payment" ? "Demo Paid" : "Pending",
      orderStatus: "Assigned", deliveryStatus: "Assigned", ownerId: items[0].ownerId,
      restaurantName: items[0].restaurantName, riderId: null, createdAt: new Date().toISOString()

    };
    // Keep the simple starter to one restaurant per order.
    if (new Set(items.map(item => item.ownerId)).size > 1) return setNotice("For this simple version, please order from one restaurant at a time.", true);
    db.orders.push(order); saveDB(); cart = []; renderCustomer();
    setNotice(`Order ${order.id} placed. ${paymentMethod === "Demo Online Payment" ? "Demo payment recorded only." : "Payment is pending until cash is collected."}`);
  });
}

function orderCard(order, view = "customer") {
  const items = order.items.map(item => `${escapeHTML(item.name)} × ${item.qty}`).join(", ");
  const paymentLabel = order.paymentStatus === "Demo Paid" ? "Demo Paid" : order.paymentStatus;
  return `<article class="order-item"><div class="order-top"><div><h4>${escapeHTML(order.id)}</h4><div class="small muted">${items}</div></div><strong>${money(order.total)}</strong></div>
    <div class="small"><strong>Customer:</strong> ${escapeHTML(order.customerName)}${view !== "customer" ? `<br><strong>Address:</strong> ${escapeHTML(order.address)}` : ""}</div>
    <div class="row-actions"><span class="status ${statusClass(order.orderStatus)}">${escapeHTML(order.orderStatus)}</span><span class="status ${statusClass(paymentLabel)}">${escapeHTML(paymentLabel)}</span></div>
    ${view === "customer" ? `<div class="small muted">Delivery address: ${escapeHTML(order.address)}</div>` : ""}
    ${view === "owner" ? `<div class="row-actions">${order.orderStatus === "Assigned" ? `<button class="btn btn-dark btn-small" data-owner-prep="${order.id}">Mark Preparing</button>` : ""}${order.orderStatus === "Preparing" ? `<button class="btn btn-primary btn-small" data-owner-ready="${order.id}">Ready for Pickup</button>` : ""}${order.paymentMethod === "Cash on Delivery" && order.paymentStatus === "Pending" ? `<button class="btn btn-outline btn-small" data-owner-payment="${order.id}">Confirm cash received</button>` : ""}<button class="btn btn-outline btn-small" data-assign-rider="${order.id}">Assign rider</button></div>` : ""}
    ${view === "rider" ? `<div class="row-actions">${order.deliveryStatus === "Assigned" ? `<button class="btn btn-primary btn-small" data-pickup="${order.id}">Mark Picked Up</button>` : ""}${order.deliveryStatus === "Picked Up" ? `<button class="btn btn-dark btn-small" data-delivered="${order.id}">Mark Delivered</button>` : ""}</div>` : ""}
  </article>`;
}

function renderRider() {
  const orders = myOrders().sort((a,b) => b.createdAt.localeCompare(a.createdAt));
  $("#portal-content").innerHTML = `<section class="card"><h3>Assigned deliveries</h3><p class="muted small">Only orders assigned to your rider account are shown here.</p><div class="stack">${orders.length ? orders.map(order => orderCard(order, "rider")).join("") : '<div class="empty">No deliveries assigned to you yet. Restaurant owners can assign orders.</div>'}</div></section>`;
  $("#portal-content").querySelectorAll("[data-pickup]").forEach(button => button.addEventListener("click", () => updateOrder(button.dataset.pickup, order => { order.deliveryStatus = "Picked Up"; order.orderStatus = "Picked Up"; })));
  $("#portal-content").querySelectorAll("[data-delivered]").forEach(button => button.addEventListener("click", () => updateOrder(button.dataset.delivered, order => { order.deliveryStatus = "Delivered"; order.orderStatus = "Delivered"; })));
}

function renderOwner() {
  const foods = db.foods.filter(food => food.ownerId === currentUser.id);
  const orders = db.orders.filter(order => order.ownerId === currentUser.id).sort((a,b) => b.createdAt.localeCompare(a.createdAt));
  const riders = db.users.filter(user => user.role === "rider");
  $("#portal-content").innerHTML = `
    <div class="portal-grid">
      <section class="card"><h3>Add a food item</h3>
        <form id="food-form" class="inline-form">
          <label>Food name<input name="name" required placeholder="e.g. Chicken Burger" /></label>
          <label>Price (BDT)<input name="price" type="number" required min="1" step="1" placeholder="250" /></label>
          <label class="wide">Food image <span class="file-help">Square image, exactly 1080 × 1080 px recommended/required.</span><input name="image" type="file" accept="image/*" required /></label>
          <button class="btn btn-primary wide" type="submit">Add food</button>
        </form>
        <hr class="divider"><h3>Your food items</h3>
        <div class="food-grid">${foods.length ? foods.map(food => `<article class="food-card">${food.image ? `<img src="${food.image}" alt="${escapeHTML(food.name)}">` : '<div class="food-placeholder">🍽️</div>'}<div class="food-info"><h4>${escapeHTML(food.name)}</h4><div class="food-bottom"><span class="price">${money(food.price)}</span><button class="btn btn-danger btn-small" data-delete-food="${food.id}">Delete</button></div></div></article>`).join("") : '<div class="empty">Add your first food item above.</div>'}</div>
      </section>
      <section class="card"><h3>Incoming orders</h3><p class="muted small">Manage preparation, delivery assignment and payment status.</p><div class="stack">${orders.length ? orders.map(order => orderCard(order, "owner")).join("") : '<div class="empty">New orders will appear here.</div>'}</div></section>
    </div>`;
  $("#food-form").addEventListener("submit", async event => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const file = form.get("image");
    if (!file || !file.size) return setNotice("Please select a food image.", true);
    try {
      // const dimensions = await readImageDimensions(file);
      // if (dimensions.width !== 1080 || dimensions.height !== 1080) 
      // return setNotice(`Image is ${dimensions.width} × ${dimensions.height}px. Please upload exactly 1080 × 1080 pixels.`, true);
      const dataUrl = await fileToDataURL(file);
      db.foods.push({ id: `food-${Date.now()}`, ownerId: currentUser.id, restaurantName: currentUser.restaurantName || currentUser.name, name: String(form.get("name")).trim(), price: Number(form.get("price")), image: dataUrl, active: true });
      saveDB(); renderOwner(); setNotice("Food item added successfully.");
    } catch { setNotice("Could not read that image. Please choose a valid image file.", true); }
  });
  $("#portal-content").querySelectorAll("[data-delete-food]").forEach(button => button.addEventListener("click", () => {
    db.foods = db.foods.filter(food => food.id !== button.dataset.deleteFood || food.ownerId !== currentUser.id);
    saveDB(); renderOwner(); setNotice("Food item deleted.");
  }));
  $("#portal-content").querySelectorAll("[data-owner-prep]").forEach(button => button.addEventListener("click", () => updateOrder(button.dataset.ownerPrep, order => { order.orderStatus = "Preparing"; })));
  $("#portal-content").querySelectorAll("[data-owner-ready]").forEach(button => button.addEventListener("click", () => updateOrder(button.dataset.ownerReady, order => { order.orderStatus = "Ready for Pickup"; })));
  $("#portal-content").querySelectorAll("[data-owner-payment]").forEach(button => button.addEventListener("click", () => updateOrder(button.dataset.ownerPayment, order => { order.paymentStatus = "Paid"; })));
  $("#portal-content").querySelectorAll("[data-assign-rider]").forEach(button => button.addEventListener("click", () => {
    const order = db.orders.find(item => item.id === button.dataset.assignRider && item.ownerId === currentUser.id);
    if (!order) return;
    if (!riders.length) return setNotice("No rider accounts yet. Ask a rider to register first.", true);
    const choices = riders.map(rider => `${rider.id}|${rider.name}`).join("\n");
    const selection = window.prompt(`Enter the number for the rider:\n${riders.map((r,i)=>`${i+1}. ${r.name} (${r.email})`).join("\n")}`);
    const index = Number(selection) - 1;
    if (!Number.isInteger(index) || index < 0 || index >= riders.length) return;
    order.riderId = riders[index].id;
    order.deliveryStatus = "Assigned";
    saveDB(); renderOwner(); setNotice(`Order assigned to ${riders[index].name}.`);
  }));
}

function updateOrder(orderId, updater) {
  const order = db.orders.find(item => item.id === orderId);
  if (!order) return setNotice("Order not found.", true);
  // Demo role ownership checks.
  if (currentUser.role === "rider" && order.riderId !== currentUser.id) return setNotice("You can only update orders assigned to you.", true);
  if (currentUser.role === "owner" && order.ownerId !== currentUser.id) return setNotice("You can only update your restaurant's orders.", true);
  updater(order); saveDB(); render(); setNotice(`Order ${order.id} updated.`);
}
function readImageDimensions(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => { const result = { width: image.naturalWidth, height: image.naturalHeight }; URL.revokeObjectURL(url); resolve(result); };
    image.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Invalid image")); };
    image.src = url;
  });
}
function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

try {
  const savedSession = JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
  if (savedSession) currentUser = getUserById(savedSession.id) || null;
} catch { currentUser = null; }
render();
