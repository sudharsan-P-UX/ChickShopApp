import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/app_state.dart';
import '../services/api_service.dart';

class CustomBillScreen extends StatefulWidget {
  const CustomBillScreen({super.key});

  @override
  State<CustomBillScreen> createState() => _CustomBillScreenState();
}

class _CustomBillScreenState extends State<CustomBillScreen> {
  String _searchQuery = '';

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      Provider.of<AppState>(context, listen: false).fetchInventory();
    });
  }

  void _promptForWeight(BuildContext context, dynamic item, AppState state) {
    final itemId = item['id'];
    final double stock = double.tryParse(item['qty'].toString()) ?? 0.0;
    final double price = double.tryParse(item['price'].toString()) ?? 0.0;
    final double currentQty = state.customCart[itemId] ?? 0.0;

    final controller = TextEditingController(
      text: currentQty > 0.0 ? (currentQty % 1 == 0 ? currentQty.toInt().toString() : currentQty.toString()) : '',
    );

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: Text('Enter weight for ${item['item_name']}'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Price: ₹${price.toStringAsFixed(2)} / kg'),
            Text('Stock: ${stock.toStringAsFixed(2)} kg', style: const TextStyle(color: Colors.grey, fontSize: 13)),
            const SizedBox(height: 12),
            TextField(
              controller: controller,
              keyboardType: const TextInputType.numberWithOptions(decimal: true),
              autofocus: true,
              decoration: const InputDecoration(
                labelText: 'Weight (e.g. 3kg or 2.5)',
                hintText: '3',
                suffixText: 'kg',
                border: OutlineInputBorder(),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () {
              final String val = controller.text.trim();
              final String cleanVal = val.replaceAll(RegExp(r'[^\d.]'), '');
              final double? parsedVal = double.tryParse(cleanVal);
              
              if (parsedVal == null || parsedVal <= 0) {
                ScaffoldMessenger.of(ctx).showSnackBar(
                  const SnackBar(content: Text('Invalid weight quantity entered')),
                );
                return;
              }

              if (parsedVal > stock) {
                ScaffoldMessenger.of(ctx).showSnackBar(
                  SnackBar(content: Text('Cannot add weight. Only $stock kg in stock.')),
                );
                return;
              }

              state.addToCustomCart(item, parsedVal);
              Navigator.pop(ctx);
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(content: Text('Added $parsedVal kg of ${item['item_name']} to cart')),
              );
            },
            child: const Text('Add to Cart'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final state = Provider.of<AppState>(context);
    final filteredInventory = state.inventory.where((item) {
      if (item['is_custom_bill'] != true) return false;
      final name = item['item_name'].toString().toLowerCase();
      final query = _searchQuery.toLowerCase().trim();
      return query.isEmpty || name.contains(query);
    }).toList();

    return Column(
      children: [
        // Search Header and Checkout button
        Padding(
          padding: const EdgeInsets.all(12.0),
          child: Row(
            children: [
              Expanded(
                child: TextField(
                  decoration: const InputDecoration(
                    labelText: 'Search custom items...',
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
              const SizedBox(width: 12),
              ElevatedButton.icon(
                onPressed: () => state.setScreenIndex(9), // Switch to Custom Cart Screen
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.deepOrange,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                ),
                icon: const Icon(Icons.shopping_basket),
                label: Text(
                  'Cart (${state.customCartCount})',
                  style: const TextStyle(fontWeight: FontWeight.bold),
                ),
              ),
            ],
          ),
        ),
        // Product Grid
        Expanded(
          child: filteredInventory.isEmpty
              ? const Center(child: Text('No custom bill items found.'))
              : GridView.builder(
                  padding: const EdgeInsets.all(12),
                  gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 2,
                    childAspectRatio: 0.68,
                    crossAxisSpacing: 12,
                    mainAxisSpacing: 12,
                  ),
                  itemCount: filteredInventory.length,
                  itemBuilder: (context, index) {
                    final item = filteredInventory[index];
                    final int itemId = item['id'];
                    final double stock = double.tryParse(item['qty'].toString()) ?? 0.0;
                    final double price = double.tryParse(item['price'].toString()) ?? 0.0;
                    final double cartQty = state.customCart[itemId] ?? 0.0;
                    final bool isOutOfStock = stock <= 0;

                    return Card(
                      elevation: 2,
                      clipBehavior: Clip.antiAlias,
                      child: InkWell(
                        onTap: isOutOfStock ? null : () => _promptForWeight(context, item, state),
                        child: Stack(
                          children: [
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                Expanded(
                                  child: Container(
                                    color: Colors.grey[200],
                                    child: item['image_url'] != null
                                        ? Image.network(
                                            item['image_url'].startsWith('http')
                                                ? item['image_url']
                                                : '${ApiService.baseUrl.replaceAll('/api', '')}${item['image_url']}',
                                            fit: BoxFit.cover,
                                            errorBuilder: (context, error, stackTrace) => const Icon(
                                              Icons.restaurant,
                                              size: 40,
                                              color: Colors.grey,
                                            ),
                                          )
                                        : const Icon(
                                            Icons.restaurant,
                                            size: 40,
                                            color: Colors.grey,
                                          ),
                                  ),
                                ),
                                Padding(
                                  padding: const EdgeInsets.symmetric(horizontal: 8.0, vertical: 4.0),
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(
                                        item['item_name'],
                                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 13),
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                      const SizedBox(height: 2),
                                      Text(
                                        '₹${price.toStringAsFixed(2)} / kg',
                                        style: const TextStyle(color: Colors.green, fontWeight: FontWeight.bold, fontSize: 13),
                                      ),
                                      const SizedBox(height: 2),
                                      Text(
                                        isOutOfStock ? 'OUT OF STOCK' : 'Stock: ${stock.toStringAsFixed(2)} kg',
                                        style: TextStyle(
                                          fontSize: 10,
                                          color: isOutOfStock ? Colors.red : Colors.grey,
                                          fontWeight: isOutOfStock ? FontWeight.bold : FontWeight.normal,
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                                Padding(
                                  padding: const EdgeInsets.all(8.0),
                                  child: isOutOfStock
                                      ? Container(
                                          width: double.infinity,
                                          height: 32,
                                          decoration: BoxDecoration(
                                            color: Colors.grey[800],
                                            borderRadius: BorderRadius.circular(4),
                                          ),
                                          child: const Center(
                                            child: Text(
                                              'Out of Stock',
                                              style: TextStyle(color: Colors.grey, fontSize: 11, fontWeight: FontWeight.bold),
                                            ),
                                          ),
                                        )
                                      : ElevatedButton(
                                          onPressed: () => _promptForWeight(context, item, state),
                                          style: ElevatedButton.styleFrom(
                                            backgroundColor: Colors.deepOrange,
                                            foregroundColor: Colors.white,
                                            minimumSize: const Size(double.infinity, 32),
                                            padding: EdgeInsets.zero,
                                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
                                            elevation: 0,
                                          ),
                                          child: Text(
                                            cartQty > 0 ? 'Update ($cartQty kg)' : 'Add Weight',
                                            style: const TextStyle(fontSize: 12, fontWeight: FontWeight.bold),
                                          ),
                                        ),
                                ),
                              ],
                            ),
                            if (isOutOfStock)
                              Positioned.fill(
                                child: Container(
                                  color: Colors.black.withOpacity(0.4),
                                  child: Center(
                                    child: RotationTransition(
                                      turns: const AlwaysStoppedAnimation(-15 / 360),
                                      child: Container(
                                        padding: const EdgeInsets.all(4),
                                        color: Colors.red,
                                        child: const Text(
                                          'OUT OF STOCK',
                                          style: TextStyle(color: Colors.white, fontSize: 10, fontWeight: FontWeight.bold),
                                        ),
                                      ),
                                    ),
                                  ),
                                ),
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
