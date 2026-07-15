// App State Variables
const API_BASE = '/api';
let authToken = localStorage.getItem('token') || '';
let currentUser = JSON.parse(localStorage.getItem('user')) || null;

// Views State
let inventoryData = [];
let customersData = [];
let completedBillsData = [];
let pendingBillsData = [];
let cart = {}; // key: itemId, value: { item, qty }
let selectedCustomer = null;
let activePendingBillId = null;

// Edit state
let editingItemId = null;

// Initial Setup
document.addEventListener('DOMContentLoaded', () => {
  initApp();
  
  // Start clock
  setInterval(updateClock, 1000);
  updateClock();
});

// Update current header time
function updateClock() {
  const timeEl = document.getElementById('current-time');
  if (timeEl) {
    const now = new Date();
    timeEl.textContent = now.toLocaleString('en-IN', {
      dateStyle: 'medium',
      timeStyle: 'short'
    });
  }
}

// Initialize Application UI / Auth State
function initApp() {
  if (authToken && currentUser) {
    showAppLayout();
    switchView('billing-view');
    loadDashboardData();
  } else {
    showLoginScreen();
  }

  // Setup Event Listeners
  setupEventListeners();
}

function showLoginScreen() {
  document.getElementById('app-layout').classList.remove('active');
  document.getElementById('login-screen').classList.add('active');
}

function showAppLayout() {
  document.getElementById('login-screen').classList.remove('active');
  document.getElementById('app-layout').classList.add('active');
  
  // Set user profile display info
  document.getElementById('user-display-name').textContent = currentUser.username;
  document.getElementById('user-display-role').textContent = currentUser.role;

  // Toggle admin-only links visibility in navigation drawer
  const isAdmin = currentUser.role === 'admin';
  document.querySelectorAll('.nav-item[data-role="admin"]').forEach(item => {
    if (isAdmin) {
      item.classList.remove('hidden');
    } else {
      item.classList.add('hidden');
    }
  });
}

// Router/View Switcher
function switchView(viewId) {
  // Access control rights check
  const adminViews = ['dashboard-view', 'inventory-view', 'users-view'];
  if (adminViews.includes(viewId) && (!currentUser || currentUser.role !== 'admin')) {
    showToast('Access Denied: Admin Privilege Required', 'danger');
    return;
  }

  // Hide all views
  document.querySelectorAll('.app-view').forEach(view => {
    view.classList.remove('active');
  });

  // Deactivate all nav items
  document.querySelectorAll('.nav-item').forEach(item => {
    item.classList.remove('active');
  });

  // Show selected view
  const targetView = document.getElementById(viewId);
  if (targetView) {
    targetView.classList.add('active');
  }

  // Highlight selected sidebar item
  const navItem = document.querySelector(`.nav-item[data-target="${viewId}"]`);
  if (navItem) {
    navItem.classList.add('active');
  }

  // Update Page Title in header
  const titles = {
    'dashboard-view': 'Overview',
    'billing-view': 'Billing & POS System',
    'cart-view': 'Shopping Cart & Checkout',
    'inventory-view': 'Inventory & Stock Control',
    'customers-view': 'Customer Directory',
    'pending-view': 'Pending Orders',
    'users-view': 'User Account & Role Management'
  };
  document.getElementById('page-title').textContent = titles[viewId] || 'Chicken Shop POS';

  // Load view-specific data
  if (viewId === 'dashboard-view') {
    loadDashboardData();
  } else if (viewId === 'billing-view') {
    loadPOSData();
  } else if (viewId === 'cart-view') {
    renderPOSCart();
  } else if (viewId === 'inventory-view') {
    loadInventoryData();
  } else if (viewId === 'customers-view') {
    loadCustomersData();
  } else if (viewId === 'pending-view') {
    loadPendingOrdersData();
  } else if (viewId === 'users-view') {
    loadUsersData();
  }
}

// Helper to make API Requests
async function apiRequest(endpoint, options = {}) {
  const headers = {
    'Accept': 'application/json',
    ...(options.headers || {})
  };

  // Add auth token if available
  if (authToken) {
    headers['Authorization'] = `Bearer ${authToken}`;
  }

  // Set default body type to JSON if not FormData
  if (options.body && !(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(options.body);
  }

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers
  });

  if (response.status === 401 && endpoint !== '/auth/login') {
    // Unauthorized - log out user
    logout();
    throw new Error('Session expired. Please log in again.');
  }

  const data = await response.json();
  if (!response.ok) {
    throw new Error(data.message || data.error || 'Something went wrong');
  }

  return data;
}

// Toast Notifications Helper
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  
  let iconName = 'checkmark-circle-outline';
  if (type === 'danger') iconName = 'alert-circle-outline';
  if (type === 'info') iconName = 'information-circle-outline';

  toast.innerHTML = `
    <ion-icon name="${iconName}"></ion-icon>
    <span>${message}</span>
  `;

  container.appendChild(toast);
  
  // Trigger animation
  setTimeout(() => toast.classList.add('show'), 50);

  // Auto remove after 3s
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 400);
  }, 3000);
}

