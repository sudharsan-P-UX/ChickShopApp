import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/app_state.dart';

class MenuOrderScreen extends StatefulWidget {
  const MenuOrderScreen({super.key});

  @override
  State<MenuOrderScreen> createState() => _MenuOrderScreenState();
}

class _MenuOrderScreenState extends State<MenuOrderScreen> {
  // Store dynamic edits: submenu_key -> Map containing {'order': TextEditingController, 'active': bool}
  final Map<String, Map<String, dynamic>> _edits = {};
  bool _isLoading = false;

  @override
  void initState() {
    super.initState();
    _loadData();
  }

  void _loadData() async {
    setState(() => _isLoading = true);
    final state = Provider.of<AppState>(context, listen: false);
    await state.fetchMenuOrders();
    _syncEditsFromState(state);
    if (mounted) setState(() => _isLoading = false);
  }

  void _syncEditsFromState(AppState state) {
    _edits.clear();
    for (var m in state.menuOrders) {
      final String key = m['submenu_key'];
      _edits[key] = {
        'order': TextEditingController(text: m['display_order'].toString()),
        'active': m['is_active'] == true,
        'main_menu': m['main_menu'],
        'submenu_name': m['submenu_name']
      };
    }
  }

  @override
  void dispose() {
    for (var item in _edits.values) {
      (item['order'] as TextEditingController).dispose();
    }
    super.dispose();
  }

