import 'dart:convert';
import 'dart:io';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

class ApiService {
  static const String baseUrl = 'https://chick-shop-app.vercel.app/api'; 

  static Future<String?> _getToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString('token');
  }

  static Future<Map<String, String>> _getHeaders() async {
    final token = await _getToken();
    return {
      'Content-Type': 'application/json',
      'Bypass-Tunnel-Reminder': 'true', // Bypasses localtunnel warning landing page
      if (token != null) 'Authorization': 'Bearer $token',
    };
  }

  // Auth Operations
  static Future<dynamic> login(String username, String password) async {
    final response = await http.post(
      Uri.parse('$baseUrl/auth/login'),
      headers: {
        'Content-Type': 'application/json',
        'Bypass-Tunnel-Reminder': 'true',
      },
      body: jsonEncode({'username': username, 'password': password}),
    );
    if (response.statusCode == 200) {
      return jsonDecode(response.body);
    }
    final body = jsonDecode(response.body);
    throw Exception(body['message'] ?? 'Failed to login');
  }

  static Future<dynamic> registerNewUser(String username, String password, String role) async {
    final headers = await _getHeaders();
    final response = await http.post(
      Uri.parse('$baseUrl/auth/register'),
      headers: headers,
      body: jsonEncode({'username': username, 'password': password, 'role': role}),
    );
    if (response.statusCode == 201) {
      return jsonDecode(response.body);
    }
    final body = jsonDecode(response.body);
    throw Exception(body['message'] ?? 'Failed to register new user');
  }

  static Future<List<dynamic>> getUsers() async {
    final headers = await _getHeaders();
    final response = await http.get(Uri.parse('$baseUrl/auth/users'), headers: headers);
    if (response.statusCode == 200) {
      return jsonDecode(response.body);
    }
    throw Exception('Failed to load users');
  }

  static Future<dynamic> updateUserRole(int userId, String role) async {
    final headers = await _getHeaders();
    final response = await http.put(
      Uri.parse('$baseUrl/auth/users/$userId/role'),
      headers: headers,
      body: jsonEncode({'role': role}),
    );
    if (response.statusCode == 200) {
      return jsonDecode(response.body);
    }
    final body = jsonDecode(response.body);
    throw Exception(body['message'] ?? 'Failed to update user role');
  }

  static Future<void> deleteUserAccount(int userId) async {
    final headers = await _getHeaders();
    final response = await http.delete(Uri.parse('$baseUrl/auth/users/$userId'), headers: headers);
    if (response.statusCode != 200) {
      final body = jsonDecode(response.body);
      throw Exception(body['message'] ?? 'Failed to delete user account');
    }
  }

  // Roles Operations
  static Future<List<dynamic>> getRoles() async {
    final headers = await _getHeaders();
    final response = await http.get(Uri.parse('$baseUrl/auth/roles'), headers: headers);
    if (response.statusCode == 200) {
      return jsonDecode(response.body);
    }
    throw Exception('Failed to load system roles');
  }

  static Future<dynamic> createRole(String roleName) async {
    final headers = await _getHeaders();
    final response = await http.post(
      Uri.parse('$baseUrl/auth/roles'),
      headers: headers,
      body: jsonEncode({'role_name': roleName}),
    );
    if (response.statusCode == 201) {
      return jsonDecode(response.body);
    }
    final body = jsonDecode(response.body);
    throw Exception(body['message'] ?? 'Failed to create system role');
  }

  static Future<void> deleteRole(int id) async {
    final headers = await _getHeaders();
    final response = await http.delete(Uri.parse('$baseUrl/auth/roles/$id'), headers: headers);
    if (response.statusCode != 200) {
      final body = jsonDecode(response.body);
      throw Exception(body['message'] ?? 'Failed to delete system role');
    }
  }

  static Future<dynamic> updateRolePermissions(int roleId, Map<String, dynamic> permissions) async {
    final headers = await _getHeaders();
    final response = await http.put(
      Uri.parse('$baseUrl/auth/roles/$roleId/permissions'),
      headers: headers,
      body: jsonEncode({'permissions': permissions}),
    );
    if (response.statusCode == 200) {
      return jsonDecode(response.body);
    }
    final body = jsonDecode(response.body);
    throw Exception(body['message'] ?? 'Failed to update role privileges');
  }

  // Inventory Operations
  static Future<List<dynamic>> getInventory() async {
    final headers = await _getHeaders();
    final response = await http.get(Uri.parse('$baseUrl/inventory'), headers: headers);
    if (response.statusCode == 200) {
      return jsonDecode(response.body);
    }
    throw Exception('Failed to load inventory');
  }

  static Future<String?> _fileToBase64(String? path) async {
    if (path == null || path.isEmpty) return null;
    try {
      List<int> bytes;
      String mime = 'image/png';
      if (path.endsWith('.jpg') || path.endsWith('.jpeg')) {
        mime = 'image/jpeg';
      } else if (path.endsWith('.gif')) {
        mime = 'image/gif';
      } else if (path.endsWith('.webp')) {
        mime = 'image/webp';
      }
      
      if (kIsWeb) {
        final res = await http.get(Uri.parse(path));
        bytes = res.bodyBytes;
      } else {
        bytes = await File(path).readAsBytes();
      }
      final String base64Str = base64Encode(bytes);
      return 'data:$mime;base64,$base64Str';
    } catch (e) {
      print('Error converting file to base64: $e');
    }
    return null;
  }

  static Future<dynamic> addInventoryItem(String name, String desc, int qty, double price, [String? imagePath]) async {
    final token = await _getToken();
    final uri = Uri.parse('$baseUrl/inventory');
    
    final base64Image = await _fileToBase64(imagePath);
    
    final headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    if (token != null) headers['Authorization'] = 'Bearer $token';
    
    final body = jsonEncode({
      'item_name': name,
      'description': desc,
      'qty': qty,
      'price': price,
      'image_url': base64Image,
    });
    
    final response = await http.post(uri, headers: headers, body: body);
    
    if (response.statusCode == 201) {
      return jsonDecode(response.body);
    }
    final responseBody = jsonDecode(response.body);
    throw Exception(responseBody['message'] ?? 'Failed to add inventory item');
  }

  static Future<dynamic> updateInventoryItem(int id, String name, String desc, int qty, double price, [String? imagePath]) async {
    final token = await _getToken();
    final uri = Uri.parse('$baseUrl/inventory/$id');
    
    final base64Image = await _fileToBase64(imagePath);
    
    final headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    if (token != null) headers['Authorization'] = 'Bearer $token';
    
    final body = jsonEncode({
      'item_name': name,
      'description': desc,
      'qty': qty,
      'price': price,
      'image_url': base64Image,
    });
    
    final response = await http.put(uri, headers: headers, body: body);
    
    if (response.statusCode == 200) {
      return jsonDecode(response.body);
    }
    final responseBody = jsonDecode(response.body);
    throw Exception(responseBody['message'] ?? 'Failed to update inventory item');
  }

  static Future<void> deleteInventoryItem(int id) async {
    final headers = await _getHeaders();
    final response = await http.delete(Uri.parse('$baseUrl/inventory/$id'), headers: headers);
    if (response.statusCode != 200) {
      final body = jsonDecode(response.body);
      throw Exception(body['message'] ?? 'Failed to delete inventory item');
    }
  }

  // Customer Operations
  static Future<List<dynamic>> getCustomers() async {
    final headers = await _getHeaders();
    final response = await http.get(Uri.parse('$baseUrl/customers'), headers: headers);
    if (response.statusCode == 200) {
      return jsonDecode(response.body);
    }
    throw Exception('Failed to load customers');
  }

  static Future<dynamic> registerCustomer(String phone, String name) async {
    final headers = await _getHeaders();
    final response = await http.post(
      Uri.parse('$baseUrl/customers'),
      headers: headers,
      body: jsonEncode({'phone_no': phone, 'name': name}),
    );
    if (response.statusCode == 201) {
      return jsonDecode(response.body);
    }
    final body = jsonDecode(response.body);
    throw Exception(body['message'] ?? 'Failed to register customer');
  }

  // Billing & Checkout Operations
  static Future<dynamic> completeBill(Map<String, dynamic> billData) async {
    final headers = await _getHeaders();
    final response = await http.post(
      Uri.parse('$baseUrl/billing/complete'),
      headers: headers,
      body: jsonEncode(billData),
    );
    if (response.statusCode == 201) {
      return jsonDecode(response.body);
    }
    final body = jsonDecode(response.body);
    throw Exception(body['message'] ?? 'Failed to complete bill');
  }

  static Future<List<dynamic>> getCompletedBills() async {
    final headers = await _getHeaders();
    final response = await http.get(Uri.parse('$baseUrl/billing/completed'), headers: headers);
    if (response.statusCode == 200) {
      return jsonDecode(response.body);
    }
    throw Exception('Failed to load sales history');
  }

  static Future<List<dynamic>> getPendingBills() async {
    final headers = await _getHeaders();
    final response = await http.get(Uri.parse('$baseUrl/billing/pending'), headers: headers);
    if (response.statusCode == 200) {
      return jsonDecode(response.body);
    }
    throw Exception('Failed to load pending bills');
  }

  static Future<dynamic> savePendingBill(List<Map<String, dynamic>> items, double subtotal, [int? id]) async {
    final headers = await _getHeaders();
    final response = await http.post(
      Uri.parse('$baseUrl/billing/pending'),
      headers: headers,
      body: jsonEncode({'id': id, 'items': items, 'subtotal': subtotal}),
    );
    if (response.statusCode == 201 || response.statusCode == 200) {
      return jsonDecode(response.body);
    }
    final body = jsonDecode(response.body);
    throw Exception(body['message'] ?? 'Failed to save pending bill');
  }

  static Future<void> deletePendingBill(int id) async {
    final headers = await _getHeaders();
    final response = await http.delete(Uri.parse('$baseUrl/billing/pending/$id'), headers: headers);
    if (response.statusCode != 200) {
      final body = jsonDecode(response.body);
      throw Exception(body['message'] ?? 'Failed to delete pending bill');
    }
  }
}
