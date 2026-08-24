import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/app_state.dart';
import '../services/api_service.dart';

class MenuControlScreen extends StatefulWidget {
  const MenuControlScreen({super.key});

  @override
  State<MenuControlScreen> createState() => _MenuControlScreenState();
}

class _MenuControlScreenState extends State<MenuControlScreen> {
  List<dynamic> _roles = [];
  dynamic _selectedRole;
  Map<String, Map<String, bool>> _perms = {};
  bool _isLoading = false;

  final List<Map<String, String>> _systemMenus = [
    {'key': 'billing', 'name': 'Billing & POS'},
    {'key': 'custom_bill', 'name': 'Custom Bill'},
    {'key': 'cart', 'name': 'View Cart'},
    {'key': 'custom_cart', 'name': 'View Custom Cart'},
    {'key': 'pending', 'name': 'Pending Orders'},
    {'key': 'custom_pending', 'name': 'Custom Pending Orders'},
    {'key': 'dashboard', 'name': 'Overview'},
    {'key': 'customers', 'name': 'Customer Directory'},
    {'key': 'users', 'name': 'User Management'},
    {'key': 'inventory', 'name': 'Inventory Control'},
    {'key': 'custom_bill_inventory', 'name': 'Custom Bill Inventory'},
    {'key': 'custom_labels', 'name': 'Custom Label'},
    {'key': 'menu_control', 'name': 'Menu Control'},
    {'key': 'menu_order', 'name': 'Menu Order'},
  ];

  @override
  void initState() {
    super.initState();
    _loadRoles();
  }

  void _loadRoles() async {
    setState(() => _isLoading = true);
    try {
      final data = await ApiService.getRoles();
      setState(() {
        _roles = data;
        if (_roles.isNotEmpty) {
          _selectedRole = _roles.first;
          _syncPermissions();
        }
      });
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error loading roles: ${e.toString().replaceAll('Exception: ', '')}')),
      );
    } finally {
      setState(() => _isLoading = false);
    }
  }

  void _syncPermissions() {
    _perms.clear();
    final rolePerms = _selectedRole['permissions'] ?? {};

    for (var m in _systemMenus) {
      final String key = m['key']!;
      final menuPerms = rolePerms[key] ?? {};

      _perms[key] = {
        'view': menuPerms['view'] == true,
        'add': menuPerms['add'] == true,
        'edit': menuPerms['edit'] == true || menuPerms['update'] == true,
        'delete': menuPerms['delete'] == true,
        'home': menuPerms['home'] == true,
      };
    }
  }

  void _handleViewChanged(String key, bool? val) {
    setState(() {
      _perms[key]!['view'] = val == true;
      if (val != true) {
        // If view is unchecked, uncheck all action permissions too!
        _perms[key]!['add'] = false;
        _perms[key]!['edit'] = false;
        _perms[key]!['delete'] = false;
        _perms[key]!['home'] = false;
      }
    });
  }

  void _handleHomeChanged(String key, bool? val) {
    setState(() {
      if (val == true) {
        // Only one Home landing screen can be selected at a time
        _perms.forEach((k, p) {
          p['home'] = (k == key);
        });
      } else {
        _perms[key]!['home'] = false;
      }
    });
  }

  void _savePermissions() async {
    if (_selectedRole == null) return;
    setState(() => _isLoading = true);

    try {
      final Map<String, dynamic> body = {};
      _perms.forEach((k, p) {
        body[k] = p;
      });

      await ApiService.updateRolePermissions(_selectedRole['id'], body);

      // Update state in app if editing own role
      final appState = Provider.of<AppState>(context, listen: false);
      if (_selectedRole['role_name'] == appState.userRole) {
        appState.updateLocalPermissions(body);
      }

      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Role permissions updated successfully!')),
      );

      // Reload roles to get latest permissions
      _loadRoles();
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error saving: ${e.toString().replaceAll('Exception: ', '')}')),
      );
      setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Role Access Menu Control', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
        backgroundColor: Colors.white,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        actions: [
          if (_selectedRole != null && !_isLoading)
            Padding(
              padding: const EdgeInsets.only(right: 12),
              child: ElevatedButton.icon(
                onPressed: _savePermissions,
                icon: const Icon(Icons.save_outlined, size: 18),
                label: const Text('Save'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.green,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                ),
              ),
            ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : Column(
              children: [
                Container(
                  padding: const EdgeInsets.all(16),
                  color: Colors.grey.shade50,
                  child: Row(
                    children: [
                      const Text('Select Role:  ', style: TextStyle(fontWeight: FontWeight.bold)),
                      Expanded(
                        child: DropdownButton<dynamic>(
                          value: _selectedRole,
                          isExpanded: true,
                          items: _roles.map<DropdownMenuItem<dynamic>>((role) {
                            return DropdownMenuItem<dynamic>(
                              value: role,
                              child: Text(role['role_name'].toString().toUpperCase()),
                            );
                          }).toList(),
                          onChanged: (val) {
                            setState(() {
                              _selectedRole = val;
                              _syncPermissions();
                            });
                          },
                        ),
                      ),
                    ],
                  ),
                ),
                Expanded(
                  child: ListView.builder(
                    padding: const EdgeInsets.all(12),
                    itemCount: _systemMenus.length,
                    itemBuilder: (context, index) {
                      final menu = _systemMenus[index];
                      final key = menu['key']!;
                      final name = menu['name']!;
                      final p = _perms[key] ?? {};

                      final bool isViewActive = p['view'] == true;

                      return Card(
                        margin: const EdgeInsets.only(bottom: 12),
                        child: ExpansionTile(
                          leading: CircleAvatar(
                            backgroundColor: isViewActive ? Colors.deepOrange.shade50 : Colors.grey.shade100,
                            child: Icon(
                              isViewActive ? Icons.lock_open : Icons.lock_outline,
                              color: isViewActive ? Colors.deepOrange : Colors.grey,
                            ),
                          ),
                          title: Text(name, style: const TextStyle(fontWeight: FontWeight.bold)),
                          subtitle: Text('ID Key: $key', style: const TextStyle(fontSize: 11, color: Colors.grey)),
                          initiallyExpanded: true,
                          children: [
                            Padding(
                              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                              child: Wrap(
                                spacing: 16,
                                runSpacing: 8,
                                children: [
                                  Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Checkbox(
                                        value: p['view'] == true,
                                        onChanged: (val) => _handleViewChanged(key, val),
                                      ),
                                      const Text('View', style: TextStyle(fontWeight: FontWeight.bold)),
                                    ],
                                  ),
                                  Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Checkbox(
                                        value: p['add'] == true,
                                        onChanged: isViewActive ? (val) => setState(() => p['add'] = val == true) : null,
                                      ),
                                      const Text('Add'),
                                    ],
                                  ),
                                  Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Checkbox(
                                        value: p['edit'] == true,
                                        onChanged: isViewActive ? (val) => setState(() => p['edit'] = val == true) : null,
                                      ),
                                      const Text('Edit'),
                                    ],
                                  ),
                                  Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Checkbox(
                                        value: p['delete'] == true,
                                        onChanged: isViewActive ? (val) => setState(() => p['delete'] = val == true) : null,
                                      ),
                                      const Text('Delete'),
                                    ],
                                  ),
                                  Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      Checkbox(
                                        value: p['home'] == true,
                                        onChanged: isViewActive ? (val) => _handleHomeChanged(key, val) : null,
                                      ),
                                      const Text('Home Menu', style: TextStyle(color: Colors.green, fontWeight: FontWeight.bold)),
                                    ],
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      );
                    },
                  ),
                ),
              ],
            ),
    );
  }
}
