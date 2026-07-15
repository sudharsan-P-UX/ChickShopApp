import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/app_state.dart';
import '../services/api_service.dart';

class CartScreen extends StatefulWidget {
  const CartScreen({super.key});

  @override
  State<CartScreen> createState() => _CartScreenState();
}

class _CartScreenState extends State<CartScreen> {
  final TextEditingController _phoneController = TextEditingController();
  final TextEditingController _discountController = TextEditingController();

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final state = Provider.of<AppState>(context, listen: false);
      state.fetchCustomers();
      if (state.selectedCustomer != null) {
        _phoneController.text = state.selectedCustomer!['phone_no'] ?? '';
      }
      _discountController.text = state.discount > 0 ? state.discount.toString() : '';
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

    // Refresh customers list
    await state.fetchCustomers();

    final customer = state.customers.firstWhere(
      (c) => c['phone_no'] == phone,
      orElse: () => null,
    );

    if (customer != null) {
      state.selectCustomer(customer);
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
                  state.selectCustomer(newCustomer);
                  await state.fetchCustomers();
                  Navigator.pop(context);
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('Registered and selected customer: $name')),
                  );
                } catch (e) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text('Error: ${e.toString()}')),
                  );
                }
              },
              style: ElevatedButton.styleFrom(backgroundColor: Colors.deepOrange, foregroundColor: Colors.white),
              child: const Text('Register & Select'),
            ),
          ],
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final state = Provider.of<AppState>(context);
    final cartEntries = state.cart.entries.toList();

    if (cartEntries.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.shopping_basket_outlined, size: 80, color: Colors.grey),
            const SizedBox(height: 16),
            const Text(
              'Your shopping cart is empty',
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18, color: Colors.grey),
            ),
            const SizedBox(height: 8),
            const Text('Go back to the Billing grid to select items.'),
            const SizedBox(height: 20),
            ElevatedButton(
              onPressed: () => state.setScreenIndex(0), // Back to Billing POS
              style: ElevatedButton.styleFrom(backgroundColor: Colors.deepOrange, foregroundColor: Colors.white),
              child: const Text('Go to Billing & POS'),
            ),
          ],
        ),
      );
    }

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            state.getLabel('cart_details_title', 'Shopping Cart Details'),
            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
          ),
          const SizedBox(height: 12),
          // Cart Items Card List
          Card(
            child: ListView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              itemCount: cartEntries.length,
              itemBuilder: (context, index) {
                final entry = cartEntries[index];
                final int itemId = entry.key;
                final int qty = entry.value;
                final item = state.inventory.firstWhere((i) => i['id'] == itemId, orElse: () => null);

                if (item == null) return const SizedBox.shrink();

                final price = double.tryParse(item['price'].toString()) ?? 0.0;
                final subtotal = price * qty;

                return Column(
                  children: [
                    ListTile(
                      title: Text(item['item_name'], style: const TextStyle(fontWeight: FontWeight.bold)),
                      subtitle: Text('Price: ₹${price.toStringAsFixed(2)} | Subtotal: ₹${subtotal.toStringAsFixed(2)}'),
                      trailing: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          IconButton(
                            icon: const Icon(Icons.remove_circle_outline, color: Colors.deepOrange),
                            onPressed: () {
                              try {
                                state.updateCartQty(itemId, -1);
                              } catch (e) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  SnackBar(content: Text(e.toString())),
                                );
                              }
                            },
                          ),
                          Text('$qty', style: const TextStyle(fontSize: 15, fontWeight: FontWeight.bold)),
                          IconButton(
                            icon: const Icon(Icons.add_circle_outline, color: Colors.green),
                            onPressed: () {
                              try {
                                state.updateCartQty(itemId, 1);
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
                    if (index < cartEntries.length - 1)
                      const Divider(height: 1),
                  ],
                );
              },
            ),
          ),
          const SizedBox(height: 20),
          // Customer Details section
          const Text(
            'Loyalty Customer',
            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
          ),
          const SizedBox(height: 12),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(12.0),
              child: Column(
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: _phoneController,
                          keyboardType: TextInputType.phone,
                          decoration: InputDecoration(
                            labelText: state.getLabel('customer_phone_label', 'Customer Phone Number'),
                            prefixIcon: const Icon(Icons.phone),
                            border: const OutlineInputBorder(),
                          ),
                        ),
                      ),
                      const SizedBox(width: 8),
                      ElevatedButton(
                        onPressed: () => _lookupCustomer(state),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.grey[800],
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 16),
                        ),
                        child: const Icon(Icons.check),
                      ),
                    ],
                  ),
                  if (state.selectedCustomer != null) ...[
                    const SizedBox(height: 12),
                    Container(
                      padding: const EdgeInsets.all(8),
                      decoration: BoxDecoration(
                        color: Colors.green.withOpacity(0.1),
                        borderRadius: BorderRadius.circular(8),
                        border: Border.all(color: Colors.green.withOpacity(0.5)),
                      ),
                      child: Row(
                        children: [
                          const Icon(Icons.person, color: Colors.green),
                          const SizedBox(width: 8),
                          Text(
                            'Attached: ${state.selectedCustomer!['name']}',
                            style: const TextStyle(color: Colors.green, fontWeight: FontWeight.bold),
                          ),
                          const Spacer(),
                          IconButton(
                            icon: const Icon(Icons.close, color: Colors.green),
                            onPressed: () {
                              state.selectCustomer(null);
                              _phoneController.clear();
                            },
                          )
                        ],
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
          const SizedBox(height: 20),
          // Checkout Financial Summary
          const Text(
            'Order Financials',
            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
          ),
          const SizedBox(height: 12),
          Card(
            child: Padding(
              padding: const EdgeInsets.all(16.0),
              child: Column(
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(state.getLabel('cart_subtotal_label', 'Subtotal') + ':'),
                      Text('₹${state.cartSubtotal.toStringAsFixed(2)}'),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(state.getLabel('cart_discount_label', 'Discount (₹)') + ':'),
                      SizedBox(
                        width: 100,
                        height: 40,
                        child: TextField(
                          controller: _discountController,
                          keyboardType: const TextInputType.numberWithOptions(decimal: true),
                          textAlign: TextAlign.right,
                          decoration: const InputDecoration(
                            border: OutlineInputBorder(),
                            contentPadding: EdgeInsets.all(8),
                          ),
                          onChanged: (val) {
                            final double disc = double.tryParse(val) ?? 0.0;
                            state.setDiscount(disc);
                          },
                        ),
                      ),
                    ],
                  ),
                  const Divider(),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(state.getLabel('cart_total_label', 'Final Total') + ':', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                      Text(
                        '₹${state.cartFinalTotal.toStringAsFixed(2)}',
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: Colors.deepOrange),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 24),
          // Action buttons
          Column(
            children: [
              ElevatedButton.icon(
                onPressed: () async {
                  try {
                    await state.savePending();
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Order saved as Pending Order successfully!')),
                    );
                    state.setScreenIndex(3); // Redirect to Pending orders
                  } catch (e) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text('Error: ${e.toString()}')),
                    );
                  }
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.grey[800],
                  foregroundColor: Colors.white,
                  minimumSize: const Size.fromHeight(50),
                ),
                icon: const Icon(Icons.bookmark_outline),
                label: Text(state.getLabel('save_pending_button', 'Save Pending Bill')),
              ),
              const SizedBox(height: 12),
              ElevatedButton.icon(
                onPressed: () async {
                  try {
                    await state.completeOrder();
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(content: Text('Sale processed and completed successfully!')),
                    );
                    state.setScreenIndex(0); // Redirect to POS billing grid
                  } catch (e) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text('Error completing order: ${e.toString()}')),
                    );
                  }
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.green,
                  foregroundColor: Colors.white,
                  minimumSize: const Size.fromHeight(50),
                ),
                icon: const Icon(Icons.print_outlined),
                label: Text(state.getLabel('complete_bill_button', 'Print & Complete Bill')),
              ),
            ],
          )
        ],
      ),
    );
  }
}
