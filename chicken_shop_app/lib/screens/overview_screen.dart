import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/app_state.dart';

class OverviewScreen extends StatefulWidget {
  const OverviewScreen({super.key});

  @override
  State<OverviewScreen> createState() => _OverviewScreenState();
}

class _OverviewScreenState extends State<OverviewScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final state = Provider.of<AppState>(context, listen: false);
      state.fetchCompletedBills();
      state.fetchInventory();
      state.fetchCustomers();
    });
  }

  void _showSalesHistoryDialog(BuildContext context, AppState state) {
    String searchQuery = '';
    showDialog(
      context: context,
      builder: (context) {
        return StatefulBuilder(
          builder: (context, setStateDialog) {
            final filteredBills = state.completedBills.where((bill) {
              final query = searchQuery.toLowerCase().trim();
              if (query.isEmpty) return true;
              final billNoMatches = bill['bill_no'].toString().contains(query);
              final phoneMatches = bill['customer_phone'] != null &&
                  bill['customer_phone'].toString().contains(query);
              return billNoMatches || phoneMatches;
            }).toList();

            return AlertDialog(
              title: const Text('Complete Sales History'),
              content: SizedBox(
                width: 600,
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    TextField(
                      decoration: const InputDecoration(
                        labelText: 'Search sales by bill no or customer phone...',
                        prefixIcon: Icon(Icons.search),
                        border: OutlineInputBorder(),
                      ),
                      onChanged: (val) {
                        setStateDialog(() {
                          searchQuery = val;
                        });
                      },
                    ),
                    const SizedBox(height: 16),
                    Expanded(
                      child: filteredBills.isEmpty
                          ? const Center(child: Text('No sales records found'))
                          : ListView.builder(
                              shrinkWrap: true,
                              itemCount: filteredBills.length,
                              itemBuilder: (context, index) {
                                final bill = filteredBills[index];
                                final itemsCount = (bill['items'] as List)
                                    .fold<int>(0, (sum, i) => sum + (int.tryParse(i['qty'].toString()) ?? 0));
                                final date = DateTime.tryParse(bill['created_at'].toString()) ?? DateTime.now();
                                
                                return ListTile(
                                  title: Text('Bill #${bill['bill_no']} (${bill['customer_phone'] ?? 'Walking Customer'})'),
                                  subtitle: Text('Items: $itemsCount | Date: ${date.day}-${date.month}-${date.year}'),
                                  trailing: Text(
                                    '₹${double.parse(bill['final_price'].toString()).toStringAsFixed(2)}',
                                    style: const TextStyle(fontWeight: FontWeight.bold, color: Colors.green),
                                  ),
                                  onTap: () {
                                    Navigator.pop(context);
                                    _showReceiptDialog(context, bill, state);
                                  },
                                );
                              },
                            ),
                    ),
                  ],
                ),
              ),
              actions: [
                TextButton(
                  onPressed: () => Navigator.pop(context),
                  child: const Text('Close'),
                ),
              ],
            );
          },
        );
      },
    );
  }

  void _showReceiptDialog(BuildContext context, dynamic bill, AppState state) {
    final date = DateTime.tryParse(bill['created_at'].toString()) ?? DateTime.now();
    final String dateStr = '${date.day.toString().padLeft(2, '0')}-${date.month.toString().padLeft(2, '0')}-${date.year}';
    
    // Customer details lookup
    final customer = state.customers.firstWhere(
      (c) => c['phone_no'] == bill['customer_phone'],
      orElse: () => null,
    );
    final custName = customer != null ? customer['name'] : 'Walking Customer';
    final custPhone = bill['customer_phone'] ?? 'N/A';

    final List items = bill['items'] as List;

    showDialog(
      context: context,
      builder: (context) {
        return AlertDialog(
          title: Row(
            children: const [
              Icon(Icons.restaurant, color: Colors.deepOrange),
              SizedBox(width: 8),
              Expanded(child: Text('Chicken Shop Invoice')),
            ],
          ),
          content: SingleChildScrollView(
            child: SizedBox(
              width: 400,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Center(
                    child: Text(
                      'CHICKEN SHOP',
                      style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18),
                    ),
                  ),
                  const Center(
                    child: Text(
                      'Delicious Fried Chicken POS System',
                      style: TextStyle(fontSize: 10, color: Colors.grey),
                    ),
                  ),
                  const Divider(),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text('Bill No: #${bill['bill_no']}', style: const TextStyle(fontWeight: FontWeight.bold)),
                      Text('Date: $dateStr'),
                    ],
                  ),
                  const SizedBox(height: 8),
                  Text('Customer Name: $custName'),
                  Text('Phone: $custPhone'),
                  const Divider(),
                  // Items Table Header
                  Row(
                    children: const [
                      Expanded(flex: 1, child: Text('No.', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12))),
                      Expanded(flex: 4, child: Text('Item Name', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12))),
                      Expanded(flex: 1, child: Text('Qty', textAlign: TextAlign.center, style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12))),
                      Expanded(flex: 2, child: Text('Price', textAlign: TextAlign.right, style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12))),
                      Expanded(flex: 2, child: Text('Total', textAlign: TextAlign.right, style: TextStyle(fontWeight: FontWeight.bold, fontSize: 12))),
                    ],
                  ),
                  const SizedBox(height: 4),
                  ...List.generate(items.length, (index) {
                    final item = items[index];
                    final price = double.tryParse(item['price'].toString()) ?? 0.0;
                    final qty = int.tryParse(item['qty'].toString()) ?? 0;
                    final total = price * qty;
                    return Padding(
                      padding: const EdgeInsets.symmetric(vertical: 4.0),
                      child: Row(
                        children: [
                          Expanded(flex: 1, child: Text('${index + 1}')),
                          Expanded(flex: 4, child: Text(item['item_name'])),
                          Expanded(flex: 1, child: Text('$qty', textAlign: TextAlign.center)),
                          Expanded(flex: 2, child: Text('₹${price.toStringAsFixed(2)}', textAlign: TextAlign.right)),
                          Expanded(flex: 2, child: Text('₹${total.toStringAsFixed(2)}', textAlign: TextAlign.right)),
                        ],
                      ),
                    );
                  }),
                  const Divider(),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Subtotal:'),
                      Text('₹${double.parse(bill['total_amount'].toString()).toStringAsFixed(2)}'),
                    ],
                  ),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Discount:', style: TextStyle(color: Colors.red)),
                      Text('-₹${double.parse(bill['discount'].toString()).toStringAsFixed(2)}', style: const TextStyle(color: Colors.red)),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      const Text('Total Paid:', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                      Text(
                        '₹${double.parse(bill['final_price'].toString()).toStringAsFixed(2)}',
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16, color: Colors.deepOrange),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ),
          actions: [
            ElevatedButton(
              onPressed: () => Navigator.pop(context),
              style: ElevatedButton.styleFrom(backgroundColor: Colors.deepOrange, foregroundColor: Colors.white),
              child: const Text('Close Receipt'),
            )
          ],
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final state = Provider.of<AppState>(context);
    
    // Calculations
    double totalRevenue = state.completedBills.fold<double>(
      0.0,
      (sum, bill) => sum + (double.tryParse(bill['final_price'].toString()) ?? 0.0),
    );
    int completedBillsCount = state.completedBills.length;
    int lowStockCount = state.inventory.where((item) => (int.tryParse(item['qty'].toString()) ?? 0) < 5).length;
    int registeredCustomersCount = state.customers.length;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            crossAxisSpacing: 16,
            mainAxisSpacing: 16,
            childAspectRatio: 0.82,
            children: [
              _buildStatCard(
                title: 'Total Revenue',
                value: '₹${totalRevenue.toStringAsFixed(2)}',
                subtitle: 'All completed orders',
                icon: Icons.monetization_on,
                color: Colors.green,
                onTap: () => _showSalesHistoryDialog(context, state),
              ),
              _buildStatCard(
                title: 'Completed Bills',
                value: '$completedBillsCount',
                subtitle: 'Successfully processed',
                icon: Icons.receipt_long,
                color: Colors.blue,
                onTap: () => _showSalesHistoryDialog(context, state),
              ),
              _buildStatCard(
                title: 'Low Stock Alert',
                value: '$lowStockCount',
                subtitle: 'Quantity < 5 warning',
                icon: Icons.warning,
                color: Colors.orange,
                onTap: () => state.setScreenIndex(4), // Go to Inventory Control
              ),
              _buildStatCard(
                title: 'Registered Customers',
                value: '$registeredCustomersCount',
                subtitle: 'Total loyalty database',
                icon: Icons.people,
                color: Colors.purple,
                onTap: () => state.setScreenIndex(5), // Go to Customers Directory
              ),
            ],
          ),
          const SizedBox(height: 24),
          const Text(
            'Recent Sales (Tap to view invoice)',
            style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
          ),
          const SizedBox(height: 12),
          state.completedBills.isEmpty
              ? const Card(
                  child: Padding(
                    padding: EdgeInsets.all(16.0),
                    child: Center(child: Text('No completed bills yet. Make a sale to view here!')),
                  ),
                )
              : Card(
                  child: ListView.builder(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    itemCount: state.completedBills.length > 5 ? 5 : state.completedBills.length,
                    itemBuilder: (context, index) {
                      final bill = state.completedBills[index];
                      final itemsCount = (bill['items'] as List)
                          .fold<int>(0, (sum, i) => sum + (int.tryParse(i['qty'].toString()) ?? 0));
                      final date = DateTime.tryParse(bill['created_at'].toString()) ?? DateTime.now();
                      
                      return Column(
                        children: [
                          ListTile(
                            leading: const CircleAvatar(
                              backgroundColor: Colors.deepOrange,
                              foregroundColor: Colors.white,
                              child: Icon(Icons.shopping_bag_outlined),
                            ),
                            title: Text('Bill #${bill['bill_no']} | ${bill['customer_phone'] ?? 'Walking Customer'}'),
                            subtitle: Text('$itemsCount items | Date: ${date.day}-${date.month}-${date.year} ${date.hour}:${date.minute.toString().padLeft(2, '0')}'),
                            trailing: Text(
                              '₹${double.parse(bill['final_price'].toString()).toStringAsFixed(2)}',
                              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14, color: Colors.green),
                            ),
                            onTap: () => _showReceiptDialog(context, bill, state),
                          ),
                          if (index < (state.completedBills.length > 5 ? 4 : state.completedBills.length - 1))
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

  Widget _buildStatCard({
    required String title,
    required String value,
    required String subtitle,
    required IconData icon,
    required Color color,
    required VoidCallback onTap,
  }) {
    return Card(
      elevation: 3,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(12),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Icon(icon, color: color, size: 28),
                  const Icon(Icons.arrow_forward_ios, size: 12, color: Colors.grey),
                ],
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    value,
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 20),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    title,
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12),
                  ),
                  Text(
                    subtitle,
                    style: const TextStyle(fontSize: 9, color: Colors.grey),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
