import 'dart:io';
import 'package:flutter/material.dart';
import 'package:flutter/foundation.dart';
import 'package:provider/provider.dart';
import 'package:image_picker/image_picker.dart';
import '../providers/app_state.dart';
import '../services/api_service.dart';

class CustomInventoryScreen extends StatefulWidget {
  const CustomInventoryScreen({super.key});

  @override
  State<CustomInventoryScreen> createState() => _CustomInventoryScreenState();
}

class _CustomInventoryScreenState extends State<CustomInventoryScreen> {
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
              title: Text(isEdit ? 'Edit Custom Item' : 'Add New Custom Bill Item'),
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
                          decoration: const InputDecoration(labelText: 'Item Name', border: OutlineInputBorder()),
                          validator: (val) => val == null || val.trim().isEmpty ? 'Name is required' : null,
                        ),
                        const SizedBox(height: 12),
                        TextFormField(
                          controller: descController,
                          decoration: const InputDecoration(labelText: 'Description', border: OutlineInputBorder()),
                          maxLines: 2,
                        ),
                        const SizedBox(height: 12),
                        Row(
                          children: [
                            Expanded(
                              child: TextFormField(
                                controller: qtyController,
                                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                                decoration: const InputDecoration(labelText: 'Quantity (Stock in kg)', border: OutlineInputBorder()),
                                validator: (val) => val == null || double.tryParse(val) == null ? 'Invalid quantity' : null,
                              ),
                            ),
                            const SizedBox(width: 8),
                            Expanded(
                              child: TextFormField(
                                controller: priceController,
                                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                                decoration: const InputDecoration(labelText: 'Price (₹ per kg)', border: OutlineInputBorder()),
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
                            TextButton.icon(
                              onPressed: () async {
                                final XFile? img = await _imagePicker.pickImage(source: ImageSource.gallery);
                                if (img != null) {
                                  setStateDialog(() {
                                    pickedImage = img;
                                  });
                                }
                              },
                              icon: const Icon(Icons.photo_library),
                              label: const Text('Choose Image'),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ),
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(context),
                  child: const Text('Cancel'),
                ),
                ElevatedButton(
                  onPressed: () async {
                    if (!formKey.currentState!.validate()) return;
                    
                    try {
                      final name = nameController.text.trim();
                      final desc = descController.text.trim();
                      final double qty = double.parse(qtyController.text);
                      final double price = double.parse(priceController.text);
                      
                      if (isEdit) {
                        await ApiService.updateInventoryItem(
                          item['id'],
                          name,
                          desc,
                          qty,
                          price,
                          pickedImage?.path,
                          true, // isCustomBill
                        );
                        if (mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('Custom item updated successfully')),
                          );
                        }
                      } else {
                        await ApiService.addInventoryItem(
                          name,
                          desc,
                          qty,
                          price,
                          pickedImage?.path,
                          true, // isCustomBill
                        );
                        if (mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(content: Text('Custom item added successfully')),
                          );
                        }
                      }
                      
                      await state.fetchInventory();
                      if (mounted) Navigator.pop(context);
                    } catch (e) {
                      if (mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(content: Text(e.toString().replaceAll('Exception: ', ''))),
                        );
                      }
                    }
                  },
                  child: const Text('Save'),
                ),
              ],
            );
          },
        );
      },
    );
  }

  void _deleteItem(int id, BuildContext context, AppState state) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete Custom Item'),
        content: const Text('Are you sure you want to delete this custom item from inventory?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () async {
              try {
                await ApiService.deleteInventoryItem(id);
                await state.fetchInventory();
                if (mounted) {
                  Navigator.pop(ctx);
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Custom item deleted successfully')),
                  );
                }
              } catch (e) {
                if (mounted) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text(e.toString().replaceAll('Exception: ', ''))),
                  );
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
    final isAllowedToAdd = state.hasPermission('custom_bill_inventory', 'add');
    final isAllowedToEdit = state.hasPermission('custom_bill_inventory', 'edit');
    final isAllowedToDelete = state.hasPermission('custom_bill_inventory', 'delete');

    final filteredItems = state.inventory.where((item) {
      if (item['is_custom_bill'] != true) return false;
      final name = item['item_name'].toString().toLowerCase();
      final query = _searchQuery.toLowerCase().trim();
      return query.isEmpty || name.contains(query);
    }).toList();

    return Column(
      children: [
        // Search & Add Actions Row
        Padding(
          padding: const EdgeInsets.all(12.0),
          child: Row(
            children: [
              Expanded(
                child: TextField(
                  decoration: const InputDecoration(
                    labelText: 'Search custom inventory...',
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
              if (isAllowedToAdd) ...[
                const SizedBox(width: 12),
                ElevatedButton.icon(
                  onPressed: () => _showAddEditItemDialog(context),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.green,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                  icon: const Icon(Icons.add),
                  label: const Text('Add Item', style: TextStyle(fontWeight: FontWeight.bold)),
                ),
              ],
            ],
          ),
        ),
        // Stock Items List
        Expanded(
          child: filteredItems.isEmpty
              ? const Center(child: Text('No custom items found.'))
              : ListView.builder(
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  itemCount: filteredItems.length,
                  itemBuilder: (context, index) {
                    final item = filteredItems[index];
                    final double stock = double.tryParse(item['qty'].toString()) ?? 0.0;
                    final double price = double.tryParse(item['price'].toString()) ?? 0.0;
                    
                    final isLow = stock < 5.0;
                    final statusText = stock <= 0 
                        ? 'Out of Stock' 
                        : isLow 
                            ? 'Low Stock' 
                            : 'In Stock';
                    final statusColor = stock <= 0 
                        ? Colors.red 
                        : isLow 
                            ? Colors.orange 
                            : Colors.green;

                    return Card(
                      margin: const EdgeInsets.only(bottom: 10),
                      elevation: 1,
                      child: ListTile(
                        leading: Container(
                          width: 50,
                          height: 50,
                          decoration: BoxDecoration(
                            color: Colors.grey[200],
                            borderRadius: BorderRadius.circular(6),
                          ),
                          child: item['image_url'] != null
                              ? Image.network(
                                  item['image_url'].startsWith('http')
                                      ? item['image_url']
                                      : '${ApiService.baseUrl.replaceAll('/api', '')}${item['image_url']}',
                                  fit: BoxFit.cover,
                                  errorBuilder: (c, e, s) => const Icon(Icons.restaurant, color: Colors.grey),
                                )
                              : const Icon(Icons.restaurant, color: Colors.grey),
                        ),
                        title: Text(item['item_name'], style: const TextStyle(fontWeight: FontWeight.bold)),
                        subtitle: Text('Price: ₹${price.toStringAsFixed(2)}/kg  |  Stock: ${stock.toStringAsFixed(2)} kg'),
                        trailing: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                              decoration: BoxDecoration(
                                color: statusColor.withOpacity(0.15),
                                borderRadius: BorderRadius.circular(4),
                              ),
                              child: Text(
                                statusText,
                                style: TextStyle(color: statusColor, fontSize: 11, fontWeight: FontWeight.bold),
                              ),
                            ),
                            const SizedBox(width: 8),
                            if (isAllowedToEdit)
                              IconButton(
                                icon: const Icon(Icons.edit, color: Colors.blue),
                                onPressed: () => _showAddEditItemDialog(context, item),
                              ),
                            if (isAllowedToDelete)
                              IconButton(
                                icon: const Icon(Icons.delete, color: Colors.red),
                                onPressed: () => _deleteItem(item['id'], context, state),
                              ),
                          ],
                        ),
                      ),
                    );
                  },
                ),
        ),
      ],
    );
  }
}
