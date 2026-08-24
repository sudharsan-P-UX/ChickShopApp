import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/app_state.dart';

class CustomPendingScreen extends StatefulWidget {
  const CustomPendingScreen({super.key});

  @override
  State<CustomPendingScreen> createState() => _CustomPendingScreenState();
}

class _CustomPendingScreenState extends State<CustomPendingScreen> {
  String _searchQuery = '';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      Provider.of<AppState>(context, listen: false).fetchCustomPendingOrders();
    });
  }

  @override
  Widget build(BuildContext context) {
    final state = Provider.of<AppState>(context);
    final filteredBills = state.customPendingOrders.where((bill) {
      final query = _searchQuery.toLowerCase().trim();
      if (query.isEmpty) return true;
      
      final idMatches = bill['id'].toString().contains(query);
      final items = bill['items'] as List;
      final itemsMatch = items.any((i) => i['item_name'].toString().toLowerCase().contains(query));
      
      return idMatches || itemsMatch;
    }).toList();

    return Column(
      children: [
        // Search Header
        Padding(
          padding: const EdgeInsets.all(12.0),
          child: TextField(
            decoration: const InputDecoration(
              labelText: 'Search custom pending orders...',
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
        // Grid/List of Pending Orders
        Expanded(
          child: filteredBills.isEmpty
              ? const Center(child: Text('No custom pending orders found.'))
              : ListView.builder(
                  padding: const EdgeInsets.all(12),
                  itemCount: filteredBills.length,
                  itemBuilder: (context, index) {
                    final bill = filteredBills[index];
                    final int billId = bill['id'];
                    final double subtotal = double.tryParse(bill['subtotal'].toString()) ?? 0.0;
                    final date = DateTime.tryParse(bill['saved_at'].toString()) ?? DateTime.now();
                    final String dateStr = '${date.day.toString().padLeft(2, '0')}-${date.month.toString().padLeft(2, '0')}-${date.year} ${date.hour}:${date.minute.toString().padLeft(2, '0')}';

                    final items = bill['items'] as List;
                    final String itemsSummary = items.map((i) => "${i['item_name']} (${i['qty']} kg)").join(', ');

                    return Card(
                      margin: const EdgeInsets.only(bottom: 12),
                      elevation: 2,
                      child: Padding(
                        padding: const EdgeInsets.all(14.0),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(
                                  'Custom Pending Order #$billId',
                                  style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
                                ),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                  decoration: BoxDecoration(
                                    color: Colors.amber.withOpacity(0.2),
                                    borderRadius: BorderRadius.circular(4),
                                  ),
                                  child: Text(
                                    'Subtotal: ₹${subtotal.toStringAsFixed(2)}',
                                    style: const TextStyle(
                                      color: Colors.orange,
                                      fontWeight: FontWeight.bold,
                                      fontSize: 12,
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 8),
                            Text(
                              itemsSummary,
                              style: const TextStyle(fontSize: 13, color: Colors.grey),
                              maxLines: 2,
                              overflow: TextOverflow.ellipsis,
                            ),
                            const SizedBox(height: 12),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(
                                  dateStr,
                                  style: const TextStyle(fontSize: 11, color: Colors.grey),
                                ),
                                Row(
                                  children: [
                                    TextButton.icon(
                                      onPressed: () {
                                        showDialog(
                                          context: context,
                                          builder: (ctx) => AlertDialog(
                                            title: const Text('Delete Pending Bill'),
                                            content: const Text('Are you sure you want to delete this custom pending bill?'),
                                            actions: [
                                              TextButton(
                                                onPressed: () => Navigator.pop(ctx),
                                                child: const Text('Cancel'),
                                              ),
                                              TextButton(
                                                onPressed: () async {
                                                  await state.deleteCustomPending(billId);
                                                  if (mounted) Navigator.pop(ctx);
                                                  ScaffoldMessenger.of(context).showSnackBar(
                                                    const SnackBar(content: Text('Custom pending bill deleted')),
                                                  );
                                                },
                                                child: const Text('Delete', style: TextStyle(color: Colors.red)),
                                              ),
                                            ],
                                          ),
                                        );
                                      },
                                      icon: const Icon(Icons.delete_outline, size: 16, color: Colors.red),
                                      label: const Text('Delete', style: TextStyle(color: Colors.red, fontSize: 12)),
                                    ),
                                    const SizedBox(width: 8),
                                    ElevatedButton.icon(
                                      onPressed: () async {
                                        await state.restoreCustomPending(bill, true);
                                        ScaffoldMessenger.of(context).showSnackBar(
                                          SnackBar(content: Text('Recalled custom order #$billId')),
                                        );
                                      },
                                      style: ElevatedButton.styleFrom(
                                        backgroundColor: Colors.deepOrange,
                                        foregroundColor: Colors.white,
                                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                                      ),
                                      icon: const Icon(Icons.restore, size: 16),
                                      label: const Text('Recall', style: TextStyle(fontSize: 12)),
                                    ),
                                  ],
                                ),
                              ],
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
