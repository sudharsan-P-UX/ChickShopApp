import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../services/api_service.dart';

class AppState with ChangeNotifier {
  bool _isAuthenticated = false;
  String _username = '';
  String _userRole = '';
  Map<String, dynamic> _permissions = {};
  int _screenIndex = 0; // Default view index (0 = Billing & POS)

  // Caches
  List<dynamic> inventory = [];
  List<dynamic> customers = [];
  List<dynamic> pendingOrders = [];
  List<dynamic> completedBills = [];
  List<dynamic> users = [];
  List<dynamic> roles = [];
  List<dynamic> customLabels = [];
  List<dynamic> menuOrders = [];

  // Active Cart State
  final Map<int, int> cart = {}; // itemId -> quantity
  Map<String, dynamic>? selectedCustomer;
  double discount = 0.0;
  int? activePendingBillId;

  // Getters
  bool get isAuthenticated => _isAuthenticated;
  String get username => _username;
  String get userRole => _userRole;
  Map<String, dynamic> get permissions => _permissions;
  bool get isAdmin => _userRole == 'admin' || _userRole == 'super_admin' || _userRole == 'superadmin';
  int get screenIndex => _screenIndex;

  bool hasPermission(String menu, String action) {
    final String targetAction = action == 'update' ? 'edit' : action;
    if (_permissions.containsKey(menu)) {
      final menuPerms = _permissions[menu];
      if (menuPerms is Map) {
        if (menuPerms.containsKey(targetAction)) {
          return menuPerms[targetAction] == true;
        }
        if (targetAction == 'edit' && menuPerms.containsKey('update')) {
          return menuPerms['update'] == true;
        }
      }
    }
    if (_userRole == 'super_admin' || _userRole == 'superadmin') return true; // Super admin has absolute access
    return false;
  }

  int get cartCount => cart.length;

  double get cartSubtotal {
    double total = 0.0;
    cart.forEach((itemId, qty) {
      final item = inventory.firstWhere((i) => i['id'] == itemId, orElse: () => null);
      if (item != null) {
        total += (double.tryParse(item['price'].toString()) ?? 0.0) * qty;
      }
    });
    return total;
  }

  double get cartFinalTotal => mathMax(0.0, cartSubtotal - discount);

  double mathMax(double a, double b) => a > b ? a : b;

  int getLandingIndex() {
    final Map<String, int> menuIndexMap = {
      'billing': 0,
      'dashboard': 1,
      'cart': 2,
      'pending': 3,
      'inventory': 4,
      'customers': 5,
      'users': 6,
      'custom_labels': 7,
      'custom_bill': 8,
      'custom_cart': 9,
      'custom_pending': 10,
      'custom_bill_inventory': 11,
      'menu_control': 12,
      'menu_order': 13,
    };
    for (var entry in _permissions.entries) {
      final value = entry.value;
      if (value is Map && value['home'] == true) {
        if (menuIndexMap.containsKey(entry.key)) {
          return menuIndexMap[entry.key]!;
        }
      }
    }
    return 0; // Default fallback to Billing & POS
  }

  // Authentication Actions
  Future<void> login(String token, String role, String username, Map<String, dynamic>? permissions) async {
    _userRole = role;
    _username = username;
    _permissions = permissions ?? {};
    _isAuthenticated = true;
    _screenIndex = getLandingIndex();
    
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('token', token);
    await prefs.setString('role', role);
    await prefs.setString('username', username);
    await prefs.setString('permissions', jsonEncode(_permissions));
    
    await fetchCustomLabels();
    await fetchMenuOrders();
    
    notifyListeners();
  }

  Future<void> updateLocalPermissions(Map<String, dynamic> newPerms) async {
    _permissions = newPerms;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('permissions', jsonEncode(_permissions));
    notifyListeners();
  }

  Future<void> logout() async {
    _userRole = '';
    _username = '';
    _permissions = {};
    _isAuthenticated = false;
    clearCart();
    
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('token');
    await prefs.remove('role');
    await prefs.remove('username');
    await prefs.remove('permissions');
    
    notifyListeners();
  }

  void setScreenIndex(int index) {
    _screenIndex = index;
    notifyListeners();
  }

