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
    loadCustomLabels();
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

function getPermissionKeyForView(viewId) {
  const mapping = {
    'dashboard-view': 'dashboard',
    'billing-view': 'billing',
    'cart-view': 'billing',
    'pending-view': 'billing',
    'custom-bill-view': 'custom_bill',
    'custom-cart-view': 'custom_bill',
    'custom-pending-view': 'custom_bill',
    'inventory-view': 'inventory',
    'custom-bill-inventory-view': 'custom_bill_inventory',
    'customers-view': 'customers',
    'users-view': 'users',
    'labels-view': 'custom_labels',
    'menu-control-view': 'menu_control',
    'menu-order-view': 'menu_order'
  };
  return mapping[viewId] || null;
}

function adjustActionPrivileges() {
  if (currentUser && (currentUser.role === 'super_admin' || currentUser.role === 'superadmin')) {
    const invForm = document.querySelector('.inventory-form');
    if (invForm) invForm.style.display = 'block';
    const custForm = document.querySelector('.customers-container .inventory-form');
    if (custForm) custForm.style.display = 'block';
    const customInvForm = document.querySelector('#custom-bill-inventory-view .inventory-form');
    if (customInvForm) customInvForm.style.display = 'block';
    return;
  }
  const permissions = currentUser ? currentUser.permissions : null;
  if (!permissions) return;

  // 1. Inventory View Add Form
  const invForm = document.querySelector('#inventory-view .inventory-form');
  if (invForm) {
    if (permissions.inventory && permissions.inventory.add) {
      invForm.style.display = 'block';
    } else {
      invForm.style.display = 'none';
    }
  }

  // 1b. Custom Bill Inventory View Add Form
  const customInvForm = document.querySelector('#custom-bill-inventory-view .inventory-form');
  if (customInvForm) {
    if (permissions.custom_bill_inventory && permissions.custom_bill_inventory.add) {
      customInvForm.style.display = 'block';
    } else {
      customInvForm.style.display = 'none';
    }
  }

  // 2. Customer Add Form
  const custForm = document.querySelector('.customers-container .inventory-form');
  if (custForm) {
    if (permissions.customers && permissions.customers.add) {
      custForm.style.display = 'block';
    } else {
      custForm.style.display = 'none';
    }
  }
}

async function showAppLayout() {
  document.getElementById('login-screen').classList.remove('active');
  document.getElementById('app-layout').classList.add('active');
  
  // Set user profile display info
  document.getElementById('user-display-name').textContent = currentUser.username;
  document.getElementById('user-display-role').textContent = currentUser.role;

  // Load app menus and render sidebar dynamically
  await loadAppMenus();
  renderSidebarNavMenu();

  // Apply button and form privileges
  adjustActionPrivileges();
}

