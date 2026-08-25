import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:provider/provider.dart';
import 'package:image_picker/image_picker.dart';
import '../providers/app_state.dart';
import '../services/api_service.dart';

class InventoryScreen extends StatefulWidget {
  const InventoryScreen({super.key});

  @override
  State<InventoryScreen> createState() => _InventoryScreenState();
}

class _InventoryScreenState extends State<InventoryScreen> {
  String _searchQuery = '';
  final ImagePicker _imagePicker = ImagePicker();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      Provider.of<AppState>(context, listen: false).fetchInventory();
    });
  }

  void _showAddEditItemDialog(BuildContext context, [dynamic item]) {
    final bool isEdit = item != null;
    final formKey = GlobalKey<FormState>();
    
    final nameController = TextEditingController(text: isEdit ? item['item_name'] : '');
    final descController = TextEditingController(text: isEdit ? (item['description'] ?? '') : '');
    final qtyController = TextEditingController(text: isEdit ? item['qty'].toString() : '');
    final priceController = TextEditingController(text: isEdit ? item['price'].toString() : '');
    XFile? pickedImage;

    showDialog(
      context: context,
      builder: (context) {
        final state = Provider.of<AppState>(context, listen: false);
        return StatefulBuilder(
          builder: (context, setStateDialog) {
            return AlertDialog(
              title: Text(isEdit ? 'Edit Inventory Item' : state.getLabel('inv_add_item_title', 'Add New Inventory Item')),
              content: SingleChildScrollView(
                child: SizedBox(
                  width: 400,
                  child: Form(
                    key: formKey,
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        TextFormField(
                          controller: nameController,
                          decoration: InputDecoration(labelText: state.getLabel('inv_item_name_label', 'Item Name'), border: const OutlineInputBorder()),
                          validator: (val) => val == null || val.trim().isEmpty ? 'Name is required' : null,
                        ),
                        const SizedBox(height: 12),
                        TextFormField(
                          controller: descController,
                          decoration: InputDecoration(labelText: state.getLabel('inv_description_label', 'Description'), border: const OutlineInputBorder()),
                          maxLines: 2,
                        ),
                        const SizedBox(height: 12),
                        Row(
                          children: [
                            Expanded(
                              child: TextFormField(
                                controller: qtyController,
                                keyboardType: TextInputType.number,
                                decoration: InputDecoration(labelText: state.getLabel('inv_qty_label', 'Quantity (Stock)'), border: const OutlineInputBorder()),
                                validator: (val) => val == null || int.tryParse(val) == null ? 'Invalid qty' : null,
                              ),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: TextFormField(
                                controller: priceController,
                                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                                decoration: InputDecoration(labelText: state.getLabel('inv_price_label', 'Price (₹)'), border: const OutlineInputBorder()),
                                validator: (val) => val == null || double.tryParse(val) == null ? 'Invalid price' : null,
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 16),
                        // Image Picker display
                        Row(
                          children: [
                            Container(
                              width: 60,
                              height: 60,
                              decoration: BoxDecoration(
                                color: Colors.grey[200],
                                border: Border.all(color: Colors.grey[350]!),
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: pickedImage != null
                                  ? (kIsWeb
                                      ? Image.network(pickedImage!.path, fit: BoxFit.cover)
                                      : Image.file(File(pickedImage!.path), fit: BoxFit.cover))
                                  : (isEdit && item['image_url'] != null
                                      ? Image.network(
                                           item['image_url'].startsWith('http')
                                               ? item['image_url']
                                               : '${ApiService.baseUrl.replaceAll('/api', '')}${item['image_url']}',
                                           fit: BoxFit.cover,
                                         )
                                      : const Icon(Icons.image, color: Colors.grey)),
                            ),
                            const SizedBox(width: 12),
                            ElevatedButton.icon(
                              onPressed: () async {
                                final XFile? file = await _imagePicker.pickImage(source: ImageSource.gallery);
                                if (file != null) {
                                  setStateDialog(() {
                                    pickedImage = file;
                                  });
                                }
                              },
                              icon: const Icon(Icons.photo_library),
                              label: const Text('Select Image'),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              actions: [
                TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
                ElevatedButton(
                  onPressed: () async {
                    if (!formKey.currentState!.validate()) return;
                    
                    final name = nameController.text.trim();
                    final desc = descController.text.trim();
                    final qty = double.parse(qtyController.text);
                    final price = double.parse(priceController.text);

                    try {
                      if (isEdit) {
                        await ApiService.updateInventoryItem(item['id'], name, desc, qty, price, pickedImage?.path);
                        if (mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Item updated successfully')));
                        }
                      } else {
                        await ApiService.addInventoryItem(name, desc, qty, price, pickedImage?.path);
                        if (mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Item created successfully')));
                        }
                      }
                      
                      if (mounted) {
                        Provider.of<AppState>(context, listen: false).fetchInventory();
                        Navigator.pop(context);
                      }
                    } catch (e) {
                      if (mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: ${e.toString()}')));
                      }
                    }
                  },
                  style: ElevatedButton.styleFrom(backgroundColor: Colors.deepOrange, foregroundColor: Colors.white),
                  child: Text(isEdit ? 'Save Changes' : state.getLabel('inv_add_button', 'Add Item')),
                ),
              ],
            );
          },
        );
      },
    );
  }

  void _deleteItem(BuildContext context, int itemId, AppState state) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete Inventory Item'),
        content: const Text('Are you sure you want to delete this menu item? This cannot be undone.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
          TextButton(
            onPressed: () async {
              try {
                await ApiService.deleteInventoryItem(itemId);
                if (mounted) {
                  Navigator.pop(context);
                  ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Item deleted successfully')));
                }
                state.fetchInventory();
              } catch (e) {
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text('Error: ${e.toString()}')));
                }
              }
            },
            child: const Text('Delete', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final state = Provider.of<AppState>(context);
    final filteredInventory = state.inventory.where((item) {
      final name = item['item_name'].toString().toLowerCase();
      final query = _searchQuery.toLowerCase().trim();
      return query.isEmpty || name.contains(query);
    }).toList();

    return Scaffold(
      body: Column(
        children: [
          // Search box
          Padding(
            padding: const EdgeInsets.all(12.0),
            child: TextField(
              decoration: const InputDecoration(
                labelText: 'Search inventory items...',
                prefixIcon: Icon(Icons.search),
                border: OutlineInputBorder(),
              ),
              onChanged: (val) {
                setState(() {
                  _searchQuery = val;
                });
              },
            ),
          ),
          // Items list
          Expanded(
            child: filteredInventory.isEmpty
                ? const Center(child: Text('No inventory items found'))
                : ListView.builder(
                    padding: const EdgeInsets.symmetric(horizontal: 8),
                    itemCount: filteredInventory.length,
                    itemBuilder: (context, index) {
                      final item = filteredInventory[index];
                      final int itemId = item['id'] is int ? item['id'] : (int.tryParse(item['id'].toString()) ?? 0);
                      final double qty = double.tryParse(item['qty'].toString()) ?? 0.0;
                      final bool isLowStock = qty < 5.0;

                      return Card(
                        child: ListTile(
                          leading: Container(
                            width: 50,
                            height: 50,
                            decoration: BoxDecoration(
                              color: Colors.grey[200],
                              borderRadius: BorderRadius.circular(4),
                            ),
                            child: item['image_url'] != null
                                ? Image.network(
                                    item['image_url'].startsWith('http')
                                        ? item['image_url']
                                        : '${ApiService.baseUrl.replaceAll('/api', '')}${item['image_url']}',
                                    fit: BoxFit.cover,
                                    errorBuilder: (context, error, stackTrace) => const Icon(Icons.fastfood, color: Colors.grey),
                                  )
                                : const Icon(Icons.fastfood, color: Colors.grey),
                          ),
                          title: Text(item['item_name'], style: const TextStyle(fontWeight: FontWeight.bold)),
                          subtitle: Text('Price: ₹${item['price']} | Description: ${item['description'] ?? "N/A"}'),
                          trailing: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              // Quantity warning display
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                decoration: BoxDecoration(
                                  color: isLowStock ? Colors.red.withOpacity(0.1) : Colors.green.withOpacity(0.1),
                                  borderRadius: BorderRadius.circular(4),
                                ),
                                child: Text(
                                  'Qty: ${qty % 1 == 0 ? qty.toInt() : qty}',
                                  style: TextStyle(
                                    fontSize: 12,
                                    fontWeight: FontWeight.bold,
                                    color: isLowStock ? Colors.red : Colors.green,
                                  ),
                                ),
                              ),
                              if (state.hasPermission('inventory', 'edit') || state.hasPermission('inventory', 'update'))
                                IconButton(
                                  icon: const Icon(Icons.edit, color: Colors.blue),
                                  onPressed: () => _showAddEditItemDialog(context, item),
                                ),
                              if (state.hasPermission('inventory', 'delete'))
                                IconButton(
                                  icon: const Icon(Icons.delete, color: Colors.red),
                                   onPressed: () => _deleteItem(context, itemId, state),
                                ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
          ),
        ],
      ),
      floatingActionButton: state.hasPermission('inventory', 'add')
          ? FloatingActionButton(
              onPressed: () => _showAddEditItemDialog(context),
              backgroundColor: Colors.deepOrange,
              foregroundColor: Colors.white,
              child: const Icon(Icons.add),
            )
          : null,
    );
  }
}