  Future<void> fetchCustomLabels() async {
    try {
      customLabels = await ApiService.getCustomLabels();
      notifyListeners();
    } catch (e) {
      debugPrint('Error fetching custom labels: $e');
    }
  }

  Future<void> fetchMenuOrders() async {
    try {
      menuOrders = await ApiService.getMenuOrders();
      notifyListeners();
    } catch (e) {
      debugPrint('Error fetching menu orders: $e');
    }
  }

  Future<void> saveMenuOrders(List<dynamic> updates) async {
    try {
      await ApiService.updateMenuOrders(updates);
      await fetchMenuOrders();
    } catch (e) {
      debugPrint('Error saving menu orders: $e');
      rethrow;
    }
  }

  bool isMenuVisible(String submenuKey) {
    if (menuOrders.isEmpty) return true; // Default visible if not loaded yet
    final item = menuOrders.firstWhere(
      (m) => m['submenu_key'] == submenuKey,
      orElse: () => null,
    );
    if (item == null) return true;
    final bool isAdminUser = _userRole == 'super_admin' || _userRole == 'superadmin' || _userRole == 'admin';
    if (item['is_active'] != true && !(submenuKey == 'menu_order' && isAdminUser)) return false;

    String? permKey;
    switch (submenuKey) {
      case 'billing':
      case 'cart':
      case 'pending':
        permKey = 'billing';
        break;
      case 'custom_bill':
      case 'custom_cart':
      case 'custom_pending':
        permKey = 'custom_bill';
        break;
      case 'dashboard':
        permKey = 'dashboard';
        break;
      case 'customers':
        permKey = 'customers';
        break;
      case 'users':
        permKey = 'users';
        break;
      case 'inventory':
        permKey = 'inventory';
        break;
      case 'custom_bill_inventory':
        permKey = 'custom_bill_inventory';
        break;
      case 'custom_labels':
        permKey = 'custom_labels';
        break;
      case 'menu_control':
        permKey = 'menu_control';
        break;
      case 'menu_order':
        permKey = 'menu_order';
        break;
    }

    if (permKey == null) return true;
    return hasPermission(permKey, 'view');
  }

  String getLabel(String key, String defaultVal) {
    if (customLabels.isEmpty) return defaultVal;
    final item = customLabels.firstWhere(
      (l) => l['label_key'] == key,
      orElse: () => null,
    );
    return item != null ? item['custom_label'] : defaultVal;
  }

  // Load API Data
  Future<void> fetchInventory() async {
    try {
      inventory = await ApiService.getInventory();
      notifyListeners();
    } catch (e) {
      debugPrint('Error fetching inventory: $e');
    }
  }

  Future<void> fetchCustomers() async {
    try {
      customers = await ApiService.getCustomers();
      notifyListeners();
    } catch (e) {
      debugPrint('Error fetching customers: $e');
    }
  }

  Future<void> fetchPendingOrders() async {
    try {
      pendingOrders = await ApiService.getPendingBills();
      notifyListeners();
    } catch (e) {
      debugPrint('Error fetching pending: $e');
    }
  }

  Future<void> fetchCompletedBills() async {
    try {
      completedBills = await ApiService.getCompletedBills();
      notifyListeners();
    } catch (e) {
      debugPrint('Error fetching sales history: $e');
    }
  }

  Future<void> fetchRoles() async {
    try {
      roles = await ApiService.getRoles();
      notifyListeners();
    } catch (e) {
      debugPrint('Error fetching roles: $e');
    }
  }

  Future<void> fetchUsers() async {
    if (!isAdmin) return;
    try {
      await fetchRoles();
      users = await ApiService.getUsers();
      notifyListeners();
    } catch (e) {
      debugPrint('Error fetching users: $e');
    }
  }

  Future<void> updateUserAccount(int id, String username, String? password, String role) async {
    await ApiService.updateUser(id, username, password, role);
    await fetchUsers();
  }

  // Cart Management
  void addToCart(dynamic item) {
    final int itemId = item['id'];
    final int stock = item['qty'];
    final int currentQty = cart[itemId] ?? 0;
    
    if (currentQty >= stock) {
      throw Exception('Only $stock items available in stock');
    }
    
    cart[itemId] = currentQty + 1;
    notifyListeners();
  }

