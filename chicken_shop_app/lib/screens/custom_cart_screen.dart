import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/app_state.dart';
import '../services/api_service.dart';

class CustomCartScreen extends StatefulWidget {
  const CustomCartScreen({super.key});

  @override
  State<CustomCartScreen> createState() => _CustomCartScreenState();
}

class _CustomCartScreenState extends State<CustomCartScreen> {
  final TextEditingController _phoneController = TextEditingController();
  final TextEditingController _discountController = TextEditingController();
  bool _isProcessing = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final state = Provider.of<AppState>(context, listen: false);
      state.fetchCustomers();
      if (state.customSelectedCustomer != null) {
        _phoneController.text = state.customSelectedCustomer!['phone_no'] ?? '';
      }
      _discountController.text = state.customDiscount > 0 ? state.customDiscount.toString() : '';
    });
  }

  @override
  void dispose() {
    _phoneController.dispose();
    _discountController.dispose();
    super.dispose();
  }

  void _lookupCustomer(AppState state) async {
    final phone = _phoneController.text.trim();
    if (phone.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter a phone number')),
      );
      return;
    }

    await state.fetchCustomers();

    final customer = state.customers.firstWhere(
      (c) => c['phone_no'] == phone,
      orElse: () => null,
    );

    if (customer != null) {
      state.selectCustomCustomer(customer);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Customer found: ${customer['name']}')),
      );
    } else {
      _showRegisterCustomerDialog(phone, state);
    }
  }

  void _showRegisterCustomerDialog(String phone, AppState state) {
    final TextEditingController nameController = TextEditingController();
    showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: const Text('Customer Not Found'),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Text('The phone number $phone is not registered. Would you like to register them now?'),
              const SizedBox(height: 12),
              TextField(
                controller: nameController,
                decoration: const InputDecoration(
                  labelText: 'Full Name',
                  border: OutlineInputBorder(),
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancel'),
            ),
            ElevatedButton(
              onPressed: () async {
                final name = nameController.text.trim();
                if (name.isEmpty) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Name is required')),
                  );
                  return;
                }

                try {
                  final newCustomer = await ApiService.registerCustomer(phone, name);
                  state.selectCustomCustomer(newCustomer);
                  await state.fetchCustomers();
                  if (mounted) {
                    Navigator.pop(context);
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text('Customer registered and selected: $name')),
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
              child: const Text('Register'),
            ),
          ],
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final state = Provider.of<AppState>(context);
    final cartEntries = state.customCart.entries.toList();

    return Padding(
      padding: const EdgeInsets.all(16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          // Clear Cart Button at top
          if (cartEntries.isNotEmpty)
            Align(
              alignment: Alignment.centerRight,
              child: TextButton.icon(
                onPressed: () {
                  showDialog(
                    context: context,
                    builder: (ctx) => AlertDialog(
                      title: const Text('Clear Custom Cart'),
                      content: const Text('Are you sure you want to clear all items in the custom cart?'),
                      actions: [
                        TextButton(
                          onPressed: () => Navigator.pop(ctx),
                          child: const Text('Cancel'),
                        ),
                        TextButton(
                          onPressed: () {
                            state.clearCustomCart();
                            Navigator.pop(ctx);
                            _phoneController.clear();
                            _discountController.clear();
                          },
                          child: const Text('Clear', style: TextStyle(color: Colors.red)),
                        ),
                      ],
                    ),
                  );
                },
                icon: const Icon(Icons.delete_sweep, color: Colors.red),
                label: const Text('Clear Cart', style: TextStyle(color: Colors.red)),
              ),
            ),

          Expanded(
            child: cartEntries.isEmpty
                ? const Center(
                    child: Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.shopping_basket_outlined, size: 64, color: Colors.grey),
                        SizedBox(height: 12),
                        Text('Your Custom Cart is empty.', style: TextStyle(fontSize: 16, color: Colors.grey)),
                      ],
                    ),
                  )
                : ListView.builder(
                    itemCount: cartEntries.length,
                    itemBuilder: (context, index) {
                      final entry = cartEntries[index];
                      final itemId = entry.key;
                      final qty = entry.value;

                      final item = state.inventory.firstWhere(
                        (i) => i['id'] == itemId,
                        orElse: () => null,
                      );

                      if (item == null) return const SizedBox();
                      final double price = double.tryParse(item['price'].toString()) ?? 0.0;
                      final double itemSubtotal = price * qty;

                      return Card(
                        margin: const EdgeInsets.only(bottom: 8),
                        child: ListTile(
                          title: Text(item['item_name'], style: const TextStyle(fontWeight: FontWeight.bold)),
                          subtitle: Text('₹${price.toStringAsFixed(2)} x ${qty.toStringAsFixed(2)} kg'),
                          trailing: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(
                                '₹${itemSubtotal.toStringAsFixed(2)}',
                                style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.deepOrange),
                              ),
                              const SizedBox(width: 8),
                              IconButton(
                                icon: const Icon(Icons.remove_circle_outline, color: Colors.red),
                                onPressed: () {
                                  try {
                                    state.updateCustomCartQty(itemId, -0.5);
                                  } catch (e) {
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      SnackBar(content: Text(e.toString().replaceAll('Exception: ', ''))),
                                    );
                                  }
                                },
                              ),
                              IconButton(
                                icon: const Icon(Icons.add_circle_outline, color: Colors.green),
                                onPressed: () {
                                  try {
                                    state.updateCustomCartQty(itemId, 0.5);
                                  } catch (e) {
                                    ScaffoldMessenger.of(context).showSnackBar(
                                      SnackBar(content: Text(e.toString().replaceAll('Exception: ', ''))),
                                    );
                                  }
                                },
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
          ),

          if (cartEntries.isNotEmpty) ...[
            const Divider(),
            // Customer Info Segment
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _phoneController,
                    keyboardType: TextInputType.phone,
                    decoration: const InputDecoration(
                      labelText: 'Customer Phone Number',
                      prefixIcon: Icon(Icons.phone),
                      border: OutlineInputBorder(),
                    ),
                  ),
                ),
                const SizedBox(width: 8),
                ElevatedButton(
                  onPressed: () => _lookupCustomer(state),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.blueGrey,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
                  ),
                  child: const Icon(Icons.check),
                ),
              ],
            ),
            const SizedBox(height: 8),
            if (state.customSelectedCustomer != null)
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                decoration: BoxDecoration(
                  color: Colors.green[50],
                  borderRadius: BorderRadius.circular(4),
                  border: Border.all(color: Colors.green[200]!),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.person, color: Colors.green),
                    const SizedBox(width: 8),
                    Text(
                      'Customer: ${state.customSelectedCustomer!['name']}',
                      style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.green),
                    ),
                  ],
                ),
              ),

            const SizedBox(height: 12),
            // Discount input
            TextField(
              controller: _discountController,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              decoration: const InputDecoration(
                labelText: 'Discount (₹)',
                prefixIcon: Icon(Icons.local_offer_outlined),
                border: OutlineInputBorder(),
              ),
              onChanged: (val) {
                final d = double.tryParse(val) ?? 0.0;
                state.setCustomDiscount(d);
              },
            ),

            const SizedBox(height: 16),
            // Financial Summary
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('Subtotal:', style: TextStyle(fontSize: 16)),
                Text('₹${state.customCartSubtotal.toStringAsFixed(2)}', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
              ],
            ),
            const SizedBox(height: 4),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('Discount:', style: TextStyle(fontSize: 16, color: Colors.red)),
                Text('- ₹${state.customDiscount.toStringAsFixed(2)}', style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: Colors.red)),
              ],
            ),
            const Divider(),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text('Total Amount:', style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                Text('₹${state.customCartFinalTotal.toStringAsFixed(2)}', style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.deepOrange)),
              ],
            ),

            const SizedBox(height: 16),
            // Action Buttons
            Row(
              children: [
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: _isProcessing
                        ? null
                        : () async {
                            setState(() => _isProcessing = true);
                            try {
                              await state.saveCustomPending();
                              if (mounted) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(content: Text('Custom Pending bill saved successfully!')),
                                );
                                _phoneController.clear();
                                _discountController.clear();
                              }
                            } catch (e) {
                              if (mounted) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  SnackBar(content: Text(e.toString().replaceAll('Exception: ', ''))),
                                );
                              }
                            } finally {
                              setState(() => _isProcessing = false);
                            }
                          },
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 14),
                    ),
                    icon: const Icon(Icons.save),
                    label: const Text('Save Pending'),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton.icon(
                    onPressed: _isProcessing
                        ? null
                        : () async {
                            final phone = _phoneController.text.trim();
                            if (phone.isNotEmpty && state.customSelectedCustomer == null) {
                              _lookupCustomer(state);
                              if (state.customSelectedCustomer == null) return;
                            } else if (phone.isEmpty) {
                              state.selectCustomCustomer(null);
                            }

                            setState(() => _isProcessing = true);
                            try {
                              await state.completeCustomOrder();
                              if (mounted) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(content: Text('Custom Order completed successfully!')),
                                );
                                _phoneController.clear();
                                _discountController.clear();
                              }
                            } catch (e) {
                              if (mounted) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  SnackBar(content: Text(e.toString().replaceAll('Exception: ', ''))),
                                );
                              }
                            } finally {
                              setState(() => _isProcessing = false);
                            }
                          },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.green,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                    ),
                    icon: const Icon(Icons.print),
                    label: const Text('Complete & Print'),
                  ),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}