// Router/View Switcher
function switchView(viewId) {
  // Access control rights check
  const permissions = currentUser ? currentUser.permissions : null;
  const permKey = getPermissionKeyForView(viewId);
  if (currentUser && (currentUser.role === 'super_admin' || currentUser.role === 'superadmin')) {
    // Super Admin always has full access bypass on all views
  } else if (permKey && permissions && permissions[permKey]) {
    if (!permissions[permKey].view) {
      showToast('Access Denied: Insufficient Privileges', 'danger');
      return;
    }
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
    'users-view': 'User Account & Role Management',
    'custom-bill-view': 'Custom Bill POS System',
    'custom-cart-view': 'Custom Shopping Cart & Checkout',
    'custom-pending-view': 'Custom Pending Orders',
    'custom-bill-inventory-view': 'Custom Bill Inventory & Stock Control'
  };
  document.getElementById('page-title').textContent = titles[viewId] || 'Chicken Shop POS';

  // Toggle Global Back to POS Button visibility
  const globalBackBtn = document.getElementById('btn-global-back');
  if (globalBackBtn) {
    if (viewId === 'billing-view' || viewId === 'custom-bill-view') {
      globalBackBtn.style.display = 'none';
    } else {
      globalBackBtn.style.display = 'flex';
    }
  }

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
  } else if (viewId === 'custom-bill-view') {
    loadCustomPOSData();
  } else if (viewId === 'custom-cart-view') {
    renderCustomPOSCart();
  } else if (viewId === 'custom-bill-inventory-view') {
    loadCustomInventoryData();
  } else if (viewId === 'custom-pending-view') {
    loadCustomPendingOrdersData();
  } else if (viewId === 'labels-view') {
    loadLabelsView();
  } else if (viewId === 'menu-order-view') {
    loadMenuOrderData();
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

  // Custom Bill POS search filter
  document.getElementById('custom-bill-search-input').addEventListener('input', filterCustomPOSProducts);

  // Custom POS Add Customer Check Button
  document.getElementById('custom-btn-lookup-customer').addEventListener('click', lookupCustomerInCustomPOS);

  // Clear Custom POS Cart
  document.getElementById('custom-btn-clear-cart').addEventListener('click', clearCustomPOSCart);

  // Complete Custom POS Order
  document.getElementById('custom-btn-complete-bill').addEventListener('click', completeCustomPOSOrder);

  // Save Custom POS Pending Order
  document.getElementById('custom-btn-save-pending').addEventListener('click', saveCustomPOSPendingOrder);

  // Custom Image Upload Preview handler
  const customImageInput = document.getElementById('custom-item_image');
  if (customImageInput) {
    customImageInput.addEventListener('change', handleCustomImageUploadPreview);
  }

  const customRemovePreview = document.getElementById('custom-btn-remove-preview');
  if (customRemovePreview) {
    customRemovePreview.addEventListener('click', removeCustomImagePreview);
  }

  // Add/Edit Custom Inventory Form Submit
  document.getElementById('custom-inventory-item-form').addEventListener('submit', handleCustomInventoryFormSubmit);

  // Cancel custom edit button
  document.getElementById('custom-btn-cancel-edit').addEventListener('click', cancelCustomInventoryEdit);

  // Custom Inventory Search Filter
  document.getElementById('custom-inventory-search-input').addEventListener('input', filterCustomInventoryTable);

  // Custom Pending Search Filter
  document.getElementById('custom-pending-search-input').addEventListener('input', filterCustomPendingOrdersTable);

  // Sales History search
  document.getElementById('sales-history-search').addEventListener('input', filterSalesHistoryTable);

  // New User Register Form
  document.getElementById('new-user-form').addEventListener('submit', handleNewUserSubmit);

  // New Role Form
  document.getElementById('new-role-form').addEventListener('submit', handleNewRoleSubmit);

  // Custom Labels Form
  document.getElementById('custom-labels-form').addEventListener('submit', handleLabelsFormSubmit);

  // Menu Order Form
  document.getElementById('menu-order-form').addEventListener('submit', handleMenuOrderFormSubmit);
  document.getElementById('btn-reset-menu-order').addEventListener('click', loadMenuOrderData);

  // Edit User Form
  document.getElementById('edit-user-form').addEventListener('submit', handleEditUserFormSubmit);

  // Toggle Login Password Eye Icon Visibility
  const togglePassBtn = document.getElementById('toggle-login-password');
  if (togglePassBtn) {
    togglePassBtn.addEventListener('click', function() {
      const passwordInput = document.getElementById('password');
      const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
      passwordInput.setAttribute('type', type);
      this.setAttribute('name', type === 'password' ? 'eye-outline' : 'eye-off-outline');
    });
  }
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
    loadCustomLabels();
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

    const cartItem = cart[item.id];
    const qtyInCart = cartItem ? cartItem.qty : 0;
    
    const qtyBadge = qtyInCart > 0 
      ? `<div class="cart-qty-badge">${qtyInCart} in cart</div>`
      : '';

    const isOutOfStock = item.qty <= 0;
    const labelOutOfStock = getCustomLabelValue('out_of_stock', 'Out of Stock');
    const labelAdd = getCustomLabelValue('add_button', 'Add');
    let addBtn;
    if (isOutOfStock) {
      addBtn = `<button class="btn-add-to-cart" style="background: #333; color: #777; cursor: not-allowed;" disabled><ion-icon name="ban-outline"></ion-icon> ${labelOutOfStock}</button>`;
    } else if (qtyInCart > 0) {
      addBtn = `
        <div class="btn-add-to-cart" style="display: flex; justify-content: space-between; align-items: center; padding: 0 12px; background: var(--accent-orange); color: #fff; cursor: default;">
          <button onclick="event.stopPropagation(); updateCartQty(${item.id}, -1)" style="background: none; border: none; color: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; width: 30px; height: 100%; font-size: 20px; font-weight: bold; padding: 0;">-</button>
          <span style="font-weight: 700; font-size: 14px; user-select: none;">${qtyInCart}</span>
          <button onclick="event.stopPropagation(); updateCartQty(${item.id}, 1)" style="background: none; border: none; color: #fff; cursor: pointer; display: flex; align-items: center; justify-content: center; width: 30px; height: 100%; font-size: 20px; font-weight: bold; padding: 0;">+</button>
        </div>
      `;
    } else {
      addBtn = `<button class="btn-add-to-cart" onclick="event.stopPropagation(); addToPOSCart(${item.id})"><ion-icon name="basket-outline"></ion-icon> ${labelAdd}</button>`;
    }

    return `
      <div class="product-card">
        ${qtyBadge}
        ${imgTag}
        <h4>${item.item_name}</h4>
        <div class="price">₹${item.price}</div>
        <div class="stock-tag ${isLow ? 'low' : ''}" style="margin-bottom: 4px;">Stock: ${item.qty}</div>
        ${addBtn}
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

  // Sync the POS product card selector buttons in real-time
  if (typeof inventoryData !== 'undefined' && inventoryData && inventoryData.length > 0) {
    filterPOSProducts();
  }

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
        id: activePendingBillId,
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

  const permissions = currentUser ? currentUser.permissions : null;
  const showEdit = !permissions || (permissions.inventory && permissions.inventory.edit);
  const showDelete = !permissions || (permissions.inventory && permissions.inventory.delete);

  tableBody.innerHTML = items.map(item => {
    const isLow = item.qty < 5;
    const statusTag = item.qty <= 0 
      ? `<span class="badge danger">Out of Stock</span>`
      : (isLow ? `<span class="badge warning">Low Stock</span>` : `<span class="badge success">In Stock</span>`);
    
    const imgUrl = item.image_url ? item.image_url : '';
    const imgTag = imgUrl 
      ? `<img src="${imgUrl}" alt="${item.item_name}" class="image-cell">`
      : `<div class="image-cell"><ion-icon name="fast-food-outline"></ion-icon></div>`;

    const editBtn = showEdit 
      ? `<button type="button" class="btn-icon-edit" onclick="startEditItem(${item.id})" title="Edit Item"><ion-icon name="create-outline"></ion-icon></button>`
      : '';
    const deleteBtn = showDelete 
      ? `<button type="button" class="btn-icon-delete" onclick="deleteItem(${item.id})" title="Delete Item"><ion-icon name="trash-outline"></ion-icon></button>`
      : '';

    return `
      <tr id="inventory-row-${item.id}">
        <td>${imgTag}</td>
        <td><strong>${item.item_name}</strong><br><small style="color: var(--text-secondary)">${item.description || 'No description'}</small></td>
        <td>₹${parseFloat(item.price).toFixed(2)}</td>
        <td>${item.qty}</td>
        <td>${statusTag}</td>
        <td>
          <div class="table-actions">
            ${editBtn}
            ${deleteBtn}
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
    let image_url = null;
    if (fileInput.files[0]) {
      image_url = await fileToBase64(fileInput.files[0]);
    } else {
      // If editing and no new image is uploaded, check if the preview container is still visible.
      // If visible, keep the original image URL!
      const previewContainer = document.getElementById('image-preview-container');
      if (editingItemId && !previewContainer.classList.contains('hidden')) {
        const originalItem = inventoryData.find(i => i.id === editingItemId);
        image_url = originalItem ? originalItem.image_url : null;
      }
    }

    const payload = {
      item_name: name,
      description,
      qty,
      price,
      image_url
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
    renderPrivilegeMatrix(rolesData);
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
    const isDefault = r.role_name === 'admin' || r.role_name === 'cashier' || r.role_name === 'super_admin' || r.role_name === 'superadmin';
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
    const isSuperOrAdmin = u.role === 'super_admin' || u.role === 'superadmin' || u.role === 'admin';
    const badgeClass = isSuperOrAdmin ? 'badge success' : 'badge info';
    
    return `
      <tr>
        <td><strong>#${u.id}</strong></td>
        <td>${u.username} ${isSelf ? '<small style="color: var(--text-muted)">(You)</small>' : ''}</td>
        <td><span class="${badgeClass}">${u.role}</span></td>
        <td>
          ${isSelf ? '<span style="font-size:12px; color: var(--text-muted);">No actions</span>' : `
            <button type="button" class="btn-primary" style="padding: 6px 12px; font-size: 12px;" onclick="openUserEditModal(${u.id}, '${u.username}', '${u.role}')">
              Edit
            </button>
            <button type="button" class="btn-danger" style="padding: 6px 12px; font-size: 12px; margin-left: 6px;" onclick="deleteUserAccount(${u.id})">
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

function renderPrivilegeMatrix(roles) {
  const container = document.getElementById('privilege-matrix-body');
  if (!container) return;

  if (roles.length === 0) {
    container.innerHTML = '<tr><td colspan="6" class="empty-state">No roles found.</td></tr>';
    return;
  }

  const menus = ['dashboard', 'billing', 'cart', 'pending', 'inventory', 'customers', 'users', 'custom_labels', 'custom_bill', 'custom_bill_inventory', 'menu_control', 'menu_order'];

  container.innerHTML = roles.map(r => {
    const isSuperAdmin = r.role_name === 'super_admin' || r.role_name === 'superadmin';
    const permissions = r.permissions || {};

    const columnsHtml = menus.map(menu => {
      const menuPerms = permissions[menu] || { view: false, add: false, edit: false, delete: false };
      
      const showAdd = menu === 'billing' || menu === 'inventory' || menu === 'customers' || menu === 'users' || menu === 'custom_bill' || menu === 'custom_bill_inventory';
      const showEdit = menu === 'inventory' || menu === 'users' || menu === 'custom_bill_inventory' || menu === 'menu_order';
      const showDelete = menu === 'billing' || menu === 'inventory' || menu === 'users' || menu === 'pending' || menu === 'custom_bill' || menu === 'custom_bill_inventory';
      
      const viewChecked = menuPerms.view ? 'checked' : '';
      const addChecked = menuPerms.add ? 'checked' : '';
      const editChecked = menuPerms.edit ? 'checked' : '';
      const deleteChecked = menuPerms.delete ? 'checked' : '';

      const disabledAttr = isSuperAdmin ? 'disabled' : '';

      return `
        <td style="padding: 12px; vertical-align: middle; text-align: center; border-bottom: 1px solid var(--border-glass);">
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 6px; text-align: left; font-size: 11px; max-width: 140px; margin: 0 auto;">
            <label style="display: flex; align-items: center; gap: 4px; cursor: ${isSuperAdmin ? 'default' : 'pointer'}; color: #fff;">
              <input type="checkbox" class="perm-checkbox" data-role-id="${r.id}" data-menu="${menu}" data-action="view" ${viewChecked} ${disabledAttr}> View
            </label>
            ${showAdd ? `
              <label style="display: flex; align-items: center; gap: 4px; cursor: ${isSuperAdmin ? 'default' : 'pointer'}; color: #fff;">
                <input type="checkbox" class="perm-checkbox" data-role-id="${r.id}" data-menu="${menu}" data-action="add" ${addChecked} ${disabledAttr}> Add
              </label>
            ` : ''}
            ${showEdit ? `
              <label style="display: flex; align-items: center; gap: 4px; cursor: ${isSuperAdmin ? 'default' : 'pointer'}; color: #fff;">
                <input type="checkbox" class="perm-checkbox" data-role-id="${r.id}" data-menu="${menu}" data-action="edit" ${editChecked} ${disabledAttr}> Edit
              </label>
            ` : ''}
            ${showDelete ? `
              <label style="display: flex; align-items: center; gap: 4px; cursor: ${isSuperAdmin ? 'default' : 'pointer'}; color: #fff;">
                <input type="checkbox" class="perm-checkbox" data-role-id="${r.id}" data-menu="${menu}" data-action="delete" ${deleteChecked} ${disabledAttr}> Del
              </label>
            ` : ''}
          </div>
        </td>
      `;
    }).join('');

    return `
      <tr style="border-bottom: 1px solid var(--border-glass);">
        <td style="padding: 12px; border-bottom: 1px solid var(--border-glass); vertical-align: middle;">
          <span class="badge ${isSuperAdmin ? 'success' : 'info'}" style="text-transform: capitalize; font-weight: 700;">${r.role_name}</span>
        </td>
        ${columnsHtml}
      </tr>
    `;
  }).join('');
}

async function saveRolePrivileges() {
  const checkboxes = document.querySelectorAll('.perm-checkbox');
  const rolePermissions = {};

  rolesData.forEach(r => {
    if (r.role_name === 'super_admin' || r.role_name === 'superadmin') return;
    rolePermissions[r.id] = {
      dashboard: { view: false, add: false, edit: false, delete: false },
      billing: { view: false, add: false, edit: false, delete: false },
      cart: { view: false, add: false, edit: false, delete: false },
      pending: { view: false, add: false, edit: false, delete: false },
      inventory: { view: false, add: false, edit: false, delete: false },
      customers: { view: false, add: false, edit: false, delete: false },
      users: { view: false, add: false, edit: false, delete: false },
      custom_labels: { view: false, add: false, edit: false, delete: false }
    };
  });

  checkboxes.forEach(cb => {
    const roleId = cb.getAttribute('data-role-id');
    const menu = cb.getAttribute('data-menu');
    const action = cb.getAttribute('data-action');
    const checked = cb.checked;

    if (rolePermissions[roleId]) {
      rolePermissions[roleId][menu][action] = checked;
    }
  });

  try {
    for (const [roleId, perms] of Object.entries(rolePermissions)) {
      await apiRequest(`/auth/roles/${roleId}/permissions`, {
        method: 'PUT',
        body: { permissions: perms }
      });
    }

    showToast('Role privileges updated successfully!', 'success');
    
    // If the active user's permissions changed, update locally
    const activeRole = rolesData.find(r => r.role_name === currentUser.role);
    if (activeRole && rolePermissions[activeRole.id]) {
      currentUser.permissions = rolePermissions[activeRole.id];
      localStorage.setItem('user', JSON.stringify(currentUser));
      showAppLayout();
    }
    await loadRolesData();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

// Custom Labels Management System
let customLabels = [];

async function loadCustomLabels() {
  try {
    const data = await apiRequest('/custom-labels');
    customLabels = data;
    applyCustomLabels();
  } catch (err) {
    console.error('Failed to load custom labels:', err);
  }
}

function applyCustomLabels() {
  // Update spans/paragraphs with class label-XYZ
  customLabels.forEach(item => {
    const elements = document.querySelectorAll(`.label-${item.label_key}`);
    elements.forEach(el => {
      if (el.children.length === 0) {
        el.textContent = item.custom_label;
      } else {
        for (const child of el.childNodes) {
          if (child.nodeType === Node.TEXT_NODE) {
            child.nodeValue = item.custom_label;
          }
        }
      }
    });
  });
  
  // Also update specific headings and titles dynamically!
  const billingTitle = getCustomLabelValue('billing_menu', 'Billing & POS');
  const viewCartTitle = getCustomLabelValue('view_cart', 'View Cart');
  const pendingOrdersTitle = getCustomLabelValue('pending_orders', 'Pending Orders');
  const overviewTitle = getCustomLabelValue('overview_menu', 'Overview');
  const inventoryTitle = getCustomLabelValue('inventory_menu', 'Inventory');
  const customersTitle = getCustomLabelValue('customers_menu', 'Customers');
  const usersTitle = getCustomLabelValue('users_menu', 'User Management');
  const customLabelsTitle = getCustomLabelValue('custom_labels_menu', 'Custom Label');

  const titles = {
    'dashboard-view': overviewTitle,
    'billing-view': billingTitle,
    'cart-view': getCustomLabelValue('view_cart_details', 'View Cart Details'),
    'inventory-view': inventoryTitle,
    'customers-view': customersTitle,
    'pending-view': pendingOrdersTitle,
    'users-view': usersTitle,
    'labels-view': customLabelsTitle
  };
  
  const activeView = document.querySelector('.app-view.active');
  if (activeView) {
    document.getElementById('page-title').textContent = titles[activeView.id] || 'Chicken Shop POS';
  }

  // Apply Custom Logo Image
  const logoUrl = getCustomLabelValue('app_logo', '');
  const loginLogo = document.getElementById('login-logo-container');
  if (loginLogo) {
    if (logoUrl) {
      loginLogo.innerHTML = `<img src="${logoUrl}" style="width: 100%; height: 100%; object-fit: contain; border-radius: 8px;">`;
    } else {
      loginLogo.innerHTML = `<ion-icon name="restaurant"></ion-icon>`;
    }
  }

  const sidebarLogo = document.getElementById('sidebar-logo-container');
  if (sidebarLogo) {
    if (logoUrl) {
      sidebarLogo.innerHTML = `
        <img src="${logoUrl}" style="width: 32px; height: 32px; object-fit: contain; border-radius: 4px;">
        <h2 class="label-billing_menu">${billingTitle}</h2>
      `;
    } else {
      sidebarLogo.innerHTML = `
        <ion-icon name="restaurant" class="logo-icon"></ion-icon>
        <h2 class="label-billing_menu">${billingTitle}</h2>
      `;
    }
  }
}

function getCustomLabelValue(key, defaultVal) {
  const item = customLabels.find(l => l.label_key === key);
  return item ? item.custom_label : defaultVal;
}

function loadLabelsView() {
  const container = document.getElementById('labels-editor-container');
  container.innerHTML = '';
  
  const groups = {};
  customLabels.forEach(l => {
    if (!groups[l.menu_key]) {
      groups[l.menu_key] = [];
    }
    groups[l.menu_key].push(l);
  });
  
  Object.keys(groups).forEach(menuKey => {
    let sectionTitle = menuKey.toUpperCase();
    if (menuKey === 'billing') sectionTitle = 'Billing & POS';
    else if (menuKey === 'overview') sectionTitle = 'Overview & Dashboard';
    else if (menuKey === 'inventory') sectionTitle = 'Inventory Control';
    else if (menuKey === 'customers') sectionTitle = 'Customer Directory';
    else if (menuKey === 'users') sectionTitle = 'User Management';
    else if (menuKey === 'custom_labels') sectionTitle = 'Custom Labels';

    const sectionHTML = `
      <div style="background: rgba(255,255,255,0.02); padding: 16px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.05);">
        <h3 style="margin-bottom: 12px; border-bottom: 1px dashed rgba(255,255,255,0.1); padding-bottom: 6px; color: var(--accent-orange);">${sectionTitle}</h3>
        <div style="display: flex; flex-direction: column; gap: 12px;">
          ${groups[menuKey].map(l => {
            if (l.label_key === 'app_logo') {
              return `
                <div style="display: flex; flex-direction: column; gap: 8px;">
                  <div style="display: flex; align-items: center; justify-content: space-between; gap: 16px;">
                    <span style="font-size: 13px; font-weight: 500; color: #fff; flex: 1;">${l.label_name}</span>
                    <div style="display: flex; align-items: center; gap: 12px; flex: 1.5;">
                      <input type="hidden" data-key="${l.label_key}" id="app_logo_url_input" value="${l.custom_label}">
                      <input type="file" id="app_logo_file_input" accept="image/*" style="display: none;" onchange="handleAppLogoUpload(this)">
                      <button type="button" class="btn-secondary" onclick="document.getElementById('app_logo_file_input').click()" style="padding: 6px 12px; font-size: 12px; border-radius: 4px;">Choose Image</button>
                      <span id="app_logo_filename" style="font-size: 11px; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 150px;">
                        ${l.custom_label ? 'Custom Logo Active' : 'No Logo Uploaded'}
                      </span>
                    </div>
                  </div>
                  ${l.custom_label ? `
                    <div style="margin-top: 4px; display: flex; align-items: center; gap: 8px;">
                      <img src="${l.custom_label}" style="max-height: 40px; border-radius: 4px; border: 1px solid var(--border-glass);">
                      <button type="button" class="btn-icon-delete" onclick="removeAppLogo()" title="Remove Logo"><ion-icon name="trash-outline"></ion-icon></button>
                    </div>
                  ` : ''}
                </div>
              `;
            }
            return `
              <div style="display: flex; align-items: center; justify-content: space-between; gap: 16px;">
                <span style="font-size: 13px; font-weight: 500; color: #fff; flex: 1;">${l.label_name}</span>
                <input type="text" data-key="${l.label_key}" value="${l.custom_label}" style="background: rgba(0,0,0,0.2); color: #fff; border: 1px solid var(--border-glass); padding: 8px 12px; border-radius: 4px; flex: 1.5; font-size: 13px;">
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `;
    container.insertAdjacentHTML('beforeend', sectionHTML);
  });
}

function handleAppLogoUpload(input) {
  if (input.files && input.files[0]) {
    const file = input.files[0];
    document.getElementById('app_logo_filename').textContent = file.name;
    const reader = new FileReader();
    reader.onload = function(e) {
      document.getElementById('app_logo_url_input').value = e.target.result;
    };
    reader.readAsDataURL(file);
  }
}

function removeAppLogo() {
  if (confirm('Are you sure you want to remove the custom app logo and revert to the default icon?')) {
    document.getElementById('app_logo_url_input').value = '';
    const btnSave = document.querySelector('#custom-labels-form button[type="submit"]');
    if (btnSave) btnSave.click();
  }
}

async function handleLabelsFormSubmit(e) {
  e.preventDefault();
  const inputs = document.querySelectorAll('#labels-editor-container input');
  const labelsToUpdate = [];
  
  inputs.forEach(input => {
    labelsToUpdate.push({
      label_key: input.getAttribute('data-key'),
      custom_label: input.value.trim()
    });
  });
  
  try {
    const updated = await apiRequest('/custom-labels', {
      method: 'PUT',
      body: { labels: labelsToUpdate }
    });
    customLabels = updated;
    applyCustomLabels();
    showToast('Custom labels updated successfully!', 'success');
    loadLabelsView(); // Refresh uploader layout state
  } catch (err) {
    showToast('Failed to save labels: ' + err.message, 'danger');
  }
}

// User Edit Modal Logic
function openUserEditModal(id, username, role) {
  document.getElementById('edit_user_id').value = id;
  document.getElementById('edit_username').value = username;
  document.getElementById('edit_password').value = '';
  
  const roleSelect = document.getElementById('edit_role');
  roleSelect.innerHTML = '';
  rolesData.forEach(r => {
    const opt = document.createElement('option');
    opt.value = r.role_name;
    opt.textContent = r.role_name;
    if (r.role_name === role) opt.selected = true;
    roleSelect.appendChild(opt);
  });
  
  document.getElementById('user-edit-modal').classList.remove('hidden');
  document.getElementById('user-edit-modal').classList.add('active');
}

function closeUserEditModal() {
  document.getElementById('user-edit-modal').classList.remove('active');
  document.getElementById('user-edit-modal').classList.add('hidden');
}

async function handleEditUserFormSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('edit_user_id').value;
  const username = document.getElementById('edit_username').value.trim();
  const password = document.getElementById('edit_password').value.trim();
  const role = document.getElementById('edit_role').value;
  
  if (password && password.length < 6) {
    showToast('Password must be at least 6 characters long', 'warning');
    return;
  }
  
  try {
    await apiRequest(`/auth/users/${id}`, {
      method: 'PUT',
      body: { username, password, role }
    });
    
    showToast('User account updated successfully!', 'success');
    closeUserEditModal();
    loadUsersData();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

// Expose functions globally for inline HTML event handlers
window.openUserEditModal = openUserEditModal;
window.closeUserEditModal = closeUserEditModal;
window.deleteUserAccount = deleteUserAccount;

// ==========================================
// Custom Bill & Weight-Based POS Features
// ==========================================
let customBillCart = {};
let customBillInventoryData = [];
let customPendingBillsData = [];
let customSelectedCustomer = null;
let activeCustomPendingBillId = null;
let editingCustomItemId = null;

// Custom POS Load & Render Products
async function loadCustomPOSData() {
  try {
    const data = await apiRequest('/inventory');
    customBillInventoryData = data.filter(item => item.is_custom_bill === true);
    renderCustomPOSProducts(customBillInventoryData);
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

function renderCustomPOSProducts(products) {
  const grid = document.getElementById('custom-bill-products-grid');
  if (!grid) return;

  if (products.length === 0) {
    grid.innerHTML = `<div class="empty-state" style="grid-column: 1/-1">No custom bill items found. Go to Custom Bill Inventory to add items first!</div>`;
    return;
  }

  grid.innerHTML = products.map(item => {
    const isLow = parseFloat(item.qty) < 5.0;
    const imgUrl = item.image_url ? item.image_url : '';
    const imgTag = imgUrl 
      ? `<img src="${imgUrl}" alt="${item.item_name}" class="product-image">`
      : `<div class="product-image"><ion-icon name="calculator-outline"></ion-icon></div>`;

    const cartItem = customBillCart[item.id];
    const qtyInCart = cartItem ? cartItem.qty : 0;
    const qtyBadge = qtyInCart > 0 
      ? `<div class="cart-qty-badge">${qtyInCart} kg in cart</div>`
      : '';

    const isOutOfStock = parseFloat(item.qty) <= 0;
    let addBtn;
    if (isOutOfStock) {
      addBtn = `<button class="btn-add-to-cart" style="background: #333; color: #777; cursor: not-allowed;" disabled><ion-icon name="ban-outline"></ion-icon> Out of Stock</button>`;
    } else {
      const btnText = qtyInCart > 0 ? `Update (${qtyInCart} kg)` : 'Add Weight';
      addBtn = `<button class="btn-add-to-cart" onclick="event.stopPropagation(); addCustomPOSProduct(${item.id})"><ion-icon name="basket-outline"></ion-icon> ${btnText}</button>`;
    }

    return `
      <div class="product-card" onclick="addCustomPOSProduct(${item.id})">
        ${qtyBadge}
        ${imgTag}
        <h4>${item.item_name}</h4>
        <div class="price">₹${item.price} / kg</div>
        <div class="stock-tag ${isLow ? 'low' : ''}" style="margin-bottom: 4px;">Stock: ${item.qty} kg</div>
        ${addBtn}
      </div>
    `;
  }).join('');
}

function filterCustomPOSProducts() {
  const query = document.getElementById('custom-bill-search-input').value.toLowerCase().trim();
  const filtered = customBillInventoryData.filter(item => 
    item.item_name.toLowerCase().includes(query) || 
    (item.description && item.description.toLowerCase().includes(query))
  );
  renderCustomPOSProducts(filtered);
}

// Add weight-based product to cart
async function addCustomPOSProduct(itemId) {
  const item = customBillInventoryData.find(i => i.id === itemId);
  if (!item) return;

  if (parseFloat(item.qty) <= 0) {
    showToast(`${item.item_name} is out of stock!`, 'danger');
    return;
  }

  const currentQty = customBillCart[itemId] ? customBillCart[itemId].qty : 0;
  const val = prompt(`Enter weight for ${item.item_name} in kg (Price: ₹${item.price}/kg):`, currentQty > 0 ? currentQty : '3');
  if (val === null) return; // Cancelled

  const cleanVal = val.replace(/[^\d.]/g, '');
  const parsedQty = parseFloat(cleanVal);
  if (isNaN(parsedQty) || parsedQty <= 0) {
    showToast('Invalid weight quantity entered', 'warning');
    return;
  }

  if (parsedQty > parseFloat(item.qty)) {
    showToast(`Cannot add weight. Only ${item.qty} kg in stock.`, 'warning');
    return;
  }

  customBillCart[itemId] = { item, qty: parsedQty };
  renderCustomPOSCart();
  showToast(`Added ${parsedQty} kg of ${item.item_name} to cart.`);
}

function updateCustomCartQty(itemId, change) {
  const cartItem = customBillCart[itemId];
  if (!cartItem) return;

  const newQty = cartItem.qty + change;
  if (newQty <= 0) {
    delete customBillCart[itemId];
  } else {
    if (newQty > parseFloat(cartItem.item.qty)) {
      showToast(`Cannot add weight. Only ${cartItem.item.qty} kg in stock.`, 'warning');
      return;
    }
    cartItem.qty = parseFloat(newQty.toFixed(2));
  }
  renderCustomPOSCart();
}

function updateCustomCartBadges() {
  const totalQty = Object.values(customBillCart).reduce((sum, entry) => sum + entry.qty, 0);
  const badgeVal = parseFloat(totalQty.toFixed(2));
  
  const customBadge = document.getElementById('custom-bill-cart-badge');
  if (customBadge) customBadge.textContent = badgeVal;

  const sidebarBadge = document.getElementById('custom-cart-badge-count');
  if (sidebarBadge) {
    sidebarBadge.textContent = badgeVal;
    if (badgeVal > 0) {
      sidebarBadge.classList.remove('hidden');
    } else {
      sidebarBadge.classList.add('hidden');
    }
  }
}

function renderCustomPOSCart() {
  updateCustomCartBadges();

  if (typeof customBillInventoryData !== 'undefined' && customBillInventoryData && customBillInventoryData.length > 0) {
    filterCustomPOSProducts();
  }

  const cartContainer = document.getElementById('custom-cart-items-list');
  const cartEntries = Object.values(customBillCart);

  if (cartEntries.length === 0) {
    cartContainer.innerHTML = `
      <div class="empty-cart-state">
        <ion-icon name="basket-outline"></ion-icon>
        <p>Your cart is empty</p>
        <small>Go back to Custom Bill to add items</small>
      </div>
    `;
    document.getElementById('custom-cart-subtotal').textContent = '₹0.00';
    document.getElementById('custom-cart-final-total').textContent = '₹0.00';
    return;
  }

  cartContainer.innerHTML = cartEntries.map(entry => {
    const item = entry.item;
    const subtotal = item.price * entry.qty;
    const imgUrl = item.image_url ? item.image_url : '';
    const imgTag = imgUrl 
      ? `<img src="${imgUrl}" alt="${item.item_name}" style="width: 50px; height: 50px; border-radius: 6px; object-fit: cover;">`
      : `<div style="width: 50px; height: 50px; border-radius: 6px; background: rgba(255,255,255,0.05); display: flex; align-items: center; justify-content: center;"><ion-icon name="calculator-outline"></ion-icon></div>`;

    return `
      <div class="cart-item" style="display: flex; align-items: center; gap: 12px; padding: 12px; background: rgba(255, 255, 255, 0.03); border-radius: 8px;">
        ${imgTag}
        <div style="flex: 1;">
          <h4 style="font-size: 14px; font-weight: 500; color: #fff; margin-bottom: 2px;">${item.item_name}</h4>
          <span style="font-size: 12px; color: var(--text-muted);">₹${item.price} / kg</span>
        </div>
        <div style="display: flex; align-items: center; gap: 10px; background: rgba(0,0,0,0.2); border-radius: 6px; padding: 4px 8px;">
          <button onclick="updateCustomCartQty(${item.id}, -0.5)" style="background:none; border:none; color:#fff; cursor:pointer; font-weight:bold;">-</button>
          <span style="font-size:13px; font-weight:bold; min-width: 50px; text-align: center;">${entry.qty} kg</span>
          <button onclick="updateCustomCartQty(${item.id}, 0.5)" style="background:none; border:none; color:#fff; cursor:pointer; font-weight:bold;">+</button>
        </div>
        <div style="font-size: 14px; font-weight: 600; color: #fff; min-width: 80px; text-align: right;">₹${subtotal.toFixed(2)}</div>
        <button onclick="updateCustomCartQty(${item.id}, -${entry.qty})" style="background:none; border:none; color:var(--danger-red); cursor:pointer; padding: 4px;">
          <ion-icon name="trash-outline" style="font-size: 18px;"></ion-icon>
        </button>
      </div>
    `;
  }).join('');

  // Calculate Subtotal & Total
  const subtotal = cartEntries.reduce((sum, entry) => sum + (entry.item.price * entry.qty), 0);
  const discountInput = document.getElementById('custom-cart-discount');
  const discount = parseFloat(discountInput.value) || 0;
  const finalTotal = Math.max(0, subtotal - discount);

  document.getElementById('custom-cart-subtotal').textContent = `₹${subtotal.toFixed(2)}`;
  document.getElementById('custom-cart-final-total').textContent = `₹${finalTotal.toFixed(2)}`;

  // Bind discount updates dynamically
  discountInput.oninput = () => {
    const val = parseFloat(discountInput.value) || 0;
    const cleanFinal = Math.max(0, subtotal - val);
    document.getElementById('custom-cart-final-total').textContent = `₹${cleanFinal.toFixed(2)}`;
  };
}

function clearCustomPOSCart() {
  if (Object.keys(customBillCart).length === 0) return;
  if (!confirm('Are you sure you want to clear the custom cart?')) return;
  customBillCart = {};
  customSelectedCustomer = null;
  activeCustomPendingBillId = null;
  document.getElementById('custom-cart-customer-phone').value = '';
  const nameEl = document.getElementById('custom-customer-name-display');
  if (nameEl) nameEl.classList.add('hidden');
  document.getElementById('custom-cart-discount').value = 0;
  renderCustomPOSCart();
  showToast('Custom cart cleared');
}

// Custom Customer Verification & Registration
async function lookupCustomerInCustomPOS() {
  const phone = document.getElementById('custom-cart-customer-phone').value.trim();
  if (!phone) {
    showToast('Please enter a phone number', 'warning');
    return;
  }
  try {
    const data = await apiRequest(`/customers/${phone}`);
    if (data && data.name) {
      customSelectedCustomer = data;
      document.getElementById('custom-lbl-customer-name').textContent = data.name;
      document.getElementById('custom-customer-name-display').classList.remove('hidden');
      showToast(`Welcome back, ${data.name}!`);
    } else {
      // Trigger new customer registration modal
      document.getElementById('modal-phone-num').textContent = phone;
      document.getElementById('customer-modal').classList.remove('hidden');
      document.getElementById('customer-modal').classList.add('active');
    }
  } catch (err) {
    // If not found, open modal
    document.getElementById('modal-phone-num').textContent = phone;
    document.getElementById('customer-modal').classList.remove('hidden');
    document.getElementById('customer-modal').classList.add('active');
  }
}

// Complete Custom Order
async function completeCustomPOSOrder() {
  const cartEntries = Object.values(customBillCart);
  if (cartEntries.length === 0) {
    showToast('Custom cart is empty', 'warning');
    return;
  }

  const phone = document.getElementById('custom-cart-customer-phone').value.trim();
  if (!phone) {
    showToast('Customer phone number is required to complete bill', 'warning');
    return;
  }

  // Auto-lookup if not already loaded
  if (!customSelectedCustomer || customSelectedCustomer.phone_no !== phone) {
    await lookupCustomerInCustomPOS();
    if (!customSelectedCustomer) return;
  }

  const subtotal = cartEntries.reduce((sum, entry) => sum + (entry.item.price * entry.qty), 0);
  const discount = parseFloat(document.getElementById('custom-cart-discount').value) || 0;
  const finalTotal = Math.max(0, subtotal - discount);

  const checkoutItems = cartEntries.map(entry => ({
    id: entry.item.id,
    item_name: entry.item.item_name,
    qty: entry.qty,
    price: entry.item.price
  }));

  try {
    const bill = await apiRequest('/billing/complete', {
      method: 'POST',
      body: {
        customer_phone: customSelectedCustomer.phone_no || phone,
        items: checkoutItems,
        total_amount: subtotal,
        discount: discount,
        final_price: finalTotal,
        pending_bill_id: activeCustomPendingBillId
      }
    });

    showToast('Bill completed and printed successfully!', 'success');
    
    // Clear state
    customBillCart = {};
    customSelectedCustomer = null;
    activeCustomPendingBillId = null;
    document.getElementById('custom-cart-customer-phone').value = '';
    document.getElementById('custom-customer-name-display').classList.add('hidden');
    document.getElementById('custom-cart-discount').value = 0;
    
    // Render receipt view using standard invoice modal
    showReceiptModal(bill);
    
    renderCustomPOSCart();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

// Save Custom POS Pending Order
async function saveCustomPOSPendingOrder() {
  const cartEntries = Object.values(customBillCart);
  if (cartEntries.length === 0) {
    showToast('Cart is empty, cannot save pending', 'warning');
    return;
  }

  const subtotal = cartEntries.reduce((sum, entry) => sum + (entry.item.price * entry.qty), 0);
  const checkoutItems = cartEntries.map(entry => ({
    id: entry.item.id,
    item_name: entry.item.item_name,
    qty: entry.qty,
    price: entry.item.price
  }));

  try {
    await apiRequest('/billing/pending', {
      method: 'POST',
      body: {
        id: activeCustomPendingBillId,
        items: checkoutItems,
        subtotal: subtotal,
        is_custom_bill: true
      }
    });

    showToast('Custom pending bill saved successfully!');
    customBillCart = {};
    activeCustomPendingBillId = null;
    document.getElementById('custom-cart-customer-phone').value = '';
    document.getElementById('custom-customer-name-display').classList.add('hidden');
    document.getElementById('custom-cart-discount').value = 0;
    renderCustomPOSCart();
    switchView('custom-bill-view');
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

// Custom Pending Orders Management
async function loadCustomPendingOrdersData() {
  try {
    customPendingBillsData = await apiRequest('/billing/pending?custom=true');
    renderCustomPendingOrders(customPendingBillsData);
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

function renderCustomPendingOrders(bills) {
  const grid = document.getElementById('custom-pending-orders-grid');
  if (!grid) return;

  if (bills.length === 0) {
    grid.innerHTML = `<div class="empty-state" style="grid-column: 1/-1">No custom pending orders found.</div>`;
    return;
  }

  grid.innerHTML = bills.map(bill => {
    const itemsList = bill.items.map(item => `${item.qty} kg x ${item.item_name}`).join(', ');
    const savedTime = new Date(bill.saved_at).toLocaleString('en-IN');
    
    return `
      <div class="pending-card glass" style="padding: 20px; display: flex; flex-direction: column; gap: 12px; border-radius: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <strong style="color: #fff;">Order #${bill.id}</strong>
          <span style="font-size: 12px; color: var(--accent-orange); font-weight: 600;">₹${parseFloat(bill.subtotal).toFixed(2)}</span>
        </div>
        <p style="font-size: 13px; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${itemsList}</p>
        <span style="font-size: 11px; color: var(--text-muted);">${savedTime}</span>
        <div style="display: flex; gap: 8px; justify-content: flex-end; margin-top: 8px;">
          <button onclick="deleteCustomPendingOrder(${bill.id})" class="btn-text-danger" style="font-size: 12px; padding: 6px 12px;">Delete</button>
          <button onclick="recallCustomPendingOrder(${bill.id})" class="btn-primary" style="font-size: 12px; padding: 6px 12px; border-radius: 4px;">Recall</button>
        </div>
      </div>
    `;
  }).join('');
}

function filterCustomPendingOrdersTable() {
  const query = document.getElementById('custom-pending-search-input').value.trim();
  if (!query) {
    renderCustomPendingOrders(customPendingBillsData);
    return;
  }
  const filtered = customPendingBillsData.filter(bill => 
    bill.id.toString() === query ||
    bill.items.some(i => i.item_name.toLowerCase().includes(query.toLowerCase()))
  );
  renderCustomPendingOrders(filtered);
}

async function recallCustomPendingOrder(billId) {
  const bill = customPendingBillsData.find(b => b.id === billId);
  if (!bill) return;

  // Populate cart
  customBillCart = {};
  bill.items.forEach(i => {
    customBillCart[i.id] = {
      item: { id: i.id, item_name: i.item_name, price: i.price, qty: 9999 }, // placeholder stock
      qty: parseFloat(i.qty)
    };
  });

  activeCustomPendingBillId = bill.id;
  renderCustomPOSCart();
  switchView('custom-cart-view');
  showToast(`Recalled Custom Pending Order #${bill.id}`);
}

async function deleteCustomPendingOrder(billId) {
  if (!confirm('Are you sure you want to delete this custom pending order?')) return;
  try {
    await apiRequest(`/billing/pending/${billId}`, { method: 'DELETE' });
    showToast('Pending order deleted');
    loadCustomPendingOrdersData();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

// Custom Bill Inventory CRUD Handlers
async function loadCustomInventoryData() {
  try {
    const data = await apiRequest('/inventory');
    customBillInventoryData = data.filter(item => item.is_custom_bill === true);
    renderCustomInventoryTable(customBillInventoryData);
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

function renderCustomInventoryTable(items) {
  const tbody = document.getElementById('custom-inventory-table-body');
  if (!tbody) return;

  if (items.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="empty-state">No custom bill items in stock. Create one now!</td></tr>`;
    return;
  }

  tbody.innerHTML = items.map(item => {
    const isLow = parseFloat(item.qty) < 5.0;
    const statusClass = parseFloat(item.qty) <= 0 
      ? 'badge danger' 
      : isLow 
        ? 'badge warning' 
        : 'badge success';
    const statusText = parseFloat(item.qty) <= 0 
      ? 'Out of Stock' 
      : isLow 
        ? 'Low Stock' 
        : 'In Stock';

    const imgTag = item.image_url 
      ? `<img src="${item.image_url}" alt="${item.item_name}" style="width: 40px; height: 40px; border-radius: 4px; object-fit: cover;">`
      : `<div style="width: 40px; height: 40px; border-radius: 4px; background: rgba(255,255,255,0.05); display: flex; align-items: center; justify-content: center;"><ion-icon name="calculator-outline"></ion-icon></div>`;

    return `
      <tr>
        <td>${imgTag}</td>
        <td><strong>${item.item_name}</strong></td>
        <td>₹${item.price} per kg</td>
        <td>${item.qty} kg</td>
        <td><span class="${statusClass}">${statusText}</span></td>
        <td>
          <button class="btn-primary" style="padding: 6px 12px; font-size: 12px;" onclick="editCustomItem(${item.id})">Edit</button>
          <button class="btn-danger" style="padding: 6px 12px; font-size: 12px; margin-left: 4px;" onclick="deleteCustomItem(${item.id})">Delete</button>
        </td>
      </tr>
    `;
  }).join('');
}

function filterCustomInventoryTable() {
  const query = document.getElementById('custom-inventory-search-input').value.toLowerCase().trim();
  const filtered = customBillInventoryData.filter(item => 
    item.item_name.toLowerCase().includes(query) ||
    (item.description && item.description.toLowerCase().includes(query))
  );
  renderCustomInventoryTable(filtered);
}

// Add or Edit Custom Inventory submit
async function handleCustomInventoryFormSubmit(e) {
  e.preventDefault();
  const name = document.getElementById('custom-item_name').value.trim();
  const description = document.getElementById('custom-item_description').value.trim();
  const qty = parseFloat(document.getElementById('custom-item_qty').value);
  const price = parseFloat(document.getElementById('custom-item_price').value);
  const imageFileInput = document.getElementById('custom-item_image');

  try {
    let base64Image = null;
    if (imageFileInput.files.length > 0) {
      const file = imageFileInput.files[0];
      base64Image = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(file);
      });
    }

    const payload = {
      item_name: name,
      description,
      qty,
      price,
      is_custom_bill: true
    };
    if (base64Image) payload.image_url = base64Image;

    if (editingCustomItemId) {
      await apiRequest(`/inventory/${editingCustomItemId}`, {
        method: 'PUT',
        body: payload
      });
      showToast('Custom item updated successfully');
    } else {
      await apiRequest('/inventory', {
        method: 'POST',
        body: payload
      });
      showToast('Custom item added to inventory');
    }

    cancelCustomInventoryEdit();
    loadCustomInventoryData();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

function editCustomItem(itemId) {
  const item = customBillInventoryData.find(i => i.id === itemId);
  if (!item) return;

  editingCustomItemId = item.id;
  document.getElementById('custom-edit-item-id').value = item.id;
  document.getElementById('custom-item_name').value = item.item_name;
  document.getElementById('custom-item_description').value = item.description || '';
  document.getElementById('custom-item_qty').value = item.qty;
  document.getElementById('custom-item_price').value = item.price;
  
  if (item.image_url) {
    document.getElementById('custom-image-preview').src = item.image_url;
    document.getElementById('custom-image-preview-container').classList.remove('hidden');
    document.querySelector('#custom-bill-inventory-view .upload-placeholder').classList.add('hidden');
  } else {
    removeCustomImagePreview();
  }

  document.getElementById('custom-inventory-form-title').textContent = 'Update Custom Item';
  document.getElementById('custom-btn-save-item').textContent = 'Save Changes';
  document.getElementById('custom-btn-cancel-edit').classList.remove('hidden');
}

function cancelCustomInventoryEdit() {
  editingCustomItemId = null;
  document.getElementById('custom-inventory-item-form').reset();
  removeCustomImagePreview();
  document.getElementById('custom-inventory-form-title').textContent = 'Add New Custom Bill Item';
  document.getElementById('custom-btn-save-item').textContent = 'Add Item';
  document.getElementById('custom-btn-cancel-edit').classList.add('hidden');
}

async function deleteCustomItem(itemId) {
  if (!confirm('Are you sure you want to delete this custom item?')) return;
  try {
    await apiRequest(`/inventory/${itemId}`, { method: 'DELETE' });
    showToast('Custom item deleted successfully');
    loadCustomInventoryData();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

// Custom Image Upload Previews
function handleCustomImageUploadPreview(e) {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (event) => {
    document.getElementById('custom-image-preview').src = event.target.result;
    document.getElementById('custom-image-preview-container').classList.remove('hidden');
    document.querySelector('#custom-bill-inventory-view .upload-placeholder').classList.add('hidden');
  };
  reader.readAsDataURL(file);
}

function removeCustomImagePreview() {
  document.getElementById('custom-item_image').value = '';
  document.getElementById('custom-image-preview').src = '';
  document.getElementById('custom-image-preview-container').classList.add('hidden');
  document.querySelector('#custom-bill-inventory-view .upload-placeholder').classList.remove('hidden');
}

// Bind custom functions to global window context
window.addCustomPOSProduct = addCustomPOSProduct;
window.updateCustomCartQty = updateCustomCartQty;
window.recallCustomPendingOrder = recallCustomPendingOrder;
window.deleteCustomPendingOrder = deleteCustomPendingOrder;
window.editCustomItem = editCustomItem;
window.deleteCustomItem = deleteCustomItem;

// ==========================================
// Dynamic Menu Order Control Features
// ==========================================
let appMenus = [];

const menuMetadata = {
  billing: { icon: 'cart-outline', target: 'billing-view', labelClass: 'label-billing_menu', name: 'Billing & POS' },
  custom_bill: { icon: 'calculator-outline', target: 'custom-bill-view', labelClass: 'label-custom_bill_menu', name: 'Custom Bill' },
  cart: { icon: 'basket-outline', target: 'cart-view', labelClass: 'label-view_cart', name: 'View Cart', badgeId: 'cart-badge-count' },
  custom_cart: { icon: 'basket-outline', target: 'custom-cart-view', labelClass: 'label-custom_view_cart', name: 'View Custom Cart', badgeId: 'custom-cart-badge-count' },
  pending: { icon: 'bookmark-outline', target: 'pending-view', labelClass: 'label-pending_orders', name: 'Pending Orders' },
  custom_pending: { icon: 'bookmark-outline', target: 'custom-pending-view', labelClass: 'label-custom_pending_orders', name: 'Custom Pending Orders' },
  dashboard: { icon: 'grid-outline', target: 'dashboard-view', labelClass: 'label-overview_menu', name: 'Overview' },
  customers: { icon: 'people-outline', target: 'customers-view', labelClass: 'label-customers_menu', name: 'Customer Directory' },
  users: { icon: 'shield-half-outline', target: 'users-view', labelClass: 'label-users_menu', name: 'User Management' },
  inventory: { icon: 'cube-outline', target: 'inventory-view', labelClass: 'label-inventory_menu', name: 'Inventory' },
  custom_bill_inventory: { icon: 'cube-outline', target: 'custom-bill-inventory-view', labelClass: 'label-custom_inventory_menu', name: 'Custom Bill Inventory' },
  custom_labels: { icon: 'create-outline', target: 'labels-view', labelClass: 'label-custom_labels_menu', name: 'Custom Label' },
  menu_control: { icon: 'options-outline', target: 'menu-control-view', labelClass: 'label-menu_control_menu', name: 'Menu Control' },
  menu_order: { icon: 'list-outline', target: 'menu-order-view', labelClass: 'label-menu_order_menu', name: 'Menu Order' }
};

async function loadAppMenus() {
  try {
    appMenus = await apiRequest('/menus');
  } catch (err) {
    console.error('Failed to load menu configurations:', err);
  }
}

function renderSidebarNavMenu() {
  const container = document.querySelector('.nav-menu');
  if (!container) return;

  container.innerHTML = '';

  const groupsOrder = ['Create Billing', 'Cart', 'Orders', 'Dashboards', 'Customer', 'Admin'];

  // Group by main_menu
  const grouped = {};
  appMenus.forEach(item => {
    if (!grouped[item.main_menu]) grouped[item.main_menu] = [];
    grouped[item.main_menu].push(item);
  });

  groupsOrder.forEach(groupName => {
    const items = grouped[groupName] || [];
    // Filter active & permissions
    const visibleItems = items.filter(item => {
      // 1. Must be active
      if (!item.is_active) return false;
      // 2. Check permissions
      const meta = menuMetadata[item.submenu_key];
      if (!meta) return false;
      const permKey = getPermissionKeyForView(meta.target);
      if (currentUser && (currentUser.role === 'super_admin' || currentUser.role === 'superadmin')) {
        return true;
      }
      if (permKey && currentUser && currentUser.permissions && currentUser.permissions[permKey]) {
        return currentUser.permissions[permKey].view === true;
      }
      // default: view if no key
      return true;
    });

    // Sort by display_order
    visibleItems.sort((a, b) => a.display_order - b.display_order);

    if (visibleItems.length > 0) {
      // Add group header
      const headerDiv = document.createElement('div');
      headerDiv.className = 'nav-group-header';
      headerDiv.style.cssText = 'padding: 14px 16px 6px; font-size: 11px; font-weight: bold; text-transform: uppercase; color: var(--text-muted); opacity: 0.6; letter-spacing: 0.8px;';
      headerDiv.textContent = groupName;
      container.appendChild(headerDiv);

      // Append items
      visibleItems.forEach(item => {
        const meta = menuMetadata[item.submenu_key];
        if (!meta) return;

        const a = document.createElement('a');
        a.href = '#';
        a.className = 'nav-item';
        a.setAttribute('data-target', meta.target);

        // Add active class if this is the active view
        const currentActiveView = document.querySelector('.app-view.active')?.id;
        if (currentActiveView === meta.target) {
          a.classList.add('active');
        }

        let innerContent = `<ion-icon name="${meta.icon}"></ion-icon>`;
        if (meta.badgeId) {
          innerContent += `<span><span class="${meta.labelClass}">${meta.name}</span> <span id="${meta.badgeId}" class="badge danger hidden" style="font-size: 9px; padding: 2px 6px; margin-left: auto;">0</span></span>`;
        } else {
          innerContent += `<span class="${meta.labelClass}">${meta.name}</span>`;
        }

        a.innerHTML = innerContent;
        
        a.addEventListener('click', (e) => {
          e.preventDefault();
          switchView(meta.target);
        });

        container.appendChild(a);
      });
    }
  });

  // Re-apply custom labels and badges sync
  if (typeof applyCustomLabels === 'function') applyCustomLabels();
  if (typeof updateCartBadges === 'function') updateCartBadges();
  if (typeof updateCustomCartBadges === 'function') updateCustomCartBadges();
}

async function loadMenuOrderData() {
  try {
    await loadAppMenus();
    renderMenuOrderEditor();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}

function renderMenuOrderEditor() {
  const container = document.getElementById('menu-order-editor-container');
  if (!container) return;

  container.innerHTML = '';

  const groupsOrder = ['Create Billing', 'Cart', 'Orders', 'Dashboards', 'Customer', 'Admin'];

  // Group by main_menu
  const grouped = {};
  appMenus.forEach(item => {
    if (!grouped[item.main_menu]) grouped[item.main_menu] = [];
    grouped[item.main_menu].push(item);
  });

  groupsOrder.forEach(groupName => {
    const items = grouped[groupName] || [];
    if (items.length === 0) return;

    // Sort items by display_order
    items.sort((a, b) => a.display_order - b.display_order);

    const section = document.createElement('div');
    section.className = 'menu-order-section';
    section.style.cssText = 'background: rgba(0,0,0,0.15); padding: 18px; border-radius: 8px; border: 1px solid var(--border-glass);';

    let tableRows = items.map((item, idx) => {
      const activeChecked = item.is_active ? 'checked' : '';
      return `
        <tr>
          <td style="padding: 10px; text-align: center;">${idx + 1}</td>
          <td style="padding: 10px;"><strong>${item.submenu_name}</strong> <small style="color: var(--text-muted);">(${item.submenu_key})</small></td>
          <td style="padding: 10px; text-align: center;">
            <input type="number" class="menu-order-input" data-submenu-key="${item.submenu_key}" data-group="${groupName}" min="1" max="50" value="${item.display_order}" style="width: 70px; text-align: center; background: rgba(0,0,0,0.3); border: 1px solid var(--border-glass); color: #fff; padding: 4px; border-radius: 4px;">
          </td>
          <td style="padding: 10px; text-align: center;">
            <label style="cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 6px;">
              <input type="checkbox" class="menu-active-checkbox" data-submenu-key="${item.submenu_key}" ${activeChecked}> Active
            </label>
          </td>
        </tr>
      `;
    }).join('');

    section.innerHTML = `
      <h3 style="margin-bottom: 12px; border-bottom: 1px solid rgba(255,255,255,0.05); padding-bottom: 6px; color: var(--accent-orange); font-size: 15px; font-weight: bold; text-transform: uppercase;">${groupName}</h3>
      <table class="data-table" style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="border-bottom: 1px solid var(--border-glass); font-size: 12px;">
            <th style="width: 70px; text-align: center; color: var(--text-secondary);">SI.No</th>
            <th style="text-align: left; color: var(--text-secondary);">Menu Name</th>
            <th style="width: 100px; text-align: center; color: var(--text-secondary);">Order</th>
            <th style="width: 120px; text-align: center; color: var(--text-secondary);">Status</th>
          </tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
    `;

    container.appendChild(section);
  });
}

async function handleMenuOrderFormSubmit(e) {
  e.preventDefault();

  const updates = [];
  const groupsValidation = {};

  // Extract values
  const orderInputs = document.querySelectorAll('.menu-order-input');
  let hasDuplicates = false;

  orderInputs.forEach(input => {
    const key = input.getAttribute('data-submenu-key');
    const group = input.getAttribute('data-group');
    const val = parseInt(input.value);

    if (!groupsValidation[group]) groupsValidation[group] = [];
    if (groupsValidation[group].includes(val)) {
      hasDuplicates = true;
    }
    groupsValidation[group].push(val);

    const checkbox = document.querySelector(`.menu-active-checkbox[data-submenu-key="${key}"]`);
    const isActive = checkbox ? checkbox.checked : true;

    updates.push({
      submenu_key: key,
      display_order: val,
      is_active: isActive
    });
  });

  if (hasDuplicates) {
    showToast('Error: Display order values must be unique within each menu section!', 'danger');
    return;
  }

  try {
    const res = await apiRequest('/menus/order', {
      method: 'POST',
      body: { updates }
    });

    showToast(res.message || 'Menu order saved successfully!', 'success');
    await loadAppMenus();
    renderSidebarNavMenu();
    renderMenuOrderEditor();
  } catch (err) {
    showToast(err.message, 'danger');
  }
}