  void updateCartQty(int itemId, int delta) {
    if (!cart.containsKey(itemId)) return;
    
    final item = inventory.firstWhere((i) => i['id'] == itemId, orElse: () => null);
    if (item == null) return;
    
    final int stock = item['qty'];
    final int newQty = cart[itemId]! + delta;

    if (newQty <= 0) {
      cart.remove(itemId);
    } else {
      if (newQty > stock) {
        throw Exception('Only $stock items available in stock');
      }
      cart[itemId] = newQty;
    }
    notifyListeners();
  }

  void clearCart() {
    cart.clear();
    selectedCustomer = null;
    discount = 0.0;
    activePendingBillId = null;
    notifyListeners();
  }

  void setDiscount(double value) {
    discount = value;
    notifyListeners();
  }

  void selectCustomer(Map<String, dynamic>? cust) {
    selectedCustomer = cust;
    notifyListeners();
  }

  // Transaction checkout
  Future<void> completeOrder() async {
    if (cart.isEmpty) throw Exception('Cart is empty');

    final List<Map<String, dynamic>> itemsList = [];
    cart.forEach((itemId, qty) {
      final item = inventory.firstWhere((i) => i['id'] == itemId);
      itemsList.add({
        'id': itemId,
        'item_name': item['item_name'],
        'qty': qty,
        'price': double.tryParse(item['price'].toString()) ?? 0.0
      });
    });

    final payload = {
      'customer_phone': selectedCustomer?['phone_no'],
      'items': itemsList,
      'total_amount': cartSubtotal,
      'discount': discount,
      'final_price': cartFinalTotal,
      'pending_bill_id': activePendingBillId
    };

    await ApiService.completeBill(payload);
    clearCart();
    await fetchInventory();
    await fetchCompletedBills();
    await fetchPendingOrders();
  }

  // Save Pending Order
  Future<void> savePending() async {
    if (cart.isEmpty) throw Exception('Cart is empty');

    final List<Map<String, dynamic>> itemsList = [];
    cart.forEach((itemId, qty) {
      final item = inventory.firstWhere((i) => i['id'] == itemId);
      itemsList.add({
        'id': itemId,
        'item_name': item['item_name'],
        'qty': qty,
        'price': double.tryParse(item['price'].toString()) ?? 0.0
      });
    });

    await ApiService.savePendingBill(itemsList, cartSubtotal, activePendingBillId);
    clearCart();
    await fetchPendingOrders();
  }

  // Restore Pending Order
  Future<void> restorePending(dynamic bill, bool goToCart) async {
    await fetchInventory(); // Refresh stock before loading
    
    cart.clear();
    activePendingBillId = bill['id'];
    selectedCustomer = null;
    discount = 0.0;

    for (var savedItem in bill['items']) {
      final currentItem = inventory.firstWhere((i) => i['id'] == savedItem['id'], orElse: () => null);
      if (currentItem != null) {
        final stock = currentItem['qty'];
        final quantityToLoad = savedItem['qty'] > stock ? stock : savedItem['qty'];
        if (quantityToLoad > 0) {
          cart[savedItem['id']] = quantityToLoad;
        }
      }
    }

    _screenIndex = goToCart ? 2 : 0; // 2 = View Cart, 0 = Billing POS
    notifyListeners();
  }

  // Delete Pending Order
  Future<void> deletePending(int id) async {
    await ApiService.deletePendingBill(id);
    await fetchPendingOrders();
  }

  // ==========================================
  // Custom Bill & Weight-Based POS Features
  // ==========================================
  final Map<int, double> customCart = {}; // itemId -> weight (double)
  Map<String, dynamic>? customSelectedCustomer;
  double customDiscount = 0.0;
  int? activeCustomPendingBillId;
  List<dynamic> customPendingOrders = [];

  int get customCartCount => customCart.length;

  double get customCartSubtotal {
    double total = 0.0;
    customCart.forEach((itemId, qty) {
      final item = inventory.firstWhere((i) => i['id'] == itemId, orElse: () => null);
      if (item != null) {
        total += (double.tryParse(item['price'].toString()) ?? 0.0) * qty;
      }
    });
    return total;
  }

  double get customCartFinalTotal => mathMax(0.0, customCartSubtotal - customDiscount);