// Event Listeners Setup
function setupEventListeners() {
  // Login Form
  document.getElementById('login-form').addEventListener('submit', handleLogin);

  // Sidebar Menu Items Click
  document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
      e.preventDefault();
      const target = item.getAttribute('data-target');
      switchView(target);
    });
  });

  // Logout Button
  document.getElementById('btn-logout').addEventListener('click', logout);

  // POS Inventory Search Filter
  document.getElementById('pos-search-input').addEventListener('input', filterPOSProducts);

  // Inventory Search Filter
  document.getElementById('inventory-search-input').addEventListener('input', filterInventoryTable);

  // Customers Search Filter
  document.getElementById('customers-search-input').addEventListener('input', filterCustomersTable);

  // Pending Search Filter
  document.getElementById('pending-search-input').addEventListener('input', filterPendingOrdersTable);

  // POS Add Customer Check Button
  document.getElementById('btn-lookup-customer').addEventListener('click', lookupCustomerInPOS);

  // Clear POS Cart
  document.getElementById('btn-clear-cart').addEventListener('click', clearPOSCart);

  // Complete POS Order
  document.getElementById('btn-complete-bill').addEventListener('click', completePOSOrder);

  // Save POS Pending Order
  document.getElementById('btn-save-pending').addEventListener('click', savePOSPendingOrder);

  // Image Upload Preview handler
  const imageInput = document.getElementById('item_image');
  imageInput.addEventListener('change', handleImageUploadPreview);

  document.getElementById('btn-remove-preview').addEventListener('click', removeImagePreview);

  // Add/Edit Inventory Form Submit
  document.getElementById('inventory-item-form').addEventListener('submit', handleInventoryFormSubmit);

  // Cancel edit button
  document.getElementById('btn-cancel-edit').addEventListener('click', cancelInventoryEdit);

  // Customer Register Form
  document.getElementById('customer-register-form').addEventListener('submit', handleCustomerRegisterSubmit);

  // Modal Register Form in POS
  document.getElementById('modal-customer-form').addEventListener('submit', handleModalCustomerSubmit);

  // Dashboard Stat Cards Click Handlers
  document.getElementById('card-revenue').addEventListener('click', openSalesHistoryModal);
  document.getElementById('card-bills').addEventListener('click', openSalesHistoryModal);
  document.getElementById('card-low-stock').addEventListener('click', showLowStockInventory);
  document.getElementById('card-customers').addEventListener('click', () => switchView('customers-view'));

  // Sales History search
  document.getElementById('sales-history-search').addEventListener('input', filterSalesHistoryTable);

  // New User Register Form
  document.getElementById('new-user-form').addEventListener('submit', handleNewUserSubmit);

  // New Role Form
  document.getElementById('new-role-form').addEventListener('submit', handleNewRoleSubmit);
}

