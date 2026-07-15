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
  bool get isAdmin => _userRole == 'admin';
  int get screenIndex => _screenIndex;

  bool hasPermission(String menu, String action) {
    if (_userRole == 'admin') return true; // Admin has fallback full access
    if (_permissions.containsKey(menu)) {
      final menuPerms = _permissions[menu];
      if (menuPerms is Map && menuPerms.containsKey(action)) {
        return menuPerms[action] == true;
      }
    }
    return false;
  }

  int get cartCount => cart.values.fold(0, (sum, qty) => sum + qty);

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

  // Authentication Actions
  Future<void> login(String token, String role, String username, Map<String, dynamic>? permissions) async {
    _userRole = role;
    _username = username;
    _permissions = permissions ?? {};
    _isAuthenticated = true;
    _screenIndex = 0; // Default to Billing after login
    
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('token', token);
    await prefs.setString('role', role);
    await prefs.setString('username', username);
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
}
