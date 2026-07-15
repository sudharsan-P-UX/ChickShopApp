import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/app_state.dart';
import '../services/api_service.dart';

class LabelsScreen extends StatefulWidget {
  const LabelsScreen({super.key});

  @override
  State<LabelsScreen> createState() => _LabelsScreenState();
}

class _LabelsScreenState extends State<LabelsScreen> {
  final Map<String, TextEditingController> _controllers = {};
  bool _isSaving = false;

  @override
  void dispose() {
    _controllers.forEach((_, c) => c.dispose());
    super.dispose();
  }

  void _saveLabels(AppState state) async {
    setState(() => _isSaving = true);
    final List<Map<String, dynamic>> payload = [];
    _controllers.forEach((key, controller) {
      payload.add({
        'label_key': key,
        'custom_label': controller.text.trim(),
      });
    });

    try {
      await ApiService.updateCustomLabels(payload);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Custom labels saved successfully!')),
      );
      await state.fetchCustomLabels(); // refresh local state
    } catch (e) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error saving labels: $e')),
      );
    } finally {
      setState(() => _isSaving = false);
    }
  }

  String _getSectionTitle(String menuKey) {
    switch (menuKey) {
      case 'billing': return 'Register & Billing';
      case 'overview': return 'Store Overview & Dashboard';
      case 'inventory': return 'Inventory Control';
      case 'customers': return 'Customer Directory';
      case 'users': return 'User Management';
      case 'custom_labels': return 'Custom Labels';
      default: return menuKey.toUpperCase();
    }
  }

  @override
  Widget build(BuildContext context) {
    final state = Provider.of<AppState>(context);

    // Initialize controllers for labels
    for (var l in state.customLabels) {
      final key = l['label_key'].toString();
      final val = l['custom_label'].toString();
      if (!_controllers.containsKey(key)) {
        _controllers[key] = TextEditingController(text: val);
      }
    }

    // Group labels by menu_key
    final Map<String, List<dynamic>> groups = {};
    for (var l in state.customLabels) {
      final mKey = l['menu_key'].toString();
      groups.putIfAbsent(mKey, () => []).add(l);
    }

    return Scaffold(
      body: _isSaving
          ? const Center(child: CircularProgressIndicator())
          : state.customLabels.isEmpty
              ? const Center(child: Text('No labels found.'))
              : ListView(
                  padding: const EdgeInsets.all(16),
                  children: [
                    const Text(
                      'Customize System Names & Buttons',
                      style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                    ),
                    const SizedBox(height: 4),
                    const Text(
                      'Changes here apply globally across both Web and Mobile apps.',
                      style: TextStyle(color: Colors.grey, fontSize: 12),
                    ),
                    const SizedBox(height: 16),
                    ...groups.entries.map((group) {
                      final menuKey = group.key;
                      final items = group.value;

                      return Card(
                        margin: const EdgeInsets.only(bottom: 16),
                        child: Padding(
                          padding: const EdgeInsets.all(12),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                _getSectionTitle(menuKey),
                                style: const TextStyle(
                                  fontWeight: FontWeight.bold,
                                  color: Colors.deepOrange,
                                  fontSize: 14,
                                ),
                              ),
                              const Divider(),
                              ...items.map((item) {
                                final key = item['label_key'].toString();
                                final name = item['label_name'].toString();

                                return Padding(
                                  padding: const EdgeInsets.symmetric(vertical: 8),
                                  child: TextFormField(
                                    controller: _controllers[key],
                                    decoration: InputDecoration(
                                      labelText: name,
                                      border: const OutlineInputBorder(),
                                      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                                    ),
                                  ),
                                );
                              }).toList(),
                            ],
                          ),
                        ),
                      );
                    }).toList(),
                  ],
                ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: _isSaving ? null : () => _saveLabels(state),
        backgroundColor: Colors.green,
        foregroundColor: Colors.white,
        icon: const Icon(Icons.save),
        label: const Text('Save Labels'),
      ),
    );
  }
}