  void _saveChanges(AppState state) async {
    // 1. Validation checks (no duplicates within each section)
    final Map<String, List<int>> groupOrders = {};
    final List<Map<String, dynamic>> updates = [];

    bool hasValidationErrors = false;

    _edits.forEach((key, item) {
      final String group = item['main_menu'];
      final String name = item['submenu_name'];
      final String valStr = (item['order'] as TextEditingController).text.trim();
      final int? orderVal = int.tryParse(valStr);

      if (orderVal == null || orderVal <= 0) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Invalid display order for submenu "$name"')),
        );
        hasValidationErrors = true;
        return;
      }

      if (!groupOrders.containsKey(group)) {
        groupOrders[group] = [];
      }

      if (groupOrders[group]!.contains(orderVal)) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Duplicate order value ($orderVal) is not allowed in category "$group"')),
        );
        hasValidationErrors = true;
        return;
      }

      groupOrders[group]!.add(orderVal);

      updates.add({
        'submenu_key': key,
        'display_order': orderVal,
        'is_active': item['active'] == true
      });
    });

    if (hasValidationErrors) return;

    setState(() => _isLoading = true);
    try {
      await state.saveMenuOrders(updates);
      _syncEditsFromState(state);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Menu configurations saved and re-applied successfully!')),
        );
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error saving: ${e.toString().replaceAll('Exception: ', '')}')),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = Provider.of<AppState>(context);

    // Group items by main_menu
    final Map<String, List<dynamic>> groups = {};
    for (var m in state.menuOrders) {
      final String group = m['main_menu'] ?? 'Other';
      if (!groups.containsKey(group)) {
        groups[group] = [];
      }
      groups[group]!.add(m);
    }

    final List<String> groupsOrder = [
      'Create Billing',
      'Cart',
      'Orders',
      'Dashboards',
      'Customer',
      'Admin'
    ];

    return Scaffold(
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : ListView.builder(
              padding: const EdgeInsets.all(12),
              itemCount: groupsOrder.length,
              itemBuilder: (context, idx) {
                final groupName = groupsOrder[idx];
                if (!groups.containsKey(groupName)) return const SizedBox();
                final List<dynamic> items = groups[groupName]!;

                // Sort items by display_order to render them initial layout sorted
                items.sort((a, b) => (a['display_order'] as num).compareTo(b['display_order'] as num));

                return Card(
                  margin: const EdgeInsets.only(bottom: 16),
                  elevation: 2,
                  child: Padding(
                    padding: const EdgeInsets.all(14.0),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          groupName,
                          style: const TextStyle(
                            fontSize: 16,
                            fontWeight: FontWeight.bold,
                            color: Colors.deepOrange,
                          ),
                        ),
                        const Divider(),
                        Table(
                          columnWidths: const {
                            0: FlexColumnWidth(1),
                            1: FlexColumnWidth(4),
                            2: FlexColumnWidth(2),
                            3: FlexColumnWidth(2.5),
                          },
                          verticalAlignment: TableCellVerticalAlignment.middle,
                          children: [
                            const TableRow(
                              decoration: BoxDecoration(border: Border(bottom: BorderSide(color: Colors.grey, width: 0.5))),
                              children: [
                                Padding(padding: EdgeInsets.symmetric(vertical: 8), child: Text('SI.No', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13))),
                                Padding(padding: EdgeInsets.symmetric(vertical: 8), child: Text('Menu Name', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13))),
                                Padding(padding: EdgeInsets.symmetric(vertical: 8), child: Text('Order', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13), textAlign: TextAlign.center)),
                                Padding(padding: EdgeInsets.symmetric(vertical: 8), child: Text('Status', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13), textAlign: TextAlign.center)),
                              ],
                            ),
                            ...items.map((item) {
                              final String key = item['submenu_key'];
                              final editItem = _edits[key];
                              if (editItem == null) return const TableRow(children: [SizedBox(), SizedBox(), SizedBox(), SizedBox()]);

                              final int displayIndex = items.indexOf(item) + 1;

                              return TableRow(
                                children: [
                                  Padding(
                                    padding: const EdgeInsets.symmetric(vertical: 6.0),
                                    child: Text('$displayIndex', style: const TextStyle(fontSize: 13)),
                                  ),
                                  Padding(
                                    padding: const EdgeInsets.symmetric(vertical: 6.0),
                                    child: Text(item['submenu_name'], style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13)),
                                  ),
                                  Padding(
                                    padding: const EdgeInsets.symmetric(vertical: 6.0),
                                    child: TextField(
                                      controller: editItem['order'] as TextEditingController,
                                      enabled: state.hasPermission('menu_order', 'edit') || state.hasPermission('menu_order', 'update'),
                                      keyboardType: TextInputType.number,
                                      textAlign: TextAlign.center,
                                      style: const TextStyle(fontSize: 13),
                                      decoration: const InputDecoration(
                                        isDense: true,
                                        contentPadding: EdgeInsets.symmetric(horizontal: 6, vertical: 8),
                                        border: OutlineInputBorder(),
                                      ),
                                    ),
                                  ),
                                  Padding(
                                    padding: const EdgeInsets.symmetric(vertical: 6.0),
                                    child: Row(
                                      mainAxisAlignment: MainAxisAlignment.center,
                                      children: [
                                        Checkbox(
                                          value: editItem['active'] == true,
                                          onChanged: (state.hasPermission('menu_order', 'edit') || state.hasPermission('menu_order', 'update'))
                                              ? (val) {
                                                  setState(() {
                                                    editItem['active'] = val;
                                                  });
                                                }
                                              : null,
                                        ),
                                        const Text('Active', style: TextStyle(fontSize: 11)),
                                      ],
                                    ),
                                  ),
                                ],
                              );
                            }),
                          ],
                        ),
                      ],
                    ),
                  ),
                );
              },
            ),
      bottomNavigationBar: (state.hasPermission('menu_order', 'edit') || state.hasPermission('menu_order', 'update'))
          ? Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.white,
                boxShadow: [
                  BoxShadow(color: Colors.grey.withOpacity(0.3), blurRadius: 4, offset: const Offset(0, -2)),
                ],
              ),
              child: Row(
                children: [
                  Expanded(
                    child: OutlinedButton(
                      onPressed: _isLoading ? null : () => _loadData(),
                      style: OutlinedButton.styleFrom(
                        padding: const EdgeInsets.symmetric(vertical: 14),
                      ),
                      child: const Text('Reset Changes'),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: ElevatedButton(
                      onPressed: _isLoading ? null : () => _saveChanges(state),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.green,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 14),
                      ),
                      child: const Text('Save Menu Order'),
                    ),
                  ),
                ],
              ),
            )
          : null,
    );
  }
}