  void addToCustomCart(dynamic item, double qty) {
    final int itemId = item['id'];
    final double stock = double.tryParse(item['qty'].toString()) ?? 0.0;
    
    if (qty > stock) {
      throw Exception('Only $stock kg available in stock');
    }
    
    customCart[itemId] = qty;
    notifyListeners();
  }

  void updateCustomCartQty(int itemId, double delta) {
    if (!customCart.containsKey(itemId)) return;
    
    final item = inventory.firstWhere((i) => i['id'] == itemId, orElse: () => null);
    if (item == null) return;
    
    final double stock = double.tryParse(item['qty'].toString()) ?? 0.0;
    final double newQty = customCart[itemId]! + delta;

    if (newQty <= 0) {
      customCart.remove(itemId);
    } else {
      if (newQty > stock) {
        throw Exception('Only $stock kg available in stock');
      }
      customCart[itemId] = double.parse(newQty.toStringAsFixed(2));
    }
    notifyListeners();
  }

  void clearCustomCart() {
    customCart.clear();
    customSelectedCustomer = null;
    customDiscount = 0.0;
    activeCustomPendingBillId = null;
    notifyListeners();
  }

  void setCustomDiscount(double value) {
    customDiscount = value;
    notifyListeners();
  }

  void selectCustomCustomer(Map<String, dynamic>? cust) {
    customSelectedCustomer = cust;
    notifyListeners();
  }

  Future<void> fetchCustomPendingOrders() async {
    try {
      customPendingOrders = await ApiService.getCustomPendingBills();
      notifyListeners();
    } catch (e) {
      debugPrint('Error fetching custom pending orders: $e');
    }
  }

  // Complete custom weight order
  Future<void> completeCustomOrder() async {
    if (customCart.isEmpty) throw Exception('Cart is empty');

    final List<Map<String, dynamic>> itemsList = [];
    customCart.forEach((itemId, qty) {
      final item = inventory.firstWhere((i) => i['id'] == itemId);
      itemsList.add({
        'id': itemId,
        'item_name': item['item_name'],
        'qty': qty,
        'price': double.tryParse(item['price'].toString()) ?? 0.0
      });
    });

    final payload = {
      'customer_phone': customSelectedCustomer?['phone_no'],
      'items': itemsList,
      'total_amount': customCartSubtotal,
      'discount': customDiscount,
      'final_price': customCartFinalTotal,
      'pending_bill_id': activeCustomPendingBillId
    };

    await ApiService.completeBill(payload);
    clearCustomCart();
    await fetchInventory();
    await fetchCompletedBills();
    await fetchCustomPendingOrders();
  }

  // Save custom pending order
  Future<void> saveCustomPending() async {
    if (customCart.isEmpty) throw Exception('Cart is empty');

    final List<Map<String, dynamic>> itemsList = [];
    customCart.forEach((itemId, qty) {
      final item = inventory.firstWhere((i) => i['id'] == itemId);
      itemsList.add({
        'id': itemId,
        'item_name': item['item_name'],
        'qty': qty,
        'price': double.tryParse(item['price'].toString()) ?? 0.0
      });
    });

    await ApiService.saveCustomPendingBill(itemsList, customCartSubtotal, activeCustomPendingBillId);
    clearCustomCart();
    await fetchCustomPendingOrders();
  }

  // Restore Custom Pending Order
  Future<void> restoreCustomPending(dynamic bill, bool goToCart) async {
    await fetchInventory();
    
    customCart.clear();
    activeCustomPendingBillId = bill['id'];
    customSelectedCustomer = null;
    customDiscount = 0.0;

    for (var savedItem in bill['items']) {
      final currentItem = inventory.firstWhere((i) => i['id'] == savedItem['id'], orElse: () => null);
      if (currentItem != null) {
        final double stock = double.tryParse(currentItem['qty'].toString()) ?? 0.0;
        final double quantityToLoad = savedItem['qty'] > stock ? stock : double.parse(savedItem['qty'].toString());
        if (quantityToLoad > 0) {
          customCart[savedItem['id']] = quantityToLoad;
        }
      }
    }

    _screenIndex = goToCart ? 9 : 8; // 9 = View Custom Cart, 8 = Custom Bill POS
    notifyListeners();
  }

  // Delete Custom Pending Order
  Future<void> deleteCustomPending(int id) async {
    await ApiService.deletePendingBill(id);
    await fetchCustomPendingOrders();
  }
}