// Authentication Logic
async function handleLogin(e) {
  e.preventDefault();
  const username = document.getElementById('username').value.trim();
  const password = document.getElementById('password').value;

  try {
    const data = await apiRequest('/auth/login', {
      method: 'POST',
      body: { username, password }
    });

    authToken = data.token;
    currentUser = data.user;
    localStorage.setItem('token', authToken);
    localStorage.setItem('user', JSON.stringify(currentUser));

    showToast('Signed in successfully!');
    showAppLayout();
    switchView('billing-view');
    
    // Clear login form fields
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

function logout() {
  authToken = '';
  currentUser = null;
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  showLoginScreen();
  showToast('Logged out successfully', 'info');
}

// Load views data
async function loadDashboardData() {
  try {
    // Parallel load
    const [inv, cust, bills] = await Promise.all([
      apiRequest('/inventory'),
      apiRequest('/customers'),
      apiRequest('/billing/completed')
    ]);

    inventoryData = inv;
    customersData = cust;
    completedBillsData = bills;

    renderDashboardStats();
    renderRecentBills();
    renderLowStockAlerts();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

function renderDashboardStats() {
  // Total completed bills
  document.getElementById('stat-bills').textContent = completedBillsData.length;

  // Total revenue
  const totalRevenue = completedBillsData.reduce((sum, bill) => sum + parseFloat(bill.final_price), 0);
  document.getElementById('stat-revenue').textContent = `₹${totalRevenue.toFixed(2)}`;

  // Low stock alert count
  const lowStockCount = inventoryData.filter(item => item.qty < 5).length;
  document.getElementById('stat-low-stock').textContent = lowStockCount;

  // Registered customers count
  document.getElementById('stat-customers').textContent = customersData.length;
}

function renderRecentBills() {
  const tableBody = document.getElementById('recent-bills-table-body');
  
  if (completedBillsData.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="6" class="empty-state">No recent bills found. Make a sale to view here!</td></tr>`;
    return;
  }

  // Render top 5 recent bills
  const recent = completedBillsData.slice(0, 5);
  tableBody.innerHTML = recent.map(bill => {
    const itemsList = bill.items;
    const itemsCount = itemsList.reduce((sum, i) => sum + i.qty, 0);
    const dateStr = new Date(bill.created_at).toLocaleString('en-IN', {
      dateStyle: 'short',
      timeStyle: 'short'
    });

    return `
      <tr style="cursor: pointer;" onclick="openReceipt(${bill.bill_no})" title="Click to view detailed receipt">
        <td><strong>#${bill.bill_no}</strong></td>
        <td>${bill.customer_phone || '<span class="badge warning">Walking Customer</span>'}</td>
        <td>${itemsCount} item(s)</td>
        <td>₹${parseFloat(bill.total_amount).toFixed(2)}</td>
        <td><strong class="text-success">₹${parseFloat(bill.final_price).toFixed(2)}</strong></td>
        <td>${dateStr}</td>
      </tr>
    `;
  }).join('');
}

function renderLowStockAlerts() {
  const alertList = document.getElementById('low-stock-list');
  const lowStockItems = inventoryData.filter(item => item.qty < 5);

  if (lowStockItems.length === 0) {
    alertList.innerHTML = `<div class="empty-state">All items are sufficiently stocked!</div>`;
    return;
  }

  alertList.innerHTML = lowStockItems.map(item => `
    <div class="alert-item">
      <div class="alert-item-info">
        <h4>${item.item_name}</h4>
        <p>Price: ₹${item.price}</p>
      </div>
      <span class="badge danger">Qty: ${item.qty} left</span>
    </div>
  `).join('');
}

// POS/Billing Screen Functions
async function loadPOSData() {
  try {
    inventoryData = await apiRequest('/inventory');
    renderPOSProducts(inventoryData);
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

function renderPOSProducts(products) {
  const grid = document.getElementById('pos-products-grid');
  
  if (products.length === 0) {
    grid.innerHTML = `<div class="empty-state" style="grid-column: 1/-1">No menu items found. Go to Inventory to add items first!</div>`;
    return;
  }

  grid.innerHTML = products.map(item => {
    const isLow = item.qty < 5;
    const imgUrl = item.image_url ? item.image_url : '';
    const imgTag = imgUrl 
      ? `<img src="${imgUrl}" alt="${item.item_name}" class="product-image">`
      : `<div class="product-image"><ion-icon name="fast-food-outline"></ion-icon></div>`;

    return `
      <div class="product-card" onclick="addToPOSCart(${item.id})">
        <div class="btn-add-badge"><ion-icon name="add"></ion-icon></div>
        ${imgTag}
        <h4>${item.item_name}</h4>
        <div class="price">₹${item.price}</div>
        <div class="stock-tag ${isLow ? 'low' : ''}">Stock: ${item.qty}</div>
      </div>
    `;
  }).join('');
}

function filterPOSProducts() {
  const query = document.getElementById('pos-search-input').value.toLowerCase().trim();
  const filtered = inventoryData.filter(item => 
    item.item_name.toLowerCase().includes(query) || 
    (item.description && item.description.toLowerCase().includes(query))
  );
  renderPOSProducts(filtered);
}

// Cart Management
function addToPOSCart(itemId) {
  const item = inventoryData.find(i => i.id === itemId);
  if (!item) return;

  if (item.qty <= 0) {
    showToast(`${item.item_name} is out of stock!`, 'danger');
    return;
  }

  if (cart[itemId]) {
    if (cart[itemId].qty >= item.qty) {
      showToast(`Cannot add more. Only ${item.qty} in stock.`, 'warning');
      return;
    }
    cart[itemId].qty += 1;
  } else {
    cart[itemId] = { item, qty: 1 };
  }

  renderPOSCart();
}

function updateCartBadges() {
  const totalQty = Object.values(cart).reduce((sum, entry) => sum + entry.qty, 0);
  const billingBadge = document.getElementById('billing-cart-badge');
  if (billingBadge) billingBadge.textContent = totalQty;
  
  const sidebarBadge = document.getElementById('cart-badge-count');
  if (sidebarBadge) {
    sidebarBadge.textContent = totalQty;
    if (totalQty > 0) {
      sidebarBadge.classList.remove('hidden');
    } else {
      sidebarBadge.classList.add('hidden');
    }
  }
}

function renderPOSCart() {
  updateCartBadges();
  const cartContainer = document.getElementById('cart-items-list');
  const cartEntries = Object.values(cart);

  if (cartEntries.length === 0) {
    cartContainer.innerHTML = `
      <div class="empty-cart-state">
        <ion-icon name="basket-outline"></ion-icon>
        <p>Your cart is empty</p>
        <small>Go back to Billing & POS to add items</small>
      </div>
    `;
    updatePOSCartSummary(0);
    return;
  }

  cartContainer.innerHTML = cartEntries.map(entry => {
    const subtotal = entry.item.price * entry.qty;
    return `
      <div class="cart-item" style="display: flex; justify-content: space-between; align-items: center; padding: 10px 0; border-bottom: 1px solid var(--border-color);">
        <div class="cart-item-details">
          <h5 style="margin: 0 0 4px 0; font-size: 14px; font-weight: 500;">${entry.item.item_name}</h5>
          <p style="margin: 0; font-size: 12px; color: var(--text-secondary);">₹${entry.item.price} &times; ${entry.qty}</p>
        </div>
        <div style="display: flex; align-items: center; gap: 10px;">
          <div class="cart-item-qty">
            <button class="qty-btn" onclick="updateCartQty(${entry.item.id}, -1)">-</button>
            <span>${entry.qty}</span>
            <button class="qty-btn" onclick="updateCartQty(${entry.item.id}, 1)">+</button>
          </div>
          <button onclick="removeFromCart(${entry.item.id})" style="background: none; border: none; color: #ff3b30; cursor: pointer; display: flex; align-items: center; justify-content: center; padding: 4px; border-radius: 4px;" title="Remove Item">
            <ion-icon name="trash-outline" style="font-size: 18px;"></ion-icon>
          </button>
        </div>
      </div>
    `;
  }).join('');

  // Calculate Subtotal
  const subtotal = cartEntries.reduce((sum, entry) => sum + (entry.item.price * entry.qty), 0);
  updatePOSCartSummary(subtotal);
}

function updateCartQty(itemId, delta) {
  if (!cart[itemId]) return;

  const itemLimit = cart[itemId].item.qty;
  const newQty = cart[itemId].qty + delta;

  if (newQty <= 0) {
    delete cart[itemId];
  } else {
    if (newQty > itemLimit) {
      showToast(`Only ${itemLimit} items are available in stock.`, 'warning');
      return;
    }
    cart[itemId].qty = newQty;
  }
  renderPOSCart();
}

function removeFromCart(itemId) {
  if (cart[itemId]) {
    delete cart[itemId];
    renderPOSCart();
    showToast('Item removed from cart', 'info');
  }
}

function clearPOSCart() {
  cart = {};
  selectedCustomer = null;
  activePendingBillId = null;
  document.getElementById('cart-customer-phone').value = '';
  document.getElementById('customer-name-display').classList.add('hidden');
  document.getElementById('cart-discount').value = 0;
  renderPOSCart();
  showToast('Cart cleared', 'info');
}

function updatePOSCartSummary(subtotal) {
  document.getElementById('cart-subtotal').textContent = `₹${subtotal.toFixed(2)}`;
  
  const discountInput = document.getElementById('cart-discount');
  const discount = Math.max(0, parseFloat(discountInput.value) || 0);
  
  const finalTotal = Math.max(0, subtotal - discount);
  document.getElementById('cart-final-total').textContent = `₹${finalTotal.toFixed(2)}`;
}

// Re-calculate when discount field changes
document.getElementById('cart-discount').addEventListener('input', () => {
  const cartEntries = Object.values(cart);
  const subtotal = cartEntries.reduce((sum, entry) => sum + (entry.item.price * entry.qty), 0);
  updatePOSCartSummary(subtotal);
});

// Customer lookup
async function lookupCustomerInPOS() {
  const phone = document.getElementById('cart-customer-phone').value.trim();
  if (!phone) {
    showToast('Please enter a phone number', 'warning');
    return;
  }

  try {
    const customer = await apiRequest(`/customers/${phone}`);
    if (customer && customer.name) {
      selectedCustomer = customer;
      document.getElementById('lbl-customer-name').textContent = customer.name;
      document.getElementById('customer-name-display').classList.remove('hidden');
      showToast(`Welcome back, ${customer.name}!`);
    } else {
      openCustomerModal(phone);
    }
  } catch (err) {
    // If not found (often backend throws 404 or empty json/error)
    openCustomerModal(phone);
  }
}

// Modal handling
function openCustomerModal(phone) {
  document.getElementById('modal-phone-num').textContent = phone;
  document.getElementById('modal-customer-name').value = '';
  document.getElementById('customer-modal').classList.remove('hidden');
  document.getElementById('customer-modal').classList.add('active');
}

function closeCustomerModal() {
  document.getElementById('customer-modal').classList.remove('active');
  document.getElementById('customer-modal').classList.add('hidden');
}

async function handleModalCustomerSubmit(e) {
  e.preventDefault();
  const phone = document.getElementById('modal-phone-num').textContent;
  const name = document.getElementById('modal-customer-name').value.trim();

  try {
    const customer = await apiRequest('/customers', {
      method: 'POST',
      body: { phone_no: phone, name }
    });

    selectedCustomer = { phone_no: phone, name };
    document.getElementById('lbl-customer-name').textContent = name;
    document.getElementById('customer-name-display').classList.remove('hidden');
    
    closeCustomerModal();
    showToast(`Registered and selected customer: ${name}`);
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

// Complete Order POS
async function completePOSOrder() {
  const cartEntries = Object.values(cart);
  if (cartEntries.length === 0) {
    showToast('Your cart is empty', 'warning');
    return;
  }

  const subtotal = cartEntries.reduce((sum, entry) => sum + (entry.item.price * entry.qty), 0);
  const discount = Math.max(0, parseFloat(document.getElementById('cart-discount').value) || 0);
  const finalTotal = Math.max(0, subtotal - discount);

  // Prep items for backend
  const items = cartEntries.map(entry => ({
    id: entry.item.id,
    item_name: entry.item.item_name,
    qty: entry.qty,
    price: entry.item.price
  }));

  const orderPayload = {
    customer_phone: selectedCustomer ? selectedCustomer.phone_no : null,
    items: items,
    total_amount: subtotal,
    discount: discount,
    final_price: finalTotal,
    pending_bill_id: activePendingBillId
  };

  try {
    const response = await apiRequest('/billing/complete', {
      method: 'POST',
      body: orderPayload
    });

    showToast(`Order completed successfully! Bill No: #${response.bill_no}`);
    clearPOSCart();
    
    // Refresh products on POS
    loadPOSData();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

// Save Pending POS Order
async function savePOSPendingOrder() {
  const cartEntries = Object.values(cart);
  if (cartEntries.length === 0) {
    showToast('Your cart is empty', 'warning');
    return;
  }

  const subtotal = cartEntries.reduce((sum, entry) => sum + (entry.item.price * entry.qty), 0);

  const items = cartEntries.map(entry => ({
    id: entry.item.id,
    item_name: entry.item.item_name,
    qty: entry.qty,
    price: entry.item.price
  }));

  try {
    await apiRequest('/billing/pending', {
      method: 'POST',
      body: {
        items,
        subtotal
      }
    });

    showToast('Pending bill saved successfully');
    clearPOSCart();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

// Inventory Management functions
async function loadInventoryData() {
  try {
    inventoryData = await apiRequest('/inventory');
    renderInventoryTable(inventoryData);
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

function renderInventoryTable(items) {
  const tableBody = document.getElementById('inventory-table-body');
  
  if (items.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="6" class="empty-state">No inventory items found. Add one on the left!</td></tr>`;
    return;
  }

  tableBody.innerHTML = items.map(item => {
    const isLow = item.qty < 5;
    const statusTag = item.qty <= 0 
      ? `<span class="badge danger">Out of Stock</span>`
      : (isLow ? `<span class="badge warning">Low Stock</span>` : `<span class="badge success">In Stock</span>`);
    
    const imgUrl = item.image_url ? item.image_url : '';
    const imgTag = imgUrl 
      ? `<img src="${imgUrl}" alt="${item.item_name}" class="image-cell">`
      : `<div class="image-cell"><ion-icon name="fast-food-outline"></ion-icon></div>`;

    return `
      <tr id="inventory-row-${item.id}">
        <td>${imgTag}</td>
        <td><strong>${item.item_name}</strong><br><small style="color: var(--text-secondary)">${item.description || 'No description'}</small></td>
        <td>₹${parseFloat(item.price).toFixed(2)}</td>
        <td>${item.qty}</td>
        <td>${statusTag}</td>
        <td>
          <div class="table-actions">
            <button type="button" class="btn-icon-edit" onclick="startEditItem(${item.id})" title="Edit Item">
              <ion-icon name="create-outline"></ion-icon>
            </button>
            <button type="button" class="btn-icon-delete" onclick="deleteItem(${item.id})" title="Delete Item">
              <ion-icon name="trash-outline"></ion-icon>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function filterInventoryTable() {
  const query = document.getElementById('inventory-search-input').value.toLowerCase().trim();
  const filtered = inventoryData.filter(item => 
    item.item_name.toLowerCase().includes(query) || 
    (item.description && item.description.toLowerCase().includes(query))
  );
  renderInventoryTable(filtered);
}

// Upload & previews
function handleImageUploadPreview(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(evt) {
    document.getElementById('image-preview').src = evt.target.result;
    document.getElementById('image-preview-container').classList.remove('hidden');
    document.querySelector('.upload-placeholder').classList.add('hidden');
  };
  reader.readAsDataURL(file);
}

function removeImagePreview() {
  document.getElementById('item_image').value = '';
  document.getElementById('image-preview').src = '';
  document.getElementById('image-preview-container').classList.add('hidden');
  document.querySelector('.upload-placeholder').classList.remove('hidden');
}

// Helper to convert file to base64
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
    reader.readAsDataURL(file);
  });
}

// Submit Add / Edit Form
async function handleInventoryFormSubmit(e) {
  e.preventDefault();

  const name = document.getElementById('item_name').value.trim();
  const description = document.getElementById('item_description').value.trim();
  const qty = parseInt(document.getElementById('item_qty').value);
  const price = parseFloat(document.getElementById('item_price').value);
  const fileInput = document.getElementById('item_image');

  try {
    let base64Image = null;
    if (fileInput.files[0]) {
      base64Image = await fileToBase64(fileInput.files[0]);
    }

    const payload = {
      item_name: name,
      description,
      qty,
      price,
      image_url: base64Image
    };

    let response;
    if (editingItemId) {
      // Edit mode
      response = await apiRequest(`/inventory/${editingItemId}`, {
        method: 'PUT',
        body: payload
      });
      showToast(`Updated item: ${response.item_name}`);
    } else {
      // Add mode
      response = await apiRequest('/inventory', {
        method: 'POST',
        body: payload
      });
      showToast(`Added new item: ${response.item_name}`);
    }

    // Reset Form & reload
    resetInventoryForm();
    loadInventoryData();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

function startEditItem(itemId) {
  const item = inventoryData.find(i => i.id === itemId);
  if (!item) return;

  editingItemId = itemId;
  document.getElementById('edit-item-id').value = item.id;
  document.getElementById('item_name').value = item.item_name;
  document.getElementById('item_description').value = item.description || '';
  document.getElementById('item_qty').value = item.qty;
  document.getElementById('item_price').value = item.price;
  
  // Set image preview if present
  if (item.image_url) {
    document.getElementById('image-preview').src = item.image_url;
    document.getElementById('image-preview-container').classList.remove('hidden');
    document.querySelector('.upload-placeholder').classList.add('hidden');
  } else {
    removeImagePreview();
  }

  // Update button texts
  document.getElementById('inventory-form-title').textContent = 'Edit Inventory Item';
  document.getElementById('btn-save-item').textContent = 'Update Item';
  document.getElementById('btn-cancel-edit').classList.remove('hidden');

  // Scroll to form on small screens
  document.querySelector('.inventory-form').scrollIntoView({ behavior: 'smooth' });
}

function cancelInventoryEdit() {
  resetInventoryForm();
}

function resetInventoryForm() {
  editingItemId = null;
  document.getElementById('edit-item-id').value = '';
  document.getElementById('inventory-item-form').reset();
  removeImagePreview();

  document.getElementById('inventory-form-title').textContent = 'Add New Inventory Item';
  document.getElementById('btn-save-item').textContent = 'Add Item';
  document.getElementById('btn-cancel-edit').classList.add('hidden');
}

async function deleteItem(itemId) {
  const item = inventoryData.find(i => i.id === itemId);
  if (!item) return;

  if (!confirm(`Are you sure you want to delete ${item.item_name}?`)) {
    return;
  }

  try {
    await apiRequest(`/inventory/${itemId}`, {
      method: 'DELETE'
    });
    
    showToast(`Deleted ${item.item_name}`);
    loadInventoryData();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

// Customers management logic
async function loadCustomersData() {
  try {
    customersData = await apiRequest('/customers');
    renderCustomersTable(customersData);
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

function renderCustomersTable(customers) {
  const tableBody = document.getElementById('customers-table-body');

  if (customers.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="3" class="empty-state">No registered customers found. Add one on the left!</td></tr>`;
    return;
  }

  tableBody.innerHTML = customers.map(c => {
    const regDateStr = new Date(c.created_at).toLocaleDateString('en-IN', {
      dateStyle: 'medium'
    });

    return `
      <tr>
        <td><strong>${c.phone_no}</strong></td>
        <td>${c.name}</td>
        <td>${regDateStr}</td>
      </tr>
    `;
  }).join('');
}

function filterCustomersTable() {
  const query = document.getElementById('customers-search-input').value.toLowerCase().trim();
  const filtered = customersData.filter(c => 
    c.name.toLowerCase().includes(query) || 
    c.phone_no.includes(query)
  );
  renderCustomersTable(filtered);
}

async function handleCustomerRegisterSubmit(e) {
  e.preventDefault();
  const phone = document.getElementById('customer_phone').value.trim();
  const name = document.getElementById('customer_name').value.trim();

  try {
    await apiRequest('/customers', {
      method: 'POST',
      body: { phone_no: phone, name }
    });

    showToast(`Registered Customer: ${name}`);
    document.getElementById('customer-register-form').reset();
    loadCustomersData();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

// Pending Orders View Logic
async function loadPendingOrdersData() {
  try {
    pendingBillsData = await apiRequest('/billing/pending');
    renderPendingOrders(pendingBillsData);
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

function renderPendingOrders(bills) {
  const grid = document.getElementById('pending-orders-grid');

  if (bills.length === 0) {
    grid.innerHTML = `<div class="empty-state" style="grid-column: 1/-1">No pending orders found. Save a bill from POS to view here!</div>`;
    return;
  }

  grid.innerHTML = bills.map(bill => {
    const savedDateStr = new Date(bill.saved_at).toLocaleString('en-IN', {
      dateStyle: 'short',
      timeStyle: 'short'
    });

    const itemsSummary = bill.items.map(item => `${item.item_name} (x${item.qty})`).join(', ');

    return `
      <div class="product-card" style="cursor: default; text-align: left; align-items: flex-start; padding: 20px; width: 100%;">
        <div style="width: 100%; display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
          <h4 style="margin: 0; font-size: 15px; font-weight: 700;">Pending Order #${bill.id}</h4>
          <span class="badge warning" style="font-size: 9px;">Subtotal: ₹${parseFloat(bill.subtotal).toFixed(2)}</span>
        </div>
        <p style="font-size: 12px; color: var(--text-muted); margin-bottom: 8px;">Saved at: ${savedDateStr}</p>
        <p style="font-size: 13px; color: var(--text-secondary); margin-bottom: 16px; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;">
          <strong>Items:</strong> ${itemsSummary}
        </p>
        <div style="display: flex; gap: 8px; width: 100%;">
          <button type="button" class="btn-primary" style="flex: 1.2; padding: 8px; font-size: 13px;" onclick="restorePendingOrder(${bill.id}, false)">
            <ion-icon name="arrow-undo-outline"></ion-icon> Add More
          </button>
          <button type="button" class="btn-success" style="flex: 1.5; padding: 8px; font-size: 13px;" onclick="restorePendingOrder(${bill.id}, true)">
            <ion-icon name="basket-outline"></ion-icon> View Cart
          </button>
          <button type="button" class="btn-danger" style="padding: 8px; width: 36px; height: 35px; border-radius: 6px; display: flex; align-items: center; justify-content: center;" onclick="deletePendingBill(${bill.id})" title="Delete Pending Order">
            <ion-icon name="trash-outline" style="font-size: 16px;"></ion-icon>
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function filterPendingOrdersTable() {
  const query = document.getElementById('pending-search-input').value.toLowerCase().trim();
  const filtered = pendingBillsData.filter(bill => {
    const idMatches = bill.id.toString().includes(query);
    const itemMatches = bill.items.some(item => item.item_name.toLowerCase().includes(query));
    return idMatches || itemMatches;
  });
  renderPendingOrders(filtered);
}

async function restorePendingOrder(billId, goToCart = false) {
  const bill = pendingBillsData.find(b => b.id === billId);
  if (!bill) return;

  try {
    // Ensure inventory is loaded
    inventoryData = await apiRequest('/inventory');
    
    // Clear cart and set active pending ID
    cart = {};
    activePendingBillId = bill.id;

    // Repopulate cart
    for (const savedItem of bill.items) {
      const currentInvItem = inventoryData.find(i => i.id === savedItem.id);
      if (currentInvItem) {
        // limit quantity by current stock level
        const quantityToLoad = Math.min(savedItem.qty, currentInvItem.qty);
        if (quantityToLoad > 0) {
          cart[savedItem.id] = {
            item: currentInvItem,
            qty: quantityToLoad
          };
        }
      }
    }

    // Switch view accordingly
    if (goToCart) {
      switchView('cart-view');
    } else {
      switchView('billing-view');
    }
    renderPOSCart();
    showToast(`Pending Order #${bill.id} loaded successfully.`);
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

async function deletePendingBill(billId) {
  if (!confirm(`Are you sure you want to delete Pending Order #${billId}?`)) {
    return;
  }

  try {
    await apiRequest(`/billing/pending/${billId}`, {
      method: 'DELETE'
    });

    showToast(`Deleted Pending Order #${billId}`);
    loadPendingOrdersData();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

// Sales History Modal Logic
function openSalesHistoryModal() {
  renderSalesHistoryTable(completedBillsData);
  document.getElementById('sales-history-modal').classList.remove('hidden');
  document.getElementById('sales-history-modal').classList.add('active');
}

function closeSalesHistoryModal() {
  document.getElementById('sales-history-modal').classList.remove('active');
  document.getElementById('sales-history-modal').classList.add('hidden');
  document.getElementById('sales-history-search').value = '';
}

function renderSalesHistoryTable(bills) {
  const tableBody = document.getElementById('sales-history-table-body');
  
  if (bills.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="6" class="empty-state">No sales found.</td></tr>`;
    return;
  }

  tableBody.innerHTML = bills.map(bill => {
    const itemsCount = bill.items.reduce((sum, i) => sum + i.qty, 0);
    const dateStr = new Date(bill.created_at).toLocaleString('en-IN', {
      dateStyle: 'short',
      timeStyle: 'short'
    });

    return `
      <tr style="cursor: pointer;" onclick="openReceipt(${bill.bill_no})" title="Click to view detailed receipt">
        <td><strong>#${bill.bill_no}</strong></td>
        <td>${bill.customer_phone || '<span class="badge warning">Walking Customer</span>'}</td>
        <td>${itemsCount} item(s)</td>
        <td>₹${parseFloat(bill.total_amount).toFixed(2)}</td>
        <td><strong class="text-success">₹${parseFloat(bill.final_price).toFixed(2)}</strong></td>
        <td>${dateStr}</td>
      </tr>
    `;
  }).join('');
}

function filterSalesHistoryTable() {
  const query = document.getElementById('sales-history-search').value.toLowerCase().trim();
  const filtered = completedBillsData.filter(bill => {
    const billMatches = bill.bill_no.toString().includes(query);
    const phoneMatches = bill.customer_phone && bill.customer_phone.includes(query);
    return billMatches || phoneMatches;
  });
  renderSalesHistoryTable(filtered);
}

// Receipt Modal Logic
function openReceipt(billNo) {
  const bill = completedBillsData.find(b => b.bill_no === billNo);
  if (!bill) {
    showToast('Receipt details not found', 'danger');
    return;
  }

  renderReceiptDetails(bill);
  document.getElementById('receipt-modal').classList.remove('hidden');
  document.getElementById('receipt-modal').classList.add('active');
}

function closeReceiptModal() {
  document.getElementById('receipt-modal').classList.remove('active');
  document.getElementById('receipt-modal').classList.add('hidden');
}

function renderReceiptDetails(bill) {
  const area = document.getElementById('receipt-details-area');
  const dateStr = new Date(bill.created_at).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  }).replace(/\//g, '-');

  const customer = customersData.find(c => c.phone_no === bill.customer_phone);
  const custName = customer ? customer.name : 'Walking Customer';
  const custPhone = bill.customer_phone || 'N/A';

  // Render items rows
  const itemsRows = bill.items.map((item, index) => {
    return `
      <tr>
        <td style="padding: 8px 0; font-size: 13px; color: #fff;">${index + 1}</td>
        <td style="padding: 8px 0; font-size: 13px; color: #fff;">${item.item_name}</td>
        <td style="padding: 8px 0; font-size: 13px; color: #fff; text-align: center;">${item.qty}</td>
        <td style="padding: 8px 0; font-size: 13px; color: #fff; text-align: right;">₹${parseFloat(item.price).toFixed(2)}</td>
        <td style="padding: 8px 0; font-size: 13px; color: #fff; text-align: right;">₹${(item.price * item.qty).toFixed(2)}</td>
      </tr>
    `;
  }).join('');

  area.innerHTML = `
    <!-- Top Header: Bill no & Date -->
    <div style="display: flex; justify-content: space-between; font-size: 14px; font-weight: 600; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 10px; margin-bottom: 12px; color: #fff;">
      <span>Bill no: #${bill.bill_no}</span>
      <span>Date: ${dateStr}</span>
    </div>

    <!-- Items Grid Table -->
    <table style="width: 100%; border-collapse: collapse; margin-bottom: 16px;">
      <thead>
        <tr style="border-bottom: 1px dashed rgba(255,255,255,0.15); text-align: left;">
          <th style="padding-bottom: 6px; font-size: 12px; color: var(--text-muted); font-weight: 600;">Item No</th>
          <th style="padding-bottom: 6px; font-size: 12px; color: var(--text-muted); font-weight: 600;">Name</th>
          <th style="padding-bottom: 6px; font-size: 12px; color: var(--text-muted); font-weight: 600; text-align: center;">Qty</th>
          <th style="padding-bottom: 6px; font-size: 12px; color: var(--text-muted); font-weight: 600; text-align: right;">Unit Price</th>
          <th style="padding-bottom: 6px; font-size: 12px; color: var(--text-muted); font-weight: 600; text-align: right;">Total Price</th>
        </tr>
      </thead>
      <tbody>
        ${itemsRows}
      </tbody>
    </table>

    <!-- Totals Area -->
    <div style="border-top: 1px dashed rgba(255,255,255,0.15); border-bottom: 1px dashed rgba(255,255,255,0.15); padding: 10px 0; margin-bottom: 16px; font-size: 14px; font-weight: 600; display: flex; flex-direction: column; gap: 4px;">
      <div style="display: flex; justify-content: space-between; color: var(--text-secondary);">
        <span>Subtotal:</span>
        <span>₹${parseFloat(bill.total_amount).toFixed(2)}</span>
      </div>
      <div style="display: flex; justify-content: space-between; color: var(--danger-color);">
        <span>Discount:</span>
        <span>-₹${parseFloat(bill.discount).toFixed(2)}</span>
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 16px; color: #fff; margin-top: 4px; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 4px;">
        <span>Total:</span>
        <span style="color: var(--accent-orange);">₹${parseFloat(bill.final_price).toFixed(2)}</span>
      </div>
    </div>

    <!-- Customer Details Area -->
    <div style="font-size: 13px; line-height: 1.6; color: var(--text-secondary); background: rgba(255,255,255,0.02); padding: 12px; border-radius: 8px; border: 1px solid var(--border-glass);">
      <div style="font-weight: 600; text-transform: uppercase; font-size: 11px; color: var(--text-muted); margin-bottom: 4px; letter-spacing: 0.5px;">Customer Details</div>
      <div style="display: flex; justify-content: space-between;">
        <span>Customer Name:</span>
        <strong style="color: #fff;">${custName}</strong>
      </div>
      <div style="display: flex; justify-content: space-between;">
        <span>Phone:</span>
        <strong style="color: #fff;">${custPhone}</strong>
      </div>
    </div>
  `;
}

// Low Stock Navigation Logic
function showLowStockInventory() {
  switchView('inventory-view');
  document.getElementById('inventory-search-input').value = '';
  const filtered = inventoryData.filter(item => item.qty < 5);
  renderInventoryTable(filtered);
}

// User Directory State & Handlers
let usersData = [];
let rolesData = [];

async function loadRolesData() {
  try {
    rolesData = await apiRequest('/auth/roles');
    populateUserRolesSelect(rolesData);
    renderRolesList(rolesData);
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

function populateUserRolesSelect(roles) {
  const select = document.getElementById('new_role');
  if (select) {
    select.innerHTML = roles.map(r => `<option value="${r.role_name}">${r.role_name.charAt(0).toUpperCase() + r.role_name.slice(1)}</option>`).join('');
  }
}

function renderRolesList(roles) {
  const container = document.getElementById('roles-list-container');
  if (!container) return;

  if (roles.length === 0) {
    container.innerHTML = '<span style="font-size:12px; color:var(--text-muted);">No roles found.</span>';
    return;
  }

  container.innerHTML = roles.map(r => {
    const isDefault = r.role_name === 'admin' || r.role_name === 'cashier';
    if (isDefault) {
      return `<span class="badge info" style="font-size:11px; padding: 4px 8px;">${r.role_name}</span>`;
    } else {
      return `
        <span class="badge success" style="font-size:11px; padding: 4px 8px; display: inline-flex; align-items: center; gap: 6px;">
          ${r.role_name}
          <ion-icon name="close-circle" style="font-size:14px; cursor:pointer; color:var(--danger-color);" onclick="deleteCustomRole(${r.id})"></ion-icon>
        </span>
      `;
    }
  }).join('');
}

async function handleNewRoleSubmit(e) {
  e.preventDefault();
  const roleNameInput = document.getElementById('new_role_name');
  const role_name = roleNameInput.value.trim();

  try {
    await apiRequest('/auth/roles', {
      method: 'POST',
      body: { role_name }
    });

    showToast(`Successfully created role: ${role_name}`);
    roleNameInput.value = '';
    await loadRolesData();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

async function deleteCustomRole(roleId) {
  if (!confirm('Are you sure you want to delete this custom role? This will not affect existing users until their roles are changed.')) return;

  try {
    await apiRequest(`/auth/roles/${roleId}`, {
      method: 'DELETE'
    });

    showToast('Custom role deleted successfully');
    await loadRolesData();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

async function loadUsersData() {
  try {
    await loadRolesData();
    usersData = await apiRequest('/auth/users');
    renderUsersTable(usersData);
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

function renderUsersTable(users) {
  const tableBody = document.getElementById('users-table-body');
  
  if (users.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="4" class="empty-state">No users found.</td></tr>`;
    return;
  }

  tableBody.innerHTML = users.map(u => {
    const isSelf = currentUser && u.id === currentUser.id;
    const badgeClass = u.role === 'admin' ? 'badge success' : 'badge info';
    
    return `
      <tr>
        <td><strong>#${u.id}</strong></td>
        <td>${u.username} ${isSelf ? '<small style="color: var(--text-muted)">(You)</small>' : ''}</td>
        <td><span class="${badgeClass}">${u.role}</span></td>
        <td>
          ${isSelf ? '<span style="font-size:12px; color: var(--text-muted);">No actions</span>' : `
            <button type="button" class="btn-primary" style="padding: 6px 12px; font-size: 12px;" onclick="toggleUserRole(${u.id}, '${u.role}')">
              Change Role
            </button>
            <button type="button" class="btn-danger" style="padding: 6px 12px; font-size: 12px; margin-left: 8px;" onclick="deleteUserAccount(${u.id})">
              Delete
            </button>
          `}
        </td>
      </tr>
    `;
  }).join('');
}

async function handleNewUserSubmit(e) {
  e.preventDefault();
  const username = document.getElementById('new_username').value.trim();
  const password = document.getElementById('new_password').value;
  const role = document.getElementById('new_role').value;

  try {
    await apiRequest('/auth/register', {
      method: 'POST',
      body: { username, password, role }
    });

    showToast(`Successfully registered new user: ${username}`);
    document.getElementById('new-user-form').reset();
    loadUsersData();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

async function toggleUserRole(userId, currentRole) {
  const targetRole = currentRole === 'admin' ? 'cashier' : 'admin';
  if (!confirm(`Are you sure you want to change this user's role to ${targetRole}?`)) return;

  try {
    await apiRequest(`/auth/users/${userId}/role`, {
      method: 'PUT',
      body: { role: targetRole }
    });

    showToast('User role updated successfully');
    loadUsersData();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

async function deleteUserAccount(userId) {
  if (!confirm('Are you sure you want to delete this user account? This cannot be undone.')) return;

  try {
    await apiRequest(`/auth/users/${userId}`, {
      method: 'DELETE'
    });

    showToast('User account deleted successfully');
    loadUsersData();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}
