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
  final Map<int, Map<String, dynamic>> _workingPermissions = {};
  bool _isSavingPrivileges = false;

  bool _getPermission(int roleId, String menu, String action) {
    if (!_workingPermissions.containsKey(roleId)) return false;
    final rolePerms = _workingPermissions[roleId];
    if (rolePerms == null || !rolePerms.containsKey(menu)) return false;
    final menuPerms = rolePerms[menu];
    if (menuPerms == null || !menuPerms.containsKey(action)) return false;
    return menuPerms[action] == true;
  }

  void _togglePermission(int roleId, String menu, String action) {
    setState(() {
      if (!_workingPermissions.containsKey(roleId)) {
        _workingPermissions[roleId] = {};
      }
      final rolePerms = _workingPermissions[roleId]!;
      if (!rolePerms.containsKey(menu)) {
        rolePerms[menu] = {};
      }
      final menuPerms = rolePerms[menu]!;
      menuPerms[action] = !(menuPerms[action] == true);
    });
  }

  void _saveAllPrivileges(AppState state) async {
    setState(() => _isSavingPrivileges = true);
    try {
      for (var entry in _workingPermissions.entries) {
        final roleId = entry.key;
        final perms = entry.value;
        
        final roleObj = state.roles.firstWhere((r) => r['id'] == roleId, orElse: () => null);
        if (roleObj != null && (roleObj['role_name'] == 'super_admin' || roleObj['role_name'] == 'superadmin')) {
          continue; // skip super admin
        }
        
        await ApiService.updateRolePermissions(roleId, perms);
      }
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('All role privilege updates saved successfully!')),
      );
      state.fetchUsers(); // Refresh roles & users
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error saving privileges: ${e.toString()}')),
      );
    } finally {
      setState(() => _isSavingPrivileges = false);
    }
  }

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
      rolesList.addAll(['super_admin', 'admin', 'cashier']);
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

  void _showEditUserDialog(int userId, String initialUsername, String initialRole, AppState state) {
    final editUsernameController = TextEditingController(text: initialUsername);
    final editPasswordController = TextEditingController();
    String editSelectedRole = initialRole;
    bool obscurePassword = true;

    showDialog(
      context: context,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setDialogState) {
            return AlertDialog(
              title: const Text('Update User Account'),
              content: SingleChildScrollView(
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    TextField(
                      controller: editUsernameController,
                      decoration: const InputDecoration(
                        labelText: 'Username',
                        border: OutlineInputBorder(),
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: editPasswordController,
                      obscureText: obscurePassword,
                      decoration: InputDecoration(
                        labelText: 'New Password (optional)',
                        helperText: 'Leave blank to keep current password',
                        border: const OutlineInputBorder(),
                        suffixIcon: IconButton(
                          icon: Icon(obscurePassword ? Icons.visibility : Icons.visibility_off),
                          onPressed: () {
                            setDialogState(() {
                              obscurePassword = !obscurePassword;
                            });
                          },
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                    DropdownButtonFormField<String>(
                      value: state.roles.any((r) => r['role_name'] == editSelectedRole) ? editSelectedRole : null,
                      decoration: const InputDecoration(
                        labelText: 'System Role',
                        border: OutlineInputBorder(),
                      ),
                      items: state.roles.map<DropdownMenuItem<String>>((r) {
                        final name = r['role_name'].toString();
                        return DropdownMenuItem<String>(
                          value: name,
                          child: Text(name.toUpperCase()),
                        );
                      }).toList(),
                      onChanged: (val) {
                        if (val != null) {
                          setDialogState(() {
                            editSelectedRole = val;
                          });
                        }
                      },
                    ),
                  ],
                ),
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(context),
                  child: const Text('Cancel'),
                ),
                ElevatedButton(
                  onPressed: () async {
                    final u = editUsernameController.text.trim();
                    final p = editPasswordController.text.trim();
                    if (u.isEmpty) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Username cannot be empty')),
                      );
                      return;
                    }
                    if (p.isNotEmpty && p.length < 6) {
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(content: Text('Password must be at least 6 characters')),
                      );
                      return;
                    }
                    
                    try {
                      await state.updateUserAccount(userId, u, p.isEmpty ? null : p, editSelectedRole);
                      if (context.mounted) {
                        Navigator.pop(context);
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('User updated successfully!')),
                        );
                      }
                    } catch (e) {
                      if (context.mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(content: Text('Update failed: $e')),
                        );
                      }
                    }
                  },
                  child: const Text('Save Changes'),
                ),
              ],
            );
          },
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final state = Provider.of<AppState>(context);

    // Initialize working permissions copy
    if (_workingPermissions.isEmpty && state.roles.isNotEmpty) {
      for (var r in state.roles) {
        final roleId = r['id'];
        final rawPerms = r['permissions'];
        Map<String, dynamic> perms = {};
        if (rawPerms is Map) {
          perms = Map<String, dynamic>.from(rawPerms.map((k, v) {
            final menuKey = k.toString();
            final menuActions = Map<String, dynamic>.from(v as Map);
            return MapEntry(menuKey, menuActions);
          }));
        }
        _workingPermissions[roleId] = perms;
      }
    }

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
      availableRoles.addAll(['super_admin', 'admin', 'cashier']);
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
                  Text(state.getLabel('user_roles_title', 'Custom System Roles'), style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
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
                      final isDefault = name == 'admin' || name == 'cashier' || name == 'super_admin' || name == 'superadmin';
                      
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
                    Text(state.getLabel('user_register_title', 'Register New User'), style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15)),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _usernameController,
                      decoration: InputDecoration(labelText: state.getLabel('user_username_label', 'Username'), prefixIcon: const Icon(Icons.person_outline), border: const OutlineInputBorder()),
                      validator: (value) => value == null || value.trim().isEmpty ? 'Username is required' : null,
                    ),
                    const SizedBox(height: 12),
                    TextFormField(
                      controller: _passwordController,
                      obscureText: true,
                      decoration: InputDecoration(labelText: state.getLabel('user_password_label', 'Password'), prefixIcon: const Icon(Icons.lock_outline), border: const OutlineInputBorder()),
                      validator: (value) {
                        if (value == null || value.isEmpty) return 'Password is required';
                        if (value.length < 6) return 'Password must be at least 6 characters';
                        return null;
                      },
                    ),
                    const SizedBox(height: 12),
                    DropdownButtonFormField<String>(
                      value: _selectedRole,
                      decoration: InputDecoration(labelText: state.getLabel('user_role_label', 'User Role'), prefixIcon: const Icon(Icons.shield_outlined), border: const OutlineInputBorder()),
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
                      label: Text(state.getLabel('user_register_title', 'Register New User')),
                    ),
                  ],
                ),
              ),
            ),
          ),
          const SizedBox(height: 20),
          // Active Users List
          Row(
            children: [
              const Icon(Icons.shield, color: Colors.deepOrange),
              const SizedBox(width: 8),
              Text(state.getLabel('user_list_title', 'System Users'), style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
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
                              backgroundColor: (role == 'super_admin' || role == 'superadmin' || role == 'admin') ? Colors.green : Colors.blue,
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
                                      IconButton(
                                        icon: const Icon(Icons.edit, color: Colors.blue, size: 20),
                                        onPressed: () => _showEditUserDialog(userId, username, role, state),
                                      ),
                                      ElevatedButton(
                                        onPressed: () => _toggleUserRole(userId, role, state),
                                        style: ElevatedButton.styleFrom(backgroundColor: Colors.grey[800], foregroundColor: Colors.white, padding: const EdgeInsets.symmetric(horizontal: 8), minimumSize: const Size(60, 32)),
                                        child: const Text('Role', style: TextStyle(fontSize: 10)),
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
          const SizedBox(height: 24),
          Row(
            children: [
              const Icon(Icons.lock_open, color: Colors.deepOrange),
              const SizedBox(width: 8),
              Text(state.getLabel('user_rbac_title', 'Role Access Control (Privilege Matrix)'), style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
            ],
          ),
          const SizedBox(height: 12),
          Card(
            elevation: 2,
            child: Padding(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    state.getLabel('user_rbac_subtitle', 'Configure dynamic view and action (Add, Edit, Delete) authorization privileges for each role'),
                    style: const TextStyle(fontSize: 12, color: Colors.grey),
                  ),
                  const SizedBox(height: 12),
                  ...state.roles.map((r) {
                    final roleId = r['id'];
                    final roleName = r['role_name'].toString();
                    final isSuperAdminRole = roleName == 'super_admin' || roleName == 'superadmin';
                    
                    return ExpansionTile(
                      title: Text(
                        roleName.toUpperCase(),
                        style: TextStyle(
                          fontWeight: FontWeight.bold,
                          color: isSuperAdminRole ? Colors.green : Colors.deepOrange,
                        ),
                      ),
                      subtitle: Text(isSuperAdminRole ? 'Full Access Granted' : 'Custom Privilege Access rules'),
                      children: [
                        _buildMenuPermissionRow(roleId, 'dashboard', state.getLabel('user_rbac_th_overview', 'Dashboard Overview'), isSuperAdminRole, ['view']),
                        _buildMenuPermissionRow(roleId, 'billing', state.getLabel('user_rbac_th_billing', 'Billing & POS'), isSuperAdminRole, ['view', 'add', 'delete']),
                        _buildMenuPermissionRow(roleId, 'cart', state.getLabel('user_rbac_th_cart', 'View Cart'), isSuperAdminRole, ['view']),
                        _buildMenuPermissionRow(roleId, 'pending', state.getLabel('user_rbac_th_pending', 'Pending Orders'), isSuperAdminRole, ['view', 'delete']),
                        _buildMenuPermissionRow(roleId, 'inventory', state.getLabel('user_rbac_th_inventory', 'Inventory'), isSuperAdminRole, ['view', 'add', 'edit', 'delete']),
                        _buildMenuPermissionRow(roleId, 'customers', state.getLabel('user_rbac_th_customers', 'Customers'), isSuperAdminRole, ['view', 'add']),
                        _buildMenuPermissionRow(roleId, 'users', state.getLabel('user_rbac_th_users', 'User & Role Management'), isSuperAdminRole, ['view', 'add', 'edit', 'delete']),
                        _buildMenuPermissionRow(roleId, 'custom_labels', state.getLabel('user_rbac_th_labels', 'Custom Labels'), isSuperAdminRole, ['view']),
                      ],
                    );
                  }).toList(),
                  const SizedBox(height: 16),
                  ElevatedButton.icon(
                    onPressed: _isSavingPrivileges ? null : () => _saveAllPrivileges(state),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.green,
                      foregroundColor: Colors.white,
                      minimumSize: const Size.fromHeight(45),
                    ),
                    icon: _isSavingPrivileges
                        ? const SizedBox(width: 20, height: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                        : const Icon(Icons.save),
                    label: Text(state.getLabel('user_rbac_save_button', 'Save Privileges')),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMenuPermissionRow(int roleId, String menu, String title, bool isAdminRole, List<String> actions) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8.0, horizontal: 16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
          const SizedBox(height: 4),
          Wrap(
            spacing: 12,
            children: actions.map((act) {
              final isChecked = isAdminRole ? true : _getPermission(roleId, menu, act);
              return Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  SizedBox(
                    width: 24,
                    height: 24,
                    child: Checkbox(
                      value: isChecked,
                      onChanged: isAdminRole ? null : (val) => _togglePermission(roleId, menu, act),
                    ),
                  ),
                  const SizedBox(width: 4),
                  Text(act.toUpperCase(), style: const TextStyle(fontSize: 11)),
                ],
              );
            }).toList(),
          ),
          const Divider(height: 16),
        ],
      ),
    );
  }
}
