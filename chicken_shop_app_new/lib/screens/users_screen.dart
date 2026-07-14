import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/app_state.dart';
import '../services/api_service.dart';

class UsersScreen extends StatefulWidget {
  const UsersScreen({super.key});

  @override
  State<UsersScreen> createState() => _UsersScreenState();
}

class _UsersScreenState extends State<UsersScreen> {
  final _userFormKey = GlobalKey<FormState>();
  final _roleFormKey = GlobalKey<FormState>();
  final _usernameController = TextEditingController();
  final _passwordController = TextEditingController();
  final _roleNameController = TextEditingController();
  String _selectedRole = 'cashier';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      Provider.of<AppState>(context, listen: false).fetchUsers();
    });
  }

  @override
  void dispose() {
    _usernameController.dispose();
    _passwordController.dispose();
    _roleNameController.dispose();
    super.dispose();
  }

  void _createUser(AppState state) async {
    if (!_userFormKey.currentState!.validate()) return;

    final username = _usernameController.text.trim();
    final password = _passwordController.text;

    try {
      await ApiService.registerNewUser(username, password, _selectedRole);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('User account registered successfully: $username')),
      );
      _usernameController.clear();
      _passwordController.clear();
      state.fetchUsers();
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error registering user: ${e.toString().replaceAll('Exception: ', '')}')),
      );
    }
  }

  void _createRole(AppState state) async {
    if (!_roleFormKey.currentState!.validate()) return;

    final roleName = _roleNameController.text.trim().toLowerCase();

    try {
      await ApiService.createRole(roleName);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Role created successfully: $roleName')),
      );
      _roleNameController.clear();
      state.fetchUsers(); // reloads users and roles
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error creating role: ${e.toString().replaceAll('Exception: ', '')}')),
      );
    }
  }

  void _deleteRole(int roleId, String roleName, AppState state) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete Custom Role'),
        content: Text('Are you sure you want to delete the role "$roleName"? This will not affect existing users.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          TextButton(onPressed: () => Navigator.pop(context, true), child: const Text('Delete', style: TextStyle(color: Colors.red))),
        ],
      ),
    );

    if (confirm != true) return;

    try {
      await ApiService.deleteRole(roleId);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Role deleted successfully')),
      );
      state.fetchUsers();
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error deleting role: ${e.toString().replaceAll('Exception: ', '')}')),
      );
    }
  }

  void _toggleUserRole(int userId, String currentRole, AppState state) async {
    // Show role selection dialog based on available roles
    final List<String> rolesList = state.roles.map<String>((r) => r['role_name'].toString()).toList();
    if (rolesList.isEmpty) {
      rolesList.addAll(['admin', 'cashier']);
    }

    final selected = await showDialog<String>(
      context: context,
      builder: (context) {
        return SimpleDialog(
          title: const Text('Select New Role'),
          children: rolesList.map((role) {
            return SimpleDialogOption(
              onPressed: () => Navigator.pop(context, role),
              child: Text(role.toUpperCase(), style: TextStyle(fontWeight: role == currentRole ? FontWeight.bold : FontWeight.normal)),
            );
          }).toList(),
        );
      },
    );

    if (selected == null || selected == currentRole) return;

    try {
      await ApiService.updateUserRole(userId, selected);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('User role updated successfully')),
      );
      state.fetchUsers();
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error updating role: ${e.toString()}')),
      );
    }
  }

  void _deleteUser(int userId, AppState state) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete User Account'),
        content: const Text('Are you sure you want to delete this user account? This action cannot be undone.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          TextButton(onPressed: () => Navigator.pop(context, true), child: const Text('Delete', style: TextStyle(color: Colors.red))),
        ],
      ),
    );

    if (confirm != true) return;

    try {
      await ApiService.deleteUserAccount(userId);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('User account deleted successfully')),
      );
      state.fetchUsers();
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error deleting user: ${e.toString().replaceAll('Exception: ', '')}')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = Provider.of<AppState>(context);

    if (!state.isAdmin) {
      return const Center(
        child: Text(
          'Access Denied: Admin Privilege Required',
          style: TextStyle(fontWeight: FontWeight.bold, color: Colors.red, fontSize: 16),
        ),
      );
    }

    // Dynamic dropdown roles
    final List<String> availableRoles = state.roles.map<String>((r) => r['role_name'].toString()).toList();
    if (availableRoles.isEmpty) {
      availableRoles.addAll(['admin', 'cashier']);
    }
    if (!availableRoles.contains(_selectedRole)) {
      _selectedRole = availableRoles.first;
    }

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Create Custom Role Card
          Card(
            elevation: 2,
            child: Padding(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text('Manage Custom Roles', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                  const SizedBox(height: 12),
                  Form(
                    key: _roleFormKey,
                    child: Row(
                      children: [
                        Expanded(
                          child: TextFormField(
                            controller: _roleNameController,
                            decoration: const InputDecoration(labelText: 'Role Name', border: OutlineInputBorder(), contentPadding: EdgeInsets.all(12)),
                            validator: (val) => val == null || val.trim().isEmpty ? 'Role name is required' : null,
                          ),
                        ),
                        const SizedBox(width: 8),
                        ElevatedButton(
                          onPressed: () => _createRole(state),
                          style: ElevatedButton.styleFrom(backgroundColor: Colors.deepOrange, foregroundColor: Colors.white, padding: const EdgeInsets.all(14)),
                          child: const Icon(Icons.add),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 14),
                  const Text('Current Roles:', style: TextStyle(fontSize: 12, color: Colors.grey)),
                  const SizedBox(height: 6),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: state.roles.map((r) {
                      final name = r['role_name'].toString();
                      final isDefault = name == 'admin' || name == 'cashier';
                      
                      return Chip(
                        label: Text(name.toUpperCase(), style: const TextStyle(fontSize: 11)),
                        backgroundColor: isDefault ? Colors.grey[300] : Colors.green[100],
                        deleteIcon: isDefault ? null : const Icon(Icons.cancel, size: 16, color: Colors.red),
                        onDeleted: isDefault ? null : () => _deleteRole(r['id'], name, state),
                      );
                    }).toList(),
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          // Register User Card
          Card(
            elevation: 2,
            child: Padding(
              padding: const EdgeInsets.all(16.0),
              child: Form(
                key: _userFormKey,
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Register System User Account', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _usernameController,
                      decoration: const InputDecoration(labelText: 'Username', prefixIcon: Icon(Icons.person_outline), border: OutlineInputBorder()),
                      validator: (value) => value == null || value.trim().isEmpty ? 'Username is required' : null,
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _passwordController,
                      obscureText: true,
                      decoration: const InputDecoration(labelText: 'Password', prefixIcon: Icon(Icons.lock_outline), border: OutlineInputBorder()),
                      validator: (value) {
                        if (value == null || value.isEmpty) return 'Password is required';
                        if (value.length < 6) return 'Password must be at least 6 characters';
                        return null;
                      },
                    ),
                    const SizedBox(height: 12),
                    DropdownButtonFormField<String>(
                      value: _selectedRole,
                      decoration: const InputDecoration(labelText: 'User Role', prefixIcon: Icon(Icons.shield_outlined), border: OutlineInputBorder()),
                      items: availableRoles.map((role) {
                        return DropdownMenuItem<String>(
                          value: role,
                          child: Text(role.toUpperCase()),
                        );
                      }).toList(),
                      onChanged: (val) {
                        if (val != null) {
                          setState(() {
                            _selectedRole = val;
                          });
                        }
                      },
                    ),
                    const SizedBox(height: 14),
                    ElevatedButton.icon(
                      onPressed: () => _createUser(state),
                      style: ElevatedButton.styleFrom(backgroundColor: Colors.deepOrange, foregroundColor: Colors.white, minimumSize: const Size.fromHeight(45)),
                      icon: const Icon(Icons.add_moderator),
                      label: const Text('Create User Account'),
                    ),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(height: 20),
          // Active Users List
          Row(
            children: const [
              Icon(Icons.shield, color: Colors.deepOrange),
              SizedBox(width: 8),
              Text('Active System Users', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
            ],
          ),
          const SizedBox(height: 12),
          state.users.isEmpty
              ? const Card(child: Padding(padding: EdgeInsets.all(16.0), child: Center(child: CircularProgressIndicator())))
              : Card(
                  child: ListView.builder(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    itemCount: state.users.length,
                    itemBuilder: (context, index) {
                      final u = state.users[index];
                      final int userId = u['id'];
                      final String username = u['username'];
                      final String role = u['role'] ?? 'cashier';
                      final bool isSelf = state.username == username;

                      return Column(
                        children: [
                          ListTile(
                            leading: CircleAvatar(
                              backgroundColor: role == 'admin' ? Colors.green : Colors.blue,
                              foregroundColor: Colors.white,
                              child: Text(role[0].toUpperCase()),
                            ),
                            title: Text(username, style: const TextStyle(fontWeight: FontWeight.bold)),
                            subtitle: Text('Role: ${role.toUpperCase()} ${isSelf ? "(You)" : ""}'),
                            trailing: isSelf
                                ? const Text('Self Account', style: TextStyle(fontSize: 12, color: Colors.grey))
                                : Row(
                                    mainAxisSize: MainAxisSize.min,
                                    children: [
                                      ElevatedButton(
                                        onPressed: () => _toggleUserRole(userId, role, state),
                                        style: ElevatedButton.styleFrom(backgroundColor: Colors.grey[800], foregroundColor: Colors.white, padding: const EdgeInsets.symmetric(horizontal: 8), minimumSize: const Size(60, 32)),
                                        child: const Text('Change', style: TextStyle(fontSize: 10)),
                                      ),
                                      const SizedBox(width: 4),
                                      IconButton(
                                        icon: const Icon(Icons.delete, color: Colors.red, size: 20),
                                        onPressed: () => _deleteUser(userId, state),
                                      )
                                    ],
                                  ),
                          ),
                          if (index < state.users.length - 1)
                            const Divider(height: 1),
                        ],
                      );
                    },
                  ),
                ),
        ],
      ),
    );
  }
}
